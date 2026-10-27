import type { Schemas } from '@nua-crew/contracts';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useRef, useState } from 'react';
import {
  canRecruit,
  useHireCreateJob,
  useHireEditJob,
  useHireJob,
  useHireLocations,
} from '@/api/hire';
import { messageOf } from '@/api/client';
import { validateJob } from '@/features/hire-form';
import { useHireWorkspace } from '@/state/HireWorkspace';
import { useTheme } from '@/theme/ThemeProvider';
import { Button, Card, Chip, ErrorState, Field, ListSkeleton, Row, Screen, Text } from '@/ui';
import { HireGate, Notice } from '@/ui/hire';

export default function PostJob() {
  const { id } = useLocalSearchParams<{ id?: string }>();
  return <HireGate>{id ? <EditLoader id={id} /> : <JobForm />}</HireGate>;
}
function EditLoader({ id }: { id: string }) {
  const query = useHireJob(id);
  if (query.isPending)
    return (
      <Screen>
        <ListSkeleton count={2} />
      </Screen>
    );
  if (!query.data)
    return (
      <Screen>
        <ErrorState message={messageOf(query.error)} onRetry={() => void query.refetch()} />
      </Screen>
    );
  return <JobForm initial={query.data} key={id} />;
}
function JobForm({ initial }: { initial?: Schemas['JobOut'] }) {
  const router = useRouter();
  const { role } = useHireWorkspace();
  const { colors } = useTheme();
  const locations = useHireLocations();
  const create = useHireCreateJob();
  const edit = useHireEditJob(initial?.id ?? '');
  const [step, setStep] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [title, setTitle] = useState(initial?.title ?? '');
  const [description, setDescription] = useState(initial?.description ?? '');
  const [location, setLocation] = useState(initial?.location_id ?? '');
  const [type, setType] = useState<Schemas['JobIn']['employment_type']>(
    (initial?.employment_type as Schemas['JobIn']['employment_type']) ?? 'full_time',
  );
  const [basis, setBasis] = useState<Schemas['JobIn']['engagement_basis']>(
    (initial?.engagement_basis as Schemas['JobIn']['engagement_basis']) ?? 'employee',
  );
  const [duration, setDuration] = useState<Schemas['JobIn']['duration_type']>(
    (initial?.duration_type as Schemas['JobIn']['duration_type']) ?? 'ongoing',
  );
  const [min, setMin] = useState(initial?.pay_min ?? '');
  const [max, setMax] = useState(initial?.pay_max ?? '');
  const [period, setPeriod] = useState<Schemas['JobIn']['pay_period']>(
    (initial?.pay_period as Schemas['JobIn']['pay_period']) ?? 'hour',
  );
  const [superIncluded, setSuper] = useState<boolean | null>(initial?.super_included ?? null);
  const [skills, setSkills] = useState(initial?.skills.join(', ') ?? '');
  const [minHours, setMinHours] = useState(initial?.min_weekly_hours ?? '');
  const [maxHours, setMaxHours] = useState(initial?.max_weekly_hours ?? '');
  const [startDate, setStartDate] = useState(initial?.start_date ?? '');
  const [endDate, setEndDate] = useState(initial?.end_date ?? '');
  const [more, setMore] = useState(!!initial);
  const busy = useRef(false);
  const body: Schemas['JobIn'] = {
    title: title.trim(),
    description: description.trim(),
    location_id: location || null,
    employment_type: type,
    engagement_basis: basis,
    duration_type: duration,
    hours_pattern: ['full_time', 'part_time', 'casual'].includes(type)
      ? (type as 'full_time' | 'part_time' | 'casual')
      : 'unspecified',
    pay_min: min.trim() || null,
    pay_max: max.trim() || null,
    pay_period: period,
    super_included: superIncluded,
    skills: skills
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean),
    category: initial?.category ?? null,
    expires_at: initial?.expires_at ?? null,
    min_weekly_hours: minHours.trim() || null,
    max_weekly_hours: maxHours.trim() || null,
    start_date: startDate.trim() || null,
    end_date: endDate.trim() || null,
  };
  const next = () => {
    const e = validateJob(body, step);
    setError(e);
    if (!e) setStep(step + 1);
  };
  const save = async () => {
    if (busy.current) return;
    const e = validateJob(body, 2);
    if (e) {
      setError(e);
      return;
    }
    busy.current = true;
    setError(null);
    try {
      const job = initial ? await edit.mutateAsync(body) : await create.mutateAsync(body);
      router.replace({ pathname: '/hire-job/[id]', params: { id: job.id } });
    } catch (e) {
      setError(
        `${messageOf(e)} If the connection dropped, check Jobs before creating another draft.`,
      );
    } finally {
      busy.current = false;
    }
  };
  if (!canRecruit(role))
    return (
      <Screen>
        <Notice
          title="View-only access"
          body="Your business owner can give you recruiting permissions."
        />
      </Screen>
    );
  if (locations.isPending)
    return (
      <Screen>
        <ListSkeleton count={2} />
      </Screen>
    );
  if (locations.isError)
    return (
      <Screen>
        <ErrorState message={messageOf(locations.error)} onRetry={() => void locations.refetch()} />
      </Screen>
    );
  if (!locations.data?.length)
    return (
      <Screen>
        <Notice
          title="Add your work location first"
          body={
            role === 'owner'
              ? 'Set up the venue before drafting your first role. People need to know where they will work.'
              : 'Ask the business owner to add a venue before you create a role.'
          }
        />
        <Button title="Open business settings" onPress={() => router.push('/hire/business')} />
      </Screen>
    );
  return (
    <Screen>
      <Text variant="caption" muted accessibilityLiveRegion="polite">
        STEP {step + 1} OF 3 · {['ROLE', 'PAY', 'REVIEW'][step]}
      </Text>
      <Text variant="display" accessibilityRole="header">
        {['Start with the essentials.', 'Make the pay clear.', 'A final look before saving.'][step]}
      </Text>
      <Row>
        {['Role', 'Pay', 'Review'].map((label, i) => (
          <Chip
            key={label}
            label={label}
            selected={i === step}
            onPress={
              i < step
                ? () => {
                    setStep(i);
                    setError(null);
                  }
                : undefined
            }
          />
        ))}
      </Row>
      {error ? (
        <Text accessibilityRole="alert" color={colors.danger}>
          {error}
        </Text>
      ) : null}
      {step === 0 ? (
        <>
          <Field
            label="Job title"
            value={title}
            onChangeText={setTitle}
            maxLength={150}
            placeholder="e.g. Barista"
          />
          <Text variant="label">Work location</Text>
          <Row>
            {locations.data.map((l) => (
              <Chip
                key={l.id}
                label={`${l.name} · ${l.suburb}`}
                selected={location === l.id}
                onPress={() => setLocation(l.id)}
              />
            ))}
          </Row>
          <Text variant="label">Work pattern</Text>
          <Row>
            {(['full_time', 'part_time', 'casual', 'contract', 'shift'] as const).map((v) => (
              <Chip
                key={v}
                label={
                  {
                    full_time: 'Full time',
                    part_time: 'Part time',
                    casual: 'Casual',
                    contract: 'Contract',
                    shift: 'Shift',
                  }[v]
                }
                selected={type === v}
                onPress={() => setType(v)}
              />
            ))}
          </Row>
          <Text variant="label">Engagement basis</Text>
          <Row>
            {(['employee', 'contractor', 'unspecified'] as const).map((v) => (
              <Chip
                key={v}
                label={
                  {
                    employee: 'Employee',
                    contractor: 'Independent contractor',
                    unspecified: 'Not confirmed',
                  }[v]
                }
                selected={basis === v}
                onPress={() => setBasis(v)}
              />
            ))}
          </Row>
          <Text variant="label">Opportunity duration</Text>
          <Row>
            {(['ongoing', 'fixed_term', 'one_off', 'unspecified'] as const).map((v) => (
              <Chip
                key={v}
                label={
                  {
                    ongoing: 'Ongoing',
                    fixed_term: 'Fixed term',
                    one_off: 'One-off',
                    unspecified: 'Not stated',
                  }[v]
                }
                selected={duration === v}
                onPress={() => setDuration(v)}
              />
            ))}
          </Row>
          <Field
            label="About the role"
            value={description}
            onChangeText={setDescription}
            multiline
            style={{ minHeight: 144, textAlignVertical: 'top' }}
            maxLength={20000}
            placeholder="Responsibilities, experience, hours and what your team offers."
          />
          <Button
            title={more ? 'Hide optional details' : 'Add hours, dates and skills (optional)'}
            variant="secondary"
            onPress={() => setMore(!more)}
          />
          {more ? (
            <Card>
              <Field
                label="Minimum weekly hours (optional)"
                value={minHours}
                onChangeText={setMinHours}
                keyboardType="decimal-pad"
              />
              <Field
                label="Maximum weekly hours (optional)"
                value={maxHours}
                onChangeText={setMaxHours}
                keyboardType="decimal-pad"
              />
              <Field
                label="Start date (optional, YYYY-MM-DD)"
                value={startDate}
                onChangeText={setStartDate}
                placeholder="YYYY-MM-DD"
              />
              <Field
                label="End date (optional, YYYY-MM-DD)"
                value={endDate}
                onChangeText={setEndDate}
                placeholder="YYYY-MM-DD"
              />
              <Field
                label="Skills (comma separated)"
                value={skills}
                onChangeText={setSkills}
                placeholder="e.g. Coffee, Customer service"
                hint="Up to 30 relevant skills."
              />
            </Card>
          ) : null}
        </>
      ) : step === 1 ? (
        <>
          <Text muted>
            Give a genuine range. Use the same minimum and maximum for a fixed rate.
          </Text>
          <Field
            label="Minimum pay (AUD)"
            value={min}
            onChangeText={setMin}
            keyboardType="decimal-pad"
          />
          <Field
            label="Maximum pay (AUD)"
            value={max}
            onChangeText={setMax}
            keyboardType="decimal-pad"
          />
          <Text variant="label">Pay period</Text>
          <Row>
            {(['hour', 'day', 'week', 'month', 'year'] as const).map((v) => (
              <Chip
                key={v}
                label={`Per ${v}`}
                selected={period === v}
                onPress={() => setPeriod(v)}
              />
            ))}
          </Row>
          <Text variant="label">Superannuation</Text>
          <Row>
            <Chip
              label="Plus super"
              selected={superIncluded === false}
              onPress={() => setSuper(false)}
            />
            <Chip
              label="Super included"
              selected={superIncluded === true}
              onPress={() => setSuper(true)}
            />
          </Row>
          <Notice
            title="Your pay responsibilities"
            body="Check the applicable award or agreement, classification, hours, penalties and allowances. Saving this range does not verify legal minimum pay."
          />
        </>
      ) : (
        <>
          <Card>
            <Text variant="title">{title}</Text>
            <Text muted>{locations.data?.find((l) => l.id === location)?.name}</Text>
            <Text>
              AUD {min}–{max} per {period} · {superIncluded ? 'super included' : 'plus super'}
            </Text>
            <Text>
              {type.replaceAll('_', ' ')} · {basis} · {duration?.replaceAll('_', ' ')}
            </Text>
            <Text>{description}</Text>
            {minHours || maxHours ? (
              <Text muted>
                {minHours || 'Not stated'}–{maxHours || 'Not stated'} hours per week
              </Text>
            ) : null}
            {startDate || endDate ? (
              <Text muted>
                {startDate || 'Start not stated'} → {endDate || 'End not stated'}
              </Text>
            ) : null}
            <Text muted>{skills}</Text>
          </Card>
          <Notice
            title={
              initial ? 'You are updating this advertisement' : 'Save first, publish when ready'
            }
            body={
              initial
                ? 'Changes to a live job are visible to candidates. Saving does not renew its advertisement period.'
                : 'This saves a draft. You can review applicants and publish after your business is verified. No payment is taken.'
            }
          />
        </>
      )}
      <Row>
        {step > 0 ? (
          <Button
            title="Back"
            variant="ghost"
            onPress={() => {
              setStep(step - 1);
              setError(null);
            }}
          />
        ) : null}
        {step < 2 ? (
          <Button title={step === 0 ? 'Continue to pay' : 'Review advertisement'} onPress={next} />
        ) : (
          <Button
            title={initial ? 'Save changes' : 'Save draft'}
            loading={create.isPending || edit.isPending}
            onPress={() => void save()}
          />
        )}
      </Row>
    </Screen>
  );
}
