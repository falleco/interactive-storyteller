import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import { router, useFocusEffect } from 'expo-router';
import { useCallback, useMemo, useState } from 'react';
import { Alert, FlatList, Pressable, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import {
  type StoryTemplate,
  useStoryTemplates,
} from '~/features/story-templates';
import { ScreenHeader } from '~/shared/components/core/screen-header';
import { ThemedText } from '~/shared/components/themed-text';
import { useAuth } from '~/shared/hooks/use-auth';
import { useThemeColor } from '~/shared/hooks/use-theme-color';

export default function StoryTemplatesListScreen() {
  const backgroundColor = useThemeColor({}, 'background');
  const iconColor = useThemeColor({}, 'text');
  const { user } = useAuth();
  const { templates, isLoading, error, refresh, remove } = useStoryTemplates();

  // Only the user's own templates show up here — public templates are
  // surfaced via the wonder-sheet wizard. Managing public ones isn't a
  // user-facing concern on this screen.
  const ownedTemplates = useMemo(
    () => templates.filter((t) => t.isOwned),
    [templates],
  );

  // Editor screen mounts a separate useStoryTemplates instance, so its
  // create/update doesn't reach this list's state. Refetch on focus.
  useFocusEffect(
    useCallback(() => {
      refresh();
    }, [refresh]),
  );

  // Separate state for the pull-to-refresh spinner — `isLoading` from
  // the hook also lights up on focus refetches, and on iOS the native
  // `UIRefreshControl` gets stuck visible when it flips true → false
  // without an actual pull gesture. Same pattern as Library / Family.
  const [isPullRefreshing, setIsPullRefreshing] = useState(false);
  const handlePullRefresh = useCallback(async () => {
    setIsPullRefreshing(true);
    try {
      await refresh();
    } finally {
      setIsPullRefreshing(false);
    }
  }, [refresh]);

  const handleClose = () => router.back();
  const handleAdd = () => router.push('/settings/templates/new');
  const handleEdit = (template: StoryTemplate) =>
    router.push(`/settings/templates/${template.id}`);

  const handleDelete = (template: StoryTemplate) => {
    Alert.alert(
      'Delete template',
      `Remove "${template.title}"? This cannot be undone.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            try {
              await remove(template.id);
            } catch (e) {
              Alert.alert(
                'Failed',
                e instanceof Error ? e.message : 'Could not delete',
              );
            }
          },
        },
      ],
    );
  };

  // SafeAreaView edges excluding `top` — `<ScreenHeader>` already
  // factors in `insets.top`, so letting the SafeAreaView also add a
  // top inset double-pads the header and leaves a big empty strip.
  const safeEdges = ['left', 'right', 'bottom'] as const;

  const addButton = (
    <Pressable
      onPress={handleAdd}
      accessibilityRole="button"
      accessibilityLabel="New template"
      hitSlop={12}
      className="w-11 h-11 rounded-full bg-black/10 dark:bg-white/10 items-center justify-center"
    >
      <MaterialCommunityIcons name="plus" size={22} color={iconColor} />
    </Pressable>
  );

  if (!user) {
    return (
      <SafeAreaView
        className="flex-1"
        edges={safeEdges}
        style={{ backgroundColor }}
      >
        <ScreenHeader title="Templates" onBack={handleClose} />
        <View className="flex-1 items-center justify-center px-6">
          <ThemedText className="text-base text-gray-500 dark:text-zinc-400 text-center">
            Sign in to manage templates.
          </ThemedText>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView
      className="flex-1"
      edges={safeEdges}
      style={{ backgroundColor }}
    >
      <ScreenHeader title="Templates" onBack={handleClose} right={addButton} />

      <FlatList
        className="flex-1"
        contentContainerClassName="p-5 pb-12 gap-3"
        data={ownedTemplates}
        keyExtractor={(t) => t.id}
        refreshing={isPullRefreshing}
        onRefresh={handlePullRefresh}
        ListEmptyComponent={
          !isLoading ? (
            <View className="items-center mt-16 px-8 gap-2">
              <ThemedText className="text-5xl mb-2">📝</ThemedText>
              <ThemedText className="text-lg font-black text-black dark:text-white text-center">
                {error ? "Couldn't load templates" : 'No templates yet'}
              </ThemedText>
              <ThemedText className="text-sm text-gray-500 dark:text-zinc-400 text-center">
                {error
                  ? error.message
                  : "Save the kind of stories you want to keep telling — tap + above and you'll see them here next time you create an adventure."}
              </ThemedText>
            </View>
          ) : null
        }
        renderItem={({ item }) => (
          <TemplateRow
            template={item}
            onPress={() => handleEdit(item)}
            onLongPress={() => handleDelete(item)}
          />
        )}
      />
    </SafeAreaView>
  );
}

function TemplateRow({
  template,
  onPress,
  onLongPress,
}: {
  template: StoryTemplate;
  onPress: () => void;
  onLongPress?: () => void;
}) {
  return (
    <Pressable
      onPress={onPress}
      onLongPress={onLongPress}
      className="p-3 rounded-2xl bg-white dark:bg-zinc-900 border border-gray-200 dark:border-zinc-700"
    >
      <ThemedText className="text-sm font-bold text-black dark:text-white">
        {template.title}
      </ThemedText>
      {template.language ? (
        <ThemedText className="text-[10px] uppercase tracking-wider text-gray-400 dark:text-zinc-500 mt-1">
          {template.language}
        </ThemedText>
      ) : null}
    </Pressable>
  );
}
