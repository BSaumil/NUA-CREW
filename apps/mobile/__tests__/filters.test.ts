import {
  EMPTY_FILTERS,
  activeCount,
  describe as describeFilters,
  fromSaved,
  hasAnyFilter,
  roundCoord,
  toQuery,
  toSavedParams,
} from '../src/features/filters';

describe('toQuery', () => {
  it('sends nothing for empty filters and trims text', () => {
    expect(toQuery(EMPTY_FILTERS)).toEqual({ sort: 'relevance' });
    expect(toQuery({ ...EMPTY_FILTERS, q: '  barista ', suburb: ' Fitzroy ' })).toEqual({
      sort: 'relevance',
      q: 'barista',
      suburb: 'Fitzroy',
    });
  });
  it('includes coordinates and radius only while "near me" is on', () => {
    const f = {
      ...EMPTY_FILTERS,
      near: { lat: -37.81, lng: 144.96 },
      radius_km: 10,
      sort: 'distance' as const,
    };
    expect(toQuery(f)).toMatchObject({
      near_lat: -37.81,
      near_lng: 144.96,
      radius_km: 10,
      sort: 'distance',
    });
    expect(toQuery({ ...f, near: null })).not.toHaveProperty('near_lat');
  });
  it('never asks the server to sort by distance without a position', () => {
    expect(toQuery({ ...EMPTY_FILTERS, sort: 'distance' }).sort).toBe('newest');
  });
});

describe('badges and saved searches', () => {
  it('counts filters beyond the keyword box', () => {
    expect(activeCount(EMPTY_FILTERS)).toBe(0);
    expect(activeCount({ ...EMPTY_FILTERS, q: 'x' })).toBe(0);
    expect(
      activeCount({
        ...EMPTY_FILTERS,
        suburb: 'Fitzroy',
        employment_type: 'casual',
        min_hourly: 30,
        sort: 'pay',
      }),
    ).toBe(4);
    expect(hasAnyFilter({ ...EMPTY_FILTERS, q: 'x' })).toBe(true);
  });
  it('saved params contain only server-accepted keys and round-trip', () => {
    const f = {
      ...EMPTY_FILTERS,
      q: 'barista',
      employment_type: 'casual' as const,
      min_hourly: 30,
      near: { lat: -37.81, lng: 144.96 },
      radius_km: 5,
      sort: 'distance' as const,
    };
    const params = toSavedParams(f);
    expect(params).not.toHaveProperty('sort');
    expect(Object.keys(params).sort()).toEqual([
      'employment_type',
      'min_hourly',
      'near_lat',
      'near_lng',
      'q',
      'radius_km',
    ]);
    const back = fromSaved(params);
    expect(back).toMatchObject({
      q: 'barista',
      employment_type: 'casual',
      min_hourly: 30,
      near: { lat: -37.81, lng: 144.96 },
      radius_km: 5,
    });
  });
  it('describes filters in plain words', () => {
    expect(describeFilters(EMPTY_FILTERS)).toBe('All jobs');
    expect(
      describeFilters({ ...EMPTY_FILTERS, q: 'bar', employment_type: 'casual', min_hourly: 30 }),
    ).toBe('“bar” · Casual · $30+/h');
  });
  it('rounds coordinates to about a kilometre before they leave the phone', () => {
    expect(roundCoord(-37.81369)).toBe(-37.81);
    expect(roundCoord(144.96311)).toBe(144.96);
  });
});
