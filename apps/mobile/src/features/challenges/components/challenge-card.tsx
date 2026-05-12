import type React from 'react';
import { View } from 'react-native';
import {
  FlatButton,
  FlatButtonText,
} from '~/shared/components/core/flat-button';
import { ThemedText } from '~/shared/components/themed-text';
import { useThemeColor } from '~/shared/hooks/use-theme-color';
import { cn } from '~/shared/lib/cn';
import type { Challenge } from '~/shared/types/music';
import { ChallengeStatus } from '~/shared/types/music';

type StatusStyle = {
  pill: string;
  label: string;
  accent: string;
  description: string;
};

const STATUS_STYLES: Record<ChallengeStatus, StatusStyle> = {
  [ChallengeStatus.AVAILABLE]: {
    pill: 'bg-[#2B1F4D]',
    label: 'text-[#B7A2FF]',
    accent: 'text-[#B7A2FF]',
    description: 'text-[#C4BAFF]',
  },
  [ChallengeStatus.IN_PROGRESS]: {
    pill: 'bg-[#15354A]',
    label: 'text-[#5EF2FF]',
    accent: 'text-[#5EF2FF]',
    description: 'text-[#90DFF5]',
  },
  [ChallengeStatus.COMPLETED]: {
    pill: 'bg-[#1D3B2B]',
    label: 'text-[#7CFFB2]',
    accent: 'text-[#7CFFB2]',
    description: 'text-[#A9FFD2]',
  },
  [ChallengeStatus.REDEEMED]: {
    pill: 'bg-[#3D1D3D]',
    label: 'text-[#FF5DA2]',
    accent: 'text-[#FF5DA2]',
    description: 'text-[#FFAFD5]',
  },
};

const STATUS_LABEL: Record<ChallengeStatus, string> = {
  [ChallengeStatus.AVAILABLE]: 'Tracking',
  [ChallengeStatus.IN_PROGRESS]: 'In Progress',
  [ChallengeStatus.COMPLETED]: 'Completed',
  [ChallengeStatus.REDEEMED]: 'Redeemed',
};

interface ChallengeCardProps {
  challenge: Challenge;
  onRedeem: (challengeId: string) => void;
}

export function ChallengeCard({ challenge, onRedeem }: ChallengeCardProps) {
  const outline = useThemeColor({}, 'outline');
  const statusStyle = STATUS_STYLES[challenge.status];
  const isRedeemable = challenge.status === ChallengeStatus.COMPLETED;

  const handleActionPress = () => {
    if (isRedeemable) {
      onRedeem(challenge.id);
    }
  };

  return (
    <View
      className={cn(
        'mb-6 rounded-3xl border-2 p-6',
        'bg-[#100824]/95 shadow-[0_16px_40px_rgba(4,3,15,0.65)]',
      )}
      style={{ borderColor: outline }}
    >
      <View className="absolute -top-4 right-6 px-4 py-2 rounded-full bg-[#2B1F4D] border border-white/10 shadow-lg">
        <ThemedText type="label" tone="secondary" className="text-[10px]">
          {challenge.progress}/{challenge.requirement} Complete
        </ThemedText>
      </View>

      <View className="flex-row items-start justify-between">
        <View className="flex-row items-start mr-4">
          <ThemedText type="title" tone="accent" className="mr-4">
            {challenge.icon}
          </ThemedText>
          <View>
            <ThemedText type="heading" tone="secondary">
              {challenge.title}
            </ThemedText>
            <View
              className={cn('mt-3 px-3 py-1 rounded-full', statusStyle.pill)}
            >
              <ThemedText type="label" className={statusStyle.label}>
                {STATUS_LABEL[challenge.status]}
              </ThemedText>
            </View>
          </View>
        </View>

        <View className="items-end">
          <ThemedText type="caption" tone="muted">
            Reward
          </ThemedText>
          <ThemedText
            type="heading"
            className={cn(statusStyle.accent, 'flex-row items-center mt-1')}
          >
            <ThemedText type="heading" tone="secondary" className="mr-1">
              ✨
            </ThemedText>
            {challenge.reward}
          </ThemedText>
        </View>
      </View>

      <ThemedText type="body" className={cn('mt-4', statusStyle.description)}>
        {challenge.description}
      </ThemedText>

      <FlatButton
        size="md"
        className={cn(
          'mt-5 w-full rounded-2xl border-4 shadow-[0_12px_0_#080616]',
          isRedeemable
            ? 'bg-[#372155] border-[#7CFFB2]'
            : 'bg-[#1B152C] border-[#35295D]',
        )}
        onPress={handleActionPress}
        isDisabled={!isRedeemable}
      >
        <FlatButtonText tone={isRedeemable ? 'secondary' : 'muted'}>
          {isRedeemable ? 'Redeem Reward' : 'Keep Playing'}
        </FlatButtonText>
      </FlatButton>
    </View>
  );
}
