import { Platform } from 'react-native';
import { downloadPrivateDocument } from '@/api/documents';
import type { Schemas } from '@nua-crew/contracts';
import { useLocalSearchParams } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import { canRecruit, useHireApplicant, useHireDecision, useHireDocuments } from '@/api/hire';
import { messageOf } from '@/api/client';
import { APPLICATION_STAGE } from '@/features/hire-form';
import { useHireWorkspace } from '@/state/HireWorkspace';
import { useTheme } from '@/theme/ThemeProvider';
import {
  Button,
  Card,
  ConfirmSheet,
  ErrorState,
  Field,
  ListSkeleton,
  Row,
  Screen,
  Text,
} from '@/ui';
import { HireGate, HiringStatus, Notice } from '@/ui/hire';

const NEXT: Record<string, Schemas['StatusChangeIn']['to_status']> = {
  submitted: 'under_review',
  under_review: 'shortlisted',
  shortlisted: 'interview',
  interview: 'offer',
  offer: 'hired',
};
export default function Applicant() {
  const { id } = useLocalSearchParams<{ id: string }>();
  return (
    <HireGate>
      <ApplicantContent id={id} />
    </HireGate>
  );
}
function ApplicantContent({ id }: { id: string }) {
  const query = useHireApplicant(id);
  const decide = useHireDecision(id);
  const { role, employerId } = useHireWorkspace();
  const sharedDocuments = useHireDocuments(id);
  const active = useRef(true);
  const workspace = useRef(employerId);
  workspace.current = employerId;
  useEffect(() => {
    active.current = true;
    return () => {
      active.current = false;
    };
  }, [employerId]);
  const { colors } = useTheme();
  const [target, setTarget] = useState<Schemas['StatusChangeIn']['to_status'] | null>(null);
  const [note, setNote] = useState('');
  const [error, setError] = useState<string | null>(null);
  const busy = useRef(false);
  const run = async () => {
    if (!target || busy.current) return;
    if (target === 'rejected' && !note.trim()) {
      setError('Add a job-related reason before deciding not to progress.');
      return;
    }
    busy.current = true;
    setError(null);
    try {
      await decide.mutateAsync({ to_status: target, note: note.trim() || null });
      setTarget(null);
      setNote('');
    } catch (e) {
      setTarget(null);
      setError(messageOf(e));
    } finally {
      busy.current = false;
    }
  };
  if (query.isPending)
    return (
      <Screen>
        <ListSkeleton count={2} />
      </Screen>
    );
  if (!query.data)
    return (
      <Screen>
        <ErrorState message={messageOf(query.error)} onRetry={() => void query.refetch()} />
      </Screen>
    );
  const p = query.data;
  const next = NEXT[p.status];
  return (
    <Screen>
      <Text variant="display" accessibilityRole="header">
        {p.full_name}
      </Text>
      <Text muted>{p.job_title}</Text>
      <HiringStatus status={APPLICATION_STAGE[p.status] ?? p.status} />
      <Card>
        <Text variant="heading">Profile</Text>
        <Text>{p.headline ?? 'No headline supplied'}</Text>
        {p.summary ? <Text>{p.summary}</Text> : null}
        <Text muted>{p.skills.join(' · ') || 'No skills listed'}</Text>
      </Card>
      {p.cover_note ? (
        <Card>
          <Text variant="heading">Application note</Text>
          <Text>{p.cover_note}</Text>
        </Card>
      ) : null}
      <Card>
        <Text variant="heading">Resume shared for this application</Text>
        <Text>{p.resume_text ?? 'No resume was attached.'}</Text>
      </Card>
      {error ? (
        <Text color={colors.danger} accessibilityRole="alert">
          {error}
        </Text>
      ) : null}
      {next && canRecruit(role) ? (
        <>
          <Field
            label="Job-related decision note"
            value={note}
            onChangeText={setNote}
            multiline
            maxLength={2000}
            placeholder="Required if you choose not to progress this application."
          />
          <Notice
            title="A person makes this decision"
            body="This updates the application stage and notifies the candidate. It does not send an employment contract or reserve a shift."
          />
          <Row>
            <Button title={`Move to ${APPLICATION_STAGE[next]}`} onPress={() => setTarget(next)} />
            <Button
              title="Do not progress"
              variant="danger"
              onPress={() => {
                if (!note.trim()) setError('Add a job-related reason first.');
                else setTarget('rejected');
              }}
            />
          </Row>
        </>
      ) : null}
      <Text variant="heading" accessibilityRole="header">
        Application history
      </Text>
      {p.events.map((e) => (
        <Card key={e.id}>
          <Text variant="label">
            {e.to_status
              ? (APPLICATION_STAGE[e.to_status] ?? e.to_status)
              : e.event_type.replaceAll('_', ' ')}
          </Text>
          <Text variant="caption" muted>
            {new Date(e.created_at).toLocaleString('en-AU')}
          </Text>
          {e.note ? <Text>{e.note}</Text> : null}
        </Card>
      ))}
      <Card>
        <Text variant="heading">Shared documents</Text>
        <Text variant="caption" muted>
          Only files selected for this application. Qualifications are not automatically verified.
        </Text>
        {sharedDocuments.isError ? (
          <Text accessibilityRole="alert">Documents are unavailable.</Text>
        ) : sharedDocuments.data?.length ? (
          sharedDocuments.data.map((d) => (
            <Card key={d.id}>
              <Text>{d.title} · Not verified</Text>
              {Platform.OS !== 'web' ? (
                <Button
                  title={`Open ${d.title}`}
                  variant="secondary"
                  onPress={() => {
                    void downloadPrivateDocument(
                      `/v1/employers/${employerId}/applications/${id}/documents/${d.id}/content`,
                      d.content_type,
                      () => active.current && workspace.current === employerId,
                    ).catch((e) => setError(messageOf(e)));
                  }}
                />
              ) : (
                <Text>Download from the employer web portal.</Text>
              )}
            </Card>
          ))
        ) : (
          <Text>No files shared.</Text>
        )}
      </Card>
      <ConfirmSheet
        visible={target !== null}
        title={
          target === 'rejected'
            ? 'Do not progress this application?'
            : `Move to ${APPLICATION_STAGE[target ?? ''] ?? 'next stage'}?`
        }
        body="The candidate will receive an application update. Check the role requirements and your decision before continuing."
        confirmLabel="Confirm decision"
        destructive={target === 'rejected'}
        busy={decide.isPending}
        onCancel={() => setTarget(null)}
        onConfirm={() => void run()}
      />
    </Screen>
  );
}
