import { Image } from 'expo-image';
import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';
import { Alert, Pressable, ScrollView, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { type BookMode, useBooks } from '~/features/books';
import { useChildren } from '~/features/children';
import { ModalHeader } from '~/features/settings';
import {
  type StoryTemplate,
  useStoryTemplates,
} from '~/features/story-templates';
import {
  ENABLED_LANGUAGES,
  type Language,
  useStorytellers,
} from '~/features/storytellers';
import { FlatButton } from '~/shared/components/core/flat-button';
import { ThemedText } from '~/shared/components/themed-text';
import { useAuth } from '~/shared/hooks/use-auth';
import { useThemeColor } from '~/shared/hooks/use-theme-color';
import { cn } from '~/shared/lib/cn';

const LANGUAGE_LABELS: Record<Language, string> = {
  pt: 'Português',
  en: 'English',
  fr: 'Français',
  it: 'Italiano',
};

export default function ImagineScreen() {
  const backgroundColor = useThemeColor({}, 'background');
  const { user } = useAuth();
  const { create } = useBooks();
  const { children } = useChildren();

  const [language, setLanguage] = useState<Language>(ENABLED_LANGUAGES[0]);
  const { storytellers, isLoading: isLoadingStorytellers } =
    useStorytellers(language);
  const { templates, isLoading: isLoadingTemplates } = useStoryTemplates();

  const {
    mode: modeParam,
    templateId: templateIdParam,
    storytellerId: storytellerIdParam,
  } = useLocalSearchParams<{
    mode?: BookMode;
    templateId?: string;
    storytellerId?: string;
  }>();
  const [mode, setMode] = useState<BookMode>(modeParam ?? 'classic');
  const [storyteller, setStoryteller] = useState<string | null>(
    storytellerIdParam ?? null,
  );
  const [childProfileId, setChildProfileId] = useState<string | null>(null);
  const [theme, setTheme] = useState('');
  const [selectedTemplateId, setSelectedTemplateId] = useState<string | null>(
    templateIdParam ?? null,
  );

  // Sync deep-link params into local state when arriving from the
  // tab-bar wizard — pre-select mode/template/storyteller and adopt the
  // template's language so storytellers list lands on the right filter.
  useEffect(() => {
    if (modeParam) setMode(modeParam);
    if (storytellerIdParam) setStoryteller(storytellerIdParam);
    if (!templateIdParam) return;
    setSelectedTemplateId(templateIdParam);
    const tpl = templates.find((t) => t.id === templateIdParam);
    if (tpl?.language) setLanguage(tpl.language);
  }, [modeParam, storytellerIdParam, templateIdParam, templates]);
  const [isGenerating, setIsGenerating] = useState(false);

  const visibleTemplates = useMemo(
    () =>
      templates.filter((t) => t.language === null || t.language === language),
    [templates, language],
  );

  const publicTemplates = useMemo(
    () => visibleTemplates.filter((t) => !t.isOwned),
    [visibleTemplates],
  );
  const ownedTemplates = useMemo(
    () => visibleTemplates.filter((t) => t.isOwned),
    [visibleTemplates],
  );

  const selectedTemplate = useMemo(
    () => visibleTemplates.find((t) => t.id === selectedTemplateId) ?? null,
    [visibleTemplates, selectedTemplateId],
  );

  const handleClose = () => router.back();

  const handlePickTemplate = (template: StoryTemplate) => {
    if (selectedTemplateId === template.id) {
      // Tap again to deselect.
      setSelectedTemplateId(null);
      return;
    }
    setSelectedTemplateId(template.id);
    if (template.language) {
      setLanguage(template.language);
      setStoryteller(null);
    }
  };

  const handleGenerate = async () => {
    if (!storyteller) {
      Alert.alert('Pick a storyteller', 'Choose a voice for your story.');
      return;
    }
    setIsGenerating(true);
    try {
      const created = await create({
        mode,
        language,
        storyteller,
        templateId: selectedTemplateId ?? undefined,
        // Free-form theme is only sent when no template is selected — the
        // server ignores `theme` if `templateId` is present, but we still
        // avoid posting stale text for clarity.
        theme: selectedTemplateId ? undefined : theme.trim() || undefined,
        childProfileId: childProfileId ?? undefined,
      });
      router.replace(`/book/${created.id}`);
    } catch (e) {
      Alert.alert(
        'Generation failed',
        e instanceof Error ? e.message : 'Unknown error',
      );
    } finally {
      setIsGenerating(false);
    }
  };

  if (!user) {
    return (
      <SafeAreaView className="flex-1" style={{ backgroundColor }}>
        <ModalHeader title="✨ New story" onClose={handleClose} />
        <View className="flex-1 items-center justify-center px-6">
          <ThemedText className="text-base text-gray-500 dark:text-zinc-400 text-center">
            Sign in to start creating stories.
          </ThemedText>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView className="flex-1" style={{ backgroundColor }}>
      <ModalHeader title="✨ New story" onClose={handleClose} />

      <ScrollView
        className="flex-1"
        contentContainerClassName="p-5 pb-32 gap-6"
      >
        <Section
          title="Mode"
          hint="Classic stories play start-to-finish. Interactive stories let you pick what happens next."
        >
          <View className="flex-row gap-2">
            <Pill
              label="📖 Classic"
              selected={mode === 'classic'}
              onPress={() => setMode('classic')}
            />
            <Pill
              label="🎮 Interactive"
              selected={mode === 'interactive'}
              onPress={() => setMode('interactive')}
            />
          </View>
        </Section>

        <Section title="Language">
          <View className="flex-row gap-2">
            {ENABLED_LANGUAGES.map((lang) => (
              <Pill
                key={lang}
                label={LANGUAGE_LABELS[lang]}
                selected={language === lang}
                onPress={() => {
                  setLanguage(lang);
                  setStoryteller(null);
                }}
              />
            ))}
          </View>
        </Section>

        <Section
          title="Template (optional)"
          hint="Start from a ready-made idea, or skip to write your own."
        >
          {isLoadingTemplates ? (
            <ThemedText className="text-sm text-gray-500 dark:text-zinc-400">
              Loading…
            </ThemedText>
          ) : visibleTemplates.length === 0 ? (
            <ThemedText className="text-sm text-gray-500 dark:text-zinc-400">
              No templates yet for this language.
            </ThemedText>
          ) : (
            <View className="gap-3">
              {publicTemplates.length > 0 && (
                <ScrollView
                  horizontal
                  showsHorizontalScrollIndicator={false}
                  contentContainerStyle={{ gap: 12, paddingRight: 4 }}
                >
                  {publicTemplates.map((tpl) => (
                    <PublicTemplateCard
                      key={tpl.id}
                      template={tpl}
                      selected={selectedTemplateId === tpl.id}
                      onPress={() => handlePickTemplate(tpl)}
                    />
                  ))}
                </ScrollView>
              )}

              {ownedTemplates.length > 0 && (
                <View className="gap-2">
                  {ownedTemplates.map((tpl) => (
                    <OwnedTemplateCard
                      key={tpl.id}
                      template={tpl}
                      selected={selectedTemplateId === tpl.id}
                      onPress={() => handlePickTemplate(tpl)}
                    />
                  ))}
                </View>
              )}
            </View>
          )}
        </Section>

        <Section title="Storyteller">
          {isLoadingStorytellers ? (
            <ThemedText className="text-sm text-gray-500 dark:text-zinc-400">
              Loading…
            </ThemedText>
          ) : storytellers.length === 0 ? (
            <ThemedText className="text-sm text-gray-500 dark:text-zinc-400">
              No storytellers available for this language.
            </ThemedText>
          ) : (
            <View className="flex-row flex-wrap gap-2">
              {storytellers.map((s) => (
                <StorytellerCard
                  key={s.id}
                  name={s.name}
                  imageUrl={s.imageUrl}
                  selected={storyteller === s.identifier}
                  onPress={() => setStoryteller(s.identifier)}
                />
              ))}
            </View>
          )}
        </Section>

        <Section
          title="Child (optional)"
          hint="Pick a child to make them the main character."
        >
          <View className="flex-row flex-wrap gap-2">
            <Pill
              label="No child"
              selected={childProfileId === null}
              onPress={() => setChildProfileId(null)}
            />
            {children.map((c) => (
              <Pill
                key={c.id}
                label={c.name}
                selected={childProfileId === c.id}
                onPress={() => setChildProfileId(c.id)}
              />
            ))}
          </View>
        </Section>

        {!selectedTemplate && (
          <Section
            title="Theme (optional)"
            hint="Leave empty and we'll surprise you, or manage templates in Settings."
          >
            <TextInput
              value={theme}
              onChangeText={setTheme}
              placeholder="e.g. a curious turtle who learns to surf"
              placeholderTextColor="#9ca3af"
              multiline
              numberOfLines={3}
              className="bg-gray-100 dark:bg-zinc-800 rounded-xl px-4 py-3 text-base text-black dark:text-white"
              style={{ minHeight: 80, textAlignVertical: 'top' }}
              maxLength={4000}
            />
          </Section>
        )}

        <FlatButton
          size="lg"
          className="bg-black mt-4"
          onPress={handleGenerate}
          isDisabled={isGenerating || !storyteller}
        >
          <ThemedText className="text-base font-semibold text-white">
            {isGenerating ? 'Generating…' : '✨ Generate'}
          </ThemedText>
        </FlatButton>
      </ScrollView>
    </SafeAreaView>
  );
}

function Section({
  title,
  hint,
  children,
}: {
  title: string;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <View>
      <ThemedText className="text-xs uppercase tracking-wider text-gray-500 dark:text-zinc-400 mb-1">
        {title}
      </ThemedText>
      {hint && (
        <ThemedText className="text-xs text-gray-400 dark:text-zinc-500 mb-2">
          {hint}
        </ThemedText>
      )}
      {children}
    </View>
  );
}

function Pill({
  label,
  selected,
  onPress,
}: {
  label: string;
  selected: boolean;
  onPress: () => void;
}) {
  return (
    <Pressable
      onPress={onPress}
      className={cn(
        'px-4 py-2 rounded-full border',
        selected
          ? 'bg-black border-black'
          : 'bg-white dark:bg-zinc-900 border-gray-300 dark:border-zinc-600',
      )}
    >
      <ThemedText
        className={cn(
          'text-sm font-semibold',
          selected ? 'text-white' : 'text-black dark:text-white',
        )}
      >
        {label}
      </ThemedText>
    </Pressable>
  );
}

/**
 * Compact tile for curated/public templates. Renders the cover image (or a
 * gradient placeholder until images are curated) with the title overlaid.
 */
function PublicTemplateCard({
  template,
  selected,
  onPress,
}: {
  template: StoryTemplate;
  selected: boolean;
  onPress: () => void;
}) {
  return (
    <Pressable
      onPress={onPress}
      className={cn(
        'w-40 aspect-[3/4] rounded-2xl overflow-hidden border',
        selected ? 'border-purple-600' : 'border-gray-200',
      )}
    >
      {template.coverImageUrl ? (
        <Image
          source={{ uri: template.coverImageUrl }}
          style={{ width: '100%', height: '100%' }}
          contentFit="cover"
        />
      ) : (
        <View className="flex-1 bg-purple-200 items-center justify-center" />
      )}
      <View className="absolute inset-x-0 bottom-0 px-3 py-2 bg-black/55">
        <ThemedText numberOfLines={2} className="text-sm font-bold text-white">
          {template.title}
        </ThemedText>
      </View>
    </Pressable>
  );
}

/**
 * User-owned templates — title + the saved description so users can pick the
 * right one without reading the whole prompt. Edits/deletes happen on the
 * `/settings/templates` screen.
 */
function OwnedTemplateCard({
  template,
  selected,
  onPress,
}: {
  template: StoryTemplate;
  selected: boolean;
  onPress: () => void;
}) {
  return (
    <Pressable
      onPress={onPress}
      className={cn(
        'p-3 rounded-2xl border',
        selected
          ? 'bg-purple-50 dark:bg-purple-950/40 border-purple-600'
          : 'bg-white dark:bg-zinc-900 border-gray-200 dark:border-zinc-700',
      )}
    >
      <View className="flex-row items-center gap-2">
        <ThemedText className="text-sm font-bold text-black dark:text-white flex-1">
          {template.title}
        </ThemedText>
        <View className="px-2 py-0.5 rounded-full bg-gray-100">
          <ThemedText className="text-[10px] font-semibold text-gray-700 dark:text-zinc-300">
            MINE
          </ThemedText>
        </View>
      </View>
    </Pressable>
  );
}

function StorytellerCard({
  name,
  imageUrl,
  selected,
  onPress,
}: {
  name: string;
  imageUrl: string;
  selected: boolean;
  onPress: () => void;
}) {
  return (
    <Pressable
      onPress={onPress}
      className={cn(
        'w-24 items-center p-2 rounded-2xl border',
        selected
          ? 'bg-purple-100 dark:bg-purple-900/40 border-purple-600'
          : 'bg-white dark:bg-zinc-900 border-gray-200 dark:border-zinc-700',
      )}
    >
      <View className="w-16 h-16 rounded-full bg-gray-100 dark:bg-zinc-800 items-center justify-center mb-1 overflow-hidden">
        {imageUrl ? (
          <Image
            source={{ uri: imageUrl }}
            style={{ width: 64, height: 64 }}
            contentFit="cover"
          />
        ) : (
          <ThemedText className="text-2xl">🎙️</ThemedText>
        )}
      </View>
      <ThemedText className="text-xs font-semibold text-black dark:text-white text-center">
        {name}
      </ThemedText>
    </Pressable>
  );
}
