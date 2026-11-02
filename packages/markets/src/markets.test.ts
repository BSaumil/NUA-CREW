import { describe, expect, it } from 'vitest';
import {
  CAPABILITIES,
  DEFAULT_SEARCH_MARKETS,
  allows,
  compareMoney,
  disabledReason,
  formatDate,
  formatMoney,
  formatPayRange,
  getMarket,
  isTimeZoneForMarket,
  listMarkets,
  makeEmployerEntity,
  makeWorkplaceJurisdiction,
  money,
  parseDecimalMoney,
  parseMarketPublicInfo,
  parseSearchMarkets,
  resolveMarketState,
  serialiseSearchMarkets,
  sumMoney,
  type Capability,
} from './index';

const caps = (on: Capability[]) =>
  Object.fromEntries(CAPABILITIES.map((c) => [c, on.includes(c)])) as Record<Capability, boolean>;
const nzInfo = (on: Capability[] = ['onboarding']) => ({
  countryCode: 'NZ',
  locale: 'en-NZ',
  currency: 'NZD',
  regionLabel: 'Region',
  employerIdentifierLabel: 'NZBN',
  capabilities: caps(on),
});
const auInfo = (on: Capability[]) => ({
  countryCode: 'AU',
  locale: 'en-AU',
  currency: 'AUD',
  regionLabel: 'State or territory',
  employerIdentifierLabel: 'ABN',
  capabilities: caps(on),
});

describe('registry lookup fails closed', () => {
  it('finds configured markets regardless of case and spacing', () => {
    expect(getMarket('AU')?.currency).toBe('AUD');
    expect(getMarket(' nz ')?.currency).toBe('NZD');
    expect(listMarkets().map((m) => m.code)).toEqual(['AU', 'NZ']);
  });

  it.each([
    'XX',
    '',
    'ANZ',
    'A',
    'constructor',
    '__proto__',
    'toString',
    'hasOwnProperty',
    null,
    undefined,
    61,
    {},
    [],
    true,
  ])('returns null for %p, with no fallback country', (input) => {
    expect(getMarket(input)).toBeNull();
  });

  it('keeps AU and NZ distinct in every field that differs legally or locally', () => {
    const au = getMarket('AU')!;
    const nz = getMarket('NZ')!;
    expect([au.locale, au.currency, au.phonePrefix]).toEqual(['en-AU', 'AUD', '+61']);
    expect([nz.locale, nz.currency, nz.phonePrefix]).toEqual(['en-NZ', 'NZD', '+64']);
    expect([au.identifier.label, nz.identifier.label]).toEqual(['ABN', 'NZBN']);
    expect([au.regionLabel, nz.regionLabel]).toEqual(['State or territory', 'Region']);
    expect(au.regions.every((r) => r.code)).toBe(true);
    // NZ region codes are not defined by the backend yet, so no NZ region option is submittable.
    expect(nz.regions.length).toBeGreaterThan(10);
    expect(nz.regions.some((r) => r.code !== undefined)).toBe(false);
    expect(au.identifier.pattern.test('12345678901')).toBe(true);
    expect(nz.identifier.pattern.test('1234567890123')).toBe(true);
    expect(nz.identifier.pattern.test('12345678901')).toBe(false);
  });
});

describe('market state: no local route to a transaction except the existing AU flow', () => {
  it('keeps the existing Australian flow unchanged', () => {
    const state = resolveMarketState('AU');
    expect(state).toMatchObject({ kind: 'supported-for-transactions', via: 'existing-flow' });
    for (const c of CAPABILITIES) expect(allows(state, c)).toBe(true);
  });

  it('keeps New Zealand in preview with a clear reason', () => {
    const state = resolveMarketState('NZ');
    expect(state.kind).toBe('preparing');
    for (const c of CAPABILITIES) {
      expect(allows(state, c)).toBe(false);
      expect(disabledReason(state, c)).toContain('New Zealand');
    }
  });

  it('blocks unknown markets without coercing to AU', () => {
    for (const input of ['XX', '', null, undefined, 7, 'constructor']) {
      const state = resolveMarketState(input);
      expect(state.kind).toBe('blocked');
      for (const c of CAPABILITIES) expect(allows(state, c)).toBe(false);
    }
  });

  it('never grants transactions to any other two-letter code, with or without bad server data', () => {
    const junk: unknown[] = [
      undefined,
      null,
      {},
      [],
      'yes',
      1,
      { countryCode: 'NZ' },
      { ...nzInfo(['billing']), currency: 'AUD' },
      { ...nzInfo(['billing']), employerIdentifierLabel: 'ABN' },
      { ...nzInfo(['billing']), capabilities: { ...caps(['billing']), shifts: 'true' } },
      { ...nzInfo(['billing']), capabilities: { onboarding: true } },
      { ...nzInfo(['billing']), countryCode: 'nz' },
    ];
    const letters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
    for (const a of letters) {
      for (const b of letters) {
        const code = a + b;
        if (code === 'AU') continue;
        for (const info of junk) {
          const state = resolveMarketState(code, info);
          expect(state.kind, `${code} with ${JSON.stringify(info)}`).not.toBe(
            'supported-for-transactions',
          );
        }
      }
    }
  });
});

