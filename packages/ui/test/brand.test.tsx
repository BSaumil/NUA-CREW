import { render, screen } from '@testing-library/react';
import { axe } from 'vitest-axe';
import { describe, expect, it } from 'vitest';
import { BrandLockup, BrandLogo, BrandMark, TAGLINE } from '../src';

describe('NUA CREW brand (approved kit, 2026-11-07)', () => {
  it('uses the approved tagline exactly', () => {
    expect(TAGLINE).toBe('Where Talent Meets Opportunity');
  });

  it('full logo names the brand and tagline once, for assistive tech', () => {
    render(<BrandLogo />);
    const img = screen.getByRole('img');
    expect(img.getAttribute('alt')).toBe('NUA CREW — Where Talent Meets Opportunity');
    expect(img.getAttribute('src')).toBe('/brand/nua-crew-logo.svg');
  });

  it('can be decorative when the words are already on the page', () => {
    const { container } = render(<BrandLogo decorative />);
    const img = container.querySelector('img')!;
    expect(img.getAttribute('alt')).toBe('');
    expect(img.getAttribute('aria-hidden')).toBe('true');
  });

  it('symbol is decorative beside the visible words, labelled when alone', () => {
    const decorative = render(<BrandMark />);
    expect(decorative.container.querySelector('img')!.getAttribute('aria-hidden')).toBe('true');
    const labelled = render(<BrandMark title="NUA Crew" />);
    expect(labelled.getByRole('img', { name: 'NUA Crew' })).toBeTruthy();
  });

  it('compact lockup keeps the live words NUA CREW and links home', () => {
    const { container } = render(<BrandLockup />);
    const link = container.querySelector('a')!;
    expect(link.getAttribute('aria-label')).toBe('NUA CREW home');
    expect(link.textContent).toBe('NUA CREW');
    expect(link.querySelector('img')!.getAttribute('src')).toBe('/brand/nua-crew-symbol.svg');
  });

  it('never repeats the tagline as text next to the full logo', () => {
    const { container } = render(<BrandLogo tile />);
    expect(container.textContent).toBe('');
  });

  it('has no axe violations', async () => {
    const { container } = render(
      <main>
        <header>
          <BrandLockup />
        </header>
        <footer>
          <BrandLogo tile />
        </footer>
      </main>,
    );
    expect(await axe(container)).toHaveNoViolations();
  });
});
