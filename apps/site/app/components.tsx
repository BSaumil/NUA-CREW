import type { ReactNode } from 'react';
import Image from 'next/image';
import { ButtonLink } from '@nua-crew/ui';
import {
  BriefcaseBusiness,
  Users,
  ShieldCheck,
  Banknote,
  SlidersHorizontal,
  MapPin,
  Heart,
  FileCheck,
  ExternalLink,
  CalendarDays,
  MessageCircle,
  Search,
  UserCheck,
} from 'lucide-react';

const CARD_ICONS = {
  J: BriefcaseBusiness,
  H: Users,
  '✓': ShieldCheck,
  $: Banknote,
  '≈': SlidersHorizontal,
  '◎': MapPin,
  '♡': Heart,
  '✎': FileCheck,
  '!': ExternalLink,
  '1': BriefcaseBusiness,
  '2': ShieldCheck,
  '3': FileCheck,
  '4': Search,
  '5': CalendarDays,
  '6': MessageCircle,
} as const;

export function Section({
  id,
  title,
  intro,
  tone,
  children,
}: {
  id?: string;
  title?: string;
  intro?: ReactNode;
  tone?: 'alt' | 'wine';
  children: ReactNode;
}) {
  return (
    <section
      id={id}
      className={`site-section${tone ? ` site-section--${tone}` : ''}`}
      aria-labelledby={title ? `${id ?? title.replace(/\W+/g, '-').toLowerCase()}-h` : undefined}
    >
      <div className="nua-container" style={{ padding: '0 16px' }}>
        {title ? <h2 id={`${id ?? title.replace(/\W+/g, '-').toLowerCase()}-h`}>{title}</h2> : null}
        {intro ? <div className="site-intro">{intro}</div> : null}
        {children}
      </div>
    </section>
  );
}

export function Cards({ children }: { children: ReactNode }) {
  return <div className="site-cards">{children}</div>;
}

export function Card({
  icon,
  title,
  children,
}: {
  icon?: string;
  title: string;
  children: ReactNode;
}) {
  const Icon = icon ? (CARD_ICONS[icon as keyof typeof CARD_ICONS] ?? UserCheck) : null;
  return (
    <article className="site-card">
      {icon ? (
        <span className="site-icon" aria-hidden="true">
          {Icon ? <Icon size={23} strokeWidth={1.7} /> : null}
        </span>
      ) : null}
      <h3>{title}</h3>
      {children}
    </article>
  );
}

export function Steps({ items }: { items: { title: string; body: ReactNode }[] }) {
  return (
    <ol className="site-steps">
      {items.map((s) => (
        <li key={s.title}>
          <h3>{s.title}</h3>
          <p>{s.body}</p>
        </li>
      ))}
    </ol>
  );
}

export function Faq({ items }: { items: { q: string; a: ReactNode }[] }) {
  return (
    <div className="site-faq">
      {items.map((i) => (
        <details key={i.q}>
          <summary>{i.q}</summary>
          <div>{i.a}</div>
        </details>
      ))}
    </div>
  );
}

export function PageHero({
  eyebrow,
  title,
  lede,
  children,
  visual,
}: {
  eyebrow: string;
  title: string;
  lede: ReactNode;
  children?: ReactNode;
  visual?: { src: string; alt: string; width: number; height: number };
}) {
  const isWideBanner = Boolean(visual && visual.width >= visual.height * 2);
  return (
    <header
      className={
        visual
          ? `site-hero site-hero--visual${isWideBanner ? ' site-hero--banner' : ''}`
          : 'site-hero'
      }
    >
      <div className="nua-container site-hero__grid" style={{ padding: '0 16px' }}>
        <div className="site-hero__copy">
          <p className="site-eyebrow">{eyebrow}</p>
          <h1>{title}</h1>
          <p className="lede">{lede}</p>
          {children}
        </div>
        {visual ? (
          <figure className="site-hero__visual">
            <Image
              src={visual.src}
              alt={visual.alt}
              width={visual.width}
              height={visual.height}
              sizes={isWideBanner ? "(max-width: 899px) 100vw, 85vw" : "(max-width: 899px) 100vw, 45vw"}
              priority
            />
            <figcaption>Illustrative concept · The app is in testing</figcaption>
          </figure>
        ) : null}
      </div>
    </header>
  );
}

