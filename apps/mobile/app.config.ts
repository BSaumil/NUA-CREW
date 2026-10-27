import type { ExpoConfig } from 'expo/config';

// Bundle identifiers below are PROVISIONAL placeholders. Real identifiers must be registered with
// Apple/Google by the owner (an external action) and the brand must be cleared first.
const IOS_BUNDLE_ID = process.env.NUA_IOS_BUNDLE_ID ?? 'com.example.nuacrew';
const ANDROID_PACKAGE = process.env.NUA_ANDROID_PACKAGE ?? 'com.example.nuacrew';

// Fail before creating a distributable build with a placeholder identity or API endpoint.
// Development Metro exports remain available without store credentials.
const DISTRIBUTABLE_PROFILES = new Set(['preview', 'production', 'development-device']);
if (DISTRIBUTABLE_PROFILES.has(process.env.EAS_BUILD_PROFILE ?? '')) {
  let endpoint: URL;
  try {
    endpoint = new URL(process.env.EXPO_PUBLIC_API_URL ?? '');
  } catch {
    throw new Error('Set EXPO_PUBLIC_API_URL to the approved HTTPS API before this build.');
  }
  if (
    endpoint.protocol !== 'https:' ||
    /(^|\.)(localhost|invalid)$/.test(endpoint.hostname) ||
    /^(127\.|10\.|192\.168\.|0\.)/.test(endpoint.hostname)
  ) {
    throw new Error('Distributable builds require an approved public HTTPS API endpoint.');
  }
  if (
    IOS_BUNDLE_ID.startsWith('com.example.') ||
    ANDROID_PACKAGE.startsWith('com.example.') ||
    !/^[A-Za-z0-9-]+(?:\.[A-Za-z0-9-]+)+$/.test(IOS_BUNDLE_ID) ||
    !/^[A-Za-z][A-Za-z0-9_]*(?:\.[A-Za-z][A-Za-z0-9_]*)+$/.test(ANDROID_PACKAGE)
  ) {
    throw new Error('Set the owner-approved NUA_IOS_BUNDLE_ID and NUA_ANDROID_PACKAGE.');
  }
  if (
    !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(
      process.env.NUA_EAS_PROJECT_ID ?? '',
    )
  ) {
    throw new Error('Set NUA_EAS_PROJECT_ID to the owner-approved EAS project identifier.');
  }
}

const config: ExpoConfig = {
  name: 'NUA CREW',
  slug: 'nua-crew',
  scheme: 'nuacrew',
  version: '0.1.0',
  orientation: 'portrait',
  userInterfaceStyle: 'automatic',
  icon: './assets/icon.png',
  backgroundColor: '#F7F3EF',
  ios: {
    bundleIdentifier: IOS_BUNDLE_ID,
    supportsTablet: false,
    infoPlist: {
      ITSAppUsesNonExemptEncryption: false, // HTTPS only; standard OS crypto
      NSLocationWhenInUseUsageDescription:
        'NUA CREW uses your approximate location to show jobs near you. It is not stored.',
      NSFaceIDUsageDescription: 'Unlock NUA CREW with Face ID to protect your applications.',
    },
  },
  android: {
    package: ANDROID_PACKAGE,
    adaptiveIcon: {
      foregroundImage: './assets/adaptive-icon.png',
      backgroundColor: '#3C0B21',
    },
    permissions: [
      'ACCESS_COARSE_LOCATION',
      'POST_NOTIFICATIONS',
      'USE_BIOMETRIC',
      'USE_FINGERPRINT',
    ],
    blockedPermissions: [
      'ACCESS_FINE_LOCATION',
      'RECORD_AUDIO',
      'CAMERA',
      'READ_EXTERNAL_STORAGE',
      'WRITE_EXTERNAL_STORAGE',
      'SYSTEM_ALERT_WINDOW',
    ],
  },
  web: { bundler: 'metro', output: 'single', favicon: './assets/favicon.png' },
  plugins: [
    'expo-router',
    'expo-secure-store',
    'expo-font',
    [
      'expo-splash-screen',
      { image: './assets/splash-icon.png', imageWidth: 220, backgroundColor: '#3C0B21' },
    ],
    'expo-web-browser',
    [
      'expo-notifications',
      { icon: './assets/notification-icon.png', color: '#6B1738', defaultChannel: 'default' },
    ],
    ['expo-local-authentication', { faceIDPermission: 'Unlock NUA CREW with Face ID.' }],
    [
      'expo-location',
      {
        locationWhenInUsePermission: 'Show jobs near you. Your location is not stored.',
        // Only "while using the app" location is ever requested: drop every other permission.
        locationAlwaysAndWhenInUsePermission: false,
        locationAlwaysPermission: false,
        motionUsagePermission: false,
        locationFullAccuracyPermission: false,
        isIosReducedAccuracyByDefault: true, // approximate location is all "near me" needs
        isAndroidBackgroundLocationEnabled: false,
        isAndroidForegroundServiceEnabled: false,
      },
    ],
    ['expo-build-properties', { android: { minSdkVersion: 26 } }],
  ],
  experiments: { typedRoutes: true },
  extra: {
    apiUrl: process.env.EXPO_PUBLIC_API_URL ?? 'http://localhost:8000',
    // Set once an EAS project exists (needed for Expo push tokens).
    eas: { projectId: process.env.NUA_EAS_PROJECT_ID },
  },
};

export default config;
