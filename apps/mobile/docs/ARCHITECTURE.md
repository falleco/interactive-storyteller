# Staff Hero - Architecture Documentation

## 🏗️ Project Overview

Staff Hero is a React Native music learning game built with Expo, featuring note recognition games, a progression system with challenges, equipment, and instruments, all backed by JSON seed data and React Native AsyncStorage for persistence.

## Core Architecture Principles

1. **Separation of Concerns** - Business logic separated from UI components
2. **Centralized State Management** - Single source of truth in GameContext
3. **Type Safety** - Comprehensive TypeScript interfaces
4. **Performance** - Optimized animations using react-native-reanimated
5. **Testability** - Pure functions for business logic
6. **Offline-First Data Layer** - JSON seeds + AsyncStorage persistence

## 📁 Directory Structure

```
├── app/                    # Expo Router screens
│   ├── (tabs)/            # Tab navigation
│   │   ├── index.tsx      # Home screen
│   │   ├── equipment.tsx  # Equipment management
│   │   └── luthier.tsx    # Instrument shop
│   ├── game/              # Game modes
│   │   ├── single-note.tsx
│   │   └── sequence.tsx
│   ├── settings/          # Game settings
│   └── _layout.tsx        # Root layout with providers
├── src/
│   ├── data/
│   │   ├── seeds/         # Static JSON datasets (challenges, equipment, instruments)
│   │   ├── storage/       # AsyncStorage helpers and user data management
│   │   └── types.ts       # Shared data-layer types
│   ├── features/          # Domain-centric feature packages
│   │   ├── analytics/
│   │   ├── challenges/
│   │   ├── currency/
│   │   ├── equipment/
│   │   ├── game/
│   │   ├── instruments/
│   │   ├── luthier/
│   │   └── settings/
│   │       ├── components/
│   │       ├── hooks/
│   │       └── services/
│   ├── shared/            # Cross-cutting UI, hooks, and helpers
│   │   ├── components/
│   │   ├── hooks/
│   │   ├── constants/
│   │   ├── lib/
│   │   ├── types/
│   │   └── utils/
│   └── features/**/index.ts  # Barrel files for stable imports
├── assets/                # Fonts, images, audio, animations
├── docs/                  # Architecture & system docs
└── scripts/               # Tooling and maintenance scripts
```

## 🎮 Game Modes

### 1. Single Note Mode
- **Purpose**: Quick note identification practice
- **Mechanics**: One note at a time, immediate feedback
- **Timing**: 500ms delay for correct, 3000ms for incorrect
- **UI**: Minimal feedback, auto-advance

### 2. Sequence Mode
- **Purpose**: Multi-note identification in order
- **Mechanics**: Select notes in left-to-right sequence
- **Features**: Visual sequence building, reset capability
- **UI**: Sequence slots, progress indicators

### 3. Rhythm Hero Mode (Coming Soon)
- **Purpose**: Guitar Hero style timing game
- **Mechanics**: Notes move across staff, hit at target line
- **Features**: Accuracy scoring, disappearing effects

## 🎵 Music System

### Staff Positioning
- **Reference**: E4 (bottom line) = position 0
- **Calculation**: `e4LineY - ((staffPosition + 1) * (staffLineSpacing / 2))`
- **Range**: Extended with 3 ledger lines above and below
- **Notes**: D3 to C6 (19 different positions)

### Notation Systems
- **Letter Names**: C, D, E, F, G, A, B
- **Solfege**: Do, Re, Mi, Fa, Sol, La, Si
- **Default**: Solfege (beginner-friendly)

## 🔧 State Management

### Centralized Architecture
All application state is managed in **GameContext** (dumb store), with hooks providing business logic (smart operations).

```
GameContext (State Container)
  ↓
Hooks (Business Logic)
  ↓
Components (Presentation)
```

### Available Hooks

| Hook | Purpose | Local Data |
|------|---------|------------|
| `useGameLogic()` | Game session, scoring, questions | — |
| `useGameSettings()` | Notation, difficulty, game mode | — |
| `useCurrency()` | Golden Note Shards | ✅ |
| `useChallenges()` | Challenges system | ✅ |
| `useEquipment()` | Equipment management | ✅ |
| `useLuthier()` | Musical instruments | ✅ |
| `useAnalytics()` | Game statistics & achievements | ✅ |

See `docs/STATE_MANAGEMENT.md` for detailed architecture.

## 🗄️ Data Persistence (AsyncStorage + JSON Seeds)

### Seed Data

Static JSON files under `src/data/seeds` define the master data for:

1. **Challenges** – baseline requirements, rewards, and icons
2. **Achievements** – unlock conditions and presentation metadata
3. **Equipment** – store inventory across mantles/adornments/instruments
4. **Instruments** – luthier shop catalogue by instrument path

### User Storage

- **AsyncStorage** is used for all per-user state via helpers in `src/data/storage`
- **User Profiles** are created on first launch and cached locally
- **Transactions, sessions, and unlocks** are stored in structured JSON objects
- **Currency balance** is derived from the transaction ledger to maintain an audit trail

### Authentication
- **Anonymous identities** are generated locally and persisted
- **No registration** or remote services are required
- **User data** is bootstraped on first run to ensure consistent defaults

## 🎨 Styling

### Design System
- **NativeWind**: Tailwind CSS for React Native
- **Theme System**: Light/dark mode support
- **Components**: Reusable styled components from `components/nativewindui/`
- **Colors**: Defined in `theme/colors.ts`
- **Typography**: Text component with semantic variants

