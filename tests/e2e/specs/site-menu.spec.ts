import { expect, test } from '@playwright/test';

const SITE = 'http://localhost:3002';
const ORDER = [
  ['Job seekers', '/job-seekers'],
  ['Employers', '/employers'],
  ['How it works', '/how-it-works'],
  ['Features', '/features'],
  ['Pricing', '/pricing'],
  ['Countries', '/markets'],
  ['Trust & privacy', '/trust'],
] as const;

const ENTRIES = ['Create Free Employee Account', 'Register Your Business', 'Post a Job'];

test.describe('desktop menu', () => {
  test.use({ viewport: { width: 1280, height: 800 } });

  test('lists the pages in reading order with plain labels', async ({ page }) => {
    await page.goto(SITE + '/');
    const links = page.getByRole('navigation', { name: 'Main' }).getByRole('link');
    await expect(links).toHaveText(ORDER.map(([label]) => label));
    for (const [label, href] of ORDER) {
      await expect(
        page.getByRole('navigation', { name: 'Main' }).getByRole('link', { name: label }),
      ).toHaveAttribute('href', href);
    }
  });

  test('marks the current page with aria-current and a gold underline, not colour alone', async ({
    page,
  }) => {
    await page.goto(SITE + '/pricing');
    const nav = page.getByRole('navigation', { name: 'Main' });
    const current = nav.getByRole('link', { name: 'Pricing' });
    await expect(current).toHaveAttribute('aria-current', 'page');
    await expect(nav.locator('[aria-current="page"]')).toHaveCount(1);
    const shadow = await current.evaluate((el) => getComputedStyle(el).boxShadow);
    expect(shadow).not.toBe('none');
    const other = nav.getByRole('link', { name: 'Employers' });
    expect(await other.evaluate((el) => getComputedStyle(el).boxShadow)).toBe('none');
  });

  test('the App status button sits under the menu, right-aligned with its last link', async ({
    page,
  }) => {
    await page.goto(SITE + '/');
    const last = await page
      .getByRole('navigation', { name: 'Main' })
      .getByRole('link', { name: 'Trust & privacy' })
      .boundingBox();
    const button = await page.locator('.site-header .nua-row a').first().boundingBox();
    expect(button!.y).toBeGreaterThanOrEqual(last!.y + last!.height - 1);
    expect(Math.abs(button!.x + button!.width - (last!.x + last!.width))).toBeLessThanOrEqual(1);
  });
});

test.describe('phone menu', () => {
  test.use({ viewport: { width: 375, height: 800 } });

  test('opens and closes from the keyboard, returns focus, and has full-size touch targets', async ({
    page,
  }) => {
    await page.goto(SITE + '/pricing');
    const nav = page.getByRole('navigation', { name: 'Main' });
    const toggle = page.getByRole('button', { name: 'Menu' });
    await expect(toggle).toHaveAttribute('aria-expanded', 'false');
    await expect(nav.getByRole('link', { name: 'Employers', exact: true })).toBeHidden();

    await toggle.focus();
    await page.keyboard.press('Enter');
    await expect(page.getByRole('button', { name: 'Close' })).toHaveAttribute(
      'aria-expanded',
      'true',
    );
    const links = nav.getByRole('link');
    await expect(links).toHaveText([...ORDER.map(([label]) => label), ...ENTRIES]);
    for (const link of await links.all()) {
      expect((await link.boundingBox())!.height).toBeGreaterThanOrEqual(44);
    }
    await expect(nav.getByRole('link', { name: 'Pricing', exact: true })).toHaveAttribute(
      'aria-current',
      'page',
    );

    await nav.getByRole('link', { name: 'Features', exact: true }).focus();
    await page.keyboard.press('Escape');
    await expect(page.getByRole('button', { name: 'Menu' })).toBeFocused();
    await expect(nav.getByRole('link', { name: 'Features', exact: true })).toBeHidden();
  });

  test('does not scroll sideways with the menu open', async ({ page }) => {
    await page.goto(SITE + '/');
    await page.getByRole('button', { name: 'Menu' }).click();
    const overflow = await page.evaluate(
      () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
    );
    expect(overflow).toBeLessThanOrEqual(0);
  });
});
