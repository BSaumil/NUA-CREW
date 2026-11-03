import { NotificationList, notificationHref } from '@nua-crew/ui';
import { api, requireCandidate } from '@/lib/api';
import { markRead, markAllRead } from './actions';
export default async function Notifications({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  await requireCandidate();
  const [r, p] = await Promise.all([(await api()).GET('/v1/notifications'), searchParams]);
  return (
    <div className="nua-stack">
      <h1>Notifications</h1>
      <p>Your updates stay here even when push notifications are off.</p>
      {p.error ? <p role="alert">{p.error}</p> : null}
      {r.error ? (
        <p role="alert">
          We couldn’t load your updates. <a href="/notifications">Try again</a>.
        </p>
      ) : (
        <NotificationList
          items={r.data ?? []}
          hrefFor={(kind, data) => notificationHref(kind, data, false)}
          markRead={markRead}
          markAllRead={markAllRead}
        />
      )}
    </div>
  );
}
