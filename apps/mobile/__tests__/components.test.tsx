import { fireEvent, screen } from '@testing-library/react-native';
import type { Schemas } from '@nua-crew/contracts';
import {
  Button,
  EmptyState,
  ErrorState,
  JobCard,
  MatchBreakdown,
  PayLine,
  StatusBadge,
  TrustBadge,
} from '../src/ui';
import { job, renderApp } from './helpers';

type Job = Schemas['JobOut'];
const j = (o = {}) => job(o) as unknown as Job;

describe('JobCard', () => {
  it('shows verification honestly and labels pay as disclosed', async () => {
    await renderApp(
      <JobCard job={j()} saved={false} onToggleSave={jest.fn()} onPress={jest.fn()} />,
    );
    expect(screen.getByText('Barista')).toBeOnTheScreen();
    expect(screen.getByText(/Verified business · not an endorsement/)).toBeOnTheScreen();
    expect(screen.getByText('Disclosed')).toBeOnTheScreen();
    expect(screen.getByText('$28–$32 / hour')).toBeOnTheScreen();
    expect(screen.getByText('(plus super)')).toBeOnTheScreen();
  });

  it('never presents an externally listed job as verified', async () => {
    await renderApp(
      <JobCard
        job={j({
          employer: { id: null, name: 'Fictional Pub Group', verification_status: null },
          attribution: 'Example Feed',
          origin: 'ingested',
        })}
        saved={false}
        onToggleSave={jest.fn()}
        onPress={jest.fn()}
      />,
    );
    expect(
      screen.getByText(/Listed via Example Feed · not verified by NUA CREW/),
    ).toBeOnTheScreen();
    expect(screen.queryByText(/Verified business/)).toBeNull();
  });

  it('says so plainly when pay was not disclosed, and marks estimates', async () => {
    const { unmount } = await renderApp(
      <PayLine
        job={j({ pay_min: null, pay_max: null, pay_period: null, pay_basis: 'not_disclosed' })}
      />,
    );
    expect(screen.getByText('Pay not disclosed')).toBeOnTheScreen();
    await unmount();
    await renderApp(<PayLine job={j({ pay_basis: 'estimated' })} />);
    expect(screen.getByText('Estimated')).toBeOnTheScreen();
    expect(screen.queryByText('Disclosed')).toBeNull();
  });

  it('exposes one accessible description, and separate save and open actions', async () => {
    const onPress = jest.fn();
    const onToggle = jest.fn();
    await renderApp(
      <JobCard
        job={j({ distance_km: 2.4 })}
        saved={false}
        onToggleSave={onToggle}
        onPress={onPress}
      />,
    );
    const open = screen.getByRole('button', {
      name: /Barista, Fictional Cafe, Fitzroy, VIC, Casual, \$28–\$32 \/ hour/,
    });
    expect(open).toBeOnTheScreen();
    expect(screen.getByText(/2\.4 km away/)).toBeOnTheScreen();
    await fireEvent.press(open);
    expect(onPress).toHaveBeenCalledTimes(1);
    await fireEvent.press(screen.getByRole('button', { name: 'Save Barista' }));
    expect(onToggle).toHaveBeenCalledTimes(1);
  });

  it('reflects the saved state for assistive tech', async () => {
    await renderApp(<JobCard job={j()} saved onToggleSave={jest.fn()} onPress={jest.fn()} />);
    expect(screen.getByRole('button', { name: 'Remove Barista from saved jobs' })).toBeSelected();
  });
});

describe('MatchBreakdown', () => {
  const match = {
    job_id: 'job-1',
    estimate: 75,
    label: 'Estimated match — not a prediction of being hired',
    gates: [],
    missing_skills: ['Latte art'],
    components: [
      {
        key: 'skills',
        weight: 25,
        evaluated: true,
        score: 0.5,
        evidence: '1 of 2 listed skills are on your profile.',
        basis: 'self_declared',
      },
      {
        key: 'semantic',
        weight: 30,
        evaluated: false,
        score: null,
        evidence: 'Semantic matching is not enabled yet.',
        basis: 'not_evaluated',
      },
    ],
  } as unknown as Schemas['MatchOut'];

  it('is an estimate, shows evidence, and does not invent scores for what was not evaluated', async () => {
    await renderApp(<MatchBreakdown match={match} />);
    expect(screen.getByText('75% estimate')).toBeOnTheScreen();
    expect(screen.getByText(/not a prediction of being hired/)).toBeOnTheScreen();
    expect(screen.getByText('Not evaluated')).toBeOnTheScreen();
    expect(screen.getByText('Semantic matching is not enabled yet.')).toBeOnTheScreen();
    expect(screen.getByText(/Latte art/)).toBeOnTheScreen();
    expect(screen.getByLabelText(/Skills: 50 percent/)).toBeOnTheScreen();
  });

  it('admits when there is not enough information', async () => {
    await renderApp(<MatchBreakdown match={{ ...match, estimate: null, components: [] }} />);
    expect(screen.getByText('Not enough information')).toBeOnTheScreen();
  });
});

describe('small components', () => {
  it('trust badge never claims endorsement', async () => {
    await renderApp(<TrustBadge status="pending" />);
    expect(screen.getByText('Verification in review')).toBeOnTheScreen();
  });
  it('status badges use human wording', async () => {
    await renderApp(<StatusBadge status="rejected" />);
    expect(screen.getByText('Not progressed')).toBeOnTheScreen();
  });
  it('every button has an accessible name and respects disabled/busy state', async () => {
    const onRetry = jest.fn();
    await renderApp(
      <>
        <Button title="Save profile" onPress={jest.fn()} />
        <Button title="Working" loading onPress={jest.fn()} />
        <EmptyState
          title="Nothing here"
          body="Try again later"
          action={{ label: 'Browse jobs', onPress: jest.fn() }}
        />
        <ErrorState message="Boom" onRetry={onRetry} />
      </>,
    );
    for (const b of screen.getAllByRole('button')) expect(b).toHaveAccessibleName();
    expect(screen.getByRole('button', { name: 'Working' })).toBeDisabled();
    await fireEvent.press(screen.getByRole('button', { name: 'Try again' }));
    expect(onRetry).toHaveBeenCalled();
  });
});
