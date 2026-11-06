import AxeBuilder from '@axe-core/playwright';
import { expect, test, type Page } from '@playwright/test';
import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { resolve } from 'node:path';

// Password reset and email verification through the real pages. Email goes to a local folder
// (development transport), so nothing is sent anywhere.
const CANDIDATE = 'http://localhost:3000';
const EMPLOYER = 'http://localhost:3001';
const API = 'http://localhost:8000';
const MAIL = resolve(__dirname, '../.mail');
const OLD = 'a-long-setup-password-123';
const NEW = 'a-different-passphrase-456';

type Mail = { to: string; subject: string; text: string };

function mailFor(address: string): Mail[] {
  if (!existsSync(MAIL)) return [];
  return readdirSync(MAIL)
    .sort()
    .map((f) => JSON.parse(readFileSync(resolve(MAIL, f), 'utf8')) as Mail)
    .filter((m) => m.to.toLowerCase() === address.toLowerCase());
}

async function linkFrom(address: string, subjectContains: string): Promise<string> {
  let found = '';
  await expect
    .poll(() => {
      const mail = mailFor(address)
        .filter((m) => m.subject.includes(subjectContains))
        .pop();
      found = mail?.text.match(/https?:\/\/\S+/)?.[0] ?? '';
      return found;
    })
    .not.toBe('');
  return found;
}

const unique = (tag: string) =>
  `${tag}-${Date.now()}-${Math.floor(Math.random() * 1e6)}@nua-crew.example.com`;

async function registerCandidate(page: Page, address: string) {
  await page.goto(`${CANDIDATE}/register`);
  await page.getByLabel('Full name', { exact: true }).fill('Recovery Tester');
  await page.getByLabel('Email', { exact: true }).fill(address);
  await page.getByLabel('Password', { exact: true }).fill(OLD);
  await page.getByRole('button', { name: 'Continue', exact: true }).click();
  await page.getByRole('checkbox').check();
  await page.getByRole('button', { name: 'Create free account', exact: true }).click();
  await expect(page).toHaveURL(/\/profile/);
}

async function noSeriousA11y(page: Page) {
  const results = await new AxeBuilder({ page }).analyze();
  expect(
    results.violations.filter((v) => v.impact === 'serious' || v.impact === 'critical'),
  ).toEqual([]);
}

test('a candidate confirms their email address from the emailed link', async ({
  page,
  browser,
}) => {
  const address = unique('verify');
  await registerCandidate(page, address);
  // Delivery is on in this environment, so the person is told the address is unconfirmed.
  await expect(page.getByText('Your email address is not confirmed yet.')).toBeVisible();

  const link = await linkFrom(address, 'Confirm your');
  expect(link.startsWith(`${CANDIDATE}/verify-email?token=`)).toBe(true);

  // Opening the link must not confirm anything: mail scanners open links. A person presses the button.
  const reader = await (await browser.newContext()).newPage();
  await reader.goto(link);
  await expect(reader.getByRole('heading', { name: 'Confirm your email address' })).toBeVisible();
  await noSeriousA11y(reader);
  await reader.getByRole('button', { name: 'Confirm my email address' }).click();
  await expect(reader.getByText('Your email address is confirmed.')).toBeVisible();

  await page.reload();
  await expect(page.getByText('Your email address is not confirmed yet.')).toHaveCount(0);

  // The link is single use.
  await reader.goto(link);
  await reader.getByRole('button', { name: 'Confirm my email address' }).click();
  await expect(reader.locator('p[role="alert"]')).toContainText('no longer valid');
});

