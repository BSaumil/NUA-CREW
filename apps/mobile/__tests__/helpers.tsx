import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render } from '@testing-library/react-native';
import type { ReactElement } from 'react';
import { FiltersProvider } from '../src/state/FiltersProvider';
import { ThemeProvider } from '../src/theme/ThemeProvider';

export async function renderApp(ui: ReactElement) {
  const client = new QueryClient({
    defaultOptions: {
      queries: { retry: false, gcTime: Infinity },
      mutations: { retry: false, gcTime: 0 },
    },
  });
  return {
    client,
    ...(await render(
      <QueryClientProvider client={client}>
        <ThemeProvider>
          <FiltersProvider>{ui}</FiltersProvider>
        </ThemeProvider>
      </QueryClientProvider>,
    )),
  };
}

export const job = (over: Record<string, unknown> = {}) => ({
  id: 'job-1',
  origin: 'direct',
  title: 'Barista',
  description: 'Make coffee',
  status: 'published',
  employment_type: 'casual',
  category: 'Hospitality',
  suburb: 'Fitzroy',
  state: 'VIC',
  postcode: '3065',
  pay_min: '28.00',
  pay_max: '32.00',
  pay_period: 'hour',
  pay_currency: 'AUD',
  super_included: false,
  pay_basis: 'disclosed',
  apply_url: null,
  attribution: null,
  published_at: new Date().toISOString(),
  expires_at: null,
  last_verified_at: new Date().toISOString(),
  skills: ['Barista'],
  employer: { id: 'e1', name: 'Fictional Cafe', verification_status: 'verified' },
  location_id: null,
  distance_km: null,
  ...over,
});

export const ok = (data: unknown) => ({ data, response: { ok: true, status: 200 } });
export const fail = (status: number, message: string) => ({
  error: { error: { code: 'x', message } },
  response: { ok: false, status },
});
