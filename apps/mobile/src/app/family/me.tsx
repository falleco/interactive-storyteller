import { Image } from 'expo-image';
import { router } from 'expo-router';
import { useEffect, useState } from 'react';
import {
  Alert,
  Modal,
  Pressable,
  ScrollView,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import {
  PhotoSourceSheet,
  type UploadChildImageInput,
} from '~/features/children';
import {
  PARENT_ROLE_LABELS,
  PARENT_ROLES,
  type ParentRole,
  useParent,
} from '~/features/parent';
import { FlatButton } from '~/shared/components/core/flat-button';
import { CameraIcon } from '~/shared/components/icons/camera-icon';
import { ThemedText } from '~/shared/components/themed-text';
import { useThemeColor } from '~/shared/hooks/use-theme-color';
import { cn } from '~/shared/lib/cn';

const AGE_MIN = 13;
const AGE_MAX = 120;
const AGE_DEFAULT = 30;

const ROLE_OPTIONS: { value: ParentRole | ''; label: string }[] = [
  { value: '', label: 'Not specified' },
  ...PARENT_ROLES.map((role) => ({
    value: role,
    label: PARENT_ROLE_LABELS[role],
  })),
];

export default function ParentEditScreen() {
  const backgroundColor = useThemeColor({}, 'background');
  const { parent, update, uploadImage, isLoading } = useParent();

  const [name, setName] = useState('');
  const [age, setAge] = useState<number>(AGE_DEFAULT);
  const [role, setRole] = useState<ParentRole | ''>('');
  const [pickedAsset, setPickedAsset] = useState<UploadChildImageInput | null>(
    null,
  );
  const [isSaving, setIsSaving] = useState(false);
  const [touchedName, setTouchedName] = useState(false);
  const [photoSheetOpen, setPhotoSheetOpen] = useState(false);

  useEffect(() => {
    if (parent) {
      setName(parent.name);
      setAge(parent.age ? clampAge(parent.age) : AGE_DEFAULT);
      setRole(parent.parentRole ?? '');
    }
  }, [parent]);

  const avatarUri =
    pickedAsset?.uri ?? parent?.profileImageUrl ?? parent?.image ?? null;

  const handleAgeText = (text: string) => {
    const digits = text.replace(/\D/g, '').slice(0, 3);
    if (digits === '') {
      setAge(0);
      return;
    }
    setAge(clampAge(Number.parseInt(digits, 10)));
  };

  const handleSave = async () => {
    const trimmedName = name.trim();
    setTouchedName(true);
    if (!trimmedName) return;
    const finalAge = clampAge(age || AGE_DEFAULT);

    setIsSaving(true);
    try {
      await update({
        name: trimmedName,
        age: finalAge,
        parentRole: role === '' ? null : role,
      });
      if (pickedAsset) {
        try {
          await uploadImage(pickedAsset);
        } catch (uploadError) {
          Alert.alert(
            'Profile saved, picture not uploaded',
            uploadError instanceof Error
              ? uploadError.message
              : 'Could not upload the photo. You can try again later.',
          );
        }
      }
      router.back();
    } catch (e) {
      Alert.alert('Failed', e instanceof Error ? e.message : 'Save failed.');
    } finally {
      setIsSaving(false);
    }
  };

  const nameInvalid = touchedName && name.trim().length === 0;
  const roleLabel =
    ROLE_OPTIONS.find((r) => r.value === role)?.label ?? 'Choose…';

  return (
    <SafeAreaView className="flex-1" style={{ backgroundColor }}>
      <ScrollView
        className="flex-1 p-5"
        contentContainerClassName="pb-12 gap-5"
        keyboardShouldPersistTaps="handled"
      >
        <View className="items-center">
          <AvatarPicker
            uri={avatarUri}
            initial={(name || parent?.name || '?').charAt(0).toUpperCase()}
            onPress={() => setPhotoSheetOpen(true)}
          />
          <ThemedText className="text-xs text-gray-500 dark:text-zinc-400 mt-2">
            Tap to {avatarUri ? 'change' : 'add'} photo
          </ThemedText>
        </View>

        <Field
          label="Name"
          required
          error={nameInvalid ? 'Please enter a name.' : undefined}
        >
          <TextInput
            value={name}
            onChangeText={(value) => {
              setName(value);
              if (touchedName) setTouchedName(false);
            }}
            placeholder="Your name"
            placeholderTextColor="#9ca3af"
            autoCapitalize="words"
            maxLength={80}
            className={cn(
              'bg-white dark:bg-zinc-900 border rounded-xl px-4 py-3 text-base text-black dark:text-white',
              nameInvalid
                ? 'border-red-500'
                : 'border-gray-300 dark:border-zinc-700',
            )}
          />
        </Field>

        <Field label="Role">
          <RoleSelect value={role} label={roleLabel} onChange={setRole} />
        </Field>

        <Field label="Age" hint={`Between ${AGE_MIN} and ${AGE_MAX}.`}>
          <View className="flex-row items-center gap-3">
            <StepperButton
              symbol="−"
              onPress={() => setAge((v) => clampAge((v || AGE_DEFAULT) - 1))}
              disabled={age <= AGE_MIN}
            />
            <TextInput
              value={age > 0 ? String(age) : ''}
              onChangeText={handleAgeText}
              keyboardType="number-pad"
              inputMode="numeric"
              textAlign="center"
              maxLength={3}
              placeholder={String(AGE_DEFAULT)}
              placeholderTextColor="#9ca3af"
              className="flex-1 bg-white dark:bg-zinc-900 border border-gray-300 dark:border-zinc-700 rounded-xl px-4 py-3 text-xl font-bold text-black dark:text-white"
            />
            <StepperButton
              symbol="+"
              onPress={() => setAge((v) => clampAge((v || AGE_DEFAULT) + 1))}
              disabled={age >= AGE_MAX}
            />
          </View>
        </Field>

        <FlatButton
          size="lg"
          className="bg-black mt-4"
          isDisabled={isSaving || isLoading}
          onPress={handleSave}
        >
          <ThemedText className="text-base font-semibold text-white">
            {isSaving ? 'Saving…' : 'Save changes'}
          </ThemedText>
        </FlatButton>
      </ScrollView>

      <PhotoSourceSheet
        visible={photoSheetOpen}
        onClose={() => setPhotoSheetOpen(false)}
        onPick={(asset) => setPickedAsset(asset)}
      />
    </SafeAreaView>
  );
}

function clampAge(value: number): number {
  if (Number.isNaN(value)) return AGE_DEFAULT;
  return Math.min(AGE_MAX, Math.max(AGE_MIN, value));
}

function Field({
  label,
  hint,
  required,
  error,
  children,
}: {
  label: string;
  hint?: string;
  required?: boolean;
  error?: string;
  children: React.ReactNode;
}) {
  return (
    <View>
      <View className="flex-row items-baseline mb-2">
        <ThemedText className="text-xs uppercase tracking-wider text-gray-500 dark:text-zinc-400">
          {label}
        </ThemedText>
        {required && (
          <ThemedText className="text-xs text-red-500 ml-1">*</ThemedText>
        )}
      </View>
      {children}
      {error ? (
        <ThemedText className="text-xs text-red-500 mt-1">{error}</ThemedText>
      ) : hint ? (
        <ThemedText className="text-xs text-gray-400 dark:text-zinc-500 mt-1">
          {hint}
        </ThemedText>
      ) : null}
    </View>
  );
}

function AvatarPicker({
  uri,
  initial,
  onPress,
}: {
  uri: string | null;
  initial: string;
  onPress: () => void;
}) {
  // Outer Pressable kept un-rounded so the camera badge can overhang
  // the avatar's circular mask. See the matching note in the child
  // form's `AvatarPicker`.
  return (
    <Pressable
      onPress={onPress}
      accessibilityLabel="Choose profile picture"
      className="relative w-28 h-28"
    >
      <View
        className="w-28 h-28 rounded-full overflow-hidden border-4 border-white bg-purple-200 dark:bg-purple-800 items-center justify-center"
        style={{
          shadowColor: '#000',
          shadowOpacity: 0.12,
          shadowRadius: 8,
          shadowOffset: { width: 0, height: 4 },
          elevation: 4,
        }}
      >
        {uri ? (
          <Image
            source={{ uri }}
            style={{ width: '100%', height: '100%' }}
            contentFit="cover"
          />
        ) : (
          <ThemedText className="text-4xl font-black text-purple-900 dark:text-purple-200">
            {initial}
          </ThemedText>
        )}
      </View>
      <View
        className="absolute w-9 h-9 rounded-full bg-black items-center justify-center border-2 border-white"
        style={{ bottom: -2, right: -2 }}
      >
        <CameraIcon size={18} color="white" />
      </View>
    </Pressable>
  );
}

function StepperButton({
  symbol,
  onPress,
  disabled,
}: {
  symbol: string;
  onPress: () => void;
  disabled?: boolean;
}) {
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      className={cn(
        'w-12 h-12 rounded-xl items-center justify-center border',
        disabled
          ? 'border-gray-200 dark:border-zinc-700 bg-gray-50 dark:bg-zinc-800'
          : 'border-gray-300 dark:border-zinc-700 bg-white active:bg-gray-100 dark:bg-zinc-800',
      )}
    >
      <ThemedText
        className={cn(
          'text-2xl font-bold',
          disabled ? 'text-gray-300' : 'text-black dark:text-white',
        )}
      >
        {symbol}
      </ThemedText>
    </Pressable>
  );
}

