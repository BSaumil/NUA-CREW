import { Platform } from 'react-native';
import * as SecureStore from 'expo-secure-store';

/**
 * Credential storage. Native: Keychain / Keystore via expo-secure-store.
 * Web: localStorage — this exists ONLY so the app can be exercised in a browser during
 * development and automated tests. The shipped product is the native app.
 */
const web = Platform.OS === 'web';

export async function secureGet(key: string): Promise<string | null> {
  try {
    if (web) return globalThis.localStorage?.getItem(key) ?? null;
    return await SecureStore.getItemAsync(key);
  } catch {
    return null;
  }
}

export async function secureSet(key: string, value: string): Promise<void> {
  if (web) {
    globalThis.localStorage?.setItem(key, value);
    return;
  }
  await SecureStore.setItemAsync(key, value, {
    keychainAccessible: SecureStore.WHEN_UNLOCKED_THIS_DEVICE_ONLY,
  });
}

export async function secureDelete(key: string): Promise<void> {
  try {
    if (web) globalThis.localStorage?.removeItem(key);
    else await SecureStore.deleteItemAsync(key);
  } catch {
    /* nothing to delete */
  }
}
