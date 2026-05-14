import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import { Image } from 'expo-image';
import { type Href, router, useFocusEffect } from 'expo-router';
import { useCallback, useMemo, useState } from 'react';
import { Alert, FlatList, Pressable, View } from 'react-native';
import {
  SafeAreaView,
  useSafeAreaInsets,
} from 'react-native-safe-area-context';
import { useBooks } from '~/features/books';
import { type ChildProfile, useChildren } from '~/features/children';
import {
  PARENT_ROLE_LABELS,
  type ParentProfile,
  useParent,
} from '~/features/parent';
import type { SidebarItem } from '~/shared/components/core/sidebar';
import { useSidebar } from '~/shared/components/core/sidebar-host';
import { CrownFilledIcon } from '~/shared/components/icons/crown-filled-icon';
import { ThemedText } from '~/shared/components/themed-text';
import { useAuth } from '~/shared/hooks/use-auth';
import { useColorScheme } from '~/shared/hooks/use-color-scheme';
import { useThemeColor } from '~/shared/hooks/use-theme-color';
import { useColorSchemeContext } from '~/shared/theme/color-scheme-context';

/**
 * Rows in the FlatList are *just* children now — the parent gets its
 * own treatment via `ListHeaderComponent` so we can size it differently
 * and slot a separator before the child rows without playing tricks
 * with `ItemSeparatorComponent`.
 */

