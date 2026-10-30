import Ionicons from '@expo/vector-icons/Ionicons';
import type { ReactNode } from 'react';
import { Pressable, View } from 'react-native';
import { useHireWorkspace } from '@/state/HireWorkspace';
import { useTheme } from '@/theme/ThemeProvider';
import { radius, space } from '@/theme/tokens';
import { BrandLockup } from './brand';
import { Badge, Card, Screen, Text } from './primitives';
import { EmptyState, ErrorState, ListSkeleton } from './states';

export function HireGate({ children }: { children: ReactNode }) {
  const ws = useHireWorkspace();
  if (ws.pending)
    return (
      <Screen>
        <ListSkeleton count={2} />
      </Screen>
    );
  if (ws.error)
    return (
      <Screen>
        <ErrorState
          message="We couldn't load your business. Please try again."
          onRetry={ws.retry}
        />
      </Screen>
    );
  if (!ws.employerId)
    return (
      <Screen>
        <EmptyState
          title="No business workspace"
          body="This account isn't linked to a business. Ask the business owner to add your employer account."
        />
      </Screen>
    );
  return children;
}

export function HireHeading({ title, body }: { title: string; body?: string }) {
  return (
    <View style={{ gap: space(1), paddingVertical: space(1) }}>
      <BrandLockup size={30} />
      <Text variant="display" accessibilityRole="header" style={{ marginTop: space(1) }}>
        {title}
      </Text>
      {body ? <Text muted>{body}</Text> : null}
    </View>
  );
}

export function Notice({ title, body }: { title: string; body: string }) {
  const { colors } = useTheme();
  return (
    <Card style={{ backgroundColor: colors.surface2 }}>
      <Text variant="label">{title}</Text>
      <Text variant="caption" muted>
        {body}
      </Text>
    </Card>
  );
}

export function ActionTile({
  icon,
  title,
  detail,
  onPress,
}: {
  icon: React.ComponentProps<typeof Ionicons>['name'];
  title: string;
  detail: string;
  onPress: () => void;
}) {
  const { colors } = useTheme();
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`${title}. ${detail}`}
      onPress={onPress}
      style={({ pressed }) => ({
        flex: 1,
        minWidth: 140,
        padding: space(2),
        gap: space(1),
        borderRadius: radius.card,
        backgroundColor: pressed ? colors.surface2 : colors.surface,
        borderWidth: 1,
        borderColor: colors.border,
      })}
    >
      <Ionicons name={icon} size={24} color={colors.primary} accessible={false} />
      <Text variant="heading">{title}</Text>
      <Text variant="caption" muted>
        {detail}
      </Text>
    </Pressable>
  );
}

const statuses: Record<string, { label: string; tone: 'neutral' | 'live' | 'warn' | 'ok' }> = {
  draft: { label: 'Draft', tone: 'neutral' },
  published: { label: 'Live', tone: 'live' },
  unpublished: { label: 'Paused', tone: 'warn' },
  expired: { label: 'Expired', tone: 'neutral' },
  closed: { label: 'Closed', tone: 'neutral' },
  hired: { label: 'Hired', tone: 'ok' },
};
export function HiringStatus({ status }: { status: string }) {
  const value = statuses[status] ?? {
    label: status.replaceAll('_', ' '),
    tone: 'neutral' as const,
  };
  return <Badge label={value.label} tone={value.tone} />;
}
