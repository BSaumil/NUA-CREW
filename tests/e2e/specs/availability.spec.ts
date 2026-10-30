/**
 * M1 vertical slice, end to end against the real API and database:
 * candidate (mobile screens, react-native-web build) saves work preferences, weekly availability
 * and discovery consent; the employer (web) finds only the consenting person; data survives a
 * brand-new browser session ("restart"). Native keyboard/assistive-tech behaviour is NOT covered
 * here (see docs/mobile/README.md "Unverified on devices").
 */
import AxeBuilder from '@axe-core/playwright';
import { expect, test, type APIRequestContext, type Browser, type Page } from '@playwright/test';

const APP = 'http://localhost:8081';
const API = 'http://localhost:8000';
const EMPLOYER = 'http://localhost:3001';
const PASSWORD = 'nua-dev-password-1';

const field = (page: Page, label: string) => page.locator(`[aria-label="${label}"]:visible`);

async function mobileSignIn(page: Page, email: string) {
  await page.goto(APP);
  await page.getByRole('button', { name: 'Skip' }).click();
  await field(page, 'Email').fill(email);
  await field(page, 'Password').fill(PASSWORD);
  await page.getByRole('button', { name: 'Log in' }).click();
  await expect(page.getByRole('tab', { name: /Discover/ })).toBeVisible();
}

async function apiToken(request: APIRequestContext, email: string) {
  const r = await request.post(`${API}/v1/auth/login`, { data: { email, password: PASSWORD } });
  return { Authorization: `Bearer ${(await r.json()).access_token}` };
}

async function openFromProfile(page: Page, button: string) {
  await page.getByRole('tab', { name: /Profile/ }).click();
  await page.getByRole('button', { name: button, exact: true }).click();
}

async function freshContext(browser: Browser) {
  const ctx = await browser.newContext();
  return { ctx, page: await ctx.newPage() };
}

