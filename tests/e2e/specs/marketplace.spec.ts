import { expect, test, type Browser, type Page } from '@playwright/test';

const WEB = 'http://localhost:3000';
const HIRE = 'http://localhost:3001';
const PASSWORD = 'nua-dev-password-1';

async function login(page: Page, base: string, email: string) {
  await page.goto(`${base}/login`);
  await page.getByLabel(/email/i).fill(email);
  await page.getByLabel('Password').fill(PASSWORD);
  await page.getByRole('button', { name: 'Log in' }).click();
  await page.waitForURL((u) => !u.pathname.startsWith('/login'));
}

async function as(browser: Browser, base: string, email: string) {
  const context = await browser.newContext();
  const page = await context.newPage();
  await login(page, base, email);
  return page;
}

test('employer posts, candidate applies, employer advances, candidate sees it; tenants stay isolated', async ({
  browser,
}) => {
  const title = `E2E Barista ${Date.now()}`;

  // 1. Seeded verified employer creates and publishes a job with disclosed pay.
  const owner = await as(browser, HIRE, 'owner-a@nua-crew.example.com');
  await expect(owner.getByRole('heading', { name: 'Fictional Laneway Cafe' })).toBeVisible();
  await owner.getByRole('link', { name: 'Post a job' }).click();
  await owner.getByLabel('Job title').fill(title);
  await owner
    .getByLabel('Description')
    .fill('Pull espresso shots and look after regulars on weekday mornings.');
  await owner.getByLabel('From', { exact: true }).fill('29');
  await owner.getByLabel('To', { exact: true }).fill('33');
  await owner.getByLabel('Skills').fill('Barista, Customer Service');
  await owner.getByRole('button', { name: 'Save draft' }).click();
  await expect(owner.getByRole('heading', { name: title })).toBeVisible();
  await owner.getByRole('button', { name: 'Publish' }).click();
  await expect(owner.getByRole('status')).toContainText('Job published');
  const jobUrl = owner.url().split('?')[0]!;

  // 2. Candidate finds it by search, sees disclosed pay and an explainable estimate, applies.
  const cand = await as(browser, WEB, 'candidate-a@nua-crew.example.com');
  await cand.goto(`${WEB}/jobs?q=${encodeURIComponent(title)}`);
  await cand.getByRole('link', { name: title }).click();
  await expect(cand.getByText('Disclosed', { exact: true })).toBeVisible();
  await expect(cand.getByText('Verified business')).toBeVisible();
  await expect(cand.getByText(/not a prediction of being hired/i)).toBeVisible();
  await cand.getByLabel('Resume').selectOption({ index: 1 });
  await cand.getByLabel(/Note to the employer/).fill('Happy to start next week.');
  await cand.getByRole('button', { name: 'Submit application' }).click();
  await expect(cand.getByRole('status')).toContainText('Application submitted');
  await expect(cand.getByText('Status:')).toContainText('Submitted');
  const appUrl = cand.url().split('?')[0]!;

  // Applying twice is not possible: the job page now links to the existing application.
  await cand.goto(`${WEB}/jobs?q=${encodeURIComponent(title)}`);
  await cand.getByRole('link', { name: title }).click();
  await expect(cand.getByText('You applied for this job.')).toBeVisible();

  // 3. Employer sees the applicant and advances the status.
  await owner.goto(jobUrl);
  await owner.getByRole('link', { name: 'Alex Candidate' }).click();
  await expect(owner.getByText('Happy to start next week.')).toBeVisible();
  const applicantUrl = owner.url().split('?')[0]!;
  await owner.getByRole('button', { name: 'Start review' }).click();
  await expect(owner.getByRole('status')).toContainText('candidate has been notified');

  // 4. The candidate's status reflects the employer's action.
  await cand.goto(appUrl);
  await expect(cand.getByText('Status:')).toContainText('Under review');
  await expect(cand.getByText('The employer updated your status')).toBeVisible();

  // 5. Isolation: another employer / candidate cannot open these records.
  const other = await as(browser, HIRE, 'owner-b@nua-crew.example.com');
  const r = await other.goto(applicantUrl);
  expect(r?.status()).toBe(404);
  await other.goto(`${HIRE}/`);
  await expect(other.getByRole('link', { name: title })).toHaveCount(0);
  const otherCand = await as(browser, WEB, 'candidate-b@nua-crew.example.com');
  expect((await otherCand.goto(appUrl))?.status()).toBe(404);
});

