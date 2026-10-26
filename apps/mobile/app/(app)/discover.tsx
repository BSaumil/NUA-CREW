import { useRouter } from 'expo-router';
import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Modal,
  RefreshControl,
  Switch,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { messageOf } from '@/api/client';
import { useCreateSavedSearch, useJobs, useSavedIds, useToggleSave } from '@/api/queries';
import {
  activeCount,
  describe,
  hasAnyFilter,
  toSavedParams,
  type EmploymentType,
} from '@/features/filters';
import { getApproximatePosition } from '@/features/location';
import { useFilters } from '@/state/FiltersProvider';
import { useTheme } from '@/theme/ThemeProvider';
import { space } from '@/theme/tokens';
import {
  BrandLockup,
  Button,
  Card,
  Chip,
  EmptyState,
  ErrorState,
  Field,
  JobCard,
  ListSkeleton,
  OfflineBanner,
  Row,
  Text,
} from '@/ui';

const QUICK_TYPES: EmploymentType[] = ['casual', 'part_time', 'full_time'];
const QUICK_LABEL: Record<string, string> = {
  casual: 'Casual',
  part_time: 'Part time',
  full_time: 'Full time',
};

export default function Discover() {
  const router = useRouter();
  const { colors } = useTheme();
  const { filters, setFilters, reset } = useFilters();
  const [text, setText] = useState(filters.q);
  // Snapshot of the search being saved, taken when the sheet opens so later filter changes
  // (e.g. the typing debounce firing) cannot overwrite what the person is editing.
  const [saving, setSaving] = useState<{
    name: string;
    params: Record<string, string | number>;
  } | null>(null);

  // Debounce typing so we do not hit the API on every keystroke.
  useEffect(() => {
    const t = setTimeout(() => setFilters((f) => (f.q === text ? f : { ...f, q: text })), 400);
    return () => clearTimeout(t);
  }, [text, setFilters]);
  useEffect(() => setText(filters.q), [filters.q]);

  const jobs = useJobs(filters);
  const { data: savedIds = [] } = useSavedIds();
  const toggle = useToggleSave();
  const items = useMemo(() => jobs.data?.pages.flatMap((p) => p.items) ?? [], [jobs.data]);
  const total = jobs.data?.pages[0]?.total ?? 0;
  const savedSet = useMemo(() => new Set(savedIds), [savedIds]);
  const n = activeCount(filters);

  const toggleType = (t: EmploymentType) =>
    setFilters((f) => ({ ...f, employment_type: f.employment_type === t ? null : t }));

  const toggleNear = useCallback(async () => {
    if (filters.near)
      return setFilters((f) => ({
        ...f,
        near: null,
        radius_km: null,
        sort: f.sort === 'distance' ? 'relevance' : f.sort,
      }));
    const r = await getApproximatePosition();
    if (!r.ok) {
      return Alert.alert(
        r.reason === 'denied' ? 'Location is off' : 'Location unavailable',
        r.reason === 'denied'
          ? 'Allow location for NUA CREW in Settings to see jobs near you. You can also type a suburb in Filters.'
          : 'We could not get your position. Try a suburb in Filters instead.',
      );
    }
    setFilters((f) => ({
      ...f,
      near: { lat: r.lat, lng: r.lng },
      radius_km: f.radius_km ?? 10,
      sort: 'distance',
    }));
  }, [filters.near, setFilters]);

  const header = (
    <View style={{ gap: space(1.5), paddingBottom: space(1.5) }}>
      <BrandLockup />
      <OfflineBanner />
      <Field
        label="Search jobs"
        value={text}
        onChangeText={setText}
        placeholder="Job title, skill or venue"
        returnKeyType="search"
        autoCorrect={false}
      />
      <Row>
        <Button
          title={n ? `Filters (${n})` : 'Filters'}
          variant="secondary"
          onPress={() => router.push('/filters')}
        />
        {QUICK_TYPES.map((t) => (
          <Chip
            key={t}
            label={QUICK_LABEL[t] ?? t}
            selected={filters.employment_type === t}
            onPress={() => toggleType(t)}
          />
        ))}
        <Chip
          label="Near me"
          selected={!!filters.near}
          onPress={() => void toggleNear()}
          accessibilityHint="Uses your approximate location once. It is not stored."
        />
        <Chip
          label="$30+/h"
          selected={filters.min_hourly === 30}
          onPress={() => setFilters((f) => ({ ...f, min_hourly: f.min_hourly === 30 ? null : 30 }))}
        />
        <Chip
          label="New this week"
          selected={filters.posted_within_days === 7}
          onPress={() =>
            setFilters((f) => ({ ...f, posted_within_days: f.posted_within_days === 7 ? null : 7 }))
          }
        />
      </Row>
      <Row style={{ justifyContent: 'space-between' }}>
        <Text accessibilityRole="header" accessibilityLiveRegion="polite" variant="label" muted>
          {jobs.isPending
            ? 'Searching…'
            : `${total} ${total === 1 ? 'job' : 'jobs'} · ${describe(filters)}`}
        </Text>
        {hasAnyFilter(filters) ? (
          <Button
            title="Clear"
            variant="ghost"
            onPress={() => {
              reset();
              setText('');
            }}
          />
        ) : null}
      </Row>
      {hasAnyFilter(filters) ? (
        <Button
          title="Save this search & get alerts"
          variant="ghost"
          onPress={() => setSaving({ name: describe(filters), params: toSavedParams(filters) })}
        />
      ) : null}
    </View>
  );

  return (
    <SafeAreaView edges={['top']} style={{ flex: 1, backgroundColor: colors.bg }}>
      <FlatList
        data={items}
        keyExtractor={(j) => j.id}
        contentContainerStyle={{ padding: space(2), gap: space(1.5), paddingBottom: space(6) }}
        ListHeaderComponent={header}
        keyboardShouldPersistTaps="handled"
        renderItem={({ item }) => (
          <JobCard
            job={item}
            saved={savedSet.has(item.id)}
            onToggleSave={() => toggle.mutate({ id: item.id, save: !savedSet.has(item.id) })}
            onPress={() => router.push({ pathname: '/job/[id]', params: { id: item.id } })}
          />
        )}
        ListEmptyComponent={
          jobs.isPending ? (
            <ListSkeleton />
          ) : jobs.isError ? (
            <ErrorState message={messageOf(jobs.error)} onRetry={() => void jobs.refetch()} />
          ) : (
            <EmptyState
              title="No jobs match yet"
              body="Try fewer filters, a wider area, or save this search to be told when something new appears."
              action={
                hasAnyFilter(filters)
                  ? {
                      label: 'Clear filters',
                      onPress: () => {
                        reset();
                        setText('');
                      },
                    }
                  : undefined
              }
            />
          )
        }
        ListFooterComponent={
          jobs.isFetchingNextPage ? <ActivityIndicator color={colors.primary} /> : undefined
        }
        onEndReachedThreshold={0.5}
        onEndReached={() =>
          jobs.hasNextPage && !jobs.isFetchingNextPage && void jobs.fetchNextPage()
        }
        refreshControl={
          <RefreshControl
            refreshing={jobs.isRefetching && !jobs.isFetchingNextPage}
            onRefresh={() => void jobs.refetch()}
            tintColor={colors.primary}
          />
        }
      />
      <SaveSearchModal snapshot={saving} onClose={() => setSaving(null)} />
    </SafeAreaView>
  );
}

