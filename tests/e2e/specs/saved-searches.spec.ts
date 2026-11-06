import AxeBuilder from '@axe-core/playwright';
import { expect, test } from '@playwright/test';

const WEB = 'http://localhost:3000';

async function login(browser: import('@playwright/test').Browser) {
  const page = await (await browser.newContext()).newPage();
  await page.goto(`${WEB}/login`);
  await page.getByLabel('Email', { exact: true }).fill('candidate-a@nua-crew.example.com');
  await page.getByLabel('Password', { exact: true }).fill('nua-dev-password-1');
  await page.getByRole('button', { name: 'Log in', exact: true }).click();
  await expect(page).not.toHaveURL(/\/login/);
  return page;
}

test('candidate saves a search from the jobs page, toggles its alerts and deletes it', async ({
  browser,
}) => {
  const page = await login(browser);
  const name = `E2E search ${Date.now()}`;
  await page.goto(`${WEB}/jobs?q=barista&suburb=Fitzroy&type=casual`);
  await page.getByLabel('Name this search').fill(name);
  await page.getByRole('button', { name: 'Save this search' }).click();
  await expect(page).toHaveURL(/\/saved-searches/);
  await expect(page.locator('[role="status"]', { hasText: 'Search saved' })).toBeVisible();

  const card = page.getByRole('listitem').filter({ hasText: name });
  await expect(card).toContainText('“barista” · in Fitzroy · casual');
  await expect(card).toContainText('Alerts are on');
  await expect(card.getByRole('link', { name: 'See jobs' })).toHaveAttribute(
    'href',
    '/jobs?q=barista&suburb=Fitzroy&type=casual',
  );

  const axe = await new AxeBuilder({ page }).analyze();
  expect(axe.violations.filter((v) => ['serious', 'critical'].includes(v.impact ?? ''))).toEqual(
    [],
  );

  await card.getByRole('button', { name: `Turn alerts off for ${name}` }).click();
  await expect(page.locator('[role="status"]', { hasText: 'Alerts turned off' })).toBeVisible();
  await expect(page.getByRole('listitem').filter({ hasText: name })).toContainText(
    'Alerts are off',
  );

  await page
    .getByRole('listitem')
    .filter({ hasText: name })
    .getByRole('button', { name: `Delete ${name}` })
    .click();
  await expect(page.locator('[role="status"]', { hasText: 'Search deleted' })).toBeVisible();
  await expect(page.getByRole('listitem').filter({ hasText: name })).toHaveCount(0);
});

test('saving with no filters is refused, and signed-out visitors see no save control', async ({
  browser,
  page: anon,
}) => {
  await anon.goto(`${WEB}/jobs?q=barista`);
  await expect(anon.getByRole('button', { name: 'Save this search' })).toHaveCount(0);
  await anon.goto(`${WEB}/saved-searches`);
  await expect(anon).toHaveURL(/\/login/);

  const page = await login(browser);
  await page.goto(`${WEB}/jobs`);
  await page.getByRole('button', { name: 'Save this search' }).click();
  await expect(page.locator('p[role="alert"]')).toContainText('Choose at least one filter');
});