export default function FamilyTab() {
  const scheme = useColorScheme();
  const backgroundColor = useThemeColor({}, 'background');
  const { user } = useAuth();
  const { parent: parentForHeader } = useParent();
  const { open: openSidebar } = useSidebar();
  const {
    children,
    isLoading: isLoadingChildren,
    error: childrenError,
    refresh: refreshChildren,
    remove,
  } = useChildren();
  const {
    parent,
    isLoading: isLoadingParent,
    refresh: refreshParent,
  } = useParent();
  // Family-wide stats for the parent card header. Reuses the same
  // `useBooks` instance that powers the Library tab — the focus-effect
  // refresh below covers staleness when coming back from a book.
  const { books, refresh: refreshBooks } = useBooks();
  const insets = useSafeAreaInsets();

  const totalStories = books.length;
  const totalReads = useMemo(
    () => books.reduce((sum, b) => sum + (b.completedReadCount ?? 0), 0),
    [books],
  );

  const sidebarItems: SidebarItem[] = [
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

  const avatarUri =
    parentForHeader?.profileImageUrl ?? parentForHeader?.image ?? null;
  const avatarInitial = (parentForHeader?.name || user?.name || '?')
    .charAt(0)
    .toUpperCase();

  const handleOpenMenu = () => {
    openSidebar({
      side: 'left',
      items: sidebarItems,
      header: <DrawerHeader />,
    });
  };

  const handleOpenSettings = () => router.push('/settings' as Href);

  // Both lists belong to "the family"; refetch on focus so creates/edits
  // from the modals are reflected when the user returns to this tab.
  useFocusEffect(
    useCallback(() => {
      refreshChildren();
      refreshParent();
      refreshBooks();
    }, [refreshChildren, refreshParent, refreshBooks]),
  );

  // Separate state for the pull-to-refresh spinner so it only fires on
  // an actual pull gesture. Driving `refreshing` from the shared
  // `isLoading` would also light up on focus refetches, and on iOS the
  // native `UIRefreshControl` gets stuck visible when it flips
  // true → false without a pull. Same pattern as the Library tab.
  const [isPullRefreshing, setIsPullRefreshing] = useState(false);
  const handlePullRefresh = useCallback(async () => {
    setIsPullRefreshing(true);
    try {
      await Promise.all([refreshChildren(), refreshParent(), refreshBooks()]);
    } finally {
      setIsPullRefreshing(false);
    }
  }, [refreshChildren, refreshParent, refreshBooks]);

  const handleEditParent = () => router.push('/family/me');
  const handleAddChild = () => router.push('/family/child/new');
  const handleEditChild = (id: string) => router.push(`/family/child/${id}`);

  const handleDeleteChild = (id: string, name: string) => {
    Alert.alert(
      'Delete child profile',
      `Remove "${name}"? Books they appear in will keep the snapshot, but new stories can't pick them anymore.`,
      [
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
      ],
    );
  };

  const isLoading = isLoadingChildren || isLoadingParent;

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
        <ThemedText className="flex-1 text-2xl font-black text-black dark:text-white">
          My Family
        </ThemedText>
        <Pressable
          onPress={handleAddChild}
          accessibilityRole="button"
          accessibilityLabel="Add family member"
          hitSlop={8}
          className="w-10 h-10 rounded-full bg-black/10 dark:bg-white/10 items-center justify-center"
        >
          <MaterialCommunityIcons
            name="plus"
            size={22}
            color={scheme === 'dark' ? '#ffffff' : '#1f2937'}
          />
        </Pressable>
        <Pressable
          onPress={handleOpenSettings}
          accessibilityRole="button"
          accessibilityLabel="Open settings"
          hitSlop={8}
          className="w-10 h-10 rounded-full bg-black/10 dark:bg-white/10 items-center justify-center"
        >
          <MaterialCommunityIcons
            name="cog-outline"
            size={20}
            color={scheme === 'dark' ? '#ffffff' : '#1f2937'}
          />
        </Pressable>
      </View>

      {!user ? (
        <View className="flex-1 items-center justify-center px-6">
          <ThemedText className="text-base text-gray-500 dark:text-zinc-400 text-center">
            Sign in to manage your family.
          </ThemedText>
        </View>
      ) : (
        <FlatList
          className="flex-1"
          contentContainerStyle={{
            paddingHorizontal: 20,
            paddingTop: 8,
            paddingBottom: insets.bottom + 220,
            gap: 12,
          }}
          data={children}
          keyExtractor={(c) => `child-${c.id}`}
          refreshing={isPullRefreshing}
          onRefresh={handlePullRefresh}
          ListHeaderComponent={
            parent ? (
              <View className="mb-2">
                <ParentCard
                  parent={parent}
                  totalStories={totalStories}
                  totalReads={totalReads}
                  onPress={handleEditParent}
                />
                <ChildrenSectionHeader count={children.length} />
              </View>
            ) : null
          }
          ListEmptyComponent={
            !isLoading ? (
              <View className="items-center mt-4 px-6">
                <ThemedText className="text-base text-gray-500 dark:text-zinc-400 text-center">
                  {childrenError
                    ? `Couldn't load: ${childrenError.message}`
                    : 'No children added yet. Tap + above to add one.'}
                </ThemedText>
              </View>
            ) : null
          }
          renderItem={({ item }) => (
            <ChildRow
              child={item}
              onPress={() => handleEditChild(item.id)}
              onLongPress={() => handleDeleteChild(item.id, item.name)}
            />
          )}
        />
      )}
    </SafeAreaView>
  );
}

/**
 * The "boss" card at the top of the family list. Larger avatar +
 * title than child rows, a golden crown badge anchored to the avatar
 * (visually anchoring it as the main account), and a stats strip
 * with stories created + total reads underneath. Tapping anywhere
 * routes to `/family/me` for editing.
 */
