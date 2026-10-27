import * as Haptics from 'expo-haptics';
import { Pressable, View } from 'react-native';
import {
  distanceLabel,
  payLabel,
  payRange,
  postedAgo,
  superText,
  type Job,
} from '@/features/format';
import { TYPE_LABEL, type EmploymentType } from '@/features/filters';
import { useTheme } from '@/theme/ThemeProvider';
import { MIN_TOUCH, radius, space } from '@/theme/tokens';
import { Badge, Card, Row, Text } from './primitives';

export function TrustBadge({
  status,
  source,
}: {
  status: string | null | undefined;
  source?: string | null;
}) {
  if (status === 'verified') {
    return <Badge tone="ok" icon="✓" label="Verified business · not an endorsement" />;
  }
  if (status == null)
    return (
      <Badge label={`Listed via ${source ?? 'a licensed source'} · not verified by NUA CREW`} />
    );
  if (status === 'pending') return <Badge tone="warn" label="Verification in review" />;
  return <Badge tone="warn" label="Not yet verified" />;
}

export function PayLine({
  job,
}: {
  job: Pick<
    Job,
    'pay_min' | 'pay_max' | 'pay_period' | 'pay_currency' | 'pay_basis' | 'super_included'
  >;
}) {
  const range = payRange(job);
  const label = payLabel(job.pay_basis);
  if (!range) return <Badge label="Pay not disclosed" />;
  return (
    <Row>
      <Text
        variant="label"
        accessibilityLabel={`${range}, ${label}, ${superText(job.super_included)}`}
      >
        {range}
      </Text>
      <Text variant="caption" muted>
        ({superText(job.super_included)})
      </Text>
      {label ? <Badge tone={label === 'Estimated' ? 'warn' : 'ok'} label={label} /> : null}
    </Row>
  );
}

export function SaveButton({
  saved,
  onToggle,
  title,
}: {
  saved: boolean;
  onToggle: () => void;
  title: string;
}) {
  const { colors } = useTheme();
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={saved ? `Remove ${title} from saved jobs` : `Save ${title}`}
      accessibilityState={{ selected: saved }}
      hitSlop={8}
      onPress={() => {
        void Haptics.selectionAsync().catch(() => undefined);
        onToggle();
      }}
      style={{
        width: MIN_TOUCH,
        height: MIN_TOUCH,
        alignItems: 'center',
        justifyContent: 'center',
        borderRadius: radius.chip,
      }}
    >
      <Text style={{ fontSize: 24, lineHeight: 28 }} color={saved ? colors.primary : colors.muted}>
        {saved ? '♥' : '♡'}
      </Text>
    </Pressable>
  );
}

export function JobCard({
  job,
  saved,
  onToggleSave,
  onPress,
}: {
  job: Job;
  saved: boolean;
  onToggleSave: () => void;
  onPress: () => void;
}) {
  const dist = distanceLabel(job.distance_km);
  const posted = postedAgo(job.published_at);
  const where = [job.suburb, job.state].filter(Boolean).join(', ');
  const a11y = [
    job.title,
    job.employer.name,
    where,
    TYPE_LABEL[job.employment_type as EmploymentType],
    payRange(job) ?? 'pay not disclosed',
  ]
    .filter(Boolean)
    .join(', ');
  return (
    <Card>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={a11y}
        accessibilityHint="Opens job details"
        onPress={onPress}
        style={{ gap: space(0.75) }}
      >
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', gap: 8 }}>
          <View style={{ flex: 1, gap: 2 }}>
            <Text variant="heading">{job.title}</Text>
            {job.promoted ? <Badge label="Promoted" /> : null}
            <Text muted>{job.employer.name ?? 'Employer not named'}</Text>
          </View>
        </View>
        <Row>
          {where ? (
            <Text variant="caption" muted>
              {where}
            </Text>
          ) : null}
          <Text variant="caption" muted>
            {TYPE_LABEL[job.employment_type as EmploymentType] ?? job.employment_type}
          </Text>
          {dist ? (
            <Text variant="caption" muted>
              · {dist}
            </Text>
          ) : null}
          {posted ? (
            <Text variant="caption" muted>
              · {posted}
            </Text>
          ) : null}
        </Row>
        <TrustBadge status={job.employer.verification_status} source={job.attribution} />
        <PayLine job={job} />
      </Pressable>
      <View style={{ position: 'absolute', top: 6, right: 6 }}>
        <SaveButton saved={saved} onToggle={onToggleSave} title={job.title} />
      </View>
    </Card>
  );
}

const STATUS: Record<string, { label: string; tone: 'neutral' | 'live' | 'ok' | 'warn' }> = {
  submitted: { label: 'Submitted', tone: 'neutral' },
  under_review: { label: 'Under review', tone: 'live' },
  shortlisted: { label: 'Shortlisted', tone: 'live' },
  interview: { label: 'Interview', tone: 'live' },
  offer: { label: 'Offer', tone: 'ok' },
  hired: { label: 'Hired', tone: 'ok' },
  rejected: { label: 'Not progressed', tone: 'warn' },
  withdrawn: { label: 'Withdrawn', tone: 'neutral' },
};
export const statusLabel = (s: string) => STATUS[s]?.label ?? s;
export const isActiveStatus = (s: string) => !['hired', 'rejected', 'withdrawn'].includes(s);

export function StatusBadge({ status }: { status: string }) {
  const s = STATUS[status] ?? { label: status, tone: 'neutral' as const };
  return <Badge tone={s.tone} label={s.label} />;
}
