/**
 * Candidate side of the hospitality roles feature, on the shared Expo app's web build at a phone
 * viewport (react-native-web). This is a browser emulation of the app's screens against the real
 * API and DB, NOT a native device test; screenshots are labelled accordingly.
 */
import AxeBuilder from '@axe-core/playwright';
import { expect, test, type Page } from '@playwright/test';
import { mkdirSync } from 'node:fs';
import { resolve } from 'node:path';

const APP = 'http://localhost:8081';
const API = 'http://localhost:8000';
const WEB = 'http://localhost:3000';
const PASSWORD = 'nua-dev-password-1';
const SHOTS = process.env.NUA_E2E_SCREENSHOTS ? resolve(process.env.NUA_E2E_SCREENSHOTS) : null;

async function shot(page: Page, name: string) {
  if (!SHOTS) return;
  mkdirSync(SHOTS, { recursive: true });
  await page.screenshot({ path: resolve(SHOTS, `${name}.png`) });
}
const field = (page: Page, label: string) => page.locator(`[aria-label="${label}"]:visible`);
const tab = (page: Page, name: string) => page.getByRole('tab', { name: new RegExp(name) });

test.use({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2 });

test('candidate adds roles, sees the role on a real ad, and the match explains it', async ({
  page,
  request,
}) => {
  // An employer publishes a role-based ad through the real pay-check gate.
  const login = await request.post(`${API}/v1/auth/login`, {
    data: { email: 'owner-a@nua-crew.example.com', password: PASSWORD },
  });
  const auth = { Authorization: `Bearer ${(await login.json()).access_token}` };
  const me = await (await request.get(`${API}/v1/auth/me`, { headers: auth })).json();
  const eid = me.memberships[0].employer_id as string;
  const locs = await (
    await request.get(`${API}/v1/employers/${eid}/locations`, { headers: auth })
  ).json();
  const assessed = await (
    await request.post(`${API}/v1/employers/${eid}/pay-assessments`, {
      headers: auth,
      data: {
        state: locs[0].state,
        role_code: 'HC-0060',
        instrument: 'MA000119',
        coverage_confirmed: true,
        classification: 'L2',
        classification_confirmed: true,
        employment: 'casual',
        pay_period: 'hour',
        pay_amount: '34.50',
      },
    })
  ).json();
  expect(assessed.result.status).toBe('compliant_as_assessed');
  const title = `Floor Waiter ${Date.now()}`;
  const created = await (
    await request.post(`${API}/v1/employers/${eid}/jobs`, {
      headers: auth,
      data: {
        title,
        description: 'Table service in a busy dining room, weekends included.',
        employment_type: 'casual',
        category: 'Hospitality',
        location_id: locs[0].id,
        pay_min: '34.50',
        pay_max: '38.00',
        pay_period: 'hour',
        super_included: false,
        skills: ['Customer Service'],
        role_code: 'HC-0060',
        pay_assessment_id: assessed.id,
      },
    })
  ).json();
  const live = await request.post(`${API}/v1/employers/${eid}/jobs/${created.id}/publish`, {
    headers: auth,
  });
  expect(live.ok()).toBeTruthy();

  await page.goto(APP);
  await page.getByRole('button', { name: 'Skip' }).click();
  await field(page, 'Email').fill('candidate-a@nua-crew.example.com');
  await field(page, 'Password').fill(PASSWORD);
  await page.getByRole('button', { name: 'Log in' }).click();
  await expect(tab(page, 'Discover')).toBeVisible();

  // Roles you do: found through a synonym, added, experience set, saved.
  await tab(page, 'Profile').click();
  await page.getByRole('button', { name: 'Roles you do' }).click();
  await field(page, 'Search roles').fill('waitstaff');
  const add = page.getByRole('button', { name: /^Add Waiter \/ Waitress,/ });
  await expect(add).toBeVisible();
  await expect(page.getByText('also called “waitstaff”').first()).toBeVisible();
  await shot(page, 'mobile-1-role-search');
  await add.click();
  await page.getByRole('button', { name: 'More years of experience as Waiter / Waitress' }).click();
  await page.getByRole('button', { name: 'More years of experience as Waiter / Waitress' }).click();
  await page.getByRole('button', { name: 'More years of experience as Waiter / Waitress' }).click();
  await expect(page.getByText('3 yrs')).toBeVisible();
  const scan = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21aa']).analyze();
  expect(
    scan.violations.map(
      (v) =>
        `${v.id}: ${v.nodes
          .map((n) => n.target.join(' '))
          .slice(0, 2)
          .join(' | ')}`,
    ),
  ).toEqual([]);
  await page.getByRole('button', { name: 'Save my roles' }).click();
  await expect(page.getByText(/Saved\. Your job matches now use these roles/)).toBeVisible();
  await shot(page, 'mobile-2-my-roles');

  // The ad shows its role; the match explains role fit as self-declared.
  await page.goto(APP);
  await field(page, 'Search jobs').fill(title);
  const card = page.getByRole('button', { name: new RegExp(`^${title},`) });
  await expect(card).toBeVisible();
  await expect(
    page.getByText('Waiter / Waitress · Restaurant and fine-dining FOH').first(),
  ).toBeVisible();
  await shot(page, 'mobile-3-job-listing-with-role');
  await card.click();
  await page.getByRole('tab', { name: 'My match' }).click();
  await expect(page.getByText(/You listed Waiter \/ Waitress with 3 years/)).toBeVisible();
  await page.getByText(/You listed Waiter \/ Waitress with 3 years/).scrollIntoViewIfNeeded();
  await expect(page.getByText(/not a prediction of being hired/).first()).toBeVisible();
  await shot(page, 'mobile-4-match-explains-role');
});

