# State Management Architecture

## Complete State Centralization

All application state is managed centrally in `GameContext`, with hooks providing business logic.

## Architecture Overview

```
┌─────────────────────────────────────────────────────┐
│                   GameContext                        │
│               (Pure State Container)                 │
│                                                      │
│  ✅ gameState + dispatchGameAction                   │
│  ✅ gameSettings + setGameSettings                   │
│  ✅ currency + setCurrency                           │
│  ✅ challenges + setChallenges                       │
│  ✅ equipment + setEquipment                         │
│  ✅ instruments + setInstruments                     │
│  ✅ analytics + setAnalytics                         │
│  ✅ loading states + setters                         │
│                                                      │
│  ❌ NO business logic                                │
│  ❌ NO operations                                     │
└─────────────────────────────────────────────────────┘
                           │
           ┌───────────────┼───────────────────────────┐
           │               │               │           │
           ▼               ▼               ▼           ▼
    ┌────────────┐  ┌────────────┐  ┌────────────┐  ┌────────────┐
    │useGameLogic│  │useGameSettings│ │useCurrency│  │useChallenges│
    │            │  │            │  │            │  │            │
    │ Game       │  │ Settings   │  │ Currency   │  │ Challenges │
    │ Logic      │  │ Logic      │  │ Logic      │  │ Logic      │
    └────────────┘  └────────────┘  └────────────┘  └────────────┘

    ┌────────────┐  ┌────────────┐  ┌────────────┐
    │useEquipment│  │useLuthier  │  │useAnalytics│
    │            │  │            │  │            │
    │ Equipment  │  │ Instruments│  │ Analytics  │
    │ Logic      │  │ Logic      │  │ Logic      │
    └────────────┘  └────────────┘  └────────────┘
```

## All State in Context

### 1. Game Logic State (Reducer Pattern)
```typescript
const [gameState, dispatchGameAction] = useReducer(gameReducer, initialGameState);

interface GameContextType {
  gameState: GameState;  // score, streak, questions, etc.
  dispatchGameAction: Dispatch<GameAction>;
}
```

### 2. Game Settings State
```typescript
const [gameSettings, setGameSettings] = useState<GameSettings>(initialGameSettings);

interface GameContextType {
  gameSettings: GameSettings;  // notation, difficulty, mode, etc.
  setGameSettings: Dispatch<SetStateAction<GameSettings>>;
}
```

### 3. Currency State
```typescript
const [currency, setCurrency] = useState<UserCurrency>({ goldenNoteShards: 0 });
const [currencyLoading, setCurrencyLoading] = useState(true);

interface GameContextType {
  currency: UserCurrency;
  currencyLoading: boolean;
  setCurrency: Dispatch<SetStateAction<UserCurrency>>;
  setCurrencyLoading: Dispatch<SetStateAction<boolean>>;
}
```

### 4. Challenges State
```typescript
const [challenges, setChallenges] = useState<Challenge[]>([]);
const [challengesLoading, setChallengesLoading] = useState(true);

interface GameContextType {
  challenges: Challenge[];
  challengesLoading: boolean;
  setChallenges: Dispatch<SetStateAction<Challenge[]>>;
  setChallengesLoading: Dispatch<SetStateAction<boolean>>;
}
```

### 5. Equipment State
```typescript
const [equipment, setEquipment] = useState<Equipment[]>([]);
const [equipmentLoading, setEquipmentLoading] = useState(true);

interface GameContextType {
  equipment: Equipment[];
  equipmentLoading: boolean;
  setEquipment: Dispatch<SetStateAction<Equipment[]>>;
  setEquipmentLoading: Dispatch<SetStateAction<boolean>>;
}
```

### 6. Instruments State
```typescript
const [instruments, setInstruments] = useState<Instrument[]>([]);
const [instrumentsLoading, setInstrumentsLoading] = useState(true);

interface GameContextType {
  instruments: Instrument[];
  instrumentsLoading: boolean;
  setInstruments: Dispatch<SetStateAction<Instrument[]>>;
  setInstrumentsLoading: Dispatch<SetStateAction<boolean>>;
}
```

