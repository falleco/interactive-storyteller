export enum SettingActionType {
  NAVIGATION = 'navigation',
  TOGGLE = 'toggle',
  SELECTION = 'selection',
  ACTION = 'action',
  EXTERNAL_LINK = 'external-link',
}

export interface SettingItem {
  id: string;
  title: string;
  subtitle?: string;
  icon: string;
  actionType: SettingActionType;
  route?: string;
  options?: { label: string; value: unknown; description?: string }[];
  currentValue?: unknown;
  onPress?: () => void;
  externalUrl?: string;
  isEnabled?: boolean;
  isDangerous?: boolean;
}

export interface SettingSection {
  id: string;
  title: string;
  items: SettingItem[];
}
