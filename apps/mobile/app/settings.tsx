import * as Application from 'expo-application';
import { File, Paths } from 'expo-file-system';
import * as Sharing from 'expo-sharing';
import { useState } from 'react';
import { Alert, Linking, Platform, Switch, View } from 'react-native';
import { api, messageOf, unwrap, unwrapVoid } from '@/api/client';
import { useDiscoveryConsent, useProfile, usePushSetting } from '@/api/queries';
import { enablePush } from '@/features/push';
import { reportSignOut } from '@/features/signout';
import { useAuth } from '@/state/AuthProvider';
import { useTheme, type ThemeMode } from '@/theme/ThemeProvider';
import { space } from '@/theme/tokens';
import { AI_DISCLOSURE, Button, Card, Chip, Field, Row, Screen, Sheet, Text } from '@/ui';

function SwitchRow({
  title,
  body,
  value,
  onChange,
  disabled,
}: {
  title: string;
  body: string;
  value: boolean;
  onChange: (v: boolean) => void;
  disabled?: boolean;
}) {
  const { colors } = useTheme();
  return (
    <Row style={{ justifyContent: 'space-between', flexWrap: 'nowrap' }}>
      <View style={{ flex: 1, gap: 2 }}>
        <Text variant="label">{title}</Text>
        <Text variant="caption" muted>
          {body}
        </Text>
      </View>
      <Switch
        value={value}
        onValueChange={onChange}
        disabled={disabled}
        accessibilityLabel={title}
        trackColor={{ true: colors.primary, false: colors.border }}
      />
    </Row>
  );
}

export default function Settings() {
  const { colors, mode, setMode } = useTheme();
  const { biometricAvailable, biometricEnabled, setBiometric, signOut, clearLocal } = useAuth();
  const profile = useProfile();
  const consent = useDiscoveryConsent();
  const pushSetting = usePushSetting();
  const [notice, setNotice] = useState<string | null>(null);
  const [pwOpen, setPwOpen] = useState(false);
  const [delOpen, setDelOpen] = useState(false);

  const togglePush = async (on: boolean) => {
    setNotice(null);
    if (on) {
      const state = await enablePush();
      if (state === 'denied') {
        setNotice('Notifications are blocked for NUA CREW. Allow them in your phone’s Settings.');
        return void Linking.openSettings().catch(() => undefined);
      }
      if (state === 'unsupported')
        setNotice('Push notifications need a real phone. Alerts still appear in the Alerts tab.');
      if (state === 'unconfigured')
        setNotice(
          'Push is not configured in this build yet. Alerts still appear in the Alerts tab.',
        );
    }
    try {
      await pushSetting.mutateAsync(on);
    } catch (e) {
      setNotice(messageOf(e));
    }
  };

  const exportData = async () => {
    try {
      const data = unwrap(await api.GET('/v1/account/export'));
      if (Platform.OS === 'web') return setNotice('Export is available in the phone app.');
      const file = new File(Paths.cache, 'nua-crew-data-export.json');
      file.create({ overwrite: true });
      file.write(JSON.stringify(data, null, 2));
      if (await Sharing.isAvailableAsync())
        await Sharing.shareAsync(file.uri, {
          mimeType: 'application/json',
          dialogTitle: 'Your NUA CREW data',
        });
      else setNotice('Sharing is not available on this device.');
    } catch (e) {
      Alert.alert('Could not export', messageOf(e));
    }
  };

  const signOutEverywhere = () =>
    Alert.alert(
      'Sign out of all devices?',
      'Every phone and tablet signed in to your account will need to log in again.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Sign out everywhere',
          style: 'destructive',
          onPress: async () => {
            try {
              unwrapVoid(await api.POST('/v1/auth/logout-all'));
            } catch (e) {
              return Alert.alert('Could not sign out everywhere', messageOf(e));
            }
            reportSignOut(await signOut());
          },
        },
      ],
    );

  return (
    <Screen edges={['left', 'right', 'bottom']}>
      {notice ? (
        <Text
          accessibilityLiveRegion="polite"
          accessibilityRole="alert"
          color={colors.onWarnTint}
          style={{ backgroundColor: colors.warnTint, padding: space(1.25), borderRadius: 12 }}
        >
          {notice}
        </Text>
      ) : null}

      <Card>
        <Text variant="heading" accessibilityRole="header">
          Appearance
        </Text>
        <Row>
          {(['system', 'light', 'dark'] as ThemeMode[]).map((m) => (
            <Chip
              key={m}
              label={m === 'system' ? 'Match phone' : m[0]!.toUpperCase() + m.slice(1)}
              selected={mode === m}
              onPress={() => setMode(m)}
            />
          ))}
        </Row>
      </Card>

      <Card style={{ gap: space(2) }}>
        <Text variant="heading" accessibilityRole="header">
          Notifications
        </Text>
        <SwitchRow
          title="Push notifications"
          body="Application updates and job alerts. Each push shows only the alert text."
          value={profile.data?.push_enabled ?? true}
          onChange={(v) => void togglePush(v)}
          disabled={!profile.data || pushSetting.isPending}
        />
      </Card>

      <Card style={{ gap: space(2) }}>
        <Text variant="heading" accessibilityRole="header">
          Privacy
        </Text>
        <SwitchRow
          title="Let verified employers discover my profile"
          body="Off by default. You can change this at any time."
          value={profile.data?.discoverable ?? false}
          onChange={(v) => consent.mutate(v)}
          disabled={!profile.data || consent.isPending}
        />
        <Button title="Export my data" variant="secondary" onPress={() => void exportData()} />
        <Text variant="caption" muted>
          Downloads everything we hold about you as a file you can save or share.
        </Text>
        <Button title="Delete my account" variant="danger" onPress={() => setDelOpen(true)} />
      </Card>

      <Card style={{ gap: space(2) }}>
        <Text variant="heading" accessibilityRole="header">
          Security
        </Text>
        {biometricAvailable ? (
          <SwitchRow
            title="App lock"
            body="Ask for Face ID, fingerprint or your passcode when you come back to the app."
            value={biometricEnabled}
            onChange={async (v) => {
              if (!(await setBiometric(v))) setNotice('App lock was not changed.');
            }}
          />
        ) : (
          <Text variant="caption" muted>
            App lock is available once Face ID, fingerprint or a passcode is set up on this phone.
          </Text>
        )}
        <Button title="Change password" variant="secondary" onPress={() => setPwOpen(true)} />
        <Button title="Sign out of all devices" variant="secondary" onPress={signOutEverywhere} />
      </Card>

      <Card>
        <Text variant="heading" accessibilityRole="header">
          About
        </Text>
        <Text variant="caption" muted>
          NUA CREW {Application.nativeApplicationVersion ?? '0.1.0'} (
          {Application.nativeBuildVersion ?? 'dev'})
        </Text>
        <Text variant="caption" muted>
          {AI_DISCLOSURE}
        </Text>
        <Text variant="caption" muted>
          NUA CREW is a working name pending legal clearance. Terms and Privacy Policy links will
          appear here once they are reviewed.
        </Text>
      </Card>

      <PasswordModal
        visible={pwOpen}
        onClose={() => setPwOpen(false)}
        onDone={() => setNotice('Password changed. Other devices have been signed out.')}
      />
      <DeleteModal
        visible={delOpen}
        onClose={() => setDelOpen(false)}
        onDeleted={() => void clearLocal().then(reportSignOut)}
      />
    </Screen>
  );
}

