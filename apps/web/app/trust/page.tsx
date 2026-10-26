import type { Metadata } from 'next';
import { AI_DISCLOSURE } from '@nua-crew/ui';

export const metadata: Metadata = { title: 'Trust and safety' };

export default function Trust() {
  return (
    <div className="nua-stack" style={{ maxWidth: 720 }}>
      <h1>How trust signals work</h1>
      <section className="nua-card">
        <h2>Verified business</h2>
        <p>
          A verified badge means NUA CREW reviewed evidence about who operates the business. It is
          not an endorsement, and it is never based only on an ABN number matching a checksum.
        </p>
      </section>
      <section className="nua-card">
        <h2>Disclosed and estimated pay</h2>
        <p>
          <strong>Disclosed</strong> pay comes from the employer or licensed source.{' '}
          <strong>Estimated</strong> pay is our inference and is always labelled. If pay is not
          published we say so.
        </p>
      </section>
      <section className="nua-card">
        <h2>Matching and AI</h2>
        <p>{AI_DISCLOSURE}</p>
        <p>
          Match percentages are heuristic estimates built from information on your profile. They do
          not predict whether you will be interviewed or hired, and employers make every hiring
          decision.
        </p>
      </section>
      <section className="nua-card">
        <h2>Jobs hosted elsewhere</h2>
        <p>
          Some jobs come from licensed sources. We link you to the employer&apos;s own application
          page and cannot confirm what happens after you apply there.
        </p>
      </section>
    </div>
  );
}