### UI Components
- `Text` - Typography with variants (title1, body, caption1, etc.)
- `Button` - Standardized buttons with variants and sizes
- `Avatar` - User avatars
- `Sheet` - Bottom sheets for modals

## 📊 Progression System

### Challenges
- Track various achievements (score points, win games, use equipment)
- Reward Golden Note Shards on completion
- Progress stored locally via AsyncStorage
- Real-time updates across the app

### Equipment System
- **Categories**: Accessories, Instruments
- **Rarities**: Common, Uncommon, Rare, Epic, Legendary
- **Stats**: Score bonus, accuracy bonus, streak bonus
- **Progression**: Purchase, upgrade, equip/unequip

### Instrument System (Luthier)
- **Types**: Violin, Guitar, Piano, Flute, etc.
- **Rarities**: Common, Uncommon, Rare, Epic, Legendary
- **Stats**: Score multiplier, accuracy bonus, streak bonus
- **Tuning**: Increase tuning level for better stats
- **Progression**: Purchase, upgrade, tune, equip

### Currency
- **Golden Note Shards**: Main currency
- Earned from challenges, game performance
- Spent on equipment, instruments, upgrades
- Transaction history available

## 📈 Analytics System

### Game Sessions
- Automatically recorded after each game
- Tracks: score, accuracy, streak, duration
- Stored locally for analysis

### Achievements
- Auto-unlock on meeting conditions
- Examples: First game, 5-note streak, perfect game
- Progress tracked across sessions

### Statistics
- Total games played
- Best streak ever
- Average accuracy
- Total play time
- Favorite game mode/notation/difficulty

## 🧪 Testing Strategy

### Business Logic
- **Pure Functions**: All game logic extracted to testable utilities
- **No Side Effects**: Logic functions don't modify external state
- **Deterministic**: Same inputs always produce same outputs

### Component Testing
- **Separation**: UI components focus on presentation only
- **Props**: Well-defined interfaces for component inputs
- **Mocking**: Business logic can be easily mocked for UI tests

## 🚀 Performance Optimizations

### Animations
- **Native Driver**: All animations use native driver when possible
- **react-native-reanimated**: For 60fps performance
- **Pre-allocation**: Animation values created once, reused
- **Cleanup**: Proper cleanup of timers and intervals

### Rendering
- **Memoization**: Strategic use of React.memo and useMemo
- **Lazy Loading**: Components loaded only when needed
- **SVG Optimization**: Efficient SVG rendering for musical notation

### State Management
- **Centralized State**: No prop drilling
- **Efficient Updates**: Only affected components re-render
- **Loading States**: Prevent duplicate API calls

## 🔐 Security

### Row Level Security (RLS)
- Users can only access their own data
- Database-enforced security policies
- Secure by default

### Anonymous Auth
- Secure temporary accounts
- Can be upgraded to permanent later
- No sensitive data required

## 🔮 Future Enhancements

### Additional Note Types
- Half Notes, Quarter Notes, Eighth Notes
- Different note durations and rhythms

### Advanced Features
- Key Signatures support
- Time Signatures beyond 4/4
- Bass Clef notation
- Chord Recognition

### Multiplayer
- Real-time multiplayer sessions
- Leaderboards (global and friends)
- Collaborative learning modes

### Social Features
- Friend system
- Share achievements
- Challenge friends

## 📚 Resources

- **State Management**: `docs/STATE_MANAGEMENT.md`
- **Quick Reference**: `docs/STATE_MANAGEMENT_QUICK_REFERENCE.md`
- **Data Layer Overview**: `src/data/types.ts`
- **Storage Helpers**: `src/data/storage/user-data-store.ts`

## 🛠️ Development Commands

```bash
# Start development server
bun start

# Run iOS simulator
bun ios

# Run Android emulator
bun android

# Type checking
bun run tsc

# Linting
bun run lint

# Install packages (use expo compatibility)
bunx expo install <package>
```

## 📦 Key Dependencies

- **Expo**: React Native framework
- **React Native Reanimated**: Animations
- **NativeWind**: Tailwind CSS for RN
- **AsyncStorage**: Local persistence
- **Expo Router**: File-based routing
- **TypeScript**: Type safety

## 🎯 Architecture Benefits

### 1. Maintainability
- Clear separation of concerns
- Predictable data flow
- Easy to locate and fix bugs
- Consistent patterns

### 2. Scalability
- Easy to add new features
- Local persistence with JSON + AsyncStorage
- Modular hook system
- Type-safe APIs

### 3. Performance
- Optimized animations
- Efficient re-renders
- Minimal prop drilling
- Loading state management

### 4. Developer Experience
- TypeScript everywhere
- Clear file structure
- Comprehensive documentation
- Reusable components

### 5. User Experience
- Smooth animations
- Real-time updates
- Offline-capable (with sync)
- Fast load times

## Summary

Staff Hero is built with a modern, scalable architecture that prioritizes:
- **Clean Code**: Separation of concerns, DRY principles
- **Type Safety**: Comprehensive TypeScript coverage
- **State Management**: Centralized state with dedicated hooks
- **Data Persistence**: AsyncStorage + JSON seeds for reliable local storage
- **Performance**: Optimized animations and rendering
- **UX**: Smooth, intuitive gameplay with progression systems

The architecture supports easy extension with new game modes, features, and content while maintaining code quality and performance.
