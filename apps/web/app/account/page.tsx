import type { Metadata } from 'next';
import { Button } from '@nua-crew/ui';
import { requireCandidate } from '@/lib/api';
import { changePassword, deleteAccount, signOutEverywhere } from '../actions';
import { Flash, flashFrom } from '../components';

export const metadata: Metadata = { title: 'Account and privacy', robots: { index: false } };

export default async function Account({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const viewer = await requireCandidate();
  const { error, notice } = await flashFrom(searchParams);
  return (
    <div className="nua-stack" style={{ maxWidth: 640 }}>
      <h1>Account and privacy</h1>
      <p className="nua-hint">Signed in as {viewer.email}.</p>
      <Flash error={error} notice={notice} />

      <section className="nua-card nua-stack" aria-labelledby="export-h">
        <h2 id="export-h">Download your data</h2>
        <p>
          Everything we hold about you as one file you can save or share: your profile, resumes,
          applications, saved jobs and alerts. It is generated when you ask and is not kept.
        </p>
        <p>
          <a className="nua-button nua-button--secondary" href="/account/export" download>
            Download my data
          </a>
        </p>
      </section>

      <form action={changePassword} className="nua-card nua-stack" aria-labelledby="pw-h">
        <h2 id="pw-h">Change password</h2>
        <div className="nua-field">
          <label htmlFor="current_password">Current password</label>
          <input
            id="current_password"
            name="current_password"
            type="password"
            autoComplete="current-password"
            required
          />
        </div>
        <div className="nua-field">
          <label htmlFor="new_password">New password</label>
          <input
            id="new_password"
            name="new_password"
            type="password"
            autoComplete="new-password"
            minLength={12}
            maxLength={128}
            required
            aria-describedby="pw-hint"
          />
          <p id="pw-hint" className="nua-hint">
            At least 12 characters.
          </p>
        </div>
        <div className="nua-field">
          <label htmlFor="confirm_password">Confirm new password</label>
          <input
            id="confirm_password"
            name="confirm_password"
            type="password"
            autoComplete="new-password"
            minLength={12}
            maxLength={128}
            required
          />
        </div>
        <p className="nua-hint">Changing your password signs your other devices out.</p>
        <p>
          <Button type="submit">Change password</Button>
        </p>
      </form>

      <section className="nua-card nua-stack" aria-labelledby="devices-h">
        <h2 id="devices-h">Sign out of all devices</h2>
        <p>
          Use this if you lost a phone or used a shared computer. A device that is already open can
          keep working for up to 30 minutes before it asks you to log in again.
        </p>
        <form action={signOutEverywhere}>
          <Button type="submit" variant="secondary">
            Sign out everywhere
          </Button>
        </form>
      </section>

      <form action={deleteAccount} className="nua-card nua-stack" aria-labelledby="delete-h">
        <h2 id="delete-h">Delete my account</h2>
        <p>
          This permanently erases your profile, resumes, applications, saved jobs and alerts.
          Employers will no longer see your applications. It cannot be undone, so download your data
          first if you want a copy.
        </p>
        <div className="nua-field">
          <label htmlFor="delete_password">Confirm with your password</label>
          <input
            id="delete_password"
            name="password"
            type="password"
            autoComplete="current-password"
            required
          />
        </div>
        <label className="nua-market-choice__option">
          <input type="checkbox" name="understand" required />
          <span>I understand this permanently deletes my account.</span>
        </label>
        <p>
          <Button type="submit" variant="danger">
            Delete everything
          </Button>
        </p>
      </form>
    </div>
  );
}
