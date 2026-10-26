import * as Location from 'expo-location';
import { roundCoord } from './filters';

export type NearResult =
  { ok: true; lat: number; lng: number } | { ok: false; reason: 'denied' | 'unavailable' };

/**
 * One-off approximate position for "Near me". Foreground only, coarse accuracy, rounded to ~1 km,
 * used for the request and never stored on the server or the device.
 */
export async function getApproximatePosition(): Promise<NearResult> {
  try {
    const perm = await Location.requestForegroundPermissionsAsync();
    if (perm.status !== 'granted') return { ok: false, reason: 'denied' };
    const pos =
      (await Location.getLastKnownPositionAsync({ maxAge: 10 * 60_000 })) ??
      (await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Low }));
    if (!pos) return { ok: false, reason: 'unavailable' };
    return {
      ok: true,
      lat: roundCoord(pos.coords.latitude),
      lng: roundCoord(pos.coords.longitude),
    };
  } catch {
    return { ok: false, reason: 'unavailable' };
  }
}
