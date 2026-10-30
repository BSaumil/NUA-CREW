'use client';

import { useState, type ReactNode } from 'react';
import { BriefcaseBusiness, Users } from 'lucide-react';
import { AvailabilityScreen, InvitationScreen, Phone, TalentScreen } from './components';

type Audience = 'jobs' | 'hire';

type Step = {
  title: string;
  body: string;
  features: string[];
  label: string;
  screen: ReactNode;
};

/** Every figure and name below is fictional, and no award rate is shown: rates are still being checked. */
function SearchScreen() {
  return (
    <>
      <h3>Find work</h3>
      <div className="phone__card">
        <strong>Barista</strong>
        <p className="phone__muted" style={{ margin: '2px 0' }}>
          Neighbourhood cafe · Fitzroy, VIC
        </p>
        <span className="phone__pill phone__pill--ok">Pay disclosed</span>{' '}
        <span className="phone__pill">Part time</span>
      </div>
      <div className="phone__card">
        <strong>Waiter / Waitress</strong>
        <p className="phone__muted" style={{ margin: '2px 0' }}>
          Wine bar · Richmond, VIC
        </p>
        <span className="phone__pill phone__pill--ok">Pay disclosed</span>{' '}
        <span className="phone__pill">Casual</span>
      </div>
      <p className="phone__muted" style={{ margin: 0 }}>
        Search by role, place, pay and when you can work.
      </p>
    </>
  );
}

function MatchScreen() {
  return (
    <>
      <h3>Why this job</h3>
      <div className="phone__card">
        <strong>Fits you</strong>
        <ul style={{ margin: '6px 0 0', paddingLeft: 18 }}>
          <li>Your role: Barista</li>
          <li>Near your suburb</li>
          <li>Matches the days you shared</li>
        </ul>
      </div>
      <p className="phone__muted" style={{ margin: 0 }}>
        A match is an estimate to help you decide. It is not a chance of being hired.
      </p>
      <span className="phone__btn">Apply</span>
    </>
  );
}

function RoleScreen() {
  return (
    <>
      <h3>What is the role?</h3>
      <div className="phone__card">
        <strong>Search roles</strong>
        <p className="phone__muted" style={{ margin: '2px 0 0' }}>
          “waitstaff”
        </p>
      </div>
      <div className="phone__card">
        <strong>Waiter / Waitress</strong>
        <p className="phone__muted" style={{ margin: '2px 0 0' }}>
          Front of house · also called waitstaff
        </p>
      </div>
      <p className="phone__muted" style={{ margin: 0 }}>
        A role is how people find your job. You choose the award and level yourself.
      </p>
    </>
  );
}

function PayCheckScreen() {
  return (
    <>
      <h3>Pay check</h3>
      <div className="phone__card">
        <strong>You confirm</strong>
        <ul style={{ margin: '6px 0 0', paddingLeft: 18 }}>
          <li>The award that covers your business</li>
          <li>The level that matches the duties</li>
        </ul>
      </div>
      <div className="phone__card">
        <span className="phone__pill phone__pill--ok">Meets the minimum as assessed</span>
        <p className="phone__muted" style={{ margin: '6px 0 0' }}>
          Below the minimum? You are asked to raise the rate before the job can go live.
        </p>
      </div>
      <p className="phone__muted" style={{ margin: 0 }}>
        A guide, not legal advice. Items we did not assess are listed.
      </p>
    </>
  );
}

function ApplicantsScreen() {
  return (
    <>
      <h3>Barista · Fitzroy</h3>
      <div className="phone__card">
        <strong>Applied</strong> <span className="phone__pill">3</span>
      </div>
      <div className="phone__card">
        <strong>Interviewing</strong> <span className="phone__pill">1</span>
      </div>
      <div className="phone__card">
        <strong>Offer</strong> <span className="phone__pill">0</span>
      </div>
      <p className="phone__muted" style={{ margin: 0 }}>
        You make every hiring decision. We never decide for you.
      </p>
    </>
  );
}

