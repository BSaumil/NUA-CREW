import { Link } from 'expo-router';
import { useState } from 'react';
import { Switch, View } from 'react-native';
import { messageOf } from '@/api/client';
import { emailError, MIN_PASSWORD, nameError, passwordError } from '@/features/validation';
import { useAuth } from '@/state/AuthProvider';
import { useTheme } from '@/theme/ThemeProvider';
import { space } from '@/theme/tokens';
import { Button, Field, Screen, Text } from '@/ui';

export default function Register() {
  const { register } = useAuth();
  const { colors } = useTheme();
  const [fullName, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [agree, setAgree] = useState(false);
  const [touched, setTouched] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const errs = {
    name: touched ? nameError(fullName) : null,
    email: touched ? emailError(email) : null,
    pw: touched ? passwordError(password, true) : null,
    agree: touched && !agree ? 'You need to accept the terms to continue' : null,
  };

  const submit = async () => {
    setTouched(true);
    setError(null);
    if (nameError(fullName) || emailError(email) || passwordError(password, true) || !agree) return;
    setBusy(true);
    try {
      await register({ fullName: fullName.trim(), email: email.trim(), password });
    } catch (e) {
      setError(messageOf(e));
    } finally {
      setBusy(false);
    }
  };

  return (
    <Screen>
      <View style={{ gap: space(2.5) }}>
        <Text variant="title" accessibilityRole="header">
          Create your free account
        </Text>
        <Text muted>
          Finding and applying for jobs is free. No subscription is needed to apply.
        </Text>
        {error ? (
          <Text accessibilityRole="alert" accessibilityLiveRegion="assertive" color={colors.danger}>
            {error}
          </Text>
        ) : null}
        <Field
          label="Full name"
          value={fullName}
          onChangeText={setName}
          error={errs.name}
          autoComplete="name"
          textContentType="name"
        />
        <Field
          label="Email"
          value={email}
          onChangeText={setEmail}
          error={errs.email}
          autoCapitalize="none"
          autoComplete="email"
          keyboardType="email-address"
          textContentType="username"
        />
        <Field
          label="Password"
          value={password}
          onChangeText={setPassword}
          error={errs.pw}
          hint={`At least ${MIN_PASSWORD} characters. A few random words works well.`}
          secureTextEntry
          autoComplete="new-password"
          textContentType="newPassword"
        />
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: space(1.5) }}>
          <Switch
            value={agree}
            onValueChange={setAgree}
            accessibilityLabel="I agree to the terms and understand how my data is used"
            trackColor={{ true: colors.primary, false: colors.border }}
          />
          <Text style={{ flex: 1 }} variant="caption">
            I agree to the terms and understand how my data is used. Employers only see what I
            choose to send when I apply.
          </Text>
        </View>
        {errs.agree ? (
          <Text variant="caption" color={colors.danger} accessibilityLiveRegion="polite">
            {errs.agree}
          </Text>
        ) : null}
        <Button title="Create account" full loading={busy} onPress={() => void submit()} />
        <Text muted style={{ textAlign: 'center' }}>
          Already have an account?{' '}
          <Link
            href="/login"
            style={{ color: colors.primary, fontWeight: '700' }}
            accessibilityRole="link"
          >
            Log in
          </Link>
        </Text>
      </View>
    </Screen>
  );
}
