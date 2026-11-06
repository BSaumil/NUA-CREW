import AxeBuilder from '@axe-core/playwright';
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

test('an operator checks a supplied rate, verifies it, then withdraws the verification', async ({
  browser,
}) => {
  const page = await (await browser.newContext()).newPage();
  await login(page, 'admin@nua-crew.example.com');
  await page.goto(`${HIRE}/admin/rates?instrument=MA000119`);
  await expect(
    page.getByRole('heading', { level: 1, name: 'Award rate verification' }),
  ).toBeVisible();
  // Nothing is verified until a person checks it.
  await expect(page.getByRole('status')).toContainText('0 of 33 hourly rates');

  const axe = await new AxeBuilder({ page }).analyze();
  expect(axe.violations.filter((v) => ['serious', 'critical'].includes(v.impact ?? ''))).toEqual(
    [],
  );

  const first = page.getByRole('article').first();
  const label = (await first.getAttribute('aria-label')) ?? '';
  expect(label).toMatch(/^MA000119 \S+ from \d{2}\/\d{2}\/\d{4}$/);
  // The confirmation must be ticked: the browser refuses an unticked form.
  await first.getByLabel('Where you checked it').fill('Fair Work pay guide, checked in e2e');
  await first.getByRole('button', { name: /Mark verified/ }).click();
  await expect(page).toHaveURL(/\/admin\/rates\?instrument=MA000119$/);
  await expect(page.locator('p[role="status"]', { hasText: 'Rate marked verified' })).toHaveCount(
    0,
  );

  await first.getByLabel('Where you checked it').fill('Fair Work pay guide, checked in e2e');
  await first.getByRole('checkbox').check();
  await first.getByRole('button', { name: /Mark verified/ }).click();
  await expect(page.locator('p[role="status"]', { hasText: 'Rate marked verified' })).toBeVisible();
  await expect(page.locator('p[role="status"]', { hasText: '1 of 33 hourly rates' })).toBeVisible();
  // The filters survive the redirect and the row now shows as verified.
  await expect(page).toHaveURL(/instrument=MA000119/);
  const verified = page.getByRole('article', { name: label });
  await expect(verified).toContainText('Verified');

  // Filtering to verified shows only it.
  await page.goto(`${HIRE}/admin/rates?status=verified`);
  await expect(page.getByRole('article')).toHaveCount(1);

  await page
    .getByRole('article', { name: label })
    .getByLabel('Why is this verification being withdrawn?')
    .fill('Withdrawn in the e2e test to restore the seed');
  await page
    .getByRole('article', { name: label })
    .getByRole('button', { name: /Withdraw verification/ })
    .click();
  await expect(page.locator('p[role="status"]', { hasText: '0 of 33 hourly rates' })).toBeVisible();
  await expect(page.getByText('Verification withdrawn')).toBeVisible();
});

test('only operators can open the rate verification page', async ({ browser }) => {
  const owner = await (await browser.newContext()).newPage();
  await login(owner, 'owner-a@nua-crew.example.com');
  await owner.goto(`${HIRE}/admin/rates`);
  await expect(owner).toHaveURL(/\/login/);
  const anon = await (await browser.newContext()).newPage();
  await anon.goto(`${HIRE}/admin/rates`);
  await expect(anon).toHaveURL(/\/login/);
});
