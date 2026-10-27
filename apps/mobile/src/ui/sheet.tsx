import type { ReactNode } from 'react';
import {
  KeyboardAvoidingView,
  Modal,
  Platform,
  ScrollView,
  View,
  useWindowDimensions,
} from 'react-native';
import { radius, space } from '@/theme/tokens';
import { useTheme } from '@/theme/ThemeProvider';

/**
 * Bottom sheet for forms. It keeps the focused field above the keyboard, scrolls when the content
 * (or large text) does not fit a small screen, and never discards typed text on an accidental tap
 * outside — only explicit Cancel/close does that.
 */
export function Sheet({
  visible,
  onClose,
  children,
}: {
  visible: boolean;
  onClose: () => void;
  children: ReactNode;
}) {
  const { colors } = useTheme();
  const { height } = useWindowDimensions();
  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      <KeyboardAvoidingView
        // Edge-to-edge Android no longer resizes the window for us, so both platforms pad.
        behavior={Platform.OS === 'web' ? undefined : 'padding'}
        style={{ flex: 1, justifyContent: 'flex-end', backgroundColor: '#0008' }}
      >
        <View
          accessibilityViewIsModal
          style={{
            maxHeight: height * 0.92,
            backgroundColor: colors.surface,
            borderTopLeftRadius: radius.card,
            borderTopRightRadius: radius.card,
            borderColor: colors.border,
            borderWidth: 1,
          }}
        >
          <ScrollView
            keyboardShouldPersistTaps="handled"
            keyboardDismissMode={Platform.OS === 'ios' ? 'interactive' : 'on-drag'}
            contentContainerStyle={{ padding: space(2.5), paddingBottom: space(4), gap: space(2) }}
          >
            {children}
          </ScrollView>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}
