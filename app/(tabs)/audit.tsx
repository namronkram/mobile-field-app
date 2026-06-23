import { useState, useEffect } from 'react';
import { View, Text, StyleSheet, FlatList, ActivityIndicator, Button } from 'react-native';
import { useAuth } from '../../context/AuthContext';
import { useRouter } from 'expo-router';
import { api } from '../../services/api';

interface Project {
  id: string;
  title: string;
  description: string | null;
}

export default function AuditScreen() {
  const { user } = useAuth();
  const router = useRouter();
  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadProjects();
  }, []);

  const loadProjects = async () => {
    try {
      const resp = await api.get('/api/v1/projects');
      if (resp.ok) {
        const data = await resp.json();
        setProjects(data);
      }
    } catch (e) {
      console.error('Failed to load projects', e);
    } finally {
      setLoading(false);
    }
  };

  if (loading) return <ActivityIndicator size="large" style={styles.center} />;

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Energy Audit</Text>
      <Text style={styles.welcome}>Welcome, {user?.name || 'User'}</Text>
      <Text style={styles.subtitle}>Select a project to start audit</Text>

      {projects.length === 0 ? (
        <Text style={styles.empty}>No projects yet. Create one via the web app.</Text>
      ) : (
        <FlatList
          data={projects}
          keyExtractor={(item) => item.id}
          renderItem={({ item }) => (
            <View style={styles.projectCard}>
              <Text style={styles.projectName}>{item.title}</Text>
              <Text style={styles.projectAddress}>{item.description || 'No description'}</Text>
              <Button title="Start Audit" onPress={() => {
                // Use explicit query params in URL string
                router.push(`/(tabs)/audit-form?projectId=${item.id}&projectName=${encodeURIComponent(item.title)}`);
              }} />
            </View>
          )}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 20, backgroundColor: '#fff' },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  title: { fontSize: 22, fontWeight: 'bold', marginBottom: 10 },
  welcome: { fontSize: 16, marginBottom: 5 },
  subtitle: { fontSize: 16, color: '#666', marginBottom: 20 },
  empty: { fontSize: 14, color: '#999', fontStyle: 'italic', marginTop: 20 },
  projectCard: { padding: 15, borderWidth: 1, borderColor: '#ddd', borderRadius: 8, marginBottom: 10 },
  projectName: { fontSize: 18, fontWeight: '600', marginBottom: 5 },
  projectAddress: { fontSize: 14, color: '#666', marginBottom: 10 },
});
