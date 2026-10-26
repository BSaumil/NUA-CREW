import { ButtonLink, SUPPORT_LINE, TAGLINE } from '@nua-crew/ui';

export default function Home() {
  return (
    <div className="nua-stack">
      <section>
        <p className="nua-badge nua-badge--live">
          <span className="nua-dot" aria-hidden="true" /> NUA CREW Jobs
        </p>
        <h1>{TAGLINE}</h1>
        <p style={{ fontSize: '1.125rem', maxWidth: '40rem' }}>
          {SUPPORT_LINE} Find work that fits your skills, life and ambitions — starting with
          hospitality and local services in Melbourne.
        </p>
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
    </div>
  );
}
