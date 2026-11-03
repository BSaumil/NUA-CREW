import { useRouter } from 'expo-router';
import { RefreshControl } from 'react-native';
import { useProfile, useApplications, useNotifications } from '@/api/queries';
import { useDocuments } from '@/api/documents';
import { useMyBookings } from '@/api/shifts';
import { ActionTile } from '@/ui/hire';
import { Button, Card, ErrorState, OfflineBanner, Row, Screen, Text } from '@/ui';
import { useTheme } from '@/theme/ThemeProvider';
export default function Dashboard() {
  const router = useRouter();
  const { colors } = useTheme();
  const profile = useProfile();
  const applications = useApplications();
  const updates = useNotifications();
  const bookings = useMyBookings();
  const docs = useDocuments();
  const resources = [profile, applications, updates, bookings, docs];
  const refresh = () => resources.forEach((q) => void q.refetch());
  const next = bookings.data
    ?.filter((b) => b.status === 'confirmed' && new Date(b.shift.ends_at).getTime() > Date.now())
    .sort((a, b) => a.shift.starts_at.localeCompare(b.shift.starts_at))[0];
  return (
    <Screen
      refreshControl={
        <RefreshControl
          refreshing={resources.some((q) => q.isRefetching)}
          onRefresh={refresh}
          tintColor={colors.primary}
        />
      }
    >
      <Text variant="display" accessibilityRole="header">
        Your next step, clearly.
      </Text>
      <Text muted>
        {profile.data?.full_name ? `Welcome, ${profile.data.full_name}. ` : ''}Your work and updates
        in one place. Free across Australia.
      </Text>
      <OfflineBanner />
      {resources.some((q) => q.isError) ? (
        <ErrorState
          message="Some information is unavailable. Pull to refresh or try again. Unavailable counts show —."
          onRetry={refresh}
        />
      ) : null}
      {next ? (
        <Card>
          <Text variant="heading">Next confirmed shift</Text>
          <Text>{next.shift.title}</Text>
          <Text>
            {new Intl.DateTimeFormat('en-AU', {
              dateStyle: 'medium',
              timeStyle: 'short',
              timeZone: next.shift.time_zone,
            }).format(new Date(next.shift.starts_at))}{' '}
            · {next.shift.time_zone}
          </Text>
          <Button title="View shift and attendance" onPress={() => router.push('/my-shifts')} />
        </Card>
      ) : null}
      <Row>
        <ActionTile
          icon="calendar-outline"
          title="Shift offers"
          detail={
            bookings.isSuccess
              ? `${bookings.data.filter((b) => b.status === 'offered' && new Date(b.expires_at).getTime() > Date.now()).length} to review`
              : '— unavailable'
          }
          onPress={() => router.push('/my-shifts')}
        />
        <ActionTile
          icon="notifications-outline"
          title="Updates"
          detail={
            updates.isSuccess
              ? `${updates.data.filter((n) => !n.read_at).length} unread`
              : '— unavailable'
          }
          onPress={() => router.push('/(app)/alerts')}
        />
      </Row>
      <Row>
        <ActionTile
          icon="document-text-outline"
          title="Applications"
          detail={
            applications.isSuccess ? `${applications.data.length} applications` : '— unavailable'
          }
          onPress={() => router.push('/(app)/applications')}
        />
        <ActionTile
          icon="lock-closed-outline"
          title="Document wallet"
          detail={
            docs.isSuccess
              ? `${docs.data.filter((d) => d.status === 'ready').length} private files`
              : '— unavailable'
          }
          onPress={() => router.push('/documents')}
        />
      </Row>
      <Card>
        <Text variant="heading">Ready for the next opportunity</Text>
        <Text muted>Review your profile and preferences, then find a role that fits.</Text>
        <Button
          title="Review profile"
          variant="secondary"
          onPress={() => router.push('/(app)/profile')}
        />
        <Button title="Find work" onPress={() => router.push('/(app)/discover')} />
      </Card>
    </Screen>
  );
}
