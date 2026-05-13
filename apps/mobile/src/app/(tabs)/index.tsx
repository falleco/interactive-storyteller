import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import { Image } from 'expo-image';
import { type Href, router, useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';
import { Alert, FlatList, Pressable, View } from 'react-native';
import {
  SafeAreaView,
  useSafeAreaInsets,
} from 'react-native-safe-area-context';
import { type BookSummary, useBooks } from '~/features/books';
import { useParent } from '~/features/parent';
import { Sidebar, type SidebarItem } from '~/shared/components/core/sidebar';
import { ThemedText } from '~/shared/components/themed-text';
import { useAuth } from '~/shared/hooks/use-auth';
import { useThemeColor } from '~/shared/hooks/use-theme-color';
import { useThemeMode } from '~/shared/hooks/use-theme-mode';
import { cn } from '~/shared/lib/cn';

export default function HomeTab() {
  const backgroundColor = useThemeColor({}, 'background');
  const { user } = useAuth();
  const { books, isLoading, error, refresh, remove } = useBooks();
  const { parent, refresh: refreshParent } = useParent();
  const { effective: themeMode, toggle: toggleTheme } = useThemeMode();

  const insets = useSafeAreaInsets();
  const [sidebarOpen, setSidebarOpen] = useState(false);

  // Refetch on focus — the wizard modal mounts its own useBooks instance, so
  // the create there doesn't reach this tab's state once we return.
  useFocusEffect(
    useCallback(() => {
      refresh();
      refreshParent();
    }, [refresh, refreshParent]),
  );

  const handleOpenBook = (id: string) => router.push(`/book/${id}` as Href);

  const sidebarItems: SidebarItem[] = [
    {
      id: 'templates',
      label: 'Story templates',
      icon: 'note-edit-outline',
      onPress: () => router.push('/settings/templates' as Href),
    },
    {
      id: 'settings',
      label: 'Settings',
      icon: 'cog-outline',
      onPress: () => router.push('/settings' as Href),
    },
  ];

  const avatarUri = parent?.profileImageUrl ?? parent?.image ?? null;
  const avatarInitial = (parent?.name || user?.name || '?')
    .charAt(0)
    .toUpperCase();

  const handleDeleteBook = (id: string, title: string) => {
    Alert.alert('Delete story', `Remove "${title}"? This cannot be undone.`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          try {
            await remove(id);
          } catch (e) {
            Alert.alert(
              'Failed',
              e instanceof Error ? e.message : 'Could not delete',
            );
          }
        },
      },
    ]);
  };

  return (
    <SafeAreaView className="flex-1" style={{ backgroundColor }}>
      <View className="flex-row items-center gap-3 px-5 pt-2 pb-1">
        <Pressable
          onPress={() => setSidebarOpen(true)}
          accessibilityRole="button"
          accessibilityLabel="Open menu"
          hitSlop={8}
        >
          {avatarUri ? (
            <Image
              source={{ uri: avatarUri }}
              style={{ width: 40, height: 40, borderRadius: 20 }}
              contentFit="cover"
            />
          ) : (
            <View className="w-10 h-10 rounded-full bg-purple-200 items-center justify-center">
              <ThemedText className="text-base font-black text-purple-900">
                {avatarInitial}
              </ThemedText>
            </View>
          )}
        </Pressable>
        <ThemedText className="text-2xl font-black text-black dark:text-white">
          Wonder Tales
        </ThemedText>
      </View>

      {!user ? (
        <View className="flex-1 items-center justify-center px-6">
          <ThemedText className="text-base text-gray-500 dark:text-zinc-400 text-center">
            Sign in from the Settings tab to start creating stories.
          </ThemedText>
        </View>
      ) : (
        <FlatList
          className="flex-1"
          contentContainerStyle={{
            paddingHorizontal: 20,
            // Breathe between the header title and the first row of cards
            // so the list doesn't read as glued to the navbar.
            paddingTop: 20,
            paddingBottom: insets.bottom + 220,
          }}
          data={books}
          keyExtractor={(b) => b.id}
          refreshing={isLoading}
          onRefresh={refresh}
          numColumns={2}
          columnWrapperStyle={{ gap: 12 }}
          ItemSeparatorComponent={() => <View style={{ height: 12 }} />}
          ListEmptyComponent={
            !isLoading ? (
              <View className="items-center mt-16 px-6">
                <ThemedText className="text-base text-gray-500 dark:text-zinc-400 text-center">
                  {error
                    ? `Couldn't load: ${error.message}`
                    : 'No stories yet. Tap the purple + button to start.'}
                </ThemedText>
              </View>
            ) : null
          }
          renderItem={({ item }) => (
            <BookCard
              book={item}
              onPress={() => handleOpenBook(item.id)}
              onLongPress={() => handleDeleteBook(item.id, item.title)}
            />
          )}
        />
      )}

      <Sidebar
        visible={sidebarOpen}
        onClose={() => setSidebarOpen(false)}
        side="left"
        items={sidebarItems}
        header={
          <View className="flex-row items-center gap-3">
            {avatarUri ? (
              <Image
                source={{ uri: avatarUri }}
                style={{ width: 56, height: 56, borderRadius: 28 }}
                contentFit="cover"
              />
            ) : (
              <View className="w-14 h-14 rounded-full bg-purple-200 items-center justify-center">
                <ThemedText className="text-xl font-black text-purple-900">
                  {avatarInitial}
                </ThemedText>
              </View>
            )}
            <View className="flex-1">
              <ThemedText
                numberOfLines={1}
                className="text-lg font-black text-black dark:text-white"
              >
                {parent?.name || user?.name || 'Hey there!'}
              </ThemedText>
            </View>
            <Pressable
              onPress={toggleTheme}
              accessibilityRole="button"
              accessibilityLabel={
                themeMode === 'dark'
                  ? 'Switch to light mode'
                  : 'Switch to dark mode'
              }
              hitSlop={8}
              className="w-10 h-10 rounded-full items-center justify-center bg-gray-100 dark:bg-zinc-800"
            >
              <MaterialCommunityIcons
                name={themeMode === 'dark' ? 'weather-sunny' : 'weather-night'}
                size={20}
                color={themeMode === 'dark' ? '#facc15' : '#1e293b'}
              />
            </Pressable>
          </View>
        }
      />
    </SafeAreaView>
  );
}

