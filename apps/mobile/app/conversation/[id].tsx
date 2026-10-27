import { randomUUID } from 'expo-crypto';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import { Pressable, View } from 'react-native';
import { messageOf } from '@/api/client';
import {
  useAddEmployerPref,
  useCloseConversation,
  useConversations,
  useMarkConversationRead,
  useMessages,
  useReportConversation,
  useSendMessage,
} from '@/api/queries';
import { useTheme } from '@/theme/ThemeProvider';
import { radius, space } from '@/theme/tokens';
import {
  Button,
  Card,
  ConfirmSheet,
  EmptyState,
  ErrorState,
  Field,
  ListSkeleton,
  Row,
  Screen,
  Sheet,
  Text,
} from '@/ui';

export default function ConversationScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const { colors } = useTheme();
  const messages = useMessages(id);
  const list = useConversations();
  const send = useSendMessage(id);
  const markRead = useMarkConversationRead();
  const close = useCloseConversation();
  const block = useAddEmployerPref();
  const report = useReportConversation();
  const [draft, setDraft] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [menu, setMenu] = useState<null | { reportMessageId?: string }>(null);
  const [reason, setReason] = useState('');
  const [confirm, setConfirm] = useState<null | 'end' | 'block'>(null);
  const [notice, setNotice] = useState<string | null>(null);
  // One key per unsent draft: a retry after an ambiguous failure cannot create a second message,
  // and a rapid second tap is ignored while the first is in flight.
  const key = useRef(randomUUID());
  const busy = useRef(false);

  const conv = list.data?.find((c) => c.id === id);
  const readOnce = useRef(false);
  useEffect(() => {
    if (messages.isSuccess && !readOnce.current) {
      readOnce.current = true;
      markRead.mutate(id);
    }
  }, [messages.isSuccess, id, markRead]);

  if (messages.isPending)
    return (
      <Screen>
        <ListSkeleton count={3} />
      </Screen>
    );
  if (messages.isError || !messages.data) {
    const gone = (messages.error as { status?: number } | null)?.status === 404;
    return (
      <Screen>
        {gone ? (
          <EmptyState
            title="This conversation isn't available"
            body="It may belong to another account, or it was removed."
            action={{ label: 'Back to inbox', onPress: () => router.replace('/(app)/inbox') }}
          />
        ) : (
          <ErrorState message={messageOf(messages.error)} onRetry={() => void messages.refetch()} />
        )}
      </Screen>
    );
  }

  // pages arrive newest-first; show oldest at the top
  const items = [...messages.data.pages].reverse().flatMap((p) => p.items);
  const closed = conv?.status === 'closed';

  const submit = async () => {
    const body = draft.trim();
    if (!body || busy.current) return;
    busy.current = true;
    setError(null);
    try {
      await send.mutateAsync({ body, clientKey: key.current });
      setDraft('');
      key.current = randomUUID();
    } catch (e) {
      setError(`${messageOf(e)} Your message is still here: tap Send to try again.`);
    } finally {
      busy.current = false;
    }
  };

  const act = async (fn: () => Promise<unknown>, done?: string, after?: () => void) => {
    setError(null);
    try {
      await fn();
      if (done) setNotice(done);
      after?.();
    } catch (e) {
      setError(messageOf(e));
    }
  };

  return (
    <Screen edges={['left', 'right']}>
      <Row style={{ justifyContent: 'space-between' }}>
        <Text variant="title" accessibilityRole="header">
          {conv?.counterpart ?? 'Conversation'}
        </Text>
        <Button title="More" variant="ghost" onPress={() => setMenu({})} />
      </Row>
      {conv ? (
        <Text variant="caption" muted>
          About {conv.job_title}. Nothing here is a job offer or a shift booking.
        </Text>
      ) : null}
      {messages.hasNextPage ? (
        <Button
          title="Load earlier messages"
          variant="secondary"
          loading={messages.isFetchingNextPage}
          onPress={() => void messages.fetchNextPage()}
        />
      ) : null}
      {items.length === 0 ? <Text muted>No messages yet.</Text> : null}
      {items.map((m) => (
        <View
          key={m.id}
          accessible
          accessibilityLabel={`${m.mine ? 'You' : (conv?.counterpart ?? 'Employer')}: ${m.body}`}
          style={{
            alignSelf: m.mine ? 'flex-end' : 'flex-start',
            maxWidth: '85%',
            backgroundColor: m.mine ? colors.primary : colors.surface2,
            borderRadius: radius.card,
            padding: space(1.5),
          }}
        >
          {/* Plain text, never interpreted as markup */}
          <Text color={m.mine ? colors.onPrimary : colors.text} selectable>
            {m.body}
          </Text>
          {!m.mine ? (
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Report this message"
              hitSlop={8}
              onPress={() => setMenu({ reportMessageId: m.id })}
            >
              <Text variant="caption" color={colors.muted}>
                Report
              </Text>
            </Pressable>
          ) : null}
        </View>
      ))}

      {notice ? (
        <Text accessibilityRole="alert" accessibilityLiveRegion="polite">
          {notice}
        </Text>
      ) : null}
      {error ? (
        <Text accessibilityRole="alert" accessibilityLiveRegion="polite" color={colors.danger}>
          {error}
        </Text>
      ) : null}

      {closed ? (
        <Card>
          <Text>This conversation is closed, so no one can send messages.</Text>
        </Card>
      ) : (
        <View style={{ gap: space(1) }}>
          <Field
            label="Message"
            value={draft}
            onChangeText={setDraft}
            multiline
            maxLength={2000}
            hint="Don't share bank details, tax file numbers or ID documents."
            style={{ minHeight: 80, textAlignVertical: 'top' }}
          />
          <Button
            title="Send"
            full
            disabled={!draft.trim()}
            loading={send.isPending}
            onPress={() => void submit()}
          />
        </View>
      )}

      {menu ? (
        <Sheet visible onClose={() => setMenu(null)}>
          <Text variant="title" accessibilityRole="header">
            {menu.reportMessageId ? 'Report this message' : 'Conversation options'}
          </Text>
          <Field
            label="What is wrong? (to report)"
            value={reason}
            onChangeText={setReason}
            multiline
            maxLength={500}
            style={{ minHeight: 70, textAlignVertical: 'top' }}
          />
          <Button
            title="Send report to NUA CREW"
            variant="secondary"
            disabled={reason.trim().length < 3}
            loading={report.isPending}
            onPress={() =>
              void act(
                () =>
                  report.mutateAsync({
                    id,
                    reason: reason.trim(),
                    messageId: menu.reportMessageId,
                  }),
                'Report sent to NUA CREW support.',
                () => {
                  setReason('');
                  setMenu(null);
                },
              )
            }
          />
          {!menu.reportMessageId ? (
            <>
              {!closed ? (
                <Button
                  title="End this conversation"
                  variant="secondary"
                  onPress={() => {
                    setMenu(null); // one sheet at a time
                    setConfirm('end');
                  }}
                />
              ) : null}
              <Button
                title={`Block ${conv?.counterpart ?? 'this employer'}`}
                variant="danger"
                disabled={!conv}
                onPress={() => {
                  setMenu(null);
                  setConfirm('block');
                }}
              />
            </>
          ) : null}
          <Button title="Close" variant="ghost" onPress={() => setMenu(null)} />
        </Sheet>
      ) : null}
      <ConfirmSheet
        visible={confirm === 'end'}
        title="End this conversation?"
        body="Neither of you can send more messages. The history stays. This does not block the employer."
        confirmLabel="End conversation"
        busy={close.isPending}
        onCancel={() => setConfirm(null)}
        onConfirm={() => {
          setConfirm(null);
          void act(
            () => close.mutateAsync(id),
            'Conversation ended.',
            () => setMenu(null),
          );
        }}
      />
      <ConfirmSheet
        visible={confirm === 'block'}
        title={`Block ${conv?.counterpart ?? 'this employer'}?`}
        body="They cannot find, invite or message you, and this conversation closes. You can undo this under Employers I prefer or avoid."
        confirmLabel="Block"
        destructive
        busy={block.isPending}
        onCancel={() => setConfirm(null)}
        onConfirm={() => {
          setConfirm(null);
          if (conv)
            void act(
              () => block.mutateAsync({ employer_id: conv.employer_id, kind: 'block' }),
              undefined,
              () => router.replace('/(app)/inbox'),
            );
        }}
      />
    </Screen>
  );
}
