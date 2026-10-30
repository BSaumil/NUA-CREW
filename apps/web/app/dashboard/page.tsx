import { WorkspaceSteps, WorkspaceTask, ButtonLink } from '@nua-crew/ui';
import { api, requireCandidate } from '@/lib/api';
export default async function Dashboard() {
  await requireCandidate();
  const client = await api();
  const [profile, applications, bookings, notifications, documents] = await Promise.all([
    client.GET('/v1/candidate/profile'),
    client.GET('/v1/candidate/applications'),
    client.GET('/v1/candidate/shift-bookings'),
    client.GET('/v1/notifications'),
    client.GET('/v1/candidate/documents'),
  ]);
  const future = bookings.data
    ?.filter((b) => b.status === 'confirmed' && new Date(b.shift.ends_at).getTime() > Date.now())
    .sort((a, b) => a.shift.starts_at.localeCompare(b.shift.starts_at));
  const next = future?.[0];
  return (
    <div className="nua-stack">
      <p className="nua-badge">Your workspace · Free across Australia</p>
      <h1>Your next step, clearly.</h1>
      <p>
        {profile.data?.full_name ? `Welcome, ${profile.data.full_name}. ` : ''}Keep your work,
        documents and updates in one place.
      </p>
      {[profile, applications, bookings, notifications, documents].some((r) => r.error) ? (
        <p role="alert">
          Some information could not be loaded. Unavailable counts show —.{' '}
          <a href="/dashboard">Try again</a>.
        </p>
      ) : null}
      {next ? (
        <section className="nua-card">
          <h2>Next confirmed shift</h2>
          <p>
            <strong>{next.shift.title}</strong>
          </p>
          <p>
            {new Intl.DateTimeFormat('en-AU', {
              dateStyle: 'medium',
              timeStyle: 'short',
              timeZone: next.shift.time_zone,
            }).format(new Date(next.shift.starts_at))}{' '}
            · {next.shift.time_zone}
          </p>
          <ButtonLink href="/shifts">View shift and attendance</ButtonLink>
        </section>
      ) : null}
      <div className="nua-grid">
        <WorkspaceSteps title="What needs your attention">
          <WorkspaceTask
            href="/shifts"
            title="Shift offers"
            detail="Review the time and pay before accepting."
            count={
              bookings.data
                ? bookings.data.filter(
                    (b) => b.status === 'offered' && new Date(b.expires_at).getTime() > Date.now(),
                  ).length
                : null
            }
          />
          <WorkspaceTask
            href="/applications"
            title="Your applications"
            detail="Follow each employer’s response."
            count={applications.data?.length ?? null}
          />
          <WorkspaceTask
            href="/notifications"
            title="Unread updates"
            detail="Application, shift and hours updates."
            count={notifications.data ? notifications.data.filter((n) => !n.read_at).length : null}
          />
        </WorkspaceSteps>
        <WorkspaceSteps title="Ready for the next opportunity">
          <WorkspaceTask
            href="/profile"
            title="Profile and preferences"
            detail={
              profile.data?.headline
                ? 'Review your skills and work preferences.'
                : 'Add a headline so employers understand your experience.'
            }
          />
          <WorkspaceTask
            href="/documents"
            title="Private document wallet"
            detail="Share only the files you choose with each application."
            count={
              documents.data ? documents.data.filter((d) => d.status === 'ready').length : null
            }
          />
          <WorkspaceTask
            href="/jobs"
            title="Find work"
            detail="Search roles with clear location and pay details."
          />
        </WorkspaceSteps>
      </div>
    </div>
  );
}
