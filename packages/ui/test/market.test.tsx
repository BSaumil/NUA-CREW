import { fireEvent, render, screen } from '@testing-library/react';
import { axe } from 'vitest-axe';
import { describe, expect, it } from 'vitest';
import {
  GatedSubmit,
  GuidedSetup,
  JobCard,
  MarketLocationFields,
  MarketPreviewNotice,
  MarketProvider,
  MarketRadios,
  SalaryDisclosure,
} from '../src';

const setup = (initial?: string) =>
  render(
    <MarketProvider capability="onboarding" {...(initial ? { initial } : {})}>
      <GuidedSetup
        action={() => {}}
        submitLabel="Create workspace"
        steps={[
          {
            title: 'Business',
            description: 'Where is it',
            content: (
              <>
                <MarketRadios />
                <MarketLocationFields />
                <MarketPreviewNotice />
              </>
            ),
          },
        ]}
      />
    </MarketProvider>,
  );

describe('country selection (employer)', () => {
  it('AU regression: existing field names, AUD, state codes, enabled submit', () => {
    const { container } = setup();
    expect(container.querySelector('input[name="abn"]')).not.toBeNull();
    expect(container.querySelector('input[name="suburb"]')).not.toBeNull();
    expect(container.querySelector('input[name="postcode"]')).not.toBeNull();
    const options = [...container.querySelectorAll('select[name="state"] option')].map(
      (o) => o.textContent,
    );
    expect(options).toEqual(['VIC', 'NSW', 'QLD', 'SA', 'WA', 'TAS', 'ACT', 'NT']);
    expect(
      (screen.getByRole('button', { name: 'Create workspace' }) as HTMLButtonElement).disabled,
    ).toBe(false);
    expect(screen.queryByTestId('market-preview-notice')).toBeNull();
  });

  it('NZ preview: NZ regions and NZBN, disabled submit with reason, no AU field names', () => {
    const { container } = setup();
    fireEvent.click(screen.getByLabelText(/New Zealand/));
    expect(container.querySelector('input[name="abn"]')).toBeNull();
    expect(container.querySelector('select[name="state"]')).toBeNull();
    expect(container.querySelector('input[name="nz_preview_identifier"]')).not.toBeNull();
    expect(screen.getByText('NZBN (optional)')).not.toBeNull();
    expect(screen.getByText('Auckland')).not.toBeNull();
    const submit = screen.getByRole('button', { name: 'Create workspace' }) as HTMLButtonElement;
    expect(submit.disabled).toBe(true);
    expect(
      document.getElementById(submit.getAttribute('aria-describedby') ?? '')?.textContent,
    ).toMatch(/being prepared/);
    expect(screen.getByTestId('market-preview-notice').textContent).toMatch(/NZD/);
    expect(screen.getByTestId('market-preview-notice').textContent).toMatch(/not assessed/);
  });

  it('unknown market fails closed without crashing or falling back to AU', () => {
    const { container } = setup('ZZ');
    expect(container.querySelector('input[name="abn"]')).toBeNull();
    expect(
      (screen.getByRole('button', { name: 'Create workspace' }) as HTMLButtonElement).disabled,
    ).toBe(true);
    expect(screen.getAllByText(/not set up yet/).length).toBeGreaterThan(0);
  });

  it('GatedSubmit stays disabled for a preview market', () => {
    render(
      <MarketProvider capability="job_publishing" initial="NZ">
        <form>
          <GatedSubmit>Save draft</GatedSubmit>
        </form>
      </MarketProvider>,
    );
    expect((screen.getByRole('button', { name: 'Save draft' }) as HTMLButtonElement).disabled).toBe(
      true,
    );
  });

  it('has no axe violations in AU and NZ states', async () => {
    const au = setup();
    expect(await axe(au.container)).toHaveNoViolations();
    fireEvent.click(screen.getByLabelText(/New Zealand/));
    expect(await axe(au.container)).toHaveNoViolations();
  });
});

describe('pay labelling across countries', () => {
  it('labels amounts with their ISO currency and never combines them', () => {
    const { container } = render(
      <>
        <SalaryDisclosure
          min="30"
          max="35"
          period="hour"
          currency="NZD"
          showCurrencyCode
          basis="disclosed"
        />
        <SalaryDisclosure min="30" period="hour" showCurrencyCode basis="disclosed" />
      </>,
    );
    const text = container.textContent ?? '';
    expect(text).toMatch(/NZD\s*30/);
    expect(text).toMatch(/AUD\s*30/);
    expect(text).not.toMatch(/65/);
  });

  it('shows a country badge only when the record country is verified', () => {
    const base = {
      id: 'j',
      title: 'Cook',
      employerName: 'Fictional',
      verification: 'verified' as const,
      employmentType: 'casual',
      payBasis: 'not_disclosed' as const,
    };
    const { rerender } = render(<JobCard job={base} href="/j" />);
    expect(screen.queryByText('New Zealand')).toBeNull();
    expect(screen.queryByText('Australia')).toBeNull();
    rerender(<JobCard job={{ ...base, verifiedCountry: 'NZ' }} href="/j" />);
    expect(screen.getByText('New Zealand')).not.toBeNull();
    rerender(<JobCard job={{ ...base, verifiedCountry: 'nowhere' }} href="/j" />);
    expect(screen.queryByText('New Zealand')).toBeNull();
  });
});