function SaveSearchModal({
  snapshot,
  onClose,
}: {
  snapshot: { name: string; params: Record<string, string | number> } | null;
  onClose: () => void;
}) {
  const { colors } = useTheme();
  const create = useCreateSavedSearch();
  const [name, setName] = useState('');
  const [alerts, setAlerts] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const opened = snapshot !== null;
  useEffect(() => {
    if (snapshot) {
      setName(snapshot.name.slice(0, 100));
      setAlerts(true);
      setError(null);
    }
    // Reset only when the sheet opens, never while it is being edited.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [opened]);

  const save = async () => {
    setError(null);
    try {
      await create.mutateAsync({
        name: name.trim() || 'My search',
        params: (snapshot?.params ?? {}) as never,
        alerts_enabled: alerts,
      });
      onClose();
      Alert.alert(
        'Search saved',
        alerts ? 'We will alert you when new jobs match.' : 'Find it any time under Saved.',
      );
    } catch (e) {
      setError(messageOf(e));
    }
  };

  return (
    <Modal visible={opened} animationType="slide" transparent onRequestClose={onClose}>
      <View style={{ flex: 1, justifyContent: 'flex-end', backgroundColor: '#0008' }}>
        <Card style={{ borderBottomLeftRadius: 0, borderBottomRightRadius: 0, gap: space(2) }}>
          <Text variant="title" accessibilityRole="header">
            Save this search
          </Text>
          <Field label="Name" value={name} onChangeText={setName} maxLength={100} />
          <Row style={{ justifyContent: 'space-between' }}>
            <View style={{ flex: 1 }}>
              <Text variant="label">Alert me about new jobs</Text>
              <Text variant="caption" muted>
                At most one alert an hour. Turn off any time.
              </Text>
            </View>
            <Switch
              value={alerts}
              onValueChange={setAlerts}
              accessibilityLabel="Alert me about new jobs"
              trackColor={{ true: colors.primary, false: colors.border }}
            />
          </Row>
          {error ? (
            <Text color={colors.danger} accessibilityLiveRegion="polite">
              {error}
            </Text>
          ) : null}
          <Row>
            <Button title="Save" loading={create.isPending} onPress={() => void save()} />
            <Button title="Cancel" variant="ghost" onPress={onClose} />
          </Row>
        </Card>
      </View>
    </Modal>
  );
}
