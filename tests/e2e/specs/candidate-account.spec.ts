import AxeBuilder from '@axe-core/playwright';
import { expect, test, type Browser, type Page } from '@playwright/test';
import { readFileSync } from 'node:fs';

// Candidate account settings and work preferences on the website, against the real API.
const WEB = 'http://localhost:3000';
const FIRST = 'a-long-first-password-123';
const SECOND = 'a-different-passphrase-456';

const unique = (tag: string) =>
  `${tag}-${Date.now()}-${Math.floor(Math.random() * 1e6)}@nua-crew.example.com`;

async function register(page: Page, address: string) {
  await page.goto(`${WEB}/register`);
  await page.getByLabel('Full name', { exact: true }).fill('Account Tester');
  await page.getByLabel('Email', { exact: true }).fill(address);
  await page.getByLabel('Password', { exact: true }).fill(FIRST);
  await page.getByRole('button', { name: 'Continue', exact: true }).click();
  await page.getByRole('checkbox').check();
  await page.getByRole('button', { name: 'Create free account', exact: true }).click();
  await expect(page).toHaveURL(/\/profile/);
}

async function logIn(browser: Browser, address: string, password: string) {
  const page = await (await browser.newContext()).newPage();
  await page.goto(`${WEB}/login`);
  await page.getByLabel('Email', { exact: true }).fill(address);
  await page.getByLabel('Password', { exact: true }).fill(password);
  await page.getByRole('button', { name: 'Log in', exact: true }).click();
  return page;
}

async function noSeriousA11y(page: Page) {
  const results = await new AxeBuilder({ page }).analyze();
  expect(
    results.violations.filter((v) => v.impact === 'serious' || v.impact === 'critical'),
  ).toEqual([]);
}

test('a candidate changes their password, downloads their data and signs out everywhere', async ({
  page,
  browser,
}) => {
  const address = unique('acct');
  await register(page, address);
  await page.getByRole('link', { name: 'Account, privacy and your data' }).click();
  await expect(page.getByRole('heading', { level: 1, name: 'Account and privacy' })).toBeVisible();
  await noSeriousA11y(page);

  // Wrong current password and a mismatch are refused with a reason.
  await page.getByLabel('Current password', { exact: true }).first().fill('not-my-password-123');
  await page.getByLabel('New password', { exact: true }).fill(SECOND);
  await page.getByLabel('Confirm new password').fill(SECOND);
  await page.getByRole('button', { name: 'Change password' }).click();
  await expect(page.locator('p[role="alert"]')).toBeVisible();

  await page.getByLabel('Current password', { exact: true }).first().fill(FIRST);
  await page.getByLabel('New password', { exact: true }).fill(SECOND);
  await page.getByLabel('Confirm new password').fill('something-else-entirely-1');
  await page.getByRole('button', { name: 'Change password' }).click();
  await expect(page.locator('p[role="alert"]')).toContainText('do not match');

  await page.getByLabel('Current password', { exact: true }).first().fill(FIRST);
  await page.getByLabel('New password', { exact: true }).fill(SECOND);
  await page.getByLabel('Confirm new password').fill(SECOND);
  await page.getByRole('button', { name: 'Change password' }).click();
  await expect(page.locator('p[role="status"]', { hasText: 'Password changed' })).toBeVisible();

  // The old password no longer works; the new one does.
  const oldTry = await logIn(browser, address, FIRST);
  await expect(oldTry).toHaveURL(/\/login/);
  const newTry = await logIn(browser, address, SECOND);
  await expect(newTry).not.toHaveURL(/\/login/);

  // The export is a real file containing this person's account and nothing is cached.
  const [download] = await Promise.all([
    page.waitForEvent('download'),
    page.getByRole('link', { name: 'Download my data' }).click(),
  ]);
  expect(download.suggestedFilename()).toBe('nua-crew-my-data.json');
  const path = await download.path();
  const exported = JSON.parse(readFileSync(path, 'utf8')) as Record<string, unknown>;
  expect(JSON.stringify(exported)).toContain(address);

  await page.getByRole('button', { name: 'Sign out everywhere' }).click();
  await expect(page).toHaveURL(/\/login/);
  await expect(page.locator('p[role="status"]')).toContainText('Signed out of all devices');
  await page.goto(`${WEB}/account`);
  await expect(page).toHaveURL(/\/login/);
});

