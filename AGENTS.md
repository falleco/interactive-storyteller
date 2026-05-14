# Agent Brief — Wonder Tales

Yarn 4 monorepo: Expo mobile + NestJS API. This document captures non-obvious decisions so future-you doesn't relearn the same lessons.

## Layout

```
apps/
  mobile/   Expo SDK 54, React Native 0.81, expo-router, NativeWind, Hermes
  api/      NestJS 11, Prisma 6, Better Auth, BullMQ, cache-manager v6
packages/
  shared/   Types-only package (no build step — main/types point at src/*.ts)
```

## Tooling

- **Package manager**: Yarn 4 (`nodeLinker: node-modules`). Never enable PnP — RN/Expo doesn't tolerate it.
- **Lint/format**: Biome 2 at repo root (`biome.json`). Single config governs everything. Run `yarn check:fix`.
- **TypeScript**: each workspace has its own `tsconfig.json`. The API uses `rootDir: ./src` + `tsBuildInfoFile: ./dist/.tsbuildinfo` so stale incremental cache gets deleted by Nest's `deleteOutDir`.
- **Tests**: NestJS-side specs live in `apps/api/src/**/__tests__/*.spec.ts` (alongside the file they test). E2E specs in `apps/api/test/*.e2e-spec.ts`. Transformer is `@swc/jest`, not `ts-jest` — see "Gotchas".
- **Mobile tests**: vitest in `apps/mobile/`.

## Auth — Better Auth

[apps/api/src/auth/auth.ts](apps/api/src/auth/auth.ts) builds the singleton `auth` object via `betterAuth({...})` at **module load time**. Mounted in [main.ts](apps/api/src/main.ts) as `app.use('/api/auth', toNodeHandler(auth))` — **must be before** `express.json()` body parser.

- Providers: Google + Apple (social only, no email/password).
- `clientSecret` for Apple is generated synchronously via `jsonwebtoken` (ES256). `jose` doesn't work here because it's async-only and `betterAuth({...})` is synchronous (NestJS is CJS, no top-level await).
- `appBundleIdentifier` validates `aud` of native iOS Sign In tokens.
- **Dev fallback**: `audience: [<bundle>, 'host.exp.Exponent']` in non-production so Apple Sign In works in Expo Go (the token comes with `aud=host.exp.Exponent`). Production drops `host.exp.Exponent`.
- `bearer()` plugin enables `Authorization: Bearer <session-token>` for mobile.
- `expo()` plugin adds `/api/auth/expo-authorization-proxy` (the OAuth proxy used by `@better-auth/expo` client to bridge browser → app scheme).
- **trustedOrigins** must include the Expo scheme (e.g. `wondertales://`). Otherwise OAuth `callbackURL` is rejected with `Invalid callbackURL`.

### databaseHooks
- `user.create.after` → enqueues `user.created` on the `user-events` BullMQ queue.
- `session.create.before` → blocks login when `user.active === false`, throws `APIError('FORBIDDEN', { code: 'ACCOUNT_INACTIVE' })`.

### Mounting in NestJS
The handler is mounted via `app.use('/api/auth', toNodeHandler(auth))` — **plain prefix string**. The fancier `'/api/auth/{*splat}'` Express 5 syntax silently strips the query string from `req.url` and breaks `/expo-authorization-proxy?authorizationURL=...`.

### Session refresh
Rolling sessions. Defaults: `expiresIn: 7d`, `updateAge: 1d`. When a request comes in with <1d left, the server bumps `expiresAt` and returns a new `Set-Cookie`. No refresh tokens, no JWT — token is opaque, stored in `session` table.

## Prisma

[apps/api/prisma/schema.prisma](apps/api/prisma/schema.prisma):
- Models follow Better Auth's expected shape (`User`, `Session`, `Account`, `Verification`) plus our `User.active` flag.
- **SQL columns are snake_case** via `@map(...)`. Prisma client API stays camelCase. Don't drop the `@map`s.
- Table names: singular lowercase (`user`, `session`, `account`, `verification`) via `@@map`.
- IDE may flag the `url = env("DATABASE_URL")` line as deprecated — that's the Prisma 7 lint preview. The CLI (`prisma 6.19`) still requires it. Ignore the red squiggle.

## ConfigService

[apps/api/src/config/configuration.ts](apps/api/src/config/configuration.ts) exports `GetAppConfiguration` (factory) and `AppConfigurationType` (derived from the return type). `app.module.ts` loads it via `ConfigModule.forRoot({ load: [GetAppConfiguration] })`.

