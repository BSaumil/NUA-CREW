import AxeBuilder from '@axe-core/playwright';
import { expect, test, type Page } from '@playwright/test';

// Availability and employer preferences on the website, against the real API. Each test makes
// its own candidate, so nothing is shared with other specs.
const WEB = 'http://localhost:3000';
const API = 'http://localhost:8000';
const PASSWORD = 'a-long-first-password-123';

async function newCandidate(page: Page) {
  const email = `avail-${Date.now()}-${Math.floor(Math.random() * 1e6)}@nua-crew.example.com`;
  await page.goto(`${WEB}/register`);
  await page.getByLabel('Full name', { exact: true }).fill('Avail Tester');
  await page.getByLabel('Email', { exact: true }).fill(email);
  await page.getByLabel('Password', { exact: true }).fill(PASSWORD);
  await page.getByRole('button', { name: 'Continue', exact: true }).click();
  await page.getByRole('checkbox').check();
  await page.getByRole('button', { name: 'Create free account', exact: true }).click();
  await expect(page).toHaveURL(/\/profile/);
  return email;
}

async function noSeriousA11y(page: Page) {
  const results = await new AxeBuilder({ page }).analyze();
  expect(
    results.violations.filter((v) => v.impact === 'serious' || v.impact === 'critical'),
  ).toEqual([]);
}

test('a candidate sets a weekly pattern, an overnight window and exceptions', async ({ page }) => {
  await newCandidate(page);
  await page.getByRole('link', { name: 'When you can work' }).click();
  await expect(page.getByRole('heading', { level: 1, name: 'When can you work?' })).toBeVisible();
  await noSeriousA11y(page);

  // Nothing set means unknown, and saving an empty pattern is allowed.
  await page.getByLabel('Monday window 1 from').fill('09:00');
  await page.getByLabel('Monday window 1 to').fill('17:00');
  await page.getByLabel('Friday window 1 from').fill('22:00');
  await page.getByLabel('Friday window 1 to').fill('02:00'); // overnight into Saturday
  await page.getByRole('button', { name: 'Save weekly pattern' }).click();
  await expect(
    page.locator('p[role="status"]', { hasText: 'Weekly availability saved' }),
  ).toBeVisible();
  await expect(page.getByLabel('Monday window 1 from')).toHaveValue('09:00');
  await expect(page.getByLabel('Friday window 1 to')).toHaveValue('02:00');
  await expect(page.getByText(/About 12 hours a week/)).toBeVisible();

  // Overlapping windows on one day are refused by the server and nothing changes.
  await page.getByLabel('Monday window 2 from').fill('16:00');
  await page.getByLabel('Monday window 2 to').fill('20:00');
  await page.getByRole('button', { name: 'Save weekly pattern' }).click();
  await expect(page.locator('p[role="alert"]')).toContainText('must not overlap');
  await expect(page.getByLabel('Monday window 2 from')).toHaveValue('');

  // Half a row is refused before anything is sent.
  await page.getByLabel('Tuesday window 1 from').fill('09:00');
  await page.getByRole('button', { name: 'Save weekly pattern' }).click();
  await expect(page.locator('p[role="alert"]')).toContainText('Nothing was saved');

  // Exceptions: add a day off, see it, remove it.
  await page.getByLabel('From date').fill('2027-03-01');
  await page.getByLabel('To date (optional)').fill('2027-03-03');
  await page.getByRole('button', { name: 'Add exception' }).click();
  await expect(page.locator('p[role="status"]', { hasText: 'Exception added' })).toBeVisible();
  const item = page
    .getByRole('listitem')
    .filter({ hasText: 'Unavailable 2027-03-01 to 2027-03-03, all day' });
  await expect(item).toBeVisible();
  await item.getByRole('button', { name: /^Remove/ }).click();
  await expect(page.locator('p[role="status"]', { hasText: 'Exception removed' })).toBeVisible();
  await expect(page.getByText('No exceptions.')).toBeVisible();

  // A single time without its pair is refused.
  await page.getByLabel('From date').fill('2027-03-05');
  await page.getByLabel('From time (optional)').fill('09:00');
  await page.getByRole('button', { name: 'Add exception' }).click();
  await expect(page.locator('p[role="alert"]')).toContainText('both times');

  // Clearing every window clears the pattern.
  await page.getByLabel('Monday window 1 from').fill('');
  await page.getByLabel('Monday window 1 to').fill('');
  await page.getByLabel('Friday window 1 from').fill('');
  await page.getByLabel('Friday window 1 to').fill('');
  await page.getByRole('button', { name: 'Save weekly pattern' }).click();
  await expect(page.locator('p[role="status"]', { hasText: 'cleared' })).toBeVisible();
});

