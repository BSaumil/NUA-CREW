'use client';
import { useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@nua-crew/ui';
import { Field } from '../components';

export function UploadForm({ enabled }: { enabled: boolean }) {
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');
  const [kind, setKind] = useState('resume');
  const retry = useRef({ fingerprint: '', key: '' });
  const router = useRouter();
  return (
    <form
      className="nua-stack"
      onSubmit={async (event) => {
        event.preventDefault();
        if (busy) return;
        const form = event.currentTarget;
        const data = new FormData(form);
        const file = data.get('file');
        if (!(file instanceof File)) return;
        const fingerprint = JSON.stringify([
          Array.from(data.entries()).filter(([k]) => k !== 'file'),
          file.name,
          file.size,
          file.lastModified,
        ]);
        if (fingerprint !== retry.current.fingerprint)
          retry.current = { fingerprint, key: crypto.randomUUID() };
        data.set('client_key', retry.current.key);
        setBusy(true);
        setMessage('Uploading and scanning…');
        try {
          const result = await fetch('/documents/upload', { method: 'POST', body: data });
          const body = await result.json();
          setMessage(body.message);
          if (result.ok) {
            retry.current = { fingerprint: '', key: '' };
            form.reset();
            setKind('resume');
            router.refresh();
          }
        } catch {
          setMessage('Upload interrupted. Your selection is kept; retry safely.');
        } finally {
          setBusy(false);
        }
      }}
    >
      <fieldset disabled={!enabled || busy} className="nua-stack" style={{ border: 0, padding: 0 }}>
        <legend>Upload a private document</legend>
        <div className="nua-field">
          <label htmlFor="kind">Document type</label>
          <select name="kind" id="kind" value={kind} onChange={(e) => setKind(e.target.value)}>
            <option value="resume">Resume (PDF)</option>
            <option value="rsa">RSA</option>
            <option value="food_safety">Food safety</option>
            <option value="first_aid">First aid</option>
            <option value="qualification">Qualification</option>
            <option value="other">Other certificate</option>
          </select>
        </div>
        <Field name="title" label="Document name" required maxLength={160} />
        <div className="nua-field">
          <label htmlFor="document-file">Choose a file, up to 4 MB</label>
          <input
            id="document-file"
            name="file"
            type="file"
            required
            accept={kind === 'resume' ? 'application/pdf' : 'application/pdf,image/jpeg,image/png'}
          />
        </div>
        {kind !== 'resume' ? (
          <>
            <Field name="issuer" label="Issuer (optional)" maxLength={160} />
            <div className="nua-field">
              <label htmlFor="jurisdiction">Certificate state or territory</label>
              <select name="jurisdiction" id="jurisdiction">
                <option value="">Not stated</option>
                {['ACT', 'NSW', 'NT', 'QLD', 'SA', 'TAS', 'VIC', 'WA'].map((s) => (
                  <option key={s}>{s}</option>
                ))}
              </select>
            </div>
            <Field name="completed_on" label="Completed on (optional)" type="date" />
            <Field name="review_due_on" label="Refresher / review due (optional)" type="date" />
          </>
        ) : null}
        <Button type="submit">{busy ? 'Uploading and scanning…' : 'Upload document'}</Button>
      </fieldset>
      <p role="status">{message}</p>
    </form>
  );
}
