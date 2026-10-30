import { expect, test } from '@playwright/test';
const password = 'a-long-setup-password-123';
test('candidate registers through the guided steps and reaches their private profile', async ({
  page,
}) => {
  await page.goto('http://localhost:3000/register');
  await page.getByLabel('Full name', { exact: true }).fill('Fictional New Candidate');
  await page
    .getByLabel('Email', { exact: true })
    .fill(`setup-candidate-${Date.now()}@nua-crew.example.com`);
  await page.getByLabel('Password', { exact: true }).fill(password);
  await page.getByRole('button', { name: 'Continue', exact: true }).click();
  await expect(page.getByText('Step 2 of 2')).toBeVisible();
  await page.getByRole('button', { name: 'Back', exact: true }).click();
  await expect(page.getByLabel('Full name', { exact: true })).toHaveValue(
    'Fictional New Candidate',
  );
  await page.getByRole('button', { name: 'Continue', exact: true }).click();
  await page.getByRole('checkbox').check();
  await page.getByRole('button', { name: 'Create free account', exact: true }).click();
  await expect(page).toHaveURL(/\/profile/);
  await expect(page.getByRole('status')).toContainText('Welcome');
});
test('employer registers with a location, then sees verification required before publishing', async ({
  page,
}) => {
  await page.goto('http://localhost:3001/register');
  await page.getByLabel('Your name', { exact: true }).fill('Fictional Business Owner');
  await page
    .getByLabel('Work email', { exact: true })
    .fill(`setup-employer-${Date.now()}@nua-crew.example.com`);
  await page.getByLabel('Password', { exact: true }).fill(password);
  await page.getByRole('button', { name: 'Continue', exact: true }).click();
  await page.getByLabel('Business name', { exact: true }).fill('Fictional Setup Cafe');
  await page.getByLabel('Suburb', { exact: true }).fill('Fitzroy');
  await page.getByLabel('Postcode', { exact: true }).fill('3065');
  await page.getByRole('button', { name: 'Continue', exact: true }).click();
  await expect(page.getByText('Step 3 of 3')).toBeVisible();
  await page.getByRole('checkbox').check();
  await page.getByRole('button', { name: 'Create business workspace', exact: true }).click();
  await expect(
    page.getByRole('heading', { name: 'Fictional Setup Cafe', exact: true }),
  ).toBeVisible();
  await expect(page.getByRole('note')).toContainText('cannot be published');
});