function RoleSelect({
  value,
  label,
  onChange,
}: {
  value: ParentRole | '';
  label: string;
  onChange: (next: ParentRole | '') => void;
}) {
  const [open, setOpen] = useState(false);

  return (
    <>
      <Pressable
        onPress={() => setOpen(true)}
        className="flex-row items-center bg-white dark:bg-zinc-900 border border-gray-300 dark:border-zinc-700 rounded-xl px-4 py-3"
      >
        <ThemedText
          className={cn(
            'flex-1 text-base',
            value
              ? 'text-black dark:text-white'
              : 'text-gray-400 dark:text-zinc-500',
          )}
        >
          {label}
        </ThemedText>
        <ThemedText className="text-gray-400 dark:text-zinc-500 text-sm">
          ▾
        </ThemedText>
      </Pressable>

      <Modal
        visible={open}
        animationType="fade"
        transparent
        onRequestClose={() => setOpen(false)}
      >
        <Pressable
          onPress={() => setOpen(false)}
          className="flex-1 bg-black/40 justify-end"
        >
          <Pressable
            onPress={() => undefined}
            className="bg-white rounded-t-3xl pb-8"
          >
            <View className="items-center pt-3 pb-2">
              <View className="w-10 h-1.5 rounded-full bg-gray-300" />
            </View>
            <ThemedText className="text-base font-bold text-black dark:text-white text-center mt-2 mb-3">
              Role
            </ThemedText>
            {ROLE_OPTIONS.map((option) => {
              const isSelected = option.value === value;
              return (
                <Pressable
                  key={option.value || 'none'}
                  onPress={() => {
                    onChange(option.value);
                    setOpen(false);
                  }}
                  className={cn(
                    'px-6 py-4 flex-row items-center',
                    isSelected && 'bg-purple-50 dark:bg-purple-950/40',
                  )}
                >
                  <ThemedText
                    className={cn(
                      'flex-1 text-base',
                      isSelected
                        ? 'text-purple-700 dark:text-purple-300 font-semibold'
                        : 'text-black dark:text-white',
                    )}
                  >
                    {option.label}
                  </ThemedText>
                  {isSelected && (
                    <ThemedText className="text-purple-700 dark:text-purple-300 font-bold">
                      ✓
                    </ThemedText>
                  )}
                </Pressable>
              );
            })}
          </Pressable>
        </Pressable>
      </Modal>
    </>
  );
}
