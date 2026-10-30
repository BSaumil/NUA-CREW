import type { ReactNode } from 'react';
import { PageHero } from './components';
import { BUSINESS } from '@/lib/business';

export type PolicySection = { id: string; title: string; body: ReactNode };
export function LegalDocument({
  title,
  summary,
  sections,
}: {
  title: string;
  summary: string;
  sections: PolicySection[];
}) {
  return (
    <>
      <PageHero eyebrow="NUA CREW · PART OF NUA POS" title={title} lede={summary} />
      <div className="policy-layout nua-container">
        <aside className="policy-index">
          <p className="section-kicker">ON THIS PAGE</p>
          <nav aria-label={`${title} contents`}>
            <ol>
              {sections.map((s) => (
                <li key={s.id}>
                  <a href={`#${s.id}`}>{s.title}</a>
                </li>
              ))}
            </ol>
          </nav>
          <a href="/legal">All policies →</a>
        </aside>
        <article className="policy-body">
          <p className="policy-date">
            Effective and last updated: {BUSINESS.updated} · Version 1.2
          </p>
          <div className="policy-identity">
            <strong>Who operates NUA CREW?</strong>
            <p>
              NUA CREW is a recruitment product in the NUA POS family, provided through{' '}
              {BUSINESS.tradingName} (ABN {BUSINESS.abn}).
            </p>
            <p>
              {BUSINESS.address}
              <br />
              <a href={`mailto:${BUSINESS.email}`}>{BUSINESS.email}</a>
            </p>
            <a href={BUSINESS.registerUrl}>View the public ABN record</a>
          </div>
          {sections.map((s, i) => (
            <section id={s.id} key={s.id}>
              <h2>
                {i + 1}. {s.title}
              </h2>
              {s.body}
            </section>
          ))}
          <p className="policy-end">
            Questions about this document? <a href="/contact">Contact NUA CREW support</a>.
          </p>
        </article>
      </div>
    </>
  );
}
