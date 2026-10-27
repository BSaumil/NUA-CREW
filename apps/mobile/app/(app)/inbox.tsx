import { useRouter } from 'expo-router';
import { useState } from 'react';
import { Pressable, RefreshControl, View } from 'react-native';
import { messageOf } from '@/api/client';
import {
  useConversations,
  useInvitationSettings,
  useInvitations,
  useSetInvitationsEnabled,
} from '@/api/queries';
import { expiryText, KIND_LABEL, STATUS_LABEL } from '@/features/invitations';
import { useTheme } from '@/theme/ThemeProvider';
import { space } from '@/theme/tokens';
import {
  Badge,
  Button,
  Card,
  Chip,
  EmptyState,
  ErrorState,
  ListSkeleton,
  OfflineBanner,
  Row,
  Screen,
  Text,
} from '@/ui';

type Tab = 'invitations' | 'messages';

export default function Inbox() {
  const router = useRouter();
  const { colors } = useTheme();
  const [tab, setTab] = useState<Tab>('invitations');
  const inv = useInvitations();
  const convs = useConversations();
  const settings = useInvitationSettings();
  const setEnabled = useSetInvitationsEnabled();
  const q = tab === 'invitations' ? inv : convs;
  const allowed = settings.data?.invitations_enabled ?? true;

  return (
    <Screen
      refreshControl={
        <RefreshControl
          refreshing={q.isRefetching}
          onRefresh={() => {
            void inv.refetch();
            void convs.refetch();
          }}
          tintColor={colors.primary}
        />
      }
    >
      <OfflineBanner />
      <Text variant="title" accessibilityRole="header">
        Inbox
      </Text>
      <View accessibilityRole="tablist" style={{ flexDirection: 'row', gap: space(1) }}>
        <Chip
          role="tab"
          label={`Invitations${inv.data?.unread ? ` (${inv.data.unread} new)` : ''}`}
          selected={tab === 'invitations'}
          onPress={() => setTab('invitations')}
        />
        <Chip
          role="tab"
          label={`Messages${convs.data?.some((c) => c.unread) ? ' (new)' : ''}`}
          selected={tab === 'messages'}
          onPress={() => setTab('messages')}
        />
      </View>

      {q.isPending ? (
        <ListSkeleton count={3} />
      ) : q.isError ? (
        <ErrorState message={messageOf(q.error)} onRetry={() => void q.refetch()} />
      ) : tab === 'invitations' ? (
        inv.data!.items.length === 0 ? (
          <EmptyState
            title="No invitations yet"
            body={
              allowed
                ? 'Employers can only invite you if you chose to be found. You decide whether to reply.'
                : 'You have paused new invitations, so employers cannot send you any.'
            }
            action={{ label: 'Work preferences', onPress: () => router.push('/work-preferences') }}
          />
        ) : (
          inv.data!.items.map((i) => {
            const st = STATUS_LABEL[i.status] ?? { label: i.status, tone: 'neutral' as const };
            const exp = expiryText(i.expires_at, i.status);
            return (
              <Card key={i.id}>
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel={`${i.unread && i.status === 'pending' ? 'New. ' : ''}Invitation from ${i.terms.business} for ${i.terms.title}. ${st.label}. ${exp}`}
                  onPress={() =>
                    router.push({ pathname: '/invitation/[id]', params: { id: i.id } })
                  }
                  style={{ gap: space(0.75) }}
                >
                  <Row style={{ justifyContent: 'space-between' }}>
                    <Text variant="heading">{i.terms.business}</Text>
                    <Badge tone={st.tone} label={st.label} />
                  </Row>
                  <Text>{i.terms.title}</Text>
                  <Text variant="caption" muted>
                    {KIND_LABEL[i.kind]}
                    {exp ? ` · ${exp}` : ''}
                    {i.unread && i.status === 'pending' ? ' · New' : ''}
                  </Text>
                </Pressable>
              </Card>
            );
          })
        )
      ) : convs.data!.length === 0 ? (
        <EmptyState
          title="No conversations yet"
          body="A conversation opens only after you accept an invitation."
        />
      ) : (
        convs.data!.map((c) => (
          <Card key={c.id}>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={`${c.unread ? 'New messages. ' : ''}Conversation with ${c.counterpart} about ${c.job_title}${c.status === 'closed' ? ', closed' : ''}`}
              onPress={() => router.push({ pathname: '/conversation/[id]', params: { id: c.id } })}
              style={{ gap: space(0.5) }}
            >
              <Row style={{ justifyContent: 'space-between' }}>
                <Text variant="heading">{c.counterpart}</Text>
                {c.unread ? <Badge tone="live" label="New" /> : null}
              </Row>
              <Text variant="caption" muted>
                {c.job_title}
                {c.status === 'closed' ? ' · Closed' : ''}
              </Text>
            </Pressable>
          </Card>
        ))
      )}

      <Card>
        <Text variant="heading" accessibilityRole="header">
          Invitation settings
        </Text>
        <Text variant="caption" muted>
          {allowed
            ? 'Employers you allow to find you can send invitations. Pausing stops new ones only; invitations you already have and conversations carry on until you end or block them.'
            : 'New invitations are paused. Existing invitations and conversations are unchanged.'}
        </Text>
        <Button
          title={allowed ? 'Pause new invitations' : 'Allow invitations again'}
          variant="secondary"
          loading={setEnabled.isPending}
          onPress={() => setEnabled.mutate(!allowed)}
        />
        <Button
          title="Employers I prefer or avoid"
          variant="ghost"
          onPress={() => router.push('/employer-preferences')}
        />
      </Card>
    </Screen>
  );
}
