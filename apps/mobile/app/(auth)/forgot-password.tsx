import { Link } from 'expo-router';
import { useState } from 'react';
import { KeyboardAvoidingView, Platform } from 'react-native';
import { messageOf } from '@/api/client';
import { EMAIL_UNAVAILABLE, RESET_SENT, requestPasswordReset } from '@/features/recovery';
import { emailError } from '@/features/validation';
import { useTheme } from '@/theme/ThemeProvider';
import { space } from '@/theme/tokens';
import { BrandLockup, Button, Field, Screen, Text } from '@/ui';

export default function ForgotPassword() {
  const { colors } = useTheme();
  const [email, setEmail] = useState('');
  const [touched, setTouched] = useState(false);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<{ kind: 'ok' | 'error'; text: string } | null>(null);

  const submit = async () => {
    setTouched(true);
    setMessage(null);
    if (emailError(email)) return;
    setBusy(true);
    try {
      const outcome = await requestPasswordReset(email);
      setMessage(
        outcome === 'sent'
          ? { kind: 'ok', text: RESET_SENT }
          : { kind: 'error', text: EMAIL_UNAVAILABLE },
      );
    } catch (e) {
      setMessage({ kind: 'error', text: messageOf(e) });
    } finally {
      setBusy(false);
    }
  };

  return (
    <Screen>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={{ gap: space(2.5) }}
      >
        <BrandLockup size={44} />
        <Text variant="title" accessibilityRole="header">
          Reset your password
        </Text>
        <Text muted>
          Enter the email address for your account and we will email you a link to choose a new
          password.
        </Text>
        {message ? (
          <Text
            accessibilityRole={message.kind === 'error' ? 'alert' : undefined}
            accessibilityLiveRegion={message.kind === 'error' ? 'assertive' : 'polite'}
            color={message.kind === 'error' ? colors.danger : undefined}
          >
            {message.text}
          </Text>
        ) : null}
        <Field
          label="Email"
          value={email}
          onChangeText={setEmail}
          error={touched ? emailError(email) : null}
          autoCapitalize="none"
          autoComplete="email"
          keyboardType="email-address"
          textContentType="username"
          returnKeyType="go"
          onSubmitEditing={() => void submit()}
        />
        <Button title="Email me a reset link" full loading={busy} onPress={() => void submit()} />
        <Text muted style={{ textAlign: 'center' }}>
          <Link
            href="/login"
            style={{ color: colors.primary, fontWeight: '700' }}
            accessibilityRole="link"
          >
            Back to log in
          </Link>
        </Text>
      </KeyboardAvoidingView>
    </Screen>
  );
}
