import { Link } from 'expo-router';
import { useRef, useState } from 'react';
import { Switch, View } from 'react-native';
import { messageOf } from '@/api/client';
import { emailError, MIN_PASSWORD, nameError, passwordError } from '@/features/validation';
import { useAuth } from '@/state/AuthProvider';
import { useTheme } from '@/theme/ThemeProvider';
import { space } from '@/theme/tokens';
import { Button, Field, Row, Screen, Text } from '@/ui';
import { SetupPolicies, SetupProgress } from '@/ui/setup';
export default function Register() {
  const { register } = useAuth();
  const { colors } = useTheme();
  const [fullName, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [agree, setAgree] = useState(false);
  const [step, setStep] = useState(0);
  const [touched, setTouched] = useState(false);
  const [busy, setBusy] = useState(false);
  const lock = useRef(false);
  const [error, setError] = useState<string | null>(null);
  const errs = {
    name: touched ? nameError(fullName) : null,
    email: touched ? emailError(email) : null,
    pw: touched ? passwordError(password, true) : null,
  };
  const continueSetup = () => {
    setTouched(true);
    setError(null);
    if (nameError(fullName) || emailError(email) || passwordError(password, true)) return;
    setStep(1);
  };
  const submit = async () => {
    if (lock.current) return;
    setError(null);
    if (nameError(fullName) || emailError(email) || passwordError(password, true)) {
      setTouched(true);
      setStep(0);
      return;
    }
    if (!agree) {
      setError('You need to accept the terms to continue');
      return;
    }
    lock.current = true;
    setBusy(true);
    try {
      await register({ fullName: fullName.trim(), email: email.trim(), password });
    } catch (e) {
      setError(messageOf(e));
    } finally {
      setBusy(false);
      lock.current = false;
    }
  };
  return (
    <Screen>
      <Link href="/register-employer" accessibilityRole="link" style={{ color: colors.primary }}>
        Hiring for your business? Create an employer account
      </Link>
      <View style={{ gap: space(2.5) }}>
        <Text variant="title" accessibilityRole="header">
          Create your free account
        </Text>
        <Text muted>Two short steps. Finding and applying for work is free.</Text>
        <SetupProgress step={step} labels={['Your account', 'Your choices']} />
        {error ? (
          <Text accessibilityRole="alert" accessibilityLiveRegion="assertive" color={colors.danger}>
            {error}
          </Text>
        ) : null}
        {step === 0 ? (
          <>
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
              hint={`At least ${MIN_PASSWORD} characters. A few random words work well.`}
              secureTextEntry
              autoComplete="new-password"
              textContentType="newPassword"
            />
            <Text muted>Add your skills, resume and availability after creating your account.</Text>
            <Button title="Continue" full onPress={continueSetup} />
          </>
        ) : (
          <>
            <Text variant="title" accessibilityRole="header">
              Your choices, from the start.
            </Text>
            <Text>
              Discovery is off by default. Choose the documents you share when applying. Decline an
              invitation without giving a reason.
            </Text>
            <SetupPolicies />
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: space(1.5) }}>
              <Switch
                value={agree}
                onValueChange={setAgree}
                accessibilityLabel="I agree to the terms and understand how my data is used"
                trackColor={{ true: colors.primary, false: colors.border }}
              />
              <Text style={{ flex: 1 }} variant="caption">
                I accept the terms of use and have read the privacy policy.
              </Text>
            </View>
            <Row>
              <Button title="Back" variant="secondary" disabled={busy} onPress={() => setStep(0)} />
              <Button title="Create account" loading={busy} onPress={() => void submit()} />
            </Row>
          </>
        )}
        <Text muted>Your answers are not saved to device storage.</Text>
        <Link href="/login" accessibilityRole="link" style={{ color: colors.primary }}>
          Already have an account? Log in
        </Link>
      </View>
    </Screen>
  );
}
