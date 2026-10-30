import { useRef, useState } from 'react';
import type { Schemas } from '@nua-crew/contracts';
import { messageOf } from '@/api/client';
import {
  useCheckIn,
  useCheckOut,
  useNoShow,
  useRequestCorrection,
  useReviewCorrection,
} from '@/api/shifts';
import {
  attendanceLine,
  canCheckIn,
  canCheckOut,
  canMarkNoShow,
  checkInState,
  clock,
  correctionBody,
  type CorrectionKind,
} from '@/features/attendance';
import { localParts } from '@/features/scheduling';
import { Button, Card, ConfirmSheet, Field, Row, Text } from '@/ui';

type Booking = Schemas['BookingOut'];

/** The worker's side: check in and out at the venue, or ask for a correction. */
export function CandidateAttendance({ booking: b }: { booking: Booking }) {
  const checkIn = useCheckIn();
  const checkOut = useCheckOut();
  const [error, setError] = useState<string | null>(null);
  const [fixing, setFixing] = useState(false);
  const busy = useRef(false);
  const now = Date.now();
  const state = checkInState(b.shift, b.attendance, now);
  const act = async (run: () => Promise<unknown>) => {
    if (busy.current) return;
    busy.current = true;
    setError(null);
    try {
      await run();
    } catch (e) {
      setError(messageOf(e));
    } finally {
      busy.current = false;
    }
  };
  return (
    <Card>
      <Text variant="heading" accessibilityRole="header">
        Attendance
      </Text>
      <Text>{attendanceLine(b.attendance, b.shift.time_zone)}</Text>
      {state === 'too_early' ? (
        <Text variant="caption" muted>
          Check in opens one hour before the shift starts.
        </Text>
      ) : null}
      {b.attendance?.pending_corrections ? (
        <Text variant="caption" muted>
          {b.attendance.pending_corrections} correction waiting for the business to review.
        </Text>
      ) : null}
      {canCheckIn(b.shift, b.attendance, now) ? (
        <Button
          title="Check in"
          accessibilityLabel={`Check in to ${b.shift.title}`}
          loading={checkIn.isPending}
          onPress={() => void act(() => checkIn.mutateAsync({ booking: b.id }))}
        />
      ) : null}
      {canCheckOut(b.shift, b.attendance, now) ? (
        <Button
          title="Check out"
          accessibilityLabel={`Check out of ${b.shift.title}`}
          loading={checkOut.isPending}
          onPress={() => void act(() => checkOut.mutateAsync({ booking: b.id }))}
        />
      ) : null}
      {error ? <Text accessibilityRole="alert">{error}</Text> : null}
      <Text variant="caption" muted>
        Times come from our server clock, not your phone. Forgot or missed one? Ask for a
        correction; the business decides.
      </Text>
      {fixing ? (
        <Correction booking={b} onDone={() => setFixing(false)} />
      ) : (
        <Button title="Ask for a correction" variant="secondary" onPress={() => setFixing(true)} />
      )}
    </Card>
  );
}

function Correction({ booking: b, onDone }: { booking: Booking; onDone: () => void }) {
  const request = useRequestCorrection();
  const start = localParts(b.shift.starts_at, b.shift.time_zone);
  const [kind, setKind] = useState<CorrectionKind>('check_in');
  const [date, setDate] = useState(start.date);
  const [time, setTime] = useState(start.time);
  const [reason, setReason] = useState('');
  const [error, setError] = useState<string | null>(null);
  const busy = useRef(false);
  const send = async () => {
    if (busy.current) return;
    const built = correctionBody(b.shift, { kind, date, time, reason });
    if ('error' in built) {
      setError(built.error);
      return;
    }
    busy.current = true;
    setError(null);
    try {
      await request.mutateAsync({ booking: b.id, body: built.body });
      onDone();
    } catch (e) {
      setError(messageOf(e));
    } finally {
      busy.current = false;
    }
  };
  return (
    <>
      <Row>
        <Button
          title="Check in time"
          variant={kind === 'check_in' ? 'primary' : 'secondary'}
          accessibilityState={{ selected: kind === 'check_in' }}
          onPress={() => setKind('check_in')}
        />
        <Button
          title="Check out time"
          variant={kind === 'check_out' ? 'primary' : 'secondary'}
          accessibilityState={{ selected: kind === 'check_out' }}
          onPress={() => setKind('check_out')}
        />
      </Row>
      <Field label="Date (YYYY-MM-DD)" value={date} onChangeText={setDate} maxLength={10} />
      <Field label="Time at the venue (HH:MM)" value={time} onChangeText={setTime} maxLength={5} />
      <Field label="Why" value={reason} onChangeText={setReason} maxLength={1000} />
      {error ? <Text accessibilityRole="alert">{error}</Text> : null}
      <Button title="Send correction" loading={request.isPending} onPress={() => void send()} />
      <Button title="Never mind" variant="secondary" onPress={onDone} />
    </>
  );
}

