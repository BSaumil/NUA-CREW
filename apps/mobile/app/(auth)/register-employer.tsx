import { Link } from 'expo-router';
import { useRef, useState } from 'react';
import { Switch } from 'react-native';
import { messageOf } from '@/api/client';
import { emailError, nameError, passwordError } from '@/features/validation';
import { useAuth } from '@/state/AuthProvider';
import { useTheme } from '@/theme/ThemeProvider';
import { BrandLockup, Button, Field, Row, Screen, Text } from '@/ui';
import { Notice } from '@/ui/hire';
import { SetupPolicies, SetupProgress } from '@/ui/setup';
export default function RegisterEmployer() {
  const { registerEmployer } = useAuth();
  const { colors } = useTheme();
  const [name, setName] = useState('');
  const [business, setBusiness] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [agree, setAgree] = useState(false);
  const [step, setStep] = useState(0);
  const [busy, setBusy] = useState(false);
  const lock = useRef(false);
  const [error, setError] = useState<string | null>(null);
  const identityError = () => nameError(name) || emailError(email) || passwordError(password, true);
  const next = () => {
    const validation =
      step === 0 ? identityError() : business.trim() ? null : 'Enter your business name';
    setError(validation);
    if (!validation) setStep((s) => s + 1);
  };
  const submit = async () => {
    if (lock.current) return;
    const validation =
      identityError() ||
      (!business.trim() ? 'Enter your business name' : null) ||
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
        Three short steps to your business workspace. No payment is taken during registration.
      </Text>
      <SetupProgress step={step} labels={['Your account', 'Your business', 'Review & agree']} />
      {error ? (
        <Text accessibilityRole="alert" accessibilityLiveRegion="assertive" color={colors.danger}>
          {error}
        </Text>
      ) : null}
      {step === 0 ? (
        <>
          <Field
            label="Your full name"
            value={name}
            onChangeText={setName}
            autoComplete="name"
            maxLength={150}
          />
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
            hint="At least 12 characters. A few random words work well."
          />
        </>
      ) : step === 1 ? (
        <>
          <Text variant="title" accessibilityRole="header">
            Which business do you represent?
          </Text>
          <Field
            label="Business name"
            value={business}
            onChangeText={setBusiness}
            maxLength={150}
          />
          <Text muted>
            Add your venue details and draft a role after setup. Business verification is required
            before publishing.
          </Text>
        </>
      ) : (
        <>
          <Text variant="title" accessibilityRole="header">
            Ready to create your workspace?
          </Text>
          <Text>{business.trim()}</Text>
          <Text muted>
            You can invite authorised teammates later. No advertisement is purchased by creating an
            account.
          </Text>
          <SetupPolicies employer />
          <Row>
            <Text style={{ flex: 1 }}>
              I am authorised to act for this business, accept the terms and employer terms, and
              have read the privacy policy.
            </Text>
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
        </>
      )}
      <Row>
        {step > 0 ? (
          <Button
            title="Back"
            variant="secondary"
            disabled={busy}
            onPress={() => {
              setError(null);
              setStep((s) => s - 1);
            }}
          />
        ) : null}
        {step < 2 ? (
          <Button title="Continue" onPress={next} />
        ) : (
          <Button title="Create employer account" loading={busy} onPress={() => void submit()} />
        )}
      </Row>
      <Text muted>Your answers are not saved to device storage.</Text>
      <Link href="/login" accessibilityRole="link" style={{ color: colors.primary }}>
        Already have an account? Log in
      </Link>
      <Link href="/register" accessibilityRole="link" style={{ color: colors.primary }}>
        Looking for work? Join free
      </Link>
    </Screen>
  );
}