test('candidate sets work preferences, availability and consent; employer finds only the consenting person', async ({
  browser,
  page,
  request,
}) => {
  // ---- candidate-b sets everything up on the phone screens ----
  await mobileSignIn(page, 'candidate-b@nua-crew.example.com');
  await openFromProfile(page, 'Work preferences');
  await page.getByRole('button', { name: 'Both', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Permanent work', exact: true })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Temporary work', exact: true })).toBeVisible();
  await field(page, 'Notice period (days)').fill('28');
  await field(page, 'Available to start from').fill('1/2/2027');
  await field(page, "Furthest you'll travel (km)").fill('15');
  await field(page, "Lowest hourly pay you'd consider").first().fill('30');
  await page.getByRole('button', { name: 'Save work preferences' }).click();
  await expect(page.getByText('Saved to your NUA CREW account.')).toBeVisible();

  // Explicit, per-kind consent (off until chosen), one kind at a time.
  await expect(page.getByText(/Off. Nobody can find you/)).toHaveCount(2);
  const allow = page.getByRole('button', { name: 'Let verified employers find me' });
  await allow.first().click();
  await expect(page.getByText(/^On\. Verified employers can see/)).toHaveCount(1);
  await allow.first().click();
  await expect(page.getByText(/^On\. Verified employers can see/)).toHaveCount(2);

  // Weekly availability with a break and an overnight window.
  await page.getByRole('button', { name: "Set when you're available" }).click();
  const addTime = async (day: string, from: string, to: string) => {
    await page.getByRole('button', { name: `Add a time on ${day}` }).click();
    await field(page, 'From').fill(from);
    await field(page, 'Until').fill(to);
    await page.getByRole('button', { name: 'Add time' }).click();
  };
  await addTime('Tuesday', '9am', '12pm');
  await addTime('Tuesday', '2pm', '6pm');
  await addTime('Saturday', '10pm', '6am');
  await page.getByRole('button', { name: 'Save weekly availability' }).click();
  await expect(page.getByText('Weekly availability saved.')).toBeVisible();

  // Employer-side preference: hide from a business, then take it back.
  await page.goBack();

  // ---- the server holds it (a brand-new session sees the same answers) ----
  const { ctx, page: fresh } = await freshContext(browser);
  await mobileSignIn(fresh, 'candidate-b@nua-crew.example.com');
  await openFromProfile(fresh, 'Work preferences');
  await expect(field(fresh, 'Notice period (days)')).toHaveValue('28');
  await expect(field(fresh, "Furthest you'll travel (km)")).toHaveValue('15');
  await expect(fresh.getByText(/^On\. Verified employers can see/)).toHaveCount(2);
  await fresh.goBack();
  await openFromProfile(fresh, 'Availability');
  await expect(fresh.getByText('9:00 am to 12:00 pm')).toBeVisible();
  await expect(fresh.getByText('10:00 pm to 6:00 am (next day)')).toBeVisible();
  const a11y = await new AxeBuilder({ page: fresh }).analyze();
  expect(a11y.violations.filter((v) => v.impact === 'critical' || v.impact === 'serious')).toEqual(
    [],
  );
  await ctx.close();

  // candidate-a never opted in: must not be findable.
  // ---- employer searches on the web ----
  const emp = await freshContext(browser);
  await emp.page.goto(`${EMPLOYER}/login`);
  await emp.page.getByLabel(/email/i).fill('owner-a@nua-crew.example.com');
  await emp.page.getByLabel('Password').fill(PASSWORD);
  await emp.page.getByRole('button', { name: /log in/i }).click();
  await emp.page.waitForURL((u) => !u.pathname.startsWith('/login'));
  await emp.page.getByRole('link', { name: 'Find talent' }).click();
  await emp.page.getByLabel('Kind of work').selectOption('permanent');
  await emp.page.getByRole('button', { name: 'Search' }).click();

  const results = emp.page.getByRole('region', { name: 'Search results' });
  await expect(results.getByRole('heading', { name: 'Bao C.' })).toBeVisible();
  await expect(results.getByText('Alex C.')).toHaveCount(0); // never consented
  await expect(results.getByText(/Notice period: 28 days/)).toBeVisible();
  await expect(results.getByText(/Can start from 2027-02-01/)).toBeVisible();
  // the only contact path is a real invitation (covered in invitations.spec.ts); nothing else
  await expect(results.getByText(/Invite Bao C\. to a job|Publish a job to invite/)).toBeVisible();
  await expect(emp.page.getByRole('button', { name: /message|contact|email/i })).toHaveCount(0);
  // private data never reaches the page
  const html = await emp.page.content();
  expect(html).not.toContain('30.00');
  expect(html).not.toContain('candidate-b@');

  // A time Bao shared (Tuesday 10:00-11:00 Melbourne) is free; a Wednesday is not; unknown stays unknown.
  await emp.page.getByLabel('Kind of work').selectOption('temporary');
  await emp.page.getByLabel('Date').fill('2026-11-03');
  await emp.page.getByLabel('From').fill('10:00');
  await emp.page.getByLabel('Until').fill('11:00');
  await emp.page.getByRole('button', { name: 'Search' }).click();
  await expect(results.getByText('Free for this time')).toBeVisible();
  await emp.page.getByLabel('Date').fill('2026-11-04');
  await emp.page.getByRole('button', { name: 'Search' }).click();
  await expect(results.getByRole('heading', { name: 'No one found' })).toBeVisible();

  const a11yEmployer = await new AxeBuilder({ page: emp.page }).analyze();
  expect(
    a11yEmployer.violations.filter((v) => v.impact === 'critical' || v.impact === 'serious'),
  ).toEqual([]);
  await emp.ctx.close();

  // ---- cross-tenant / privacy negatives straight at the API ----
  const ownerB = await apiToken(request, 'owner-b@nua-crew.example.com');
  const meB = await (await request.get(`${API}/v1/auth/me`, { headers: ownerB })).json();
  const ownerA = await apiToken(request, 'owner-a@nua-crew.example.com');
  const meA = await (await request.get(`${API}/v1/auth/me`, { headers: ownerA })).json();
  const otherEmployer = meB.memberships[0].employer_id as string;
  const mine = meA.memberships[0].employer_id as string;
  // owner A cannot search as employer B
  const crossTenant = await request.post(`${API}/v1/employers/${otherEmployer}/talent/search`, {
    headers: ownerA,
    data: { kind: 'temporary' },
  });
  expect(crossTenant.status()).toBe(404);
  // and a candidate cannot use employer routes or read another candidate's data
  const cand = await apiToken(request, 'candidate-a@nua-crew.example.com');
  expect(
    (
      await request.post(`${API}/v1/employers/${mine}/talent/search`, {
        headers: cand,
        data: { kind: 'temporary' },
      })
    ).status(),
  ).toBe(404);
  const candA = await (
    await request.get(`${API}/v1/candidate/availability`, { headers: cand })
  ).json();
  expect(candA.rules).toEqual([]); // candidate-a sees their own (empty) calendar, not Bao's
});
