import { useEffect, useRef } from 'react';
import { Animated, AccessibilityInfo, View } from 'react-native';
import { useState } from 'react';
import { onlineManager } from '@tanstack/react-query';
import { useTheme } from '@/theme/ThemeProvider';
import { radius, space } from '@/theme/tokens';
import { Button, Card, Text } from './primitives';

export function EmptyState({
  title,
  body,
  action,
}: {
  title: string;
  body?: string;
  action?: { label: string; onPress: () => void };
}) {
  const { colors } = useTheme();
  return (
    <View
      style={{
        alignItems: 'center',
        gap: space(1.5),
        padding: space(4),
        borderWidth: 2,
        borderStyle: 'dashed',
        borderColor: colors.border,
        borderRadius: radius.card,
      }}
    >
      <Text variant="heading" style={{ textAlign: 'center' }}>
        {title}
      </Text>
      {body ? (
        <Text muted style={{ textAlign: 'center' }}>
          {body}
        </Text>
      ) : null}
      {action ? <Button title={action.label} onPress={action.onPress} variant="secondary" /> : null}
    </View>
  );
}

export function ErrorState({ message, onRetry }: { message: string; onRetry?: () => void }) {
  const { colors } = useTheme();
  return (
    <Card style={{ borderColor: colors.danger }}>
      <Text variant="heading">Something went wrong</Text>
      <Text accessibilityRole="alert" accessibilityLiveRegion="polite" muted>
        {message}
      </Text>
      {onRetry ? <Button title="Try again" onPress={onRetry} variant="secondary" /> : null}
    </Card>
  );
}

/** Placeholder block. Pulses only when the person has not asked for reduced motion. */
export function Skeleton({
  height = 16,
  width = '100%',
}: {
  height?: number;
  width?: number | `${number}%`;
}) {
  const { colors } = useTheme();
  const opacity = useRef(new Animated.Value(0.5)).current;
  useEffect(() => {
    let loop: Animated.CompositeAnimation | undefined;
    let cancelled = false;
    AccessibilityInfo.isReduceMotionEnabled().then((reduce) => {
      if (cancelled || reduce) return;
      loop = Animated.loop(
        Animated.sequence([
          Animated.timing(opacity, { toValue: 1, duration: 700, useNativeDriver: true }),
          Animated.timing(opacity, { toValue: 0.5, duration: 700, useNativeDriver: true }),
        ]),
      );
      loop.start();
    });
    return () => {
      cancelled = true;
      loop?.stop();
    };
  }, [opacity]);
  return (
    <Animated.View
      accessibilityElementsHidden
      importantForAccessibility="no"
      style={{ height, width, borderRadius: 8, backgroundColor: colors.surface2, opacity }}
    />
  );
}

export function JobCardSkeleton() {
  return (
    <Card>
      <Skeleton height={20} width="70%" />
      <Skeleton width="45%" />
      <Skeleton height={14} width="60%" />
    </Card>
  );
}

export function ListSkeleton({ count = 4 }: { count?: number }) {
  return (
    <View accessibilityLabel="Loading" accessibilityLiveRegion="polite" style={{ gap: space(1.5) }}>
      {Array.from({ length: count }, (_, i) => (
        <JobCardSkeleton key={i} />
      ))}
    </View>
  );
}

/** Shown when the device is offline; cached results stay readable underneath. */
export function OfflineBanner() {
  const { colors } = useTheme();
  const [online, setOnline] = useState(onlineManager.isOnline());
  useEffect(() => onlineManager.subscribe(setOnline), []);
  if (online) return null;
  return (
    <View
      accessibilityRole="alert"
      style={{
        backgroundColor: colors.warnTint,
        padding: space(1.25),
        borderRadius: radius.button,
      }}
    >
      <Text variant="caption" color={colors.onWarnTint}>
        You are offline. Showing saved results; changes will not sync until you reconnect.
      </Text>
    </View>
  );
}
