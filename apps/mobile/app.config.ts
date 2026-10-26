import type { ExpoConfig } from 'expo/config';

// Bundle identifiers below are PROVISIONAL placeholders. Real identifiers must be registered with
// Apple/Google by the owner (an external action) and the brand must be cleared first.
const IOS_BUNDLE_ID = process.env.NUA_IOS_BUNDLE_ID ?? 'com.example.nuacrew';
const ANDROID_PACKAGE = process.env.NUA_ANDROID_PACKAGE ?? 'com.example.nuacrew';

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
    blockedPermissions: ['ACCESS_FINE_LOCATION', 'RECORD_AUDIO', 'CAMERA'],
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
      { locationWhenInUsePermission: 'Show jobs near you. Your location is not stored.' },
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
