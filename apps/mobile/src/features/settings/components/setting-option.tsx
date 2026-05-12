import React from 'react';
import { Pressable, View } from 'react-native';
import { ThemedText } from '~/shared/components/themed-text';
import { useThemeColor } from '~/shared/hooks/use-theme-color';
import { cn } from '~/shared/lib/cn';

interface OptionItem {
  label: string;
  value: any;
  description?: string;
}

interface SettingOptionProps {
  title: string;
  subtitle?: string;
  options: OptionItem[];
  currentValue: any;
  onValueChange: (value: any) => void;
}

/**
 * Reusable Setting Option component for consistent option selection UI
 * Used in settings modals and configuration screens
 */
export function SettingOption({
  title,
  subtitle,
  options,
  currentValue,
  onValueChange,
}: SettingOptionProps) {
  const textColor = useThemeColor({}, 'text');
  const tintColor = useThemeColor({}, 'tint');

  return (
    <View className="mb-5">
      <ThemedText
        className="text-base font-semibold mb-1"
        style={{ color: textColor }}
      >
        {title}
      </ThemedText>
      {subtitle && (
        <ThemedText
          className="text-sm opacity-70 mb-3"
          style={{ color: textColor }}
        >
          {subtitle}
        </ThemedText>
      )}
      <View className="gap-2">
        {options.map((option) => {
          const isSelected = currentValue === option.value;

          return (
            <Pressable
              key={option.value}
              className={cn(
                'p-4 border-2 rounded-xl items-center',
                isSelected
                  ? 'border-blue-500 bg-blue-500'
                  : 'border-gray-300 bg-transparent',
              )}
              style={({ pressed }) => ({
                transform: [{ scale: pressed ? 0.98 : 1 }],
                borderColor: isSelected ? tintColor : '#ccc',
                backgroundColor: isSelected ? tintColor : 'transparent',
              })}
              onPress={() => onValueChange(option.value)}
            >
              <View className="gap-1 items-center">
                <ThemedText
                  className={cn(
                    'text-base text-center',
                    isSelected ? 'font-semibold' : 'font-normal',
                  )}
                  style={{
                    color: isSelected ? 'white' : textColor,
                  }}
                >
                  {option.label}
                </ThemedText>
                {option.description && (
                  <ThemedText
                    className="text-sm text-center"
                    style={{
                      color: isSelected ? 'rgba(255,255,255,0.8)' : textColor,
                      opacity: isSelected ? 1 : 0.6,
                    }}
                  >
                    {option.description}
                  </ThemedText>
                )}
              </View>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}