function BookCard({
  book,
  onPress,
  onLongPress,
}: {
  book: BookSummary;
  onPress: () => void;
  onLongPress?: () => void;
}) {
  return (
    <Pressable
      onPress={onPress}
      onLongPress={onLongPress}
      className="flex-1 bg-white dark:bg-zinc-900 rounded-2xl border border-gray-200 dark:border-zinc-700 p-2"
    >
      {book.coverImageUrl ? (
        <Image
          source={{ uri: book.coverImageUrl }}
          style={{ width: '100%', aspectRatio: 1, borderRadius: 12 }}
          contentFit="cover"
        />
      ) : (
        <View className="w-full aspect-square bg-gray-100 dark:bg-zinc-800 rounded-xl items-center justify-center">
          <ThemedText className="text-2xl">📖</ThemedText>
        </View>
      )}
      <ThemedText
        numberOfLines={2}
        className="text-sm font-bold text-black dark:text-white mt-2"
      >
        {book.title}
      </ThemedText>
      <View
        className={cn(
          'mt-1 self-start px-2 py-0.5 rounded-full',
          book.status === 'ready'
            ? 'bg-emerald-100'
            : book.status === 'generating'
              ? 'bg-amber-100'
              : book.status === 'failed'
                ? 'bg-red-100'
                : 'bg-gray-100',
        )}
      >
        <ThemedText
          className={cn(
            'text-[10px] font-semibold',
            book.status === 'ready'
              ? 'text-emerald-900'
              : book.status === 'generating'
                ? 'text-amber-900'
                : book.status === 'failed'
                  ? 'text-red-900'
                  : 'text-gray-700',
          )}
        >
          {book.status === 'ready'
            ? 'READY'
            : book.status === 'generating'
              ? 'GENERATING'
              : book.status.toUpperCase()}
        </ThemedText>
      </View>
    </Pressable>
  );
}
