import { View, Text, Button } from 'react-native';
import { useState } from 'react';

export default function TestApi() {
  const [result, setResult] = useState('');
  
  const testApi = async () => {
    try {
      const resp = await fetch('http://localhost:8000/health');
      const data = await resp.json();
      setResult(JSON.stringify(data));
    } catch (e: any) {
      setResult('Error: ' + e.message);
    }
  };
  
  return (
    <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
      <Text style={{ fontSize: 18, marginBottom: 20 }}>API Test</Text>
      <Button title="Test API" onPress={testApi} />
      <Text style={{ marginTop: 20 }}>{result}</Text>
    </View>
  );
}
