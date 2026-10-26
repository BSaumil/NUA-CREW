import { useRouter } from 'expo-router';
import { useState } from 'react';
import { Pressable, RefreshControl, View } from 'react-native';
import { messageOf } from '@/api/client';
import { useApplications } from '@/api/queries';
import { useTheme } from '@/theme/ThemeProvider';
import { space } from '@/theme/tokens';
import {
  Card,
  Chip,
  EmptyState,
  ErrorState,
  ListSkeleton,
  OfflineBanner,
  Row,
  Screen,
  StatusBadge,
  Text,
  isActiveStatus,
} from '@/ui';

export default function Applications() {
  const router = useRouter();
  const { colors } = useTheme();
  const [tab, setTab] = useState<'active' | 'closed'>('active');
  const q = useApplications();
  const all = q.data ?? [];
  const list = all.filter((a) =>
    tab === 'active' ? isActiveStatus(a.status) : !isActiveStatus(a.status),
  );

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
      <Text variant="title" accessibilityRole="header">
        Applications
      </Text>
      <OfflineBanner />
      <Row>
        <Chip
          label={`Active (${all.filter((a) => isActiveStatus(a.status)).length})`}
          selected={tab === 'active'}
          onPress={() => setTab('active')}
        />
        <Chip
          label={`Closed (${all.filter((a) => !isActiveStatus(a.status)).length})`}
          selected={tab === 'closed'}
          onPress={() => setTab('closed')}
        />
      </Row>
      <Text variant="caption" muted>
        Status changes here are made by people at the employer. Jobs on other sites are not tracked.
      </Text>
      {q.isPending ? (
        <ListSkeleton />
      ) : q.isError ? (
        <ErrorState message={messageOf(q.error)} onRetry={() => void q.refetch()} />
      ) : list.length === 0 ? (
        <EmptyState
          title={tab === 'active' ? 'No active applications' : 'Nothing closed yet'}
          body={
            tab === 'active'
              ? 'When you apply for a job here, you can follow every step.'
              : 'Hired, not progressed and withdrawn applications appear here.'
          }
          action={
            tab === 'active'
              ? { label: 'Browse jobs', onPress: () => router.push('/(app)/discover') }
              : undefined
          }
        />
      ) : (
        list.map((a) => (
          <Card key={a.id}>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={`${a.job.title}, ${a.job.employer_name ?? 'employer'}, status ${a.status.replace('_', ' ')}`}
              onPress={() => router.push({ pathname: '/application/[id]', params: { id: a.id } })}
              style={{ gap: space(0.75) }}
            >
              <Text variant="heading">{a.job.title}</Text>
              <Text muted>
                {a.job.employer_name ?? '—'}
                {a.job.suburb ? ` · ${a.job.suburb}` : ''}
              </Text>
              <View
                style={{
                  flexDirection: 'row',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                }}
              >
                <StatusBadge status={a.status} />
                <Text variant="caption" muted>
                  Applied {new Date(a.created_at).toLocaleDateString('en-AU')}
                </Text>
              </View>
            </Pressable>
          </Card>
        ))
      )}
    </Screen>
  );
}
