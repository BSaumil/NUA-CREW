import { Link } from 'expo-router';
import { useRef, useState } from 'react';
import { Switch } from 'react-native';
import { messageOf } from '@/api/client';
import { emailError, nameError, passwordError } from '@/features/validation';
import { useAuth } from '@/state/AuthProvider';
import { useTheme } from '@/theme/ThemeProvider';
import { BrandLockup, Button, Field, Row, Screen, Text } from '@/ui';
import { Notice } from '@/ui/hire';

export default function RegisterEmployer() {
  const { registerEmployer } = useAuth();
  const { colors } = useTheme();
  const [name, setName] = useState('');
  const [business, setBusiness] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [agree, setAgree] = useState(false);
  const [busy, setBusy] = useState(false);
  const lock = useRef(false);
  const [error, setError] = useState<string | null>(null);
  const submit = async () => {
    if (lock.current) return;
    const validation =
      nameError(name) ||
      nameError(business) ||
      emailError(email) ||
      passwordError(password, true) ||
      (!agree ? 'Accept the terms and privacy notice to continue.' : null);
    setError(validation);
    if (validation) return;
    lock.current = true;
    setBusy(true);
    try {
      await registerEmployer({
        full_name: name.trim(),
        organisation_name: business.trim(),
        email: email.trim(),
        password,
        accept_terms: true,
        client: 'mobile',
      });
    } catch (e) {
      setError(messageOf(e));
    } finally {
      setBusy(false);
      lock.current = false;
    }
  };
  return (
    <Screen>
      <BrandLockup />
      <Text variant="display" accessibilityRole="header">
        Your next great hire.
      </Text>
      <Text muted>
        Create your business workspace. Add your venue and draft a role when you're ready.
      </Text>
      {error ? (
        <Text accessibilityRole="alert" color={colors.danger}>
          {error}
        </Text>
      ) : null}
      <Field
        label="Your full name"
        value={name}
        onChangeText={setName}
        autoComplete="name"
        maxLength={150}
      />
      <Field label="Business name" value={business} onChangeText={setBusiness} maxLength={150} />
      <Field
        label="Work email"
        value={email}
        onChangeText={setEmail}
        keyboardType="email-address"
        autoCapitalize="none"
        autoComplete="email"
      />
      <Field
        label="Password"
        value={password}
        onChangeText={setPassword}
        secureTextEntry
        autoComplete="new-password"
      />
      <Row>
        <Text style={{ flex: 1 }}>I accept the terms and privacy notice.</Text>
        <Switch
          accessibilityLabel="Accept terms and privacy notice"
          value={agree}
          onValueChange={setAgree}
        />
      </Row>
      <Notice
        title="Clear costs, no surprise charges"
        body="Creating a workspace takes no payment. Planned advertising is A$19 for 14 days, with an optional A$30 five-day promotion. Payments are not active yet. Verification is required before publishing."
      />
      <Button title="Create employer account" full loading={busy} onPress={() => void submit()} />
      <Link href="/login" accessibilityRole="link" style={{ color: colors.primary }}>
        Already have an account? Log in
      </Link>
      <Link href="/register" accessibilityRole="link" style={{ color: colors.primary }}>
        Looking for work? Join free
      </Link>
    </Screen>
  );
}
