import Constants from 'expo-constants';

/** API origin. Android emulators reach the host machine at 10.0.2.2; set EXPO_PUBLIC_API_URL. */
export const API_URL: string =
  (Constants.expoConfig?.extra?.apiUrl as string | undefined) ?? 'http://localhost:8000';

export const EAS_PROJECT_ID: string | undefined = Constants.expoConfig?.extra?.eas?.projectId;
export const REQUEST_TIMEOUT_MS = 15_000;
