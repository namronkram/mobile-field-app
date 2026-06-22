// Platform-safe storage utility
// Uses AsyncStorage on native, localStorage on web

export async function getItem(key: string): Promise<string | null> {
  if (typeof window !== 'undefined' && window.localStorage) {
    // Web: use localStorage
    return localStorage.getItem(key);
  } else {
    // Native: use AsyncStorage (dynamic import to avoid web bundling)
    const { default: AsyncStorage } = await import('@react-native-async-storage/async-storage');
    return await AsyncStorage.getItem(key);
  }
}

export async function setItem(key: string, value: string): Promise<void> {
  if (typeof window !== 'undefined' && window.localStorage) {
    localStorage.setItem(key, value);
  } else {
    const { default: AsyncStorage } = await import('@react-native-async-storage/async-storage');
    await AsyncStorage.setItem(key, value);
  }
}

export async function removeItem(key: string): Promise<void> {
  if (typeof window !== 'undefined' && window.localStorage) {
    localStorage.removeItem(key);
  } else {
    const { default: AsyncStorage } = await import('@react-native-async-storage/async-storage');
    await AsyncStorage.removeItem(key);
  }
}