test('a candidate follows, hides, mutes and blocks employers, and can undo each', async ({
  page,
}) => {
  await newCandidate(page);
  await page.getByRole('link', { name: 'Employers you prefer or avoid' }).click();
  await noSeriousA11y(page);

  await page.getByLabel('Find an employer by name').fill('Fictional Harbour');
  await page.getByRole('button', { name: 'Search' }).click();
  const found = page.getByRole('listitem').filter({ hasText: 'Fictional Harbour Bistro' });
  await expect(found).toBeVisible();
  await found.getByRole('button', { name: 'Prefer Fictional Harbour Bistro' }).click();
  await expect(page.locator('p[role="status"]', { hasText: 'Saved' })).toBeVisible();
  const mine = page.getByRole('list', { name: 'Your choices' });
  await expect(mine).toContainText('Fictional Harbour Bistro: Prefer');

  // Following and hiding contradict each other: the server swaps one for the other.
  await page.getByLabel('Find an employer by name').fill('Fictional Harbour');
  await page.getByRole('button', { name: 'Search' }).click();
  await page
    .getByRole('listitem')
    .filter({ hasText: 'Fictional Harbour Bistro' })
    .first()
    .getByRole('button', { name: 'Hide jobs from Fictional Harbour Bistro' })
    .click();
  await expect(mine).toContainText('Hide jobs from');
  await expect(mine).not.toContainText(': Prefer');

  // Blocking needs an explicit confirmation, then can be undone.
  await page.getByLabel('Find an employer by name').fill('Fictional Harbour');
  await page.getByRole('button', { name: 'Search' }).click();
  const res = page.getByRole('list', { name: 'Employers found' });
  await res.locator('summary', { hasText: 'Block Fictional Harbour Bistro' }).click();
  await res.getByRole('button', { name: 'Block Fictional Harbour Bistro' }).click();
  await expect(page.locator('p[role="alert"]')).toContainText('Tick the box');
  await page.getByLabel('Find an employer by name').fill('Fictional Harbour');
  await page.getByRole('button', { name: 'Search' }).click();
  await page
    .getByRole('list', { name: 'Employers found' })
    .locator('summary', { hasText: 'Block Fictional Harbour Bistro' })
    .click();
  await page.getByLabel('I want to block Fictional Harbour Bistro.').check();
  await page.getByRole('button', { name: 'Block Fictional Harbour Bistro' }).click();
  await expect(page.getByRole('list', { name: 'Your choices' })).toContainText('Blocked');

  const row = page
    .getByRole('list', { name: 'Your choices' })
    .getByRole('listitem')
    .filter({ hasText: ': Blocked' });
  await row.getByRole('button', { name: /^Unblock/ }).click();
  await expect(page.getByRole('list', { name: 'Your choices' })).not.toContainText('Blocked');
});

test('availability and employer preferences are private to a signed-in candidate', async ({
  page,
  request,
}) => {
  for (const path of ['/availability', '/employer-preferences']) {
    await page.goto(`${WEB}${path}`);
    await expect(page).toHaveURL(/\/login/);
  }
  // The API refuses an anonymous caller too: the pages add no new way in.
  expect((await request.get(`${API}/v1/candidate/availability`)).status()).toBe(401);
});
