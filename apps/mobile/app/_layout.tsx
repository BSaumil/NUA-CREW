import {
  Inter_400Regular,
  Inter_500Medium,
  Inter_600SemiBold,
  useFonts as useInter,
} from '@expo-google-fonts/inter';
import {
  Manrope_700Bold,
  Manrope_800ExtraBold,
  useFonts as useManrope,
} from '@expo-google-fonts/manrope';
import AsyncStorage from '@react-native-async-storage/async-storage';
import NetInfo from '@react-native-community/netinfo';
import { createAsyncStoragePersister } from '@tanstack/query-async-storage-persister';
import { onlineManager, QueryClient } from '@tanstack/react-query';
import { PersistQueryClientProvider } from '@tanstack/react-query-persist-client';
import { Stack, useRouter } from 'expo-router';
import * as Notifications from 'expo-notifications';
import * as SplashScreen from 'expo-splash-screen';
import { StatusBar } from 'expo-status-bar';
import { useEffect } from 'react';
import { Platform, View } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { configureForegroundNotifications } from '@/features/push';
import { routeFor } from '@/features/links';
import { AuthProvider, useAuth } from '@/state/AuthProvider';
import { FiltersProvider } from '@/state/FiltersProvider';
import { ThemeProvider, useTheme } from '@/theme/ThemeProvider';
import { LockScreen } from '@/features/LockScreen';

void SplashScreen.preventAutoHideAsync();
configureForegroundNotifications();

onlineManager.setEventListener((setOnline) =>
  NetInfo.addEventListener((s) => setOnline(s.isConnected !== false)),
);

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 60_000,
      gcTime: 24 * 3600_000,
      retry: (count, err) => count < 2 && !(err as { status?: number }).status,
    },
  },
});

const persister = createAsyncStoragePersister({
  storage: AsyncStorage,
  key: 'REACT_QUERY_OFFLINE_CACHE',
});

/**
 * Only public job data is written to disk for offline reading. Applications, profile, resumes,
 * notifications and saved items stay in memory: AsyncStorage is not encrypted.
 */
const PERSISTED = new Set(['jobs', 'job']);

export default function RootLayout() {
  const [manrope] = useManrope({ Manrope_700Bold, Manrope_800ExtraBold });
  const [inter] = useInter({ Inter_400Regular, Inter_500Medium, Inter_600SemiBold });
  const fontsReady = (manrope && inter) || Platform.OS === 'web';

  return (
    <SafeAreaProvider>
      <PersistQueryClientProvider
        client={queryClient}
        persistOptions={{
          persister,
          maxAge: 24 * 3600_000,
          dehydrateOptions: {
            shouldDehydrateQuery: (q) =>
              q.state.status === 'success' && PERSISTED.has(String(q.queryKey[0])),
          },
        }}
      >
        <ThemeProvider>
          <AuthProvider>
            <FiltersProvider>{fontsReady ? <Gate /> : null}</FiltersProvider>
          </AuthProvider>
        </ThemeProvider>
      </PersistQueryClientProvider>
    </SafeAreaProvider>
  );
}

function Gate() {
  const { status, locked } = useAuth();
  const { colors, scheme } = useTheme();
  const router = useRouter();

  useEffect(() => {
    if (status !== 'loading') void SplashScreen.hideAsync();
  }, [status]);

  // Tapping a push notification opens the right screen, including from a cold start.
  useEffect(() => {
    if (status !== 'signedIn' || Platform.OS === 'web') return;
    const open = (r: Notifications.NotificationResponse | null) => {
      const c = r?.notification.request.content;
      if (c)
        router.push(
          routeFor(
            (c.data as { kind?: string } | undefined)?.kind,
            c.data as Record<string, unknown>,
          ),
        );
    };
    void Notifications.getLastNotificationResponseAsync().then(open);
    const sub = Notifications.addNotificationResponseReceivedListener(open);
    return () => sub.remove();
  }, [status, router]);

  if (status === 'loading') return <View style={{ flex: 1, backgroundColor: colors.bg }} />;

  return (
    <View style={{ flex: 1, backgroundColor: colors.bg }}>
      <StatusBar style={scheme === 'dark' ? 'light' : 'dark'} />
      <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: colors.bg } }}>
        <Stack.Protected guard={status === 'signedIn'}>
          <Stack.Screen name="(app)" />
          <Stack.Screen
            name="job/[id]"
            options={{
              headerShown: true,
              title: 'Job',
              headerTintColor: colors.primary,
              headerStyle: { backgroundColor: colors.surface },
              headerTitleStyle: { color: colors.text },
            }}
          />
          <Stack.Screen
            name="application/[id]"
            options={{
              headerShown: true,
              title: 'Application',
              headerTintColor: colors.primary,
              headerStyle: { backgroundColor: colors.surface },
              headerTitleStyle: { color: colors.text },
            }}
          />
          <Stack.Screen
            name="filters"
            options={{
              presentation: 'modal',
              headerShown: true,
              title: 'Filters',
              headerTintColor: colors.primary,
              headerStyle: { backgroundColor: colors.surface },
              headerTitleStyle: { color: colors.text },
            }}
          />
          <Stack.Screen
            name="settings"
            options={{
              headerShown: true,
              title: 'Settings',
              headerTintColor: colors.primary,
              headerStyle: { backgroundColor: colors.surface },
              headerTitleStyle: { color: colors.text },
            }}
          />
        </Stack.Protected>
        <Stack.Protected guard={status === 'signedOut'}>
          <Stack.Screen name="(auth)" />
        </Stack.Protected>
      </Stack>
      {locked && status === 'signedIn' ? <LockScreen /> : null}
    </View>
  );
}
