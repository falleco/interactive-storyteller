import achievementsSeed from './achievements.json';
import challengesSeed from './challenges.json';
import equipmentsSeed from './equipments.json';
import instrumentsSeed from './instruments.json';
import type {
  AchievementSeed,
  ChallengeSeed,
  EquipmentSeed,
  InstrumentSeed,
} from '../types';

export const ACHIEVEMENT_SEEDS = achievementsSeed as AchievementSeed[];
export const CHALLENGE_SEEDS = challengesSeed as ChallengeSeed[];
export const EQUIPMENT_SEEDS = equipmentsSeed as EquipmentSeed[];
export const INSTRUMENT_SEEDS = instrumentsSeed as InstrumentSeed[];