describe('server capabilities are the only way to enable a new market', () => {
  it('enables exactly the capabilities the server states', () => {
    const state = resolveMarketState('NZ', nzInfo(['onboarding', 'job_publishing']));
    expect(state).toMatchObject({ kind: 'supported-for-transactions', via: 'server' });
    expect(allows(state, 'onboarding')).toBe(true);
    expect(allows(state, 'job_publishing')).toBe(true);
    expect(allows(state, 'shifts')).toBe(false);
    expect(allows(state, 'billing')).toBe(false);
    expect(disabledReason(state, 'billing')).toContain('has not been approved');
  });

  it('stays in preview when the server enables nothing', () => {
    expect(resolveMarketState('NZ', nzInfo([])).kind).toBe('preparing');
  });

  it('lets the server switch an Australian capability off', () => {
    const state = resolveMarketState('AU', auInfo([]));
    expect(state.kind).toBe('preparing');
    expect(allows(state, 'job_publishing')).toBe(false);
  });

  it('ignores information about a different country', () => {
    expect(resolveMarketState('NZ', auInfo(['billing'])).kind).toBe('preparing');
    expect(resolveMarketState('AU', nzInfo(['billing']))).toMatchObject({ via: 'existing-flow' });
  });

  it('rejects malformed server data with a reason', () => {
    expect(parseMarketPublicInfo(nzInfo(['billing']))).toMatchObject({ ok: true });
    for (const bad of [
      null,
      { ...nzInfo(), currency: 'AUD' },
      { ...nzInfo(), countryCode: 'XX' },
      { ...nzInfo(), locale: '' },
      { ...nzInfo(), regionLabel: ' ' },
      { ...nzInfo(), capabilities: null },
      { ...nzInfo(), capabilities: { onboarding: true, job_publishing: false, shifts: false } },
    ]) {
      const parsed = parseMarketPublicInfo(bad);
      expect(parsed.ok).toBe(false);
      if (!parsed.ok) expect(parsed.reason.length).toBeGreaterThan(3);
    }
  });
});

describe('jurisdiction concepts stay separate and explicit', () => {
  it('has no default workplace country', () => {
    expect(
      makeWorkplaceJurisdiction({ countryCode: undefined, timeZone: 'Australia/Melbourne' }),
    ).toBeNull();
    expect(makeWorkplaceJurisdiction({ countryCode: '', timeZone: 'Pacific/Auckland' })).toBeNull();
  });

  it('only accepts time zones and regions that belong to the chosen country', () => {
    expect(
      makeWorkplaceJurisdiction({
        countryCode: 'AU',
        regionCode: 'VIC',
        timeZone: 'Australia/Melbourne',
      }),
    ).toEqual({
      workplaceCountryCode: 'AU',
      workplaceRegionCode: 'VIC',
      timeZone: 'Australia/Melbourne',
    });
    expect(makeWorkplaceJurisdiction({ countryCode: 'NZ', timeZone: 'Pacific/Chatham' })).toEqual({
      workplaceCountryCode: 'NZ',
      timeZone: 'Pacific/Chatham',
    });
    expect(
      makeWorkplaceJurisdiction({ countryCode: 'NZ', timeZone: 'Australia/Melbourne' }),
    ).toBeNull();
    expect(
      makeWorkplaceJurisdiction({ countryCode: 'AU', timeZone: 'Pacific/Auckland' }),
    ).toBeNull();
    expect(
      makeWorkplaceJurisdiction({
        countryCode: 'AU',
        regionCode: 'XX',
        timeZone: 'Australia/Perth',
      }),
    ).toBeNull();
    expect(
      makeWorkplaceJurisdiction({
        countryCode: 'NZ',
        regionCode: 'AKL',
        timeZone: 'Pacific/Auckland',
      }),
    ).toBeNull();
    expect(isTimeZoneForMarket('AU', 'Australia/Nowhere')).toBe(false);
  });

  it('keeps candidate search intent separate and defaults only the search list', () => {
    expect(DEFAULT_SEARCH_MARKETS).toEqual(['AU']);
    expect(parseSearchMarkets(undefined)).toEqual(['AU']);
    expect(parseSearchMarkets('nz, AU ,AU,XX')).toEqual(['NZ', 'AU']);
    expect(parseSearchMarkets(['NZ', 7, null])).toEqual(['NZ']);
    expect(parseSearchMarkets('junk')).toEqual(['AU']);
    expect(serialiseSearchMarkets(['NZ', 'AU'])).toBe('NZ,AU');
    expect(makeEmployerEntity('NZ')).toEqual({ entityCountryCode: 'NZ', identifierType: 'NZBN' });
    expect(makeEmployerEntity('ZZ')).toBeNull();
  });
});

