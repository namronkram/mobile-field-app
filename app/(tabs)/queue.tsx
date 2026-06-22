import { View, Text, StyleSheet, FlatList, Button, Alert, ActivityIndicator } from 'react-native';
import { useState, useEffect } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { api } from '../../services/api';

interface QueueItem {
  id: string;
  type: 'photo' | 'audit';
  data: any;
  timestamp: number;
  retries?: number;
}

export default function QueueScreen() {
  const [queue, setQueue] = useState<QueueItem[]>([]);
  const [syncing, setSyncing] = useState(false);
  const [lastSync, setLastSync] = useState<string | null>(null);

  useEffect(() => {
    loadQueue();
  }, []);

  const loadQueue = async () => {
    try {
      const status = await api.getQueueStatus();
      setQueue(status.items);
    } catch (e) {
      console.error(e);
    }
  };

  const syncNow = async () => {
    setSyncing(true);
    try {
      const result = await api.syncQueue();
      setLastSync(new Date().toLocaleString());
      Alert.alert(
        'Sync Complete',
        `Success: ${result.success}\nFailed: ${result.failed}`
      );
      await loadQueue();
    } catch (e) {
      Alert.alert('Error', 'Sync failed');
    } finally {
      setSyncing(false);
    }
  };

  const clearQueue = async () => {
    await AsyncStorage.removeItem('offline_queue');
    setQueue([]);
    Alert.alert('Cleared', 'Queue cleared');
  };

  const removeItem = async (id: string) => {
    const updated = queue.filter(item => item.id !== id);
    await AsyncStorage.setItem('offline_queue', JSON.stringify(updated));
    setQueue(updated);
  };

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Offline Queue</Text>
      
      <View style={styles.statusRow}>
        <Text style={styles.statusText}>
          Pending: {queue.length} items
        </Text>
        {lastSync && (
          <Text style={styles.lastSync}>
            Last sync: {lastSync}
          </Text>
        )}
      </View>

      {queue.length === 0 ? (
        <Text style={styles.empty}>No pending items</Text>
      ) : (
        <>
          <FlatList
            data={queue}
            keyExtractor={(item) => item.id}
            renderItem={({ item }) => (
              <View style={styles.item}>
                <View style={styles.itemInfo}>
                  <Text style={styles.itemType}>{item.type}</Text>
                  <Text style={styles.itemTime}>
                    {new Date(item.timestamp).toLocaleString()}
                  </Text>
                  {item.retries && item.retries > 0 && (
                    <Text style={styles.retries}>
                      Retries: {item.retries}/3
                    </Text>
                  )}
                </View>
                <Button title="Remove" onPress={() => removeItem(item.id)} />
              </View>
            )}
          />

          <View style={styles.buttonRow}>
            <Button 
              title={syncing ? 'Syncing...' : 'Sync Now'} 
              onPress={syncNow}
              disabled={syncing}
            />
            <Button title="Clear All" onPress={clearQueue} color="#ff3b30" />
          </View>
        </>
      )}

      {syncing && (
        <View style={styles.syncing}>
          <ActivityIndicator size="small" />
          <Text style={styles.syncingText}>Syncing...</Text>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 20, backgroundColor: '#fff' },
  title: { fontSize: 22, fontWeight: 'bold', marginBottom: 20 },
  statusRow: { marginBottom: 15 },
  statusText: { fontSize: 16, fontWeight: '600' },
  lastSync: { fontSize: 12, color: '#666', marginTop: 4 },
  empty: { fontSize: 14, color: '#999', fontStyle: 'italic', marginTop: 20 },
  item: { 
    flexDirection: 'row', 
    padding: 15, 
    borderWidth: 1, 
    borderColor: '#ddd', 
    borderRadius: 8, 
    marginBottom: 10,
    alignItems: 'center',
  },
  itemInfo: { flex: 1 },
  itemType: { fontSize: 14, fontWeight: '600' },
  itemTime: { fontSize: 12, color: '#666', marginTop: 4 },
  retries: { fontSize: 11, color: '#ff9500', marginTop: 2 },
  buttonRow: { 
    flexDirection: 'row', 
    justifyContent: 'space-around',
    marginTop: 20,
  },
  syncing: { 
    flexDirection: 'row', 
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 20,
  },
  syncingText: { marginLeft: 10, fontSize: 14, color: '#666' },
});
