import AxeBuilder from '@axe-core/playwright';
import { expect, test } from '@playwright/test';

for (const colorScheme of ['light', 'dark'] as const) {
  test(`candidate workspace, private wallet and shift entry points on a small screen — ${colorScheme}`, async ({
    browser,
  }, info) => {
    const context = await browser.newContext({
      viewport: { width: 360, height: 780 },
      colorScheme,
    });
    const page = await context.newPage();
    await page.goto('http://localhost:3000/login');
    expect(
      await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth),
    ).toBe(true);
    await page.getByLabel('Email', { exact: true }).fill('candidate-a@nua-crew.example.com');
    await page.getByLabel('Password', { exact: true }).fill('nua-dev-password-1');
    await page.getByRole('button', { name: 'Log in', exact: true }).click();
    await expect(page).not.toHaveURL(/\/login/);
    const screens = [
      ['/dashboard', 'Your next step, clearly.'],
      ['/documents', 'Your document wallet'],
      ['/shifts', 'Your shifts'],
      ['/notifications', 'Notifications'],
    ] as const;
    for (const [route, title] of screens) {
      await page.goto(`http://localhost:3000${route}`);
      await expect(page.getByRole('heading', { level: 1, name: title, exact: true })).toBeVisible();
      await expect(page.locator('body')).not.toContainText(/\bAI\b|artificial intelligence/);
      if (route === '/documents') {
        await expect(
          page.getByRole('group', { name: 'Upload a private document' }),
        ).toHaveAttribute('disabled', '');
        await expect(page.getByLabel('Choose a file, up to 4 MB')).toBeDisabled();
        await expect(
          page.getByRole('button', { name: 'Upload document', exact: true }),
        ).toBeDisabled();
        await expect(
          page.getByText('Document uploads are not connected yet.', { exact: false }),
        ).toBeVisible();
      }
      const results = await new AxeBuilder({ page }).analyze();
      expect(
        results.violations
          .filter((v) => v.impact === 'serious' || v.impact === 'critical')
          .map((v) => v.id),
        route,
      ).toEqual([]);
      expect(
        await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth),
        route,
      ).toBe(true);
      await page.screenshot({
        path: info.outputPath(`${colorScheme}-${route.slice(1)}.png`),
        fullPage: true,
      });
    }
    await context.close();
  });
}

test('employer overview routes into guided pay and hours without purchasing', async ({
  page,
}, info) => {
  await page.goto('http://localhost:3001/login');
  await page.getByLabel('Work email', { exact: true }).fill('owner-a@nua-crew.example.com');
  await page.getByLabel('Password', { exact: true }).fill('nua-dev-password-1');
  await page.getByRole('button', { name: 'Log in', exact: true }).click();
  await expect(page).not.toHaveURL(/\/login/);
  await expect(page.getByRole('heading', { name: 'Your hiring at a glance' })).toBeVisible();
  await page.screenshot({ path: info.outputPath('employer-overview.png'), fullPage: true });
  await page.getByRole('link', { name: /Post with the role-and-pay guide/ }).click();
  await expect(page.getByRole('heading', { name: 'Post a hospitality job' })).toBeVisible();
  await page.goto('http://localhost:3001/shifts');
  await expect(page.getByRole('heading', { level: 1, name: 'Shifts & hours' })).toBeVisible();
  const results = await new AxeBuilder({ page }).analyze();
  expect(
    results.violations
      .filter((v) => v.impact === 'serious' || v.impact === 'critical')
      .map((v) => v.id),
  ).toEqual([]);
  await page.screenshot({ path: info.outputPath('employer-shifts.png'), fullPage: true });
});