const STEPS: Record<Audience, Step[]> = {
  jobs: [
    {
      title: 'Find work that fits',
      body: 'Search by role, place, pay and hours. Pay is always labelled: disclosed, estimated or not disclosed.',
      features: ['Role and place search', 'Saved searches and alerts', 'Clear pay labels'],
      label: 'Phone screen showing two sample hospitality jobs with disclosed pay.',
      screen: <SearchScreen />,
    },
    {
      title: 'See why a job suits you',
      body: 'Each job explains its match in plain words, including the roles you do.',
      features: [
        'Several roles and experience',
        'Reasons you can read',
        'Estimates, never promises',
      ],
      label: 'Phone screen listing the reasons a sample job fits the person.',
      screen: <MatchScreen />,
    },
    {
      title: 'Share when you can work',
      body: 'Set your availability. Employers only learn whether you are free for a time they ask about.',
      features: [
        'Weekly hours and days off',
        'You control who can find you',
        'Unset stays unknown',
      ],
      label: 'Phone screen showing sample weekly availability.',
      screen: <AvailabilityScreen />,
    },
    {
      title: 'Reply on your terms',
      body: 'Invitations open a conversation only if you accept. They are not applications.',
      features: ['Accept or decline', 'Messages in one place', 'Block anyone, any time'],
      label: 'Phone screen showing a sample invitation with accept and decline buttons.',
      screen: <InvitationScreen />,
    },
  ],
  hire: [
    {
      title: 'Pick the role',
      body: 'Search 287 hospitality roles by name or common nickname, across 14 departments.',
      features: ['Role and nickname search', 'Venue types', 'Guided posting in three steps'],
      label: 'Phone screen showing a role search for a sample employer.',
      screen: <RoleScreen />,
    },
    {
      title: 'Check the pay',
      body: 'When you pick a role, your pay is compared with the award minimum before you publish. You confirm coverage and level.',
      features: [
        'Four hospitality awards',
        'Casual, part time and full time',
        'Hard stop below the minimum',
      ],
      label: 'Phone screen showing a sample pay check result.',
      screen: <PayCheckScreen />,
    },
    {
      title: 'Review applicants',
      body: 'Move people through a clear pipeline and keep every decision with you.',
      features: ['Simple pipeline', 'Private notes', 'Team roles for your staff'],
      label: 'Phone screen showing a sample applicant pipeline.',
      screen: <ApplicantsScreen />,
    },
    {
      title: 'Invite consenting talent',
      body: 'Find people who chose to be found, then invite them to a job. Nobody is ranked.',
      features: ['Only people who opt in', 'Invitations, not cold contact', 'Respect for a “no”'],
      label: 'Phone screen showing two sample people who chose to be found.',
      screen: <TalentScreen />,
    },
  ],
};

export function AppWalkthrough() {
  const [audience, setAudience] = useState<Audience>('jobs');
  const [index, setIndex] = useState(0);
  const steps = STEPS[audience];
  const step = steps[index] ?? steps[0]!;
  const choose = (a: Audience) => {
    setAudience(a);
    setIndex(0);
  };
  return (
    <div className="walk">
      <div className="journey-preview__switch" role="group" aria-label="Choose your experience">
        <button type="button" aria-pressed={audience === 'jobs'} onClick={() => choose('jobs')}>
          <BriefcaseBusiness size={18} aria-hidden="true" /> I’m looking for work
        </button>
        <button type="button" aria-pressed={audience === 'hire'} onClick={() => choose('hire')}>
          <Users size={18} aria-hidden="true" /> I’m hiring
        </button>
      </div>
      <div className="walk__body">
        <ol className="walk__steps" aria-label="Steps">
          {steps.map((s, i) => (
            <li key={s.title}>
              <button
                type="button"
                className="walk__step"
                aria-pressed={i === index}
                onClick={() => setIndex(i)}
              >
                <span className="walk__num" aria-hidden="true">
                  {i + 1}
                </span>
                <span>{s.title}</span>
              </button>
            </li>
          ))}
        </ol>
        <div className="walk__detail" aria-live="polite" aria-atomic="true">
          <h3>{step.title}</h3>
          <p>{step.body}</p>
          <ul className="walk__features">
            {step.features.map((f) => (
              <li key={f}>{f}</li>
            ))}
          </ul>
        </div>
        <Phone label={step.label}>{step.screen}</Phone>
      </div>
    </div>
  );
}
