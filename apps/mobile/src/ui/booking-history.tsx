import { useState } from 'react';
import type { Schemas } from '@nua-crew/contracts';
import { useTimesheetHistory } from '@/api/shifts';
import { messageOf } from '@/api/client';
import { Button, Card, ErrorState, Text } from '@/ui';

/** History reads are private, loaded only on request and never persisted offline. */
export function BookingHistory({
  booking: b,
  employerId = null,
}: {
  booking: Schemas['BookingOut'];
  employerId?: string | null;
}) {
  const [open, setOpen] = useState(false);
  const query = useTimesheetHistory(b.id, employerId, open);
  const format = (value: string) =>
    new Intl.DateTimeFormat('en-AU', {
      dateStyle: 'medium',
      timeStyle: 'short',
      timeZone: b.shift.time_zone,
    }).format(new Date(value));
  return (
    <Card>
      <Text variant="heading" accessibilityRole="header">
        Attendance and hours history
      </Text>
      <Text variant="caption" muted>
        {b.shift.time_zone}
      </Text>
      {!employerId && b.attendance?.status === 'no_show' ? (
        <Text accessibilityRole="alert">
          The business marked this shift as a no-show. Ask for a check-in correction if this is
          wrong. The business must review it before hours can be submitted.
        </Text>
      ) : null}
      <Button
        title={open ? 'Hide hours history' : 'View hours history'}
        variant="secondary"
        onPress={() => setOpen((v) => !v)}
      />
      {open ? (
        query.isPending ? (
          <Text>Loading history…</Text>
        ) : query.isError ? (
          <ErrorState message={messageOf(query.error)} onRetry={() => void query.refetch()} />
        ) : query.data.length ? (
          query.data.map((v) => (
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
      {b.attendance?.events.length ? (
        <>
          <Text variant="label">Attendance record</Text>
          {b.attendance.events.map((e) => (
            <Text key={e.id} variant="caption">
              {e.kind.replaceAll('_', ' ')} · {format(e.recorded_at)}
              {e.note ? ` · ${e.note}` : ''}
            </Text>
          ))}
        </>
      ) : null}
    </Card>
  );
}
