import { describe, expect, it } from 'vitest';
import {
  calculateNotePosition,
  calculateRhythmScore,
  createDefaultRhythmConfig,
  createRhythmNote,
  isNoteInHitZone,
  processRhythmHit,
  type RhythmNote,
} from '../rhythm-logic';
import { NotationSystem, Notes, type Note } from '~/shared/types/music';

describe('rhythm-logic', () => {
  const baseNote: Note = {
    name: Notes.C,
    octave: 4,
    staffPosition: 0,
    duration: 1,
  };

  describe('createDefaultRhythmConfig', () => {
    it('provides sensible defaults for gameplay pacing', () => {
      // given
      // when
      const config = createDefaultRhythmConfig();

      // then
      expect(config).toEqual({
        noteSpeed: 3000,
        noteInterval: 1000,
        targetLineX: 120,
        hitZoneSize: 50,
        maxTimingTolerance: 500,
      });
    });
  });

  describe('createRhythmNote', () => {
    it('derives display metadata and timings from the note', () => {
      // given
      const config = createDefaultRhythmConfig();
      const startTime = 1_000;

      // when
      const rhythmNote = createRhythmNote(
        baseNote,
        1,
        startTime,
        config,
        NotationSystem.LETTER,
      );

      // then
      expect(rhythmNote).toMatchObject({
        note: baseNote,
        displayName: 'C',
        startTime: startTime + config.noteInterval,
        hit: false,
      });
      expect(rhythmNote.targetTime).toBe(
        startTime + config.noteInterval + config.noteSpeed * 0.6,
      );
    });
  });

  describe('calculateNotePosition', () => {
    it('translates elapsed time into screen position', () => {
      // given
      const config = createDefaultRhythmConfig();
      const rhythmNote = {
        id: 'note-1',
        ...createRhythmNote(baseNote, 0, 0, config, NotationSystem.LETTER),
      };
      const screenWidth = 320;
      const currentTime = rhythmNote.startTime + config.noteSpeed / 2;

      // when
      const position = calculateNotePosition(
        rhythmNote,
        currentTime,
        config,
        screenWidth,
      );

      // then
      const expectedProgress = 0.5;
      const expectedPosition =
        screenWidth + 50 - expectedProgress * (screenWidth + 150);
      expect(position).toBe(expectedPosition);
    });
  });

  describe('isNoteInHitZone', () => {
    it('identifies when notes fall inside or outside the hit range', () => {
      // given
      const targetLineX = 100;
      const hitZoneSize = 30;

      // when
      const inside = isNoteInHitZone(110, targetLineX, hitZoneSize);
      const outside = isNoteInHitZone(150, targetLineX, hitZoneSize);

      // then
      expect(inside).toBe(true);
      expect(outside).toBe(false);
    });
  });

  describe('processRhythmHit', () => {
    it('returns miss information when no note is hittable', () => {
      // given
      const config = createDefaultRhythmConfig();
      const screenWidth = 320;
      const activeNotes = [
        {
          id: 'note-1',
          ...createRhythmNote(baseNote, 0, 0, config, NotationSystem.LETTER),
        },
      ];

      // when
      const result = processRhythmHit('D', Date.now(), activeNotes, config, screenWidth);

      // then
      expect(result).toEqual({ hit: false, accuracy: 0 });
    });

    it('marks the closest note as hit and returns accuracy', () => {
      // given
      const config = {
        ...createDefaultRhythmConfig(),
        noteSpeed: 2000,
        targetLineX: 90,
        hitZoneSize: 25,
      };
      const screenWidth = 320;
      const note = {
        id: 'note-1',
        ...createRhythmNote(baseNote, 0, 0, config, NotationSystem.LETTER),
      };
      const activeNotes = [note];
      const progress =
        (screenWidth + 50 - config.targetLineX) / (screenWidth + 150);
      const currentTime = note.startTime + progress * config.noteSpeed;

      // when
      const result = processRhythmHit('C', currentTime, activeNotes, config, screenWidth);

      // then
      expect(result.hit).toBe(true);
      expect(result.hitNote?.hit).toBe(true);
      expect(result.hitNote?.accuracy).toBeCloseTo(100, 5);
      expect(result.accuracy).toBeCloseTo(100, 5);
    });
  });

  describe('calculateRhythmScore', () => {
    it('aggregates score and accuracy statistics', () => {
      // given
      const notes: RhythmNote[] = [
        {
          id: '1',
          note: baseNote,
          displayName: 'C',
          startTime: 0,
          targetTime: 0,
          hit: true,
          accuracy: 95,
        },
        {
          id: '2',
          note: { ...baseNote, name: Notes.D },
          displayName: 'D',
          startTime: 0,
          targetTime: 0,
          hit: true,
          accuracy: 60,
        },
        {
          id: '3',
          note: { ...baseNote, name: Notes.E },
          displayName: 'E',
          startTime: 0,
          targetTime: 0,
          hit: false,
        },
      ];

      // when
      const summary = calculateRhythmScore(notes);

      // then
      expect(summary).toEqual({
        totalScore: 155,
        hitCount: 2,
        averageAccuracy: 78,
        perfectHits: 1,
      });
    });
  });
});
