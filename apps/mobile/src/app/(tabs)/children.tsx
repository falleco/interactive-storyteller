import { Image } from 'expo-image';
import { router } from 'expo-router';
import { Alert, FlatList, Pressable, View } from 'react-native';
import {
  SafeAreaView,
  useSafeAreaInsets,
} from 'react-native-safe-area-context';
import { useChildren } from '~/features/children';
import { FlatButton } from '~/shared/components/core/flat-button';
import { ThemedText } from '~/shared/components/themed-text';
import { useAuth } from '~/shared/hooks/use-auth';
import { useThemeColor } from '~/shared/hooks/use-theme-color';

export default function ChildrenTab() {
  const backgroundColor = useThemeColor({}, 'background');
  const { user } = useAuth();
  const { children, isLoading, error, refresh, remove } = useChildren();
  const insets = useSafeAreaInsets();

  const handleAdd = () => router.push('/children/new');
  const handleEdit = (id: string) => router.push(`/children/${id}`);

  const handleDelete = (id: string, name: string) => {
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

  return (
    <SafeAreaView className="flex-1" style={{ backgroundColor }}>
      <View className="px-5 pt-2 pb-1">
        <ThemedText className="text-2xl font-black text-black">
          👧 Children
        </ThemedText>
      </View>

      {!user ? (
        <View className="flex-1 items-center justify-center px-6">
          <ThemedText className="text-base text-gray-500 text-center">
            Sign in to manage your children.
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
          keyExtractor={(c) => c.id}
          refreshing={isLoading}
          onRefresh={refresh}
          ListEmptyComponent={
            !isLoading ? (
              <View className="items-center mt-12 px-6">
                <ThemedText className="text-base text-gray-500 text-center">
                  {error
                    ? `Couldn't load children: ${error.message}`
                    : 'No children yet. Add one to star in their own story.'}
                </ThemedText>
              </View>
            ) : null
          }
          renderItem={({ item }) => (
            <Pressable
              onPress={() => handleEdit(item.id)}
              onLongPress={() => handleDelete(item.id, item.name)}
              className="flex-row items-center bg-gray-100 rounded-2xl p-3"
            >
              {item.imageUrl ? (
                <Image
                  source={{ uri: item.imageUrl }}
                  style={{ width: 56, height: 56, borderRadius: 28 }}
                />
              ) : (
                <View className="w-14 h-14 rounded-full bg-purple-200 items-center justify-center">
                  <ThemedText className="text-2xl font-black text-purple-900">
                    {item.name.charAt(0).toUpperCase()}
                  </ThemedText>
                </View>
              )}
              <View className="flex-1 ml-3">
                <ThemedText className="text-base font-bold text-black">
                  {item.name}
                </ThemedText>
                <ThemedText className="text-xs text-gray-600">
                  {item.age} years old
                  {item.gender ? ` • ${item.gender}` : ''}
                </ThemedText>
              </View>
            </Pressable>
          )}
        />
      )}

      {user && (
        <View
          pointerEvents="box-none"
          className="absolute left-0 right-0 px-6"
          style={{ bottom: insets.bottom + 120 }}
        >
          <FlatButton size="lg" className="bg-black" onPress={handleAdd}>
            <ThemedText className="text-base font-semibold text-white">
              ＋ Add child
            </ThemedText>
          </FlatButton>
        </View>
      )}
    </SafeAreaView>
  );
}
