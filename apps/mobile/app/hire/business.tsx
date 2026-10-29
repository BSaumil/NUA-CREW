import { useQuery } from '@tanstack/react-query';
import { useRouter } from 'expo-router';
import { useRef, useState } from 'react';
import { Switch } from 'react-native';
import { api, messageOf, unwrap, unwrapVoid } from '@/api/client';
import {
  useHireAddLocation,
  useHireAddMember,
  useHireBusiness,
  useHireBusinesses,
  useHireLocations,
  useHireMembers,
  useHireQuery,
} from '@/api/hire';
import { exportAccount } from '@/features/account-export';
import { reportSignOut } from '@/features/signout';
import { emailError, passwordError } from '@/features/validation';
import { useAuth } from '@/state/AuthProvider';
import { useHireWorkspace } from '@/state/HireWorkspace';
import { useTheme, type ThemeMode } from '@/theme/ThemeProvider';
import {
  Button,
  Card,
  Chip,
  ConfirmSheet,
  ErrorState,
  Field,
  Row,
  Screen,
  Sheet,
  Text,
} from '@/ui';
import { HireGate, HireHeading, Notice } from '@/ui/hire';

const STATES = ['VIC', 'NSW', 'QLD', 'SA', 'WA', 'TAS', 'ACT', 'NT'] as const;
export default function Business() {
  return (
    <HireGate>
      <BusinessContent />
    </HireGate>
  );
}
function BusinessContent() {
  const router = useRouter();
  const { employerId, role, select } = useHireWorkspace();
  const auth = useAuth();
  const { colors, mode, setMode } = useTheme();
  const business = useHireBusiness();
  const businesses = useHireBusinesses();
  const locations = useHireLocations();
  const members = useHireMembers();
  const addLocation = useHireAddLocation();
  const addMember = useHireAddMember();
  const prices = useQuery({
    queryKey: ['pricing'],
    queryFn: async () => unwrap(await api.GET('/v1/pricing')),
  });
  const billingStatus = useQuery({
    queryKey: ['billing-status'],
    queryFn: async () => unwrap(await api.GET('/v1/billing/status')),
  });
  const orders = useHireQuery(['billing-orders'], async (id) =>
    unwrap(
      await api.GET('/v1/employers/{employer_id}/billing/orders', {
        params: { path: { employer_id: id } },
      }),
    ),
  );
  const [modal, setModal] = useState<'location' | 'member' | 'password' | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [venue, setVenue] = useState('');
  const [suburb, setSuburb] = useState('');
  const [state, setState] = useState<(typeof STATES)[number]>('VIC');
  const [postcode, setPostcode] = useState('');
  const [email, setEmail] = useState('');
  const [memberRole, setMemberRole] = useState<'recruiter' | 'viewer'>('recruiter');
  const [current, setCurrent] = useState('');
  const [password, setPassword] = useState('');
  const [repeat, setRepeat] = useState('');
  const [busy, setBusy] = useState(false);
  const lock = useRef(false);
  const [confirm, setConfirm] = useState<'signout' | 'all' | null>(null);
  const open = (value: typeof modal) => {
    setError(null);
    setNotice(null);
    setModal(value);
  };
  const submit = async () => {
    if (lock.current) return;
    setError(null);
    if (modal === 'location' && (!venue.trim() || !suburb.trim() || !/^\d{4}$/.test(postcode))) {
      setError('Add a venue name, suburb and four-digit postcode.');
      return;
    }
    if (modal === 'member' && emailError(email)) {
      setError('Enter the teammate’s employer account email.');
      return;
    }
    if (
      modal === 'password' &&
      (!current || passwordError(password, true) || password !== repeat)
    ) {
      setError(
        'Enter your current password and matching new passwords that meet the password requirements.',
      );
      return;
    }
    lock.current = true;
    setBusy(true);
    try {
      if (modal === 'location') {
        await addLocation.mutateAsync({
          name: venue.trim(),
          suburb: suburb.trim(),
          state,
          postcode,
        });
        setVenue('');
        setSuburb('');
        setPostcode('');
        setNotice('Location added.');
      }
      if (modal === 'member') {
        await addMember.mutateAsync({ email: email.trim(), role: memberRole });
        setEmail('');
        setNotice('Teammate added to this business.');
      }
      if (modal === 'password') {
        unwrapVoid(
          await api.POST('/v1/account/password', {
            body: { current_password: current, new_password: password },
          }),
        );
        setCurrent('');
        setPassword('');
        setRepeat('');
        reportSignOut(await auth.clearLocal());
      }
      setModal(null);
    } catch (e) {
      setError(messageOf(e));
    } finally {
      lock.current = false;
      setBusy(false);
    }
  };
  const end = async () => {
    if (busy) return;
    setBusy(true);
    setError(null);
    try {
      if (confirm === 'all') unwrapVoid(await api.POST('/v1/auth/logout-all'));
      reportSignOut(await auth.signOut());
    } catch (e) {
      setError(messageOf(e));
    } finally {
      setBusy(false);
      setConfirm(null);
    }
  };
  return (
    <Screen>
      <HireHeading
        title="Your business, organised."
        body={business.data?.name ?? 'Business settings'}
      />
      {role !== 'viewer' && !!locations.data?.length ? (
        <Button title="Post a job" onPress={() => router.push('/hire-post')} />
      ) : null}
      {error && !modal ? <ErrorState message={error} /> : null}
      {notice ? <Text accessibilityRole="alert">{notice}</Text> : null}
      {business.isError ? (
        <ErrorState message={messageOf(business.error)} onRetry={() => void business.refetch()} />
      ) : null}
      {(businesses.data?.length ?? 0) > 1 ? (
        <Card>
          <Text variant="heading">Switch business</Text>
          <Text variant="caption" muted>
            Jobs, conversations and team access stay separate for each business.
          </Text>
          <Row>
            {businesses.data?.map((b) => (
              <Chip
                key={b.id}
                label={b.name}
                selected={employerId === b.id}
                onPress={() => select(b.id)}
              />
            ))}
          </Row>
        </Card>
      ) : null}
      <Card>
        <Text variant="heading">Business details</Text>
        <Text>{business.data?.name}</Text>
        <Text muted>ABN: {business.data?.abn ?? 'Not supplied'}</Text>
        <Text muted>Verification: {business.data?.verification_status ?? 'Checking'}</Text>
        <Text variant="caption" muted>
          Verification checks identity and authority. It is not an endorsement.
        </Text>
      </Card>
      <Card>
        <Text variant="heading">Locations</Text>
        {locations.data?.map((l) => (
          <Text key={l.id}>
            {l.name} · {l.suburb}, {l.state} {l.postcode}
          </Text>
        ))}
        {locations.isError ? (
          <ErrorState
            message={messageOf(locations.error)}
            onRetry={() => void locations.refetch()}
          />
        ) : null}
        {locations.data?.length === 0 ? (
          <Text muted>Add the venue where people will work.</Text>
        ) : null}
        {role === 'owner' ? (
          <Button title="Add location" variant="secondary" onPress={() => open('location')} />
        ) : null}
      </Card>
      <Card>
        <Text variant="heading">Your team</Text>
        {members.data?.map((m) => (
          <Text key={m.user_id}>
            {m.email} · {m.role}
          </Text>
        ))}
        {members.isError ? (
          <ErrorState message={messageOf(members.error)} onRetry={() => void members.refetch()} />
        ) : null}
        {role === 'owner' ? (
          <Button title="Add teammate" variant="secondary" onPress={() => open('member')} />
        ) : null}
      </Card>
      <Card>
        <Text variant="heading">Advertising</Text>
        {prices.data ? (
          <>
            {prices.data.products.map((p) => (
              <Text key={p.code}>
                {p.name}:{' '}
                {new Intl.NumberFormat('en-AU', {
                  style: 'currency',
                  currency: prices.data.currency,
                }).format(p.amount_minor / 100)}
              </Text>
            ))}
            <Text variant="caption" muted>
              Employees remain free. No automatic renewals. Advertising purchases are managed in the
              employer web portal.
            </Text>
          </>
        ) : prices.isError ? (
          <ErrorState message={messageOf(prices.error)} onRetry={() => void prices.refetch()} />
        ) : (
          <Text muted>Loading prices…</Text>
        )}
        <Text muted>
          {typeof billingStatus.data?.message === 'string'
            ? billingStatus.data.message
            : 'Payment connection status is unavailable.'}
        </Text>
        {orders.isError ? (
          <ErrorState message={messageOf(orders.error)} onRetry={() => void orders.refetch()} />
        ) : orders.data?.length ? (
          orders.data.map((order) => (
            <Text key={order.id}>
              {order.job_title} · A${(order.amount_minor / 100).toFixed(2)} ·{' '}
              {order.status.replaceAll('_', ' ')}
              {order.review_required ? ' · Support review needed' : ''}
            </Text>
          ))
        ) : (
          <Text muted>No advertising orders yet.</Text>
        )}
      </Card>
      <Card>
        <Text variant="heading">Make it comfortable</Text>
        <Row>
          {(['system', 'light', 'dark'] as ThemeMode[]).map((m) => (
            <Chip
              key={m}
              label={m === 'system' ? 'Match phone' : m === 'light' ? 'Light' : 'Dark'}
              selected={mode === m}
              onPress={() => setMode(m)}
            />
          ))}
        </Row>
      </Card>
      <Card>
        <Text variant="heading">Account and security</Text>
        {auth.biometricAvailable ? (
          <Row>
            <Text style={{ flex: 1 }}>Lock with biometrics</Text>
            <Switch
              accessibilityLabel="Lock with biometrics"
              value={auth.biometricEnabled}
              onValueChange={(v) => {
                void auth.setBiometric(v).catch((e) => setError(messageOf(e)));
              }}
            />
          </Row>
        ) : null}
        <Button title="Change password" variant="secondary" onPress={() => open('password')} />
        <Button
          title="Export my account data"
          variant="secondary"
          onPress={() => {
            void exportAccount()
              .then(setNotice)
              .catch((e) => setError(messageOf(e)));
          }}
        />
        <Button
          title="Sign out of all devices"
          variant="secondary"
          onPress={() => setConfirm('all')}
        />
        <Button title="Sign out" variant="ghost" onPress={() => setConfirm('signout')} />
      </Card>
      <Sheet
        visible={!!modal}
        onClose={() => {
          if (!busy) setModal(null);
        }}
      >
        <Text variant="title">
          {modal === 'location'
            ? 'Add a work location'
            : modal === 'member'
              ? 'Add a teammate'
              : 'Change your password'}
        </Text>
        {modal === 'location' ? (
          <>
            <Field label="Venue name" value={venue} onChangeText={setVenue} maxLength={150} />
            <Field label="Suburb" value={suburb} onChangeText={setSuburb} maxLength={100} />
            <Text variant="label">State or territory</Text>
            <Row>
              {STATES.map((s) => (
                <Chip key={s} label={s} selected={state === s} onPress={() => setState(s)} />
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
        ) : modal === 'member' ? (
          <>
            <Notice
              title="For an existing employer account"
              body="Enter the email they use to sign in to NUA CREW. This adds access to your business; it does not send an email invitation."
            />
            <Field
              label="Teammate email"
              value={email}
              onChangeText={setEmail}
              autoCapitalize="none"
              keyboardType="email-address"
            />
            <Row>
              <Chip
                label="Recruiter"
                selected={memberRole === 'recruiter'}
                onPress={() => setMemberRole('recruiter')}
              />
              <Chip
                label="View only"
                selected={memberRole === 'viewer'}
                onPress={() => setMemberRole('viewer')}
              />
            </Row>
          </>
        ) : (
          <>
            <Field
              label="Current password"
              value={current}
              onChangeText={setCurrent}
              secureTextEntry
              autoComplete="current-password"
            />
            <Field
              label="New password"
              value={password}
              onChangeText={setPassword}
              secureTextEntry
              autoComplete="new-password"
            />
            <Field
              label="Repeat new password"
              value={repeat}
              onChangeText={setRepeat}
              secureTextEntry
              autoComplete="new-password"
            />
            <Text muted>
              Changing your password signs out your devices. You will sign in again.
            </Text>
          </>
        )}
        {error ? (
          <Text accessibilityRole="alert" color={colors.danger}>
            {error}
          </Text>
        ) : null}
        <Button
          title={modal === 'password' ? 'Update password' : 'Save'}
          loading={busy}
          onPress={() => void submit()}
        />
        <Button title="Cancel" variant="ghost" disabled={busy} onPress={() => setModal(null)} />
      </Sheet>
      <ConfirmSheet
        visible={!!confirm}
        title={confirm === 'all' ? 'Sign out everywhere?' : 'Sign out of this device?'}
        body={
          confirm === 'all'
            ? 'Every signed-in device will need to sign in again.'
            : 'Your jobs and conversations stay saved in your account.'
        }
        confirmLabel="Sign out"
        busy={busy}
        onCancel={() => setConfirm(null)}
        onConfirm={() => void end()}
      />
    </Screen>
  );
}
