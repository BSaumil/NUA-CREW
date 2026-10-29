import { View } from 'react-native';
import { VERDICT_COPY, dollars, type PayResult } from '@/features/pay-check';
import { useTheme } from '@/theme/ThemeProvider';
import { radius, space } from '@/theme/tokens';
import { Row, Text } from './primitives';

const DAY: [string, string][] = [
  ['saturday', 'Saturday'],
  ['sunday', 'Sunday'],
  ['public_holiday', 'Public holiday'],
];

/** The employer-facing result of a pay check. Never says "compliant" without "as assessed". */
export function PayVerdictCard({ result }: { result: PayResult }) {
  const { colors } = useTheme();
  const look = VERDICT_COPY[result.status];
  const tint =
    look.tone === 'ok'
      ? colors.successTint
      : look.tone === 'warn'
        ? colors.warnTint
        : colors.surface;
  const fg =
    look.tone === 'ok'
      ? colors.onSuccessTint
      : look.tone === 'warn'
        ? colors.onWarnTint
        : colors.text;
  const issues = result.checks.filter((c) => c.level !== 'info');
  const cell = (label: string, value: string) => (
    <View
      key={label}
      style={{
        minWidth: 104,
        padding: space(1),
        borderRadius: radius.button,
        backgroundColor: colors.surface,
        borderWidth: 1,
        borderColor: colors.border,
      }}
    >
      <Text variant="caption" muted>
        {label}
      </Text>
      <Text variant="label" color={colors.text}>
        {value}
      </Text>
    </View>
  );
  return (
    <View
      accessible
      accessibilityLabel={`Pay check: ${look.title}. ${result.summary}`}
      style={{
        gap: space(1),
        padding: space(2),
        borderRadius: radius.card,
        borderWidth: 2,
        borderColor: look.tone === 'danger' ? colors.danger : fg,
        backgroundColor: tint,
      }}
    >
      <Row>
        <Text variant="heading" color={fg} accessibilityRole="header">
          {look.icon} {look.title}
        </Text>
      </Row>
      <Text color={fg}>{result.summary}</Text>
      {result.minimum_ordinary_hourly_minor != null ? (
        <Row>
          {cell('Your rate', dollars(result.offered_hourly_minor))}
          {cell(
            result.employment === 'casual' ? 'Casual weekday min' : 'Weekday min',
            dollars(result.minimum_ordinary_hourly_minor),
          )}
          {DAY.filter(([k]) => k in result.weekend_and_holiday_minimums).map(([k, label]) =>
            cell(
              `${label} min`,
              result.weekend_and_holiday_minimums[k] == null
                ? 'Not loaded'
                : dollars(result.weekend_and_holiday_minimums[k]),
            ),
          )}
          {result.super?.per_hour_minor != null
            ? cell('Super on top (12%)', dollars(result.super.per_hour_minor))
            : null}
        </Row>
      ) : null}
      {issues.map((c) => (
        <Text key={c.code} variant="caption" color={fg}>
          • {c.text}
        </Text>
      ))}
      <Text variant="caption" color={fg}>
        Not covered by this check: {result.not_assessed.join('; ')}.
      </Text>
      <Text variant="caption" color={fg}>
        {result.data_status === 'verified'
          ? 'Rates verified against the Fair Work pay guide.'
          : 'Reference rates from the supplied 2026–27 edition, awaiting verification.'}
      </Text>
    </View>
  );
}
