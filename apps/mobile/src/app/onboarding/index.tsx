import { LinearGradient } from 'expo-linear-gradient';
import { useRouter } from 'expo-router';
import React, { useEffect, useMemo, useState } from 'react';
import { Animated, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useAuth } from '~/shared/hooks/use-auth';
import {
  getUserProfile,
  updateUserProfile,
} from '~/domain/user';
import {
  ONBOARDING_INSTRUMENTS,
  ONBOARDING_LEVELS,
} from '~/features/onboarding/constants';
import {
  FlatButton,
  FlatButtonText,
} from '~/shared/components/core/flat-button';
import { ThemedText } from '~/shared/components/themed-text';
import { cn } from '~/shared/lib/cn';
import type { OnboardingInstrument, SkillLevel } from '~/shared/types/music';

const STEP_COUNT = 4;

export default function OnboardingScreen() {
  const router = useRouter();
  const { user } = useAuth();

  const [currentStep, setCurrentStep] = useState(0);
  const [instrument, setInstrument] = useState<OnboardingInstrument | null>(
    null,
  );
  const [level, setLevel] = useState<SkillLevel | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const fadeAnim = useMemo(() => new Animated.Value(0), []);

  useEffect(() => {
    let isMounted = true;
    async function hydrateProfile() {
      if (!user) return;
      const profile = await getUserProfile(user.id);
      if (!isMounted || !profile) return;
      if (profile.preferred_instrument) {
        setInstrument(profile.preferred_instrument as OnboardingInstrument);
      }
      if (profile.skill_level) {
        setLevel(profile.skill_level as SkillLevel);
      }
    }

    hydrateProfile();
    return () => {
      isMounted = false;
    };
  }, [user]);

  useEffect(() => {
    Animated.timing(fadeAnim, {
      toValue: 1,
      duration: 320,
      useNativeDriver: true,
    }).start();
    return () => fadeAnim.setValue(0);
  }, [currentStep, fadeAnim]);

  const steps = [
    {
      key: 'welcome',
      title: 'Welcome to Staff Hero! ⚔️',
      subtitle: 'A music RPG where practice becomes an epic quest.',
      content: (
        <View className="mt-6 space-y-4">
          <ThemedText type="body" tone="muted">
            Recruit your hero, train with rhythm battles, and unlock radiant
            gear while mastering your instrument.
          </ThemedText>
          <ThemedText type="body" tone="muted">
            We just need a few details to forge the perfect adventure path for
            you.
          </ThemedText>
        </View>
      ),
    },
    {
      key: 'instrument',
      title: 'Choose Your Instrument',
      subtitle: 'Pick the weapon of your musical journey.',
      content: (
        <View className="mt-6 gap-3">
          {ONBOARDING_INSTRUMENTS.map((option) => {
            const selected = instrument === option.id;
            return (
              <FlatButton
                key={option.id}
                size="lg"
                onPress={() => setInstrument(option.id)}
                className={cn(
                  'w-full flex-row justify-between items-center px-4 py-3 border-4 rounded-2xl',
                  selected
                    ? 'bg-[#241B47] border-[#7CFFB2]'
                    : 'bg-[#1B152C] border-[#35295D] opacity-90',
                )}
              >
                <ThemedText
                  type="heading"
                  tone={selected ? 'secondary' : 'muted'}
                >
                  {option.emoji} {option.label}
                </ThemedText>
              </FlatButton>
            );
          })}
        </View>
      ),
    },
    {
      key: 'level',
      title: 'How Experienced Are You?',
      subtitle: 'We adapt quests to your current mastery.',
      content: (
        <View className="mt-6 gap-3">
          {ONBOARDING_LEVELS.map((option) => {
            const selected = level === option.id;
            return (
              <FlatButton
                key={option.id}
                size="lg"
                onPress={() => setLevel(option.id)}
                className={cn(
                  'w-full flex-row justify-between items-center px-4 py-3 border-4 rounded-2xl',
                  selected
                    ? 'bg-[#1D3B2B] border-[#7CFFB2]'
                    : 'bg-[#111024] border-[#312A4F] opacity-90',
                )}
              >
                <View className="flex-1">
                  <ThemedText
                    type="heading"
                    tone={selected ? 'secondary' : 'muted'}
                  >
                    {option.label}
                  </ThemedText>
                  <ThemedText
                    type="caption"
                    tone={selected ? 'secondary' : 'muted'}
                  >
                    {option.description}
                  </ThemedText>
                </View>
              </FlatButton>
            );
          })}
        </View>
      ),
    },
    {
      key: 'review',
      title: 'Ready to Begin?',
      subtitle: 'Here’s the path we forged for you.',
      content: (
        <View className="mt-6 gap-4">
          <View className="rounded-2xl bg-[#1C1236] border border-[#35275F] p-4">
            <ThemedText type="subtitle" tone="accent">
              Instrument
            </ThemedText>
            <ThemedText type="heading" tone="secondary" className="mt-1">
              {ONBOARDING_INSTRUMENTS.find((opt) => opt.id === instrument)
                ?.label ?? 'Not selected'}
            </ThemedText>
          </View>
          <View className="rounded-2xl bg-[#1C1236] border border-[#35275F] p-4">
            <ThemedText type="subtitle" tone="accent">
              Skill Level
            </ThemedText>
            <ThemedText type="heading" tone="secondary" className="mt-1">
              {ONBOARDING_LEVELS.find((opt) => opt.id === level)?.label ??
                'Not selected'}
            </ThemedText>
          </View>
          <ThemedText type="body" tone="muted" className="pt-2">
            You can update these later in Settings if your journey changes
            course.
          </ThemedText>
        </View>
      ),
    },
  ];

  const current = steps[currentStep];

  const canProceed = () => {
    if (current.key === 'instrument') return Boolean(instrument);
    if (current.key === 'level') return Boolean(level);
    if (current.key === 'review') return Boolean(instrument && level);
    return true;
  };

  const handleNext = () => {
    setCurrentStep((prev) => Math.min(prev + 1, STEP_COUNT - 1));
  };

  const handleBack = () => {
    setCurrentStep((prev) => Math.max(prev - 1, 0));
  };

  const handleFinish = async () => {
    if (!user || !instrument || !level) return;
    setIsSubmitting(true);
    try {
      await updateUserProfile(user.id, {
        preferred_instrument: instrument,
        skill_level: level,
        onboarding_completed: true,
      } as any);
      router.replace('/');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <LinearGradient
      colors={['#5E3DF7', '#211142']}
      start={{ x: 0, y: 0 }}
      end={{ x: 1, y: 1 }}
      style={{ flex: 1 }}
    >
      <SafeAreaView className="flex-1 px-6 pt-10">
        <View className="flex-row justify-between items-center mb-6">
          <ThemedText type="label" tone="muted">
            Step {currentStep + 1} / {STEP_COUNT}
          </ThemedText>
          {currentStep > 0 ? (
            <FlatButton
              size="sm"
              className="px-3 py-1 border-[#35295D] bg-[#120C24] rounded-full border"
              onPress={handleBack}
            >
              <FlatButtonText tone="muted">Back</FlatButtonText>
            </FlatButton>
          ) : (
            <View className="h-10" />
          )}
        </View>

        <Animated.View style={{ opacity: fadeAnim }}>
          <ThemedText type="title" tone="secondary">
            {current.title}
          </ThemedText>
          <ThemedText type="subtitle" tone="muted" className="mt-2">
            {current.subtitle}
          </ThemedText>
          {current.content}
        </Animated.View>

        <View className="flex-1" />

        <FlatButton
          size="lg"
          onPress={currentStep === STEP_COUNT - 1 ? handleFinish : handleNext}
          className={cn(
            'w-full rounded-2xl border-4 shadow-[0_14px_0_#090312] mt-8',
            canProceed()
              ? 'bg-[#372155] border-[#7CFFB2]'
              : 'bg-[#1A1430] border-[#35295D] opacity-70',
          )}
          isDisabled={!canProceed() || isSubmitting}
        >
          <FlatButtonText tone="secondary">
            {currentStep === STEP_COUNT - 1
              ? isSubmitting
                ? 'Forging...'
                : "Let's Begin!"
              : 'Next'}
          </FlatButtonText>
        </FlatButton>
      </SafeAreaView>
    </LinearGradient>
  );
}
