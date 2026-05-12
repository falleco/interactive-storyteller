import React, {
  createContext,
  type Dispatch,
  type ReactNode,
  type SetStateAction,
  useEffect,
  useState,
} from 'react';
import { useAuth } from '~/shared/hooks/use-auth';
import { analyticsService } from '~/features/analytics/services/analytics-service';
import { challengeService } from '~/features/challenges/services/challenge-service';
import { currencyService } from '~/features/currency/services/currency-service';
import { equipmentService } from '~/features/equipment/services/equipment-service';
import { luthierService } from '~/features/luthier/services/luthier-service';
import type { UserAnalytics } from '~/shared/types/analytics';
import type {
  Challenge,
  Equipment,
  GameSettings,
  GameState,
  Instrument,
  UserCurrency,
} from '~/shared/types/music';
import { Difficulty, GameMode, NotationSystem } from '~/shared/types/music';

// Initial game state
const initialGameState: GameState = {
  score: 0,
  streak: 0,
  maxStreak: 0,
  totalQuestions: 0,
  correctAnswers: 0,
  currentQuestion: {
    id: '',
    notes: [],
    options: [],
    answered: false,
  },
  isGameActive: false,
};

// Initial game settings
const initialGameSettings: GameSettings = {
  notationSystem: NotationSystem.SOLFEGE,
  difficulty: Difficulty.BEGINNER,
  gameMode: GameMode.SINGLE_NOTE,
  showNoteLabels: true,
};

interface GameContextType {
  // Game logic state (read-only for components, writable for hooks)
  gameState: GameState;
  setGameState: Dispatch<SetStateAction<GameState>>;

  // Game settings state (read-only for components, writable for hooks)
  gameSettings: GameSettings;
  setGameSettings: Dispatch<SetStateAction<GameSettings>>;

  // Currency state (read-only for components, writable for hooks)
  currency: UserCurrency;
  currencyLoading: boolean;
  setCurrency: Dispatch<SetStateAction<UserCurrency>>;
  setCurrencyLoading: Dispatch<SetStateAction<boolean>>;

  // Challenges state (read-only for components, writable for hooks)
  challenges: Challenge[];
  challengesLoading: boolean;
  setChallenges: Dispatch<SetStateAction<Challenge[]>>;
  setChallengesLoading: Dispatch<SetStateAction<boolean>>;

  // Equipment state (read-only for components, writable for hooks)
  equipment: Equipment[];
  equipmentLoading: boolean;
  setEquipment: Dispatch<SetStateAction<Equipment[]>>;
  setEquipmentLoading: Dispatch<SetStateAction<boolean>>;

  // Instruments state (read-only for components, writable for hooks)
  instruments: Instrument[];
  instrumentsLoading: boolean;
  setInstruments: Dispatch<SetStateAction<Instrument[]>>;
  setInstrumentsLoading: Dispatch<SetStateAction<boolean>>;

  // Analytics state (read-only for components, writable for hooks)
  analytics: UserAnalytics | null;
  analyticsLoading: boolean;
  setAnalytics: Dispatch<SetStateAction<UserAnalytics | null>>;
  setAnalyticsLoading: Dispatch<SetStateAction<boolean>>;
}

/**
 * Game context - Centralized state container
 *
 * This context serves as a simple state container for:
 * - Game logic and settings
 * - Currency state (balance, loading)
 * - Challenges state (list, loading)
 *
 * Note: This context only manages STATE, not business logic.
 * Business logic is implemented in dedicated hooks:
 * - useCurrency() for currency operations
 * - useChallenges() for challenge operations
 */
export const GameContext = createContext<GameContextType | undefined>(
  undefined,
);

/**
 * Game provider component - State container
 *
 * This provider manages ALL game-related STATE in one place:
 * - Game logic (score, streak, questions)
 * - Game settings (difficulty, notation, etc)
 * - Currency (Golden Note Shards balance)
 * - Challenges (progress, completion)
 *
 * Benefits:
 * - Single source of truth for state
 * - No duplicate state across components
 * - State changes propagate everywhere automatically
 * - Hooks implement business logic separately
 *
 * @param children - Child components that need access to game state
 *
 * @example
 * ```tsx
 * function App() {
 *   return (
 *     <GameProvider>
 *       <GameScreen />
 *       <ChallengesScreen />
 *       <ShopScreen />
 *     </GameProvider>
 *   );
 * }
 * ```
 */
