import { Link } from 'expo-router';
import { useRef, useState } from 'react';
import { KeyboardAvoidingView, Platform, TextInput, View } from 'react-native';
import { messageOf } from '@/api/client';
import { emailError, passwordError } from '@/features/validation';
import { useAuth } from '@/state/AuthProvider';
import { useTheme } from '@/theme/ThemeProvider';
import { space } from '@/theme/tokens';
import { BrandLockup, Button, Field, Screen, Text } from '@/ui';

export default function Login() {
  const { signIn } = useAuth();
  const { colors } = useTheme();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [touched, setTouched] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const pw = useRef<React.ComponentRef<typeof TextInput>>(null);

  const eErr = touched ? emailError(email) : null;
  const pErr = touched ? passwordError(password) : null;

  const submit = async () => {
    setTouched(true);
    setError(null);
    if (emailError(email) || passwordError(password)) return;
    setBusy(true);
    try {
      await signIn(email.trim(), password);
    } catch (e) {
      setError(messageOf(e));
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
        <View style={{ paddingVertical: space(2) }}>
          <BrandLockup size={44} />
        </View>
        <Text variant="title" accessibilityRole="header">
          Welcome back
        </Text>
        <Text muted>For job seekers and employers. Your account opens the right workspace.</Text>
        {error ? (
          <Text accessibilityRole="alert" accessibilityLiveRegion="assertive" color={colors.danger}>
            {error}
          </Text>
        ) : null}
        <Field
          label="Email"
          value={email}
          onChangeText={setEmail}
          error={eErr}
          autoCapitalize="none"
          autoComplete="email"
          keyboardType="email-address"
          textContentType="username"
          returnKeyType="next"
          onSubmitEditing={() => pw.current?.focus()}
        />
        <Field
          ref={pw}
          label="Password"
          value={password}
          onChangeText={setPassword}
          error={pErr}
          secureTextEntry
          autoComplete="current-password"
          textContentType="password"
          returnKeyType="go"
          onSubmitEditing={() => void submit()}
        />
        <Button title="Log in" full loading={busy} onPress={() => void submit()} />
        <Text muted style={{ textAlign: 'center' }}>
          New to NUA CREW?{' '}
          <Link
            href="/register"
            style={{ color: colors.primary, fontWeight: '700' }}
            accessibilityRole="link"
          >
            Create a free account
          </Link>
        </Text>
      </KeyboardAvoidingView>
    </Screen>
  );
}
