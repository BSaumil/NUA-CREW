import { Platform } from 'react-native';
import * as SecureStore from 'expo-secure-store';

/**
 * Credential storage. Native: Keychain / Keystore via expo-secure-store.
 * Web: localStorage — this exists ONLY so the app can be exercised in a browser during
 * development and automated tests. The shipped product is the native app.
 *
 * Reads never throw (a failed read just means "no stored session"). Writes and deletes DO throw:
 * pretending a credential was stored or removed when it was not is how accounts leak.
 */
const web = Platform.OS === 'web';

export class CredentialStorageError extends Error {
  constructor(
    readonly operation: 'write' | 'delete',
    cause: unknown,
  ) {
    super(
      operation === 'delete'
        ? 'The device could not clear secure sign-in storage. Please try signing out again before sharing this device.'
        : 'The device could not save secure sign-in storage. Please try again.',
    );
    this.name = 'CredentialStorageError';
    this.cause = cause;
  }
}

export async function secureGet(key: string): Promise<string | null> {
  try {
    if (web) return globalThis.localStorage?.getItem(key) ?? null;
    return await SecureStore.getItemAsync(key);
  } catch {
    return null;
  }
}

export async function secureSet(key: string, value: string): Promise<void> {
  try {
    if (web) {
      globalThis.localStorage?.setItem(key, value);
      return;
    }
    await SecureStore.setItemAsync(key, value, {
      keychainAccessible: SecureStore.WHEN_UNLOCKED_THIS_DEVICE_ONLY,
    });
  } catch (e) {
    throw new CredentialStorageError('write', e);
  }
}

export async function secureDelete(key: string): Promise<void> {
  try {
    if (web) globalThis.localStorage?.removeItem(key);
    else await SecureStore.deleteItemAsync(key);
  } catch (e) {
    throw new CredentialStorageError('delete', e);
  }
}
