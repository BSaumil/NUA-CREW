import { useEffect, useRef, useState } from 'react';
import { View } from 'react-native';
import { messageOf } from '@/api/client';
import {
  useAddCommitment,
  useAddException,
  useAvailability,
  useDeleteCommitment,
  useDeleteException,
  useSaveRules,
} from '@/api/queries';
import {
  describeWindow,
  EXCEPTION_LABEL,
  formatDate,
  parseDate,
  parseTime,
  rulesOfDay,
  sameRules,
  windowError,
  WEEKDAYS,
  ZONES,
  normalise,
  type Rule,
} from '@/features/availability';
import { useTheme } from '@/theme/ThemeProvider';
import { space } from '@/theme/tokens';
import {
  Button,
  Card,
  Chip,
  ErrorState,
  Field,
  ListSkeleton,
  Row,
  Screen,
  Sheet,
  Text,
} from '@/ui';

type Sheets =
  { type: 'window'; weekday: number } | { type: 'exception' } | { type: 'commitment' } | null;

export default function AvailabilityScreen() {
  const { colors } = useTheme();
  const avail = useAvailability();
  const saveRules = useSaveRules();
  const delException = useDeleteException();
  const delCommitment = useDeleteCommitment();
  const [rules, setRules] = useState<Rule[]>([]);
  const [zone, setZone] = useState('Australia/Melbourne');
  const [sheet, setSheet] = useState<Sheets>(null);
  const [message, setMessage] = useState<{ ok: boolean; text: string } | null>(null);
  const seeded = useRef(false);

  useEffect(() => {
    if (!avail.data || seeded.current) return;
    seeded.current = true;
    setRules(normalise(avail.data.rules));
    setZone(avail.data.time_zone);
  }, [avail.data]);

  if (avail.isPending)
    return (
      <Screen>
        <ListSkeleton count={3} />
      </Screen>
    );
  if (avail.isError || !avail.data)
    return (
      <Screen>
        <ErrorState message={messageOf(avail.error)} onRetry={() => void avail.refetch()} />
      </Screen>
    );

  const server = avail.data;
  const dirty = !sameRules(rules, server.rules) || zone !== server.time_zone;

  const saveWeek = async () => {
    setMessage(null);
    try {
      await saveRules.mutateAsync({ time_zone: zone, rules });
      setMessage({ ok: true, text: 'Weekly availability saved.' });
    } catch (e) {
      setMessage({ ok: false, text: `${messageOf(e)} Your changes are still here: try again.` });
    }
  };

  const run = async (fn: () => Promise<unknown>) => {
    setMessage(null);
    try {
      await fn();
    } catch (e) {
      setMessage({ ok: false, text: messageOf(e) });
    }
  };

  return (
    <Screen edges={['left', 'right']}>
      <Text variant="title" accessibilityRole="header">
        When can you work?
      </Text>
      <Text muted>
        Employers only ever learn whether you are free for a time they ask about. They never see
        this calendar. If you share nothing, you show as "availability unknown", not as available.
      </Text>

      <Text variant="label">Your time zone</Text>
      <Row>
        {ZONES.map(([id, label]) => (
          <Chip key={id} label={label} selected={zone === id} onPress={() => setZone(id)} />
        ))}
      </Row>

      <Text variant="heading" accessibilityRole="header">
        Every week
      </Text>
      {WEEKDAYS.map((day, weekday) => {
        const list = rulesOfDay(rules, weekday);
        return (
          <Card key={day}>
            <Text variant="label" accessibilityRole="header">
              {day}
            </Text>
            {list.length === 0 ? (
              <Text variant="caption" muted>
                Not set
              </Text>
            ) : (
              list.map((r) => (
                <Row
                  key={`${r.start_time}-${r.end_time}`}
                  style={{ justifyContent: 'space-between' }}
                >
                  <Text>{describeWindow(r.start_time, r.end_time)}</Text>
                  <Button
                    title="Remove"
                    variant="ghost"
                    accessibilityLabel={`Remove ${day} ${describeWindow(r.start_time, r.end_time)}`}
                    onPress={() => {
                      setMessage(null);
                      setRules((all) => all.filter((x) => x !== r));
                    }}
                  />
                </Row>
              ))
            )}
            <Button
              title="Add a time"
              variant="secondary"
              accessibilityLabel={`Add a time on ${day}`}
              onPress={() => setSheet({ type: 'window', weekday })}
            />
          </Card>
        );
      })}
      <Text variant="caption" muted>
        Add several times in a day for a break between shifts. A time that ends before it starts
        (for example 10:00 pm to 6:00 am) carries on into the next day.
      </Text>
      <Button
        title={dirty ? 'Save weekly availability' : 'Weekly availability saved'}
        full
        disabled={!dirty}
        loading={saveRules.isPending}
        onPress={() => void saveWeek()}
      />

      <Text variant="heading" accessibilityRole="header">
        One-off changes
      </Text>
      <Text variant="caption" muted>
        Days off or extra days. "Not available" always wins over your weekly times.
      </Text>
      {server.exceptions.length === 0 ? <Text muted>None</Text> : null}
      {server.exceptions.map((x) => {
        const range =
          x.start_date === x.end_date
            ? formatDate(x.start_date)
            : `${formatDate(x.start_date)} to ${formatDate(x.end_date)}`;
        const when =
          x.start_time && x.end_time ? describeWindow(x.start_time, x.end_time) : 'all day';
        return (
          <Card key={x.id}>
            <Text>
              {EXCEPTION_LABEL[x.state as keyof typeof EXCEPTION_LABEL]}: {range}, {when}
            </Text>
            <Button
              title="Remove"
              variant="ghost"
              accessibilityLabel={`Remove one-off change ${range}`}
              onPress={() => void run(() => delException.mutateAsync(x.id))}
            />
          </Card>
        );
      })}
      <Button
        title="Add a one-off change"
        variant="secondary"
        onPress={() => setSheet({ type: 'exception' })}
      />

      <Text variant="heading" accessibilityRole="header">
        Work already booked
      </Text>
      <Text variant="caption" muted>
        Confirmed work can't overlap. Applying for a job does not book you; only work you add here
        does.
      </Text>
      {server.commitments.length === 0 ? <Text muted>None</Text> : null}
      {server.commitments.map((c) => (
        <Card key={c.id}>
          <Text>
            {c.status === 'confirmed' ? 'Confirmed' : 'Held'}
            {c.label ? `: ${c.label}` : ''}
          </Text>
          <Text variant="caption" muted>
            {stamp(c.starts_at)} to {stamp(c.ends_at)}
          </Text>
          <Button
            title="Remove"
            variant="ghost"
            accessibilityLabel={`Remove booking ${c.label ?? stamp(c.starts_at)}`}
            onPress={() => void run(() => delCommitment.mutateAsync(c.id))}
          />
        </Card>
      ))}
      <Button
        title="Add booked work"
        variant="secondary"
        onPress={() => setSheet({ type: 'commitment' })}
      />

      {message ? (
        <Text
          accessibilityRole="alert"
          accessibilityLiveRegion="polite"
          color={message.ok ? colors.text : colors.danger}
        >
          {message.text}
        </Text>
      ) : null}

      {sheet?.type === 'window' ? (
        <WindowSheet
          weekday={sheet.weekday}
          existing={rules}
          onAdd={(r) => {
            setRules((all) => [...all, r]);
            setSheet(null);
          }}
          onClose={() => setSheet(null)}
        />
      ) : null}
      {sheet?.type === 'exception' ? <ExceptionSheet onClose={() => setSheet(null)} /> : null}
      {sheet?.type === 'commitment' ? <CommitmentSheet onClose={() => setSheet(null)} /> : null}
    </Screen>
  );
}