Usage pattern, idiomatic:
```ts
constructor(
  private readonly config: ConfigService<AppConfigurationType, true>,
) {}
this.config.getOrThrow('redis', { infer: true }).url;
```

The `true` second generic makes `getOrThrow` return non-undefined types. Always pass `{ infer: true }` so the key narrows and the return type is inferred from `AppConfigurationType`.

**Places that intentionally still use `process.env` directly**: [auth.ts](apps/api/src/auth/auth.ts) and [user-events.queue.ts](apps/api/src/queue/user-events.queue.ts) — both run code at module top-level, before NestJS DI exists. Don't try to refactor these to ConfigService.

## Cache

Cache-manager v6 with Keyv stores. Configured in [cache.configuration.ts](apps/api/src/config/cache.configuration.ts) as `CacheConfigFactory implements CacheOptionsFactory`, registered globally in [app.module.ts](apps/api/src/app.module.ts) via `CacheModule.registerAsync({ useClass: CacheConfigFactory })`. TTL stored in seconds in config, multiplied by 1000 when passed to Keyv (which uses ms).

```ts
@Inject(CACHE_MANAGER) private cache: Cache;
await cache.get<T>('key');
await cache.set('key', value, ttlMs);
```

## Queues — BullMQ

Two-sided setup:

- **Worker (consumer)**: NestJS-managed via `@nestjs/bullmq`. [queue.module.ts](apps/api/src/queue/queue.module.ts) registers `BullModule.forRootAsync` (injects `ConfigService` for REDIS_URL) + `BullModule.registerQueue({ name: USER_EVENTS_QUEUE })`. The `UserEventsProcessor` (`@Processor` decorator extending `WorkerHost`) consumes jobs.

- **Publisher**: standalone `Queue` singleton in [user-events.queue.ts](apps/api/src/queue/user-events.queue.ts) via lazy `getUserEventsQueue()`. Required because publishing happens inside Better Auth `databaseHooks` (top-level, outside DI). Both publisher and worker connect to the same Redis queue — BullMQ recommends separate clients anyway.

To add a queue: copy the pattern. New constants in `<name>.queue.ts`, new processor, register in `queue.module.ts`.

## Health

[apps/api/src/health/](apps/api/src/health/) — `GET /health` powered by `@nestjs/terminus`.

- Postgres: `PrismaHealthIndicator.pingCheck('postgres', prisma)`.
- Redis: `RedisHealthIndicator` from `@liaoliaots/nestjs-redis-health`, with a **dedicated `ioredis` client** provided via `HEALTH_REDIS_CLIENT` token. Why dedicated: BullMQ's client has `maxRetriesPerRequest: null` (needed for blocking commands) which would hang health checks. The health client uses `maxRetriesPerRequest: 1` so PING fails fast.
- `HealthModule` implements `OnApplicationShutdown` to `.quit()` the Redis client. The hook is idempotent (`status === 'end'` check + try/catch falling back to `disconnect()`) so e2e teardown doesn't crash.
- Requires `app.enableShutdownHooks()` in [main.ts](apps/api/src/main.ts).

## Mobile — Auth Client

[apps/mobile/src/shared/auth/auth-client.ts](apps/mobile/src/shared/auth/auth-client.ts) creates the singleton `authClient` with `@better-auth/expo` `expoClient` plugin (uses `expo-secure-store` for session persistence). Scheme is `wondertales`, storagePrefix `wondertales`.

Base URL resolution (shared by `auth-client` and the API helper) lives in [apps/mobile/src/shared/api/base-url.ts](apps/mobile/src/shared/api/base-url.ts):
1. `EXPO_PUBLIC_API_URL` env if set.
2. Else infer from Metro `Constants.expoConfig.hostUri` + port 4000.
3. Else `http://localhost:4000`.

## Mobile — useAuth

[apps/mobile/src/shared/hooks/use-auth.tsx](apps/mobile/src/shared/hooks/use-auth.tsx) wraps `authClient.useSession()` and exposes:
- `user` (mapped to a stable shape), `isLoading`, `bearerToken` (`data.session?.token`).
- `signInWithGoogle()` — OAuth via WebBrowser (`authClient.signIn.social({ provider: 'google', callbackURL: 'wondertales://' })`).
- `signInWithApple()` — **native flow on iOS** via `expo-apple-authentication`, passes `identityToken` to `authClient.signIn.social({ provider: 'apple', idToken: { token } })`. Falls back to OAuth browser flow on Android/web.
- `signOut()`, `refetch()`.

