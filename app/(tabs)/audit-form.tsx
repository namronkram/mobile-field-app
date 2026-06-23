import React, { useState } from 'react';
import { View, Text, StyleSheet, TextInput, Button, ScrollView, Alert, ActivityIndicator, Image } from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { api } from '../../services/api';

const AUDIT_METHODS = ['remote', 'on_site', 'hybrid', 'ai_only'];

export default function AuditFormScreen() {
  const { projectId, projectName } = useLocalSearchParams<{ projectId: string; projectName: string }>();
  const router = useRouter();
  
  console.log('[AuditForm] Received params:', { projectId, projectName });
  
  // Pre-filled with valid dummy data
  const [auditDate, setAuditDate] = useState('2026-06-23');
  const [method, setMethod] = useState('remote');
  const [consumptionKwh, setConsumptionKwh] = useState('50000');
  const [gasKwh, setGasKwh] = useState('30000');
  const [areaM2, setAreaM2] = useState('500');
  const [yearBuilt, setYearBuilt] = useState('1995');
  const [buildingType, setBuildingType] = useState('office');
  const [notes, setNotes] = useState('Test audit - dummy data pre-filled');
  const [submitting, setSubmitting] = useState(false);
  
  // Thermal images
  const [thermalImageUris, setThermalImageUris] = useState<string[]>([]);

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

  const handleSubmit = async () => {
    if (!auditDate || !method) {
      Alert.alert('Error', 'Audit date and method are required');
      return;
    }
    
    if (!projectId) {
      Alert.alert('Error', 'No project selected. Go back and select a project.');
      return;
    }

    setSubmitting(true);
    try {
      const consumptionData = {
        electricity_kwh: parseInt(consumptionKwh) || 0,
        gas_kwh: parseInt(gasKwh) || 0,
      };

      const buildingData = {
        area_m2: parseFloat(areaM2) || 0,
        year_built: parseInt(yearBuilt) || null,
        building_type: buildingType,
      };

      const payload = {
        project_id: projectId,
        audit_date: auditDate,
        method: method,
        consumption_data: consumptionData,
        building_data: buildingData,
        thermal_images: thermalImageUris.length > 0 ? thermalImageUris : null,
        photos: null,
        findings: null,
        notes: notes || null,
      };

      console.log('[AuditForm] Submitting payload:', JSON.stringify(payload, null, 2));

      const resp = await api.post('/api/v1/energy-audits', payload);
      
      console.log('[AuditForm] Response status:', resp.status);
      
      if (resp.ok) {
        const data = await resp.json();
        console.log('[AuditForm] Success:', data);
        Alert.alert('Success', 'Energy audit created successfully', [
          { text: 'OK', onPress: () => router.back() },
        ]);
      } else {
        const error = await resp.json();
        console.error('[AuditForm] Error response:', error);
        Alert.alert('Error', JSON.stringify(error) || 'Failed to create audit');
      }
    } catch (e: any) {
      console.error('[AuditForm] Submit error:', e);
      Alert.alert('Error', `Failed to submit: ${e.message || 'Unknown error'}`);
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
      
      {!projectId && (
        <Text style={styles.errorText}>⚠ No project selected</Text>
      )}

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

      {/* Electricity Consumption */}
      <Text style={styles.label}>Electricity (kWh/year)</Text>
      <TextInput
        style={styles.input}
        placeholder="50000"
        value={consumptionKwh}
        onChangeText={setConsumptionKwh}
        keyboardType="numeric"
      />

      {/* Gas Consumption */}
      <Text style={styles.label}>Gas (kWh/year)</Text>
      <TextInput
        style={styles.input}
        placeholder="30000"
        value={gasKwh}
        onChangeText={setGasKwh}
        keyboardType="numeric"
      />

      {/* Area */}
      <Text style={styles.label}>Area (m²) *</Text>
      <TextInput
        style={styles.input}
        placeholder="500"
        value={areaM2}
        onChangeText={setAreaM2}
        keyboardType="numeric"
      />

      {/* Year Built */}
      <Text style={styles.label}>Year Built</Text>
      <TextInput
        style={styles.input}
        placeholder="1995"
        value={yearBuilt}
        onChangeText={setYearBuilt}
        keyboardType="numeric"
      />

      {/* Building Type */}
      <Text style={styles.label}>Building Type</Text>
      <TextInput
        style={styles.input}
        placeholder="office, residential, industrial"
        value={buildingType}
        onChangeText={setBuildingType}
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
  errorText: { color: '#FF3B30', fontSize: 14, marginBottom: 10, fontWeight: '600' },
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
