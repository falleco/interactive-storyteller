import AsyncStorage from '@react-native-async-storage/async-storage';
import { useEffect, useState } from 'react';
import type { AppSettings } from '~/shared/types/music';

const APP_SETTINGS_KEY = '@staff_hero_app_settings';

const DEFAULT_APP_SETTINGS: AppSettings = {
  // Account
  username: 'Music Hero',
  isConnected: false,

  // General
  pushNotifications: {
    enabled: true,
    challenges: true,
    achievements: true,
    dailyReminders: false,
  },
  soundAndVibrations: {
    soundEffects: true,
    music: true,
    hapticFeedback: true,
    volume: 80,
  },
  graphics: {
    quality: 'high',
    animations: true,
    particleEffects: true,
    frameRate: 60,
  },
  networking: {
    autoSync: true,
    wifiOnly: false,
    backgroundSync: true,
  },
};

export interface UseAppSettingsReturn {
  /** Current app settings */
  appSettings: AppSettings;
  /** Update multiple settings at once */
  updateAppSettings: (settings: Partial<AppSettings>) => Promise<void>;
  /** Update username */
  updateUsername: (username: string) => Promise<void>;
  /** Toggle connection status */
  toggleConnection: () => Promise<void>;
  /** Update push notification settings */
  updatePushNotifications: (
    notifications: Partial<AppSettings['pushNotifications']>,
  ) => Promise<void>;
  /** Update sound and vibration settings */
  updateSoundAndVibrations: (
    sound: Partial<AppSettings['soundAndVibrations']>,
  ) => Promise<void>;
  /** Update graphics settings */
  updateGraphics: (graphics: Partial<AppSettings['graphics']>) => Promise<void>;
  /** Update networking settings */
  updateNetworking: (
    networking: Partial<AppSettings['networking']>,
  ) => Promise<void>;
  /** Reset all settings to default */
  resetAppSettings: () => Promise<void>;
}

/**
 * Custom hook for managing app-wide settings
 *
 * Handles all application settings including account, notifications, graphics,
 * sound, and networking preferences. Persists settings to AsyncStorage.
 *
 * @returns Object containing settings and update functions
 *
 * @example
 * ```tsx
 * const {
 *   appSettings,
 *   updateUsername,
 *   updateGraphics,
 *   updateSoundAndVibrations
 * } = useAppSettings();
 *
 * // Update username
 * await updateUsername('New Username');
 *
 * // Update graphics quality
 * await updateGraphics({ quality: 'high', animations: true });
 * ```
 */
export function useAppSettings(): UseAppSettingsReturn {
  const [appSettings, setAppSettings] =
    useState<AppSettings>(DEFAULT_APP_SETTINGS);

  // Load settings on mount
  useEffect(() => {
    loadAppSettings();
  }, []);

  /**
   * Loads app settings from AsyncStorage
   */
  const loadAppSettings = async () => {
    try {
      const stored = await AsyncStorage.getItem(APP_SETTINGS_KEY);
      if (stored) {
        const parsedSettings = JSON.parse(stored);
        setAppSettings({ ...DEFAULT_APP_SETTINGS, ...parsedSettings });
      }
    } catch (error) {
      console.error('Error loading app settings:', error);
    }
  };

  /**
   * Saves app settings to AsyncStorage
   */
  const saveAppSettings = async (settingsToSave: AppSettings) => {
    try {
      await AsyncStorage.setItem(
        APP_SETTINGS_KEY,
        JSON.stringify(settingsToSave),
      );
      setAppSettings(settingsToSave);
    } catch (error) {
      console.error('Error saving app settings:', error);
    }
  };

  /**
   * Updates multiple app settings at once
   */
  const updateAppSettings = async (settings: Partial<AppSettings>) => {
    const newSettings = { ...appSettings, ...settings };
    await saveAppSettings(newSettings);
  };

  /**
   * Updates username
   */
  const updateUsername = async (username: string) => {
    await updateAppSettings({ username });
  };

  /**
   * Toggles connection status
   */
  const toggleConnection = async () => {
    await updateAppSettings({ isConnected: !appSettings.isConnected });
  };

  /**
   * Updates push notification settings
   */
  const updatePushNotifications = async (
    notifications: Partial<AppSettings['pushNotifications']>,
  ) => {
    const newNotifications = {
      ...appSettings.pushNotifications,
      ...notifications,
    };
    await updateAppSettings({ pushNotifications: newNotifications });
  };

  /**
   * Updates sound and vibration settings
   */
  const updateSoundAndVibrations = async (
    sound: Partial<AppSettings['soundAndVibrations']>,
  ) => {
    const newSound = { ...appSettings.soundAndVibrations, ...sound };
    await updateAppSettings({ soundAndVibrations: newSound });
  };

  /**
   * Updates graphics settings
   */
  const updateGraphics = async (graphics: Partial<AppSettings['graphics']>) => {
    const newGraphics = { ...appSettings.graphics, ...graphics };
    await updateAppSettings({ graphics: newGraphics });
  };

  /**
   * Updates networking settings
   */
  const updateNetworking = async (
    networking: Partial<AppSettings['networking']>,
  ) => {
    const newNetworking = { ...appSettings.networking, ...networking };
    await updateAppSettings({ networking: newNetworking });
  };

  /**
   * Resets all settings to default values
   */
  const resetAppSettings = async () => {
    await saveAppSettings(DEFAULT_APP_SETTINGS);
  };

  return {
    appSettings,
    updateAppSettings,
    updateUsername,
    toggleConnection,
    updatePushNotifications,
    updateSoundAndVibrations,
    updateGraphics,
    updateNetworking,
    resetAppSettings,
  };
}
