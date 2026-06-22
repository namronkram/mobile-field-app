import { View, Text, StyleSheet, Button, FlatList, Image, ActivityIndicator, Alert } from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import { useState, useEffect } from 'react';
import { api } from '../../services/api';
import AsyncStorage from '@react-native-async-storage/async-storage';

interface Photo {
  uri: string;
  name: string;
  uploaded: boolean;
  uploading: boolean;
  queued: boolean;
}

export default function PhotosScreen() {
  const [photos, setPhotos] = useState<Photo[]>([]);
  const [uploading, setUploading] = useState(false);
  const [online, setOnline] = useState(true);

  useEffect(() => {
    checkOnlineStatus();
  }, []);

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
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsMultipleSelection: true,
      quality: 0.8,
    });

    if (!result.canceled) {
      const newPhotos = result.assets.map(asset => ({
        uri: asset.uri,
        name: asset.fileName || `photo_${Date.now()}.jpg`,
        uploaded: false,
        uploading: false,
        queued: false,
      }));
      setPhotos([...photos, ...newPhotos]);
    }
  };

  const takePhoto = async () => {
    const result = await ImagePicker.launchCameraAsync({
      quality: 0.8,
    });

    if (!result.canceled) {
      const newPhoto = {
        uri: result.assets[0].uri,
        name: `photo_${Date.now()}.jpg`,
        uploaded: false,
        uploading: false,
        queued: false,
      };
      setPhotos([...photos, newPhoto]);
    }
  };

  const handlePhoto = async (photo: Photo, index: number) => {
    if (!online) {
      // Queue for offline sync
      await api.queuePhoto(photo.uri, photo.name);
      setPhotos(photos.map((p, i) => i === index ? { ...p, queued: true } : p));
      Alert.alert('Queued', `Photo ${photo.name} queued for sync`);
    } else {
      // Upload immediately
      await uploadPhoto(photo, index);
    }
  };

  const uploadPhoto = async (photo: Photo, index: number) => {
    setPhotos(photos.map((p, i) => i === index ? { ...p, uploading: true } : p));

    try {
      const resp = await api.uploadPhoto(photo.uri, photo.name);
      if (resp.ok) {
        setPhotos(photos.map((p, i) => i === index ? { ...p, uploaded: true, uploading: false } : p));
        Alert.alert('Success', `Photo ${photo.name} uploaded`);
      } else {
        throw new Error('Upload failed');
      }
    } catch (e) {
      setPhotos(photos.map((p, i) => i === index ? { ...p, uploading: false } : p));
      
      // Queue for offline sync
      await api.queuePhoto(photo.uri, photo.name);
      setPhotos(photos.map((p, i) => i === index ? { ...p, queued: true } : p));
      Alert.alert('Queued', `Photo ${photo.name} queued for sync`);
    }
  };

  const uploadAll = async () => {
    setUploading(true);
    const notUploaded = photos.filter(p => !p.uploaded);
    
    for (let i = 0; i < notUploaded.length; i++) {
      const photo = notUploaded[i];
      const index = photos.findIndex(p => p.uri === photo.uri);
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
        <>
          <FlatList
            data={photos}
            keyExtractor={(item) => item.uri}
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
                  {!item.uploaded && !item.uploading && !item.queued && (
                    <Button title={online ? 'Upload' : 'Queue'} onPress={() => handlePhoto(item, index)} />
                  )}
                </View>
              </View>
            )}
          />
          
          {photos.some(p => !p.uploaded && !p.queued) && (
            <Button 
              title={uploading ? 'Processing...' : 'Upload/Queue All'} 
              onPress={uploadAll}
              disabled={uploading}
            />
          )}
          
          {photos.some(p => p.queued) && (
            <Button 
              title="Go to Queue" 
              onPress={() => {/* Navigate to queue tab */}} 
            />
          )}
        </>
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