export function GameProvider({ children }: { children: ReactNode }) {
  const { user, isLoading: isAuthLoading } = useAuth();

  // Game logic state - managed centrally, but logic in useGameLogic hook
  const [gameState, setGameState] = useState<GameState>(initialGameState);

  // Game settings state - managed centrally, but logic in useGameSettings hook
  const [gameSettings, setGameSettings] =
    useState<GameSettings>(initialGameSettings);

  // Currency state - managed centrally, but logic in useCurrency hook
  const [currency, setCurrency] = useState<UserCurrency>({
    goldenNoteShards: 0,
  });
  const [currencyLoading, setCurrencyLoading] = useState(true);

  // Challenges state - managed centrally, but logic in useChallenges hook
  const [challenges, setChallenges] = useState<Challenge[]>([]);
  const [challengesLoading, setChallengesLoading] = useState(true);

  // Equipment state - managed centrally, but logic in useEquipment hook
  const [equipment, setEquipment] = useState<Equipment[]>([]);
  const [equipmentLoading, setEquipmentLoading] = useState(true);

  // Instruments state - managed centrally, but logic in useLuthier hook
  const [instruments, setInstruments] = useState<Instrument[]>([]);
  const [instrumentsLoading, setInstrumentsLoading] = useState(true);

  // Analytics state - managed centrally, but logic in useAnalytics hook
  const [analytics, setAnalytics] = useState<UserAnalytics | null>(null);
  const [analyticsLoading, setAnalyticsLoading] = useState(true);

  // Initial data loading
  useEffect(() => {
    if (user && !isAuthLoading) {
      loadInitialData();
    }
  }, [user, isAuthLoading]);

  /**
   * Loads initial data from database
   * This runs once when user becomes available
   */
  const loadInitialData = async () => {
    if (!user) return;

    try {
      // Load currency
      setCurrencyLoading(true);
      const balance = await currencyService.getBalance(user.id);
      setCurrency({ goldenNoteShards: balance });
      setCurrencyLoading(false);

      // Load challenges
      setChallengesLoading(true);
      const fetchedChallenges = await challengeService.getUserChallenges(
        user.id,
      );
      setChallenges(fetchedChallenges);
      setChallengesLoading(false);

      // Load equipment
      setEquipmentLoading(true);
      const fetchedEquipment = await equipmentService.getUserEquipment(user.id);
      setEquipment(fetchedEquipment);
      setEquipmentLoading(false);

      // Load instruments
      setInstrumentsLoading(true);
      const fetchedInstruments = await luthierService.getUserInstruments(
        user.id,
      );
      setInstruments(fetchedInstruments);
      setInstrumentsLoading(false);

      // Load analytics
      setAnalyticsLoading(true);
      const fetchedAnalytics = await analyticsService.getAnalytics(user.id);
      setAnalytics(fetchedAnalytics);
      setAnalyticsLoading(false);
    } catch (error) {
      console.error('Error loading initial data:', error);
      setCurrencyLoading(false);
      setChallengesLoading(false);
      setEquipmentLoading(false);
      setInstrumentsLoading(false);
      setAnalyticsLoading(false);
    }
  };

  const value: GameContextType = {
    // Game logic state and setter
    gameState,
    setGameState,
    // Game settings state and setter
    gameSettings,
    setGameSettings,
    // Currency state and setters
    currency,
    currencyLoading,
    setCurrency,
    setCurrencyLoading,
    // Challenges state and setters
    challenges,
    challengesLoading,
    setChallenges,
    setChallengesLoading,
    // Equipment state and setters
    equipment,
    equipmentLoading,
    setEquipment,
    setEquipmentLoading,
    // Instruments state and setters
    instruments,
    instrumentsLoading,
    setInstruments,
    setInstrumentsLoading,
    // Analytics state and setters
    analytics,
    analyticsLoading,
    setAnalytics,
    setAnalyticsLoading,
  };

  return <GameContext.Provider value={value}>{children}</GameContext.Provider>;
}
