import { Image } from 'expo-image';
import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';
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
  useChildren,
} from '~/features/children';
import { ModalHeader } from '~/features/settings';
import { FlatButton } from '~/shared/components/core/flat-button';
import { ThemedText } from '~/shared/components/themed-text';
import { useThemeColor } from '~/shared/hooks/use-theme-color';
import { cn } from '~/shared/lib/cn';

const AGE_MIN = 1;
const AGE_MAX = 99;
const AGE_DEFAULT = 6;

interface GenderOption {
  value: string;
  label: string;
}

const GENDER_OPTIONS: GenderOption[] = [
  { value: '', label: 'Prefer not to say' },
  { value: 'girl', label: 'Girl' },
  { value: 'boy', label: 'Boy' },
  { value: 'non-binary', label: 'Non-binary' },
  { value: 'other', label: 'Other' },
];

export default function ChildEditScreen() {
  const backgroundColor = useThemeColor({}, 'background');
  const { id } = useLocalSearchParams<{ id: string }>();
  const isNew = id === 'new';

  const { children, create, update, uploadImage, isLoading } = useChildren();
  const existing = useMemo(
    () => (isNew ? null : (children.find((c) => c.id === id) ?? null)),
    [isNew, children, id],
  );

  const [name, setName] = useState('');
  const [age, setAge] = useState<number>(AGE_DEFAULT);
  const [gender, setGender] = useState('');
  const [pickedAsset, setPickedAsset] = useState<UploadChildImageInput | null>(
    null,
  );
  const [isSaving, setIsSaving] = useState(false);
  const [touchedName, setTouchedName] = useState(false);
  const [photoSheetOpen, setPhotoSheetOpen] = useState(false);

  useEffect(() => {
    if (existing) {
      setName(existing.name);
      setAge(clampAge(existing.age));
      setGender(existing.gender ?? '');
    }
  }, [existing]);

  // Preview the freshly-picked image while it's still local; otherwise fall
  // back to the persisted URL on the child profile.
  const avatarUri = pickedAsset?.uri ?? existing?.imageUrl ?? null;

  const handleOpenPhotoSheet = () => setPhotoSheetOpen(true);
  const handleClosePhotoSheet = () => setPhotoSheetOpen(false);
  const handlePickAsset = (asset: UploadChildImageInput) => {
    setPickedAsset(asset);
  };

  const handleClose = () => router.back();

  const handleAgeText = (text: string) => {
    const digits = text.replace(/\D/g, '').slice(0, 2);
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
      const payload = {
        name: trimmedName,
        age: finalAge,
        gender: gender || undefined,
      };
      let savedId: string | null = null;
      if (isNew) {
        const created = await create(payload);
        savedId = created.id;
      } else if (id) {
        await update(id, payload);
        savedId = id;
      }
      if (savedId && pickedAsset) {
        try {
          await uploadImage(savedId, pickedAsset);
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
  const genderLabel =
    GENDER_OPTIONS.find((o) => o.value === gender)?.label ?? 'Choose…';

  return (
    <SafeAreaView className="flex-1" style={{ backgroundColor }}>
      <ModalHeader
        title={isNew ? '＋ Add child' : '✏️ Edit child'}
        onClose={handleClose}
      />

      <ScrollView
        className="flex-1 p-5"
        contentContainerClassName="pb-12 gap-5"
        keyboardShouldPersistTaps="handled"
      >
        <View className="items-center">
          <AvatarPicker
            uri={avatarUri}
            initial={(name || existing?.name || '?').charAt(0).toUpperCase()}
            onPress={handleOpenPhotoSheet}
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
            placeholder="e.g. Alice"
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
              maxLength={2}
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

        <Field label="Gender">
          <GenderSelect
            value={gender}
            label={genderLabel}
            onChange={setGender}
          />
        </Field>

        <FlatButton
          size="lg"
          className="bg-black mt-4"
          isDisabled={isSaving || isLoading}
          onPress={handleSave}
        >
          <ThemedText className="text-base font-semibold text-white">
            {isSaving ? 'Saving…' : isNew ? 'Create' : 'Save changes'}
          </ThemedText>
        </FlatButton>
      </ScrollView>

      <PhotoSourceSheet
        visible={photoSheetOpen}
        onClose={handleClosePhotoSheet}
        onPick={handlePickAsset}
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
  return (
    <Pressable
      onPress={onPress}
      accessibilityLabel="Choose profile picture"
      className="w-28 h-28 rounded-full overflow-hidden border-4 border-white bg-purple-200 dark:bg-purple-800 items-center justify-center"
      style={{
        // soft shadow so the avatar feels lifted off the sheet
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
      <View className="absolute bottom-0 right-0 w-9 h-9 rounded-full bg-black items-center justify-center border-2 border-white">
        <ThemedText className="text-white text-base">📷</ThemedText>
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

function GenderSelect({
  value,
  label,
  onChange,
}: {
  value: string;
  label: string;
  onChange: (next: string) => void;
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
              Gender
            </ThemedText>
            {GENDER_OPTIONS.map((option) => {
              const isSelected = option.value === value;
              return (
                <Pressable
                  key={option.value || 'unspecified'}
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
