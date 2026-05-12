import { useRouter, useSegments } from 'expo-router';
import { useEffect, useState } from 'react';
import { useAuth } from '~/shared/hooks/use-auth';
import { getUserProfile } from '~/domain/user';

export function OnboardingGate() {
  const { user, isLoading } = useAuth();
  const router = useRouter();
  const segments = useSegments();
  const [onboardingComplete, setOnboardingComplete] = useState<boolean | null>(
    null,
  );
  const [isChecking, setIsChecking] = useState(false);

  const refreshProfile = async () => {
    if (isLoading || !user || isChecking) return;
    setIsChecking(true);
    try {
      const profile = await getUserProfile(user.id);
      setOnboardingComplete(profile?.onboarding_completed ?? false);
    } finally {
      setIsChecking(false);
    }
  };

  useEffect(() => {
    refreshProfile();
  }, [user, isLoading]);

  const currentSegment = Array.isArray(segments)
    ? ((segments[0] as string | undefined) ?? '')
    : '';
  const inOnboarding = currentSegment === 'onboarding';

  useEffect(() => {
    if (onboardingComplete === null || isLoading) return;

    if (!onboardingComplete) {
      if (!inOnboarding) {
        router.replace('/onboarding' as any);
      }
    } else if (inOnboarding) {
      router.replace('/' as any);
    }
  }, [onboardingComplete, inOnboarding, router, isLoading]);

  useEffect(() => {
    if (onboardingComplete === false && !inOnboarding) {
      refreshProfile();
    }
  }, [inOnboarding, onboardingComplete]);

  return null;
}
