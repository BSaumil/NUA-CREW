import { Link } from 'expo-router';
import { useRef, useState } from 'react';
import { Switch } from 'react-native';
import { messageOf } from '@/api/client';
import { AU_STATES, gateFor } from '@/features/markets';
import { emailError, nameError, passwordError, venueError } from '@/features/validation';
import { useAuth } from '@/state/AuthProvider';
import { useTheme } from '@/theme/ThemeProvider';
import { BrandLockup, Button, Chip, Field, Row, Screen, Text } from '@/ui';
import { MarketChoice } from '@/ui/market';
import { Notice } from '@/ui/hire';
import { SetupPolicies, SetupProgress } from '@/ui/setup';
export default function RegisterEmployer() {
  const { registerEmployer } = useAuth();
  const { colors } = useTheme();
  const [name, setName] = useState('');
  const [business, setBusiness] = useState('');
  const [venue, setVenue] = useState('');
  const [suburb, setSuburb] = useState('');
  const [state, setState] = useState('');
  const [postcode, setPostcode] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [agree, setAgree] = useState(false);
  const [country, setCountry] = useState('AU');
  const gate = gateFor(country, 'onboarding');
  const [step, setStep] = useState(0);
  const [busy, setBusy] = useState(false);
  const lock = useRef(false);
  const [error, setError] = useState<string | null>(null);
  const identityError = () => nameError(name) || emailError(email) || passwordError(password, true);
  const next = () => {
    const validation =
      step === 0
        ? identityError()
        : business.trim()
          ? venueError({ suburb, state, postcode })
          : 'Enter your business name';
    setError(validation);
    if (!validation) setStep((s) => s + 1);
  };
  const submit = async () => {
    if (lock.current || !gate.allowed) return;
    const validation =
      identityError() ||
      (!business.trim() ? 'Enter your business name' : null) ||
      venueError({ suburb, state, postcode }) ||
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
        // The first venue is optional; when given it is sent whole (the API needs all of it).
        ...(suburb.trim()
          ? {
              location: {
                name: venue.trim() || 'Main location',
                suburb: suburb.trim(),
                state: state as 'VIC',
                postcode: postcode.trim(),
              },
            }
          : {}),
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
          <MarketChoice legend="Business country" value={country} onChange={setCountry} />
          <Field
            label="Business name"
            value={business}
            onChangeText={setBusiness}
            maxLength={150}
          />
          {!gate.allowed ? (
            <Text accessibilityRole="alert" muted>
              {gate.reason} Pay in{' '}
              {gate.state.kind === 'blocked' ? 'this country' : gate.state.market.currency} is not
              assessed, and no wage or eligibility is stated.
            </Text>
          ) : null}
          <Text variant="heading" accessibilityRole="header">
            First work location (optional)
          </Text>
          <Text muted>
            Add it now, or after setup. You can draft a role either way. Business verification is
            required before publishing.
          </Text>
          <Field label="Venue name" value={venue} onChangeText={setVenue} maxLength={150} />
          <Field label="Suburb" value={suburb} onChangeText={setSuburb} maxLength={100} />
          <Text variant="label">State or territory</Text>
          <Row>
            {AU_STATES.map((s) => (
              <Chip
                key={s}
                label={s}
                selected={state === s}
                onPress={() => setState(state === s ? '' : s)}
              />
            ))}
          </Row>
          <Field
            label="Postcode"
            value={postcode}
            onChangeText={setPostcode}
            keyboardType="number-pad"
            maxLength={4}
          />
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
          <Button
            title="Create employer account"
            loading={busy}
            disabled={!gate.allowed}
            onPress={() => void submit()}
          />
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
