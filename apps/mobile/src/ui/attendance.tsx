import { useRef, useState } from 'react';
import type { Schemas } from '@nua-crew/contracts';
import { useCandidateAttendance, useReviewCorrection, useTimesheetHistory } from '@/api/shifts';
import { messageOf } from '@/api/client';
import { localParts } from '@/features/scheduling';
import { Button, Card, Chip, ConfirmSheet, ErrorState, Field, Row, Text } from '@/ui';

export function Attendance({
  booking: b,
  employerId = null,
  editable = true,
}: {
  booking: Schemas['BookingOut'];
  employerId?: string | null;
  editable?: boolean;
}) {
  const [history, setHistory] = useState(false);
  const [correction, setCorrection] = useState(false);
  const [kind, setKind] = useState<'check_in' | 'check_out'>('check_in');
  const initial = localParts(b.shift.starts_at, b.shift.time_zone);
  const [date, setDate] = useState(initial.date);
  const [time, setTime] = useState(initial.time);
  const [reason, setReason] = useState('');
  const [target, setTarget] = useState<'check-in' | 'check-out' | 'correction' | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState('');
  const historyQuery = useTimesheetHistory(b.id, employerId, history);
  const action = useCandidateAttendance();
  const lock = useRef(false);
  const run = async () => {
    if (!target || lock.current) return;
    lock.current = true;
    setError(null);
    try {
      await action.mutateAsync({
        booking: b.id,
        action: target,
        body:
          target === 'correction'
            ? { claim_kind: kind, local_date: date, local_time: time, reason: reason.trim() }
            : undefined,
      });
      setNotice(target === 'correction' ? 'Correction sent for review.' : 'Attendance recorded.');
      setTarget(null);
      setCorrection(false);
    } catch (e) {
      setError(messageOf(e));
      setTarget(null);
    } finally {
      lock.current = false;
    }
  };
  const state = b.attendance;
  const format = (v: string) =>
    new Intl.DateTimeFormat('en-AU', {
      dateStyle: 'medium',
      timeStyle: 'short',
      timeZone: b.shift.time_zone,
    }).format(new Date(v));
  const pending =
    state?.events.filter(
      (e) =>
        e.kind === 'correction_requested' &&
        !state.events.some(
          (d) =>
            d.ref_event_id === e.id &&
            ['correction_approved', 'correction_rejected'].includes(d.kind),
        ),
    ) ?? [];
  const active = b.status === 'confirmed' && b.shift.status === 'open';
  return (
    <Card>
      <Text variant="heading" accessibilityRole="header">
        Attendance and hours history
      </Text>
      <Text>
        {state?.status.replaceAll('_', ' ') ?? 'Not recorded'} · {b.shift.time_zone}
      </Text>
      {state?.check_in_at ? <Text>In: {format(state.check_in_at)}</Text> : null}
      {state?.check_out_at ? <Text>Out: {format(state.check_out_at)}</Text> : null}
      {state?.status === 'no_show' ? (
        <Text accessibilityRole="alert">
          The business marked this shift as a no-show. If this is wrong, request a check-in
          correction. The business must review it before hours can be submitted.
        </Text>
      ) : null}
      {notice ? <Text accessibilityLiveRegion="polite">{notice}</Text> : null}
      {error ? <Text accessibilityRole="alert">{error}</Text> : null}
      {!employerId && active ? (
        <>
          <Row>
            {state?.status === 'not_started' ? (
              <Button
                title="Check in"
                loading={action.isPending}
                onPress={() => setTarget('check-in')}
              />
            ) : null}
            {state?.status === 'checked_in' ? (
              <Button
                title="Check out"
                loading={action.isPending}
                onPress={() => setTarget('check-out')}
              />
            ) : null}
            <Button
              title={correction ? 'Hide correction form' : 'Request attendance correction'}
              variant="secondary"
              onPress={() => setCorrection((v) => !v)}
            />
          </Row>
          {correction ? (
            <>
              <Text muted>
                Use the venue’s local date and time. Repeated or skipped daylight-saving times need
                support review.
              </Text>
              <Row>
                <Chip
                  label="Check-in time"
                  selected={kind === 'check_in'}
                  onPress={() => setKind('check_in')}
                />
                <Chip
                  label="Check-out time"
                  selected={kind === 'check_out'}
                  onPress={() => setKind('check_out')}
                />
              </Row>
              <Field label="Correction date (YYYY-MM-DD)" value={date} onChangeText={setDate} />
              <Field label="Correction time (HH:MM)" value={time} onChangeText={setTime} />
              <Field
                label="Correction reason"
                value={reason}
                onChangeText={setReason}
                maxLength={1000}
              />
              <Button
                title="Send correction for review"
                onPress={() => {
                  if (reason.trim().length < 3) setError('Add a short reason first.');
                  else setTarget('correction');
                }}
              />
            </>
          ) : null}
        </>
      ) : null}
      {employerId && editable && active
        ? pending.map((e) => (
            <CorrectionReview key={e.id} booking={b.id} event={e} zone={b.shift.time_zone} />
          ))
        : null}
      <Button
        title={history ? 'Hide hours history' : 'View hours history'}
        variant="secondary"
        onPress={() => {
          setHistory((v) => !v);
        }}
      />
      {history ? (
        historyQuery.isPending ? (
          <Text>Loading history…</Text>
        ) : historyQuery.isError ? (
          <ErrorState
            message={messageOf(historyQuery.error)}
            onRetry={() => void historyQuery.refetch()}
          />
        ) : historyQuery.data.length ? (
          historyQuery.data.map((v) => (
            <Card key={v.version}>
              <Text variant="label">
                Version {v.version} · {v.status}
              </Text>
              <Text>
                {format(v.starts_at)} – {format(v.ends_at)} · {b.shift.time_zone}
              </Text>
              <Text>
                {v.worked_minutes} worked minutes · {v.break_minutes} unpaid break minutes
              </Text>
              <Text variant="caption" muted>
                Recorded {format(v.recorded_at)}
              </Text>
              {v.note ? <Text>{v.note}</Text> : null}
              {v.review_note ? <Text>{v.review_note}</Text> : null}
            </Card>
          ))
        ) : (
          <Text>No hours submitted yet.</Text>
        )
      ) : null}
      {state?.events.length ? (
        <>
          <Text variant="label">Attendance record</Text>
          {state.events.map((e) => (
            <Text key={e.id} variant="caption">
              {e.kind.replaceAll('_', ' ')} · {format(e.recorded_at)}
              {e.note ? ` · ${e.note}` : ''}
            </Text>
          ))}
        </>
      ) : null}
      <ConfirmSheet
        visible={!!target}
        title={
          target === 'correction'
            ? 'Send this correction?'
            : target === 'check-in'
              ? 'Check in now?'
              : 'Check out now?'
        }
        body={
          target === 'correction'
            ? 'The business will see your reason and review the time you entered. The original record stays in history.'
            : 'NUA CREW records the current server time. Use a correction if the recorded time is wrong.'
        }
        confirmLabel="Confirm attendance"
        onConfirm={() => void run()}
        onCancel={() => setTarget(null)}
      />
    </Card>
  );
}
function CorrectionReview({
  booking,
  event,
  zone,
}: {
  booking: string;
  event: Schemas['AttendanceEventOut'];
  zone: string;
}) {
  const review = useReviewCorrection();
  const lock = useRef(false);
  const [reason, setReason] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [decision, setDecision] = useState<'approved' | 'rejected' | null>(null);
  const run = async () => {
    if (!decision || lock.current) return;
    lock.current = true;
    try {
      await review.mutateAsync({
        booking,
        event: event.id,
        body: { decision, reason: reason.trim() },
      });
      setDecision(null);
    } catch (e) {
      setError(messageOf(e));
      setDecision(null);
    } finally {
      lock.current = false;
    }
  };
  return (
    <Card>
      <Text variant="label">Correction waiting: {event.claim_kind?.replaceAll('_', ' ')}</Text>
      {event.claimed_at ? (
        <Text>
          {new Intl.DateTimeFormat('en-AU', {
            dateStyle: 'medium',
            timeStyle: 'short',
            timeZone: zone,
          }).format(new Date(event.claimed_at))}{' '}
          · {zone}
        </Text>
      ) : null}
      <Text>{event.note}</Text>
      <Field
        label="Attendance review reason"
        value={reason}
        onChangeText={setReason}
        maxLength={1000}
      />
      {error ? <Text accessibilityRole="alert">{error}</Text> : null}
      <Row>
        {(['approved', 'rejected'] as const).map((d) => (
          <Button
            key={d}
            title={d === 'approved' ? 'Approve correction' : 'Reject correction'}
            variant="secondary"
            loading={review.isPending}
            onPress={() => {
              if (reason.trim().length < 3) setError('Add a review reason first.');
              else setDecision(d);
            }}
          />
        ))}
      </Row>
      <ConfirmSheet
        visible={!!decision}
        title="Review this attendance correction?"
        body="Your decision and reason are visible to the worker and retained in history."
        confirmLabel="Confirm review"
        onConfirm={() => void run()}
        onCancel={() => setDecision(null)}
      />
    </Card>
  );
}
