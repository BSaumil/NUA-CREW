import { Alert, Linking, View } from 'react-native';
import { useTheme } from '@/theme/ThemeProvider';
import { space } from '@/theme/tokens';
import { Text } from './primitives';

export function SetupProgress({ step, labels }: { step: number; labels: string[] }) {
  const { colors } = useTheme();
  return (
    <View style={{ gap: space(1) }}>
      <Text variant="caption" accessibilityLiveRegion="polite">
        Step {step + 1} of {labels.length} · {labels[step]}
      </Text>
      <View style={{ flexDirection: 'row', gap: space(1) }} accessible={false}>
        {labels.map((label, index) => (
          <View
            key={label}
            style={{
              flex: 1,
              height: 4,
              borderRadius: 2,
              backgroundColor: index <= step ? colors.primary : colors.border,
            }}
          />
        ))}
      </View>
    </View>
  );
}
export function SetupPolicies({ employer = false }: { employer?: boolean }) {
  const { colors } = useTheme();
  const links = employer
    ? [
        ['Terms of use', 'terms'],
        ['Employer terms', 'employer-terms'],
        ['Privacy policy', 'privacy'],
      ]
    : [
        ['Terms of use', 'terms'],
        ['Privacy policy', 'privacy'],
      ];
  return (
    <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: space(2) }}>
      {links.map(([label, path]) => (
        <Text
          key={path}
          accessibilityRole="link"
          style={{ color: colors.primary, paddingVertical: space(1) }}
          onPress={() => {
            const url = `https://iksaa.com.au/${path}`;
            void Linking.openURL(url).catch(() =>
              Alert.alert('Unable to open this page', `Open ${url} in your browser.`),
            );
          }}
        >
          {label}
        </Text>
      ))}
    </View>
  );
}
