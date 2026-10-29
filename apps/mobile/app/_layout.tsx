// Import only the weights the UI uses. The package's index pulls in every weight and italic
// (dozens of font files) and would ship them all in the app.
import { Inter_400Regular } from '@expo-google-fonts/inter/400Regular';
import { Inter_500Medium } from '@expo-google-fonts/inter/500Medium';
import { Inter_600SemiBold } from '@expo-google-fonts/inter/600SemiBold';
import { Manrope_700Bold } from '@expo-google-fonts/manrope/700Bold';
import { Manrope_800ExtraBold } from '@expo-google-fonts/manrope/800ExtraBold';
import { useFonts } from 'expo-font';
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
import { HireWorkspaceProvider } from '@/state/HireWorkspace';
import { LockScreen } from '@/features/LockScreen';

void SplashScreen.preventAutoHideAsync();
configureForegroundNotifications();

onlineManager.setEventListener((setOnline) => {
  if (Platform.OS === 'web') {
    // NetInfo cannot see browser offline mode reliably; the window events can.
    const on = () => setOnline(true);
    const off = () => setOnline(false);
    window.addEventListener('online', on);
    window.addEventListener('offline', off);
    setOnline(navigator.onLine);
    return () => {
      window.removeEventListener('online', on);
      window.removeEventListener('offline', off);
    };
  }
  return NetInfo.addEventListener((s) => setOnline(s.isConnected !== false));
});

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
  const [fontsLoaded] = useFonts({
    Manrope_700Bold,
    Manrope_800ExtraBold,
    Inter_400Regular,
    Inter_500Medium,
    Inter_600SemiBold,
  });
  const fontsReady = fontsLoaded || Platform.OS === 'web';

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
            <HireWorkspaceProvider>
              <FiltersProvider>{fontsReady ? <Gate /> : null}</FiltersProvider>
            </HireWorkspaceProvider>
          </AuthProvider>
        </ThemeProvider>
      </PersistQueryClientProvider>
    </SafeAreaProvider>
  );
}

function Gate() {
  const { status, locked, role } = useAuth();
  const { colors, scheme } = useTheme();
  const router = useRouter();

  useEffect(() => {
    if (status !== 'loading') void SplashScreen.hideAsync();
  }, [status]);

  // Tapping a push notification opens the right screen, including from a cold start.
  useEffect(() => {
    if (status !== 'signedIn' || role !== 'candidate' || Platform.OS === 'web') return;
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
  }, [status, role, router]);

  if (status === 'loading') return <View style={{ flex: 1, backgroundColor: colors.bg }} />;

  return (
    <View style={{ flex: 1, backgroundColor: colors.bg }}>
      <StatusBar style={scheme === 'dark' ? 'light' : 'dark'} />
      <Stack
        screenOptions={{
          headerShown: false,
          contentStyle: { backgroundColor: colors.bg },
          headerTintColor: colors.primary,
          headerStyle: { backgroundColor: colors.surface },
          headerTitleStyle: { color: colors.text },
        }}
      >
        <Stack.Protected guard={status === 'signedIn' && role === 'candidate'}>
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
          <Stack.Screen
            name="work-preferences"
            options={{
              headerShown: true,
              title: 'Work preferences',
              headerTintColor: colors.primary,
              headerStyle: { backgroundColor: colors.surface },
              headerTitleStyle: { color: colors.text },
            }}
          />
          <Stack.Screen
            name="availability"
            options={{
              headerShown: true,
              title: 'Availability',
              headerTintColor: colors.primary,
              headerStyle: { backgroundColor: colors.surface },
              headerTitleStyle: { color: colors.text },
            }}
          />
          <Stack.Screen name="my-shifts" options={{ headerShown: true, title: 'My shifts' }} />
          <Stack.Screen
            name="employer-preferences"
            options={{
              headerShown: true,
              title: 'Employers',
              headerTintColor: colors.primary,
              headerStyle: { backgroundColor: colors.surface },
              headerTitleStyle: { color: colors.text },
            }}
          />
          <Stack.Screen
            name="invitation/[id]"
            options={{
              headerShown: true,
              title: 'Invitation',
              headerTintColor: colors.primary,
              headerStyle: { backgroundColor: colors.surface },
              headerTitleStyle: { color: colors.text },
            }}
          />
          <Stack.Screen
            name="conversation/[id]"
            options={{
              headerShown: true,
              title: 'Conversation',
              headerTintColor: colors.primary,
              headerStyle: { backgroundColor: colors.surface },
              headerTitleStyle: { color: colors.text },
            }}
          />
        </Stack.Protected>
        <Stack.Protected guard={status === 'signedIn' && role === 'employer'}>
          <Stack.Screen name="hire" />
          <Stack.Screen
            name="hire-shifts"
            options={{ headerShown: true, title: 'Shifts and hours' }}
          />
          <Stack.Screen
            name="hire-post"
            options={{ headerShown: true, title: 'Your job advertisement' }}
          />
          <Stack.Screen name="hire-job/[id]" options={{ headerShown: true, title: 'Manage job' }} />
          <Stack.Screen
            name="hire-applicant/[id]"
            options={{ headerShown: true, title: 'Applicant' }}
          />
          <Stack.Screen
            name="hire-thread/[id]"
            options={{ headerShown: true, title: 'Conversation' }}
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