`useApi()` ([apps/mobile/src/shared/api/use-api.ts](apps/mobile/src/shared/api/use-api.ts)) wraps the API helper with the current bearer token. Use that in features:
```ts
const api = useApi();
const me = await api.get<MeResponse>('/me');
```

`ApiError` thrown by the helper has `{ status, code, message, body }` — `code: 'ACCOUNT_INACTIVE'` and similar Better Auth error codes bubble through unchanged.

## Mobile — Host-singleton pattern for full-screen overlays

[apps/mobile/src/shared/components/core/sidebar-host.tsx](apps/mobile/src/shared/components/core/sidebar-host.tsx) and [apps/mobile/src/shared/components/core/wonder-sheet-host.tsx](apps/mobile/src/shared/components/core/wonder-sheet-host.tsx) are mounted near the root in [_layout.tsx](apps/mobile/src/app/_layout.tsx), wrapping `<Stack>`. Each exposes a context (`useSidebar`, `useWonderSheet`) with `open/close/toggle`. The singleton overlay sits as a sibling of `{children}` so it can extend full-screen — overlays mounted inside a tab-bar / screen container get clipped by the container's geometry. Same pattern for any future modal-ish UI that needs to escape its parent.

Order in [_layout.tsx](apps/mobile/src/app/_layout.tsx): `SidebarHost > WonderSheetHost > Stack`. Reason: sheet should sit on top of the sidebar in z-order, but inside the theme-transition snapshot. `<DevMenuFab />` lives inside the WonderSheetHost children so it gets hidden by the wonder-sheet's overlay when open.

## Mobile — Skia + Fabric + Android `pointerEvents` gotcha

RN 0.81 + Fabric on Android does **not** reliably propagate the JSX `pointerEvents` prop to Skia's `<Canvas>` host view. A `<Canvas pointerEvents="none" style={StyleSheet.absoluteFill}>` left mounted at root absorbs every touch on the screen, making the whole app feel frozen. Two specific bugs we hit and fixed:

1. **[color-scheme-context.tsx](apps/mobile/src/shared/theme/color-scheme-context.tsx)** — the theme-transition Canvas used to be mounted always. Fix: gate it on `state.overlay1 != null` so it only mounts during the transition.
2. **[wonder-sheet.tsx](apps/mobile/src/shared/components/core/wonder-sheet.tsx)** — the sheet's Skia blob Canvas is now inside `{overlayMounted ? ... : null}` so it only mounts while the sheet is open or animating. When closed, only the FAB is rendered.

Belt-and-suspenders: apply `pointerEvents="none"` both via JSX prop **and** via `style={{ pointerEvents: 'none' }}` (Fabric prefers the style form). Wrap the Canvas in a `<View pointerEvents="none">` for extra safety.

## Mobile — WonderSheet (Skia blob FAB sheet)

[apps/mobile/src/shared/components/core/wonder-sheet.tsx](apps/mobile/src/shared/components/core/wonder-sheet.tsx) — 3-step wizard (mode → template → narrator) inside a Reflectly-style Skia blob that grows from the tab-bar FAB. The FAB itself lives **inside** the WonderSheet (not the tab-bar), rendered after the Canvas so it sits visually on top of the blob (otherwise the white blob covers the purple button). The FAB is gated on `useSegments()[0] === '(tabs)'` so it only appears on tab screens.

Container height is content-adaptive: `position: absolute; bottom: <FAB top>; maxHeight: sheetMaxHeight`, no `top`. `onLayout` measures real height → `heightShared` tweens (320ms) → shader's `u_sheetHeight` uses the shared value. Inside, list-based steps (templates / narrators) wrap their `<ScrollView>` with `style={{ maxHeight }}` so they scroll when content overflows but hug content when short.

**Step transition pattern** (avoid the "new content rendered at old size" glitch): fade-out current → swap `displayedStep` while invisible → wait for blob morph → fade-in. Implementation uses a `displayedStepRef` shadow of the state because putting `displayedStep` in the orchestrator effect's deps causes the effect to re-run when `setDisplayedStep` fires inside the fade-out callback, cancelling the fade-in timer in the cleanup. Pattern documented inline in the file.

**Storyteller identifier vs id**: the backend keys storytellers by `identifier` (slug), not the database `id`. Pass `storyteller.identifier` to `create({ storyteller: ... })`. Same in [imagine.tsx](apps/mobile/src/app/imagine.tsx).

