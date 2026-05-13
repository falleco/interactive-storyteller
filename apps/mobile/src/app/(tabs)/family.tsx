import { Image } from 'expo-image';
import { router, useFocusEffect } from 'expo-router';
import { useCallback, useMemo } from 'react';
import { Alert, FlatList, Pressable, View } from 'react-native';
import {
  SafeAreaView,
  useSafeAreaInsets,
} from 'react-native-safe-area-context';
import { type ChildProfile, useChildren } from '~/features/children';
import {
  PARENT_ROLE_LABELS,
  type ParentProfile,
  useParent,
} from '~/features/parent';
import { FlatButton } from '~/shared/components/core/flat-button';
import { ThemedText } from '~/shared/components/themed-text';
import { useAuth } from '~/shared/hooks/use-auth';
import { useThemeColor } from '~/shared/hooks/use-theme-color';

type Row =
  | { kind: 'parent'; parent: ParentProfile }
  | { kind: 'child'; child: ChildProfile };

export default function FamilyTab() {
  const backgroundColor = useThemeColor({}, 'background');
  const { user } = useAuth();
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
  const insets = useSafeAreaInsets();

  // Both lists belong to "the family"; refetch on focus so creates/edits
  // from the modals are reflected when the user returns to this tab.
  useFocusEffect(
    useCallback(() => {
      refreshChildren();
      refreshParent();
    }, [refreshChildren, refreshParent]),
  );

  const rows = useMemo<Row[]>(() => {
    const out: Row[] = [];
    if (parent) out.push({ kind: 'parent', parent });
    for (const child of children) out.push({ kind: 'child', child });
    return out;
  }, [parent, children]);

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
      <View className="px-5 pt-2 pb-1">
        <ThemedText className="text-2xl font-black text-black dark:text-white">
          👪 Family
        </ThemedText>
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
          data={rows}
          keyExtractor={(row) =>
            row.kind === 'parent'
              ? `parent-${row.parent.id}`
              : `child-${row.child.id}`
          }
          refreshing={isLoading}
          onRefresh={() => {
            refreshChildren();
            refreshParent();
          }}
          ListEmptyComponent={
            !isLoading ? (
              <View className="items-center mt-12 px-6">
                <ThemedText className="text-base text-gray-500 dark:text-zinc-400 text-center">
                  {childrenError
                    ? `Couldn't load: ${childrenError.message}`
                    : 'No family members yet.'}
                </ThemedText>
              </View>
            ) : null
          }
          renderItem={({ item }) => {
            if (item.kind === 'parent') {
              return (
                <ParentRow parent={item.parent} onPress={handleEditParent} />
              );
            }
            return (
              <ChildRow
                child={item.child}
                onPress={() => handleEditChild(item.child.id)}
                onLongPress={() =>
                  handleDeleteChild(item.child.id, item.child.name)
                }
              />
            );
          }}
        />
      )}

      {user && (
        <View
          pointerEvents="box-none"
          className="absolute left-0 right-0 px-6"
          style={{ bottom: insets.bottom + 120 }}
        >
          <FlatButton size="lg" className="bg-black" onPress={handleAddChild}>
            <ThemedText className="text-base font-semibold text-white">
              ＋ Add child
            </ThemedText>
          </FlatButton>
        </View>
      )}
    </SafeAreaView>
  );
}

function ParentRow({
  parent,
  onPress,
}: {
  parent: ParentProfile;
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
      className="flex-row items-center bg-purple-50 dark:bg-purple-950/40 border border-purple-200 dark:border-purple-800 rounded-2xl p-3"
    >
      {avatar ? (
        <Image
          source={{ uri: avatar }}
          style={{ width: 56, height: 56, borderRadius: 28 }}
        />
      ) : (
        <View className="w-14 h-14 rounded-full bg-purple-300 dark:bg-purple-700 items-center justify-center">
          <ThemedText className="text-2xl font-black text-purple-900 dark:text-purple-200">
            {(parent.name || '?').charAt(0).toUpperCase()}
          </ThemedText>
        </View>
      )}
      <View className="flex-1 ml-3">
        <View className="flex-row items-center">
          <ThemedText className="text-base font-bold text-black dark:text-white mr-2">
            {parent.name || 'You'}
          </ThemedText>
          <View className="px-2 py-0.5 rounded-full bg-purple-200">
            <ThemedText className="text-[10px] font-semibold text-purple-900 dark:text-purple-200">
              ME
            </ThemedText>
          </View>
        </View>
        <ThemedText className="text-xs text-gray-600 dark:text-zinc-400 mt-0.5">
          {subtitle}
        </ThemedText>
      </View>
    </Pressable>
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
