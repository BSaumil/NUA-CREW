import { Alert } from 'react-native';
import type { SignOutResult } from '@/state/AuthProvider';

/**
 * The person is always signed out by the time this runs. If the OS refused to delete the saved
 * credential we say so instead of pretending: the server-side token has already been revoked, but
 * they may want to remove the app or restart the phone.
 */
export function reportSignOut(result: SignOutResult): void {
  if (result.credentialsRemoved) return;
  Alert.alert(
    'Signed out, with a warning',
    'You are signed out and your session has been ended on our servers, but this phone would not let NUA CREW delete its saved sign-in. Restarting the phone, or removing and reinstalling the app, will clear it.',
  );
}
