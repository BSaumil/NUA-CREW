import type { Metadata } from 'next';
import { randomUUID } from 'node:crypto';
import { Button, ButtonLink, EmptyState } from '@nua-crew/ui';
import { api, requireEmployer } from '@/lib/api';
import { Flash, flashFrom } from '../components';
import { cancelQuote, refundOrder, resumeCheckout, startCheckout } from './actions';

export const metadata: Metadata = { title: 'Advertising and billing' };
const money = (minor: number) =>
  new Intl.NumberFormat('en-AU', { style: 'currency', currency: 'AUD' }).format(minor / 100);
const statusName: Record<string, string> = {
  pending: 'Awaiting payment',
  settled: 'Payment confirmed',
  expired: 'Quote expired',
  refund_required: 'Refund being arranged',
  refunded: 'Refund confirmed',
};

export default async function Billing({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { employerId, role } = await requireEmployer();
  const client = await api();
  const path = { employer_id: employerId };
  const [
    { data: status },
    { data: jobs },
    { data: orders, error: ordersError },
    { data: business },
  ] = await Promise.all([
    client.GET('/v1/billing/status'),
    client.GET('/v1/employers/{employer_id}/jobs', { params: { path } }),
    client.GET('/v1/employers/{employer_id}/billing/orders', { params: { path } }),
    client.GET('/v1/employers/{employer_id}', { params: { path } }),
  ]);
  const { error, notice } = await flashFrom(searchParams);
  const ready = status?.checkout_enabled === true;
  const owner = role === 'owner';
  return (
    <div className="nua-stack">
      <Flash error={error} notice={notice} />
      <header>
        <p className="nua-eyebrow">NUA CREW HIRE · {business?.name ?? 'Your business'}</p>
        <h1>Clear prices. Your next hire.</h1>
        <p>
          Employees join and apply free across Australia. Every advertising purchase is a one-time
          choice, with no automatic renewal.
        </p>
      </header>
      <div className="nua-card nua-stack" role="status">
        <h2>{ready ? 'Stripe sandbox is configured' : 'Payments are not connected yet'}</h2>
        <p>
          {typeof status?.message === 'string'
            ? status.message
            : 'Payment configuration is unavailable. Nothing can be purchased here.'}
        </p>
        <p className="nua-hint">
          Live charging is disabled. Orders are confirmed from verified Stripe events, never from a
          browser return link.
        </p>
      </div>
      <section aria-label="Advertising prices" className="nua-grid">
        {[
          [
            'A$19',
            '14-day advertisement',
            'Publish a reviewed role or renew the same advertisement for another 14 days.',
          ],
          [
            'A$30',
            'Five-day promotion',
            'Add-on placement in the top five of the matching state, suburb and category relevance search.',
          ],
          [
            'A$49',
            'Advertisement + promotion',
            'A new 14-day advertisement with a five-day promoted placement.',
          ],
        ].map(([price, title, copy]) => (
          <article key={title} className="nua-card nua-stack">
            <span className="nua-badge">One-time purchase</span>
            <h2>{title}</h2>
            <strong style={{ fontSize: '2rem' }}>{price}</strong>
            <p>{copy}</p>
          </article>
        ))}
      </section>
      <section className="nua-card nua-stack" aria-labelledby="checkout-heading">
        <h2 id="checkout-heading">Choose the role. Review the purchase.</h2>
        <p>
          Promotion is reserved before checkout. If all five local-category placements are booked,
          no checkout opens. A repeat promotion queues after existing coverage; the advertisement
          must cover all five days. Other search filters and user-selected sorts still apply.
        </p>
        {!owner ? (
          <p>Only a business owner can start checkout or request a refund.</p>
        ) : !jobs?.filter((j) => j.status !== 'closed').length ? (
          <EmptyState
            title="Start with a job draft"
            description="Add the role, venue and disclosed pay before advertising."
          />
        ) : (
          <form action={startCheckout} className="nua-stack">
            <input type="hidden" name="client_key" value={randomUUID()} />
            <label htmlFor="billing-job">Job advertisement</label>
            <select id="billing-job" name="job_id" required disabled={!ready}>
              {jobs
                ?.filter((j) => j.status !== 'closed')
                .map((j) => (
                  <option key={j.id} value={j.id}>
                    {j.title} · {j.suburb ?? 'Location needed'} · {j.status}
                  </option>
                ))}
            </select>
            <label htmlFor="billing-action">Advertising option</label>
            <select id="billing-action" name="action" required disabled={!ready}>
              <option value="new_ad">14-day advertisement — A$19</option>
              <option value="readvertise">Renew this advertisement for 14 days — A$19</option>
              <option value="new_promoted_ad">Advertisement + five-day promotion — A$49</option>
              <option value="promote_existing">Five-day promotion add-on — A$30</option>
            </select>
            <label className="nua-row">
              <input type="checkbox" name="confirm" required disabled={!ready} />I reviewed the
              role, pay, advertising terms and price. After verified payment, publish or renew this
              advertisement and activate any reserved promotion.
            </label>
            <Button type="submit" disabled={!ready || business?.verification_status !== 'verified'}>
              Continue to Stripe test checkout
            </Button>
            {business?.verification_status !== 'verified' ? (
              <p className="nua-hint">Business verification is required before advertising.</p>
            ) : null}
          </form>
        )}
        <ButtonLink href="/jobs/new" variant="secondary">
          Create a job draft
        </ButtonLink>
      </section>
      <section aria-labelledby="orders-heading" className="nua-stack">
        <h2 id="orders-heading">Orders and payment status</h2>
        <p className="nua-hint">
          Returning from Checkout does not prove payment. Pending orders update after Stripe
          verification. Quotes hold inventory for 35 minutes. Unfulfilled payments are queued for a
          full refund; partial refunds require review.
        </p>
        {ordersError ? (
          <p role="alert">We could not load your orders. Refresh to try again.</p>
        ) : !orders?.length ? (
          <EmptyState
            title="No advertising orders yet"
            description="Your confirmed purchases, expiry dates and refund updates will appear here."
          />
        ) : (
          orders.map((order) => (
            <article className="nua-card nua-stack" key={order.id}>
              <div className="nua-row" style={{ justifyContent: 'space-between' }}>
                <h3>{order.job_title}</h3>
                <strong>{money(order.amount_minor)}</strong>
              </div>
              <p>
                <span className="nua-badge">{statusName[order.status] ?? order.status}</span>
                {order.refund_requested && order.status !== 'refunded'
                  ? ' · Refund request recorded'
                  : ''}
                {order.review_required ? ' · Support review needed' : ''}
              </p>
              <p className="nua-hint">
                Reference {order.id.slice(0, 8)} · Quote deadline{' '}
                {new Date(order.expires_at).toLocaleString('en-AU', {
                  timeZone: 'Australia/Melbourne',
                })}{' '}
                (Melbourne time)
              </p>
              {order.promotion_slot ? (
                <p>
                  Reserved placement {order.promotion_slot} of 5 ·{' '}
                  {order.promotion_starts_at
                    ? new Date(order.promotion_starts_at).toLocaleString('en-AU')
                    : ''}{' '}
                  to{' '}
                  {order.promotion_ends_at
                    ? new Date(order.promotion_ends_at).toLocaleString('en-AU')
                    : ''}
                </p>
              ) : null}
              {owner && ready && order.status === 'pending' ? (
                <>
                  <form action={resumeCheckout}>
                    <input type="hidden" name="order_id" value={order.id} />
                    <Button type="submit" variant="secondary">
                      Resume this checkout
                    </Button>
                  </form>
                  <form action={cancelQuote} className="nua-stack">
                    <input type="hidden" name="order_id" value={order.id} />
                    <label>
                      <input type="checkbox" name="confirm" required />
                      Cancel this unpaid quote and release its reservation.
                    </label>
                    <Button type="submit" variant="secondary">
                      Cancel unpaid quote
                    </Button>
                  </form>
                </>
              ) : null}
              {owner && ready && order.status === 'settled' && !order.refund_requested ? (
                <form action={refundOrder} className="nua-stack">
                  <input type="hidden" name="order_id" value={order.id} />
                  <label>
                    <input type="checkbox" name="confirm" required />
                    Request a full refund and end the advertising/promotion coverage funded by this
                    order.
                  </label>
                  <Button type="submit" variant="danger">
                    Request full refund
                  </Button>
                </form>
              ) : null}
            </article>
          ))
        )}
      </section>
    </div>
  );
}
