# State Management Quick Reference

## TL;DR

**GameContext** = State storage only (dumb store)  
**Hooks** = Business logic (smart operations)  
**Components** = Use hooks, not context directly

## All Available Hooks

### Core Game Hooks
```typescript
useGameLogic()      // Game session, scoring, questions
useGameSettings()   // Notation, difficulty, game mode
```

### Storage-Integrated Hooks
```typescript
useCurrency()       // Golden Note Shards
useChallenges()     // Challenges system
useEquipment()      // Equipment management
useLuthier()        // Musical instruments
useAnalytics()      // Game statistics & achievements
```

### Convenience Hook
```typescript
useGameContext()    // Returns { gameLogic, gameSettings, analytics }
```

## Hook APIs

### 1. useGameLogic()
```typescript
const {
  gameState,          // Current game state
  startGame,          // Start a new game
  endGame,            // End current game (saves to analytics)
  submitAnswer,       // Submit answer (updates score/streak)
  nextQuestion,       // Move to next question
  resetStreak,        // Reset streak to 0
  generateNewQuestion, // Generate new question
} = useGameLogic();

// Example
gameLogic.startGame(gameSettings.gameSettings);
gameLogic.submitAnswer([Notes.C4]);
```

### 2. useGameSettings()
```typescript
const {
  gameSettings,        // Current settings
  updateSettings,      // Update multiple settings
  updateNotationSystem, // Change notation
  updateDifficulty,    // Change difficulty
  updateGameMode,      // Change game mode
  toggleNoteLabels,    // Toggle note labels
  updateTimeLimit,     // Set time limit
  resetSettings,       // Reset to defaults
} = useGameSettings();

// Example
gameSettings.updateDifficulty(Difficulty.ADVANCED);
gameSettings.toggleNoteLabels();
```

### 3. useCurrency()
```typescript
const {
  currency,              // Current balance
  isLoading,            // Loading state
  refresh,              // Reload from AsyncStorage
  addGoldenShards,      // Add/deduct shards
  getHistory,           // Transaction history
  getSummary,           // Transaction summary
  hasSufficientBalance  // Check if can afford
} = useCurrency();

// Add shards
await currency.addGoldenShards(100, 'Bonus reward');

// Deduct shards (negative amount)
await currency.addGoldenShards(-50, 'Purchase item');

// Check balance
if (await currency.hasSufficientBalance(100)) {
  // Can afford
}
```

### 4. useChallenges()
```typescript
const {
  challenges,             // All challenges
  isLoading,             // Loading state
  refresh,               // Reload from DB
  startChallenge,        // Mark as in progress
  updateChallengeProgress, // Track progress
  redeemChallenge,       // Redeem rewards (updates currency!)
  resetChallenges        // Reset all (resets currency!)
} = useChallenges();

// Start challenge
await challenges.startChallenge('challenge-id');

// Update progress
await challenges.updateChallengeProgress(ChallengeType.SCORE_POINTS, 100);

// Redeem (awards golden note shards)
await challenges.redeemChallenge('challenge-id');
```

### 5. useEquipment()
```typescript
const {
  equipment,             // All equipment items
  isLoading,            // Loading state
  refresh,              // Reload from DB
  getEquipmentByCategory, // Filter by category
  buyEquipment,         // Purchase equipment
  upgradeEquipment,     // Upgrade level
  equipItem,            // Equip item
  unequipItem,          // Unequip item
  getTotalBonuses,      // Get all active bonuses
  resetEquipment,       // Reset all equipment
} = useEquipment();

// Buy equipment
await equipment.buyEquipment('equipment-id');

// Equip item
await equipment.equipItem('equipment-id');

// Get bonuses
const bonuses = equipment.getTotalBonuses();
// { scoreBonus: 10, accuracyBonus: 5, streakBonus: 2 }
```

### 6. useLuthier()
```typescript
const {
  instruments,          // All instruments
  isLoading,           // Loading state
  refresh,             // Reload from DB
  buyInstrument,       // Purchase instrument
  upgradeInstrument,   // Upgrade level
  tuneInstrument,      // Tune instrument
  equipInstrument,     // Equip instrument
  resetInstruments,    // Reset all instruments
  equippedInstrument,  // Currently equipped instrument
  ownedInstruments,    // Owned instruments only
} = useLuthier();

// Buy instrument
await luthier.buyInstrument('instrument-id');

// Tune instrument (increases tuning level)
await luthier.tuneInstrument('instrument-id');

// Equip instrument
await luthier.equipInstrument('instrument-id');

// Check equipped
const current = luthier.equippedInstrument;
```

### 7. useAnalytics()
```typescript
const {
  analytics,            // User analytics data
  isLoading,           // Loading state
  refresh,             // Reload from DB
  addSession,          // Record game session
  getRecentSessions,   // Get recent sessions
  getUserAchievements, // Get achievements
  unlockAchievement,   // Manually unlock achievement
  clearData,           // Clear all analytics (dev only)
} = useAnalytics();

// Record game session
await analytics.addSession({
  gameMode: GameMode.SINGLE_NOTE,
  difficulty: Difficulty.BEGINNER,
  notationSystem: NotationSystem.LETTER,
  score: 450,
  streak: 8,
  maxStreak: 12,
  totalQuestions: 20,
  correctAnswers: 18,
  accuracy: 90,
  duration: 180, // seconds
});

// Get analytics
const stats = analytics.analytics;
console.log(`Total games: ${stats?.totalGamesPlayed}`);
console.log(`Best streak: ${stats?.bestStreak}`);
```

