// Web-compatible storage wrapper
// Uses AsyncStorage on native, localStorage on web

let storage: any;

if (typeof window !== 'undefined' && window.localStorage) {
  // Web: use localStorage
  storage = {
    async getItem(key: string): Promise<string | null> {
      return localStorage.getItem(key);
    },
    async setItem(key: string, value: string): Promise<void> {
      localStorage.setItem(key, value);
    },
    async removeItem(key: string): Promise<void> {
      localStorage.removeItem(key);
    },
    async clear(): Promise<void> {
      localStorage.clear();
    },
  };
} else {
  // Native: use AsyncStorage (will be imported dynamically)
  storage = null;
}

export const getStorage = async () => {
  if (storage) return storage;
  
  // Dynamically import AsyncStorage only on native
  const { default: AsyncStorage } = await import('@react-native-async-storage/async-storage');
  storage = AsyncStorage;
  return storage;
};

export default storage;
