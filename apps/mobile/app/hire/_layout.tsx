import Ionicons from '@expo/vector-icons/Ionicons';
import { Tabs } from 'expo-router';
import { useHireWorkspace } from '@/state/HireWorkspace';
import { useTheme } from '@/theme/ThemeProvider';
import { useTabBarStyle } from '@/ui/tab-bar';

export default function HireTabs() {
  const { colors } = useTheme();
  const tabBarStyle = useTabBarStyle();
  const { employerId } = useHireWorkspace();
  return (
    <Tabs
      key={employerId}
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: colors.primary,
        tabBarInactiveTintColor: colors.muted,
        tabBarStyle,
        tabBarLabelStyle: { fontFamily: 'Inter_600SemiBold', fontSize: 12 },
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: 'Jobs',
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="briefcase-outline" color={color as string} size={size} />
          ),
        }}
      />
      <Tabs.Screen
        name="talent"
        options={{
          title: 'Find people',
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="people-outline" color={color as string} size={size} />
          ),
        }}
      />
      <Tabs.Screen
        name="inbox"
        options={{
          title: 'Inbox',
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="chatbubbles-outline" color={color as string} size={size} />
          ),
        }}
      />
      <Tabs.Screen
        name="business"
        options={{
          title: 'Business',
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="storefront-outline" color={color as string} size={size} />
          ),
        }}
      />
    </Tabs>
  );
}
