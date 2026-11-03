import { View } from 'react-native';
import { listMarkets } from '@/features/markets';
import { space } from '@/theme/tokens';
import { Chip, Row, Text } from './primitives';

/** One country, chosen explicitly. Previews are labelled so nobody mistakes them for live. */
export function MarketChoice({
  legend,
  value,
  onChange,
}: {
  legend: string;
  value: string;
  onChange: (code: string) => void;
}) {
  return (
    <View style={{ gap: space(1) }} accessibilityRole="radiogroup" accessibilityLabel={legend}>
      <Text variant="label">{legend}</Text>
      <Row>
        {listMarkets().map((m) => (
          <Chip
            key={m.code}
            role="radio"
            label={`${m.label} (${m.currency})${m.uiStage === 'existing-flow' ? '' : ' · preview'}`}
            selected={value === m.code}
            onPress={() => onChange(m.code)}
          />
        ))}
      </Row>
    </View>
  );
}

/** Multi-select search intent. It only chooses what to show. */
export function SearchMarkets({
  selected,
  onToggle,
}: {
  selected: readonly string[];
  onToggle: (code: string) => void;
}) {
  return (
    <View style={{ gap: space(1) }} accessibilityLabel="Search in">
      <Text variant="label">Search in</Text>
      <Row>
        {listMarkets().map((m) => (
          <Chip
            key={m.code}
            role="checkbox"
            label={`${m.label} (${m.currency})`}
            selected={selected.includes(m.code)}
            onPress={() => onToggle(m.code)}
          />
        ))}
      </Row>
    </View>
  );
}

export function MarketNotice({ message }: { message: string }) {
  return (
    <Text variant="caption" muted accessibilityRole="alert">
      {message}
    </Text>
  );
}
