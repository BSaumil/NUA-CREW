import { expect, test } from '@playwright/test';

const SITE = 'http://localhost:3002';
const LABELS = ['Create Free Employee Account', 'Register Your Business', 'Post a Job'];
const STATUS = ['/apps#job-seekers', '/apps#employers', '/apps#post-a-job'];

// The e2e site is built with no launch flags, so every entry must be closed and honest.
for (const width of [320, 390, 1440]) {
  test(`homepage hero shows the three entry points at ${width}px, closed by default`, async ({
    page,
  }) => {
    await page.setViewportSize({ width, height: 800 });
    await page.goto(SITE + '/');
    const hero = page.getByRole('region', { name: 'Get started', exact: true });
    for (const [i, label] of LABELS.entries()) {
      const link = hero.getByRole('link', { name: label });
      await expect(link).toBeVisible();
      await expect(link).toHaveAttribute('href', STATUS[i]!);
      expect((await link.boundingBox())!.height).toBeGreaterThanOrEqual(44);
    }
    await expect(hero).toContainText('Pilot registration is not open yet');
    // Scannable choices: one central status explanation, not the same paragraph three times.
    await expect(hero.getByText('Not open yet', { exact: true })).toHaveCount(3);
    await expect(hero.locator('.entry-points__notice')).toHaveCount(1);
    await expect(hero.locator('.entry-points__card')).toHaveCount(3);
    await expect(hero).toContainText('A$49');
    await expect(hero).toContainText('A$30');
    await expect(hero).toContainText('A$79');
    await expect(hero).toContainText('Payments are not switched on');
    const overflow = await page.evaluate(
      () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
    );
    expect(overflow).toBeLessThanOrEqual(0);
  });
}

test('closed entries land on a launch-status card that says so', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 800 });
  await page.goto(SITE + '/');
  await page
    .getByRole('region', { name: 'Get started', exact: true })
    .getByRole('link', { name: 'Post a Job' })
    .click();
  await expect(page).toHaveURL(/\/apps#post-a-job$/);
  await expect(page.locator('#post-a-job')).toContainText('not open yet');
  await expect(page.locator('#post-a-job')).toContainText('payments are not switched on');
});

test('job seekers, employers and pricing pages carry their entry points', async ({ page }) => {
  await page.goto(SITE + '/job-seekers');
  await expect(
    page.getByRole('link', { name: 'Create Free Employee Account' }).first(),
  ).toHaveAttribute('href', '/apps#job-seekers');
  await page.goto(SITE + '/employers');
  await expect(page.getByRole('link', { name: 'Register Your Business' }).first()).toBeVisible();
  await expect(page.getByRole('link', { name: 'Post a Job' }).first()).toBeVisible();
  await page.goto(SITE + '/pricing');
  await expect(page.getByRole('link', { name: 'Post a Job' }).first()).toBeVisible();
});

test('the phone menu lists the three entry points', async ({ page }) => {
  await page.setViewportSize({ width: 375, height: 800 });
  await page.goto(SITE + '/pricing');
  await page.getByRole('button', { name: 'Menu' }).click();
  const nav = page.getByRole('navigation', { name: 'Main' });
  for (const label of LABELS) await expect(nav.getByRole('link', { name: label })).toBeVisible();
});

test('closed launch does not reveal unsupported sign-in links', async ({ page }) => {
  await page.goto(SITE + '/');
  const header = page.locator('.site-header');
  await expect(header.getByRole('link', { name: 'App status' })).toHaveCount(0);
  await expect(
    page.locator('footer.site-footer').getByRole('link', { name: 'App status' }),
  ).toBeVisible();
  await expect(header.getByRole('link', { name: 'Log in', exact: true })).toHaveCount(0);
  await page.goto(SITE + '/apps#access');
  await expect(page.locator('#access')).toBeVisible();
  await expect(page.getByRole('link', { name: 'Employee log in' })).toHaveCount(0);
  await expect(page.getByRole('link', { name: 'Employer log in' })).toHaveCount(0);
});
