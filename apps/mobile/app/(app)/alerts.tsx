import { useRouter } from 'expo-router';
import { Pressable, RefreshControl, View } from 'react-native';
import { messageOf } from '@/api/client';
import { useMarkAllRead, useMarkRead, useNotifications } from '@/api/queries';
import { routeFor } from '@/features/links';
import { useTheme } from '@/theme/ThemeProvider';
import { space } from '@/theme/tokens';
import {
  Button,
  Card,
  EmptyState,
  ErrorState,
  ListSkeleton,
  OfflineBanner,
  Row,
  Screen,
  Text,
} from '@/ui';

export default function Alerts() {
  const router = useRouter();
  const { colors } = useTheme();
  const q = useNotifications();
  const markRead = useMarkRead();
  const markAll = useMarkAllRead();
  const unread = q.data?.filter((n) => !n.read_at).length ?? 0;

  return (
    <Screen
      refreshControl={
        <RefreshControl
          refreshing={q.isRefetching}
          onRefresh={() => void q.refetch()}
          tintColor={colors.primary}
        />
      }
    >
      <Row style={{ justifyContent: 'space-between' }}>
        <Text variant="title" accessibilityRole="header">
          Alerts
        </Text>
        {unread > 0 ? (
          <Button title="Mark all read" variant="ghost" onPress={() => markAll.mutate()} />
        ) : null}
      </Row>
      <OfflineBanner />
      {q.isPending ? (
        <ListSkeleton count={3} />
      ) : q.isError ? (
        <ErrorState message={messageOf(q.error)} onRetry={() => void q.refetch()} />
      ) : q.data.length === 0 ? (
        <EmptyState
          title="Nothing yet"
          body="Application updates and new-job alerts will show up here."
          action={{ label: 'Set up a job alert', onPress: () => router.push('/(app)/discover') }}
        />
      ) : (
        q.data.map((n) => (
          <Card key={n.id} style={{ borderColor: n.read_at ? colors.border : colors.primary }}>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={`${n.read_at ? '' : 'Unread. '}${n.title}`}
              onPress={() => {
                if (!n.read_at) markRead.mutate(n.id);
                router.push(routeFor(n.kind, n.data as Record<string, unknown>));
              }}
              style={{ gap: space(0.5) }}
            >
              <Text variant="label">
                {n.read_at ? '' : '● '}
                {n.title}
              </Text>
              {n.body ? <Text muted>{n.body}</Text> : null}
              <Text variant="caption" muted>
                {new Date(n.created_at).toLocaleString('en-AU')}
              </Text>
            </Pressable>
          </Card>
        ))
      )}
      <View />
    </Screen>
  );
}