describe('money never mixes currencies', () => {
  it('requires integer minor units and an ISO currency', () => {
    expect(money(2395, 'NZD')).toEqual({ minor: 2395, currency: 'NZD' });
    for (const [m, c] of [
      [23.95, 'NZD'],
      ['2395', 'NZD'],
      [1, 'nz'],
      [1, 'NZDD'],
      [1, null],
      [NaN, 'AUD'],
    ] as const) {
      expect(money(m, c)).toBeNull();
    }
  });

  it('parses decimal strings exactly', () => {
    expect(parseDecimalMoney('23.95', 'NZD')).toEqual({ minor: 2395, currency: 'NZD' });
    expect(parseDecimalMoney('27', 'AUD')).toEqual({ minor: 2700, currency: 'AUD' });
    expect(parseDecimalMoney('0.1', 'AUD')).toEqual({ minor: 10, currency: 'AUD' });
    expect(parseDecimalMoney(27.5, 'AUD')).toEqual({ minor: 2750, currency: 'AUD' });
    expect(parseDecimalMoney('1000', 'JPY')).toEqual({ minor: 1000, currency: 'JPY' });
    for (const bad of ['23.955', '-1', '', 'abc', '1e3', null, undefined, -2]) {
      expect(parseDecimalMoney(bad, 'AUD')).toBeNull();
    }
  });

  it('refuses to add or compare different currencies', () => {
    const aud = money(1000, 'AUD')!;
    const nzd = money(1000, 'NZD')!;
    expect(sumMoney(aud, nzd)).toEqual({ ok: false, reason: 'currency-mismatch' });
    expect(compareMoney(aud, nzd)).toBeNull();
    expect(sumMoney(aud, aud)).toEqual({ ok: true, total: { minor: 2000, currency: 'AUD' } });
    expect(compareMoney(aud, money(1500, 'AUD')!)).toBe(-1);
  });

  it('labels amounts with the ISO code and never guesses a currency', () => {
    expect(formatMoney(money(2395, 'NZD')!, { locale: 'en-NZ', showCode: true })).toMatch(/NZD/);
    expect(formatMoney(money(2700, 'AUD')!, { locale: 'en-AU', showCode: true })).toMatch(/AUD/);
    expect(
      formatPayRange({ min: '27', max: '31.5', currency: 'AUD', period: 'hour', locale: 'en-AU' }),
    ).toMatch(/AUD.*27.*AUD.*31\.50.* per hour/);
    expect(formatPayRange({ min: '23.95', currency: 'NZD', locale: 'en-NZ' })).toMatch(/NZD/);
    expect(formatPayRange({ currency: 'AUD', locale: 'en-AU' })).toBeNull();
    expect(formatPayRange({ min: '27', currency: 'nope', locale: 'en-AU' })).toBeNull();
  });
});

describe('formatting takes explicit locale and zone', () => {
  it('uses the zone it is given, not a built-in country', () => {
    const instant = '2026-11-03T12:30:00Z';
    const nz = formatDate(instant, { locale: 'en-NZ', timeZone: 'Pacific/Auckland' });
    const au = formatDate(instant, { locale: 'en-AU', timeZone: 'Australia/Melbourne' });
    expect(nz).not.toBe(au);
  });

  it('shows a dash for invalid dates', () => {
    expect(formatDate('not a date', { locale: 'en-AU' })).toBe('—');
  });
});