const stamp = (iso: string) =>
  new Date(iso).toLocaleString('en-AU', {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
    hour: 'numeric',
    minute: '2-digit',
  });

function WindowSheet({
  weekday,
  existing,
  onAdd,
  onClose,
}: {
  weekday: number;
  existing: Rule[];
  onAdd: (r: Rule) => void;
  onClose: () => void;
}) {
  const { colors } = useTheme();
  const [start, setStart] = useState('');
  const [end, setEnd] = useState('');
  const [errs, setErrs] = useState<{ start?: string; end?: string; form?: string }>({});
  const day = WEEKDAYS[weekday];
  return (
    <Sheet visible onClose={onClose}>
      <Text variant="title" accessibilityRole="header">
        Add a time on {day}
      </Text>
      <Field
        label="From"
        value={start}
        onChangeText={setStart}
        placeholder="e.g. 9:00 am or 17:00"
        autoCapitalize="none"
        error={errs.start}
      />
      <Field
        label="Until"
        value={end}
        onChangeText={setEnd}
        placeholder="e.g. 5:00 pm or 22:00"
        autoCapitalize="none"
        error={errs.end}
      />
      {errs.form ? (
        <Text accessibilityRole="alert" color={colors.danger}>
          {errs.form}
        </Text>
      ) : null}
      <Row>
        <Button
          title="Add time"
          onPress={() => {
            const r = windowError(start, end, existing, weekday);
            if (r.value) onAdd(r.value);
            else setErrs(r);
          }}
        />
        <Button title="Cancel" variant="ghost" onPress={onClose} />
      </Row>
    </Sheet>
  );
}

