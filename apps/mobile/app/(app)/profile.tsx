import { useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { Alert, Modal, Pressable, View } from 'react-native';
import { messageOf } from '@/api/client';
import {
  useAddResume,
  useAddResumeVersion,
  useProfile,
  useResumes,
  useSaveProfile,
} from '@/api/queries';
import { TYPE_LABEL, type EmploymentType } from '@/features/filters';
import { profileStrength } from '@/features/format';
import { useAuth } from '@/state/AuthProvider';
import { useTheme } from '@/theme/ThemeProvider';
import { radius, space } from '@/theme/tokens';
import {
  Badge,
  Button,
  Card,
  Chip,
  ErrorState,
  Field,
  ListSkeleton,
  Row,
  Screen,
  Text,
} from '@/ui';

const STATES = ['VIC', 'NSW', 'QLD', 'SA', 'WA', 'TAS', 'ACT', 'NT'] as const;

export default function Profile() {
  const router = useRouter();
  const { colors } = useTheme();
  const { signOut } = useAuth();
  const profile = useProfile();
  const resumes = useResumes();
  const save = useSaveProfile();
  const [form, setForm] = useState({
    full_name: '',
    headline: '',
    summary: '',
    suburb: '',
    state: '' as string,
    postcode: '',
    min_hourly_pay: '',
  });
  const [types, setTypes] = useState<string[]>([]);
  const [skills, setSkills] = useState<string[]>([]);
  const [skillInput, setSkillInput] = useState('');
  const [message, setMessage] = useState<{ ok: boolean; text: string } | null>(null);
  const [resumeModal, setResumeModal] = useState<{ id?: string; title?: string } | null>(null);

  useEffect(() => {
    const p = profile.data;
    if (!p) return;
    setForm({
      full_name: p.full_name,
      headline: p.headline ?? '',
      summary: p.summary ?? '',
      suburb: p.suburb ?? '',
      state: p.state ?? '',
      postcode: p.postcode ?? '',
      min_hourly_pay: p.min_hourly_pay ?? '',
    });
    setTypes(p.preferred_employment_types);
    setSkills(p.skills);
  }, [profile.data]);

  if (profile.isPending)
    return (
      <Screen>
        <ListSkeleton count={2} />
      </Screen>
    );
  if (profile.isError || !profile.data)
    return (
      <Screen>
        <ErrorState message={messageOf(profile.error)} onRetry={() => void profile.refetch()} />
      </Screen>
    );

  const strength = profileStrength(
    { ...profile.data, skills, preferred_employment_types: types },
    resumes.data?.length ?? 0,
  );
  const addSkill = () => {
    const s = skillInput.trim();
    if (s && !skills.some((x) => x.toLowerCase() === s.toLowerCase()) && skills.length < 50)
      setSkills([...skills, s]);
    setSkillInput('');
  };

  const submit = async () => {
    setMessage(null);
    try {
      await save.mutateAsync({
        full_name: form.full_name.trim(),
        headline: form.headline.trim() || null,
        summary: form.summary.trim() || null,
        suburb: form.suburb.trim() || null,
        state: (form.state || null) as never,
        postcode: form.postcode.trim() || null,
        preferred_employment_types: types as never,
        min_hourly_pay: form.min_hourly_pay.trim() || null,
        skills,
      });
      setMessage({ ok: true, text: 'Profile saved' });
    } catch (e) {
      setMessage({ ok: false, text: messageOf(e) });
    }
  };

  return (
    <Screen>
      <Row style={{ justifyContent: 'space-between' }}>
        <Text variant="title" accessibilityRole="header">
          Profile
        </Text>
        <Button title="Settings" variant="secondary" onPress={() => router.push('/settings')} />
      </Row>

      <Card>
        <Row style={{ justifyContent: 'space-between' }}>
          <Text variant="heading">Profile strength</Text>
          <Badge tone="live" label={`${strength.percent}%`} />
        </Row>
        <View
          accessibilityRole="progressbar"
          accessibilityLabel="Profile strength"
          accessibilityValue={{ min: 0, max: 100, now: strength.percent }}
          style={{
            height: 8,
            borderRadius: radius.chip,
            backgroundColor: colors.surface2,
            overflow: 'hidden',
          }}
        >
          <View
            style={{ height: 8, width: `${strength.percent}%`, backgroundColor: colors.primary }}
          />
        </View>
        <Text variant="caption" muted>
          {strength.next ? `Next: ${strength.next}` : 'Your profile is complete.'} Completeness
          helps matching explain itself; it does not rank you against others.
        </Text>
      </Card>

      <Card style={{ gap: space(2) }}>
        <Text variant="heading" accessibilityRole="header">
          About you
        </Text>
        <Field
          label="Full name"
          value={form.full_name}
          onChangeText={(v) => setForm({ ...form, full_name: v })}
          autoComplete="name"
        />
        <Field
          label="Headline"
          value={form.headline}
          onChangeText={(v) => setForm({ ...form, headline: v })}
          hint="e.g. Barista with 5 years experience"
          maxLength={200}
        />
        <Field
          label="Suburb"
          value={form.suburb}
          onChangeText={(v) => setForm({ ...form, suburb: v })}
          autoCapitalize="words"
        />
        <Text variant="label">State</Text>
        <Row>
          {STATES.map((s) => (
            <Chip
              key={s}
              label={s}
              selected={form.state === s}
              onPress={() => setForm({ ...form, state: form.state === s ? '' : s })}
            />
          ))}
        </Row>
        <Field
          label="Postcode"
          value={form.postcode}
          onChangeText={(v) => setForm({ ...form, postcode: v.replace(/\D/g, '').slice(0, 4) })}
          keyboardType="number-pad"
        />
        <Field
          label="Minimum hourly pay (AUD)"
          value={form.min_hourly_pay}
          onChangeText={(v) => setForm({ ...form, min_hourly_pay: v.replace(/[^0-9.]/g, '') })}
          keyboardType="decimal-pad"
          hint="Private. Used only to estimate your pay match."
        />
        <Field
          label="Summary"
          value={form.summary}
          onChangeText={(v) => setForm({ ...form, summary: v })}
          multiline
          maxLength={5000}
          style={{ minHeight: 100, textAlignVertical: 'top' }}
        />
        <Text variant="label">Work you are open to</Text>
        <Row>
          {(Object.keys(TYPE_LABEL) as EmploymentType[]).map((t) => (
            <Chip
              key={t}
              label={TYPE_LABEL[t]}
              selected={types.includes(t)}
              onPress={() =>
                setTypes(types.includes(t) ? types.filter((x) => x !== t) : [...types, t])
              }
            />
          ))}
        </Row>
        <Text variant="label">Skills</Text>
        <Row>
          {skills.map((s) => (
            <Pressable
              key={s}
              accessibilityRole="button"
              accessibilityLabel={`Remove skill ${s}`}
              onPress={() => setSkills(skills.filter((x) => x !== s))}
            >
              <Badge label={`${s}  ✕`} />
            </Pressable>
          ))}
        </Row>
        <Field
          label="Add a skill"
          value={skillInput}
          onChangeText={setSkillInput}
          onSubmitEditing={addSkill}
          returnKeyType="done"
          blurOnSubmit={false}
          hint="e.g. Barista, RSA, Food safety"
        />
        <Button title="Add skill" variant="secondary" onPress={addSkill} />
        {message ? (
          <Text
            accessibilityLiveRegion="polite"
            color={message.ok ? colors.onSuccessTint : colors.danger}
          >
            {message.text}
          </Text>
        ) : null}
        <Button title="Save profile" full loading={save.isPending} onPress={() => void submit()} />
      </Card>

      <Card>
        <Row style={{ justifyContent: 'space-between' }}>
          <Text variant="heading" accessibilityRole="header">
            Resumes
          </Text>
          <Button title="Add" variant="secondary" onPress={() => setResumeModal({})} />
        </Row>
        {resumes.data?.length ? (
          resumes.data.map((r) => (
            <View key={r.id} style={{ gap: 4, paddingVertical: 6 }}>
              <Text variant="label">{r.title}</Text>
              <Text variant="caption" muted>
                Version {r.versions.at(-1)?.version} ·{' '}
                {new Date(r.versions.at(-1)?.created_at ?? Date.now()).toLocaleDateString('en-AU')}
              </Text>
              <Button
                title="New version"
                variant="ghost"
                onPress={() => setResumeModal({ id: r.id, title: r.title })}
              />
            </View>
          ))
        ) : (
          <Text muted>
            No resumes yet. Paste your resume text to apply with it. File upload is coming later.
          </Text>
        )}
        <Text variant="caption" muted>
          Employers only see a resume when you apply with it.
        </Text>
      </Card>

      <Button
        title="Sign out"
        variant="secondary"
        full
        onPress={() =>
          Alert.alert('Sign out of NUA CREW?', undefined, [
            { text: 'Cancel', style: 'cancel' },
            { text: 'Sign out', style: 'destructive', onPress: () => void signOut() },
          ])
        }
      />
      <ResumeModal target={resumeModal} onClose={() => setResumeModal(null)} />
    </Screen>
  );
}

function ResumeModal({
  target,
  onClose,
}: {
  target: { id?: string; title?: string } | null;
  onClose: () => void;
}) {
  const add = useAddResume();
  const addVersion = useAddResumeVersion();
  const [title, setTitle] = useState('');
  const [text, setText] = useState('');
  const [error, setError] = useState<string | null>(null);
  const { colors } = useTheme();
  useEffect(() => {
    if (target) {
      setTitle(target.title ?? '');
      setText('');
      setError(null);
    }
  }, [target]);

  const submit = async () => {
    setError(null);
    if (!text.trim() || (!target?.id && !title.trim())) return setError('Add a name and some text');
    try {
      if (target?.id) await addVersion.mutateAsync({ id: target.id, content_text: text.trim() });
      else await add.mutateAsync({ title: title.trim(), content_text: text.trim() });
      onClose();
    } catch (e) {
      setError(messageOf(e));
    }
  };

  return (
    <Modal visible={!!target} animationType="slide" transparent onRequestClose={onClose}>
      <View style={{ flex: 1, justifyContent: 'flex-end', backgroundColor: '#0008' }}>
        <Card style={{ borderBottomLeftRadius: 0, borderBottomRightRadius: 0, gap: space(2) }}>
          <Text variant="title" accessibilityRole="header">
            {target?.id ? `New version of ${target.title}` : 'Add a resume'}
          </Text>
          {!target?.id ? <Field label="Name" value={title} onChangeText={setTitle} /> : null}
          <Field
            label="Resume text"
            value={text}
            onChangeText={setText}
            multiline
            maxLength={50000}
            style={{ minHeight: 160, textAlignVertical: 'top' }}
          />
          {error ? (
            <Text accessibilityLiveRegion="polite" color={colors.danger}>
              {error}
            </Text>
          ) : null}
          <Row>
            <Button
              title="Save"
              loading={add.isPending || addVersion.isPending}
              onPress={() => void submit()}
            />
            <Button title="Cancel" variant="ghost" onPress={onClose} />
          </Row>
        </Card>
      </View>
    </Modal>
  );
}
