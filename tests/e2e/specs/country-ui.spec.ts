import { expect, test } from '@playwright/test';

// Country-aware UI: Australia unchanged, New Zealand preview-only, unknown fails closed.
const password = 'a-long-setup-password-123';

async function toBusinessStep(page: import('@playwright/test').Page) {
  await page.goto('http://localhost:3001/register');
  await page.getByLabel('Your name', { exact: true }).fill('Fictional Business Owner');
  await page
    .getByLabel('Work email', { exact: true })
    .fill(`country-${Date.now()}@nua-crew.example.com`);
  await page.getByLabel('Password', { exact: true }).fill(password);
  await page.getByRole('button', { name: 'Continue', exact: true }).click();
}

test('employer AU registration keeps ABN, State and Postcode, and submit is enabled', async ({
  page,
}) => {
  await toBusinessStep(page);
  await expect(page.getByRole('radio', { name: /Australia/ })).toBeChecked();
  await expect(page.getByLabel('ABN', { exact: true })).toBeVisible();
  await expect(page.getByLabel('State', { exact: true })).toHaveValue('VIC');
  await page.getByLabel('Business name', { exact: true }).fill('Fictional Country Cafe');
  await page.getByLabel('ABN', { exact: true }).fill('51 824 753 556');
  await page.getByLabel('Suburb', { exact: true }).fill('Fitzroy');
  await page.getByLabel('Postcode', { exact: true }).fill('3065');
  await page.getByRole('button', { name: 'Continue', exact: true }).click();
  await page.getByRole('checkbox').check();
  await expect(
    page.getByRole('button', { name: 'Create business workspace', exact: true }),
  ).toBeEnabled();
});

test('employer NZ registration is preview-only: NZD, NZ regions, submit disabled with reason', async ({
  page,
}) => {
  await toBusinessStep(page);
  await page.getByRole('radio', { name: /New Zealand/ }).check();
  await expect(page.getByLabel('ABN', { exact: true })).toHaveCount(0);
  await expect(page.getByText('NZBN (optional)')).toBeVisible();
  await expect(page.getByTestId('market-preview-notice')).toContainText('NZD');
  await expect(page.getByTestId('market-preview-notice')).toContainText('not assessed');
  await page.getByLabel('Business name', { exact: true }).fill('Fictional Auckland Cafe');
  await page.locator('input[name="nz_preview_suburb"]').fill('Ponsonby');
  await page.locator('select[name="nz_preview_region"]').selectOption('Auckland');
  await page.locator('input[name="nz_preview_postcode"]').fill('1011');
  await page.getByRole('button', { name: 'Continue', exact: true }).click();
  await page.getByRole('checkbox').check();
  const submit = page.getByRole('button', { name: 'Create business workspace', exact: true });
  await expect(submit).toBeDisabled();
  await expect(page.getByText(/being prepared/).last()).toBeVisible();
});

test('candidate search: AU default, NZ shows a not-enabled notice, mixed pay is ISO-labelled', async ({
  page,
}) => {
  await page.goto('http://localhost:3000/jobs');
  await expect(page.getByRole('checkbox', { name: /Australia/ })).toBeChecked();
  await expect(page.getByTestId('market-notice-NZ')).toHaveCount(0);
  await page.goto('http://localhost:3000/jobs?markets=AU&markets=NZ');
  await expect(page.getByTestId('market-notice-NZ')).toContainText('not enabled yet');
  await expect(page.getByText(/never added together or compared/)).toBeVisible();
  await page.goto('http://localhost:3000/jobs?markets=NZ');
  await expect(page.getByText('0 jobs found')).toBeVisible();
  // Unknown country codes are dropped, never coerced into a different market.
  await page.goto('http://localhost:3000/jobs?markets=ZZ');
  await expect(page.getByRole('checkbox', { name: /New Zealand/ })).not.toBeChecked();
});
