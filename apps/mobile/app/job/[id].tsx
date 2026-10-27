import * as Haptics from 'expo-haptics';
import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import * as WebBrowser from 'expo-web-browser';
import { useRef, useState } from 'react';
import { Alert, Pressable, View } from 'react-native';
import { messageOf } from '@/api/client';
import {
  useApplications,
  useApply,
  useJob,
  useMatch,
  useResumes,
  useSavedIds,
  useToggleSave,
} from '@/api/queries';
import { TYPE_LABEL, type EmploymentType } from '@/features/filters';
import { createApplyGuard, outcomeOfError } from '@/features/apply';
import { isStale, postedAgo } from '@/features/format';
import { shareJob } from '@/features/share';
import { useTheme } from '@/theme/ThemeProvider';
import { radius, space } from '@/theme/tokens';
import {
  AI_DISCLOSURE,
  Badge,
  Button,
  Card,
  Chip,
  EmptyState,
  ErrorState,
  Field,
  ListSkeleton,
  MatchBreakdown,
  PayLine,
  Row,
  SaveButton,
  Screen,
  Text,
  TrustBadge,
  Sheet,
} from '@/ui';

type Tab = 'overview' | 'match' | 'company';

export default function JobDetail() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const { colors } = useTheme();
  const [tab, setTab] = useState<Tab>('overview');
  const [applyOpen, setApplyOpen] = useState(false);
  const job = useJob(id);
  const match = useMatch(id);
  const { data: savedIds = [] } = useSavedIds();
  const toggle = useToggleSave();
  const { data: apps } = useApplications();

  if (job.isPending)
    return (
      <Screen>
        <ListSkeleton count={2} />
      </Screen>
    );
  if (job.isError || !job.data) {
    const gone = (job.error as { status?: number } | null)?.status === 404;
    return (
      <Screen>
        {gone ? (
          <EmptyState
            title="This job is no longer available"
            body="It may have been filled, closed or taken down."
            action={{ label: 'Back to search', onPress: () => router.replace('/(app)/discover') }}
          />
        ) : (
          <ErrorState message={messageOf(job.error)} onRetry={() => void job.refetch()} />
        )}
      </Screen>
    );
  }
  const j = job.data;
  const saved = savedIds.includes(j.id);
  const existing = apps?.find((a) => a.job.id === j.id && a.status !== 'withdrawn');
  const where = [j.suburb, j.state].filter(Boolean).join(', ');
  const stale = isStale(j.last_verified_at);

  const openExternal = () =>
    Alert.alert(
      'Apply on the employer’s site',
      'This job is hosted elsewhere. Applications made there are not tracked by NUA CREW, so we cannot confirm they were received or viewed.',
      [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Continue', onPress: () => void WebBrowser.openBrowserAsync(j.apply_url!) },
      ],
    );

  return (
    <View style={{ flex: 1, backgroundColor: colors.bg }}>
      <Stack.Screen
        options={{
          title: '',
          headerRight: () => (
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Share this job"
              hitSlop={12}
              onPress={() => void shareJob(j)}
            >
              <Text color={colors.primary} variant="label">
                Share
              </Text>
            </Pressable>
          ),
        }}
      />
      <Screen edges={['left', 'right']}>
        <View style={{ gap: space(1) }}>
          <Text variant="display" accessibilityRole="header">
            {j.title}
          </Text>
          <Text muted>{j.employer.name ?? 'Employer not named'}</Text>
          <Row>
            {where ? (
              <Text variant="caption" muted>
                {where}
              </Text>
            ) : null}
            <Text variant="caption" muted>
              {TYPE_LABEL[j.employment_type as EmploymentType] ?? j.employment_type}
            </Text>
            {postedAgo(j.published_at) ? (
              <Text variant="caption" muted>
                · {postedAgo(j.published_at)}
              </Text>
            ) : null}
          </Row>
          <TrustBadge status={j.employer.verification_status} source={j.attribution} />
          <PayLine job={j} />
          {stale ? (
            <View
              accessibilityRole="alert"
              style={{
                backgroundColor: colors.warnTint,
                borderRadius: radius.button,
                padding: space(1.25),
              }}
            >
              <Text variant="caption" color={colors.onWarnTint}>
                This listing has not been re-confirmed recently. It may already be filled.
              </Text>
            </View>
          ) : null}
        </View>

        <View accessibilityRole="tablist" style={{ flexDirection: 'row', gap: space(1) }}>
          {(
            [
              ['overview', 'Overview'],
              ['match', 'My match'],
              ['company', 'Company'],
            ] as [Tab, string][]
          ).map(([k, label]) => (
            <Chip key={k} role="tab" label={label} selected={tab === k} onPress={() => setTab(k)} />
          ))}
        </View>

        {tab === 'overview' ? (
          <Card>
            <Text variant="heading" accessibilityRole="header">
              About the role
            </Text>
            <Text selectable>{j.description}</Text>
            {j.skills.length ? (
              <Row style={{ marginTop: space(1) }}>
                {j.skills.map((s) => (
                  <Badge key={s} label={s} />
                ))}
              </Row>
            ) : null}
            {j.last_verified_at ? (
              <Text variant="caption" muted>
                Last checked {new Date(j.last_verified_at).toLocaleDateString('en-AU')}
              </Text>
            ) : null}
            {j.attribution ? (
              <Text variant="caption" muted>
                Source: {j.attribution}
              </Text>
            ) : null}
          </Card>
        ) : null}

        {tab === 'match' ? (
          match.isPending ? (
            <ListSkeleton count={1} />
          ) : match.isError || !match.data ? (
            <ErrorState message={messageOf(match.error)} onRetry={() => void match.refetch()} />
          ) : (
            <>
              <MatchBreakdown match={match.data} />
              <Text variant="caption" muted>
                {AI_DISCLOSURE}
              </Text>
              <Button
                title="Improve my profile"
                variant="secondary"
                onPress={() => router.push('/(app)/profile')}
              />
            </>
          )
        ) : null}

        {tab === 'company' ? (
          <Card>
            <Text variant="heading" accessibilityRole="header">
              {j.employer.name ?? 'Employer'}
            </Text>
            {j.employer.verification_status === 'verified' ? (
              <Text>
                NUA CREW reviewed evidence about who operates this business. That confirms identity
                — it is not an endorsement, and it says nothing about pay or conditions beyond what
                is listed here.
              </Text>
            ) : j.employer.verification_status == null ? (
              <Text>
                This job comes from {j.attribution ?? 'a licensed source'}. NUA CREW has not
                verified this employer, and you apply on their own site.
              </Text>
            ) : (
              <Text>
                This business has not completed verification yet. Take the usual care before sharing
                personal details.
              </Text>
            )}
            {where ? <Text muted>Location: {where}</Text> : null}
          </Card>
        ) : null}
      </Screen>

      <View
        style={{
          flexDirection: 'row',
          alignItems: 'center',
          gap: space(1),
          padding: space(2),
          borderTopWidth: 1,
          borderColor: colors.border,
          backgroundColor: colors.surface,
        }}
      >
        <SaveButton
          saved={saved}
          title={j.title}
          onToggle={() => toggle.mutate({ id: j.id, save: !saved })}
        />
        <View style={{ flex: 1 }}>
          {j.origin === 'ingested' && j.apply_url ? (
            <Button title="Apply on employer site" full onPress={openExternal} />
          ) : existing ? (
            <Button
              title={`Applied · ${existing.status.replace('_', ' ')} — view`}
              variant="secondary"
              full
              onPress={() =>
                router.push({ pathname: '/application/[id]', params: { id: existing.id } })
              }
            />
          ) : (
            <Button title="Apply" full onPress={() => setApplyOpen(true)} />
          )}
        </View>
      </View>
      <ApplySheet
        jobId={j.id}
        title={j.title}
        visible={applyOpen}
        onClose={() => setApplyOpen(false)}
      />
    </View>
  );
}