function PasswordModal({
  visible,
  onClose,
  onDone,
}: {
  visible: boolean;
  onClose: () => void;
  onDone: () => void;
}) {
  const { colors } = useTheme();
  const [cur, setCur] = useState('');
  const [next, setNext] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const submit = async () => {
    setError(null);
    if (next.length < 12) return setError('Use at least 12 characters');
    setBusy(true);
    try {
      unwrapVoid(
        await api.POST('/v1/account/password', {
          body: { current_password: cur, new_password: next },
        }),
      );
      setCur('');
      setNext('');
      onClose();
      onDone();
    } catch (e) {
      setError(messageOf(e));
    } finally {
      setBusy(false);
    }
  };
  return (
    <Sheet visible={visible} onClose={onClose}>
      <Text variant="title" accessibilityRole="header">
        Change password
      </Text>
      <Field
        label="Current password"
        value={cur}
        onChangeText={setCur}
        secureTextEntry
        autoComplete="current-password"
      />
      <Field
        label="New password"
        value={next}
        onChangeText={setNext}
        secureTextEntry
        autoComplete="new-password"
        hint="At least 12 characters."
      />
      {error ? (
        <Text accessibilityLiveRegion="polite" color={colors.danger}>
          {error}
        </Text>
      ) : null}
      <Row>
        <Button title="Change password" loading={busy} onPress={() => void submit()} />
        <Button title="Cancel" variant="ghost" onPress={onClose} />
      </Row>
    </Sheet>
  );
}

function DeleteModal({
  visible,
  onClose,
  onDeleted,
}: {
  visible: boolean;
  onClose: () => void;
  onDeleted: () => void;
}) {
  const { colors } = useTheme();
  const [pw, setPw] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const submit = async () => {
    setError(null);
    setBusy(true);
    try {
      unwrapVoid(await api.DELETE('/v1/account', { body: { password: pw } }));
      setPw('');
      onClose();
      onDeleted();
    } catch (e) {
      setError(messageOf(e));
    } finally {
      setBusy(false);
    }
  };
  return (
    <Sheet visible={visible} onClose={onClose}>
      <Text variant="title" accessibilityRole="header">
        Delete your account?
      </Text>
      <Text>
        This permanently erases your profile, resumes, applications, saved jobs and alerts.
        Employers will no longer see your applications. This cannot be undone.
      </Text>
      <Text variant="caption" muted>
        Tip: use “Export my data” first if you want a copy.
      </Text>
      <Field
        label="Confirm with your password"
        value={pw}
        onChangeText={setPw}
        secureTextEntry
        autoComplete="current-password"
      />
      {error ? (
        <Text accessibilityLiveRegion="polite" color={colors.danger}>
          {error}
        </Text>
      ) : null}
      <Row>
        <Button
          title="Delete everything"
          variant="danger"
          loading={busy}
          disabled={!pw}
          onPress={() => void submit()}
        />
        <Button title="Keep my account" variant="ghost" onPress={onClose} />
      </Row>
    </Sheet>
  );
}