function ParentCard({
  parent,
  totalStories,
  totalReads,
  onPress,
}: {
  parent: ParentProfile;
  totalStories: number;
  totalReads: number;
  onPress: () => void;
}) {
  const avatar = parent.profileImageUrl ?? parent.image;
  const roleLabel = parent.parentRole
    ? PARENT_ROLE_LABELS[parent.parentRole]
    : 'Tap to set role';
  const ageLabel = parent.age ? `${parent.age}` : null;
  const subtitle = ageLabel ? `${roleLabel} · ${ageLabel}` : roleLabel;

  return (
    <Pressable
      onPress={onPress}
      className="bg-purple-50 dark:bg-purple-950/40 border border-purple-200 dark:border-purple-800 rounded-3xl p-4"
    >
      <View className="flex-row items-center">
        {/* Avatar wrapper kept un-rounded so the crown badge can
            overhang the circular mask without being clipped — same
            pattern as the camera badge in `family/me`. */}
        <View className="relative w-20 h-20">
          {avatar ? (
            <Image
              source={{ uri: avatar }}
              style={{ width: 80, height: 80, borderRadius: 40 }}
              contentFit="cover"
            />
          ) : (
            <View className="w-20 h-20 rounded-full bg-purple-300 dark:bg-purple-700 items-center justify-center">
              <ThemedText className="text-3xl font-black text-purple-900 dark:text-purple-200">
                {(parent.name || '?').charAt(0).toUpperCase()}
              </ThemedText>
            </View>
          )}
          <View
            className="absolute w-9 h-9 rounded-full bg-amber-400 items-center justify-center border-2 border-white dark:border-purple-950"
            style={{ top: -4, right: -4 }}
          >
            <CrownFilledIcon size={18} color="black" />
          </View>
        </View>
        <View className="flex-1 ml-4">
          <ThemedText
            numberOfLines={1}
            className="text-xl font-black text-black dark:text-white"
          >
            {parent.name || 'You'}
          </ThemedText>
          <ThemedText className="text-xs text-gray-600 dark:text-zinc-400 mt-1">
            {subtitle}
          </ThemedText>
        </View>
      </View>

      <View className="flex-row mt-4 pt-4 border-t border-purple-200 dark:border-purple-800/60">
        <Stat label="Stories" value={totalStories} />
        <View className="w-px bg-purple-200 dark:bg-purple-800/60 mx-2" />
        <Stat label="Reads" value={totalReads} />
      </View>
    </Pressable>
  );
}

function Stat({ label, value }: { label: string; value: number }) {
  return (
    <View className="flex-1 items-center">
      <ThemedText className="text-2xl font-black text-purple-900 dark:text-purple-100">
        {value}
      </ThemedText>
      <ThemedText className="text-[10px] uppercase tracking-wider text-purple-700 dark:text-purple-300 mt-0.5">
        {label}
      </ThemedText>
    </View>
  );
}

/**
 * Visual break between the parent's card and the list of children,
 * with a quiet count label so the section header self-explains.
 */
function ChildrenSectionHeader({ count }: { count: number }) {
  return (
    <View className="flex-row items-center mt-5 mb-1">
      <ThemedText className="text-xs uppercase tracking-wider text-gray-500 dark:text-zinc-400">
        Children
      </ThemedText>
      <View className="flex-1 h-px bg-gray-200 dark:bg-zinc-700 ml-3" />
      {count > 0 ? (
        <ThemedText className="text-xs text-gray-500 dark:text-zinc-400 ml-3">
          {count}
        </ThemedText>
      ) : null}
    </View>
  );
}

function ChildRow({
  child,
  onPress,
  onLongPress,
}: {
  child: ChildProfile;
  onPress: () => void;
  onLongPress: () => void;
}) {
  return (
    <Pressable
      onPress={onPress}
      onLongPress={onLongPress}
      className="flex-row items-center bg-gray-100 dark:bg-zinc-800 rounded-2xl p-3"
    >
      {child.imageUrl ? (
        <Image
          source={{ uri: child.imageUrl }}
          style={{ width: 56, height: 56, borderRadius: 28 }}
        />
      ) : (
        <View className="w-14 h-14 rounded-full bg-purple-200 dark:bg-purple-800 items-center justify-center">
          <ThemedText className="text-2xl font-black text-purple-900 dark:text-purple-200">
            {child.name.charAt(0).toUpperCase()}
          </ThemedText>
        </View>
      )}
      <View className="flex-1 ml-3">
        <ThemedText className="text-base font-bold text-black dark:text-white">
          {child.name}
        </ThemedText>
        <ThemedText className="text-xs text-gray-600 dark:text-zinc-400">
          {child.age} years old
          {child.gender ? ` · ${child.gender}` : ''}
        </ThemedText>
      </View>
    </Pressable>
  );
}

/**
 * Live header rendered inside the sidebar — mirrors the one in the
 * Library tab so both entry points show the same avatar/name/theme
 * toggle without bouncing the user back to the home tab. Lives here
 * (and in `(tabs)/index.tsx`) until/if we factor it into a shared
 * component; the duplication is small enough that the indirection
 * isn't worth it yet.
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
