import { Platform } from 'react-native';
import { randomUUID } from 'expo-crypto';
import { File, Paths } from 'expo-file-system';
import * as Sharing from 'expo-sharing';
import { api, unwrap, UserMessage } from '@/api/client';
import { session, SessionChangedError } from '@/api/session';

export async function exportAccount(): Promise<string> {
  const generation = session.generation();
  if (Platform.OS === 'web') return 'Data export is available in the phone app.';
  if (!(await Sharing.isAvailableAsync())) return 'Sharing is not available on this device.';
  if (session.generation() !== generation) throw new SessionChangedError();
  const data = unwrap(await api.GET('/v1/account/export'));
  if (session.generation() !== generation) throw new SessionChangedError();
  const file = new File(Paths.cache, `nua-crew-data-${randomUUID()}.json`);
  let shareError: unknown;
  let cleanupFailed = false;
  try {
    file.create({ overwrite: true });
    file.write(JSON.stringify(data, null, 2));
    await Sharing.shareAsync(file.uri, {
      mimeType: 'application/json',
      dialogTitle: 'Your NUA CREW data',
    });
  } catch (e) {
    shareError = e;
  } finally {
    try {
      if (file.exists) file.delete();
    } catch {
      cleanupFailed = true;
    }
  }
  if (cleanupFailed)
    throw new UserMessage(
      'The temporary export could not be removed. Clear the app cache before sharing this device.',
    );
  if (shareError) throw shareError;
  return 'Export opened in your share sheet.';
}
