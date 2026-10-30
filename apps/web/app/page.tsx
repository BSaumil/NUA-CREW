import Image from 'next/image';
import { ButtonLink, SUPPORT_LINE, TAGLINE } from '@nua-crew/ui';

export default function Home() {
  return (
    <div className="nua-stack">
      <section className="nua-hero" aria-labelledby="home-title">
        <div className="nua-hero__media">
          <Image
            src="/images/home-hero.webp"
            alt="Concept illustration of the NUA CREW job search on a phone and laptop beside a café coffee and service bell."
            width={2400}
            height={900}
            sizes="(min-width: 1080px) 1080px, 100vw"
            priority
          />
        </div>
        <div className="nua-hero__copy">
          <p className="nua-badge nua-badge--live">
            <span className="nua-dot" aria-hidden="true" /> NUA CREW Jobs
          </p>
          <h1 id="home-title">{TAGLINE}</h1>
          <p style={{ fontSize: '1.125rem' }}>
            {SUPPORT_LINE} Find work that fits your skills, life and ambitions — starting with
            hospitality and local services in Melbourne.
          </p>
        </div>
      </section>
      <form
        action="/jobs"
        method="get"
        role="search"
        className="nua-card nua-stack"
        aria-label="Search jobs"
      >
        <div className="nua-grid">
          <div className="nua-field">
            <label htmlFor="q">What work are you after?</label>
            <input id="q" name="q" placeholder="e.g. barista, kitchen hand" />
          </div>
          <div className="nua-field">
            <label htmlFor="suburb">Suburb</label>
            <input id="suburb" name="suburb" placeholder="e.g. Fitzroy" />
          </div>
        </div>
        <div className="nua-row">
          <button className="nua-button" type="submit">
            Search jobs
          </button>
          <ButtonLink href="/jobs" variant="secondary">
            Browse all jobs
          </ButtonLink>
        </div>
      </form>
      <section className="nua-grid" aria-label="What makes NUA CREW different">
        <div className="nua-card">
          <h2>Pay you can see</h2>
          <p>Every listing says whether pay is disclosed by the employer or an estimate.</p>
        </div>
        <div className="nua-card">
          <h2>Honest matching</h2>
          <p>
            Match scores are explainable estimates. They never predict whether you will be hired.
          </p>
        </div>
        <div className="nua-card">
          <h2>Verified, not endorsed</h2>
          <p>
            We check who is behind a business. <a href="/trust">Learn what that means.</a>
          </p>
        </div>
      </section>
      <section className="nua-grid" aria-label="How NUA CREW works">
        <figure className="nua-figure">
          <Image
            src="/images/feature-job-discovery.webp"
            alt="Concept illustration of browsing hospitality jobs near you."
            width={1400}
            height={1060}
            sizes="(min-width: 1080px) 520px, (min-width: 640px) 50vw, 100vw"
            loading="lazy"
          />
          <figcaption>
            Browse jobs near you. Illustration only, not a product screenshot.
          </figcaption>
        </figure>
        <figure className="nua-figure">
          <Image
            src="/images/feature-one-place-to-apply.webp"
            alt="Concept illustration of tracking job applications in one place."
            width={1400}
            height={1060}
            sizes="(min-width: 1080px) 520px, (min-width: 640px) 50vw, 100vw"
            loading="lazy"
          />
          <figcaption>Keep your applications in one place. Illustration only.</figcaption>
        </figure>
      </section>
    </div>
  );
}
