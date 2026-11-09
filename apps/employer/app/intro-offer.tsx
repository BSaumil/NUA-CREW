import type { Schemas } from '@nua-crew/contracts';

type IntroOffer = Schemas['IntroOfferOut'];

/**
 * Show the actual server-side advertising entitlement, never a front-end promise.
 * The API alone controls publishing, verification, limits and offer eligibility.
 */
export function IntroOfferNotice({ offer }: { offer: IntroOffer | null | undefined }) {
  if (!offer) {
    return (
      <aside className="nua-card nua-stack" aria-label="Job advertising availability">
        <strong>Job advertising availability</strong>
        <p className="nua-hint">
          We could not confirm advertising availability. You can keep preparing a draft. Please
          check again before attempting to publish.
        </p>
      </aside>
    );
  }

  const approved = offer.enabled && offer.terms_version !== 'unapproved-draft';
  const remainingActive = Math.max(0, offer.max_active - offer.active_used);
  const remainingWindow = Math.max(0, offer.max_per_30_days - offer.used_30_days);

  return (
    <aside className="nua-card nua-stack" aria-label="Job advertising availability">
      <div className="nua-row" style={{ alignItems: 'center', justifyContent: 'space-between' }}>
        <strong>{approved ? 'Introductory job advertising — A$0' : 'Publishing not open yet'}</strong>
        <span className="nua-badge">
          {approved ? `${offer.days} days per listing` : 'Drafts available'}
        </span>
      </div>
      <p className="nua-hint">
        {approved
          ? 'For verified Australian businesses. No payment card, no charge and no automatic renewal. Business and award-pay checks still apply.'
          : 'You can prepare and edit jobs, but publishing remains closed until the introductory offer is approved and switched on.'}
      </p>
      {approved ? (
        <p className="nua-hint">
          Remaining: {remainingActive} of {offer.max_active} active ad slots and {remainingWindow} of{' '}
          {offer.max_per_30_days} ads in a rolling 30-day window.
        </p>
      ) : null}
      <p className="nua-hint">
        Planned paid ads: A$49 for 14 days; optional A$30 five-day promotion. These are not
        currently chargeable.
      </p>
    </aside>
  );
}
