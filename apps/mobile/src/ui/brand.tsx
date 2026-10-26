import Svg, { Circle, Path, Rect } from 'react-native-svg';
import { View } from 'react-native';
import { Text } from './primitives';

export const TAGLINE = 'Better Jobs. Stronger Teams.';
export const SUPPORT_LINE = 'Real work. Real people. Better matches.';
export const AI_DISCLOSURE =
  'Match scores are explainable estimates, not promises of employment. People at the employer make every hiring decision.';

/** Icon-only glyph; use this at small sizes rather than the full lockup. */
export function BrandMark({ size = 40, label }: { size?: number; label?: string }) {
  return (
    <Svg
      width={size}
      height={size}
      viewBox="0 0 1024 1024"
      accessibilityRole={label ? 'image' : undefined}
      accessibilityLabel={label}
      accessible={!!label}
      importantForAccessibility={label ? 'yes' : 'no-hide-descendants'}
    >
      <Rect width={1024} height={1024} rx={220} fill="#3C0B21" />
      <Path
        d="M288 776V248L736 776V248"
        fill="none"
        stroke="#F7F3EF"
        strokeWidth={112}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <Path
        d="M288 776V224L736 776"
        fill="none"
        stroke="#C9A96E"
        strokeWidth={28}
        strokeLinecap="round"
      />
      <Circle cx={288} cy={776} r={28} fill="#0FA3B1" />
      <Circle cx={736} cy={248} r={56} fill="#0FA3B1" />
    </Svg>
  );
}

export function BrandLockup({ size = 36 }: { size?: number }) {
  return (
    <View
      accessible
      accessibilityRole="header"
      accessibilityLabel="NUA CREW"
      style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}
    >
      <BrandMark size={size} />
      <View style={{ flexDirection: 'row', alignItems: 'baseline', gap: 6 }}>
        <Text variant="title" style={{ letterSpacing: 1 }}>
          NUA
        </Text>
        <Text variant="caption" muted style={{ letterSpacing: 3, fontWeight: '600' }}>
          CREW
        </Text>
      </View>
    </View>
  );
}
