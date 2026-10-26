import * as Device from 'expo-device';
import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';
import { api, unwrapVoid } from '@/api/client';
import { EAS_PROJECT_ID } from '@/lib/config';
import { secureDelete, secureGet, secureSet } from '@/lib/storage';

const TOKEN_KEY = 'nua.pushtoken';

export type PushState = 'registered' | 'denied' | 'unsupported' | 'unconfigured' | 'error';

/** Show alerts that arrive while the app is open, quietly. */
export function configureForegroundNotifications() {
  Notifications.setNotificationHandler({
    handleNotification: async () => ({
      shouldShowBanner: true,
      shouldShowList: true,
      shouldPlaySound: false,
      shouldSetBadge: false,
    }),
  });
}

/**
 * Ask for permission (only when the user chose to enable alerts), fetch the Expo push token and
 * register it with the API. Never throws: push is a convenience, not a requirement.
 */
export async function enablePush(): Promise<PushState> {
  if (Platform.OS === 'web' || !Device.isDevice) return 'unsupported';
  if (!EAS_PROJECT_ID) return 'unconfigured'; // needs an EAS project (owner action)
  try {
    if (Platform.OS === 'android') {
      await Notifications.setNotificationChannelAsync('default', {
        name: 'Job alerts and application updates',
        importance: Notifications.AndroidImportance.DEFAULT,
      });
    }
    let { status } = await Notifications.getPermissionsAsync();
    if (status !== 'granted') ({ status } = await Notifications.requestPermissionsAsync());
    if (status !== 'granted') return 'denied';
    const { data: token } = await Notifications.getExpoPushTokenAsync({
      projectId: EAS_PROJECT_ID,
    });
    unwrapVoid(
      await api.POST('/v1/devices', {
        body: { token, platform: Platform.OS === 'ios' ? 'ios' : 'android' },
      }),
    );
    await secureSet(TOKEN_KEY, token);
    return 'registered';
  } catch {
    return 'error';
  }
}

/** Forget this phone on the server. Called on sign-out so the next user does not get our alerts. */
export async function disablePush(): Promise<void> {
  const token = await secureGet(TOKEN_KEY);
  if (!token) return;
  try {
    await api.DELETE('/v1/devices', {
      body: { token, platform: Platform.OS === 'ios' ? 'ios' : 'android' },
    });
  } catch {
    /* best effort; the server also drops tokens the provider reports as dead */
  }
  await secureDelete(TOKEN_KEY);
}
