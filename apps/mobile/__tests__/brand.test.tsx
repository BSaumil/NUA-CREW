import { screen } from '@testing-library/react-native';
import { BrandLockup, BrandLogo, BrandMark, TAGLINE } from '../src/ui/brand';
import { renderApp } from './helpers';

describe('NUA CREW brand (approved kit, 2026-11-07)', () => {
  it('uses the approved tagline exactly', () => {
    expect(TAGLINE).toBe('Where Talent Meets Opportunity');
  });

  it('full logo has one accessible name that includes the tagline', async () => {
    await renderApp(<BrandLogo />);
    expect(
      screen.getByRole('image', { name: 'NUA CREW. Where Talent Meets Opportunity' }),
    ).toBeTruthy();
  });

  it('compact lockup is named NUA CREW and hides its decorative symbol', async () => {
    await renderApp(<BrandLockup />);
    expect(screen.getByLabelText('NUA CREW')).toBeTruthy();
    expect(screen.queryByRole('image')).toBeNull();
  });

  it('labels the symbol only when it stands alone', async () => {
    await renderApp(<BrandMark label="NUA CREW" />);
    expect(screen.getByRole('image', { name: 'NUA CREW' })).toBeTruthy();
  });
});