test('a candidate deletes their account only with their password and a confirmation', async ({
  page,
  browser,
}) => {
  const address = unique('delete');
  await register(page, address);
  await page.goto(`${WEB}/account`);

  await page.getByLabel('Confirm with your password').fill('wrong-password-for-test');
  await page.getByLabel('I understand this permanently deletes my account.').check();
  await page.getByRole('button', { name: 'Delete everything' }).click();
  await expect(page.locator('p[role="alert"]')).toBeVisible();
  await expect(page).toHaveURL(/\/account/);

  // Without the tick the browser refuses to submit at all.
  await page.getByLabel('Confirm with your password').fill(FIRST);
  await page.getByRole('button', { name: 'Delete everything' }).click();
  await expect(page).toHaveURL(/\/account/);
  await expect(page.locator('p[role="status"]')).toHaveCount(0);

  await page.getByLabel('I understand this permanently deletes my account.').check();
  await page.getByRole('button', { name: 'Delete everything' }).click();
  await expect(page).toHaveURL(/\/login/);
  await expect(page.locator('p[role="status"]')).toContainText('deleted');

  const again = await logIn(browser, address, FIRST);
  await expect(again).toHaveURL(/\/login/);
});

test('work preferences save separately, stay private and control employer discovery', async ({
  page,
}) => {
  await register(page, unique('prefs'));
  await page.getByRole('link', { name: 'Work preferences and employer discovery' }).click();
  await expect(
    page.getByRole('heading', { level: 1, name: 'What kind of work do you want?' }),
  ).toBeVisible();
  await noSeriousA11y(page);

  // Saving with nothing chosen stores nothing and says so.
  await page.getByRole('button', { name: 'Save work preferences' }).click();
  await expect(page.locator('p[role="alert"]')).toContainText('Choose a kind of work');

  // A bad number names the field and saves nothing.
  await page.getByLabel('I am open to permanent work').check();
  await page.getByLabel('Lowest hourly pay you would consider').first().fill('lots');
  await page.getByRole('button', { name: 'Save work preferences' }).click();
  await expect(page.locator('p[role="alert"]')).toContainText('Nothing was saved');
  await expect(page.locator('p[role="alert"]')).toContainText('must be a number');

  await page.getByLabel('I am open to permanent work').check();
  await page.getByLabel('Employee').first().check();
  await page.getByLabel('Full-time').first().check();
  await page.getByLabel('Lowest hourly pay you would consider').first().fill('32.50');
  await page.getByLabel('Notice period (days)').fill('14');
  await page.getByRole('button', { name: 'Save work preferences' }).click();
  await expect(page.locator('p[role="status"]', { hasText: 'Saved' })).toBeVisible();

  // Values come back from the server, and the other kind was never created.
  await expect(page.getByLabel('Lowest hourly pay you would consider').first()).toHaveValue(
    '32.50',
  );
  await expect(page.getByLabel('Notice period (days)')).toHaveValue('14');
  await expect(page.getByLabel('I am open to temporary work')).not.toBeChecked();

  // Discovery is off by default, per kind, and only offered once the kind is on.
  await expect(page.getByText('Permanent work: employers cannot find you.')).toBeVisible();
  await page.getByRole('button', { name: /Let verified employers find me/ }).click();
  await expect(page.getByText('Permanent work: employers can find you.')).toBeVisible();

  // Turning the kind off withdraws that consent; turning it on again does not restore it.
  await page.getByLabel('I am open to permanent work').uncheck();
  await page.getByRole('button', { name: 'Save work preferences' }).click();
  await expect(page.locator('p[role="status"]', { hasText: 'Saved' })).toBeVisible();
  await expect(page.getByText('Permanent work: employers')).toHaveCount(0);
  await page.getByLabel('I am open to permanent work').check();
  await page.getByRole('button', { name: 'Save work preferences' }).click();
  await expect(page.getByText('Permanent work: employers cannot find you.')).toBeVisible();
});

test('the account and preference pages need a candidate login', async ({ page }) => {
  for (const path of ['/account', '/account/export', '/work-preferences']) {
    await page.goto(`${WEB}${path}`);
    await expect(page).toHaveURL(/\/login/);
  }
});