test('candidate web: roles page', async ({ page }) => {
  await page.setViewportSize({ width: 1100, height: 900 });
  await page.goto(`${WEB}/login`);
  await page.getByLabel(/email/i).fill('candidate-a@nua-crew.example.com');
  await page.getByLabel('Password').fill(PASSWORD);
  await page.getByRole('button', { name: 'Log in' }).click();
  await page.waitForURL((u) => !u.pathname.startsWith('/login'));
  await page.goto(`${WEB}/profile/roles?q=barista`);
  await page
    .getByRole('button', { name: /^Add Barista/ })
    .first()
    .click();
  await expect(page.getByRole('status')).toContainText('Role added');
  await expect(page.getByRole('heading', { name: 'Your roles' })).toBeVisible();
  await shot(page, 'web-1-candidate-roles');
  // Removing one role must leave the others (the button carries its own role code).
  const removeButtons = page.getByRole('button', { name: /^Remove / });
  const before = await removeButtons.count();
  await page.getByRole('button', { name: /^Remove Barista/ }).click();
  await expect(page.getByRole('status')).toContainText('Role removed');
  await expect(page.getByRole('button', { name: /^Remove Barista/ })).toHaveCount(0);
  await expect(removeButtons).toHaveCount(before - 1);
});

test('employer in the shared app: role, award pay check, hard block, then a checked draft', async ({
  page,
}) => {
  await page.goto(APP);
  await page.getByRole('button', { name: 'Skip' }).click();
  await field(page, 'Email').fill('owner-a@nua-crew.example.com');
  await field(page, 'Password').fill(PASSWORD);
  await page.getByRole('button', { name: 'Log in' }).click();
  await page.getByRole('button', { name: /^Post a job\./ }).click();

  await field(page, 'Hospitality role (optional)').fill('waitstaff');
  await page.getByRole('button', { name: /^Use role Waiter \/ Waitress,/ }).click();
  await page
    .getByRole('button', { name: / · Fitzroy/ })
    .first()
    .click();
  await field(page, 'About the role').fill('Table service, weekends included.');
  await page.getByRole('button', { name: 'Continue to pay' }).click();

  await page.getByRole('button', { name: /^Restaurant/ }).click();
  await page.getByRole('button', { name: /^Level 2/ }).click();
  await page.getByRole('button', { name: 'This award covers my business and this work' }).click();
  await page.getByRole('button', { name: /I’ve matched this to the real duties/ }).click();
  await field(page, 'Hourly rate (AUD, before super)').fill('25.00');
  await page.getByRole('button', { name: 'Check this pay' }).click();
  await expect(page.getByText('✕ Below the award minimum')).toBeVisible();
  await expect(page.getByText('$33.85').first()).toBeVisible();
  await page.getByText(/Not covered by this check/).scrollIntoViewIfNeeded();
  await shot(page, 'mobile-5-employer-pay-below-minimum');

  // Saving is refused on the device, and the server would refuse it too (covered in the API suite).
  await page.getByRole('button', { name: 'Review advertisement' }).click();
  await page.getByRole('button', { name: 'Save draft', exact: true }).click();
  await expect(page.getByText(/below the award minimum\. Raise it before saving/)).toBeVisible();

  await page.getByRole('button', { name: 'Back' }).click();
  await field(page, 'Hourly rate (AUD, before super)').fill('34.50');
  await expect(page.getByText(/changed after the last check/)).toBeVisible();
  await page.getByRole('button', { name: 'Check this pay again' }).click();
  await expect(page.getByText('✓ Meets the minimum as assessed')).toBeVisible();
  await page.getByText(/Not covered by this check/).scrollIntoViewIfNeeded();
  await shot(page, 'mobile-6-employer-pay-compliant');
  await page.getByRole('button', { name: 'Review advertisement' }).click();
  await page.getByRole('button', { name: 'Save draft', exact: true }).click();
  await expect(page.getByText('Draft', { exact: true }).filter({ visible: true })).toBeVisible();
});
