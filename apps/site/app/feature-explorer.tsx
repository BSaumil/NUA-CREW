'use client';

import { useState } from 'react';
import {
  ArrowRight,
  CalendarCheck,
  Check,
  FileText,
  LockKeyhole,
  ShieldCheck,
  Users,
  Wallet,
} from 'lucide-react';

type Topic = 'documents' | 'shifts' | 'pay' | 'team';
const topics = {
  documents: {
    label: 'Resumes & certificates',
    icon: FileText,
    title: 'Ready to share. Private until you do.',
    body: 'Keep your resume and certificates together. Choose the documents to attach to each application.',
    points: ['Resume: PDF', 'Certificates: PDF, JPG or PNG', 'Up to 4 MiB per file'],
    note: 'An uploaded RSA certificate is not proof that we have verified it. Check local requirements with the employer.',
  },
  shifts: {
    label: 'Shifts & hours',
    icon: CalendarCheck,
    title: 'From an offer to a clear record.',
    body: 'Review a shift before accepting. Keep check-in, actual hours and corrections connected.',
    points: [
      'Accept a specific shift offer',
      'Record attendance and submit hours',
      'Review changes with a history',
    ],
    note: 'Accepting an invitation to chat does not book a shift. Timesheets are records; NUA CREW does not pay wages.',
  },
  pay: {
    label: 'Pay & awards',
    icon: Wallet,
    title: 'Start with the role. Make pay clear.',
    body: 'A guided reference for selected adult Restaurant and Hospitality Award classifications. The employer confirms coverage and the offered pay.',
    points: [
      'Select award and classification',
      'Check employment basis and reference',
      'Disclose the offered pay',
    ],
    note: 'Limited reference coverage, not a full payroll calculation. Juniors, apprentices, overtime, allowances and other awards need separate checks.',
  },
  team: {
    label: 'Team access',
    icon: Users,
    title: 'A shared workspace. Clear responsibilities.',
    body: 'Invite an existing employer account. Access starts only after the recipient accepts the invitation.',
    points: [
      'Owner manages access and ownership',
      'Recruiter works on hiring',
      'Viewer has read-only access',
    ],
    note: 'Invitations expire after seven days and can be revoked. Each business keeps its own membership and records.',
  },
} as const;

