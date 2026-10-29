import AxeBuilder from '@axe-core/playwright';
import { expect, test } from '@playwright/test';

test('billing shows fixed prices and prevents checkout without Stripe configuration', async ({
  page,
}, info) => {
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.goto('http://localhost:3001/login');
  await page.getByLabel(/email/i).fill('owner-a@nua-crew.example.com');
  await page.getByLabel('Password').fill('nua-dev-password-1');
  await page.getByRole('button', { name: 'Log in' }).click();
  await page.waitForURL((u) => !u.pathname.startsWith('/login'));
  await page.goto('http://localhost:3001/billing');
  await expect(page.getByRole('heading', { name: 'Payments are not connected yet' })).toBeVisible();
  for (const price of ['A$19', 'A$30', 'A$49']) {
    await expect(page.getByText(price, { exact: true })).toBeVisible();
  }
  await expect(
    page.getByRole('button', { name: 'Continue to Stripe test checkout' }),
  ).toBeDisabled();
  await page.screenshot({
    path: info.outputPath('employer-advertising-billing.png'),
    fullPage: true,
  });
  await page.setViewportSize({ width: 390, height: 844 });
  expect(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth)).toBe(false);
  await page.screenshot({ path: info.outputPath('billing-phone.png'), fullPage: true });
  const audit = await new AxeBuilder({ page })
    .withTags(['wcag2a', 'wcag2aa', 'wcag21aa'])
    .analyze();
  expect(audit.violations.map((v) => v.id)).toEqual([]);
});
