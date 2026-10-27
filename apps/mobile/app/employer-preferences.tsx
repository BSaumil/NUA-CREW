import { useState } from 'react';
import { messageOf } from '@/api/client';
import {
  useAddEmployerPref,
  useDeleteEmployerPref,
  useEmployerDirectory,
  useEmployerPrefs,
} from '@/api/queries';
import { useTheme } from '@/theme/ThemeProvider';
import { Button, Card, Chip, ErrorState, Field, ListSkeleton, Row, Screen, Text } from '@/ui';

const KINDS = [
  ['follow', 'Prefer', 'Prefer working with'],
  ['hide_from', 'Hide me', 'Hide me from'],
  ['mute', 'Mute jobs', 'Mute jobs from'],
] as const;
const KIND_TEXT: Record<string, string> = {
  follow: 'Preferred',
  hide_from: 'Hidden from',
  mute: 'Jobs muted',
};

export default function EmployerPreferences() {
  const { colors } = useTheme();
  const prefs = useEmployerPrefs();
  const add = useAddEmployerPref();
  const del = useDeleteEmployerPref();
  const [q, setQ] = useState('');
  const [error, setError] = useState<string | null>(null);
  const found = useEmployerDirectory(q);

  const act = async (fn: () => Promise<unknown>) => {
    setError(null);
    try {
      await fn();
    } catch (e) {
      setError(messageOf(e));
    }
  };

  return (
    <Screen edges={['left', 'right']}>
      <Text variant="title" accessibilityRole="header">
        Employers you prefer or avoid
      </Text>
      <Text muted>Private to you. Employers never see which employers you hide from or mute.</Text>
      <Card>
        <Text variant="label">Prefer</Text>
        <Text variant="caption" muted>
          That employer may be told you prefer working with them. It doesn't move you up any list.
        </Text>
        <Text variant="label">Hide me</Text>
        <Text variant="caption" muted>
          You won't appear when that employer searches for people. This matches the employer's NUA
          CREW record, so it can't promise you stay unseen by a business trading under another name
          or by someone who already knows you.
        </Text>
        <Text variant="label">Mute jobs</Text>
        <Text variant="caption" muted>
          Jobs from that employer stop showing in your search.
        </Text>
      </Card>

      <Field
        label="Find an employer by name"
        value={q}
        onChangeText={setQ}
        autoCapitalize="none"
        autoCorrect={false}
        hint="Type at least two letters."
      />
      {found.isFetching ? <ListSkeleton count={1} /> : null}
      {found.data?.length === 0 && q.trim().length >= 2 && !found.isFetching ? (
        <Text muted>No employer matches that name.</Text>
      ) : null}
      {found.data?.map((emp) => (
        <Card key={emp.id}>
          <Text variant="heading">{emp.name}</Text>
          <Row>
            {KINDS.map(([kind, label, long]) => (
              <Chip
                key={kind}
                label={label}
                accessibilityHint={`${long} ${emp.name}`}
                onPress={() => void act(() => add.mutateAsync({ employer_id: emp.id, kind }))}
              />
            ))}
          </Row>
        </Card>
      ))}

      <Text variant="heading" accessibilityRole="header">
        Your choices
      </Text>
      {prefs.isPending ? <ListSkeleton count={1} /> : null}
      {prefs.isError ? (
        <ErrorState message={messageOf(prefs.error)} onRetry={() => void prefs.refetch()} />
      ) : null}
      {prefs.data?.length === 0 ? <Text muted>None yet</Text> : null}
      {prefs.data?.map((p) => (
        <Card key={p.id}>
          <Text>
            {KIND_TEXT[p.kind]}: {p.employer_name}
          </Text>
          <Button
            title="Remove"
            variant="ghost"
            accessibilityLabel={`Remove ${KIND_TEXT[p.kind]?.toLowerCase()} ${p.employer_name}`}
            onPress={() => void act(() => del.mutateAsync(p.id))}
          />
        </Card>
      ))}
      {error ? (
        <Text accessibilityRole="alert" accessibilityLiveRegion="polite" color={colors.danger}>
          {error}
        </Text>
      ) : null}
    </Screen>
  );
}
