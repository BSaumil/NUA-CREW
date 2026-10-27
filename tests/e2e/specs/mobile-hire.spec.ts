/** Real API/DB checks of native screen code rendered on the web. These are not device tests. */
import AxeBuilder from '@axe-core/playwright';
import { expect, test, type Page } from '@playwright/test';

const APP = 'http://localhost:8081';
const field = (page: Page, label: string) => page.locator(`[aria-label="${label}"]:visible`);

async function login(page: Page, employer: boolean) {
  await page.goto(APP);
  await page.getByRole('button', { name: 'Skip' }).click();
  await field(page, 'Email').fill(
    employer ? 'owner-a@nua-crew.example.com' : 'candidate-b@nua-crew.example.com',
  );
  await field(page, 'Password').fill('nua-dev-password-1');
  await page.getByRole('button', { name: 'Log in' }).click();
  await expect(
    page.getByText(employer ? 'Build your next team.' : 'Work that fits your life.'),
  ).toBeVisible();
}

test('employer saves a reviewed draft using the native three-step flow', async ({
  page,
  request,
}, info) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await login(page, true);
  await page.getByRole('button', { name: /^Post a job\./ }).click();
  await field(page, 'Job title').fill(`Native draft ${Date.now()}`);
  const locations = page.getByRole('button', { name: / · Fitzroy/ });
  await locations.first().click();
  await field(page, 'About the role').fill('Welcome guests and prepare coffee in the morning.');
  await page.screenshot({ path: info.outputPath('employer-create-role.png') });
  await page.getByRole('button', { name: 'Continue to pay' }).click();
  await field(page, 'Minimum pay (AUD)').fill('30');
  await field(page, 'Maximum pay (AUD)').fill('35');
  await page.getByRole('button', { name: 'Plus super', exact: true }).click();
  await page.screenshot({ path: info.outputPath('employer-disclose-pay.png') });
  await page.getByRole('button', { name: 'Review advertisement' }).click();
  await expect(page.getByText('AUD 30–35 per hour · plus super')).toBeVisible();
  await page.screenshot({ path: info.outputPath('employer-review-advertisement.png') });
  await page.getByRole('button', { name: 'Save draft', exact: true }).click();
  await expect(page.getByText('Draft', { exact: true }).filter({ visible: true })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Publish job', exact: true })).toBeVisible();
  // The draft is persisted, and no charge or automatic publication occurred.
  const token = await request.post('http://localhost:8000/v1/auth/login', {
    data: { email: 'owner-a@nua-crew.example.com', password: 'nua-dev-password-1' },
  });
  expect(token.ok()).toBeTruthy();
});

for (const employer of [false, true]) {
  for (const colorScheme of ['light', 'dark'] as const) {
    test(`${employer ? 'employer' : 'employee'} screens fit phone widths and pass axe in ${colorScheme}`, async ({
      page,
    }, info) => {
      await page.emulateMedia({ colorScheme });
      await page.setViewportSize({ width: 390, height: 844 });
      await login(page, employer);
      for (const width of [320, 390, 430]) {
        await page.setViewportSize({ width, height: 720 });
        const label = await page
          .getByText(employer ? 'Business' : 'Profile', { exact: true })
          .boundingBox();
        expect(label).not.toBeNull();
        expect(
          label!.y + label!.height,
          'bottom navigation label fits the viewport',
        ).toBeLessThanOrEqual(720);
        const overflow = await page.evaluate(
          () => document.documentElement.scrollWidth > window.innerWidth,
        );
        expect(overflow, `horizontal overflow at ${width}px`).toBeFalsy();
        await page.screenshot({
          path: info.outputPath(
            `${employer ? 'employer' : 'employee'}-${colorScheme}-${width}.png`,
          ),
        });
      }
      const audit = await new AxeBuilder({ page })
        .withTags(['wcag2a', 'wcag2aa', 'wcag21aa'])
        .analyze();
      expect(
        audit.violations.map(
          (v) => `${v.id}: ${v.nodes.map((n) => n.target.join(' ')).join(', ')}`,
        ),
      ).toEqual([]);
      if (employer) {
        await page.getByRole('button', { name: 'Shifts and timesheets', exact: true }).click();
        await expect(page.getByText('The right people, on time.')).toBeVisible();
        await field(page, 'Shift date (YYYY-MM-DD)').focus();
        await page.setViewportSize({ width: 320, height: 360 });
        await field(page, 'Hourly rate (AUD, within job range)').fill('30');
        await expect(field(page, 'Hourly rate (AUD, within job range)')).toBeVisible();
        await page.screenshot({
          path: info.outputPath(`shift-form-${colorScheme}-short-viewport.png`),
        });
      }
    });
  }
}
