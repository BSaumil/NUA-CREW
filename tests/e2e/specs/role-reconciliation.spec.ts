import { expect, test, type Page } from '@playwright/test';

const HIRE = 'http://localhost:3001';
const PASSWORD = 'nua-dev-password-1';

async function login(page: Page, email: string) {
  await page.goto(`${HIRE}/login`);
  await page.getByLabel(/email/i).fill(email);
  await page.getByLabel('Password').fill(PASSWORD);
  await page.getByRole('button', { name: 'Log in' }).click();
  await page.waitForURL((u) => !u.pathname.startsWith('/login'));
}

test('a job saved without a role gets one, with its pay check, from the overview', async ({
  browser,
}) => {
  const page = await (await browser.newContext()).newPage();
  await login(page, 'owner-a@nua-crew.example.com');
  const title = `E2E No-role ${Date.now()}`;
  await page.goto(`${HIRE}/jobs/new`);
  await page.getByLabel('Job title').fill(title);
  await page.getByLabel('Description').fill('Weekend table service.');
  await page.getByRole('button', { name: 'Save draft' }).click();
  await expect(page.getByRole('heading', { name: title })).toBeVisible();
  // Closed and role-bearing jobs are not offered this; a draft without a role is.
  await expect(page.getByRole('link', { name: 'Add role and pay check' })).toBeVisible();

  // The overview lists it, with a link that names the job.
  await page.goto(`${HIRE}/`);
  const gaps = page.getByRole('region', {
    name: /have no role or pay check|has no role or pay check/,
  });
  await expect(gaps).toContainText(title);
  await gaps.getByRole('link', { name: `Add role to ${title}` }).click();

  // The guided flow, in "existing job" mode: heading says so and no venue question is asked.
  await expect(
    page.getByRole('heading', { level: 1, name: 'Add a role and pay check to your job' }),
  ).toBeVisible();
  await page.getByLabel('Search roles').fill('waitstaff');
  await page.getByRole('button', { name: 'Search' }).click();
  await page.getByRole('link', { name: /^Waiter \/ Waitress,/ }).click();
  await page.getByRole('link', { name: /^Restaurant\s*MA000119/ }).click();
  await page.getByLabel('This award covers my business and this work').check();
  await page.getByLabel(/Level 2/).check();
  await page.getByLabel(/I’ve matched this to the real duties/).check();
  await page.getByLabel('Hourly rate (AUD, before super)').fill('34.50');
  await page.getByRole('button', { name: 'Check this pay' }).click();
  await expect(page.getByText('Meets the minimum as assessed', { exact: true })).toBeVisible();

  // It states exactly what will change, and does not ask for a new title or description.
  await expect(page.getByText('Its advertised minimum pay becomes')).toBeVisible();
  await expect(page.getByLabel('Job title shown to candidates')).toHaveCount(0);
  await page.getByRole('button', { name: 'Add role and pay check to this job' }).click();

  await expect(page.getByRole('status')).toContainText('Role and pay check added');
  await expect(page.getByRole('heading', { name: title })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Pay check' })).toBeVisible();
  await expect(page.getByRole('link', { name: 'Add role and pay check' })).toHaveCount(0);

  // Gone from the "no role" list (it stays in the main jobs table).
  await page.goto(`${HIRE}/`);
  await expect(page.getByRole('link', { name: title })).toBeVisible();
  await expect(page.getByRole('link', { name: `Add role to ${title}` })).toHaveCount(0);
});

test('viewers see the gap but are offered no way to change it', async ({ browser }) => {
  const owner = await (await browser.newContext()).newPage();
  await login(owner, 'owner-a@nua-crew.example.com');
  const title = `E2E Viewer gap ${Date.now()}`;
  await owner.goto(`${HIRE}/jobs/new`);
  await owner.getByLabel('Job title').fill(title);
  await owner.getByLabel('Description').fill('Weekend table service.');
  await owner.getByRole('button', { name: 'Save draft' }).click();
  await expect(owner.getByRole('heading', { name: title })).toBeVisible();

  const viewer = await (await browser.newContext()).newPage();
  await login(viewer, 'viewer-a@nua-crew.example.com');
  await viewer.goto(`${HIRE}/`);
  const gaps = viewer.getByRole('region', { name: /no role or pay check/ });
  await expect(gaps).toContainText(title);
  await expect(gaps.getByRole('link', { name: /^Add role/ })).toHaveCount(0);
});