test('viewer role is read-only in the employer portal', async ({ browser }) => {
  const viewer = await as(browser, HIRE, 'viewer-a@nua-crew.example.com');
  await expect(viewer.getByRole('heading', { name: 'Fictional Laneway Cafe' })).toBeVisible();
  await expect(viewer.getByRole('link', { name: 'Post a job' })).toHaveCount(0);
});

test('unauthenticated users are sent to log in and see no private data', async ({ page }) => {
  await page.goto(`${HIRE}/`);
  await expect(page).toHaveURL(/\/login/);
  await page.goto(`${WEB}/applications`);
  await expect(page).toHaveURL(/\/login/);
});

test('employer edits a live job, unpublishes it, then republishes; viewers cannot', async ({
  browser,
}) => {
  const stamp = Date.now();
  const title = `E2E Edit ${stamp}`;
  const renamed = `E2E Edited ${stamp}`;
  const owner = await as(browser, HIRE, 'owner-a@nua-crew.example.com');
  await owner.goto(`${HIRE}/jobs/new`);
  await owner.getByLabel('Job title').fill(title);
  await owner.getByLabel('Description').fill('Weekend shifts on the machine.');
  await owner.getByRole('button', { name: 'Save draft' }).click();
  await owner.getByRole('button', { name: 'Publish' }).click();
  await expect(owner.getByRole('status')).toContainText('Job published');
  const jobUrl = owner.url().split('?')[0]!;

  // Edit in place: new title, newly disclosed pay.
  await owner.getByRole('link', { name: 'Edit' }).click();
  await expect(owner.getByRole('note')).toContainText('This job is live');
  await owner.getByLabel('Job title').fill(renamed);
  await owner.getByLabel('From', { exact: true }).fill('30');
  await owner.getByLabel('To', { exact: true }).fill('34');
  await owner.getByRole('button', { name: 'Save changes' }).click();
  await expect(owner.getByRole('status')).toContainText('Changes saved');
  await expect(owner.getByRole('heading', { name: renamed })).toBeVisible();

  const anon = await (await browser.newContext()).newPage();
  const search = `${WEB}/jobs?q=${encodeURIComponent(renamed)}`;
  await anon.goto(search);
  await expect(anon.getByRole('link', { name: renamed })).toBeVisible();

  // Unpublish: gone from public search, still editable by the employer.
  await owner.getByRole('button', { name: 'Unpublish' }).click();
  await expect(owner.getByRole('status')).toContainText('Job unpublished');
  await anon.goto(search);
  await expect(anon.getByRole('link', { name: renamed })).toHaveCount(0);

  // Republish brings it back.
  await owner.getByRole('button', { name: 'Publish' }).click();
  await expect(owner.getByRole('status')).toContainText('Job published');
  await anon.goto(search);
  await expect(anon.getByRole('link', { name: renamed })).toBeVisible();

  // A read-only team member sees no editing controls.
  const viewer = await as(browser, HIRE, 'viewer-a@nua-crew.example.com');
  await viewer.goto(jobUrl);
  await expect(viewer.getByRole('heading', { name: renamed })).toBeVisible();
  await expect(viewer.getByRole('link', { name: 'Edit' })).toHaveCount(0);
  await expect(viewer.getByRole('button', { name: 'Unpublish' })).toHaveCount(0);
});
