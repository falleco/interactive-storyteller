import type { Difficulty, NotationSystem, Note } from '~/shared/types/music';
import { getNoteDisplayName } from '~/shared/utils/music-utils';

/**
 * Business logic for rhythm game mode
 * Separated from UI components for better testability
 */

export interface RhythmNote {
  id: string;
  note: Note;
  displayName: string;
  startTime: number;
  targetTime: number;
  hit: boolean;
  accuracy?: number;
}

export interface RhythmGameConfig {
  noteSpeed: number; // Duration for note to cross screen (ms)
  noteInterval: number; // Time between notes (ms)
  targetLineX: number; // X position of target line
  hitZoneSize: number; // Size of hit zone in pixels
  maxTimingTolerance: number; // Maximum timing difference for a hit (ms)
}

/**
 * Creates default rhythm game configuration
 * @returns Default rhythm game settings
 */
export function createDefaultRhythmConfig(): RhythmGameConfig {
  return {
    noteSpeed: 3000,
    noteInterval: 1000,
    targetLineX: 120,
    hitZoneSize: 50,
    maxTimingTolerance: 500,
  };
}

/**
 * Creates a rhythm note from a musical note
 * @param note - Musical note
 * @param index - Note index in sequence
 * @param startTime - Game start time
 * @param config - Rhythm game configuration
 * @param notationSystem - Current notation system
 * @returns Rhythm note object
 */
export function createRhythmNote(
  note: Note,
  index: number,
  startTime: number,
  config: RhythmGameConfig,
  notationSystem: NotationSystem,
): Omit<RhythmNote, 'id'> {
  const noteStartDelay = index * config.noteInterval;
  const targetTime = startTime + noteStartDelay + config.noteSpeed * 0.6; // Target at 60% through animation

  return {
    note,
    displayName: getNoteDisplayName(note.name, notationSystem),
    startTime: startTime + noteStartDelay,
    targetTime,
    hit: false,
  };
}

/**
 * Calculates the current X position of a moving note
 * @param note - Rhythm note
 * @param currentTime - Current timestamp
 * @param config - Rhythm game configuration
 * @param screenWidth - Screen width
 * @returns Current X position
 */
export function calculateNotePosition(
  note: RhythmNote,
  currentTime: number,
  config: RhythmGameConfig,
  screenWidth: number,
): number {
  const elapsedTime = currentTime - note.startTime;
  const progress = Math.min(1, elapsedTime / config.noteSpeed);
  return screenWidth + 50 - progress * (screenWidth + 150);
}

/**
 * Checks if a note is within the hit zone
 * @param noteX - Current X position of note
 * @param targetLineX - X position of target line
 * @param hitZoneSize - Size of hit zone
 * @returns True if note is hittable
 */
export function isNoteInHitZone(
  noteX: number,
  targetLineX: number,
  hitZoneSize: number,
): boolean {
  return Math.abs(noteX - targetLineX) <= hitZoneSize;
}

/**
 * Processes a rhythm hit attempt
 * @param noteName - Name of note being hit
 * @param currentTime - Current timestamp
 * @param activeNotes - Currently active rhythm notes
 * @param config - Rhythm game configuration
 * @param screenWidth - Screen width
 * @returns Hit result with accuracy and updated note
 */
export function processRhythmHit(
  noteName: string,
  currentTime: number,
  activeNotes: RhythmNote[],
  config: RhythmGameConfig,
  screenWidth: number,
): {
  hit: boolean;
  accuracy: number;
  hitNote?: RhythmNote;
} {
  // Find matching notes in hit zone
  const hittableNotes = activeNotes.filter((note) => {
    if (note.hit || note.displayName !== noteName) return false;

    const noteX = calculateNotePosition(note, currentTime, config, screenWidth);
    return isNoteInHitZone(noteX, config.targetLineX, config.hitZoneSize);
  });

  if (hittableNotes.length === 0) {
    return { hit: false, accuracy: 0 };
  }

  // Hit the closest note
  const closestNote = hittableNotes[0];
  const noteX = calculateNotePosition(
    closestNote,
    currentTime,
    config,
    screenWidth,
  );
  const distance = Math.abs(noteX - config.targetLineX);
  const accuracy = Math.max(0, 100 - (distance / config.hitZoneSize) * 100);

  closestNote.hit = true;
  closestNote.accuracy = accuracy;

  return {
    hit: true,
    accuracy,
    hitNote: closestNote,
  };
}

/**
 * Calculates final rhythm game score
 * @param notes - All rhythm notes
 * @returns Final score and statistics
 */
export function calculateRhythmScore(notes: RhythmNote[]): {
  totalScore: number;
  hitCount: number;
  averageAccuracy: number;
  perfectHits: number;
} {
  const hitNotes = notes.filter((note) => note.hit);
  const totalScore = hitNotes.reduce(
    (sum, note) => sum + Math.round(note.accuracy || 0),
    0,
  );
  const averageAccuracy =
    hitNotes.length > 0
      ? Math.round(
          hitNotes.reduce((sum, note) => sum + (note.accuracy || 0), 0) /
            hitNotes.length,
        )
      : 0;
  const perfectHits = hitNotes.filter(
    (note) => (note.accuracy || 0) > 90,
  ).length;

  return {
    totalScore,
    hitCount: hitNotes.length,
    averageAccuracy,
    perfectHits,
  };
}
