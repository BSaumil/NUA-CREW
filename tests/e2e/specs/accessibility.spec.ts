import AxeBuilder from '@axe-core/playwright';
import { expect, test } from '@playwright/test';

const pages = [
  ['http://localhost:3000/', 'home'],
  ['http://localhost:3000/jobs', 'job search'],
  ['http://localhost:3000/login', 'candidate login'],
  ['http://localhost:3000/register', 'candidate register'],
  ['http://localhost:3000/trust', 'trust'],
  ['http://localhost:3001/login', 'employer login'],
  ['http://localhost:3001/register', 'employer register'],
] as const;

for (const scheme of ['light', 'dark'] as const) {
  for (const [url, name] of pages) {
    test(`axe: ${name} (${scheme})`, async ({ page }) => {
      await page.emulateMedia({ colorScheme: scheme });
      await page.goto(url);
      const results = await new AxeBuilder({ page })
        .withTags(['wcag2a', 'wcag2aa', 'wcag21aa', 'wcag22aa'])
        .analyze();
      expect(
        results.violations.map(
          (v) => `${v.id}: ${v.nodes.map((n) => n.target.join(' ')).join(' | ')}`,
        ),
      ).toEqual([]);
    });
  }
}

test('seeded job detail page has no axe violations', async ({ page }) => {
  await page.goto('http://localhost:3000/jobs');
  await page.getByRole('link', { name: 'Barista' }).first().click();
  const results = await new AxeBuilder({ page })
    .withTags(['wcag2a', 'wcag2aa', 'wcag21aa', 'wcag22aa'])
    .analyze();
  expect(results.violations.map((v) => v.id)).toEqual([]);
});
