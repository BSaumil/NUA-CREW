import { useRef, useState } from 'react';
import type { Schemas } from '@nua-crew/contracts';
import { localParts } from '@/features/scheduling';
import { messageOf } from '@/api/client';
import { useBookingAction, useMyBookings, useSubmitTimesheet } from '@/api/shifts';
import {
  Button,
  Card,
  ConfirmSheet,
  EmptyState,
  ErrorState,
  Field,
  ListSkeleton,
  Row,
  Screen,
  Text,
} from '@/ui';
import { Notice } from '@/ui/hire';
import { CandidateAttendance } from '@/ui/attendance';
import { ShiftDetails, TimesheetDetails } from '@/ui/shift';

export default function MyShifts() {
  const query = useMyBookings();
  return (
    <Screen>
      <Text variant="display" accessibilityRole="header">
        Your next shift, clearly.
      </Text>
      <Notice
        title="Your choice, every time"
        body="An invitation opens a conversation. A shift is booked only after you accept its time and pay. Offers do not hold a place."
      />
      {query.isPending ? (
        <ListSkeleton count={2} />
      ) : query.isError ? (
        <ErrorState message={messageOf(query.error)} onRetry={() => void query.refetch()} />
      ) : !query.data.length ? (
        <EmptyState
          title="No shift offers yet"
          body="Accepted temporary-work conversations can lead to a specific shift offer here."
        />
      ) : (
        query.data.map((b) => <Booking key={b.id} booking={b} />)
      )}
    </Screen>
  );
}
function Booking({ booking: b }: { booking: Schemas['BookingOut'] }) {
  const action = useBookingAction();
  const [target, setTarget] = useState<'accept' | 'decline' | 'cancel' | null>(null);
  const [reason, setReason] = useState('');
  const [error, setError] = useState<string | null>(null);
  const lock = useRef(false);
  const run = async () => {
    if (!target || lock.current) return;
    lock.current = true;
    setError(null);
    try {
      await action.mutateAsync({
        booking: b.id,
        body: { action: target, reason: reason.trim() || null },
      });
      setTarget(null);
    } catch (e) {
      setError(messageOf(e));
      setTarget(null);
    } finally {
      lock.current = false;
    }
  };
  const future = new Date(b.shift.starts_at).getTime() > Date.now();
  return (
    <Card>
      <ShiftDetails shift={b.shift} />
      <Text variant="label">{b.status.toUpperCase()}</Text>
      {b.reason ? <Text>{b.reason}</Text> : null}
      {error ? <Text accessibilityRole="alert">{error}</Text> : null}
      {b.status === 'offered' && new Date(b.expires_at).getTime() > Date.now() ? (
        <Row>
          <Button title="Review and accept" onPress={() => setTarget('accept')} />
          <Button title="Decline" variant="secondary" onPress={() => setTarget('decline')} />
        </Row>
      ) : null}
      {b.status === 'confirmed' && future ? (
        <>
          <Field
            label="Cancellation reason"
            value={reason}
            onChangeText={setReason}
            maxLength={1000}
          />
          <Button
            title="Cancel booking"
            variant="danger"
            onPress={() => {
              if (reason.trim().length < 3) setError('Add a short reason first.');
              else setTarget('cancel');
            }}
          />
        </>
      ) : null}
      {b.status === 'confirmed' &&
      new Date(b.shift.ends_at).getTime() + 12 * 3_600_000 > Date.now() ? (
        <CandidateAttendance booking={b} />
      ) : null}
      {b.timesheet ? <TimesheetDetails sheet={b.timesheet} /> : null}
      {b.status === 'confirmed' &&
      new Date(b.shift.ends_at).getTime() <= Date.now() &&
      b.timesheet?.status !== 'approved' ? (
        <Hours booking={b} />
      ) : null}
      <ConfirmSheet
        visible={!!target}
        title={
          target === 'accept'
            ? 'Accept this shift?'
            : target === 'decline'
              ? 'Decline this offer?'
              : 'Cancel this booking?'
        }
        body={
          target === 'accept'
            ? 'Confirm the displayed time, time zone and hourly pay. Acceptance reserves a place and marks this time as confirmed work in your calendar. Check your commitments before accepting.'
            : 'The business will see your decision. Cancelling confirmed work releases your calendar commitment.'
        }
        confirmLabel={
          target === 'accept'
            ? 'Accept shift'
            : target === 'decline'
              ? 'Decline offer'
              : 'Cancel booking'
        }
        onConfirm={() => void run()}
        onCancel={() => setTarget(null)}
      />
    </Card>
  );
}
function Hours({ booking: b }: { booking: Schemas['BookingOut'] }) {
  const submit = useSubmitTimesheet();
  const initialStart = localParts(b.timesheet?.starts_at ?? b.shift.starts_at, b.shift.time_zone);
  const initialEnd = localParts(b.timesheet?.ends_at ?? b.shift.ends_at, b.shift.time_zone);
  const [date, setDate] = useState(initialStart.date);
  const [start, setStart] = useState(initialStart.time);
  const [end, setEnd] = useState(initialEnd.time);
  const [pause, setPause] = useState(String(b.timesheet?.break_minutes ?? 0));
  const [error, setError] = useState<string | null>(null);
  const [confirm, setConfirm] = useState(false);
  const busy = useRef(false);
  const save = async () => {
    if (busy.current) return;
    busy.current = true;
    setError(null);
    try {
      if (!Number.isInteger(Number(pause)) || !/^\d+$/.test(pause)) throw Error('break');
      await submit.mutateAsync({
        booking: b.id,
        body: {
          local_date: date,
          local_start: start,
          local_end: end,
          time_zone: b.shift.time_zone,
          break_minutes: Number(pause),
        },
      });
      setConfirm(false);
    } catch (e) {
      setError(
        e instanceof Error && e.message === 'break' ? 'Use whole break minutes.' : messageOf(e),
      );
      setConfirm(false);
    } finally {
      busy.current = false;
    }
  };
  return (
    <>
      <Text variant="heading">Actual hours</Text>
      <Text variant="caption" muted>
        Enter the hours you actually worked in the venue time zone shown above. An end time earlier
        than the start means the following day.
      </Text>
      <Field label="Work date (YYYY-MM-DD)" value={date} onChangeText={setDate} maxLength={10} />
      <Field label="Actual start (HH:MM)" value={start} onChangeText={setStart} maxLength={5} />
      <Field label="Actual end (HH:MM)" value={end} onChangeText={setEnd} maxLength={5} />
      <Field
        label="Unpaid break minutes"
        value={pause}
        onChangeText={setPause}
        keyboardType="number-pad"
      />
      {error ? <Text accessibilityRole="alert">{error}</Text> : null}
      <Button
        title="Submit hours for review"
        onPress={() => setConfirm(true)}
        loading={submit.isPending}
      />
      <ConfirmSheet
        visible={confirm}
        title="Submit these actual hours?"
        body="The business can approve or dispute these hours. An approved timesheet needs support review to amend."
        confirmLabel="Submit hours"
        onConfirm={() => void save()}
        onCancel={() => setConfirm(false)}
      />
    </>
  );
}
