import { router } from 'expo-router';
import type React from 'react';
import { Alert, Pressable, Switch, View } from 'react-native';
import { ThemedText } from '~/shared/components/themed-text';
import { useThemeColor } from '~/shared/hooks/use-theme-color';
import { cn } from '~/shared/lib/cn';
import type { SettingItem, SettingSection } from '~/shared/types/music';
import { SettingActionType } from '~/shared/types/music';

interface SettingsListProps {
  sections: SettingSection[];
  onItemPress?: (item: SettingItem) => void;
  className?: string;
}

interface SettingItemRowProps {
  item: SettingItem;
  onPress?: (item: SettingItem) => void;
}

/**
 * Individual setting item row component
 */
function SettingItemRow({ item, onPress }: SettingItemRowProps) {
  const textColor = useThemeColor({}, 'text');
  const secondaryTextColor = useThemeColor({}, 'tabIconDefault');
  const primaryColor = useThemeColor({}, 'tint');
  const dangerColor = '#EF4444';

  const handlePress = () => {
    if (item.actionType === SettingActionType.NAVIGATION && item.route) {
      router.push(item.route as any);
    } else if (item.actionType === SettingActionType.ACTION && item.onPress) {
      item.onPress();
    } else if (
      item.actionType === SettingActionType.EXTERNAL_LINK &&
      item.externalUrl
    ) {
      // Handle external links (for now, just show alert)
      Alert.alert('External Link', `Would open: ${item.externalUrl}`, [
        { text: 'OK' },
      ]);
    } else if (onPress) {
      onPress(item);
    }
  };

  const getItemColor = () => {
    if (item.isDangerous) return dangerColor;
    return textColor;
  };

  const renderRightContent = () => {
    switch (item.actionType) {
      case SettingActionType.TOGGLE:
        return (
          <Switch
            value={item.isEnabled || false}
            onValueChange={() => handlePress()}
            trackColor={{ false: '#767577', true: primaryColor }}
            thumbColor={item.isEnabled ? '#fff' : '#f4f3f4'}
          />
        );

      case SettingActionType.SELECTION:
        return (
          <View className="flex-row items-center">
            <ThemedText
              className="text-sm mr-2"
              style={{ color: secondaryTextColor }}
            >
              {item.currentValue || 'Not set'}
            </ThemedText>
            <ThemedText
              className="text-lg"
              style={{ color: secondaryTextColor }}
            >
              ›
            </ThemedText>
          </View>
        );

      case SettingActionType.NAVIGATION:
      case SettingActionType.ACTION:
        return (
          <ThemedText className="text-lg" style={{ color: secondaryTextColor }}>
            ›
          </ThemedText>
        );

      case SettingActionType.EXTERNAL_LINK:
        return (
          <ThemedText className="text-lg" style={{ color: secondaryTextColor }}>
            ↗
          </ThemedText>
        );

      default:
        return null;
    }
  };

  return (
    <Pressable
      onPress={handlePress}
      className="flex-row items-center justify-between py-4 px-4 border-b border-gray-100"
      style={({ pressed }) => ({
        backgroundColor: pressed ? 'rgba(0,0,0,0.05)' : 'transparent',
      })}
    >
      <View className="flex-row items-center flex-1">
        <ThemedText className="text-xl mr-3">{item.icon}</ThemedText>
        <View className="flex-1">
          <ThemedText
            className="text-base font-medium"
            style={{ color: getItemColor() }}
          >
            {item.title}
          </ThemedText>
          {item.subtitle && (
            <ThemedText
              className="text-sm mt-1"
              style={{ color: secondaryTextColor }}
            >
              {item.subtitle}
            </ThemedText>
          )}
        </View>
      </View>
      {renderRightContent()}
    </Pressable>
  );
}

/**
 * Settings list component that renders sections with items
 *
 * Displays settings in a structured list format with sections and items.
 * Handles different types of setting interactions including navigation,
 * toggles, selections, and actions.
 *
 * @param sections - Array of setting sections to display
 * @param onItemPress - Optional callback when an item is pressed
 */
export function SettingsList({
  sections,
  onItemPress,
  className,
}: SettingsListProps) {
  const textColor = useThemeColor({}, 'text');
  const backgroundColor = useThemeColor({}, 'background');

  return (
    <View className={cn('flex-1', className)}>
      {sections.map((section, sectionIndex) => (
        <View key={section.id} className="mb-6">
          {/* Section Header */}
          <View className="px-4 py-2">
            <ThemedText
              className="text-lg font-bold"
              style={{ color: textColor }}
            >
              {section.title}
            </ThemedText>
          </View>

          {/* Section Items */}
          <View
            className="rounded-xl overflow-hidden"
            style={{ backgroundColor }}
          >
            {section.items.map((item, itemIndex) => (
              <SettingItemRow key={item.id} item={item} onPress={onItemPress} />
            ))}
          </View>
        </View>
      ))}
    </View>
  );
}
