'use client';
export default function ErrorPage({ reset }: { reset: () => void }) {
  return (
    <section className="nua-card nua-stack">
      <h1>We couldn’t finish loading this page.</h1>
      <p role="alert">
        Check your connection and try again. If a submission was interrupted, check its status
        before sending it again.
      </p>
      <div>
        <button className="nua-button" onClick={reset}>
          Try again
        </button>
      </div>
      <a href="/">Back to home</a>
    </section>
  );
}
