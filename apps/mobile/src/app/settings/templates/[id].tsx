import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';
import { Alert, Pressable, ScrollView, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { ModalHeader } from '~/features/settings';
import { useStoryTemplates } from '~/features/story-templates';
import { ENABLED_LANGUAGES, type Language } from '~/features/storytellers';
import { FlatButton } from '~/shared/components/core/flat-button';
import { ThemedText } from '~/shared/components/themed-text';
import { useThemeColor } from '~/shared/hooks/use-theme-color';
import { cn } from '~/shared/lib/cn';

const LANGUAGE_LABELS: Record<Language, string> = {
  pt: 'Português',
  en: 'English',
  fr: 'Français',
  it: 'Italiano',
};

export default function TemplateEditorScreen() {
  const backgroundColor = useThemeColor({}, 'background');
  const { id } = useLocalSearchParams<{ id: string }>();
  const isNew = id === 'new';

  const { templates, create, update, isLoading } = useStoryTemplates();
  const existing = useMemo(
    () => (isNew ? null : (templates.find((t) => t.id === id) ?? null)),
    [isNew, templates, id],
  );

  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [theme, setTheme] = useState('');
  const [language, setLanguage] = useState<Language | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    if (existing) {
      setTitle(existing.title);
      setDescription(existing.description ?? '');
      setTheme(existing.theme);
      setLanguage(existing.language);
    }
  }, [existing]);

  // Block editing of public templates if the user somehow lands here.
  const isReadOnly = existing !== null && !existing.isOwned;

  const handleClose = () => router.back();

  const handleSave = async () => {
    if (isReadOnly) return;
    const trimmedTitle = title.trim();
    const trimmedTheme = theme.trim();
    if (!trimmedTitle) {
      Alert.alert('Missing title', 'Give your template a short title.');
      return;
    }
    if (!trimmedTheme) {
      Alert.alert(
        'Missing prompt',
        'The prompt body is what the AI reads — add some text.',
      );
      return;
    }

    setIsSaving(true);
    try {
      if (isNew) {
        await create({
          title: trimmedTitle,
          description: description.trim() || undefined,
          theme: trimmedTheme,
          language: language ?? undefined,
        });
      } else if (id) {
        await update(id, {
          title: trimmedTitle,
          description: description.trim(),
          theme: trimmedTheme,
          language,
        });
      }
      router.back();
    } catch (e) {
      Alert.alert('Failed', e instanceof Error ? e.message : 'Save failed.');
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <SafeAreaView className="flex-1" style={{ backgroundColor }}>
      <ModalHeader
        title={isNew ? '＋ New template' : '✏️ Edit template'}
        onClose={handleClose}
      />

      <ScrollView
        className="flex-1 p-5"
        contentContainerClassName="pb-12 gap-4"
      >
        {isReadOnly && (
          <View className="bg-purple-50 border border-purple-200 rounded-xl px-3 py-2">
            <ThemedText className="text-xs text-purple-900">
              This is a public template. It can be viewed but not edited.
            </ThemedText>
          </View>
        )}

        <Field label="Title">
          <TextInput
            value={title}
            onChangeText={setTitle}
            editable={!isReadOnly}
            placeholder="e.g. Underwater Adventure"
            placeholderTextColor="#9ca3af"
            className="bg-gray-100 rounded-xl px-4 py-3 text-base text-black"
            maxLength={80}
          />
        </Field>

        <Field
          label="Description (optional)"
          hint="One-line hook shown in the wizard list."
        >
          <TextInput
            value={description}
            onChangeText={setDescription}
            editable={!isReadOnly}
            placeholder="e.g. A journey beneath the waves."
            placeholderTextColor="#9ca3af"
            className="bg-gray-100 rounded-xl px-4 py-3 text-base text-black"
            maxLength={200}
          />
        </Field>

        <Field
          label="Language (optional)"
          hint="Restrict the template to a specific language, or leave any."
        >
          <View className="flex-row flex-wrap gap-2">
            <Pill
              label="Any"
              selected={language === null}
              disabled={isReadOnly}
              onPress={() => setLanguage(null)}
            />
            {ENABLED_LANGUAGES.map((lang) => (
              <Pill
                key={lang}
                label={LANGUAGE_LABELS[lang]}
                selected={language === lang}
                disabled={isReadOnly}
                onPress={() => setLanguage(lang)}
              />
            ))}
          </View>
        </Field>

        <Field
          label="Prompt"
          hint="The full text the AI reads. Include cenários, personagens, itens e possíveis temas pra dar contexto."
        >
          <TextInput
            value={theme}
            onChangeText={setTheme}
            editable={!isReadOnly}
            placeholder="Describe the world, possible characters, items, themes…"
            placeholderTextColor="#9ca3af"
            multiline
            className="bg-gray-100 rounded-xl px-4 py-3 text-base text-black"
            style={{ minHeight: 200, textAlignVertical: 'top' }}
            maxLength={4000}
          />
        </Field>

        {!isReadOnly && (
          <View className="mt-4">
            <FlatButton
              size="lg"
              className="bg-black"
              isDisabled={isSaving || isLoading}
              onPress={handleSave}
            >
              <ThemedText className="text-base font-semibold text-white">
                {isSaving
                  ? 'Saving…'
                  : isNew
                    ? 'Create template'
                    : 'Save changes'}
              </ThemedText>
            </FlatButton>
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

function Field({
  label,
  hint,
  children,
}: {
  label: string;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <View>
      <ThemedText className="text-xs uppercase tracking-wider text-gray-500 mb-1">
        {label}
      </ThemedText>
      {hint && (
        <ThemedText className="text-xs text-gray-400 mb-2">{hint}</ThemedText>
      )}
      {children}
    </View>
  );
}

function Pill({
  label,
  selected,
  disabled,
  onPress,
}: {
  label: string;
  selected: boolean;
  disabled?: boolean;
  onPress: () => void;
}) {
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      className={cn(
        'px-4 py-2 rounded-full border',
        selected ? 'bg-black border-black' : 'bg-white border-gray-300',
        disabled && 'opacity-50',
      )}
    >
      <ThemedText
        className={cn(
          'text-sm font-semibold',
          selected ? 'text-white' : 'text-black',
        )}
      >
        {label}
      </ThemedText>
    </Pressable>
  );
}
