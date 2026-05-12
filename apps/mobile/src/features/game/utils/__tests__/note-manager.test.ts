import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  areNotesAnimating,
  createNoteId,
  getNoteColor,
  highlightNote,
  prepareNotesForDisplay,
  resetNotesToIdle,
  triggerCreationAnimation,
  triggerDestructionAnimation,
  triggerSequenceFeedback,
} from '../note-manager';
import {
  NoteAnimationType,
  NoteState,
  Notes,
  type Note,
} from '~/shared/types/music';

const baseNote: Note = {
  name: Notes.C,
  octave: 4,
  staffPosition: 0,
  duration: 1,
};

describe('note-manager', () => {
  beforeEach(() => {
    vi.spyOn(Date, 'now').mockReturnValue(123456);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('createNoteId', () => {
    it('creates deterministic identifiers using note data', () => {
      // given
      const note = { ...baseNote };
      const index = 2;

      // when
      const noteId = createNoteId(note, index);

      // then
      expect(noteId).toBe('C4_0_2_123456');
    });
  });

  describe('prepareNotesForDisplay', () => {
    it('adds ids and idle state to each note', () => {
      // given
      const notes = [{ ...baseNote }, { ...baseNote, name: Notes.D }];

      // when
      const prepared = prepareNotesForDisplay(notes);

      // then
      expect(prepared).toHaveLength(2);
      expect(prepared.every((note) => note.state === NoteState.IDLE)).toBe(true);
      expect(prepared.every((note) => typeof note.noteId === 'string')).toBe(
        true,
      );
    });
  });

  describe('triggerCreationAnimation', () => {
    it('marks notes with creation animation metadata', () => {
      // given
      const notes = prepareNotesForDisplay([{ ...baseNote }]);

      // when
      const animated = triggerCreationAnimation(notes);

      // then
      expect(animated[0].animation).toEqual(
        expect.objectContaining({
          type: NoteAnimationType.CREATION,
        }),
      );
      expect(animated[0].state).toBe(NoteState.IDLE);
    });
  });

  describe('triggerDestructionAnimation', () => {
    it('marks notes as destroying and only the final callback triggers onComplete', () => {
      // given
      const notes = prepareNotesForDisplay([
        { ...baseNote },
        { ...baseNote, name: Notes.E },
      ]);
      const isCorrect = true;
      const onComplete = vi.fn();

      // when
      const destroyed = triggerDestructionAnimation(notes, isCorrect, onComplete);

      // then
      expect(destroyed.map((note) => note.state)).toEqual([
        NoteState.DESTROYING,
        NoteState.DESTROYING,
      ]);
      expect(destroyed[0].animation).toEqual(
        expect.objectContaining({
          type: NoteAnimationType.DESTRUCTION,
          isCorrect: true,
          onComplete: undefined,
        }),
      );
      expect(destroyed[1].animation?.onComplete).toBe(onComplete);
    });
  });

  describe('triggerSequenceFeedback', () => {
    it('sets correct and incorrect states per note position', () => {
      // given
      const notes = prepareNotesForDisplay([
        { ...baseNote },
        { ...baseNote, name: Notes.D },
      ]);
      const userAnswer = [Notes.C, Notes.E];
      const correctAnswer = [Notes.C, Notes.D];

      // when
      const feedback = triggerSequenceFeedback(notes, userAnswer, correctAnswer);

      // then
      expect(feedback.map((note) => note.state)).toEqual([
        NoteState.CORRECT,
        NoteState.INCORRECT,
      ]);
    });
  });

  describe('highlightNote', () => {
    it('highlights only the specified note', () => {
      // given
      const notes = prepareNotesForDisplay([
        { ...baseNote },
        { ...baseNote, name: Notes.F },
      ]);

      // when
      const highlighted = highlightNote(notes, 1);

      // then
      expect(highlighted[0].state).toBe(NoteState.IDLE);
      expect(highlighted[1].state).toBe(NoteState.HIGHLIGHTED);
    });
  });

  describe('resetNotesToIdle', () => {
    it('clears animation metadata and resets state', () => {
      // given
      const notes = triggerCreationAnimation(
        prepareNotesForDisplay([{ ...baseNote }]),
      );

      // when
      const reset = resetNotesToIdle(notes);

      // then
      expect(reset[0].state).toBe(NoteState.IDLE);
      expect(reset[0].animation).toBeUndefined();
    });
  });

  describe('getNoteColor', () => {
    it('returns palette colors based on state', () => {
      // given
      const defaultColor = '#000000';
      const correctNote = { ...baseNote, state: NoteState.CORRECT };
      const incorrectNote = { ...baseNote, state: NoteState.INCORRECT };
      const highlightedNote = { ...baseNote, state: NoteState.HIGHLIGHTED };

      // when
      const correctColor = getNoteColor(correctNote, defaultColor);
      const incorrectColor = getNoteColor(incorrectNote, defaultColor);
      const highlightedColor = getNoteColor(highlightedNote, defaultColor);
      const idleColor = getNoteColor({ ...baseNote }, defaultColor);

      // then
      expect(correctColor).toBe('#10B981');
      expect(incorrectColor).toBe('#EF4444');
      expect(highlightedColor).toBe('#3B82F6');
      expect(idleColor).toBe(defaultColor);
    });
  });

  describe('areNotesAnimating', () => {
    it('detects when any note is mid-animation', () => {
      // given
      const idleNotes = prepareNotesForDisplay([{ ...baseNote }]);
      const destroyingNote = [
        {
          ...baseNote,
          state: NoteState.DESTROYING,
          animation: { type: NoteAnimationType.DESTRUCTION },
        },
      ];

      // when
      const idleResult = areNotesAnimating(idleNotes);
      const destroyingResult = areNotesAnimating(destroyingNote);

      // then
      expect(idleResult).toBe(false);
      expect(destroyingResult).toBe(true);
    });
  });
});
