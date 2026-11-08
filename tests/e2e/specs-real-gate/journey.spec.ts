import { expect, test, type Browser, type Page } from '@playwright/test';
import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { resolve } from 'node:path';

/**
 * Stage C/D: the whole sign-up and posting journey on the SHIPPED gates (see
 * playwright.real-gate.config.ts), starting from marketing call-to-action clicks, never from a
 * typed deep link. Real web apps, real API, real Postgres, real RLS. The only shortcut is reading
 * the local file mailbox, because no email provider is approved. Nothing here proves live delivery.
 */
const SITE = 'http://localhost:3002';
const WEB = 'http://localhost:3000';
const HIRE = 'http://localhost:3001';
const MAIL = resolve(__dirname, '../.mail');
const PASSWORD = 'a-long-setup-password-123';
const ADMIN = { email: 'admin@nua-crew.example.com', password: 'nua-dev-password-1' };

type Mail = { to: string; subject: string; text: string };

function mailFor(address: string): Mail[] {
  if (!existsSync(MAIL)) return [];
  return readdirSync(MAIL)
    .sort()
    .map((f) => JSON.parse(readFileSync(resolve(MAIL, f), 'utf8')) as Mail)
    .filter((m) => m.to.toLowerCase() === address.toLowerCase());
}

async function emailedLink(address: string): Promise<string> {
  let link = '';
  await expect
    .poll(() => {
      const mail = mailFor(address)
        .filter((m) => m.subject.includes('Confirm your'))
        .pop();
      link = mail?.text.match(/https?:\/\/\S+/)?.[0] ?? '';
      return link;
    })
    .not.toBe('');
  return link;
}

/** An ABN that passes the official checksum and is unique to this run. */
function validAbn(): string {
  const weights = [10, 1, 3, 5, 7, 9, 11, 13, 15, 17, 19];
  const tail = Array.from({ length: 9 }, () => Math.floor(Math.random() * 10));
  for (let prefix = 10; prefix < 100; prefix += 1) {
    const digits = [Math.floor(prefix / 10), prefix % 10, ...tail];
    const sum = digits.reduce((acc, d, i) => acc + (i === 0 ? d - 1 : d) * weights[i]!, 0);
    if (sum % 89 === 0) return digits.join('');
  }
  throw new Error('no checksum-valid ABN found');
}

const unique = (tag: string) =>
  `${tag}-${Date.now()}-${Math.floor(Math.random() * 1e6)}@nua-crew.example.com`;

async function confirmEmail(browser: Browser, address: string) {
  const reader = await (await browser.newContext()).newPage();
  await reader.goto(await emailedLink(address));
  await settle(reader);
  await reader.getByRole('button', { name: 'Confirm my email address' }).click();
  await expect(reader.getByText('Your email address is confirmed.')).toBeVisible();
  await reader.context().close();
}

/**
 * Wait for a page to finish loading and hydrating before touching its form. On a cold dev server
 * an early click submits the form natively, before React has attached, and the sign-up fails with
 * a validation redirect that has nothing to do with the product.
 */
async function settle(page: Page) {
  await page.waitForLoadState('networkidle');
}

async function fromSite(page: Page, label: string) {
  await page.goto(`${SITE}/`);
  await page
    .getByRole('region', { name: 'Get started', exact: true })
    .getByRole('link', { name: label })
    .click();
  await settle(page);
}

