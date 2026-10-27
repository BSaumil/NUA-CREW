import { useRouter } from 'expo-router';
import { useRef, useState } from 'react';
import { RefreshControl } from 'react-native';
import { canRecruit, useHireInvitations, useHireThreads, useHireWithdraw } from '@/api/hire';
import { messageOf } from '@/api/client';
import { useHireWorkspace } from '@/state/HireWorkspace';
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
import { HireGate, HireHeading, HiringStatus } from '@/ui/hire';

export default function HireInbox() {
  return (
    <HireGate>
      <Inbox />
    </HireGate>
  );
}
function Inbox() {
  const router = useRouter();
  const { role } = useHireWorkspace();
  const threads = useHireThreads();
  const invites = useHireInvitations();
  const withdraw = useHireWithdraw();
  const [tab, setTab] = useState<'messages' | 'invitations'>('messages');
  const [confirm, setConfirm] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const busy = useRef(false);
  const query = tab === 'messages' ? threads : invites;
  const run = async () => {
    if (!confirm || busy.current) return;
    busy.current = true;
    try {
      await withdraw.mutateAsync(confirm);
      setConfirm(null);
      setError(null);
    } catch (e) {
      setConfirm(null);
      setError(messageOf(e));
    } finally {
      busy.current = false;
    }
  };
  return (
    <Screen
      refreshControl={
        <RefreshControl refreshing={query.isRefetching} onRefresh={() => void query.refetch()} />
      }
    >
      <HireHeading
        title="Good conversations start here."
        body="Messages open when a candidate accepts your invitation."
      />
      <Row>
        <Chip label="Messages" selected={tab === 'messages'} onPress={() => setTab('messages')} />
        <Chip
          label="Sent invitations"
          selected={tab === 'invitations'}
          onPress={() => setTab('invitations')}
        />
      </Row>
      {error ? <ErrorState message={error} /> : null}
      {query.isPending ? (
        <ListSkeleton count={2} />
      ) : query.isError ? (
        <ErrorState message={messageOf(query.error)} onRetry={() => void query.refetch()} />
      ) : tab === 'messages' ? (
        <>
          {threads.data?.length === 0 ? (
            <EmptyState
              title="Your conversations will appear here"
              body="Find people and send a role-specific invitation. Each person chooses whether to open a conversation."
              action={{ label: 'Find people', onPress: () => router.push('/hire/talent') }}
            />
          ) : null}
          {threads.data?.map((c) => (
            <Card key={c.id}>
              <Row>
                <Text variant="heading">{c.counterpart}</Text>
                {c.unread ? <HiringStatus status="New message" /> : null}
              </Row>
              <Text muted>{c.job_title}</Text>
              <HiringStatus status={c.status} />
              <Button
                title={`Open conversation with ${c.counterpart}`}
                variant="secondary"
                onPress={() => router.push({ pathname: '/hire-thread/[id]', params: { id: c.id } })}
              />
            </Card>
          ))}
        </>
      ) : (
        <>
          {invites.data?.length === 0 ? (
            <EmptyState
              title="No invitations sent yet"
              body="A personal invitation connects a real role with someone who chose to be found."
            />
          ) : null}
          {invites.data?.map((i) => (
            <Card key={i.id}>
              <Text variant="heading">{i.candidate_label}</Text>
              <Text muted>{i.job_title}</Text>
              <HiringStatus status={i.status} />
              <Text variant="caption" muted>
                Expires {new Date(i.expires_at).toLocaleDateString('en-AU')}
              </Text>
              {i.status === 'pending' && canRecruit(role) ? (
                <Button
                  title="Withdraw invitation"
                  variant="secondary"
                  onPress={() => setConfirm(i.id)}
                />
              ) : null}
            </Card>
          ))}
        </>
      )}
      <ConfirmSheet
        visible={!!confirm}
        title="Withdraw this invitation?"
        body="The candidate will no longer be able to accept it. Existing accepted conversations are unchanged."
        confirmLabel="Withdraw invitation"
        busy={withdraw.isPending}
        destructive
        onCancel={() => setConfirm(null)}
        onConfirm={() => void run()}
      />
    </Screen>
  );
}
