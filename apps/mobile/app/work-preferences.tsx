import { useRouter } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import { View } from 'react-native';
import { messageOf } from '@/api/client';
import { useKindConsent, useProfile, useSaveWorkPref, useWorkPrefs } from '@/api/queries';
import {
  emptyPref,
  modeOf,
  prefToForm,
  validatePref,
  type Mode,
  type PrefErrors,
  type PrefForm,
  type WorkKind,
  type WorkPreference,
} from '@/features/availability';
import { space } from '@/theme/tokens';
import { useTheme } from '@/theme/ThemeProvider';
import { Button, Card, Chip, ErrorState, Field, ListSkeleton, Row, Screen, Text } from '@/ui';

const KINDS: WorkKind[] = ['permanent', 'temporary'];
const LABEL: Record<WorkKind, string> = { permanent: 'Permanent', temporary: 'Temporary' };
const ENGAGEMENT = [
  ['employee', 'Employee'],
  ['contractor', 'Contractor'],
] as const;
const HOURS = [
  ['full_time', 'Full-time'],
  ['part_time', 'Part-time'],
  ['casual', 'Casual'],
] as const;

const toggle = (list: string[], v: string) =>
  list.includes(v) ? list.filter((x) => x !== v) : [...list, v];

export default function WorkPreferences() {
  const router = useRouter();
  const { colors } = useTheme();
  const prefs = useWorkPrefs();
  const profile = useProfile();
  const save = useSaveWorkPref();
  const [forms, setForms] = useState<Record<WorkKind, PrefForm>>({
    permanent: emptyPref(),
    temporary: emptyPref(),
  });
  const [errors, setErrors] = useState<Record<WorkKind, PrefErrors>>({
    permanent: {},
    temporary: {},
  });
  const [message, setMessage] = useState<{ ok: boolean; text: string } | null>(null);
  const seeded = useRef(false);

  // Seed once from the server; later refetches must not overwrite what the person is typing.
  useEffect(() => {
    if (!prefs.data || seeded.current) return;
    seeded.current = true;
    setForms({
      permanent: prefToForm(prefs.data.permanent),
      temporary: prefToForm(prefs.data.temporary),
    });
  }, [prefs.data]);

  if (prefs.isPending)
    return (
      <Screen>
        <ListSkeleton count={2} />
      </Screen>
    );
  if (prefs.isError || !prefs.data)
    return (
      <Screen>
        <ErrorState message={messageOf(prefs.error)} onRetry={() => void prefs.refetch()} />
      </Screen>
    );

  const server = prefs.data;
  const mode = modeOf(forms.permanent.enabled, forms.temporary.enabled);
  const setMode = (m: Mode) => {
    setMessage(null);
    setForms((f) => ({
      permanent: { ...f.permanent, enabled: m === 'permanent' || m === 'both' },
      temporary: { ...f.temporary, enabled: m === 'temporary' || m === 'both' },
    }));
  };

  const submit = async () => {
    setMessage(null);
    const next: Record<WorkKind, PrefErrors> = { permanent: {}, temporary: {} };
    const toSend: { kind: WorkKind; body: NonNullable<ReturnType<typeof validatePref>['body']> }[] =
      [];
    for (const kind of KINDS) {
      const f = forms[kind];
      if (!f.enabled && !server[kind]) continue; // never set and still off: nothing to store
      const r = validatePref(f, kind);
      next[kind] = r.errors;
      if (r.body) toSend.push({ kind, body: r.body });
    }
    setErrors(next);
    if (KINDS.some((k) => Object.keys(next[k]).length)) {
      setMessage({ ok: false, text: 'Check the highlighted fields. Nothing was saved.' });
      return;
    }
    try {
      for (const item of toSend) await save.mutateAsync(item);
      setMessage({ ok: true, text: 'Saved to your NUA CREW account.' });
    } catch (e) {
      // Typed values stay on screen so nothing has to be re-entered.
      setMessage({ ok: false, text: `${messageOf(e)} Your answers are still here: try again.` });
    }
  };

  return (
    <Screen edges={['left', 'right']}>
      <Text variant="title" accessibilityRole="header">
        What kind of work do you want?
      </Text>
      <Text muted>
        Choose one or both. Each has its own answers, and switching one off keeps what you entered.
      </Text>
      <Row>
        {(
          [
            ['permanent', 'Permanent'],
            ['temporary', 'Temporary'],
            ['both', 'Both'],
          ] as [Mode, string][]
        ).map(([m, label]) => (
          <Chip
            key={m}
            label={label}
            selected={mode === m}
            onPress={() => setMode(m)}
            accessibilityHint={`Show ${label.toLowerCase()} work questions`}
          />
        ))}
      </Row>
      {mode === 'none' ? (
        <Text muted>
          Nothing selected. Employers can't find you for any kind of work, and your job matches use
          your profile only.
        </Text>
      ) : null}

      {KINDS.map((kind) =>
        forms[kind].enabled ? (
          <KindCard
            key={kind}
            kind={kind}
            form={forms[kind]}
            errors={errors[kind]}
            saved={server[kind] ?? null}
            masterOn={profile.data?.discoverable ?? false}
            onChange={(patch) => setForms((f) => ({ ...f, [kind]: { ...f[kind], ...patch } }))}
          />
        ) : server[kind] ? (
          <Text key={kind} variant="caption" muted>
            {LABEL[kind]} work is off. Your saved answers are kept, but employers won't find you for
            it.
          </Text>
        ) : null,
      )}

      {message ? (
        <Text
          accessibilityRole="alert"
          color={message.ok ? colors.text : colors.danger}
          accessibilityLiveRegion="polite"
        >
          {message.text}
        </Text>
      ) : null}
      <Button
        title="Save work preferences"
        full
        loading={save.isPending}
        onPress={() => void submit()}
      />

      <Card>
        <Text variant="heading" accessibilityRole="header">
          Next
        </Text>
        <Button
          title="Set when you're available"
          variant="secondary"
          onPress={() => router.push('/availability')}
        />
        <Button
          title="Employers you prefer or avoid"
          variant="secondary"
          onPress={() => router.push('/employer-preferences')}
        />
      </Card>
    </Screen>
  );
}

