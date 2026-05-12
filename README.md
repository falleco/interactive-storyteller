# Wonder Tales

Monorepo for the Wonder Tales project.

## Workspaces

```
apps/
  mobile/    # Expo / React Native app
  api/       # NestJS backend (Prisma + Postgres + JWT + Swagger)
packages/
  shared/    # Shared TypeScript types (auth, user, ...)
```

Managed with Yarn 4 workspaces. Lint and format are unified by [Biome](https://biomejs.dev).

## Requirements

- Node.js >= 20
- Yarn 4 (enabled via `corepack`)
- PostgreSQL (for the API)

## Setup

```bash
yarn install
cp apps/api/.env.example apps/api/.env
yarn workspace @rebelde/api prisma:migrate   # creates the DB schema
```

## Common scripts (root)

```bash
yarn dev:mobile      # start Expo
yarn dev:api         # start NestJS (watch mode)

yarn lint            # biome lint across the whole repo
yarn format:fix      # biome format --write across the whole repo
yarn check:fix       # biome check --write across the whole repo
yarn tsc             # tsc --noEmit across all workspaces
yarn test            # run tests across all workspaces
```

You can also run any workspace script directly:

```bash
yarn workspace @rebelde/mobile ios
yarn workspace @rebelde/api start:dev
```

## API

- NestJS 11
- Prisma 6 + PostgreSQL
- JWT auth (`/auth/register`, `/auth/login`, `/auth/me`)
- Swagger UI served at `/docs`

See `apps/api/.env.example` for required environment variables.

## Mobile

- Expo Router 6 / React Native 0.81
- NativeWind 4 / Tailwind CSS
- Vitest for unit tests

See `apps/mobile/docs/` for architecture notes.