test('sign-up, business verification, a role-based ad, an application and a status update', async ({
  browser,
  request,
}) => {
  test.setTimeout(480_000);

  // Compile the pages this journey visits before the clock that matters starts (cold dev server).
  for (const url of [
    `${SITE}/`,
    `${WEB}/register`,
    `${WEB}/jobs`,
    `${HIRE}/register`,
    `${HIRE}/login`,
    `${HIRE}/jobs/new/guided`,
  ]) {
    await request.get(url).catch(() => undefined);
  }
  const title = `Real-gate Waiter ${Date.now()}`;
  const candidateEmail = unique('rg-candidate');
  const employerEmail = unique('rg-employer');
  const businessName = `Real Gate Cafe ${Date.now()}`;

  // 1. Candidate: marketing CTA -> candidate registration.
  const cand = await (await browser.newContext()).newPage();
  await fromSite(cand, 'Create Free Employee Account');
  await expect(cand).toHaveURL(`${WEB}/register`);
  await cand.getByLabel('Full name', { exact: true }).fill('Real Gate Candidate');
  await cand.getByLabel('Email', { exact: true }).fill(candidateEmail);
  await cand.getByLabel('Password', { exact: true }).fill(PASSWORD);
  await cand.getByRole('button', { name: 'Continue', exact: true }).click();
  await cand.getByRole('checkbox').check();
  await cand.getByRole('button', { name: 'Create free account', exact: true }).click();
  await expect(cand).toHaveURL(/\/profile/);
  await expect(cand.getByText('Your email address is not confirmed yet.')).toBeVisible();

  // 2. Employer: marketing CTA -> business registration with a checksum-valid, unique ABN.
  const owner = await (await browser.newContext()).newPage();
  await fromSite(owner, 'Register Your Business');
  await expect(owner).toHaveURL(`${HIRE}/register`);
  await owner.getByLabel('Your name', { exact: true }).fill('Real Gate Owner');
  await owner.getByLabel('Work email', { exact: true }).fill(employerEmail);
  await owner.getByLabel('Password', { exact: true }).fill(PASSWORD);
  await owner.getByRole('button', { name: 'Continue', exact: true }).click();
  await owner.getByLabel('Business name', { exact: true }).fill(businessName);
  await owner.getByLabel('ABN', { exact: true }).fill(validAbn());
  await owner.getByLabel('Suburb', { exact: true }).fill('Fitzroy');
  await owner.getByLabel('Postcode', { exact: true }).fill('3065');
  await owner.getByRole('button', { name: 'Continue', exact: true }).click();
  await owner.getByRole('checkbox').check();
  await owner.getByRole('button', { name: 'Create business workspace', exact: true }).click();
  await expect(owner.getByRole('heading', { name: businessName, exact: true })).toBeVisible();

  // 3. A checksum-valid ABN is NOT verification: the business cannot publish yet.
  await expect(owner.getByRole('note')).toContainText('cannot be published');

  // 4. An operator verifies the business after reviewing evidence. Only operators can.
  const admin = await (await browser.newContext()).newPage();
  await admin.goto(`${HIRE}/login`);
  await settle(admin);
  await admin.getByLabel(/email/i).fill(ADMIN.email);
  await admin.getByLabel('Password').fill(ADMIN.password);
  await admin.getByRole('button', { name: 'Log in' }).click();
  await admin.waitForURL((u) => !u.pathname.startsWith('/login'));
  await admin.goto(`${HIRE}/admin`);
  await settle(admin);
  const card = admin.locator('article', {
    has: admin.getByRole('heading', { name: businessName }),
  });
  await card.getByLabel('Verification decision').selectOption('verified');
  await card
    .getByLabel('Evidence reference and review notes')
    .fill('Local pilot test: evidence reference RG-001, reviewed by operator.');
  await card.getByLabel(/I reviewed the evidence/).check();
  await card.getByRole('button', { name: 'Record business review' }).click();
  await admin.getByLabel('Review queue').selectOption('verified');
  await admin.getByRole('button', { name: 'Show businesses' }).click();
  await expect(admin.getByRole('heading', { name: businessName })).toBeVisible();

  // 5. Marketing "Post a Job" CTA -> the employer's guided hospitality posting.
  await fromSite(owner, 'Post a Job');
  await expect(owner).toHaveURL(`${HIRE}/jobs/new`);
  await owner.goto(`${HIRE}/jobs/new/guided`);
  await settle(owner);
  await owner.getByRole('link', { name: /Restaurant \/ bistro/ }).click();
  await owner.getByLabel('Search roles').fill('waitstaff');
  await owner.getByRole('button', { name: 'Search' }).click();
  await owner.getByRole('link', { name: /^Waiter \/ Waitress,/ }).click();
  await owner.getByRole('link', { name: /^Restaurant\s*MA000119/ }).click();
  await owner.getByLabel('This award covers my business and this work').check();
  await owner.getByLabel(/Level 2/).check();
  await owner.getByLabel(/I’ve matched this to the real duties/).check();
  await owner.getByLabel('Hourly rate (AUD, before super)').fill('34.50');
  await owner.getByRole('button', { name: 'Check this pay' }).click();
  await expect(owner.getByText('Meets the minimum as assessed', { exact: true })).toBeVisible();
  await owner.getByLabel('Job title shown to candidates').fill(title);
  await owner.getByLabel('What will they do?').fill('Table service, weekends included.');
  await owner.getByLabel('Skills').fill('Customer Service');
  await owner.getByRole('button', { name: 'Save draft' }).click();
  await expect(owner.getByRole('status')).toContainText('Draft saved with its pay check');

  // 6. The employer's own email is still unconfirmed, so publishing is refused (real gate).
  await owner.getByRole('button', { name: 'Publish' }).click();
  await expect(owner.locator('p[role="alert"]')).toContainText(/email/i);

  // 7. Confirm the employer's email from the emailed link, then publish.
  await confirmEmail(browser, employerEmail);
  await owner.reload();
  await settle(owner);
  await owner.getByRole('button', { name: 'Publish' }).click();
  await expect(owner.getByRole('status')).toContainText('Job published');
  const jobUrl = owner.url().split('?')[0]!;

  // 8. The candidate finds the job but cannot apply until their own email is confirmed.
  await cand.goto(`${WEB}/jobs?q=${encodeURIComponent(title)}`);
  await cand.getByRole('link', { name: title }).click();
  await expect(cand.getByText('Verified business')).toBeVisible();
  await cand.getByRole('button', { name: 'Submit application' }).click();
  await expect(cand.locator('p[role="alert"]')).toContainText(/email/i);

  // 9. Confirm the candidate's email, apply, and the employer sees and advances the application.
  await confirmEmail(browser, candidateEmail);
  await cand.reload();
  await settle(cand);
  await cand.getByLabel(/Note to the employer/).fill('Happy to start next week.');
  await cand.getByRole('button', { name: 'Submit application' }).click();
  await expect(cand.getByRole('status')).toContainText('Application submitted');
  const appUrl = cand.url().split('?')[0]!;

  await owner.goto(jobUrl);
  await owner.getByRole('link', { name: 'Real Gate Candidate' }).click();
  await expect(owner.getByText('Happy to start next week.')).toBeVisible();
  await owner.getByRole('button', { name: 'Start review' }).click();
  await expect(owner.getByRole('status')).toContainText('candidate has been notified');

  // 10. The candidate sees the employer's status update.
  await cand.goto(appUrl);
  await expect(cand.getByText('Status:')).toContainText('Under review');
});
