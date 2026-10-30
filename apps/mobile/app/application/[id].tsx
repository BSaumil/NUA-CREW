import * as Haptics from 'expo-haptics';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Alert, RefreshControl, View } from 'react-native';
import { messageOf } from '@/api/client';
import { useApplication, useWithdraw } from '@/api/queries';
import { useTheme } from '@/theme/ThemeProvider';
import { space } from '@/theme/tokens';
import {
  Button,
  Card,
  ErrorState,
  ListSkeleton,
  Screen,
  StatusBadge,
  Text,
  isActiveStatus,
} from '@/ui';

const EVENT_COPY: Record<string, string> = {
  submitted: 'You submitted this application',
  status_changed: 'The employer updated your status',
  withdrawn: 'You withdrew this application',
};

export default function ApplicationDetail() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const { colors } = useTheme();
  const q = useApplication(id);
  const withdraw = useWithdraw();

  if (q.isPending)
    return (
      <Screen>
        <ListSkeleton count={2} />
      </Screen>
    );
  if (q.isError || !q.data)
    return (
      <Screen>
        <ErrorState message={messageOf(q.error)} onRetry={() => void q.refetch()} />
      </Screen>
    );
  const a = q.data;

  const confirmWithdraw = () =>
    Alert.alert(
      'Withdraw this application?',
      'The employer will no longer see it as active. You can apply again later.',
      [
        { text: 'Keep it', style: 'cancel' },
        {
          text: 'Withdraw',
          style: 'destructive',
          onPress: async () => {
            try {
              await withdraw.mutateAsync(a.id);
              void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(
                () => undefined,
              );
            } catch (e) {
              Alert.alert('Could not withdraw', messageOf(e));
            }
          },
        },
      ],
    );

  return (
    <Screen
      edges={['left', 'right']}
      refreshControl={
        <RefreshControl
          refreshing={q.isRefetching}
          onRefresh={() => void q.refetch()}
          tintColor={colors.primary}
        />
      }
    >
      <Text variant="display" accessibilityRole="header">
        {a.job.title}
      </Text>
      <Text muted>
        {a.job.employer_name ?? 'Employer'}
        {a.job.suburb ? ` · ${a.job.suburb}` : ''}
      </Text>
      <View style={{ flexDirection: 'row', gap: space(1), alignItems: 'center' }}>
        <Text variant="label">Status</Text>
        <StatusBadge status={a.status} />
      </View>
      <Card>
        <Text variant="heading" accessibilityRole="header">
          Timeline
        </Text>
        {a.events.map((e) => (
          <View
            key={e.id}
            style={{ gap: 2, paddingVertical: 6 }}
            accessible
            accessibilityLabel={`${EVENT_COPY[e.event_type] ?? e.event_type}${e.to_status ? `, now ${e.to_status.replace('_', ' ')}` : ''}, ${new Date(e.created_at).toLocaleString('en-AU')}`}
          >
            <Text variant="label">{EVENT_COPY[e.event_type] ?? e.event_type}</Text>
            {e.to_status ? <StatusBadge status={e.to_status} /> : null}
            <Text variant="caption" muted>
              {new Date(e.created_at).toLocaleString('en-AU')}
            </Text>
          </View>
        ))}
        <Text variant="caption" muted>
          Only actions recorded in NUA CREW appear here. Decisions are made by people at the
          employer.
        </Text>
      </Card>
      {a.cover_note ? (
        <Card>
          <Text variant="heading">Your note</Text>
          <Text>{a.cover_note}</Text>
        </Card>
      ) : null}
      <Button
        title="View job"
        variant="secondary"
        onPress={() => router.push({ pathname: '/job/[id]', params: { id: a.job.id } })}
      />
      {isActiveStatus(a.status) ? (
        <Button
          title="Withdraw application"
          variant="danger"
          loading={withdraw.isPending}
          onPress={confirmWithdraw}
        />
      ) : null}
    </Screen>
  );
}
