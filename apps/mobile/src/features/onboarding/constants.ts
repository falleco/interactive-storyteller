import type { OnboardingInstrument, SkillLevel } from '~/shared/types/music';

export const ONBOARDING_INSTRUMENTS: Array<{
  id: OnboardingInstrument;
  label: string;
  emoji: string;
}> = [
  { id: 'violin', label: 'Violin', emoji: '🎻' },
  { id: 'viola', label: 'Viola', emoji: '🎼' },
  { id: 'acoustic_guitar', label: 'Acoustic Guitar', emoji: '🎸' },
  { id: 'electric_guitar', label: 'Electric Guitar', emoji: '⚡️🎸' },
  { id: 'bass', label: 'Bass', emoji: '🎵' },
];

export const ONBOARDING_LEVELS: Array<{
  id: SkillLevel;
  label: string;
  description: string;
}> = [
  {
    id: 'beginner',
    label: 'Beginner',
    description: 'Learning the basic notes and rhythms',
  },
  {
    id: 'intermediate',
    label: 'Intermediate',
    description: 'Comfortable with scales and simple pieces',
  },
  {
    id: 'pro',
    label: 'Pro',
    description: 'Ready for complex arrangements and fast tempos',
  },
];