function ApplySheet({
  jobId,
  title,
  visible,
  onClose,
}: {
  jobId: string;
  title: string;
  visible: boolean;
  onClose: () => void;
}) {
  const router = useRouter();
  const { colors } = useTheme();
  const { data: resumes } = useResumes();
  const apply = useApply();
  const [resumeId, setResumeId] = useState<string | null>(null);
  const [note, setNote] = useState('');
  const [error, setError] = useState<string | null>(null);
  const chosen = resumeId === '' ? null : (resumeId ?? resumes?.[0]?.id ?? null);

  // One guard per sheet: stable idempotency key across retries of the same unchanged application,
  // and a hard stop on rapid double taps (state updates lag a render; this does not).
  const guard = useRef(createApplyGuard()).current;

  const submit = async () => {
    const key = guard.begin(chosen, note);
    if (key === null) return; // a submit is already in flight
    setError(null);
    try {
      const a = await apply.mutateAsync({
        jobId,
        resumeId: chosen,
        note: note.trim(),
        idempotencyKey: key,
      });
      guard.end('success');
      void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(
        () => undefined,
      );
      onClose();
      router.replace({ pathname: '/application/[id]', params: { id: a.id } });
    } catch (e) {
      guard.end(outcomeOfError(e));
      setError(
        outcomeOfError(e) === 'unknown'
          ? `${messageOf(e)} Your application may have been sent: tap Submit again to retry safely, or check Applications.`
          : messageOf(e),
      );
    }
  };

  return (
    <Sheet visible={visible} onClose={onClose}>
      <Text variant="title" accessibilityRole="header">
        Apply for {title}
      </Text>
      <Text variant="caption" muted>
        The employer will see your profile, the resume you choose and your note. Applying is free
        and you can withdraw later.
      </Text>
      <Text variant="label">Resume</Text>
      {resumes?.length ? (
        <Row>
          {resumes.map((r) => (
            <Chip
              key={r.id}
              label={r.title}
              selected={chosen === r.id}
              onPress={() => setResumeId(r.id)}
            />
          ))}
          <Chip label="None" selected={chosen === null} onPress={() => setResumeId('')} />
        </Row>
      ) : (
        <Text muted>No resume yet. You can still apply, or add one in Profile first.</Text>
      )}
      <Field
        label="Note to the employer (optional)"
        value={note}
        onChangeText={setNote}
        multiline
        maxLength={5000}
        style={{ minHeight: 90, textAlignVertical: 'top' }}
      />
      {error ? (
        <Text accessibilityRole="alert" color={colors.danger}>
          {error}
        </Text>
      ) : null}
      <Row>
        <Button
          title="Submit application"
          loading={apply.isPending}
          onPress={() => void submit()}
        />
        <Button title="Cancel" variant="ghost" onPress={onClose} />
      </Row>
    </Sheet>
  );
}
