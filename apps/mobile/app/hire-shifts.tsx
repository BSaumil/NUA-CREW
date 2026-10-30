import { useRef, useState } from 'react';
import type { Schemas } from '@nua-crew/contracts';
import { canRecruit, useHireJobs, useHireThreads } from '@/api/hire';
import {
  useCancelShift,
  useCreateShift,
  useEmployerBookings,
  useOfferShift,
  useReviewTimesheet,
  useShifts,
} from '@/api/shifts';
import { messageOf } from '@/api/client';
import { useHireWorkspace } from '@/state/HireWorkspace';
import {
  Button,
  Card,
  Chip,
  ConfirmSheet,
  EmptyState,
  ErrorState,
  Field,
  ListSkeleton,
  Row,
  Screen,
  Text,
} from '@/ui';
import { HireGate, Notice } from '@/ui/hire';
import { BookingHistory } from '@/ui/booking-history';
import { EmployerAttendance } from '@/ui/attendance';
import { ShiftDetails, TimesheetDetails } from '@/ui/shift';

export default function HireShifts() {
  return (
    <HireGate>
      <Workspace />
    </HireGate>
  );
}
function Workspace() {
  const shifts = useShifts();
  const jobs = useHireJobs();
  const threads = useHireThreads();
  const bookings = useEmployerBookings();
  const create = useCreateShift();
  const offer = useOfferShift();
  const cancel = useCancelShift();
  const { role } = useHireWorkspace();
  const write = canRecruit(role);
  const [job, setJob] = useState('');
  const [date, setDate] = useState('');
  const [start, setStart] = useState('09:00');
  const [end, setEnd] = useState('17:00');
  const [zone, setZone] = useState('Australia/Melbourne');
  const [capacity, setCapacity] = useState('1');
  const [rate, setRate] = useState('');
  const [reason, setReason] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [target, setTarget] = useState<{ shift: string; conversation?: string } | null>(null);
  const busy = useRef(false);
  const save = async () => {
    if (busy.current) return;
    busy.current = true;
    setError(null);
    try {
      if (
        !job ||
        !/^\d{4}-\d{2}-\d{2}$/.test(date) ||
        !/^\d+(\.\d{1,2})?$/.test(rate) ||
        !/^\d+$/.test(capacity)
      ) {
        setError('Choose a job, date, hourly rate and whole-number capacity.');
        return;
      }
      await create.mutateAsync({
        job_id: job,
        local_date: date,
        local_start: start,
        local_end: end,
        time_zone: zone,
        capacity: Number(capacity),
        hourly_rate_minor: Math.round(Number(rate) * 100),
      });
      setDate('');
    } catch (e) {
      setError(messageOf(e));
    } finally {
      busy.current = false;
    }
  };
  const run = async () => {
    if (!target || busy.current) return;
    busy.current = true;
    setError(null);
    try {
      if (target.conversation)
        await offer.mutateAsync({ shift: target.shift, conversation: target.conversation });
      else await cancel.mutateAsync({ shift: target.shift, reason });
      setTarget(null);
    } catch (e) {
      setError(messageOf(e));
      setTarget(null);
    } finally {
      busy.current = false;
    }
  };
  return (
    <Screen>
      <Text variant="display" accessibilityRole="header">
        The right people, on time.
      </Text>
      <Notice
        title="A clear offer comes first"
        body="Choose a published hourly-pay job, set a specific time and rate, then offer it to someone in an accepted temporary-work conversation. A place is booked only when they accept."
      />
      <Button
        title="Refresh shifts and hours"
        variant="secondary"
        loading={shifts.isRefetching || bookings.isRefetching}
        onPress={() => {
          void shifts.refetch();
          void bookings.refetch();
          void jobs.refetch();
          void threads.refetch();
        }}
      />
      {write ? (
        <Card>
          <Text variant="heading">Create a shift</Text>
          {jobs.isError ? (
            <ErrorState message={messageOf(jobs.error)} onRetry={() => void jobs.refetch()} />
          ) : (
            <Row>
              {jobs.data
                ?.filter((j) => j.status === 'published' && j.pay_period === 'hour')
                .map((j) => (
                  <Chip
                    key={j.id}
                    label={j.title}
                    selected={job === j.id}
                    onPress={() => setJob(j.id)}
                  />
                ))}
            </Row>
          )}
          <Field
            label="Shift date (YYYY-MM-DD)"
            value={date}
            onChangeText={setDate}
            maxLength={10}
          />
          <Field label="Local start (HH:MM)" value={start} onChangeText={setStart} maxLength={5} />
          <Field label="Local end (HH:MM)" value={end} onChangeText={setEnd} maxLength={5} />
          <Field label="Venue time zone" value={zone} onChangeText={setZone} />
          <Field
            label="Places (1–50)"
            value={capacity}
            onChangeText={setCapacity}
            keyboardType="number-pad"
          />
          <Field
            label="Hourly rate (AUD, within job range)"
            value={rate}
            onChangeText={setRate}
            keyboardType="decimal-pad"
          />
          <Button title="Create shift" loading={create.isPending} onPress={() => void save()} />
        </Card>
      ) : null}
      {error ? <Text accessibilityRole="alert">{error}</Text> : null}
      {shifts.isPending ? (
        <ListSkeleton count={2} />
      ) : shifts.isError ? (
        <ErrorState message={messageOf(shifts.error)} onRetry={() => void shifts.refetch()} />
      ) : !shifts.data.length ? (
        <EmptyState
          title="No shifts yet"
          body="Create one with a published job and clear hourly pay."
        />
      ) : (
        shifts.data.map((s) => (
          <Card key={s.id}>
            <ShiftDetails shift={s} />
            <Text>
              {s.status} ·{' '}
              {bookings.data?.filter((b) => b.shift.id === s.id && b.status === 'confirmed')
                .length ?? '—'}{' '}
              / {s.capacity} confirmed
            </Text>
            {write && s.status === 'open' && new Date(s.starts_at).getTime() > Date.now() ? (
              <>
                {threads.isError ? (
                  <ErrorState
                    message={messageOf(threads.error)}
                    onRetry={() => void threads.refetch()}
                  />
                ) : (
                  threads.data
                    ?.filter((c) => c.job_id === s.job_id && c.status === 'open')
                    .map((c) => (
                      <Button
                        key={c.id}
                        title={`Offer to ${c.counterpart}`}
                        variant="secondary"
                        onPress={() => setTarget({ shift: s.id, conversation: c.id })}
                      />
                    ))
                )}
                <Field
                  label={`Cancellation reason for ${s.title}`}
                  value={reason}
                  onChangeText={setReason}
                  maxLength={1000}
                />
                <Button
                  title="Cancel shift"
                  variant="danger"
                  onPress={() => {
                    if (reason.trim().length < 3) setError('Add a short cancellation reason.');
                    else setTarget({ shift: s.id });
                  }}
                />
              </>
            ) : null}
          </Card>
        ))
      )}
      <Text variant="heading">Offers and timesheets</Text>
      {bookings.isError ? (
        <ErrorState message={messageOf(bookings.error)} onRetry={() => void bookings.refetch()} />
      ) : (
        bookings.data?.map((b) => <Review key={b.id} booking={b} editable={write} />)
      )}
      <ConfirmSheet
        visible={!!target}
        title={target?.conversation ? 'Send this shift offer?' : 'Cancel this shift?'}
        body={
          target?.conversation
            ? 'The worker will review the displayed shift time and pay before accepting. Offers do not reserve capacity.'
            : 'All offers and confirmed bookings will be cancelled. Calendar commitments will be released.'
        }
        confirmLabel={target?.conversation ? 'Send offer' : 'Cancel shift'}
        onConfirm={() => void run()}
        onCancel={() => setTarget(null)}
      />
    </Screen>
  );
}
function Review({ booking: b, editable }: { booking: Schemas['BookingOut']; editable: boolean }) {
  const review = useReviewTimesheet();
  const { employerId } = useHireWorkspace();
  const [reason, setReason] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [decision, setDecision] = useState<'approved' | 'disputed' | null>(null);
  const busy = useRef(false);
  const run = async () => {
    if (!decision || !b.timesheet || busy.current) return;
    busy.current = true;
    setError(null);
    try {
      await review.mutateAsync({
        booking: b.id,
        body: { decision, reason, expected_version: b.timesheet.version },
      });
      setDecision(null);
    } catch (e) {
      setError(messageOf(e));
      setDecision(null);
    } finally {
      busy.current = false;
    }
  };
  const choose = (d: 'approved' | 'disputed') => {
    if (reason.trim().length < 3) setError('Add a review note first.');
    else setDecision(d);
  };
  return (
    <Card>
      <Text variant="label">
        {b.candidate_label} · {b.status}
      </Text>
      <Text>{b.shift.title}</Text>
      {b.status === 'confirmed' && new Date(b.shift.starts_at).getTime() <= Date.now() ? (
        <EmployerAttendance booking={b} editable={editable} />
      ) : null}
      <BookingHistory booking={b} employerId={employerId} />
      {b.timesheet ? <TimesheetDetails sheet={b.timesheet} /> : null}
      {editable && b.timesheet?.status === 'submitted' ? (
        <>
          <Field
            label={`Hours review note for ${b.candidate_label}`}
            value={reason}
            onChangeText={setReason}
            maxLength={1000}
          />
          <Row>
            <Button title="Approve hours" onPress={() => choose('approved')} />
            <Button title="Dispute hours" variant="secondary" onPress={() => choose('disputed')} />
          </Row>
        </>
      ) : null}
      {error ? <Text accessibilityRole="alert">{error}</Text> : null}
      <ConfirmSheet
        visible={!!decision}
        title={decision === 'approved' ? 'Approve these hours?' : 'Dispute these hours?'}
        body="This records your hours review and does not process wages. The worker can see the review note."
        confirmLabel="Confirm review"
        onConfirm={() => void run()}
        onCancel={() => setDecision(null)}
      />
    </Card>
  );
}