## Component Patterns

### Display Only
```tsx
function BalanceDisplay() {
  const { currency, isLoading } = useCurrency();
  
  if (isLoading) return <Spinner />;
  
  return <Text>{currency.goldenNoteShards} shards</Text>;
}
```

### With Operations
```tsx
function ShopItem({ price }: { price: number }) {
  const { currency, addGoldenShards, hasSufficientBalance } = useCurrency();
  
  const handleBuy = async () => {
    if (await hasSufficientBalance(price)) {
      await addGoldenShards(-price, 'Purchase item');
      Alert.alert('Success', 'Item purchased!');
    } else {
      Alert.alert('Error', 'Insufficient funds');
    }
  };
  
  return <Button onPress={handleBuy}>Buy ({price})</Button>;
}
```

### Multiple Hooks
```tsx
function GameOverScreen() {
  const { gameState, endGame } = useGameLogic();
  const { gameSettings } = useGameSettings();
  const { addSession } = useAnalytics();
  const { updateChallengeProgress } = useChallenges();
  
  const handleGameEnd = async () => {
    // End game
    await endGame(gameSettings.gameSettings);
    
    // Record session
    await addSession({
      gameMode: gameSettings.gameSettings.gameMode,
      score: gameState.score,
      // ... other stats
    });
    
    // Update challenges
    await updateChallengeProgress(ChallengeType.SCORE_POINTS, gameState.score);
  };
  
  return <Button onPress={handleGameEnd}>Finish Game</Button>;
}
```

### Using useGameContext (Convenience)
```tsx
function GameDashboard() {
  const { gameLogic, gameSettings, analytics } = useGameContext();
  
  return (
    <View>
      {/* Current game */}
      <Text>Score: {gameLogic.gameState.score}</Text>
      <Text>Streak: {gameLogic.gameState.streak}</Text>
      
      {/* Settings */}
      <Text>Difficulty: {gameSettings.gameSettings.difficulty}</Text>
      
      {/* Analytics */}
      <Text>Total Games: {analytics.analytics?.totalGamesPlayed}</Text>
      <Text>Best Streak: {analytics.analytics?.bestStreak}</Text>
    </View>
  );
}
```

## Rules

### ✅ DO
- Use hooks in components for all operations
- Handle loading states properly
- Catch errors in try/catch blocks
- Use appropriate hook for each feature
- Call `refresh()` to reload data from AsyncStorage

### ❌ DON'T
- Don't use `useContext(GameContext)` directly in components
- Don't duplicate state in components
- Don't bypass storage helpers directly from components
- Don't forget loading/error states
- Don't skip error handling

## Common Workflows

### 1. Starting a Game
```tsx
const { gameLogic, gameSettings } = useGameContext();

useEffect(() => {
  gameLogic.startGame(gameSettings.gameSettings);
}, []);
```

### 2. Buying Equipment
```tsx
const { buyEquipment, refresh } = useEquipment();
const { addGoldenShards } = useCurrency();

const handleBuy = async (equipmentId: string, price: number) => {
  try {
    // Equipment system deducts currency automatically
    await buyEquipment(equipmentId);
    Alert.alert('Success', 'Equipment purchased!');
  } catch (error) {
    Alert.alert('Error', 'Failed to purchase');
  }
};
```

### 3. Redeeming a Challenge
```tsx
const { redeemChallenge } = useChallenges();

const handleRedeem = async (challengeId: string) => {
  try {
    // Automatically updates both challenges AND currency
    await redeemChallenge(challengeId);
    Alert.alert('Success', 'Challenge redeemed!');
  } catch (error) {
    Alert.alert('Error', 'Failed to redeem');
  }
};
```

### 4. Recording a Game Session
```tsx
const { gameState, endGame } = useGameLogic();
const { gameSettings } = useGameSettings();
const { addSession } = useAnalytics();

const handleEndGame = async () => {
  // End game first
  await endGame(gameSettings.gameSettings);
  
  // Then record to analytics
  await addSession({
    gameMode: gameSettings.gameSettings.gameMode,
    difficulty: gameSettings.gameSettings.difficulty,
    notationSystem: gameSettings.gameSettings.notation,
    score: gameState.score,
    streak: gameState.streak,
    maxStreak: gameState.maxStreak,
    totalQuestions: gameState.totalQuestions,
    correctAnswers: gameState.correctAnswers,
    accuracy: Math.round((gameState.correctAnswers / gameState.totalQuestions) * 100),
    duration: Math.floor((Date.now() - startTime) / 1000),
  });
};
```

## Hook Dependencies

| Hook | Depends On | Updates |
|------|-----------|---------|
| useGameLogic | - | challenges (progress tracking) |
| useGameSettings | - | - |
| useCurrency | - | - |
| useChallenges | - | currency (when redeeming) |
| useEquipment | currency | currency (when buying/upgrading) |
| useLuthier | currency | currency (when buying/upgrading/tuning) |
| useAnalytics | - | - |

## Summary

| Layer | Responsibility | Examples |
|---|---|---|
| **GameContext** | State storage | All state + setters |
| **Hooks** | Business logic | useGameLogic(), useCurrency(), etc. |
| **Components** | Presentation | Display data, call hook operations |

**Remember: Context = State, Hooks = Logic, Components = View**

## Need More Info?

See `docs/STATE_MANAGEMENT.md` for complete architecture documentation.
