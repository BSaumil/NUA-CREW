import type { Schemas } from '@nua-crew/contracts';
import { Card, Text } from './primitives';

export function ShiftDetails({ shift }: { shift: Schemas['ShiftOut'] }) {
  const format = (value: string) =>
    new Intl.DateTimeFormat('en-AU', {
      timeZone: shift.time_zone,
      weekday: 'short',
      day: 'numeric',
      month: 'short',
      hour: 'numeric',
      minute: '2-digit',
    }).format(new Date(value));
  return (
    <>
      <Text variant="heading">{shift.title}</Text>
      <Text>
        {format(shift.starts_at)} – {format(shift.ends_at)}
      </Text>
      <Text variant="caption" muted>
        {shift.time_zone}
      </Text>
      <Text variant="label">
        A${(shift.hourly_rate_minor / 100).toFixed(2)} / hour ·{' '}
        {shift.super_included ? 'including super' : 'plus super'}
      </Text>
    </>
  );
}
export function TimesheetDetails({ sheet }: { sheet: Schemas['TimesheetOut'] }) {
  return (
    <Card>
      <Text variant="label">Timesheet · {sheet.status}</Text>
      <Text>
        {sheet.worked_minutes} worked minutes · {sheet.break_minutes} break minutes
      </Text>
      {sheet.review_note ? <Text>{sheet.review_note}</Text> : null}
      <Text variant="caption" muted>
        Hours review records agreement about time. It does not process wages.
      </Text>
    </Card>
  );
}
