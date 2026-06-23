// Platform-safe storage: localStorage on web, AsyncStorage on native
let storage: any = null;

const getStorage = async () => {
  if (storage) return storage;
  
  if (typeof window !== 'undefined' && window.localStorage) {
    // Web: use localStorage
    storage = {
      getItem: async (key: string) => localStorage.getItem(key),
      setItem: async (key: string, value: string) => localStorage.setItem(key, value),
      removeItem: async (key: string) => localStorage.removeItem(key),
    };
  } else {
    // Native: dynamic import to avoid web bundling
    const { default: AsyncStorage } = await import('@react-native-async-storage/async-storage');
    storage = AsyncStorage;
  }
  
  return storage;
};

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
  public baseUrl: string;
  private accessToken: string | null = null;

  constructor(baseUrl: string) {
    this.baseUrl = baseUrl;
    this.loadToken();
  }

  private async loadToken() {
    try {
      const storage = await getStorage();
      const token = await storage.getItem('access_token');
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
    const storage = await getStorage();
    await storage.setItem('access_token', data.access_token);
    await storage.setItem('refresh_token', data.refresh_token);
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
      id: `photo_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      type: 'photo',
      data: { uri: photoUri, name: fileName },
      timestamp: Date.now(),
      retries: 0,
    };
    
    try {
      const storage = await getStorage();
      const raw = await storage.getItem('offline_queue');
      const queue: QueueItem[] = raw ? JSON.parse(raw) : [];
      queue.push(queueItem);
      await storage.setItem('offline_queue', JSON.stringify(queue));
    } catch (e) {
      console.error('Failed to queue photo', e);
    }
  }

  // Sync all queued items
  async syncQueue(): Promise<{ success: number; failed: number }> {
    const storage = await getStorage();
    const raw = await storage.getItem('offline_queue');
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
          remaining.push(item);
        }
      } catch (e) {
        if ((item.retries || 0) < 3) {
          item.retries = (item.retries || 0) + 1;
          remaining.push(item);
        } else {
          failed++;
        }
      }
    }

    await storage.setItem('offline_queue', JSON.stringify(remaining));
    
    return { success, failed };
  }

  // Get queue status
  async getQueueStatus(): Promise<{ count: number; items: QueueItem[] }> {
    const storage = await getStorage();
    const raw = await storage.getItem('offline_queue');
    if (!raw) return { count: 0, items: [] };
    const items: QueueItem[] = JSON.parse(raw);
    return { count: items.length, items };
  }

  // Remove item from queue (used by Queue tab + Photos tab)
  async removeQueuedItem(id: string): Promise<void> {
    const storage = await getStorage();
    const raw = await storage.getItem('offline_queue');
    if (!raw) return;
    const queue: QueueItem[] = JSON.parse(raw);
    const updated = queue.filter(item => item.id !== id);
    await storage.setItem('offline_queue', JSON.stringify(updated));
  }

  // Get storage (public for use in components)
  async getStorage() {
    return await getStorage();
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
      const refreshed = await this.refreshToken();
      if (refreshed) {
        headers['Authorization'] = `Bearer ${this.accessToken}`;
        return fetch(`${this.baseUrl}${path}`, { ...options, headers });
      }
    }
    return resp;
  }

  private async refreshToken(): Promise<boolean> {
    try {
      const storage = await getStorage();
      const refreshToken = await storage.getItem('refresh_token');
      if (!refreshToken) return false;
      const resp = await fetch(`${this.baseUrl}/api/v1/auth/refresh`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ refresh_token: refreshToken }),
      });
      if (!resp.ok) return false;
      const data = await resp.json();
      this.accessToken = data.access_token;
      await storage.setItem('access_token', data.access_token);
      return true;
    } catch {
      return false;
    }
  }

  async logout() {
    this.accessToken = null;
    const storage = await getStorage();
    await storage.removeItem('access_token');
    await storage.removeItem('refresh_token');
  }
}

export const api = new ApiClient(API_URL);
