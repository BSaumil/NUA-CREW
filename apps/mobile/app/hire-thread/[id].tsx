import { randomUUID } from 'expo-crypto';
import { useLocalSearchParams } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import { View } from 'react-native';
import {
  canRecruit,
  useHireMessages,
  useHireRead,
  useHireReport,
  useHireSend,
  useHireThreads,
} from '@/api/hire';
import { messageOf } from '@/api/client';
import { useHireWorkspace } from '@/state/HireWorkspace';
import { useTheme } from '@/theme/ThemeProvider';
import { space } from '@/theme/tokens';
import {
  Button,
  Card,
  EmptyState,
  ErrorState,
  Field,
  ListSkeleton,
  Screen,
  Sheet,
  Text,
} from '@/ui';
import { HireGate, Notice } from '@/ui/hire';

export default function HireThread() {
  const { id } = useLocalSearchParams<{ id: string }>();
  return (
    <HireGate>
      <Thread id={id} key={id} />
    </HireGate>
  );
}
function Thread({ id }: { id: string }) {
  const { role } = useHireWorkspace();
  const { colors } = useTheme();
  const query = useHireMessages(id);
  const threads = useHireThreads();
  const send = useHireSend(id);
  const read = useHireRead(id);
  const report = useHireReport(id);
  const [draft, setDraft] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [reporting, setReporting] = useState<{ messageId?: string } | null>(null);
  const [reason, setReason] = useState('');
  const [notice, setNotice] = useState<string | null>(null);
  const keys = useRef(new Map<string, string>());
  const busy = useRef(false);
  const lastRead = useRef<string | null>(null);
  const conv = threads.data?.find((c) => c.id === id);
  const latest = query.data?.pages[0]?.items[0]?.id;
  useEffect(() => {
    if (query.isSuccess && latest && latest !== lastRead.current) {
      lastRead.current = latest;
      read.mutate();
    }
  }, [query.isSuccess, latest, read]);
  const submit = async () => {
    if (busy.current || !draft.trim()) return;
    busy.current = true;
    setError(null);
    const text = draft.trim();
    let key = keys.current.get(text);
    if (!key) {
      key = randomUUID();
      keys.current.set(text, key);
    }
    try {
      await send.mutateAsync({ body: text, client_key: key });
      setDraft('');
      keys.current.delete(text);
    } catch (e) {
      setError(messageOf(e));
    } finally {
      busy.current = false;
    }
  };
  const submitReport = async () => {
    if (!reason.trim() || report.isPending) return;
    try {
      await report.mutateAsync({ reason: reason.trim(), message_id: reporting?.messageId ?? null });
      setReporting(null);
      setReason('');
      setNotice('Report received for human review.');
    } catch (e) {
      setError(messageOf(e));
    }
  };
  if (query.isPending)
    return (
      <Screen>
        <ListSkeleton count={3} />
      </Screen>
    );
  if (!query.data)
    return (
      <Screen>
        <ErrorState message={messageOf(query.error)} onRetry={() => void query.refetch()} />
      </Screen>
    );
  const messages = query.data.pages
    .flatMap((p) => p.items)
    .slice()
    .reverse();
  return (
    <Screen>
      <Text variant="title" accessibilityRole="header">
        {conv?.counterpart ?? 'Conversation'}
      </Text>
      <Text muted>{conv?.job_title}</Text>
      <Button
        title="Report conversation"
        variant="ghost"
        onPress={() => {
          setReporting({});
          setError(null);
        }}
      />
      {notice ? <Text accessibilityRole="alert">{notice}</Text> : null}
      {query.hasNextPage ? (
        <Button
          title="Load earlier messages"
          variant="secondary"
          loading={query.isFetchingNextPage}
          onPress={() => void query.fetchNextPage()}
        />
      ) : null}
      {messages.length === 0 ? (
        <EmptyState
          title="You're connected"
          body="Start with a short introduction and a helpful question about the role."
        />
      ) : (
        messages.map((m) => (
          <View
            key={m.id}
            style={{
              alignSelf: m.mine ? 'flex-end' : 'flex-start',
              maxWidth: '94%',
              gap: space(0.5),
            }}
          >
            <Card style={{ backgroundColor: m.mine ? colors.surface2 : colors.surface }}>
              <Text>{m.body}</Text>
              <Text variant="caption" muted>
                {m.mine ? 'Your team' : 'Candidate'} ·{' '}
                {new Date(m.created_at).toLocaleTimeString('en-AU', {
                  hour: 'numeric',
                  minute: '2-digit',
                })}
              </Text>
            </Card>
            {!m.mine ? (
              <Button
                title="Report this message"
                variant="ghost"
                onPress={() => {
                  setReporting({ messageId: m.id });
                  setError(null);
                }}
              />
            ) : null}
          </View>
        ))
      )}
      {error && !reporting ? (
        <Text accessibilityRole="alert" color={colors.danger}>
          {error}
        </Text>
      ) : null}
      {conv?.status === 'open' && canRecruit(role) ? (
        <Card>
          <Field
            label="Message"
            value={draft}
            onChangeText={setDraft}
            editable={!send.isPending}
            multiline
            maxLength={5000}
            placeholder="Write a message about the role…"
          />
          <Button
            title="Send message"
            disabled={!draft.trim()}
            loading={send.isPending}
            onPress={() => void submit()}
          />
          <Text variant="caption" muted>
            Plain text only. Never request payment or unnecessary personal information.
          </Text>
        </Card>
      ) : (
        <Notice
          title={
            conv?.status === 'closed' ? 'This conversation is closed' : 'Read-only conversation'
          }
          body="You can review the available history. New messages cannot be sent from this account right now."
        />
      )}
      <Sheet visible={!!reporting} onClose={() => setReporting(null)}>
        <Text variant="title">Report for review</Text>
        <Text muted>
          Describe what happened. The support team receives your reason and, if selected, an excerpt
          of the reported message.
        </Text>
        <Field
          label="Reason for reporting"
          value={reason}
          onChangeText={setReason}
          maxLength={500}
          multiline
        />
        {error ? (
          <Text accessibilityRole="alert" color={colors.danger}>
            {error}
          </Text>
        ) : null}
        <Button
          title="Submit report"
          disabled={!reason.trim()}
          loading={report.isPending}
          onPress={() => void submitReport()}
        />
        <Button title="Cancel" variant="ghost" onPress={() => setReporting(null)} />
      </Sheet>
    </Screen>
  );
}
