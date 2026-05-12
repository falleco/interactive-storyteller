import * as Haptics from 'expo-haptics';
import { GameMode } from '~/shared/types/music';

/**
 * Pure functions for game logic - separated from UI components for better testability
 */

/**
 * Determines the streak level for visual feedback (treble clef dancing)
 * @param streak - Current streak count
 * @returns Streak level (0-3) for animation intensity
 */
export function getStreakLevel(streak: number): number {
  if (streak === 0) return 0;
  if (streak < 5) return 1;
  if (streak < 10) return 2;
  return 3;
}

/**
 * Calculates the appropriate delay for auto-advancing to next question
 * @param gameMode - Current game mode
 * @param isCorrect - Whether the answer was correct
 * @returns Delay in milliseconds
 */
export function getAutoAdvanceDelay(
  gameMode: GameMode,
  isCorrect: boolean,
): number {
  const DEFAULT_DELAY = 2000;

  if (gameMode === GameMode.SINGLE_NOTE) {
    return isCorrect ? 500 : 3000; // Quick for correct, longer for learning
  }

  return DEFAULT_DELAY;
}

/**
 * Validates if user's answer matches the correct answer
 * @param userAnswer - Array of user's selected notes
 * @param correctAnswer - Array of correct notes
 * @returns True if answers match (order independent for non-sequence modes)
 */
export function validateAnswer(
  userAnswer: string[],
  correctAnswer: string[],
): boolean {
  return (
    JSON.stringify(userAnswer.sort()) === JSON.stringify(correctAnswer.sort())
  );
}

/**
 * Validates sequence answer where order matters
 * @param userSequence - User's note sequence
 * @param correctSequence - Correct note sequence
 * @returns True if sequences match exactly in order
 */
export function validateSequence(
  userSequence: string[],
  correctSequence: string[],
): boolean {
  if (userSequence.length !== correctSequence.length) return false;

  return userSequence.every((note, index) => note === correctSequence[index]);
}

/**
 * Calculates rhythm game accuracy based on timing
 * @param timingDiff - Difference from perfect timing in milliseconds
 * @param maxAllowedDiff - Maximum allowed difference for a hit
 * @returns Accuracy percentage (0-100)
 */
export function calculateRhythmAccuracy(
  timingDiff: number,
  maxAllowedDiff: number,
): number {
  return Math.max(0, 100 - (timingDiff / maxAllowedDiff) * 100);
}

/**
 * Determines if a rhythm hit is within the acceptable timing window
 * @param currentTime - Current timestamp
 * @param targetTime - Target hit time
 * @param tolerance - Acceptable timing tolerance in milliseconds
 * @returns True if hit is within tolerance
 */
export function isRhythmHitValid(
  currentTime: number,
  targetTime: number,
  tolerance: number,
): boolean {
  return Math.abs(currentTime - targetTime) <= tolerance;
}

/**
 * Calculates points awarded for a correct answer
 * @param streak - Current streak count
 * @param basePoints - Base points for correct answer
 * @param accuracy - Accuracy percentage (for rhythm mode)
 * @returns Points to award
 */
export function calculatePoints(
  streak: number,
  basePoints = 10,
  accuracy = 100,
): number {
  const streakBonus = streak * 2;
  const accuracyMultiplier = accuracy / 100;
  return Math.round((basePoints + streakBonus) * accuracyMultiplier);
}

/**
 * Determines the appropriate haptic feedback based on game state
 * @param isCorrect - Whether the answer was correct
 * @param accuracy - Accuracy percentage (optional, for rhythm mode)
 */
export function triggerGameHaptics(
  isCorrect: boolean,
  accuracy?: number,
): void {
  if (isCorrect) {
    if (accuracy !== undefined) {
      // Rhythm mode - different feedback based on accuracy
      if (accuracy > 80) {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      } else if (accuracy > 50) {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
      } else {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      }
    } else {
      // Standard modes
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    }
  } else {
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
  }
}
