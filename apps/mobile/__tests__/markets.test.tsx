import { fireEvent, render, screen } from '@testing-library/react-native';
import {
  AU_STATES,
  gateFor,
  planSearch,
  resetSearchMarkets,
  toggleSearchMarket,
  useSearchMarkets,
} from '@/features/markets';
import { MarketChoice, SearchMarkets } from '@/ui/market';
import { ThemeProvider } from '@/theme/ThemeProvider';
import { Text } from 'react-native';
import { useState } from 'react';

const wrap = async (ui: React.ReactElement) => render(<ThemeProvider>{ui}</ThemeProvider>);

describe('market gate', () => {
  it('AU keeps the existing flow and the eight state codes', () => {
    expect(AU_STATES).toEqual(['VIC', 'NSW', 'QLD', 'SA', 'WA', 'TAS', 'ACT', 'NT']);
    expect(gateFor('AU', 'onboarding').allowed).toBe(true);
  });
  it('NZ is preview only and unknown fails closed', () => {
    const nz = gateFor('NZ', 'onboarding');
    expect(nz.allowed).toBe(false);
    expect(nz.reason).toMatch(/being prepared/);
    const zz = gateFor('ZZ', 'onboarding');
    expect(zz.allowed).toBe(false);
    expect(zz.state.kind).toBe('blocked');
  });
  it('NZ search is never requested; AU still is', () => {
    expect(planSearch(['NZ']).searchable).toEqual([]);
    expect(planSearch(['NZ']).unavailable[0]?.reason).toMatch(/not enabled yet/);
    expect(planSearch(['AU', 'NZ']).searchable).toEqual(['AU']);
  });
});

describe('market controls', () => {
  it('MarketChoice exposes radios with a checked state', async () => {
    function Harness() {
      const [v, setV] = useState('AU');
      return <MarketChoice legend="Business country" value={v} onChange={setV} />;
    }
    await wrap(<Harness />);
    const nz = screen.getByRole('radio', { name: /New Zealand \(NZD\) · preview/ });
    expect(
      screen.getByRole('radio', { name: /Australia \(AUD\)/ }).props.accessibilityState,
    ).toMatchObject({ checked: true });
    await fireEvent.press(nz);
    expect(
      screen.getByRole('radio', { name: /New Zealand/ }).props.accessibilityState,
    ).toMatchObject({ checked: true });
  });
  it('search markets are in memory, multi-select, and never empty', async () => {
    resetSearchMarkets();
    function Harness() {
      const m = useSearchMarkets();
      return (
        <>
          <SearchMarkets selected={m} onToggle={toggleSearchMarket} />
          <Text testID="m">{m.join(',')}</Text>
        </>
      );
    }
    await wrap(<Harness />);
    await fireEvent.press(screen.getByRole('checkbox', { name: /New Zealand/ }));
    expect(screen.getByTestId('m').props.children).toBe('AU,NZ');
    await fireEvent.press(screen.getByRole('checkbox', { name: /Australia/ }));
    await fireEvent.press(screen.getByRole('checkbox', { name: /New Zealand/ }));
    expect(screen.getByTestId('m').props.children).toBe('AU');
    resetSearchMarkets();
  });
});