export function Cta({
  href,
  children,
  ghost,
}: {
  href: string;
  children: ReactNode;
  ghost?: boolean;
}) {
  return (
    <a href={href} className={ghost ? 'site-button-ghost' : 'site-button-light'}>
      {children}
    </a>
  );
}

export function PrimaryLink({ href, children }: { href: string; children: ReactNode }) {
  return <ButtonLink href={href}>{children}</ButtonLink>;
}

/** Illustration of real screens using fictional sample data. Not a screenshot of a live service. */
export function Phone({ label, children }: { label: string; children: ReactNode }) {
  return (
    <figure style={{ margin: 0 }}>
      <div className="phone" role="img" aria-label={label}>
        <div className="phone__screen" aria-hidden="true">
          {children}
        </div>
      </div>
      <figcaption className="site-caption">Illustration with fictional sample data.</figcaption>
    </figure>
  );
}

export function InvitationScreen() {
  return (
    <>
      <h3>Fitzroy Cafe invited you</h3>
      <div>
        <span className="phone__pill">Waiting for you</span>{' '}
        <span className="phone__pill">Temporary</span>
      </div>
      <div className="phone__card">
        <strong>Their note</strong>
        <p style={{ margin: '4px 0 0' }}>Morning espresso shifts, Tue to Fri.</p>
      </div>
      <div className="phone__card">
        <strong>Barista · Fitzroy, VIC</strong>
        <p className="phone__muted" style={{ margin: '4px 0' }}>
          10–20 hours a week
        </p>
        <p style={{ margin: 0 }}>
          <strong>$29–$33 / hour</strong> <span className="phone__muted">(super not stated)</span>{' '}
          <span className="phone__pill phone__pill--ok">Disclosed</span>
        </p>
      </div>
      <p className="phone__muted" style={{ margin: 0 }}>
        Accepting opens a conversation. It is not an application, does not reserve a shift and
        shares no contact details.
      </p>
      <span className="phone__btn">Accept and open a conversation</span>
      <span className="phone__btn phone__btn--secondary">Decline</span>
    </>
  );
}

export function AvailabilityScreen() {
  const rows: [string, string][] = [
    ['Tuesday', '9:00 am to 12:00 pm · 2:00 pm to 6:00 pm'],
    ['Saturday', '10:00 pm to 6:00 am (next day)'],
    ['Sunday', 'Not set'],
  ];
  return (
    <>
      <h3>When can you work?</h3>
      <p className="phone__muted" style={{ margin: 0 }}>
        Employers only learn whether you are free for a time they ask about.
      </p>
      {rows.map(([d, t]) => (
        <div key={d} className="phone__card">
          <strong>{d}</strong>
          <p style={{ margin: '2px 0 0' }}>{t}</p>
        </div>
      ))}
      <div className="phone__card">
        <strong>Not available</strong>
        <p style={{ margin: '2px 0 0' }}>24/12/2026, all day</p>
      </div>
    </>
  );
}

export function TalentScreen() {
  return (
    <>
      <h3>Find talent</h3>
      <div className="phone__card">
        <strong>Alex C.</strong>
        <p className="phone__muted" style={{ margin: '2px 0' }}>
          Barista · Fitzroy, VIC
        </p>
        <span className="phone__pill phone__pill--ok">Free for this time</span>{' '}
        <span className="phone__pill">Pay fit not confirmed</span>
      </div>
      <div className="phone__card">
        <strong>Sam K.</strong>
        <p className="phone__muted" style={{ margin: '2px 0' }}>
          Kitchen hand · Richmond, VIC
        </p>
        <span className="phone__pill">Availability unknown</span>
      </div>
      <p className="phone__muted" style={{ margin: 0 }}>
        Only people who chose to be found. Not ranked.
      </p>
      <span className="phone__btn">Invite to a job</span>
    </>
  );
}