### 7. Analytics State
```typescript
const [analytics, setAnalytics] = useState<UserAnalytics | null>(null);
const [analyticsLoading, setAnalyticsLoading] = useState(true);

interface GameContextType {
  analytics: UserAnalytics | null;
  analyticsLoading: boolean;
  setAnalytics: Dispatch<SetStateAction<UserAnalytics | null>>;
  setAnalyticsLoading: Dispatch<SetStateAction<boolean>>;
}
```

## All Business Logic in Hooks

### 1. useGameLogic()
**Purpose**: Game session management, scoring, questions

**Uses from Context:**
- `gameState`, `dispatchGameAction`
- `setChallenges` (for challenge tracking)

**Provides:**
```typescript
interface UseGameLogicReturn {
  gameState: GameState;
  startGame: (settings: GameSettings) => void;
  endGame: (settings: GameSettings) => Promise<void>;
  submitAnswer: (answer: Notes[]) => void;
  nextQuestion: () => void;
  resetStreak: () => void;
  generateNewQuestion: (settings: GameSettings) => void;
  setChallengeProgressCallback: (callback) => void;
}
```

### 2. useGameSettings()
**Purpose**: Game configuration management

**Uses from Context:**
- `gameSettings`, `setGameSettings`

**Provides:**
```typescript
interface UseGameSettingsReturn {
  gameSettings: GameSettings;
  updateSettings: (settings: Partial<GameSettings>) => void;
  updateNotationSystem: (system: NotationSystem) => void;
  updateDifficulty: (difficulty: Difficulty) => void;
  updateGameMode: (mode: GameMode) => void;
  toggleNoteLabels: () => void;
  updateTimeLimit: (limit?: number) => void;
  resetSettings: () => void;
}
```

### 3. useCurrency()
**Purpose**: Golden Note Shards management

**Uses from Context:**
- `currency`, `currencyLoading`
- `setCurrency`, `setCurrencyLoading`

**Provides:**
```typescript
interface UseCurrencyReturn {
  currency: UserCurrency;
  isLoading: boolean;
  refresh: () => Promise<void>;
  addGoldenShards: (amount: number, desc?: string) => Promise<void>;
  getHistory: (limit?: number) => Promise<CurrencyTransaction[]>;
  getSummary: () => Promise<TransactionSummary>;
  hasSufficientBalance: (amount: number) => Promise<boolean>;
}
```

### 4. useChallenges()
**Purpose**: Challenge system management

**Uses from Context:**
- `challenges`, `challengesLoading`
- `setChallenges`, `setChallengesLoading`
- `setCurrency`, `setCurrencyLoading` (for rewards)

**Provides:**
```typescript
interface UseChallengesReturn {
  challenges: Challenge[];
  isLoading: boolean;
  refresh: () => Promise<void>;
  startChallenge: (id: string) => Promise<void>;
  updateChallengeProgress: (type: ChallengeType, amount: number) => Promise<void>;
  redeemChallenge: (id: string) => Promise<void>;
  resetChallenges: () => Promise<void>;
}
```

### 5. useEquipment()
**Purpose**: Equipment system management

**Uses from Context:**
- `equipment`, `equipmentLoading`
- `setEquipment`, `setEquipmentLoading`

**Provides:**
```typescript
interface UseEquipmentReturn {
  equipment: Equipment[];
  isLoading: boolean;
  refresh: () => Promise<void>;
  getEquipmentByCategory: (category: EquipmentCategory) => Equipment[];
  buyEquipment: (equipmentId: string) => Promise<void>;
  upgradeEquipment: (equipmentId: string) => Promise<void>;
  equipItem: (equipmentId: string) => Promise<void>;
  unequipItem: (equipmentId: string) => Promise<void>;
  getTotalBonuses: () => EquipmentBonuses;
  resetEquipment: () => Promise<void>;
}
```

### 6. useLuthier()
**Purpose**: Musical instrument management

**Uses from Context:**
- `instruments`, `instrumentsLoading`
- `setInstruments`, `setInstrumentsLoading`

**Provides:**
```typescript
interface UseLuthierReturn {
  instruments: Instrument[];
  isLoading: boolean;
  refresh: () => Promise<void>;
  buyInstrument: (instrumentId: string) => Promise<void>;
  upgradeInstrument: (instrumentId: string) => Promise<void>;
  tuneInstrument: (instrumentId: string) => Promise<void>;
  equipInstrument: (instrumentId: string) => Promise<void>;
  resetInstruments: () => Promise<void>;
  equippedInstrument: Instrument | undefined;
  ownedInstruments: Instrument[];
}
```

