import { render } from '@testing-library/react';
import { axe } from 'vitest-axe';
import { describe, expect, it } from 'vitest';
import {
  BrandLockup,
  Button,
  ButtonLink,
  CandidateNav,
  EmployerHeader,
  EmployerSidebar,
  EmptyState,
  JobCard,
  MatchBreakdown,
  SalaryDisclosure,
  ShiftCard,
  StatusBadge,
  TrustIndicator,
} from '../src';

const job = {
  id: 'j1',
  title: 'Barista',
  employerName: 'Fictional Cafe',
  verification: 'verified' as const,
  suburb: 'Fitzroy',
  state: 'VIC',
  employmentType: 'casual',
  payMin: '28.00',
  payMax: '32.00',
  payPeriod: 'hour',
  payBasis: 'disclosed' as const,
  superIncluded: false,
};

describe('accessibility (axe)', () => {
  const cases: [string, React.ReactElement][] = [
    [
      'page chrome',
      <>
        <CandidateNav current="discover" />
        <main>
          <h1>Jobs</h1>
          <JobCard job={job} href="/jobs/j1" />
        </main>
      </>,
    ],
    [
      'employer shell',
      <>
        <EmployerHeader />
        <main>
          <h1>Hire</h1>
          <EmployerSidebar current="jobs" />
        </main>
      </>,
    ],
    [
      'match + salary + trust',
      <main>
        <h1>Job</h1>
        <MatchBreakdown
          estimate={75}
          missingSkills={['Latte art']}
          components={[
            {
              key: 'skills',
              weight: 25,
              evaluated: true,
              score: 0.5,
              evidence: '1 of 2 skills',
              basis: 'self_declared',
            },
            {
              key: 'semantic',
              weight: 30,
              evaluated: false,
              score: null,
              evidence: 'Not enabled yet',
              basis: 'not_evaluated',
            },
          ]}
        />
        <SalaryDisclosure min="28" max="32" period="hour" basis="estimated" />
        <TrustIndicator status="unverified" />
        <ShiftCard
          title="Bar shift"
          venue="Fictional Pub"
          start="2026-11-01T09:00:00Z"
          end="2026-11-01T17:00:00Z"
          status="open"
        />
        <StatusBadge status="under_review" />
      </main>,
    ],
    [
      'empty + actions',
      <main>
        <h1>Applications</h1>
        <EmptyState
          title="No applications yet"
          description="Find a job."
          action={<ButtonLink href="/jobs">Browse jobs</ButtonLink>}
        />
        <Button type="button">Save</Button>
        <BrandLockup />
      </main>,
    ],
  ];
  it.each(cases)('%s has no axe violations', async (_n, ui) => {
    const { container } = render(ui);
    expect(await axe(container)).toHaveNoViolations();
  });
});

describe('truthful presentation', () => {
  it('labels estimated vs disclosed pay and never implies hire probability', () => {
    const a = render(<SalaryDisclosure min="28" max="32" period="hour" basis="estimated" />);
    expect(a.container.textContent).toContain('Estimated');
    const b = render(
      <SalaryDisclosure min="28" max="32" period="hour" basis="disclosed" superIncluded />,
    );
    expect(b.container.textContent).toContain('Disclosed');
    expect(b.container.textContent).toContain('incl. super');
    const m = render(<MatchBreakdown estimate={80} components={[]} />);
    expect(m.container.textContent).toMatch(/not a prediction of being hired/i);
  });
  it('does not claim endorsement for verified businesses and flags external listings', () => {
    const v = render(<TrustIndicator status="verified" />);
    expect(v.container.textContent).toMatch(/not an endorsement/i);
    const e = render(<TrustIndicator status={null} source="Example Feed" />);
    expect(e.container.textContent).toMatch(/not verified by NUA CREW/i);
  });
  it('shows undisclosed pay explicitly', () => {
    const r = render(<SalaryDisclosure basis="not_disclosed" />);
    expect(r.container.textContent).toBe('Pay not disclosed');
  });
});
