import { Ionicons } from '@expo/vector-icons';
import { Tabs } from 'expo-router';
import { useNotifications } from '@/api/queries';
import { useTheme } from '@/theme/ThemeProvider';

type IconName = React.ComponentProps<typeof Ionicons>['name'];
const icon =
  (name: IconName, focused: IconName) =>
  ({ color, focused: f, size }: { color: unknown; focused: boolean; size: number }) => (
    <Ionicons name={f ? focused : name} size={size} color={color as string} />
  );

// Tabs open on Discover, not on whichever file sorts first alphabetically.
export const unstable_settings = { initialRouteName: 'discover' };

export default function AppTabs() {
  const { colors } = useTheme();
  const { data } = useNotifications();
  const unread = data?.filter((n) => !n.read_at).length ?? 0;
  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: colors.primary,
        tabBarInactiveTintColor: colors.muted,
        tabBarStyle: { backgroundColor: colors.surface, borderTopColor: colors.border },
        tabBarLabelStyle: { fontFamily: 'Inter_600SemiBold', fontSize: 12 },
      }}
    >
      <Tabs.Screen
        name="discover"
        options={{ title: 'Discover', tabBarIcon: icon('search-outline', 'search') }}
      />
      <Tabs.Screen
        name="saved"
        options={{ title: 'Saved', tabBarIcon: icon('heart-outline', 'heart') }}
      />
      <Tabs.Screen
        name="applications"
        options={{
          title: 'Applications',
          tabBarIcon: icon('document-text-outline', 'document-text'),
        }}
      />
      <Tabs.Screen
        name="alerts"
        options={{
          title: 'Alerts',
          tabBarIcon: icon('notifications-outline', 'notifications'),
          tabBarBadge: unread > 0 ? unread : undefined,
          tabBarBadgeStyle: { backgroundColor: colors.primary, color: colors.onPrimary },
          tabBarAccessibilityLabel: unread ? `Alerts, ${unread} unread` : 'Alerts',
        }}
      />
      <Tabs.Screen
        name="profile"
        options={{ title: 'Profile', tabBarIcon: icon('person-outline', 'person') }}
      />
    </Tabs>
  );
}