test('a candidate resets a forgotten password; the old password and old link stop working', async ({
  page,
  browser,
}) => {
  const address = unique('reset');
  await registerCandidate(page, address);

  const fresh = await (await browser.newContext()).newPage();
  await fresh.goto(`${CANDIDATE}/login`);
  await fresh.getByRole('link', { name: 'Forgot your password?' }).click();
  await expect(fresh.getByRole('heading', { name: 'Reset your password' })).toBeVisible();
  await noSeriousA11y(fresh);
  await fresh.getByLabel('Email').fill(address);
  await fresh.getByRole('button', { name: 'Email me a reset link' }).click();
  const sent = 'If an account exists for that address, we have emailed a link';
  await expect(fresh.getByRole('status')).toContainText(sent);

  const link = await linkFrom(address, 'Reset your');
  await fresh.goto(link);
  await noSeriousA11y(fresh);
  await fresh.getByLabel('New password', { exact: true }).fill(NEW);
  await fresh.getByLabel('Repeat the new password').fill('not-the-same-passphrase');
  await fresh.getByRole('button', { name: 'Change password' }).click();
  await expect(fresh.locator('p[role="alert"]')).toContainText('do not match');

  await fresh.getByLabel('New password', { exact: true }).fill(NEW);
  await fresh.getByLabel('Repeat the new password').fill(NEW);
  await fresh.getByRole('button', { name: 'Change password' }).click();
  await expect(fresh.getByRole('status')).toContainText('Your password has been changed');

  // The new password works; the old one does not.
  await fresh.getByLabel('Password', { exact: true }).fill(OLD);
  await fresh.getByLabel('Email', { exact: true }).fill(address);
  await fresh.getByRole('button', { name: 'Log in' }).click();
  await expect(fresh.locator('p[role="alert"]')).toBeVisible();
  await fresh.getByLabel('Email', { exact: true }).fill(address);
  await fresh.getByLabel('Password', { exact: true }).fill(NEW);
  await fresh.getByRole('button', { name: 'Log in' }).click();
  await expect(fresh).toHaveURL(/\/jobs/);

  // The notice email went out, and the used link is dead.
  expect(mailFor(address).some((m) => m.subject.includes('was changed'))).toBe(true);
  const stale = await (await browser.newContext()).newPage();
  await stale.goto(link);
  await stale.getByLabel('New password', { exact: true }).fill('yet-another-passphrase-789');
  await stale.getByLabel('Repeat the new password').fill('yet-another-passphrase-789');
  await stale.getByRole('button', { name: 'Change password' }).click();
  await expect(stale.locator('p[role="alert"]')).toContainText('no longer valid');
});

test('asking for a reset reveals nothing about whether an account exists', async ({ page }) => {
  const ghost = unique('nobody');
  await page.goto(`${CANDIDATE}/forgot-password`);
  await page.getByLabel('Email').fill(ghost);
  await page.getByRole('button', { name: 'Email me a reset link' }).click();
  // Same message as for a real account, and no email is written.
  await expect(page.getByRole('status')).toContainText(
    'If an account exists for that address, we have emailed a link',
  );
  expect(mailFor(ghost)).toEqual([]);
});

test('an employer resets a forgotten password on the employer app', async ({ page, request }) => {
  const address = unique('boss');
  const created = await request.post(`${API}/v1/auth/register/employer`, {
    data: {
      email: address,
      password: OLD,
      full_name: 'Recovery Boss',
      organisation_name: 'Fictional Recovery Cafe',
      accept_terms: true,
      location: { name: 'Main', suburb: 'Fitzroy', state: 'VIC', postcode: '3065' },
    },
  });
  expect(created.status()).toBe(201);

  await page.goto(`${EMPLOYER}/login`);
  await page.getByRole('link', { name: 'Forgot your password?' }).click();
  await page.getByLabel('Email').fill(address);
  await page.getByRole('button', { name: 'Email me a reset link' }).click();
  await expect(page.getByRole('status')).toContainText('we have emailed a link');

  const link = await linkFrom(address, 'Reset your');
  expect(link.startsWith(`${EMPLOYER}/reset-password?token=`)).toBe(true);
  await page.goto(link);
  await page.getByLabel('New password', { exact: true }).fill(NEW);
  await page.getByLabel('Repeat the new password').fill(NEW);
  await page.getByRole('button', { name: 'Change password' }).click();
  await expect(page.getByRole('status')).toContainText('Your password has been changed');

  await page.getByLabel('Work email').fill(address);
  await page.getByLabel('Password', { exact: true }).fill(NEW);
  await page.getByRole('button', { name: 'Log in' }).click();
  await expect(page).not.toHaveURL(/\/login/);
  await expect(page.getByRole('heading', { name: 'Fictional Recovery Cafe' })).toBeVisible();
});
