// Single icon set, imported directly: the package index bundles every icon font family.
import Ionicons from '@expo/vector-icons/Ionicons';
import { Tabs } from 'expo-router';
import { useInboxSummary } from '@/api/queries';
import { useTheme } from '@/theme/ThemeProvider';
import { useTabBarStyle } from '@/ui/tab-bar';

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
  const tabBarStyle = useTabBarStyle();
  const inbox = useInboxSummary().data;
  const inboxUnread = (inbox?.unread_invitations ?? 0) + (inbox?.unread_conversations ?? 0);
  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: colors.primary,
        tabBarInactiveTintColor: colors.muted,
        tabBarStyle,
        tabBarLabelStyle: { fontFamily: 'Inter_600SemiBold', fontSize: 12 },
      }}
    >
      <Tabs.Screen name="index" options={{ href: null }} />
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
        name="inbox"
        options={{
          title: 'Inbox',
          tabBarIcon: icon('mail-outline', 'mail'),
          tabBarBadge: inboxUnread > 0 ? inboxUnread : undefined,
          tabBarBadgeStyle: { backgroundColor: colors.primary, color: colors.onPrimary },
          tabBarAccessibilityLabel: inboxUnread ? `Inbox, ${inboxUnread} unread` : 'Inbox',
        }}
      />
      {/* Reached from the bell on Discover and from notification taps. `href: null` would remove the
          route itself, so hide only the tab button. */}
      <Tabs.Screen name="alerts" options={{ title: 'Notifications', tabBarButton: () => null }} />
      <Tabs.Screen
        name="profile"
        options={{ title: 'Profile', tabBarIcon: icon('person-outline', 'person') }}
      />
    </Tabs>
  );
}