### 7. useAnalytics()
**Purpose**: Game statistics and achievements

**Uses from Context:**
- `analytics`, `analyticsLoading`
- `setAnalytics`, `setAnalyticsLoading`

**Provides:**
```typescript
interface UseAnalyticsReturn {
  analytics: UserAnalytics | null;
  isLoading: boolean;
  refresh: () => Promise<void>;
  addSession: (session: Omit<GameSession, 'id' | 'date'>) => Promise<string>;
  getRecentSessions: (limit?: number) => Promise<GameSession[]>;
  getUserAchievements: () => Promise<Achievement[]>;
  unlockAchievement: (achievementId: string) => Promise<boolean>;
  clearData: () => Promise<void>;
}
```

## Component Usage

### Option 1: Use Individual Hooks (Recommended)
```tsx
function MyScreen() {
  const { gameState, startGame } = useGameLogic();
  const { gameSettings, updateDifficulty } = useGameSettings();
  const { currency } = useCurrency();
  const { challenges } = useChallenges();
  const { equipment } = useEquipment();
  const { instruments } = useLuthier();
  const { analytics } = useAnalytics();

  return (
    <View>
      <Text>Score: {gameState.score}</Text>
      <Text>Balance: {currency.goldenNoteShards}</Text>
      <Text>Total Games: {analytics?.totalGamesPlayed}</Text>
    </View>
  );
}
```

### Option 2: Use useGameContext (Convenience)
```tsx
function MyScreen() {
  const { gameLogic, gameSettings, analytics } = useGameContext();

  return (
    <View>
      <Text>Score: {gameLogic.gameState.score}</Text>
      <Text>Difficulty: {gameSettings.gameSettings.difficulty}</Text>
      <Text>Total Games: {analytics.analytics?.totalGamesPlayed}</Text>
    </View>
  );
}
```

**Note:** `useGameContext()` returns `useGameLogic()`, `useGameSettings()`, and `useAnalytics()`.

## Data Flow Example: Complete Game Session

```
1. User starts game
   ↓
   gameLogic.startGame(gameSettings.gameSettings)
   ↓
   Hook dispatches START_GAME action
   ↓
   Context updates gameState via reducer
   ↓
   All components see new gameState

2. User answers questions
   ↓
   gameLogic.submitAnswer(notes)
   ↓
   Hook calculates score, streak
   ↓
   Hook dispatches SUBMIT_ANSWER action
   ↓
   Hook calls updateChallengeProgress (tracks in DB)
   ↓
   Context updates gameState via reducer
   ↓
   Context updates challenges via setChallenges

3. User ends game
   ↓
   gameLogic.endGame(settings)
   ↓
   Hook saves session to analytics
   ↓
   analytics.addSession({ gameMode, score, ... })
   ↓
   Analytics hook writes to AsyncStorage (sessions + achievements)
   ↓
   Achievements are auto-checked locally
   ↓
   Context updates analytics via setAnalytics
   ↓
   All components see new analytics

4. User redeems challenge
   ↓
   challenges.redeemChallenge(id)
   ↓
   Hook updates AsyncStorage (challenge + currency state)
   ↓
   Hook updates challenges via setChallenges
   ↓
   Hook updates currency via setCurrency
   ↓
   All components see updated challenges AND currency

5. User buys equipment
   ↓
   equipment.buyEquipment(id)
   ↓
   Hook updates AsyncStorage (currency + equipment state)
   ↓
   Hook updates equipment via setEquipment
   ↓
   All components see new equipment
```

## Key Benefits

### 1. True Single Source of Truth
- ALL state lives in one place (GameContext)
- No duplicate state anywhere
- State changes propagate everywhere instantly

### 2. Complete Separation of Concerns
- **Context** = Dumb state container (just `useState`/`useReducer`)
- **Hooks** = Smart business logic (operations + API calls)
- **Components** = Presentation only (display + user interaction)

