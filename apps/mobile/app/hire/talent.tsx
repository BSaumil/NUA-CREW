import type { Schemas } from '@nua-crew/contracts';
import { randomUUID } from 'expo-crypto';
import { useRouter } from 'expo-router';
import { useRef, useState } from 'react';
import { canRecruit, useHireBusiness, useHireInvite, useHireJobs, useHireSearch } from '@/api/hire';
import { messageOf } from '@/api/client';
import { payRange } from '@/features/format';
import { validateWorkWindow } from '@/features/hire-form';
import { useHireWorkspace } from '@/state/HireWorkspace';
import { useTheme } from '@/theme/ThemeProvider';
import { Badge, Button, Card, Chip, EmptyState, Field, Row, Screen, Sheet, Text } from '@/ui';
import { HireGate, HireHeading, Notice } from '@/ui/hire';

export default function FindPeople() {
  return (
    <HireGate>
      <Talent />
    </HireGate>
  );
}
function Talent() {
  const router = useRouter();
  const { colors } = useTheme();
  const { role } = useHireWorkspace();
  const business = useHireBusiness();
  const jobs = useHireJobs();
  const search = useHireSearch();
  const invite = useHireInvite();
  const [kind, setKind] = useState<'permanent' | 'temporary'>('permanent');
  const [suburb, setSuburb] = useState('');
  const [skills, setSkills] = useState('');
  const [jobId, setJobId] = useState('');
  const [date, setDate] = useState('');
  const [start, setStart] = useState('');
  const [end, setEnd] = useState('');
  const [zone, setZone] = useState('Australia/Melbourne');
  const [applied, setApplied] = useState<Schemas['TalentSearchIn'] | null>(null);
  const [result, setResult] = useState<Schemas['TalentSearchOut'] | null>(null);
  const [person, setPerson] = useState<Schemas['TalentCandidateOut'] | null>(null);
  const [inviteJob, setInviteJob] = useState('');
  const [note, setNote] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const keys = useRef(new Map<string, string>());
  const sending = useRef(false);
  const searching = useRef(false);
  const liveJobs = jobs.data?.filter((j) => j.status === 'published') ?? [];
  const selected = liveJobs.find((j) => j.id === inviteJob);
  const allowed = canRecruit(role) && business.data?.verification_status === 'verified';
  const run = async (more = false) => {
    if (searching.current) return;
    if (!more && kind === 'temporary') {
      const validation = validateWorkWindow(date, start, end);
      if (validation) {
        setError(validation);
        return;
      }
    }
    if (!more && skills.split(',').filter((s) => s.trim()).length > 10) {
      setError('Choose up to 10 skills for this search.');
      return;
    }
    searching.current = true;
    setError(null);
    setNotice(null);
    const body: Schemas['TalentSearchIn'] =
      more && applied
        ? { ...applied, after: result?.next_after }
        : {
            kind,
            availability: 'available_or_unknown',
            limit: 25,
            window_time_zone: zone,
            suburb: suburb.trim() || null,
            skills: skills
              .split(',')
              .map((s) => s.trim())
              .filter(Boolean),
            job_id: jobId || null,
            ...(kind === 'temporary' && (date || start || end)
              ? { window_date: date, window_start: start, window_end: end, window_time_zone: zone }
              : {}),
          };
    try {
      const data = await search.mutateAsync(body);
      setResult(more ? { ...data, items: [...(result?.items ?? []), ...data.items] } : data);
      setApplied(body);
    } catch (e) {
      setError(messageOf(e));
    } finally {
      searching.current = false;
    }
  };
  const send = async () => {
    if (!person || !selected || !applied || sending.current) return;
    sending.current = true;
    setError(null);
    const body: Schemas['InvitationIn'] = {
      ref: person.ref,
      job_id: selected.id,
      kind: applied.kind,
      note: note.trim(),
    };
    const fingerprint = JSON.stringify(body);
    let key = keys.current.get(fingerprint);
    if (!key) {
      key = randomUUID();
      keys.current.set(fingerprint, key);
    }
    try {
      await invite.mutateAsync({ body, key });
      setPerson(null);
      setNotice('Invitation sent. They can accept or decline in their inbox.');
    } catch (e) {
      setError(messageOf(e));
    } finally {
      sending.current = false;
    }
  };
  return (
    <Screen>
      <HireHeading
        title="Find your people."
        body="Meet people who chose to be found. Invite them to a real role, then let them decide."
      />
      {!allowed ? (
        <Notice
          title={canRecruit(role) ? 'Business verification needed' : 'Recruiting access needed'}
          body="Talent discovery is available to verified businesses with owner or recruiter permissions."
        />
      ) : null}
      <Card>
        <Text variant="heading">Who are you looking for?</Text>
        <Row>
          <Chip
            label="Permanent"
            selected={kind === 'permanent'}
            onPress={() => setKind('permanent')}
          />
          <Chip
            label="Temporary"
            selected={kind === 'temporary'}
            onPress={() => setKind('temporary')}
          />
        </Row>
        <Field
          label="Suburb (optional)"
          value={suburb}
          onChangeText={setSuburb}
          placeholder="e.g. Alphington"
        />
        <Field
          label="Skills (comma separated, optional)"
          value={skills}
          onChangeText={setSkills}
          placeholder="e.g. Barista, Coffee"
        />
        <Text variant="label">Compare with a live job (optional)</Text>
        <Row>
          <Chip label="Any role" selected={!jobId} onPress={() => setJobId('')} />
          {liveJobs.map((j) => (
            <Chip
              key={j.id}
              label={j.title}
              selected={jobId === j.id}
              onPress={() => setJobId(j.id)}
            />
          ))}
        </Row>
        {kind === 'temporary' ? (
          <>
            <Text variant="label">Check a work window (optional)</Text>
            <Field
              label="Work date (YYYY-MM-DD)"
              value={date}
              onChangeText={setDate}
              placeholder="YYYY-MM-DD"
            />
            <Row>
              <Field
                label="Start (HH:MM)"
                value={start}
                onChangeText={setStart}
                placeholder="17:00"
              />
              <Field label="End (HH:MM)" value={end} onChangeText={setEnd} placeholder="23:00" />
            </Row>
            <Text variant="caption" muted>
              An end time before the start runs overnight. Select the venue's time zone.
            </Text>
            <Row>
              {['Melbourne', 'Sydney', 'Brisbane', 'Adelaide', 'Perth', 'Darwin', 'Hobart'].map(
                (city) => (
                  <Chip
                    key={city}
                    label={city}
                    selected={zone === `Australia/${city}`}
                    onPress={() => setZone(`Australia/${city}`)}
                  />
                ),
              )}
            </Row>
          </>
        ) : null}
        <Button
          title="Find people"
          disabled={!allowed}
          loading={search.isPending}
          onPress={() => void run()}
        />
      </Card>
      {error && !person ? (
        <Text color={colors.danger} accessibilityRole="alert">
          {error}
        </Text>
      ) : null}
      {notice ? (
        <Text accessibilityRole="alert" color={colors.primary}>
          {notice}
        </Text>
      ) : null}
      {result ? (
        <>
          <Text variant="heading" accessibilityRole="header">
            People to meet · {applied?.kind === 'permanent' ? 'Permanent' : 'Temporary'}
          </Text>
          {result.items.length === 0 ? (
            <EmptyState
              title="No people match this search yet"
              body="Try fewer skills or another area. Availability that isn't shared is never treated as confirmed."
            />
          ) : null}
          {result.items.map((p) => (
            <Card key={p.ref}>
              <Text variant="title">{p.display_name}</Text>
              <Text muted>{p.headline ?? 'Ready for a new opportunity'}</Text>
              <Text variant="caption" muted>
                {p.area ?? 'Area not shared'}
              </Text>
              <Row>
                <Badge
                  label={
                    p.availability.state === 'available'
                      ? 'Available for this window'
                      : p.availability.state === 'unavailable'
                        ? 'Unavailable for this window'
                        : p.availability.state === 'unknown'
                          ? 'Availability not confirmed'
                          : 'Availability not checked'
                  }
                  tone={p.availability.state === 'available' ? 'ok' : 'neutral'}
                />
                {p.prefers_your_business ? (
                  <Badge label="Prefers your business" tone="live" />
                ) : null}
              </Row>
              <Text variant="caption" muted>
                {p.skills.join(' · ') || 'No skills shared'}
              </Text>
              {p.pay_compat !== 'not_requested' ? (
                <Text variant="caption" muted>
                  {p.pay_compat === 'compatible' ? 'Pay range compatible' : 'Pay fit not confirmed'}
                </Text>
              ) : null}
              <Button
                title={`Invite ${p.display_name}`}
                variant="secondary"
                disabled={!result.invite_available || !liveJobs.length}
                onPress={() => {
                  setPerson(p);
                  setInviteJob(applied?.job_id ?? '');
                  setNote('');
                  setError(null);
                }}
              />
            </Card>
          ))}
          {!liveJobs.length ? (
            <Button
              title="Create a job before inviting"
              variant="secondary"
              onPress={() => router.push('/hire-post')}
            />
          ) : null}
          {result.notes.map((n) => (
            <Text key={n} variant="caption" muted>
              {n}
            </Text>
          ))}
          {result.next_after ? (
            <Button
              title="Show more people"
              variant="secondary"
              loading={search.isPending}
              onPress={() => void run(true)}
            />
          ) : null}
        </>
      ) : (
        <Notice
          title="Private by choice"
          body="Search only includes people who consented to discovery. An invitation does not reserve their time or share their contact details."
        />
      )}
      <Sheet
        visible={!!person}
        onClose={() => {
          if (!sending.current) setPerson(null);
        }}
      >
        <Text variant="title">Invite {person?.display_name}</Text>
        <Text muted>
          Choose a live role. They can review its pay and terms before accepting a conversation.
        </Text>
        <Row>
          {liveJobs.map((j) => (
            <Chip
              key={j.id}
              label={j.title}
              selected={inviteJob === j.id}
              onPress={() => setInviteJob(j.id)}
            />
          ))}
        </Row>
        {selected ? (
          <Card>
            <Text variant="heading">{selected.title}</Text>
            <Text>
              {payRange(selected)} ·{' '}
              {selected.super_included
                ? 'super included'
                : selected.super_included === false
                  ? 'plus super'
                  : 'super not stated'}
            </Text>
            <Text muted>{selected.suburb}</Text>
          </Card>
        ) : null}
        <Field
          label="Your invitation note (optional)"
          value={note}
          onChangeText={setNote}
          multiline
          maxLength={500}
        />
        {error ? (
          <Text color={colors.danger} accessibilityRole="alert">
            {error}
          </Text>
        ) : null}
        <Button
          title="Send invitation"
          disabled={!selected}
          loading={invite.isPending}
          onPress={() => void send()}
        />
        <Button
          title="Cancel"
          variant="ghost"
          disabled={invite.isPending}
          onPress={() => setPerson(null)}
        />
      </Sheet>
    </Screen>
  );
}
