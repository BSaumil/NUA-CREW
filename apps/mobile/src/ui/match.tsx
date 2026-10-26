import { View } from 'react-native';
import type { Schemas } from '@nua-crew/contracts';
import { useTheme } from '@/theme/ThemeProvider';
import { radius, space } from '@/theme/tokens';
import { Badge, Card, Text } from './primitives';

const LABELS: Record<string, string> = {
  semantic: 'Meaning similarity',
  skills: 'Skills',
  experience: 'Experience',
  commute: 'Location',
  salary: 'Pay',
  preference: 'Your preferences',
  trajectory: 'Career path',
};

export function MatchBreakdown({ match }: { match: Schemas['MatchOut'] }) {
  const { colors } = useTheme();
  return (
    <Card>
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
        <Text variant="heading">My match</Text>
        <Badge
          tone="live"
          icon="●"
          label={
            match.estimate == null
              ? 'Not enough information'
              : `${Math.round(match.estimate)}% estimate`
          }
        />
      </View>
      <Text variant="caption" muted>
        {match.label}
      </Text>
      <View style={{ gap: space(1.5), marginTop: space(1) }}>
        {match.components.map((c) => {
          const pct = Math.round((c.score ?? 0) * 100);
          return (
            <View
              key={c.key}
              style={{ gap: 4 }}
              accessible
              accessibilityLabel={`${LABELS[c.key] ?? c.key}: ${c.evaluated ? `${pct} percent` : 'not evaluated'}. ${c.evidence}`}
            >
              <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
                <Text variant="label">{LABELS[c.key] ?? c.key}</Text>
                <Text variant="caption" muted>
                  {c.evaluated ? `${pct}%` : 'Not evaluated'}
                </Text>
              </View>
              {c.evaluated ? (
                <View
                  style={{
                    height: 8,
                    borderRadius: radius.chip,
                    backgroundColor: colors.surface2,
                    overflow: 'hidden',
                  }}
                >
                  <View style={{ height: 8, width: `${pct}%`, backgroundColor: colors.primary }} />
                </View>
              ) : null}
              <Text variant="caption" muted>
                {c.evidence}
              </Text>
            </View>
          );
        })}
      </View>
      {match.missing_skills.length ? (
        <Text style={{ marginTop: space(1) }}>
          <Text variant="label">Skills to add or build: </Text>
          {match.missing_skills.join(', ')}
        </Text>
      ) : null}
    </Card>
  );
}
