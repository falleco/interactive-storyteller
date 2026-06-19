import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import { Image } from 'expo-image';
import { type Href, router, useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';
import { FlatList, Pressable, View } from 'react-native';
import {
  SafeAreaView,
  useSafeAreaInsets,
} from 'react-native-safe-area-context';
import { type BookSummary, useBooks } from '~/features/books';
import { useParent } from '~/features/parent';
import type { SidebarItem } from '~/shared/components/core/sidebar';
import { useSidebar } from '~/shared/components/core/sidebar-host';
import { ThemedText } from '~/shared/components/themed-text';
import { useAuth } from '~/shared/hooks/use-auth';
import { useThemeColor } from '~/shared/hooks/use-theme-color';
import { useColorSchemeContext } from '~/shared/theme/color-scheme-context';

export default function HomeTab() {
  const backgroundColor = useThemeColor({}, 'background');
  const { user } = useAuth();
  const { books, isLoading, error, refresh } = useBooks();
  const { parent, refresh: refreshParent } = useParent();
  const { open: openSidebar } = useSidebar();

  const insets = useSafeAreaInsets();
  // Separate state for the pull-to-refresh spinner so it only shows on
  // user-initiated pulls. Driving `refreshing` from `isLoading` would
  // also light up on focus-triggered background refetches, and on iOS
  // the native `UIRefreshControl` gets stuck visible when it flips
  // true → false without an actual pull gesture.
  const [isPullRefreshing, setIsPullRefreshing] = useState(false);

  const handlePullRefresh = useCallback(async () => {
    setIsPullRefreshing(true);
    try {
      await refresh();
    } finally {
      setIsPullRefreshing(false);
    }
  }, [refresh]);

  // Refetch on focus so newly-published catalog books appear after the app
  // returns to the tab.
  useFocusEffect(
    useCallback(() => {
      refresh();
      refreshParent();
    }, [refresh, refreshParent]),
  );

  const handleOpenBook = (id: string) => router.push(`/book/${id}` as Href);

  const sidebarItems: SidebarItem[] = [
    {
      id: 'demo',
      label: 'Demo',
      icon: 'gamepad-variant-outline',
      onPress: () => router.push('/games/demo' as Href),
    },
    {
      id: 'templates',
      label: 'Templates',
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

  const handleOpenMenu = () => {
    // Header is rendered as a component so it can hook into live theme +
    // parent state — opening the sidebar once captures a stable JSX node
    // that internally re-renders when the theme or profile changes.
    openSidebar({
      side: 'left',
      items: sidebarItems,
      header: <DrawerHeader />,
    });
  };

  return (
    <SafeAreaView className="flex-1" style={{ backgroundColor }}>
      <View className="flex-row items-center gap-3 px-5 pt-2 pb-1">
        <Pressable
          onPress={handleOpenMenu}
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
            Sign in from the Settings tab to read the story catalog.
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
          refreshing={isPullRefreshing}
          onRefresh={handlePullRefresh}
          numColumns={2}
          columnWrapperStyle={{ gap: 12 }}
          ItemSeparatorComponent={() => <View style={{ height: 12 }} />}
          ListEmptyComponent={
            !isLoading ? (
              <View className="items-center mt-16 px-6">
                <ThemedText className="text-base text-gray-500 dark:text-zinc-400 text-center">
                  {error
                    ? `Couldn't load: ${error.message}`
                    : 'No published stories are available yet.'}
                </ThemedText>
              </View>
            ) : null
          }
          renderItem={({ item }) => (
            <BookCard book={item} onPress={() => handleOpenBook(item.id)} />
          )}
        />
      )}
    </SafeAreaView>
  );
}

/**
 * Live header rendered inside the sidebar. Hooks into the parent profile
 * and the theme context so the avatar, name and sun/moon icon stay in
 * sync with state changes while the drawer is open.
 */
function DrawerHeader() {
  const { user } = useAuth();
  const { parent } = useParent();
  const { scheme: themeMode, toggle: toggleTheme } = useColorSchemeContext();

  const avatarUri = parent?.profileImageUrl ?? parent?.image ?? null;
  const avatarInitial = (parent?.name || user?.name || '?')
    .charAt(0)
    .toUpperCase();

  return (
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
        onPress={(event) => {
          // Use the touch coords as the origin of the circular reveal.
          // `pageX/pageY` are window-relative, which is what
          // `makeImageFromView` works in.
          const { pageX, pageY } = event.nativeEvent;
          toggleTheme(pageX, pageY);
        }}
        accessibilityRole="button"
        accessibilityLabel={
          themeMode === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'
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
    </Pressable>
  );
}
