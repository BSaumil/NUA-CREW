import { expect, test, type Browser, type Page } from '@playwright/test';
import { mkdirSync } from 'node:fs';
import { resolve } from 'node:path';

const HIRE = 'http://localhost:3001';
const API = 'http://localhost:8000';
const PASSWORD = 'nua-dev-password-1';
const SHOTS = process.env.NUA_E2E_SCREENSHOTS ? resolve(process.env.NUA_E2E_SCREENSHOTS) : null;

async function shot(page: Page, name: string) {
  if (!SHOTS) return;
  mkdirSync(SHOTS, { recursive: true });
  await page.screenshot({ path: resolve(SHOTS, `${name}.png`), fullPage: true });
}

async function as(browser: Browser, base: string, email: string) {
  const page = await (
    await browser.newContext({ viewport: { width: 1100, height: 900 } })
  ).newPage();
  await page.goto(`${base}/login`);
  await page.getByLabel(/email/i).fill(email);
  await page.getByLabel('Password').fill(PASSWORD);
  await page.getByRole('button', { name: 'Log in' }).click();
  await page.waitForURL((u) => !u.pathname.startsWith('/login'));
  return page;
}

test('guided hospitality job: role search, award pay check, hard block, review, publish', async ({
  browser,
  request,
}) => {
  const owner = await as(browser, HIRE, 'owner-a@nua-crew.example.com');
  await owner.goto(`${HIRE}/jobs/new/guided`);
  await expect(owner.getByRole('heading', { name: 'What kind of venue is hiring?' })).toBeVisible();
  await shot(owner, 'employer-1-venue');
  await owner.getByRole('link', { name: /Restaurant \/ bistro/ }).click();

  // Role: synonyms resolve to canonical roles; no 287-item dropdown.
  await owner.getByLabel('Search roles').fill('waitstaff');
  await owner.getByRole('button', { name: 'Search' }).click();
  await expect(owner.getByRole('link', { name: /^Waiter \/ Waitress,/ })).toBeVisible();
  await expect(owner.getByText('also called “waitstaff”').first()).toBeVisible();
  await shot(owner, 'employer-2-role-search');
  await owner.getByRole('link', { name: /^Waiter \/ Waitress,/ }).click();

  // Award + classification are confirmed by the employer, never taken from the title.
  await owner.getByRole('link', { name: /^Restaurant\s*MA000119/ }).click();
  await owner.getByLabel('This award covers my business and this work').check();
  await owner.getByLabel(/Level 2/).check();
  await owner.getByLabel(/I’ve matched this to the real duties/).check();
  await owner.getByLabel('Hourly rate (AUD, before super)').fill('25.00');
  await owner.getByRole('button', { name: 'Check this pay' }).click();
  await expect(owner.getByText('Below the award minimum', { exact: true })).toBeVisible();
  await expect(owner.getByText('$33.85').first()).toBeVisible(); // casual L2 weekday minimum
  await expect(owner.getByRole('button', { name: 'Save draft' })).toHaveCount(0);
  await shot(owner, 'employer-3-pay-below-minimum');

  await owner.getByRole('link', { name: 'Change the rate' }).click();
  await owner.getByLabel('This award covers my business and this work').check();
  await owner.getByLabel(/Level 2/).check();
  await owner.getByLabel(/I’ve matched this to the real duties/).check();
  await owner.getByLabel('Hourly rate (AUD, before super)').fill('34.50');
  await owner.getByLabel('Top of range (optional)').fill('38.00');
  await owner.getByRole('button', { name: 'Check this pay' }).click();
  await expect(owner.getByText('Meets the minimum as assessed', { exact: true })).toBeVisible();
  await expect(owner.getByText('$40.62').first()).toBeVisible(); // Saturday/Sunday casual L2 minimum
  await expect(owner.getByText('What this check does not cover')).toBeVisible();
  await shot(owner, 'employer-4-pay-compliant');

  const title = `E2E Waiter ${Date.now()}`;
  await owner.getByLabel('Job title shown to candidates').fill(title);
  await owner.getByLabel('What will they do?').fill('Table service, weekends included.');
  await owner.getByLabel('Skills').fill('Customer Service');
  await owner.getByRole('button', { name: 'Save draft' }).click();
  await expect(owner.getByRole('status')).toContainText('Draft saved with its pay check');
  await expect(owner.getByRole('heading', { name: 'Pay check' })).toBeVisible();
  await shot(owner, 'employer-5-job-with-pay-check');
  await owner.getByRole('button', { name: 'Publish' }).click();
  await expect(owner.getByRole('status')).toContainText('Job published');

  // Public search can filter by the canonical role; the ad exposes the role, not a compliance claim.
  const found = await request.get(`${API}/v1/jobs`, { params: { role: 'HC-0060', q: 'waiter' } });
  const titles = ((await found.json()) as { items: { title: string }[] }).items.map((j) => j.title);
  expect(titles).toContain(title);
});

test('an underpaid role-based ad cannot be published even by calling the API directly', async ({
  browser,
  request,
}) => {
  const owner = await as(browser, HIRE, 'owner-a@nua-crew.example.com');
  const cookies = await owner.context().cookies();
  const token = cookies.find((c) => c.name === 'nua_employer_session')?.value;
  const headers = { Authorization: `Bearer ${token}` };
  const me = await (await request.get(`${API}/v1/auth/me`, { headers })).json();
  const eid = me.memberships[0].employer_id as string;
  const locs = await (
    await request.get(`${API}/v1/employers/${eid}/locations`, { headers })
  ).json();
  const assessed = await request.post(`${API}/v1/employers/${eid}/pay-assessments`, {
    headers,
    data: {
      state: locs[0].state,
      role_code: 'HC-0060',
      instrument: 'MA000119',
      coverage_confirmed: true,
      classification: 'L2',
      classification_confirmed: true,
      employment: 'casual',
      pay_period: 'hour',
      pay_amount: '20.00',
    },
  });
  const a = await assessed.json();
  expect(a.result.status).toBe('below_minimum');
  const job = await request.post(`${API}/v1/employers/${eid}/jobs`, {
    headers,
    data: {
      title: 'Underpaid waiter',
      description: 'Should never go live',
      employment_type: 'casual',
      location_id: locs[0].id,
      pay_min: '20.00',
      pay_max: '22.00',
      pay_period: 'hour',
      role_code: 'HC-0060',
      pay_assessment_id: a.id,
    },
  });
  expect(job.status()).toBe(201);
  const published = await request.post(
    `${API}/v1/employers/${eid}/jobs/${(await job.json()).id}/publish`,
    {
      headers,
    },
  );
  expect(published.status()).toBe(422);
  expect((await published.json()).error.code).toBe('below_award_minimum');
});