function ExceptionSheet({ onClose }: { onClose: () => void }) {
  const { colors } = useTheme();
  const add = useAddException();
  const [state, setState] = useState<'unavailable' | 'available'>('unavailable');
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const [allDay, setAllDay] = useState(true);
  const [start, setStart] = useState('');
  const [end, setEnd] = useState('');
  const [errs, setErrs] = useState<Record<string, string>>({});
  const [serverError, setServerError] = useState<string | null>(null);

  const submit = async () => {
    const e: Record<string, string> = {};
    const f = parseDate(from);
    const t = to.trim() ? parseDate(to) : f;
    if (!f) e.from = 'Use a date like 24/12/2026';
    if (!t) e.to = 'Use a date like 26/12/2026';
    if (f && t && t < f) e.to = "The last day can't be before the first";
    let st: string | null = null;
    let en: string | null = null;
    if (!allDay) {
      st = parseTime(start);
      en = parseTime(end);
      if (!st) e.start = 'Enter a time like 9:00 am';
      if (!en) e.end = 'Enter a time like 5:00 pm';
      if (st && en && st === en) e.end = 'Start and end must be different';
    }
    setErrs(e);
    if (Object.keys(e).length || !f || !t) return;
    setServerError(null);
    try {
      await add.mutateAsync({
        state,
        start_date: f,
        end_date: t,
        start_time: allDay ? null : st,
        end_time: allDay ? null : en,
      });
      onClose();
    } catch (err) {
      setServerError(messageOf(err));
    }
  };

  return (
    <Sheet visible onClose={onClose}>
      <Text variant="title" accessibilityRole="header">
        Add a one-off change
      </Text>
      <Row>
        <Chip
          label="Not available"
          selected={state === 'unavailable'}
          onPress={() => setState('unavailable')}
        />
        <Chip
          label="Available"
          selected={state === 'available'}
          onPress={() => setState('available')}
        />
      </Row>
      <Field
        label="First day"
        value={from}
        onChangeText={setFrom}
        placeholder="e.g. 24/12/2026"
        error={errs.from}
      />
      <Field
        label="Last day (optional)"
        value={to}
        onChangeText={setTo}
        placeholder="Same as first day"
        error={errs.to}
      />
      <Row>
        <Chip label="All day" selected={allDay} onPress={() => setAllDay(true)} />
        <Chip label="Only some hours" selected={!allDay} onPress={() => setAllDay(false)} />
      </Row>
      {!allDay ? (
        <View style={{ gap: space(1) }}>
          <Field
            label="From time"
            value={start}
            onChangeText={setStart}
            placeholder="e.g. 9:00 am"
            autoCapitalize="none"
            error={errs.start}
          />
          <Field
            label="Until time"
            value={end}
            onChangeText={setEnd}
            placeholder="e.g. 5:00 pm"
            autoCapitalize="none"
            error={errs.end}
          />
        </View>
      ) : null}
      {serverError ? (
        <Text accessibilityRole="alert" color={colors.danger}>
          {serverError}
        </Text>
      ) : null}
      <Row>
        <Button title="Save change" loading={add.isPending} onPress={() => void submit()} />
        <Button title="Cancel" variant="ghost" onPress={onClose} />
      </Row>
    </Sheet>
  );
}

function CommitmentSheet({ onClose }: { onClose: () => void }) {
  const { colors } = useTheme();
  const add = useAddCommitment();
  const [label, setLabel] = useState('');
  const [date, setDate] = useState('');
  const [start, setStart] = useState('');
  const [end, setEnd] = useState('');
  const [status, setStatus] = useState<'confirmed' | 'held'>('confirmed');
  const [errs, setErrs] = useState<Record<string, string>>({});
  const [serverError, setServerError] = useState<string | null>(null);

  const submit = async () => {
    const e: Record<string, string> = {};
    const d = parseDate(date);
    const st = parseTime(start);
    const en = parseTime(end);
    if (!d) e.date = 'Use a date like 24/12/2026';
    if (!st) e.start = 'Enter a time like 6:00 pm';
    if (!en) e.end = 'Enter a time like 11:00 pm';
    if (st && en && st === en) e.end = 'Start and end must be different';
    setErrs(e);
    if (Object.keys(e).length || !d || !st || !en) return;
    setServerError(null);
    try {
      await add.mutateAsync({
        local_date: d,
        local_start: st,
        local_end: en,
        status,
        label: label.trim() || null,
      });
      onClose();
    } catch (err) {
      setServerError(messageOf(err));
    }
  };

  return (
    <Sheet visible onClose={onClose}>
      <Text variant="title" accessibilityRole="header">
        Add booked work
      </Text>
      <Field label="What is it? (optional)" value={label} onChangeText={setLabel} maxLength={100} />
      <Field
        label="Date"
        value={date}
        onChangeText={setDate}
        placeholder="e.g. 24/12/2026"
        error={errs.date}
      />
      <Field
        label="From"
        value={start}
        onChangeText={setStart}
        placeholder="e.g. 6:00 pm"
        autoCapitalize="none"
        error={errs.start}
      />
      <Field
        label="Until"
        value={end}
        onChangeText={setEnd}
        placeholder="e.g. 11:00 pm"
        hint="An end time before the start carries into the next day."
        autoCapitalize="none"
        error={errs.end}
      />
      <Row>
        <Chip
          label="Confirmed"
          selected={status === 'confirmed'}
          onPress={() => setStatus('confirmed')}
        />
        <Chip label="Tentative" selected={status === 'held'} onPress={() => setStatus('held')} />
      </Row>
      {serverError ? (
        <Text accessibilityRole="alert" color={colors.danger}>
          {serverError}
        </Text>
      ) : null}
      <Row>
        <Button title="Add booking" loading={add.isPending} onPress={() => void submit()} />
        <Button title="Cancel" variant="ghost" onPress={onClose} />
      </Row>
    </Sheet>
  );
}
