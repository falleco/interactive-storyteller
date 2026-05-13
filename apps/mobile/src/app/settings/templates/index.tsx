import { router } from 'expo-router';
import { Alert, FlatList, Pressable, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { ModalHeader } from '~/features/settings';
import {
  type StoryTemplate,
  useStoryTemplates,
} from '~/features/story-templates';
import { FlatButton } from '~/shared/components/core/flat-button';
import { ThemedText } from '~/shared/components/themed-text';
import { useAuth } from '~/shared/hooks/use-auth';
import { useThemeColor } from '~/shared/hooks/use-theme-color';
import { cn } from '~/shared/lib/cn';

export default function StoryTemplatesListScreen() {
  const backgroundColor = useThemeColor({}, 'background');
  const { user } = useAuth();
  const { templates, isLoading, error, refresh, remove } = useStoryTemplates();

  const handleClose = () => router.back();
  const handleAdd = () => router.push('/settings/templates/new');
  const handleEdit = (template: StoryTemplate) => {
    if (!template.isOwned) {
      Alert.alert(
        'Read-only',
        'Public templates can only be viewed. Add a new template to write your own.',
      );
      return;
    }
    router.push(`/settings/templates/${template.id}`);
  };

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

  if (!user) {
    return (
      <SafeAreaView className="flex-1" style={{ backgroundColor }}>
        <ModalHeader title="📝 Templates" onClose={handleClose} />
        <View className="flex-1 items-center justify-center px-6">
          <ThemedText className="text-base text-gray-500 text-center">
            Sign in to manage templates.
          </ThemedText>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView className="flex-1" style={{ backgroundColor }}>
      <ModalHeader title="📝 Templates" onClose={handleClose} />

      <FlatList
        className="flex-1"
        contentContainerClassName="p-5 pb-32 gap-3"
        data={templates}
        keyExtractor={(t) => t.id}
        refreshing={isLoading}
        onRefresh={refresh}
        ListEmptyComponent={
          !isLoading ? (
            <View className="items-center mt-12 px-6">
              <ThemedText className="text-base text-gray-500 text-center">
                {error
                  ? `Couldn't load templates: ${error.message}`
                  : 'No templates yet. Tap "+ New template" to add one.'}
              </ThemedText>
            </View>
          ) : null
        }
        renderItem={({ item }) => (
          <TemplateRow
            template={item}
            onPress={() => handleEdit(item)}
            onLongPress={item.isOwned ? () => handleDelete(item) : undefined}
          />
        )}
      />

      <View className="absolute bottom-10 left-0 right-0 px-6">
        <FlatButton size="lg" className="bg-black" onPress={handleAdd}>
          <ThemedText className="text-base font-semibold text-white">
            ＋ New template
          </ThemedText>
        </FlatButton>
      </View>
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
      className={cn(
        'p-3 rounded-2xl border',
        template.isOwned
          ? 'bg-white border-gray-200'
          : 'bg-gray-50 border-gray-200',
      )}
    >
      <View className="flex-row items-center gap-2">
        <ThemedText className="text-sm font-bold text-black flex-1">
          {template.title}
        </ThemedText>
        <View
          className={cn(
            'px-2 py-0.5 rounded-full',
            template.isOwned ? 'bg-gray-100' : 'bg-purple-100',
          )}
        >
          <ThemedText
            className={cn(
              'text-[10px] font-semibold',
              template.isOwned ? 'text-gray-700' : 'text-purple-900',
            )}
          >
            {template.isOwned ? 'MINE' : 'PUBLIC'}
          </ThemedText>
        </View>
      </View>
      {template.description ? (
        <ThemedText numberOfLines={2} className="text-xs text-gray-600 mt-1">
          {template.description}
        </ThemedText>
      ) : null}
      {template.language ? (
        <ThemedText className="text-[10px] uppercase tracking-wider text-gray-400 mt-1">
          {template.language}
        </ThemedText>
      ) : null}
    </Pressable>
  );
}
