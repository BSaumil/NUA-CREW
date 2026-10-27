import Link from 'next/link';
import { Button } from '@nua-crew/ui';
import { api, errorMessage, requireAdmin } from '@/lib/api';
import { Flash, flashFrom } from '../components';
import { reviewEmployer, reviewReport } from './actions';

export default async function AdminPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  await requireAdmin();
  const { error, notice, p } = await flashFrom(searchParams);
  const offset = Math.max(0, Number.isSafeInteger(Number(p.offset)) ? Number(p.offset) : 0);
  const reviewStatus = ['unverified', 'pending', 'verified', 'rejected'].includes(
    String(p.review_status),
  )
    ? String(p.review_status)
    : 'unverified';
  const client = await api();
  const [reports, employers] = await Promise.all([
    client.GET('/v1/admin/message-reports', { params: { query: { limit: 20, offset } } }),
    client.GET('/v1/admin/employers', { params: { query: { status: reviewStatus } } }),
  ]);
  return (
    <div className="nua-stack">
      <h1>Support and verification</h1>
      <Flash error={error} notice={notice} />
      <p>
        Operator access only. Report views and decisions are audited. Only the reported excerpt is
        shown.
      </p>
      <section className="nua-stack" aria-labelledby="reports-title">
        <h2 id="reports-title">Open message reports</h2>
        {!reports.response.ok ? <Flash error={errorMessage(reports.error)} /> : null}
        {reports.data?.length === 0 ? <p>No open reports on this page.</p> : null}
        {reports.data?.map((report) => (
          <article className="nua-card" key={report.id}>
            <h3>Report {report.id}</h3>
            <p>
              Received{' '}
              {new Date(report.created_at).toLocaleString('en-AU', {
                timeZone: 'Australia/Melbourne',
              })}{' '}
              (Melbourne)
            </p>
            <p>
              <strong>Reason:</strong> {report.reason}
            </p>
            <blockquote style={{ whiteSpace: 'pre-wrap', overflowWrap: 'anywhere' }}>
              {report.excerpt ?? 'No message excerpt was supplied.'}
            </blockquote>
            <form action={reviewReport} className="nua-stack">
              <input type="hidden" name="report_id" value={report.id} />
              <label htmlFor={`outcome-${report.id}`}>Review outcome</label>
              <select id={`outcome-${report.id}`} name="outcome" required defaultValue="">
                <option value="" disabled>
                  Choose an outcome
                </option>
                <option value="resolved">Resolve without changing conversation access</option>
                <option value="dismissed">Dismiss after review</option>
                <option value="close_conversation" disabled={!report.conversation_id}>
                  Close conversation and prevent further messages
                </option>
              </select>
              <label htmlFor={`reason-${report.id}`}>Decision reason</label>
              <select id={`reason-${report.id}`} name="reason_code" required defaultValue="">
                <option value="" disabled>
                  Choose a reason
                </option>
                <option value="harassment">Harassment</option>
                <option value="spam">Spam</option>
                <option value="scam">Suspected scam</option>
                <option value="other">Other</option>
                <option value="no_violation">No violation found</option>
              </select>
              <label>
                <input name="confirm" type="checkbox" required /> I reviewed the excerpt and confirm
                this decision.
              </label>
              <Button type="submit">Record review</Button>
            </form>
          </article>
        ))}
        <nav aria-label="Report pages" className="nua-row">
          {offset > 0 ? (
            <Link href={`/admin?offset=${Math.max(0, offset - 20)}`}>Previous reports</Link>
          ) : null}
          {reports.data?.length === 20 ? (
            <Link href={`/admin?offset=${offset + 20}`}>Next reports</Link>
          ) : null}
        </nav>
      </section>
      <section className="nua-stack" aria-labelledby="verification-title">
        <h2 id="verification-title">Business verification</h2>
        <form method="get" className="nua-row">
          <label htmlFor="review-status">Review queue</label>
          <select id="review-status" name="review_status" defaultValue={reviewStatus}>
            <option value="unverified">Unverified</option>
            <option value="pending">Pending</option>
            <option value="verified">Verified</option>
            <option value="rejected">Rejected</option>
          </select>
          <Button type="submit">Show businesses</Button>
        </form>
        {!employers.response.ok ? <Flash error={errorMessage(employers.error)} /> : null}
        {employers.data?.length === 0 ? <p>No businesses in this review queue.</p> : null}
        {employers.data?.map((employer) => (
          <article className="nua-card" key={employer.id}>
            <h3>{employer.name}</h3>
            <p>ABN: {employer.abn ?? 'Not supplied'}</p>
            <p>An ABN checksum alone does not verify the business or its representative.</p>
            <form action={reviewEmployer} className="nua-stack">
              <input name="employer_id" type="hidden" value={employer.id} />
              <label htmlFor={`status-${employer.id}`}>Verification decision</label>
              <select id={`status-${employer.id}`} name="status" required defaultValue="">
                <option value="" disabled>
                  Choose a decision
                </option>
                <option value="verified">Verified after evidence review</option>
                <option value="rejected">Rejected / revoke verification</option>
                <option value="pending">Keep pending</option>
              </select>
              <label htmlFor={`evidence-${employer.id}`}>Evidence reference and review notes</label>
              <textarea
                id={`evidence-${employer.id}`}
                name="evidence"
                required
                minLength={10}
                maxLength={2000}
              />
              <label>
                <input name="confirm" type="checkbox" required /> I reviewed the evidence and
                authorised representative.
              </label>
              <Button type="submit">Record business review</Button>
            </form>
          </article>
        ))}
      </section>
    </div>
  );
}