function Preview({ topic }: { topic: Topic }) {
  if (topic === 'documents')
    return (
      <div className="feature-art">
        <div className="art-heading">
          <LockKeyhole size={19} aria-hidden="true" />
          <span>MY DOCUMENTS</span>
          <span className="art-pill">Private</span>
        </div>
        <div className="document-stack">
          <div className="document-sheet">
            <FileText size={34} aria-hidden="true" />
            <strong>My resume.pdf</strong>
            <span className="art-line" />
            <span className="art-line art-line--short" />
            <span className="art-tag">
              <Check size={14} aria-hidden="true" />
              Selected for this application
            </span>
          </div>
          <div className="document-certificate">
            <ShieldCheck size={27} aria-hidden="true" />
            <div>
              <strong>RSA certificate</strong>
              <small>Self-provided · not verified</small>
            </div>
            <LockKeyhole size={16} aria-hidden="true" />
          </div>
        </div>
        <p className="art-footnote">Your document library is not a public profile.</p>
      </div>
    );
  if (topic === 'shifts')
    return (
      <div className="feature-art">
        <div className="art-heading">
          <CalendarCheck size={19} aria-hidden="true" />
          <span>MY SHIFT</span>
          <span className="art-pill">Example</span>
        </div>
        <div className="shift-ticket">
          <small>NEIGHBOURHOOD CAFE · FITZROY</small>
          <h3>Saturday service</h3>
          <p>9:00 am–3:00 pm · 30 min break</p>
          <ol className="record-timeline">
            <li>
              <Check size={16} aria-hidden="true" />
              <span>Shift offer accepted</span>
            </li>
            <li>
              <Check size={16} aria-hidden="true" />
              <span>Checked in</span>
            </li>
            <li>
              <CalendarCheck size={16} aria-hidden="true" />
              <span>Actual hours ready for review</span>
            </li>
          </ol>
        </div>
        <p className="art-footnote">A correction keeps the earlier record visible.</p>
      </div>
    );
  if (topic === 'pay')
    return (
      <div className="feature-art">
        <div className="art-heading">
          <Wallet size={19} aria-hidden="true" />
          <span>PAY, EXPLAINED</span>
          <span className="art-pill">Guide</span>
        </div>
        <div className="pay-reference">
          <span className="art-tag">Employer confirms coverage</span>
          <h3>Role → classification → pay</h3>
          <div className="pay-step">
            <span>1</span>
            <div>
              <strong>The right award</strong>
              <small>Restaurant or Hospitality coverage</small>
            </div>
          </div>
          <div className="pay-step">
            <span>2</span>
            <div>
              <strong>The work being done</strong>
              <small>Classification and employment basis</small>
            </div>
          </div>
          <div className="pay-step">
            <span>3</span>
            <div>
              <strong>A clear offer</strong>
              <small>Pay disclosed before applying</small>
            </div>
          </div>
        </div>
        <p className="art-footnote">Check the complete entitlement with Fair Work.</p>
      </div>
    );
  return (
    <div className="feature-art">
      <div className="art-heading">
        <Users size={19} aria-hidden="true" />
        <span>YOUR HIRING TEAM</span>
        <span className="art-pill">Example</span>
      </div>
      <div className="team-preview">
        {[
          ['SB', 'Business owner', 'Owner'],
          ['AL', 'Hiring teammate', 'Recruiter'],
          ['JT', 'Invited teammate', 'Pending acceptance'],
        ].map(([initials, name, role]) => (
          <div className="team-person" key={role}>
            <span className="art-avatar">{initials}</span>
            <div>
              <strong>{name}</strong>
              <small>{role}</small>
            </div>
            {role === 'Pending acceptance' ? (
              <span className="art-dot" />
            ) : (
              <Check size={18} aria-hidden="true" />
            )}
          </div>
        ))}
      </div>
      <p className="art-footnote">Pending invitation = no access to the business.</p>
    </div>
  );
}

export function FeatureExplorer({ audience = 'all' }: { audience?: 'jobs' | 'hire' | 'all' }) {
  const options: Topic[] =
    audience === 'jobs'
      ? ['documents', 'shifts']
      : audience === 'hire'
        ? ['pay', 'team', 'shifts']
        : ['documents', 'shifts', 'pay', 'team'];
  const [selected, setSelected] = useState<Topic>(audience === 'hire' ? 'pay' : 'documents');
  const active = topics[selected];
  return (
    <div className="feature-explorer">
      <div className="feature-options" role="group" aria-label="Choose a feature to explore">
        {options.map((key) => {
          const Icon = topics[key].icon;
          return (
            <button
              key={key}
              type="button"
              aria-pressed={selected === key}
              onClick={() => setSelected(key)}
            >
              <Icon size={19} aria-hidden="true" />
              {topics[key].label}
            </button>
          );
        })}
      </div>
      <div className="feature-demo" aria-live="polite" aria-atomic="true">
        <Preview topic={selected} />
        <div className="feature-copy">
          <p className="section-kicker">ILLUSTRATIVE PREVIEW · IN TESTING</p>
          <h3>{active.title}</h3>
          <p>{active.body}</p>
          <ul>
            {active.points.map((point) => (
              <li key={point}>
                <Check size={17} aria-hidden="true" />
                {point}
              </li>
            ))}
          </ul>
          <p className="feature-limit">{active.note}</p>
          <a className="text-link" href="/apps">
            Check launch status <ArrowRight size={17} aria-hidden="true" />
          </a>
        </div>
      </div>
      <p className="demo-caption">
        Fictional examples of workflows in development. These are illustrations, not a live account
        or an upload form.
      </p>
    </div>
  );
}
