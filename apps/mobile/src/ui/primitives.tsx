import { forwardRef, type ReactNode } from 'react';
import {
  ActivityIndicator,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text as RNText,
  TextInput,
  View,
  type PressableProps,
  type StyleProp,
  type TextInputProps,
  type TextProps,
  type ViewStyle,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { MIN_TOUCH, radius, space } from '@/theme/tokens';
import { useTheme } from '@/theme/ThemeProvider';

type Variant = 'display' | 'title' | 'heading' | 'body' | 'caption' | 'label';
const SIZES: Record<
  Variant,
  {
    fontSize: number;
    lineHeight: number;
    weight: '400' | '500' | '600' | '700' | '800';
    family: 'display' | 'body';
  }
> = {
  display: { fontSize: 30, lineHeight: 36, weight: '800', family: 'display' },
  title: { fontSize: 22, lineHeight: 28, weight: '800', family: 'display' },
  heading: { fontSize: 17, lineHeight: 22, weight: '700', family: 'display' },
  body: { fontSize: 16, lineHeight: 24, weight: '400', family: 'body' },
  label: { fontSize: 15, lineHeight: 20, weight: '600', family: 'body' },
  caption: { fontSize: 13, lineHeight: 18, weight: '400', family: 'body' },
};

export const FONT = {
  display: { '700': 'Manrope_700Bold', '800': 'Manrope_800ExtraBold' } as Record<string, string>,
  body: {
    '400': 'Inter_400Regular',
    '500': 'Inter_500Medium',
    '600': 'Inter_600SemiBold',
  } as Record<string, string>,
};

/** Text with brand type scale. Scales with the user's font size, capped so layouts survive. */
export function Text({
  variant = 'body',
  muted,
  color,
  style,
  ...rest
}: TextProps & { variant?: Variant; muted?: boolean; color?: string }) {
  const { colors } = useTheme();
  const v = SIZES[variant];
  const family =
    v.family === 'display'
      ? (FONT.display[v.weight] ?? FONT.display['800'])
      : (FONT.body[v.weight] ?? FONT.body['400']);
  return (
    <RNText
      maxFontSizeMultiplier={1.6}
      {...rest}
      style={[
        {
          color: color ?? (muted ? colors.muted : colors.text),
          fontSize: v.fontSize,
          lineHeight: v.lineHeight,
          fontFamily: family,
        },
        style,
      ]}
    />
  );
}

export function Screen({
  children,
  scroll = true,
  padded = true,
  edges = ['top', 'left', 'right'],
  refreshControl,
  keyboardShouldPersistTaps = 'handled',
}: {
  children: ReactNode;
  scroll?: boolean;
  padded?: boolean;
  edges?: ('top' | 'bottom' | 'left' | 'right')[];
  refreshControl?: React.ReactElement<import('react-native').RefreshControlProps>;
  keyboardShouldPersistTaps?: 'always' | 'never' | 'handled';
}) {
  const { colors } = useTheme();
  const pad = padded ? { padding: space(2), paddingBottom: space(6), gap: space(2) } : undefined;
  return (
    <SafeAreaView edges={edges} style={{ flex: 1, backgroundColor: colors.bg }}>
      {scroll ? (
        <ScrollView
          contentContainerStyle={pad}
          refreshControl={refreshControl}
          keyboardShouldPersistTaps={keyboardShouldPersistTaps}
        >
          {children}
        </ScrollView>
      ) : (
        <View style={[{ flex: 1 }, pad]}>{children}</View>
      )}
    </SafeAreaView>
  );
}

export function Card({ children, style }: { children: ReactNode; style?: StyleProp<ViewStyle> }) {
  const { colors } = useTheme();
  return (
    <View
      style={[
        {
          backgroundColor: colors.surface,
          borderColor: colors.border,
          borderWidth: StyleSheet.hairlineWidth,
          borderRadius: radius.card,
          padding: space(2.5),
          gap: space(1),
        },
        style,
      ]}
    >
      {children}
    </View>
  );
}

type ButtonProps = Omit<PressableProps, 'children'> & {
  title: string;
  variant?: 'primary' | 'secondary' | 'danger' | 'ghost';
  loading?: boolean;
  full?: boolean;
};

export function Button({
  title,
  variant = 'primary',
  loading,
  disabled,
  full,
  style,
  ...rest
}: ButtonProps) {
  const { colors } = useTheme();
  const off = disabled || loading;
  const bg = variant === 'primary' ? colors.primary : 'transparent';
  const fg =
    variant === 'primary'
      ? colors.onPrimary
      : variant === 'danger'
        ? colors.danger
        : colors.primary;
  const border =
    variant === 'secondary' ? colors.primary : variant === 'danger' ? colors.danger : 'transparent';
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={title}
      accessibilityState={{ disabled: !!off, busy: !!loading }}
      disabled={off}
      style={(s) => [
        {
          minHeight: MIN_TOUCH + 4,
          borderRadius: radius.button,
          paddingHorizontal: space(2.5),
          alignItems: 'center',
          justifyContent: 'center',
          flexDirection: 'row',
          gap: space(1),
          backgroundColor: bg,
          borderWidth: 2,
          borderColor: border,
          opacity: off ? 0.55 : s.pressed ? 0.85 : 1,
          alignSelf: full ? 'stretch' : 'flex-start',
        },
        typeof style === 'function' ? style(s) : style,
      ]}
      {...rest}
    >
      {loading ? <ActivityIndicator color={fg} /> : null}
      <Text variant="label" color={fg}>
        {title}
      </Text>
    </Pressable>
  );
}

