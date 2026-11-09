import * as SecureStore from 'expo-secure-store';
import { Platform } from 'react-native';

const TOKEN_KEY = 'kirimin_auth_token';
let memoryToken: string | null = null;

export async function saveToken(token: string): Promise<void> {
  memoryToken = token;
  try {
    if (Platform.OS !== 'web') {
      await SecureStore.setItemAsync(TOKEN_KEY, token);
    } else if (typeof window !== 'undefined' && window.localStorage) {
      window.localStorage.setItem(TOKEN_KEY, token);
    }
  } catch (err) {
    console.warn('Could not persist auth token securely:', err);
  }
}

export async function getToken(): Promise<string | null> {
  if (memoryToken) return memoryToken;
  try {
    if (Platform.OS !== 'web') {
      const stored = await SecureStore.getItemAsync(TOKEN_KEY);
      if (stored) {
        memoryToken = stored;
        return stored;
      }
    } else if (typeof window !== 'undefined' && window.localStorage) {
      const stored = window.localStorage.getItem(TOKEN_KEY);
      if (stored) {
        memoryToken = stored;
        return stored;
      }
    }
  } catch (err) {
    console.warn('Could not read auth token:', err);
  }
  return memoryToken;
}

export async function removeToken(): Promise<void> {
  memoryToken = null;
  try {
    if (Platform.OS !== 'web') {
      await SecureStore.deleteItemAsync(TOKEN_KEY);
    } else if (typeof window !== 'undefined' && window.localStorage) {
      window.localStorage.removeItem(TOKEN_KEY);
    }
  } catch (err) {
    console.warn('Could not remove auth token:', err);
  }
}