## Mobile — LiquidSwipe (book player page turn)

[apps/mobile/src/shared/components/core/liquid-swipe/](apps/mobile/src/shared/components/core/liquid-swipe/) — port of William Candillon's Season 5 LiquidSwipe. Bezier wave mask (SDF-free, pure SVG path) over a `<MaskedView>` reveals the next/prev slide as the user pulls from the edge. `@react-native-masked-view/masked-view@0.3.x` works on both iOS and Android with new arch — the earlier translate-fallback for Android was needed pre-0.3 but no longer.

Key files:
- `wave.tsx` — SVG path animation via `useAnimatedProps`, wrapped in `MaskedView`. Cross-platform.
- `slider.tsx` — `Gesture.Pan` with `activeOffsetX([-12, 12]) + failOffsetY([-16, 16])` so vertical scrolling inside slides (`<ScrollView>`) passes through. Also drives the idle "hint" pulse (wave bulges out + arrow springs right with `Easing.elastic` rubber-band) after `hintAfterMs` of inactivity.
- `pull-button.tsx` — chevron riding the wave; receives `hintProgress` (for purple tint) and `iconOffset` (for the spring-back motion).

In Reanimated 4, `withSpring` config dropped `restSpeedThreshold` / `restDisplacementThreshold` — `overshootClamping: true` is the replacement.

## Mobile — BookPlayer audio + narrated text

[apps/mobile/src/features/books/book-player.tsx](apps/mobile/src/features/books/book-player.tsx) drives a slide stack (cover, page, choices, loading-next, end) through the LiquidSwipe Slider. Audio handled by [use-book-audio.ts](apps/mobile/src/features/books/use-book-audio.ts).

**Audio source-tracking gotchas** in `useBookAudio`:
- When `source` changes, `expo-audio`'s status hook still returns the **previous** source's status for a render or two. That old status often shows `currentTime ≈ duration` (finished). Without gating, the status effect would fire `onComplete` immediately against the new source.
- Fix: `trackedSource` (state, in-render reset) + `statusReadyFor` (state set only when status shows `isLoaded && duration > 0 && currentTime < 1`, i.e. the player has loaded the new clip). Returned `currentTime`/`duration` are gated on `statusReadyFor === trackedSource`.
- Also: `didCompleteRef` is set to `true` (not `false`) at source change, so the stale "finished" status doesn't fire `onComplete` before the new audio starts.

**In-render state reset trick** (used in BookPlayer for `audioFinished` and the WonderSheet wizard): instead of `useEffect(() => setX(false), [key])`, compare a `Ref`/track-state to a derived key during render and call setState if they differ. React detects setState-during-render, discards the current render, and re-renders with the new value before commit — avoids the one-frame stale window that a post-commit `useEffect` reset gives you.

**NarratedText** ([narrated-text.tsx](apps/mobile/src/features/books/narrated-text.tsx)) animates **`color`**, not `opacity`. Android's inline `<Animated.Text>` inside another `<Text>` ignores per-span `opacity` (RN merges them into a single text run). Inline color **is** per-span, so animating between `dimColor` (`rgba(0,0,0,0.32)` / `rgba(255,255,255,0.32)`) and `baseColor` (black/white) via `interpolateColor` works on both platforms.

## Mobile — Expo Router + Stack.Screen naming

`<Stack.Screen name="...">` in the root `_layout.tsx` must match an actual route file path, not a folder. The warning `No route named "foo" exists in nested children` means the screen name doesn't resolve. For `apps/mobile/src/app/settings/index.tsx` → use `name="settings/index"`, not `name="settings"`. Same for `family/me`, `family/child/[id]`.

`router.replace` vs `router.push`: `replace` swaps the current stack entry. When called from a tab screen (e.g. opening a book via the wonder-sheet from the Library tab), `replace` removes the tabs entry from the stack — back from the destination then has nothing to pop to and throws `GO_BACK was not handled`. Use `router.push` when starting from a tab; reserve `replace` for cases like form → result where the form shouldn't be in history.

## Mobile — Pull-to-refresh on iOS

Driving `<FlatList refreshing={isLoading}>` from a global "is the data loading" state breaks iOS's `UIRefreshControl`: when `isLoading` flips true → false from a non-pull source (focus refetch, mutation), the native control gets stuck visible until the user interacts. Fix: separate state for pull-only:

```ts
const [isPullRefreshing, setIsPullRefreshing] = useState(false);
const handlePullRefresh = useCallback(async () => {
  setIsPullRefreshing(true);
  try { await refresh(); } finally { setIsPullRefreshing(false); }
}, [refresh]);
// FlatList: refreshing={isPullRefreshing} onRefresh={handlePullRefresh}
```

See [(tabs)/index.tsx](apps/mobile/src/app/(tabs)/index.tsx).

## Mobile — Networking from Android

`localhost` on an Android device/emulator resolves to the device itself, not the dev machine. Three workarounds, in order of preference:

1. **Leave `EXPO_PUBLIC_API_URL` unset** — `resolveApiBaseURL()` derives the LAN IP from `Constants.expoConfig.hostUri`. Works for iOS Simulator, Android emulator (on Apple Silicon hosts), and physical devices on the same Wi-Fi.
2. **`adb reverse tcp:4000 tcp:4000`** — tunnels `localhost:4000` on the device to your Mac. Needs to be re-run after reconnecting/restarting ADB. Then `localhost:4000` in `.env` works.
3. **Hardcode the LAN IP** in `.env` (e.g. `EXPO_PUBLIC_API_URL=http://192.168.x.x:4000`). Fragile across networks.

The [base-url.ts](apps/mobile/src/shared/api/base-url.ts) helper has `console.log` hooks for the resolved URL, and [use-auth.tsx](apps/mobile/src/shared/hooks/use-auth.tsx) has a `probeApi` that hits `/api/auth/ok` before social sign-in so a "Network request failed" can be traced to reachability vs. the OAuth handshake.

## Mobile — Dev menu

Floating draggable FAB in [apps/mobile/src/shared/dev/dev-menu-fab.tsx](apps/mobile/src/shared/dev/dev-menu-fab.tsx). Rendered in [_layout.tsx](apps/mobile/src/app/_layout.tsx) **inside `GestureHandlerRootView`** (gesture detector requires it). Hidden in production via `if (!__DEV__) return null`. Opens `/dev-menu` modal screen.

To add tools, drop more buttons in [apps/mobile/src/app/dev-menu.tsx](apps/mobile/src/app/dev-menu.tsx). Pattern stolen from `sophon-mobile/features/screen-qa-tools/`.

## Mobile — Metro config

[apps/mobile/metro.config.js](apps/mobile/metro.config.js):
- `watchFolders: [workspaceRoot]` so Metro sees `packages/shared` changes.
- `nodeModulesPaths` includes both `apps/mobile/node_modules` and root `node_modules`.
- **DO NOT set `disableHierarchicalLookup: true`**. We had this once. It broke `webidl-conversions` resolution: Expo's `whatwg-url-without-unicode` requires `webidl-conversions@5` (nested, OK) but the flag forced everything to resolve from root, hitting `webidl-conversions@8.0.1` (brought by jsdom dev-dep) which crashes Hermes with "Property 'SharedArrayBuffer' doesn't exist". Hours of debugging. Leave the default.

## Mobile — Native config

`scheme: wondertales`, `bundleIdentifier: com.wondertalesai.app`. Apple Sign In capability requires `ios.usesAppleSignIn: true`. After changing the bundle, do **not** trust `expo prebuild --clean` — it sometimes preserves the old `ios/` folder. Brute force:
```bash
cd apps/mobile
rm -rf ios android .expo/prebuild
npx expo prebuild --clean
yarn ios
```

## Testing

### Unit tests (NestJS)
- Location: `apps/api/src/**/__tests__/*.spec.ts` (alongside the file under test).
- Jest config in `apps/api/package.json` "jest" key.
- Pattern: `Test.createTestingModule({...}).compile()`, even for simple controllers — keeps the setup ready for DI when deps are added later.

### E2E tests (NestJS)
- Location: `apps/api/test/*.e2e-spec.ts`.
- Config: `apps/api/test/jest-e2e.json`.
- Requires Postgres + Redis up locally (the test boots the full `AppModule`).

### Jest transform — non-obvious config
Both unit and e2e configs use **`@swc/jest`** (not `ts-jest`). Why:
- `better-auth` ships `.mjs` files only. `ts-jest` in CJS mode can't transform them.
- `transform` regex must be `^.+\\.(ts|tsx|js|jsx|mjs|cjs)$` — the shorthand `(t|j|c|m)s` does NOT match `.mjs` (it would mean `.ts`/`.js`/`.cs`/`.ms`).
- `transformIgnorePatterns` must allow-list every ESM-only package in the dep chain, including transitive ones. Current list: `better-auth, @better-auth, better-call, @better-fetch, rou3, jose, @noble, @scure, nanoid, uncrypto, defu, consola, ofetch, pathe, destr, ufo, keyv, @keyv, cacheable`. If a new dep breaks the test with `Unexpected token 'export'` or `import statement outside a module`, add it here.
- SWC config in both jest blocks has `legacyDecorator: true, decoratorMetadata: true` — required for NestJS decorators.