export function Chip({
  label,
  selected,
  onPress,
  accessibilityHint,
}: {
  label: string;
  selected?: boolean;
  onPress?: () => void;
  accessibilityHint?: string;
}) {
  const { colors } = useTheme();
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole={onPress ? 'button' : 'text'}
      accessibilityState={{ selected: !!selected }}
      accessibilityHint={accessibilityHint}
      style={{
        minHeight: MIN_TOUCH - 4,
        paddingHorizontal: space(1.75),
        justifyContent: 'center',
        borderRadius: radius.chip,
        borderWidth: 1.5,
        borderColor: selected ? colors.primary : colors.border,
        backgroundColor: selected ? colors.primary : colors.surface,
      }}
    >
      <Text variant="label" color={selected ? colors.onPrimary : colors.text}>
        {label}
      </Text>
    </Pressable>
  );
}

export function Badge({
  label,
  tone = 'neutral',
  icon,
}: {
  label: string;
  tone?: 'neutral' | 'live' | 'warn' | 'ok';
  icon?: string;
}) {
  const { colors } = useTheme();
  const map = {
    neutral: [colors.surface2, colors.text],
    live: [colors.liveTint, colors.onLiveTint],
    warn: [colors.warnTint, colors.onWarnTint],
    ok: [colors.successTint, colors.onSuccessTint],
  } as const;
  const [bg, fg] = map[tone];
  return (
    <View
      style={{
        alignSelf: 'flex-start',
        backgroundColor: bg,
        borderRadius: radius.chip,
        paddingHorizontal: space(1.25),
        paddingVertical: 3,
        flexDirection: 'row',
        gap: 4,
      }}
    >
      {icon ? (
        <Text variant="caption" color={fg}>
          {icon}
        </Text>
      ) : null}
      <Text variant="caption" color={fg} style={{ fontWeight: '600' }}>
        {label}
      </Text>
    </View>
  );
}

export const Field = forwardRef<
  React.ComponentRef<typeof TextInput>,
  TextInputProps & { label: string; hint?: string; error?: string | null }
>(function Field({ label, hint, error, style, ...rest }, ref) {
  const { colors } = useTheme();
  return (
    <View style={{ gap: 6 }}>
      <Text variant="label">{label}</Text>
      <TextInput
        ref={ref}
        accessibilityLabel={label}
        placeholderTextColor={colors.muted}
        maxFontSizeMultiplier={1.6}
        style={[
          {
            minHeight: MIN_TOUCH + 4,
            borderRadius: radius.button,
            borderWidth: 1.5,
            borderColor: error ? colors.danger : colors.muted,
            backgroundColor: colors.surface,
            color: colors.text,
            paddingHorizontal: space(1.5),
            paddingVertical: Platform.OS === 'ios' ? 12 : 8,
            fontSize: 16,
            fontFamily: FONT.body['400'],
          },
          style,
        ]}
        {...rest}
      />
      {error ? (
        <Text variant="caption" color={colors.danger} accessibilityLiveRegion="polite">
          {error}
        </Text>
      ) : hint ? (
        <Text variant="caption" muted>
          {hint}
        </Text>
      ) : null}
    </View>
  );
});

export function Row({ children, style }: { children: ReactNode; style?: StyleProp<ViewStyle> }) {
  return (
    <View
      style={[
        { flexDirection: 'row', alignItems: 'center', gap: space(1), flexWrap: 'wrap' },
        style,
      ]}
    >
      {children}
    </View>
  );
}
