import { useRouter } from 'expo-router';
import { useState } from 'react';
import { Alert, Pressable, RefreshControl, Switch, View } from 'react-native';
import { messageOf } from '@/api/client';
import {
  useDeleteSavedSearch,
  usePatchSavedSearch,
  useSavedJobs,
  useSavedSearches,
  useToggleSave,
} from '@/api/queries';
import { describe, fromSaved } from '@/features/filters';
import { useFilters } from '@/state/FiltersProvider';
import { useTheme } from '@/theme/ThemeProvider';
import { space } from '@/theme/tokens';
import {
  Badge,
  Button,
  Card,
  Chip,
  EmptyState,
  ErrorState,
  JobCard,
  ListSkeleton,
  OfflineBanner,
  Row,
  Screen,
  Text,
} from '@/ui';

export default function Saved() {
  const router = useRouter();
  const { colors } = useTheme();
  const { setFilters } = useFilters();
  const [tab, setTab] = useState<'jobs' | 'searches'>('jobs');
  const jobs = useSavedJobs();
  const searches = useSavedSearches();
  const toggle = useToggleSave();
  const patch = usePatchSavedSearch();
  const del = useDeleteSavedSearch();
  const active = tab === 'jobs' ? jobs : searches;

  return (
    <Screen
      refreshControl={
        <RefreshControl
          refreshing={active.isRefetching}
          onRefresh={() => void active.refetch()}
          tintColor={colors.primary}
        />
      }
    >
      <Text variant="title" accessibilityRole="header">
        Saved
      </Text>
      <OfflineBanner />
      <Row>
        <Chip
          label={`Jobs${jobs.data ? ` (${jobs.data.length})` : ''}`}
          selected={tab === 'jobs'}
          onPress={() => setTab('jobs')}
        />
        <Chip
          label={`Searches${searches.data ? ` (${searches.data.length})` : ''}`}
          selected={tab === 'searches'}
          onPress={() => setTab('searches')}
        />
      </Row>

      {tab === 'jobs' ? (
        jobs.isPending ? (
          <ListSkeleton />
        ) : jobs.isError ? (
          <ErrorState message={messageOf(jobs.error)} onRetry={() => void jobs.refetch()} />
        ) : jobs.data.length === 0 ? (
          <EmptyState
            title="No saved jobs yet"
            body="Tap the heart on any job to keep it here."
            action={{ label: 'Find jobs', onPress: () => router.push('/(app)/discover') }}
          />
        ) : (
          jobs.data.map((s) => (
            <View key={s.job.id} style={{ gap: space(0.5) }}>
              {!s.is_open ? <Badge tone="warn" label="No longer accepting applications" /> : null}
              <JobCard
                job={s.job}
                saved
                onToggleSave={() => toggle.mutate({ id: s.job.id, save: false })}
                onPress={() => router.push({ pathname: '/job/[id]', params: { id: s.job.id } })}
              />
            </View>
          ))
        )
      ) : searches.isPending ? (
        <ListSkeleton count={2} />
      ) : searches.isError ? (
        <ErrorState message={messageOf(searches.error)} onRetry={() => void searches.refetch()} />
      ) : searches.data.length === 0 ? (
        <EmptyState
          title="No saved searches"
          body="Search for something on Discover, then choose “Save this search & get alerts”."
          action={{ label: 'Go to Discover', onPress: () => router.push('/(app)/discover') }}
        />
      ) : (
        searches.data.map((s) => (
          <Card key={s.id}>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={`${s.name}. Open results`}
              onPress={() => {
                setFilters(fromSaved(s.params));
                router.push('/(app)/discover');
              }}
            >
              <Text variant="heading">{s.name}</Text>
              <Text variant="caption" muted>
                {describe(fromSaved(s.params))}
              </Text>
            </Pressable>
            <Row style={{ justifyContent: 'space-between' }}>
              <Text variant="label">Alerts</Text>
              <Switch
                value={s.alerts_enabled}
                accessibilityLabel={`Alerts for ${s.name}`}
                trackColor={{ true: colors.primary, false: colors.border }}
                onValueChange={(v) => patch.mutate({ id: s.id, alerts_enabled: v })}
              />
            </Row>
            <Button
              title="Delete"
              variant="danger"
              onPress={() =>
                Alert.alert('Delete this saved search?', 'You will stop getting alerts for it.', [
                  { text: 'Cancel', style: 'cancel' },
                  { text: 'Delete', style: 'destructive', onPress: () => del.mutate(s.id) },
                ])
              }
            />
          </Card>
        ))
      )}
    </Screen>
  );
}