### 3. Easy Testing
```typescript
// Mock context for testing
const mockContext = {
  gameState: { score: 0, streak: 0, ... },
  dispatchGameAction: jest.fn(),
  currency: { goldenNoteShards: 100 },
  setCurrency: jest.fn(),
};

jest.spyOn(React, 'useContext').mockReturnValue(mockContext);

// Test hook operations
const { startGame } = useGameLogic();
startGame(settings);

expect(mockContext.dispatchGameAction).toHaveBeenCalled();
```

### 4. Maintainability
- Easy to find where state lives (GameContext)
- Easy to find where logic lives (hooks)
- Clear, predictable data flow
- Consistent pattern across all features

### 5. Performance
- Minimal re-renders (only affected components update)
- No prop drilling
- Efficient state updates

## File Structure

```
/contexts
  └─ game-context.tsx          # All state + setters/dispatchers

/hooks
  ├─ use-game-logic.ts         # Game session logic
  ├─ use-game-settings.ts      # Settings logic
  ├─ use-currency.ts           # Currency logic
  ├─ use-challenges.ts         # Challenges logic
  ├─ use-equipment.ts          # Equipment logic
  ├─ use-luthier.ts            # Instruments logic
  ├─ use-analytics.ts          # Analytics logic
  └─ use-game-context.ts       # Convenience wrapper

/src/domain
  ├─ currency/                 # Currency repositories
  ├─ challenges/               # Challenges repositories
  ├─ equipment/                # Equipment repositories
  ├─ instruments/              # Instruments repositories
  ├─ analytics/                # Analytics repositories
  └─ user/                     # User profile repository
```

## Complete State Overview

| Feature | State | Hook | Local Data |
|---------|-------|------|------------|
| Game Logic | gameState (reducer) | useGameLogic() | — |
| Settings | gameSettings | useGameSettings() | — |
| Currency | currency | useCurrency() | ✅ |
| Challenges | challenges | useChallenges() | ✅ |
| Equipment | equipment | useEquipment() | ✅ |
| Instruments | instruments | useLuthier() | ✅ |
| Analytics | analytics | useAnalytics() | ✅ |

## Rules

### ✅ DO
- Store ALL state in GameContext
- Implement ALL business logic in hooks
- Use hooks in components (not context directly)
- Update state via setters/dispatchers
- Handle errors in try/catch blocks
- Follow the established pattern for new features

### ❌ DON'T
- Don't duplicate state in hooks or components
- Don't put business logic in context
- Don't bypass AsyncStorage helpers from components
- Don't forget loading states
- Don't skip error handling

## Adding New Features

When adding a new feature, follow this pattern:

### 1. Add State to Context
```typescript
const [newFeature, setNewFeature] = useState<NewFeature[]>([]);
const [newFeatureLoading, setNewFeatureLoading] = useState(true);
```

### 2. Create Hook
```typescript
export function useNewFeature() {
  const { newFeature, setNewFeature, setNewFeatureLoading } = useContext(GameContext);
  const { user } = useAuth();

  const refresh = async () => {
    if (!user) return;
    try {
      setNewFeatureLoading(true);
      const data = await fetchNewFeature(user.id);
      setNewFeature(data);
    } finally {
      setNewFeatureLoading(false);
    }
  };

  return { newFeature, refresh };
}
```

### 3. Create API Functions
```typescript
// src/domain/new-feature/new-feature-repository.ts
import { getUserData } from '~/data/storage/user-data-store';

export async function fetchNewFeature(userId: string) {
  const userData = await getUserData(userId);
  return userData.customFeature ?? [];
}
```

### 4. Use in Components
```typescript
function MyComponent() {
  const { newFeature, refresh } = useNewFeature();
  
  return <View>{/* Use newFeature */}</View>;
}
```

## Summary

All application state is centralized in `GameContext`:
- ✅ Game logic (reducer)
- ✅ Game settings (state)
- ✅ Currency (state)
- ✅ Challenges (state)
- ✅ Equipment (state)
- ✅ Instruments (state)
- ✅ Analytics (state)

All business logic is in dedicated hooks:
- ✅ useGameLogic()
- ✅ useGameSettings()
- ✅ useCurrency()
- ✅ useChallenges()
- ✅ useEquipment()
- ✅ useLuthier()
- ✅ useAnalytics()

**Result: Clean, maintainable, testable code with true single source of truth!** 🎉