function KindCard({
  kind,
  form,
  errors,
  saved,
  masterOn,
  onChange,
}: {
  kind: WorkKind;
  form: PrefForm;
  errors: PrefErrors;
  saved: WorkPreference | null;
  masterOn: boolean;
  onChange: (patch: Partial<PrefForm>) => void;
}) {
  const { colors } = useTheme();
  const consent = useKindConsent();
  const [consentError, setConsentError] = useState<string | null>(null);
  const word = kind === 'permanent' ? 'permanent' : 'temporary';
  const found = saved?.enabled && saved.discoverable && masterOn;

  const setConsent = async (granted: boolean) => {
    setConsentError(null);
    try {
      await consent.mutateAsync({ kind, granted, alsoMaster: !masterOn });
    } catch (e) {
      setConsentError(messageOf(e));
    }
  };

  return (
    <Card>
      <Text variant="heading" accessibilityRole="header">
        {LABEL[kind]} work
      </Text>
      <Text variant="label">Arrangement you're open to</Text>
      <Row>
        {ENGAGEMENT.map(([v, label]) => (
          <Chip
            key={v}
            label={label}
            selected={form.engagement.includes(v)}
            onPress={() => onChange({ engagement: toggle(form.engagement, v) })}
          />
        ))}
      </Row>
      <Text variant="caption" muted>
        This is a preference only. NUA CREW doesn't check an ABN or decide whether anyone is an
        employee or a contractor.
      </Text>
      <Text variant="label">Hours pattern</Text>
      <Row>
        {HOURS.map(([v, label]) => (
          <Chip
            key={v}
            label={label}
            selected={form.hours.includes(v)}
            onPress={() => onChange({ hours: toggle(form.hours, v) })}
          />
        ))}
      </Row>
      <Row>
        <View style={{ flex: 1, minWidth: 140 }}>
          <Field
            label="Fewest hours a week"
            value={form.minWeekly}
            onChangeText={(v) => onChange({ minWeekly: v })}
            keyboardType="decimal-pad"
            error={errors.minWeekly}
          />
        </View>
        <View style={{ flex: 1, minWidth: 140 }}>
          <Field
            label="Most hours a week"
            value={form.maxWeekly}
            onChangeText={(v) => onChange({ maxWeekly: v })}
            keyboardType="decimal-pad"
            error={errors.maxWeekly}
          />
        </View>
      </Row>
      <Field
        label="Lowest hourly pay you'd consider"
        value={form.minPay}
        onChangeText={(v) => onChange({ minPay: v })}
        keyboardType="decimal-pad"
        placeholder="e.g. 30.00"
        hint="Private. Never shown to employers, and not used to rank you."
        error={errors.minPay}
      />
      {kind === 'permanent' ? (
        <>
          <Field
            label="Notice period (days)"
            value={form.notice}
            onChangeText={(v) => onChange({ notice: v })}
            keyboardType="number-pad"
            hint="How long before you could start a permanent role."
            error={errors.notice}
          />
          <Field
            label="Available to start from"
            value={form.availableFrom}
            onChangeText={(v) => onChange({ availableFrom: v })}
            placeholder="e.g. 1/2/2027"
            hint="This is about a permanent start date. It isn't whether you can work a shift tonight; set that under availability."
            error={errors.availableFrom}
          />
        </>
      ) : (
        <Field
          label="Furthest you'll travel (km)"
          value={form.maxTravel}
          onChangeText={(v) => onChange({ maxTravel: v })}
          keyboardType="number-pad"
          error={errors.maxTravel}
        />
      )}

      <View style={{ gap: space(1) }}>
        <Text variant="label" accessibilityRole="header">
          Let employers find you for {word} work?
        </Text>
        {saved?.enabled ? (
          <>
            <Text variant="caption" muted>
              {found
                ? "On. Verified employers can see your first name and last initial, headline, suburb, skills and whether you are free for a time they ask about. They never see your pay floor or your calendar, and they can't contact you from NUA CREW yet."
                : 'Off. Nobody can find you. If you turn this on, verified employers could see your first name and last initial, headline, suburb, skills and whether you are free for a time they ask about. Never your pay floor or calendar.'}
            </Text>
            <Button
              title={
                found
                  ? `Stop employers finding me for ${word} work`
                  : `Let verified employers find me`
              }
              variant={found ? 'secondary' : 'primary'}
              loading={consent.isPending}
              onPress={() => void setConsent(!found)}
            />
            {consentError ? (
              <Text accessibilityRole="alert" color={colors.danger}>
                {consentError}
              </Text>
            ) : null}
          </>
        ) : (
          <Text variant="caption" muted>
            Save your {word} answers first, then you can choose whether employers can find you.
            Until you choose, nobody can.
          </Text>
        )}
      </View>
    </Card>
  );
}
