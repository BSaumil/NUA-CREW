import type { ReactNode } from 'react';

/** An accessible task list: illustration is decorative; every action has a visible label. */
export function WorkspaceSteps({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="nua-card nua-stack">
      <div className="nua-row">
        <svg width="48" height="48" viewBox="0 0 48 48" fill="none" aria-hidden="true">
          <rect x="9" y="5" width="30" height="38" rx="7" stroke="currentColor" strokeWidth="2" />
          <path
            d="m16 17 3 3 5-6M27 18h6M16 29l3 3 5-6M27 30h6"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
        <h2>{title}</h2>
      </div>
      <ul className="nua-task-list">{children}</ul>
    </section>
  );
}
export function WorkspaceTask({
  href,
  title,
  detail,
  count,
}: {
  href: string;
  title: string;
  detail: string;
  count?: number | null;
}) {
  return (
    <li>
      <a href={href}>
        <span>
          <strong>{title}</strong>
          <span className="nua-hint">{detail}</span>
        </span>
        {count !== undefined ? (
          <span
            className="nua-task-count"
            aria-label={count === null ? 'Unavailable' : `${count} items`}
          >
            {count ?? '—'}
          </span>
        ) : (
          <span aria-hidden="true">↗</span>
        )}
      </a>
    </li>
  );
}
export function NotificationList({
  items,
  hrefFor,
  markRead,
  markAllRead,
}: {
  items: {
    id: string;
    kind: string;
    title: string;
    body?: string | null;
    created_at: string;
    read_at?: string | null;
    data: Record<string, unknown>;
  }[];
  hrefFor: (kind: string, data: Record<string, unknown>) => string;
  markRead: (form: FormData) => void | Promise<void>;
  markAllRead: () => void | Promise<void>;
}) {
  return (
    <div className="nua-stack">
      {items.some((n) => !n.read_at) ? (
        <form action={markAllRead}>
          <button className="nua-button nua-button--secondary">Mark all read</button>
        </form>
      ) : null}
      {items.length === 0 ? (
        <p>You're up to date. New updates will appear here.</p>
      ) : (
        <ul className="nua-notifications">
          {items.map((n) => (
            <li className="nua-card nua-stack" key={n.id}>
              <h2>
                {!n.read_at ? <span className="nua-badge">Unread</span> : null} {n.title}
              </h2>
              {n.body ? <p>{n.body}</p> : null}
              <time dateTime={n.created_at}>
                {new Intl.DateTimeFormat('en-AU', {
                  dateStyle: 'medium',
                  timeStyle: 'short',
                  timeZone: 'Australia/Melbourne',
                }).format(new Date(n.created_at))}{' '}
                · Melbourne time
              </time>
              <div className="nua-row">
                <a href={hrefFor(n.kind, n.data)}>
                  {['/', '/dashboard'].includes(hrefFor(n.kind, n.data))
                    ? 'Open your workspace'
                    : 'View update'}
                </a>
                {hrefFor(n.kind, n.data) === '/dashboard' &&
                ['invitation_received', 'message_received'].includes(n.kind) ? (
                  <span className="nua-hint">
                    Use the mobile app to respond to invitations and messages.
                  </span>
                ) : null}
                {!n.read_at ? (
                  <form action={markRead}>
                    <input type="hidden" name="id" value={n.id} />
                    <button className="nua-button nua-button--secondary">Mark read</button>
                  </form>
                ) : null}
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
/** Fixed local routes only. Notification payloads never supply arbitrary redirect URLs. */
export function notificationHref(
  kind: string,
  data: Record<string, unknown>,
  employer = false,
): string {
  const id = (key: string) =>
    typeof data[key] === 'string' && /^[a-zA-Z0-9-]+$/.test(data[key] as string)
      ? encodeURIComponent(data[key] as string)
      : null;
  if (kind.startsWith('shift.') || kind.startsWith('attendance.') || kind.startsWith('timesheet.'))
    return '/shifts';
  if (kind.startsWith('application.') && id('application_id'))
    return `/applications/${id('application_id')}`;
  if (employer) {
    if (kind === 'message_received' && id('conversation_id'))
      return `/messages/${id('conversation_id')}`;
    if (kind.startsWith('invitation')) return '/invitations';
    return '/';
  }
  return '/dashboard';
}
