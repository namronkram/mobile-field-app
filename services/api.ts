import AsyncStorage from '@react-native-async-storage/async-storage';

const API_URL = process.env.EXPO_PUBLIC_API_URL || 'http://localhost:8000';

interface LoginResponse {
  access_token: string;
  refresh_token: string;
  user: any;
}

interface QueueItem {
  id: string;
  type: 'photo' | 'audit';
  data: any;
  timestamp: number;
  retries?: number;
}

class ApiClient {
  private baseUrl: string;
  private accessToken: string | null = null;

  constructor(baseUrl: string) {
    this.baseUrl = baseUrl;
    this.loadToken();
  }

  private async loadToken() {
    try {
      const token = await AsyncStorage.getItem('access_token');
      if (token) this.accessToken = token;
    } catch (e) {
      console.error('Failed to load token', e);
    }
  }

  async login(email: string, password: string): Promise<LoginResponse> {
    const resp = await fetch(`${this.baseUrl}/api/v1/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password }),
    });
    if (!resp.ok) throw new Error('Login failed');
    const data = await resp.json();
    this.accessToken = data.access_token;
    await AsyncStorage.setItem('access_token', data.access_token);
    await AsyncStorage.setItem('refresh_token', data.refresh_token);
    return data;
  }

  async get(path: string) {
    return this.fetchWithAuth(path, { method: 'GET' });
  }

  async post(path: string, body: any) {
    return this.fetchWithAuth(path, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
  }

  async uploadPhoto(photoUri: string, fileName: string): Promise<Response> {
    const formData = new FormData();
    formData.append('file', {
      uri: photoUri,
      name: fileName,
      type: 'image/jpeg',
    } as any);
    
    return fetch(`${this.baseUrl}/api/v1/upload/photo`, {
      method: 'POST',
      body: formData,
      headers: {
        'Content-Type': 'multipart/form-data',
        ...(this.accessToken ? { 'Authorization': `Bearer ${this.accessToken}` } : {}),
      },
    });
  }

  // Queue a photo for offline sync
  async queuePhoto(photoUri: string, fileName: string): Promise<void> {
    const queueItem: QueueItem = {
      id: `photo_${Date.now()}`,
      type: 'photo',
      data: { uri: photoUri, name: fileName },
      timestamp: Date.now(),
      retries: 0,
    };
    
    try {
      const raw = await AsyncStorage.getItem('offline_queue');
      const queue: QueueItem[] = raw ? JSON.parse(raw) : [];
      queue.push(queueItem);
      await AsyncStorage.setItem('offline_queue', JSON.stringify(queue));
    } catch (e) {
      console.error('Failed to queue photo', e);
    }
  }

  // Sync all queued items
  async syncQueue(): Promise<{ success: number; failed: number }> {
    const raw = await AsyncStorage.getItem('offline_queue');
    if (!raw) return { success: 0, failed: 0 };
    
    const queue: QueueItem[] = JSON.parse(raw);
    let success = 0;
    let failed = 0;
    const remaining: QueueItem[] = [];

    for (const item of queue) {
      try {
        if (item.type === 'photo') {
          const resp = await this.uploadPhoto(item.data.uri, item.data.name);
          if (resp.ok) {
            success++;
          } else {
            throw new Error('Upload failed');
          }
        } else {
          // Handle other types (audit, etc.)
          remaining.push(item);
        }
      } catch (e) {
        // Retry up to 3 times
        if ((item.retries || 0) < 3) {
          item.retries = (item.retries || 0) + 1;
          remaining.push(item);
        } else {
          failed++;
        }
      }
    }

    // Save remaining items
    await AsyncStorage.setItem('offline_queue', JSON.stringify(remaining));
    
    return { success, failed };
  }

  // Get queue status
  async getQueueStatus(): Promise<{ count: number; items: QueueItem[] }> {
    const raw = await AsyncStorage.getItem('offline_queue');
    if (!raw) return { count: 0, items: [] };
    const items: QueueItem[] = JSON.parse(raw);
    return { count: items.length, items };
  }

  private async fetchWithAuth(path: string, options: RequestInit) {
    const headers: any = { ...options.headers };
    if (this.accessToken) {
      headers['Authorization'] = `Bearer ${this.accessToken}`;
    }
    const resp = await fetch(`${this.baseUrl}${path}`, {
      ...options,
      headers,
    });
    if (resp.status === 401) {
      // try refresh
      const refreshed = await this.refreshToken();
      if (refreshed) {
        // retry
        headers['Authorization'] = `Bearer ${this.accessToken}`;
        return fetch(`${this.baseUrl}${path}`, { ...options, headers });
      }
    }
    return resp;
  }

  private async refreshToken(): Promise<boolean> {
    try {
      const refreshToken = await AsyncStorage.getItem('refresh_token');
      if (!refreshToken) return false;
      const resp = await fetch(`${this.baseUrl}/api/v1/auth/refresh`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ refresh_token: refreshToken }),
      });
      if (!resp.ok) return false;
      const data = await resp.json();
      this.accessToken = data.access_token;
      await AsyncStorage.setItem('access_token', data.access_token);
      return true;
    } catch {
      return false;
    }
  }

  async logout() {
    this.accessToken = null;
    await AsyncStorage.removeItem('access_token');
    await AsyncStorage.removeItem('refresh_token');
  }
}

export const api = new ApiClient(API_URL);
