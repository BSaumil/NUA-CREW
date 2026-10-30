import { useLocalSearchParams, useRouter } from 'expo-router';
import { useState } from 'react';
import { View } from 'react-native';
import { messageOf } from '@/api/client';
import {
  useAcceptInvitation,
  useAddEmployerPref,
  useDeclineInvitation,
  useInvitation,
} from '@/api/queries';
import {
  changedTerms,
  expiryText,
  KIND_LABEL,
  STATUS_LABEL,
  termsLines,
} from '@/features/invitations';
import { useTheme } from '@/theme/ThemeProvider';
import { radius, space } from '@/theme/tokens';
import {
  Badge,
  Button,
  Card,
  ConfirmSheet,
  EmptyState,
  ErrorState,
  ListSkeleton,
  PayLine,
  Row,
  Screen,
  Text,
} from '@/ui';

export default function InvitationDetail() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const { colors } = useTheme();
  const q = useInvitation(id);
  const accept = useAcceptInvitation();
  const decline = useDeclineInvitation();
  const block = useAddEmployerPref();
  const [error, setError] = useState<string | null>(null);
  const [confirmBlock, setConfirmBlock] = useState(false);

  if (q.isPending)
    return (
      <Screen>
        <ListSkeleton count={2} />
      </Screen>
    );
  if (q.isError || !q.data) {
    const gone = (q.error as { status?: number } | null)?.status === 404;
    return (
      <Screen>
        {gone ? (
          <EmptyState
            title="This invitation isn't available"
            body="It may belong to another account, or it was removed."
            action={{ label: 'Back to inbox', onPress: () => router.replace('/(app)/inbox') }}
          />
        ) : (
          <ErrorState message={messageOf(q.error)} onRetry={() => void q.refetch()} />
        )}
      </Screen>
    );
  }

  const i = q.data;
  const st = STATUS_LABEL[i.status] ?? { label: i.status, tone: 'neutral' as const };
  const shown = i.terms_changed && i.current_terms ? i.current_terms : i.terms;
  const diffs = i.terms_changed && i.current_terms ? changedTerms(i.terms, i.current_terms) : [];
  const busy = accept.isPending || decline.isPending;

  const run = async (fn: () => Promise<unknown>, after?: () => void) => {
    setError(null);
    try {
      await fn();
      after?.();
    } catch (e) {
      setError(messageOf(e));
      void q.refetch(); // the server state may have moved (changed terms, expiry, withdrawal)
    }
  };

  const doBlock = () => {
    setConfirmBlock(false);
    void run(
      () => block.mutateAsync({ employer_id: i.employer_id, kind: 'block' }),
      () => router.replace('/(app)/inbox'),
    );
  };

  return (
    <Screen edges={['left', 'right']}>
      <Row style={{ justifyContent: 'space-between' }}>
        <Text variant="title" accessibilityRole="header">
          {i.terms.business} invited you
        </Text>
      </Row>
      <Row>
        <Badge tone={st.tone} label={st.label} />
        <Badge label={KIND_LABEL[i.kind]} />
        {expiryText(i.expires_at, i.status) ? (
          <Text variant="caption" muted>
            {expiryText(i.expires_at, i.status)}
          </Text>
        ) : null}
      </Row>

      {i.note ? (
        <Card>
          <Text variant="label">Their note</Text>
          <Text selectable>{i.note}</Text>
        </Card>
      ) : null}

      {diffs.length ? (
        <View
          accessibilityRole="alert"
          style={{
            backgroundColor: colors.warnTint,
            borderRadius: radius.button,
            padding: space(1.5),
            gap: space(0.5),
          }}
        >
          <Text variant="label" color={colors.onWarnTint}>
            The job details changed since this invitation was sent
          </Text>
          {diffs.map((d) => (
            <Text key={d} variant="caption" color={colors.onWarnTint}>
              {d}
            </Text>
          ))}
          <Text variant="caption" color={colors.onWarnTint}>
            What you see below is the latest. Accepting means you've reviewed it.
          </Text>
        </View>
      ) : null}

      <Card>
        <Text variant="heading" accessibilityRole="header">
          The role
        </Text>
        {termsLines(shown).map((l) => (
          <Text key={l}>{l}</Text>
        ))}
        <PayLine
          job={{
            pay_min: shown.pay_min ?? null,
            pay_max: shown.pay_max ?? null,
            pay_period: shown.pay_period ?? null,
            pay_currency: 'AUD',
            pay_basis: shown.pay_basis,
            super_included: shown.super_included ?? null,
          }}
        />
        {!i.job_open ? (
          <Text accessibilityRole="alert" color={colors.danger}>
            This job is no longer open.
          </Text>
        ) : null}
        <Button
          title="View the job"
          variant="secondary"
          onPress={() => router.push({ pathname: '/job/[id]', params: { id: shown.job_id } })}
        />
      </Card>

      {i.status === 'pending' ? (
        <>
          <Text variant="caption" muted>
            {i.acceptance_note}
          </Text>
          {error ? (
            <Text accessibilityRole="alert" accessibilityLiveRegion="polite" color={colors.danger}>
              {error}
            </Text>
          ) : null}
          <Button
            title={diffs.length ? 'Accept the updated details' : 'Accept and open a conversation'}
            full
            disabled={!i.can_accept || busy}
            loading={accept.isPending}
            onPress={() => {
              void run(() => accept.mutateAsync({ id: i.id, termsHash: i.current_terms_hash! }));
            }}
          />
          <Button
            title="Decline"
            variant="secondary"
            full
            disabled={busy}
            loading={decline.isPending}
            onPress={() =>
              void run(
                () => decline.mutateAsync(i.id),
                () => router.back(),
              )
            }
          />
          <Text variant="caption" muted>
            You don't need to give a reason.
          </Text>
        </>
      ) : null}

      {i.status === 'accepted' && i.conversation_id ? (
        <Button
          title="Open conversation"
          full
          onPress={() =>
            router.replace({ pathname: '/conversation/[id]', params: { id: i.conversation_id! } })
          }
        />
      ) : null}
      {i.status !== 'pending' && i.status !== 'accepted' ? (
        <Text muted>
          {i.status === 'expired'
            ? 'This invitation expired. The employer would need to send a new one.'
            : i.status === 'withdrawn'
              ? 'The employer withdrew this invitation.'
              : 'You declined this invitation.'}
        </Text>
      ) : null}

      <Button
        title={`Block ${i.terms.business}`}
        variant="ghost"
        accessibilityLabel={`Block ${i.terms.business}`}
        onPress={() => setConfirmBlock(true)}
      />
      {error && i.status !== 'pending' ? (
        <Text accessibilityRole="alert" color={colors.danger}>
          {error}
        </Text>
      ) : null}
      <ConfirmSheet
        visible={confirmBlock}
        title={`Block ${i.terms.business}?`}
        body="They will not be able to find or invite you, and any conversation with them closes. You can undo this under Employers I prefer or avoid."
        confirmLabel="Block"
        destructive
        busy={block.isPending}
        onConfirm={doBlock}
        onCancel={() => setConfirmBlock(false)}
      />
    </Screen>
  );
}