/** The business side: see attendance, decide corrections, mark or reverse a no-show. */
export function EmployerAttendance({
  booking: b,
  editable,
}: {
  booking: Booking;
  editable: boolean;
}) {
  const reviewCorrection = useReviewCorrection();
  const noShow = useNoShow();
  const [reason, setReason] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [target, setTarget] = useState<
    | { kind: 'review'; event: string; decision: 'approved' | 'rejected' }
    | { kind: 'no_show'; reverse: boolean }
    | null
  >(null);
  const busy = useRef(false);
  const tz = b.shift.time_zone;
  const now = Date.now();
  const decided = new Set(
    (b.attendance?.events ?? [])
      .filter((e) => e.kind === 'correction_approved' || e.kind === 'correction_rejected')
      .map((e) => e.ref_event_id),
  );
  const pending = (b.attendance?.events ?? []).filter(
    (e) => e.kind === 'correction_requested' && !decided.has(e.id),
  );
  const isNoShow = b.attendance?.status === 'no_show';
  const run = async () => {
    if (!target || busy.current) return;
    busy.current = true;
    setError(null);
    try {
      if (target.kind === 'review') {
        await reviewCorrection.mutateAsync({
          booking: b.id,
          event: target.event,
          body: { decision: target.decision, reason: reason.trim() },
        });
      } else {
        await noShow.mutateAsync({
          booking: b.id,
          reverse: target.reverse,
          body: { reason: reason.trim() },
        });
      }
      setReason('');
    } catch (e) {
      setError(messageOf(e));
    } finally {
      busy.current = false;
      setTarget(null);
    }
  };
  const choose = (next: NonNullable<typeof target>) => {
    if (reason.trim().length < 3) setError('Add a short note first. The worker will see it.');
    else {
      setError(null);
      setTarget(next);
    }
  };
  const showNoShow = editable && (isNoShow || canMarkNoShow(b.shift, b.attendance, now));
  return (
    <Card>
      <Text variant="label">Attendance · {b.candidate_label}</Text>
      <Text>{attendanceLine(b.attendance, tz)}</Text>
      {pending.map((e) => (
        <Card key={e.id}>
          <Text>
            Asks to change {e.claim_kind === 'check_in' ? 'check in' : 'check out'} to{' '}
            {e.claimed_at ? clock(e.claimed_at, tz) : '—'}.
          </Text>
          {e.note ? <Text>“{e.note}”</Text> : null}
          {editable ? (
            <Row>
              <Button
                title="Approve"
                accessibilityLabel={`Approve correction from ${b.candidate_label}`}
                onPress={() => choose({ kind: 'review', event: e.id, decision: 'approved' })}
              />
              <Button
                title="Decline"
                variant="secondary"
                accessibilityLabel={`Decline correction from ${b.candidate_label}`}
                onPress={() => choose({ kind: 'review', event: e.id, decision: 'rejected' })}
              />
            </Row>
          ) : null}
        </Card>
      ))}
      {editable && (pending.length > 0 || showNoShow) ? (
        <Field
          label={`Note to ${b.candidate_label}`}
          value={reason}
          onChangeText={setReason}
          maxLength={1000}
        />
      ) : null}
      {showNoShow ? (
        <Button
          title={isNoShow ? 'Reverse no-show' : 'Mark no-show'}
          variant={isNoShow ? 'secondary' : 'danger'}
          accessibilityLabel={`${isNoShow ? 'Reverse no-show for' : 'Mark no-show for'} ${b.candidate_label}`}
          onPress={() => choose({ kind: 'no_show', reverse: isNoShow })}
        />
      ) : null}
      <Text variant="caption" muted>
        A no-show mark can be contested and reversed. Nothing here charges or pays anyone.
      </Text>
      {error ? <Text accessibilityRole="alert">{error}</Text> : null}
      <ConfirmSheet
        visible={!!target}
        title={
          target?.kind === 'no_show'
            ? target.reverse
              ? 'Reverse this no-show?'
              : 'Mark this as a no-show?'
            : target?.decision === 'approved'
              ? 'Approve this correction?'
              : 'Decline this correction?'
        }
        body="The worker is told your decision and your note. Attendance history is kept and never edited."
        confirmLabel="Confirm"
        onConfirm={() => void run()}
        onCancel={() => setTarget(null)}
      />
    </Card>
  );
}
