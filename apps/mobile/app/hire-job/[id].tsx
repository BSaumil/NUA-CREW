import { useLocalSearchParams, useRouter } from 'expo-router';
import { useRef, useState } from 'react';
import {
  canRecruit,
  useHireApplicants,
  useHireBusiness,
  useHireJob,
  useHireJobAction,
} from '@/api/hire';
import { messageOf } from '@/api/client';
import { payRange, superText } from '@/features/format';
import { APPLICATION_STAGE } from '@/features/hire-form';
import { useHireWorkspace } from '@/state/HireWorkspace';
import { useTheme } from '@/theme/ThemeProvider';
import {
  Button,
  Card,
  Chip,
  ConfirmSheet,
  EmptyState,
  ErrorState,
  ListSkeleton,
  Row,
  Screen,
  Text,
} from '@/ui';
import { HireGate, HiringStatus, Notice } from '@/ui/hire';

export default function ManageJob() {
  const { id } = useLocalSearchParams<{ id: string }>();
  return (
    <HireGate>
      <JobContent id={id} />
    </HireGate>
  );
}
function JobContent({ id }: { id: string }) {
  const router = useRouter();
  const { role } = useHireWorkspace();
  const { colors } = useTheme();
  const job = useHireJob(id);
  const business = useHireBusiness();
  const applicants = useHireApplicants(id);
  const action = useHireJobAction(id);
  const [stage, setStage] = useState('all');
  const [error, setError] = useState<string | null>(null);
  const [confirm, setConfirm] = useState<'publish' | 'unpublish' | 'close' | null>(null);
  const busy = useRef(false);
  const run = async () => {
    if (!confirm || busy.current) return;
    busy.current = true;
    setError(null);
    try {
      await action.mutateAsync(confirm);
      setConfirm(null);
    } catch (e) {
      setError(messageOf(e));
      setConfirm(null);
    } finally {
      busy.current = false;
    }
  };
  if (job.isPending)
    return (
      <Screen>
        <ListSkeleton count={2} />
      </Screen>
    );
  if (!job.data)
    return (
      <Screen>
        <ErrorState message={messageOf(job.error)} onRetry={() => void job.refetch()} />
      </Screen>
    );
  const j = job.data;
  const editable = !['closed', 'expired'].includes(j.status);
  const people = applicants.data ?? [];
  const shown = stage === 'all' ? people : people.filter((p) => p.status === stage);
  return (
    <Screen>
      <HiringStatus status={j.status} />
      <Text variant="display" accessibilityRole="header">
        {j.title}
      </Text>
      <Text muted>
        {[j.suburb, j.state].filter(Boolean).join(', ')} · {j.employment_type.replaceAll('_', ' ')}
      </Text>
      <Card>
        <Text variant="heading">{payRange(j) ?? 'Pay not provided'}</Text>
        <Text muted>{superText(j.super_included)}</Text>
        <Text>{j.description}</Text>
      </Card>
      {error ? (
        <Text accessibilityRole="alert" color={colors.danger}>
          {error}
        </Text>
      ) : null}
      {canRecruit(role) && editable ? (
        <Row>
          <Button
            title="Edit advertisement"
            variant="secondary"
            onPress={() => router.push({ pathname: '/hire-post', params: { id } })}
          />
          {j.status === 'published' ? (
            <Button
              title="Pause advertisement"
              variant="secondary"
              onPress={() => setConfirm('unpublish')}
            />
          ) : (
            <Button
              title="Publish job"
              disabled={business.data?.verification_status !== 'verified'}
              onPress={() => setConfirm('publish')}
            />
          )}
          <Button title="Close job" variant="danger" onPress={() => setConfirm('close')} />
        </Row>
      ) : null}
      {business.data?.verification_status !== 'verified' ? (
        <Notice
          title="Verification needed to publish"
          body="Your business and authorised representative must be reviewed first. Your draft stays saved."
        />
      ) : null}
      <Text variant="heading" accessibilityRole="header">
        Applicants · {people.length}
      </Text>
      <Text variant="caption" muted>
        Review people on their experience and the role's requirements. Every decision is yours.
      </Text>
      <Row>
        {[
          'all',
          'submitted',
          'under_review',
          'shortlisted',
          'interview',
          'offer',
          'hired',
          'rejected',
        ].map((v) => (
          <Chip
            key={v}
            label={v === 'all' ? 'All' : APPLICATION_STAGE[v]!}
            selected={stage === v}
            onPress={() => setStage(v)}
          />
        ))}
      </Row>
      {applicants.isPending ? (
        <ListSkeleton count={2} />
      ) : applicants.isError ? (
        <ErrorState
          message={messageOf(applicants.error)}
          onRetry={() => void applicants.refetch()}
        />
      ) : shown.length === 0 ? (
        <EmptyState
          title="No applicants in this view"
          body="Applications will appear here when people apply. You can also invite people who chose to be found."
        />
      ) : (
        shown.map((p) => (
          <Card key={p.application_id}>
            <Text variant="heading">{p.full_name}</Text>
            <Text muted>{p.headline ?? 'Profile headline not added'}</Text>
            <HiringStatus status={APPLICATION_STAGE[p.status] ?? p.status} />
            {p.skills.length ? (
              <Text variant="caption" muted>
                {p.skills.join(' · ')}
              </Text>
            ) : null}
            <Button
              title={`Review ${p.full_name}`}
              variant="secondary"
              onPress={() =>
                router.push({ pathname: '/hire-applicant/[id]', params: { id: p.application_id } })
              }
            />
          </Card>
        ))
      )}
      <ConfirmSheet
        visible={confirm !== null}
        title={
          confirm === 'publish'
            ? 'Publish this job?'
            : confirm === 'close'
              ? 'Close this job?'
              : 'Pause this advertisement?'
        }
        body={
          confirm === 'publish'
            ? 'Your role and disclosed pay will be visible to job seekers. Payments are not active in this build; you will not be charged.'
            : confirm === 'close'
              ? 'This stops new applications. The job cannot be reopened; existing application history stays available.'
              : 'The advertisement will stop appearing in search. Existing applications remain available.'
        }
        confirmLabel={
          confirm === 'publish'
            ? 'Publish job'
            : confirm === 'close'
              ? 'Close job'
              : 'Pause advertisement'
        }
        destructive={confirm === 'close'}
        busy={action.isPending}
        onCancel={() => setConfirm(null)}
        onConfirm={() => void run()}
      />
    </Screen>
  );
}
