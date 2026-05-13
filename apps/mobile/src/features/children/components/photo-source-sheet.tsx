import * as FileSystem from 'expo-file-system/legacy';
import { Image } from 'expo-image';
import * as ImagePicker from 'expo-image-picker';
import * as MediaLibrary from 'expo-media-library';
import { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Linking,
  Modal,
  Pressable,
  View,
} from 'react-native';
import { ThemedText } from '~/shared/components/themed-text';
import { cn } from '~/shared/lib/cn';
import type { UploadChildImageInput } from '../use-children';

const RECENT_COUNT = 24;
const THUMB_SIZE = 88;

interface PhotoSourceSheetProps {
  visible: boolean;
  onClose: () => void;
  onPick: (asset: UploadChildImageInput) => void;
}

type PermissionState = 'idle' | 'requesting' | 'granted' | 'denied';

export function PhotoSourceSheet({
  visible,
  onClose,
  onPick,
}: PhotoSourceSheetProps) {
  const [recents, setRecents] = useState<MediaLibrary.Asset[]>([]);
  const [permission, setPermission] = useState<PermissionState>('idle');

  useEffect(() => {
    if (!visible) return;
    let cancelled = false;
    (async () => {
      setPermission('requesting');
      const perm = await MediaLibrary.requestPermissionsAsync(false);
      if (cancelled) return;
      if (!perm.granted) {
        setPermission('denied');
        return;
      }
      setPermission('granted');
      try {
        const result = await MediaLibrary.getAssetsAsync({
          mediaType: MediaLibrary.MediaType.photo,
          first: RECENT_COUNT,
          sortBy: [[MediaLibrary.SortBy.creationTime, false]],
        });
        if (!cancelled) setRecents(result.assets);
      } catch {
        if (!cancelled) setRecents([]);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [visible]);

  const handlePickRecent = async (asset: MediaLibrary.Asset) => {
    try {
      const uri = await toUploadableUri(asset);
      onPick({
        uri,
        mimeType: asset.mediaSubtypes?.includes('hdr') ? null : null,
        fileName: asset.filename,
      });
      onClose();
    } catch (e) {
      Alert.alert(
        'Could not use photo',
        e instanceof Error
          ? e.message
          : 'Try picking from the library instead.',
      );
    }
  };

  const handleCamera = async () => {
    const perm = await ImagePicker.requestCameraPermissionsAsync();
    if (!perm.granted) {
      Alert.alert(
        'Camera access needed',
        'Allow camera access in Settings to take a profile picture.',
        [
          { text: 'OK' },
          { text: 'Open settings', onPress: () => Linking.openSettings() },
        ],
      );
      return;
    }
    const result = await ImagePicker.launchCameraAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.85,
    });
    if (result.canceled) return;
    const asset = result.assets[0];
    if (!asset) return;
    onPick({
      uri: asset.uri,
      mimeType: asset.mimeType ?? null,
      fileName: asset.fileName ?? null,
    });
    onClose();
  };

  const handleLibrary = async () => {
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.85,
    });
    if (result.canceled) return;
    const asset = result.assets[0];
    if (!asset) return;
    onPick({
      uri: asset.uri,
      mimeType: asset.mimeType ?? null,
      fileName: asset.fileName ?? null,
    });
    onClose();
  };

  return (
    <Modal
      visible={visible}
      animationType="fade"
      transparent
      onRequestClose={onClose}
    >
      <Pressable onPress={onClose} className="flex-1 bg-black/40 justify-end">
        <Pressable
          onPress={() => undefined}
          className="bg-white rounded-t-3xl pb-8"
        >
          <View className="items-center pt-3 pb-2">
            <View className="w-10 h-1.5 rounded-full bg-gray-300" />
          </View>
          <ThemedText className="text-base font-bold text-black text-center mt-2 mb-3">
            Add photo
          </ThemedText>

          {permission === 'requesting' && (
            <View className="py-6 items-center">
              <ActivityIndicator />
            </View>
          )}

          {permission === 'denied' && (
            <View className="px-6 pb-3">
              <ThemedText className="text-sm text-gray-600 text-center mb-2">
                Photo library access is required to show recent photos.
              </ThemedText>
              <Pressable
                onPress={() => Linking.openSettings()}
                className="self-center px-3 py-1.5 rounded-full bg-gray-100"
              >
                <ThemedText className="text-xs font-semibold text-black">
                  Open settings
                </ThemedText>
              </Pressable>
            </View>
          )}

          {permission === 'granted' && (
            <View className="pb-2">
              {recents.length > 0 ? (
                <FlatList
                  horizontal
                  showsHorizontalScrollIndicator={false}
                  data={recents}
                  keyExtractor={(item) => item.id}
                  contentContainerStyle={{ paddingHorizontal: 16, gap: 8 }}
                  renderItem={({ item }) => (
                    <Pressable
                      onPress={() => handlePickRecent(item)}
                      className="overflow-hidden rounded-xl bg-gray-100"
                      style={{ width: THUMB_SIZE, height: THUMB_SIZE }}
                    >
                      <Image
                        source={{ uri: item.uri }}
                        style={{ width: '100%', height: '100%' }}
                        contentFit="cover"
                      />
                    </Pressable>
                  )}
                />
              ) : (
                <ThemedText className="text-sm text-gray-500 text-center py-6">
                  No recent photos found.
                </ThemedText>
              )}
            </View>
          )}

          <View className="px-5 mt-3 gap-2">
            <ActionRow icon="📷" label="Take photo" onPress={handleCamera} />
            <ActionRow
              icon="🖼️"
              label="Choose from library"
              onPress={handleLibrary}
            />
            <Pressable
              onPress={onClose}
              className="py-3 items-center rounded-2xl bg-gray-100 mt-1"
            >
              <ThemedText className="text-sm font-semibold text-black">
                Cancel
              </ThemedText>
            </Pressable>
          </View>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

function ActionRow({
  icon,
  label,
  onPress,
}: {
  icon: string;
  label: string;
  onPress: () => void;
}) {
  return (
    <Pressable
      onPress={onPress}
      className={cn(
        'flex-row items-center px-4 py-3 rounded-2xl bg-white border border-gray-200',
        'active:bg-gray-50',
      )}
    >
      <ThemedText className="text-xl mr-3">{icon}</ThemedText>
      <ThemedText className="text-base font-semibold text-black">
        {label}
      </ThemedText>
    </Pressable>
  );
}

/**
 * Get a `file://` URI for a MediaLibrary asset that can be uploaded via
 * `FormData`. On iOS the raw `ph://` URI sometimes works with RN's native
 * FormData implementation, but copying to the cache directory yields a
 * stable file:// path that always works. On Android, `localUri` is already
 * a file:// path so the copy is skipped.
 */
async function toUploadableUri(asset: MediaLibrary.Asset): Promise<string> {
  const info = await MediaLibrary.getAssetInfoAsync(asset.id);
  const source = info.localUri ?? asset.uri;
  if (source.startsWith('file://')) return source;
  const ext = (asset.filename.split('.').pop() ?? 'jpg').toLowerCase();
  const dest = `${FileSystem.cacheDirectory}wt-photo-${asset.id}.${ext}`;
  await FileSystem.copyAsync({ from: source, to: dest });
  return dest;
}
