import { View } from 'react-native';
import { useAuth } from '@/state/AuthProvider';
import { useTheme } from '@/theme/ThemeProvider';
import { space } from '@/theme/tokens';
import { BrandMark, Button, Text } from '@/ui';
import { useState } from 'react';

/** Covers the app until the person passes Face ID / fingerprint / device passcode. */
export function LockScreen() {
  const { unlock, signOut } = useAuth();
  const { colors } = useTheme();
  const [failed, setFailed] = useState(false);
  return (
    <View
      accessibilityViewIsModal
      style={{
        position: 'absolute',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        backgroundColor: colors.bg,
        alignItems: 'center',
        justifyContent: 'center',
        gap: space(2),
        padding: space(3),
      }}
    >
      <BrandMark size={72} label="NUA CREW" />
      <Text variant="title">NUA CREW is locked</Text>
      <Text muted style={{ textAlign: 'center' }}>
        Unlock to see your applications and profile.
      </Text>
      {failed ? (
        <Text accessibilityLiveRegion="polite" color={colors.danger}>
          That did not work. Try again.
        </Text>
      ) : null}
      <Button title="Unlock" onPress={async () => setFailed(!(await unlock()))} />
      <Button title="Sign out instead" variant="ghost" onPress={() => void signOut()} />
    </View>
  );
}
