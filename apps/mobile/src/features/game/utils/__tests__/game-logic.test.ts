import type { Mock } from 'vitest';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import * as Haptics from 'expo-haptics';
import {
  calculatePoints,
  calculateRhythmAccuracy,
  getAutoAdvanceDelay,
  getStreakLevel,
  isRhythmHitValid,
  triggerGameHaptics,
  validateAnswer,
  validateSequence,
} from '../game-logic';
import { GameMode } from '~/shared/types/music';

vi.mock('expo-haptics', () => ({
  __esModule: true,
  NotificationFeedbackType: {
    Success: 'success',
    Error: 'error',
  },
  ImpactFeedbackStyle: {
    Medium: 'medium',
    Light: 'light',
  },
  notificationAsync: vi.fn(),
  impactAsync: vi.fn(),
}));

describe('game-logic', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('getStreakLevel', () => {
    it('returns correct streak levels for thresholds', () => {
      // given
      const streaks = [0, 1, 5, 10];

      // when
      const levels = streaks.map((streak) => getStreakLevel(streak));

      // then
      expect(levels).toEqual([0, 1, 2, 3]);
    });
  });

  describe('getAutoAdvanceDelay', () => {
    it('returns shorter delay for correct single note answers', () => {
      // given
      const gameMode = GameMode.SINGLE_NOTE;

      // when
      const delay = getAutoAdvanceDelay(gameMode, true);

      // then
      expect(delay).toBe(500);
    });

    it('returns default delay for rhythm mode', () => {
      // given
      const gameMode = GameMode.RHYTHM;

      // when
      const delay = getAutoAdvanceDelay(gameMode, true);

      // then
      expect(delay).toBe(2000);
    });
  });

  describe('validateAnswer', () => {
    it('treats answers as order independent', () => {
      // given
      const userAnswer = ['A', 'B', 'C'];
      const correctAnswer = ['C', 'B', 'A'];

      // when
      const result = validateAnswer(userAnswer, correctAnswer);

      // then
      expect(result).toBe(true);
    });

    it('fails when contents differ', () => {
      // given
      const userAnswer = ['A', 'B'];
      const correctAnswer = ['A', 'C'];

      // when
      const result = validateAnswer(userAnswer, correctAnswer);

      // then
      expect(result).toBe(false);
    });
  });

  describe('validateSequence', () => {
    it('requires matching order and length', () => {
      // given
      const correctSequence = ['A', 'B', 'C'];
      const matchingSequence = ['A', 'B', 'C'];
      const wrongOrderSequence = ['C', 'B', 'A'];

      // when
      const matchResult = validateSequence(matchingSequence, correctSequence);
      const wrongOrderResult = validateSequence(
        wrongOrderSequence,
        correctSequence,
      );

      // then
      expect(matchResult).toBe(true);
      expect(wrongOrderResult).toBe(false);
    });
  });

  describe('calculateRhythmAccuracy', () => {
    it('calculates accuracy relative to timing difference', () => {
      // given
      const timingDiff = 50;
      const maxDiff = 200;

      // when
      const accuracy = calculateRhythmAccuracy(timingDiff, maxDiff);

      // then
      expect(accuracy).toBe(75);
    });
  });

  describe('isRhythmHitValid', () => {
    it('validates hits within tolerance', () => {
      // given
      const currentTime = 1050;
      const targetTime = 1000;
      const tolerance = 100;

      // when
      const validResult = isRhythmHitValid(currentTime, targetTime, tolerance);
      const invalidResult = isRhythmHitValid(1200, targetTime, tolerance);

      // then
      expect(validResult).toBe(true);
      expect(invalidResult).toBe(false);
    });
  });

  describe('calculatePoints', () => {
    it('applies streak bonus and accuracy multiplier', () => {
      // given
      const streak = 3;
      const basePoints = 10;
      const accuracy = 80;

      // when
      const points = calculatePoints(streak, basePoints, accuracy);

      // then
      expect(points).toBe(13);
    });
  });

  describe('triggerGameHaptics', () => {
    const notificationAsync = Haptics.notificationAsync as Mock;
    const impactAsync = Haptics.impactAsync as Mock;

    it('sends success notification for correct answers without accuracy', () => {
      // given
      const isCorrect = true;

      // when
      triggerGameHaptics(isCorrect);

      // then
      expect(notificationAsync).toHaveBeenCalledWith('success');
      expect(impactAsync).not.toHaveBeenCalled();
    });

    it('sends medium impact for moderate rhythm accuracy', () => {
      // given
      const isCorrect = true;
      const accuracy = 65;

      // when
      triggerGameHaptics(isCorrect, accuracy);

      // then
      expect(impactAsync).toHaveBeenCalledWith('medium');
      expect(notificationAsync).not.toHaveBeenCalled();
    });

    it('sends success notification for highly accurate rhythm hits', () => {
      // given
      const isCorrect = true;
      const accuracy = 95;

      // when
      triggerGameHaptics(isCorrect, accuracy);

      // then
      expect(notificationAsync).toHaveBeenCalledWith('success');
      expect(impactAsync).not.toHaveBeenCalled();
    });

    it('sends light impact for low rhythm accuracy', () => {
      // given
      const isCorrect = true;
      const accuracy = 45;

      // when
      triggerGameHaptics(isCorrect, accuracy);

      // then
      expect(impactAsync).toHaveBeenCalledWith('light');
    });

    it('sends error notification for incorrect answers', () => {
      // given
      const isCorrect = false;

      // when
      triggerGameHaptics(isCorrect);

      // then
      expect(notificationAsync).toHaveBeenCalledWith('error');
    });
  });
});
