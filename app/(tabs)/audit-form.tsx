import React, { useState } from 'react';
import { View, Text, StyleSheet, TextInput, Button, ScrollView, Alert, ActivityIndicator, Image } from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { api } from '../../services/api';

const AUDIT_METHODS = ['remote', 'on_site', 'hybrid', 'ai_only'];

export default function AuditFormScreen() {
  const { projectId, projectName } = useLocalSearchParams<{ projectId: string; projectName: string }>();
  const router = useRouter();
  
  // Pre-filled with valid dummy data
  const [auditDate, setAuditDate] = useState('2026-06-23');
  const [method, setMethod] = useState('remote');
  const [consumptionData, setConsumptionData] = useState('{"electricity_kwh": 50000, "gas_kwh": 30000}');
  const [buildingData, setBuildingData] = useState('{"area_m2": 500, "year_built": 1995, "building_type": "office"}');
  const [thermalImageUris, setThermalImageUris] = useState<string[]>([]);
  const [photos, setPhotos] = useState('');
  const [findings, setFindings] = useState('[{"type": "insufficient_insulation", "severity": "high"}]');
  const [notes, setNotes] = useState('Test audit - all fields pre-filled with dummy data');
  const [submitting, setSubmitting] = useState(false);

  const pickThermalImages = async () => {
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      allowsMultipleSelection: true,
      quality: 0.8,
    });

    if (!result.canceled && result.assets) {
      const newUris = result.assets.map(a => a.uri);
      setThermalImageUris(prev => [...prev, ...newUris]);
    }
  };

  const removeThermalImage = (uri: string) => {
    setThermalImageUris(prev => prev.filter(u => u !== uri));
  };

  const safeJsonParse = (str: string, fieldName: string) => {
    if (!str || str.trim() === '') return null;
    try {
      return JSON.parse(str);
    } catch (e) {
      Alert.alert('Invalid JSON', `${fieldName} is not valid JSON. Please fix it.`);
      throw new Error(`Invalid JSON in ${fieldName}`);
    }
  };

  const handleSubmit = async () => {
    if (!auditDate || !method) {
      Alert.alert('Error', 'Audit date and method are required');
      return;
    }

    setSubmitting(true);
    try {
      const payload = {
        project_id: projectId,
        audit_date: auditDate,
        method: method,
        consumption_data: safeJsonParse(consumptionData, 'Consumption Data'),
        building_data: safeJsonParse(buildingData, 'Building Data'),
        thermal_images: thermalImageUris.length > 0 ? thermalImageUris : null,
        photos: photos ? photos.split(',').map(s => s.trim()) : null,
        findings: safeJsonParse(findings, 'Findings'),
        notes: notes || null,
      };

      const resp = await api.post('/api/v1/energy-audits', payload);
      if (resp.ok) {
        Alert.alert('Success', 'Energy audit created successfully', [
          { text: 'OK', onPress: () => router.back() },
        ]);
      } else {
        const error = await resp.json();
        Alert.alert('Error', error.detail || 'Failed to create audit');
      }
    } catch (e) {
      if (e instanceof Error && e.message.includes('Invalid JSON')) {
        // Already handled by safeJsonParse
        return;
      }
      Alert.alert('Error', 'Failed to submit audit. Check API connection.');
      console.error('Audit submit error:', e);
    } finally {
      setSubmitting(false);
    }
  };

  if (submitting) {
    return <ActivityIndicator size="large" style={styles.center} />;
  }

  return (
    <ScrollView style={styles.container}>
      <Text style={styles.title}>New Energy Audit</Text>
      <Text style={styles.subtitle}>{projectName || 'Unknown Project'}</Text>

      {/* Audit Date */}
      <Text style={styles.label}>Audit Date * (YYYY-MM-DD)</Text>
      <TextInput
        style={styles.input}
        placeholder="2026-06-23"
        value={auditDate}
        onChangeText={setAuditDate}
      />

      {/* Method */}
      <Text style={styles.label}>Method *</Text>
      <View style={styles.pickerContainer}>
        {AUDIT_METHODS.map(m => (
          <Button
            key={m}
            title={m}
            color={method === m ? '#007AFF' : '#999'}
            onPress={() => setMethod(m)}
          />
        ))}
      </View>

      {/* Consumption Data (JSON) */}
      <Text style={styles.label}>Consumption Data (JSON)</Text>
      <TextInput
        style={[styles.input, styles.textArea]}
        placeholder='{"electricity_kwh": 50000, "gas_kwh": 30000}'
        value={consumptionData}
        onChangeText={setConsumptionData}
        multiline
        numberOfLines={4}
      />

      {/* Building Data (JSON) */}
      <Text style={styles.label}>Building Data (JSON)</Text>
      <TextInput
        style={[styles.input, styles.textArea]}
        placeholder='{"area_m2": 500, "year_built": 1995, "building_type": "office"}'
        value={buildingData}
        onChangeText={setBuildingData}
        multiline
        numberOfLines={4}
      />

      {/* Thermal Images Upload */}
      <Text style={styles.label}>Thermal Images</Text>
      <Button title="Upload Thermal Images" onPress={pickThermalImages} color="#FF9500" />
      <View style={styles.imagePreviewContainer}>
        {thermalImageUris.map(uri => (
          <View key={uri} style={styles.imageWrapper}>
            <Image source={{ uri }} style={styles.thumbnail} />
            <Button title="Remove" onPress={() => removeThermalImage(uri)} color="#FF3B30" />
          </View>
        ))}
      </View>
      {thermalImageUris.length > 0 && (
        <Text style={styles.hintText}>{thermalImageUris.length} thermal image(s) selected</Text>
      )}

      {/* Photos (comma-separated URLs) */}
      <Text style={styles.label}>Photos (comma-separated URLs)</Text>
      <TextInput
        style={styles.input}
        placeholder="https://.../photo1.jpg, https://.../photo2.jpg"
        value={photos}
        onChangeText={setPhotos}
      />

      {/* Findings (JSON) */}
      <Text style={styles.label}>Findings (JSON)</Text>
      <TextInput
        style={[styles.input, styles.textArea]}
        placeholder='[{"type": "insufficient_insulation", "severity": "high"}]'
        value={findings}
        onChangeText={setFindings}
        multiline
        numberOfLines={4}
      />

      {/* Notes */}
      <Text style={styles.label}>Notes</Text>
      <TextInput
        style={[styles.input, styles.textArea]}
        placeholder="Additional observations..."
        value={notes}
        onChangeText={setNotes}
        multiline
        numberOfLines={4}
      />

      {/* Submit Button */}
      <View style={styles.buttonContainer}>
        <Button title="Submit Audit" onPress={handleSubmit} color="#007AFF" />
      </View>
      <View style={styles.buttonContainer}>
        <Button title="Cancel" onPress={() => router.back()} color="#FF3B30" />
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  container: { flex: 1, padding: 20, backgroundColor: '#fff' },
  title: { fontSize: 24, fontWeight: 'bold', marginBottom: 5 },
  subtitle: { fontSize: 16, color: '#666', marginBottom: 20 },
  label: { fontSize: 14, fontWeight: '600', marginTop: 15, marginBottom: 5 },
  input: { borderWidth: 1, borderColor: '#ddd', borderRadius: 8, padding: 10, fontSize: 16 },
  textArea: { height: 100, textAlignVertical: 'top' },
  pickerContainer: { flexDirection: 'row', flexWrap: 'wrap', gap: 5, marginVertical: 10 },
  buttonContainer: { marginTop: 20, marginBottom: 10 },
  imagePreviewContainer: { flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginTop: 10 },
  imageWrapper: { alignItems: 'center' },
  thumbnail: { width: 80, height: 80, borderRadius: 8 },
  hintText: { fontSize: 12, color: '#999', marginTop: 5, marginBottom: 10 },
});
