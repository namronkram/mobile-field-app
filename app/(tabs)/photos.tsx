import React from 'react';
import { View, Text, StyleSheet, Button, FlatList, Image, Alert } from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import { useState, useEffect } from 'react';
import { useFocusEffect } from '@react-navigation/native';
import { useRouter } from 'expo-router';
import { api } from '../../services/api';

interface Photo {
  uri: string;
  name: string;
  uploaded: boolean;
  uploading: boolean;
  queued: boolean;
  id: string;
}

export default function PhotosScreen() {
  const router = useRouter();
  const [photos, setPhotos] = useState<Photo[]>([]);
  const [uploading, setUploading] = useState(false);
  const [online, setOnline] = useState(true);

  // ✅ Correct useFocusEffect pattern — plain function, no useCallback wrapper
  useFocusEffect(
    React.useCallback(() => {
      console.log('[Photos] Tab focused — reloading...');
      loadPhotos();
      checkOnlineStatus();
    }, [])
  );

  const loadPhotos = async () => {
    try {
      console.log('[Photos] Reading offline_queue...');
      const status = await api.getQueueStatus();
      const queuePhotos: Photo[] = status.items
        .filter((item: any) => item.type === 'photo')
        .map((item: any) => ({
          uri: item.data.uri,
          name: item.data.name,
          uploaded: false,
          uploading: false,
          queued: true,
          id: item.id,
        }));

      console.log(`[Photos] Loaded ${queuePhotos.length} photo(s) from offline_queue`);
      setPhotos(queuePhotos);
    } catch (e: any) {
      console.error('[Photos] Failed to load photos:', e.message);
      setPhotos([]);
    }
  };

  const checkOnlineStatus = async () => {
    try {
      const resp = await fetch(api.baseUrl + '/health', { method: 'GET' });
      setOnline(resp.ok);
    } catch {
      setOnline(false);
    }
  };

  const pickImage = async () => {
    const result = await ImagePicker.launchImageLibraryAsync({
    mediaTypes: ['images'],
      allowsMultipleSelection: true,
      quality: 0.8,
    });

    if (!result.canceled && result.assets) {
      for (const asset of result.assets) {
        await api.queuePhoto(asset.uri, asset.fileName || `photo-${Date.now()}`);
      }
      await loadPhotos();
      Alert.alert('Queued', `${result.assets.length} photo(s) queued for sync`);
    }
  };

  const takePhoto = async () => {
    const result = await ImagePicker.launchCameraAsync({
      quality: 0.8,
    });

    if (!result.canceled && result.assets && result.assets[0]) {
      await api.queuePhoto(result.assets[0].uri, `photo_${Date.now()}.jpg`);
      await loadPhotos();
      Alert.alert('Queued', 'Photo queued for sync');
    }
  };

  const handlePhoto = async (photo: Photo, index: number) => {
    if (online) {
      setPhotos(photos.map((p, i) => i === index ? { ...p, uploading: true } : p));
      try {
        const resp = await api.uploadPhoto(photo.uri, photo.name);
        if (resp.ok) {
          await api.removeQueuedItem(photo.id);
          await loadPhotos();
          Alert.alert('Success', `Photo ${photo.name} uploaded`);
        } else {
          throw new Error('Upload failed');
        }
      } catch (e) {
        setPhotos(photos.map((p, i) => i === index ? { ...p, uploading: false } : p));
        Alert.alert('Offline', 'Photo remains in queue');
      }
    } else {
      Alert.alert('Offline', 'Photo already queued');
    }
  };

  const uploadAll = async () => {
    setUploading(true);
    const notUploaded = photos.filter(p => !p.uploaded && !p.uploading);

    for (let i = 0; i < notUploaded.length; i++) {
      const photo = notUploaded[i];
      const index = photos.findIndex(p => p.id === photo.id);
      await handlePhoto(photo, index);
    }

    setUploading(false);
  };

  return (
    <View style={styles.container}>
      <View style={styles.headerRow}>
        <Text style={styles.title}>Photo Documentation</Text>
        <View style={[styles.statusBadge, online ? styles.online : styles.offline]}>
          <Text style={styles.statusText}>{online ? 'Online' : 'Offline'}</Text>
        </View>
      </View>

      <View style={styles.buttonRow}>
        <Button title="Take Photo" onPress={takePhoto} />
        <Button title="Choose from Gallery" onPress={pickImage} />
      </View>

      {photos.length === 0 ? (
        <Text style={styles.empty}>No photos yet. Take or select photos to document the audit.</Text>
      ) : (
        <View>
          <FlatList
            data={photos}
            keyExtractor={(item) => item.id}
            renderItem={({ item, index }) => (
              <View style={styles.photoCard}>
                <Image source={{ uri: item.uri }} style={styles.thumbnail} />
                <View style={styles.photoInfo}>
                  <Text style={styles.photoName}>{item.name}</Text>
                  <Text style={styles.photoStatus}>
                    {item.uploading ? 'Uploading...' :
                      item.uploaded ? '✅ Uploaded' :
                        item.queued ? '📦 Queued' : 'Ready'}
                  </Text>
                  {!item.uploaded && !item.uploading && (
                    <Button title={online ? 'Upload' : 'Queued'} onPress={() => handlePhoto(item, index)} disabled={!online} />
                  )}
                </View>
              </View>
            )}
          />

          {photos.some(p => !p.uploaded && !p.uploading) && (
            <Button
              title={uploading ? 'Processing...' : 'Upload All'}
              onPress={uploadAll}
              disabled={uploading || !online}
            />
          )}

          <Button
            title="Go to Queue"
            onPress={() => router.push('/(tabs)/queue')}
          />

          <Button
            title="Refresh"
            onPress={loadPhotos}
            color="#666"
          />
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 20, backgroundColor: '#fff' },
  headerRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 },
  title: { fontSize: 22, fontWeight: 'bold' },
  statusBadge: { paddingHorizontal: 10, paddingVertical: 5, borderRadius: 12 },
  online: { backgroundColor: '#d4edda' },
  offline: { backgroundColor: '#f8d7da' },
  statusText: { fontSize: 12, fontWeight: '600' },
  buttonRow: { flexDirection: 'row', justifyContent: 'space-around', marginBottom: 20 },
  empty: { fontSize: 14, color: '#999', fontStyle: 'italic', marginTop: 20, textAlign: 'center' },
  photoCard: { flexDirection: 'row', padding: 10, borderWidth: 1, borderColor: '#ddd', borderRadius: 8, marginBottom: 10 },
  thumbnail: { width: 60, height: 60, borderRadius: 4 },
  photoInfo: { flex: 1, marginLeft: 10, justifyContent: 'center' },
  photoName: { fontSize: 14, fontWeight: '600' },
  photoStatus: { fontSize: 12, color: '#666', marginTop: 4 },
});
