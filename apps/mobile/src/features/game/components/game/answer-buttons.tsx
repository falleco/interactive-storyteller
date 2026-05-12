import * as Haptics from 'expo-haptics';
import React from 'react';
import { View } from 'react-native';
import {
  FlatButton,
  FlatButtonText,
} from '~/shared/components/core/flat-button';

interface AnswerButtonsProps {
  options: string[];
  onAnswerSubmit: (selectedAnswers: string) => void;
  disabled?: boolean;
}

export function AnswerButtons({
  options,
  onAnswerSubmit,
  disabled = false,
}: AnswerButtonsProps) {
  const handleButtonPress = (answer: string) => {
    if (disabled) return;

    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    onAnswerSubmit(answer);
  };

  return (
    <View className="flex-row flex-wrap justify-center gap-3 px-4">
      {options.map((option, index) => {
        return (
          <FlatButton
            key={option}
            size="lg"
            onPress={() => handleButtonPress(option)}
            isDisabled={disabled}
            className="relative overflow-hidden rounded-2xl px-6 py-4 min-w-[80px] border-white/20 border-2 bg-white/10"
            hapticFeedback={false} // We handle haptics manually
          >
            <FlatButtonText className="text-center text-lg font-black text-white">
              {option}
            </FlatButtonText>
          </FlatButton>
        );
      })}
    </View>
  );
}
