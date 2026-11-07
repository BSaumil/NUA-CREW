import { Image, useColorScheme, View } from 'react-native';
import symbolSource from '../../assets/brand/symbol.png';
import logoSource from '../../assets/brand/logo.png';
import { Text } from './primitives';

/** Approved tagline (brand kit, 2026-11-07). */
export const TAGLINE = 'Where Talent Meets Opportunity';
export const SUPPORT_LINE = 'Real work. Real people. Better matches.';
export const MATCH_DISCLOSURE =
  'Match scores are explainable estimates, not promises of employment. People at the employer make every hiring decision.';

// Approved artwork from the brand kit (see scripts/make-icons.mjs). Never redrawn or recoloured.
const SYMBOL_RATIO = 392 / 343;
const LOGO_RATIO = 1030 / 604;

/** Approved symbol; use this at small sizes rather than the full logo. */
export function BrandMark({ size = 40, label }: { size?: number; label?: string }) {
  return (
    <Image
      source={symbolSource}
      style={{ width: Math.round(size * SYMBOL_RATIO), height: size }}
      resizeMode="contain"
      accessible={!!label}
      accessibilityRole={label ? 'image' : undefined}
      accessibilityLabel={label}
      importantForAccessibility={label ? 'yes' : 'no-hide-descendants'}
    />
  );
}

/**
 * The approved full logo, tagline built in, so do not print the tagline again beside it. Use it on
 * the light surfaces of sign-in screens; small navigation uses the compact BrandLockup.
 */
export function BrandLogo({ width = 240 }: { width?: number }) {
  // The artwork is never recoloured: on a dark screen it sits on warm ivory so "CREW" stays legible.
  const dark = useColorScheme() === 'dark';
  const image = (
    <Image
      source={logoSource}
      style={{ width, height: Math.round(width / LOGO_RATIO) }}
      resizeMode="contain"
      accessible
      accessibilityRole="image"
      accessibilityLabel={`NUA CREW. ${TAGLINE}`}
    />
  );
  return dark ? (
    <View
      style={{ alignSelf: 'flex-start', backgroundColor: '#F6F0E5', padding: 12, borderRadius: 12 }}
    >
      {image}
    </View>
  ) : (
    image
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