## Common commands

```bash
# Root
yarn check:fix         # biome across whole repo
yarn tsc               # tsc --noEmit in every workspace

# API
yarn dev:api                                          # nest start --watch
yarn workspace @wondertales/api build
yarn workspace @wondertales/api test                  # unit
yarn workspace @wondertales/api test:e2e              # e2e (needs pg+redis)
yarn workspace @wondertales/api prisma:generate
yarn workspace @wondertales/api prisma:migrate

# Mobile
yarn dev:mobile                                       # expo start
yarn workspace @wondertales/mobile start --clear      # clear Metro cache
yarn workspace @wondertales/mobile ios                # build + install dev client
yarn workspace @wondertales/mobile tsc
```

## Env

API env vars (`apps/api/.env`):
- `PORT`, `BIND_ADDR`, `PATH_PREFIX`, `LOG_LEVEL`, `CORS_URL`, `FEATURE_SWAGGER_ENABLED`
- `DATABASE_URL`, `REDIS_URL`
- `BETTER_AUTH_SECRET`, `BETTER_AUTH_URL`, `BETTER_AUTH_TRUSTED_ORIGINS`
- `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`
- `APPLE_CLIENT_ID` (Services ID, **not** bundle), `APPLE_BUNDLE_IDENTIFIER` (bundle, for native iOS aud match), `APPLE_TEAM_ID`, `APPLE_KEY_ID`, `APPLE_PRIVATE_KEY` (PEM, `\n` literals replaced at runtime)

Mobile env (`apps/mobile/.env`):
- `EXPO_PUBLIC_API_URL` (optional override; default infers from Metro host + port 4000)
- `EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID` (reserved — only used if/when switching to native Google Sign In SDK; today's flow goes through Better Auth browser OAuth)

## File map (high-signal)

- `apps/api/src/auth/auth.ts` — Better Auth singleton, hooks, providers, Apple JWT
- `apps/api/src/auth/session.guard.ts` — passport-style guard reading the session via `auth.api.getSession()`
- `apps/api/src/auth/me.controller.ts` — `GET /me` under `SessionGuard`
- `apps/api/src/queue/user-events.queue.ts` — publisher factory + job name constants + payload types
- `apps/api/src/queue/user-events.processor.ts` — worker; today just logs, designed to grow
- `apps/api/src/health/health.controller.ts` + `health.module.ts` — terminus checks + dedicated Redis client
- `apps/api/src/config/configuration.ts` + `cache.configuration.ts` — env → `AppConfigurationType` + Keyv cache factory
- `apps/api/prisma/schema.prisma` — Better Auth tables with snake_case columns
- `apps/mobile/src/shared/auth/auth-client.ts` — Better Auth Expo client
- `apps/mobile/src/shared/hooks/use-auth.tsx` — Provider + `signInWithGoogle/Apple/Out`, exposes `bearerToken`
- `apps/mobile/src/shared/api/{api-client,use-api,base-url}.ts` — typed fetch helper, bearer-wired hook
- `apps/mobile/src/shared/dev/dev-menu-fab.tsx` + `apps/mobile/src/app/dev-menu.tsx` — dev-only floating FAB
- `apps/mobile/src/app/_layout.tsx` — must wrap children in `GestureHandlerRootView`
- `apps/mobile/src/app/settings/account.tsx` — sign-in / profile screen plugged to `useAuth`
- `apps/mobile/src/shared/components/core/sidebar-host.tsx` + `wonder-sheet-host.tsx` — root-mounted singleton overlays
- `apps/mobile/src/shared/components/core/wonder-sheet.tsx` — Skia blob FAB sheet + 3-step wizard
- `apps/mobile/src/shared/components/core/liquid-swipe/` — SVG-path-mask page-turn (wave, slider, pull-button)
- `apps/mobile/src/features/books/book-player.tsx` + `use-book-audio.ts` + `narrated-text.tsx` — book reader with karaoke narration
- `apps/mobile/src/shared/theme/color-scheme-context.tsx` — animated theme transition via Skia snapshot
