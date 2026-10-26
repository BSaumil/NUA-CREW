import { useRouter } from 'expo-router';
import { useState } from 'react';
import { Alert, View } from 'react-native';
import {
  EMPTY_FILTERS,
  TYPE_LABEL,
  type EmploymentType,
  type JobFilters,
  type Sort,
} from '@/features/filters';
import { getApproximatePosition } from '@/features/location';
import { useFilters } from '@/state/FiltersProvider';
import { space } from '@/theme/tokens';
import { Button, Chip, Field, Row, Screen, Text } from '@/ui';

const PAY = [null, 25, 30, 35, 40] as const;
const POSTED = [null, 1, 7, 30] as const;
const RADIUS = [5, 10, 25, 50] as const;

function Group({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <View style={{ gap: space(1) }}>
      <Text variant="heading" accessibilityRole="header">
        {title}
      </Text>
      <Row>{children}</Row>
    </View>
  );
}

export default function Filters() {
  const router = useRouter();
  const { filters, setFilters } = useFilters();
  const [d, setD] = useState<JobFilters>(filters);
  const set = <K extends keyof JobFilters>(k: K, v: JobFilters[K]) =>
    setD((p) => ({ ...p, [k]: v }));

  const toggleNear = async () => {
    if (d.near)
      return setD((p) => ({
        ...p,
        near: null,
        radius_km: null,
        sort: p.sort === 'distance' ? 'relevance' : p.sort,
      }));
    const r = await getApproximatePosition();
    if (!r.ok)
      return Alert.alert(
        'Location unavailable',
        'Allow location in Settings, or type a suburb instead.',
      );
    setD((p) => ({
      ...p,
      near: { lat: r.lat, lng: r.lng },
      radius_km: p.radius_km ?? 10,
      sort: 'distance',
    }));
  };

  const sorts: [Sort, string][] = [
    ['relevance', 'Best match'],
    ['newest', 'Newest'],
    ['pay', 'Highest pay'],
    ...(d.near ? ([['distance', 'Nearest']] as [Sort, string][]) : []),
  ];

  return (
    <Screen edges={['left', 'right', 'bottom']}>
      <View style={{ gap: space(3) }}>
        <Field
          label="Suburb"
          value={d.suburb}
          onChangeText={(v) => set('suburb', v)}
          placeholder="e.g. Fitzroy"
          autoCapitalize="words"
        />
        <Group title="Employment type">
          {(Object.keys(TYPE_LABEL) as EmploymentType[]).map((t) => (
            <Chip
              key={t}
              label={TYPE_LABEL[t]}
              selected={d.employment_type === t}
              onPress={() => set('employment_type', d.employment_type === t ? null : t)}
            />
          ))}
        </Group>
        <Group title="Minimum pay (per hour)">
          {PAY.map((p) => (
            <Chip
              key={String(p)}
              label={p ? `$${p}+` : 'Any'}
              selected={d.min_hourly === p}
              onPress={() => set('min_hourly', p)}
            />
          ))}
        </Group>
        <Text variant="caption" muted style={{ marginTop: -space(2) }}>
          Uses the top of the advertised range, converted to an hourly rate (38-hour week). Jobs
          without pay are hidden when this is on.
        </Text>
        <Group title="Posted">
          {POSTED.map((p) => (
            <Chip
              key={String(p)}
              label={p === null ? 'Any time' : p === 1 ? 'Today' : `Last ${p} days`}
              selected={d.posted_within_days === p}
              onPress={() => set('posted_within_days', p)}
            />
          ))}
        </Group>
        <Group title="Near me">
          <Chip
            label={d.near ? 'On — approximate location' : 'Off'}
            selected={!!d.near}
            onPress={() => void toggleNear()}
            accessibilityHint="Uses your approximate location once. It is not stored."
          />
          {d.near
            ? RADIUS.map((r) => (
                <Chip
                  key={r}
                  label={`${r} km`}
                  selected={d.radius_km === r}
                  onPress={() => set('radius_km', r)}
                />
              ))
            : null}
        </Group>
        <Group title="Sort by">
          {sorts.map(([s, label]) => (
            <Chip key={s} label={label} selected={d.sort === s} onPress={() => set('sort', s)} />
          ))}
        </Group>
        <Button
          title="Show results"
          full
          onPress={() => {
            setFilters(d);
            router.back();
          }}
        />
        <Button
          title="Reset all"
          variant="ghost"
          full
          onPress={() => setD({ ...EMPTY_FILTERS, q: d.q })}
        />
      </View>
    </Screen>
  );
}
