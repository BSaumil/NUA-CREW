/** The public marketing site: static, placeholder domain, accessible, honest about status. */
import AxeBuilder from '@axe-core/playwright';
import { expect, test } from '@playwright/test';

const SITE = 'http://localhost:3002';
const PAGES = [
  '/',
  '/job-seekers',
  '/employers',
  '/how-it-works',
  '/pricing',
  '/trust',
  '/apps',
  '/contact',
  '/legal',
  '/features',
  '/help',
  '/privacy',
  '/terms',
  '/employer-terms',
  '/community-guidelines',
  '/cookies',
];

for (const scheme of ['light', 'dark'] as const) {
  test(`every page renders with no serious accessibility violations — ${scheme}`, async ({
    browser,
  }) => {
    const page = await (await browser.newContext({ colorScheme: scheme })).newPage();
    for (const path of PAGES) {
      const res = await page.goto(SITE + path);
      expect(res?.status(), path).toBe(200);
      await expect(page.getByRole('heading', { level: 1 }).first()).toBeVisible();
      const r = await new AxeBuilder({ page }).analyze();
      const bad = r.violations.filter((v) => v.impact === 'serious' || v.impact === 'critical');
      expect(
        bad.map((v) => `${path}: ${v.id}`),
        path,
      ).toEqual([]);
    }
  });
}

test('every marketing page has unique search metadata and factual structured data', async ({
  page,
  request,
}) => {
  const titles = new Set<string>();
  const descriptions = new Set<string>();
  for (const path of PAGES) {
    const response = await page.goto(SITE + path);
    expect(response?.status(), path).toBe(200);
    const title = await page.title();
    expect(titles.has(title), `Duplicate title at ${path}`).toBe(false);
    titles.add(title);

    const description = await page.locator('meta[name="description"]').getAttribute('content');
    expect(description?.length, path).toBeGreaterThanOrEqual(110);
    expect(description?.length, path).toBeLessThanOrEqual(165);
    expect(descriptions.has(description!), `Duplicate description at ${path}`).toBe(false);
    descriptions.add(description!);

    const canonical = path === '/' ? 'https://iksaa.com.au' : `https://iksaa.com.au${path}`;
    await expect(page.locator('link[rel="canonical"]')).toHaveAttribute('href', canonical);
    await expect(page.locator('meta[property="og:url"]')).toHaveAttribute('content', canonical);
    await expect(page.locator('meta[property="og:description"]')).toHaveAttribute(
      'content',
      description!,
    );
    await expect(page.locator('meta[name="twitter:card"]')).toHaveAttribute(
      'content',
      'summary_large_image',
    );
    await expect(page.locator('h1')).toHaveCount(1);

    const structured = page.locator('script[type="application/ld+json"]');
    await expect(structured).toHaveCount(1);
    const json = JSON.parse((await structured.first().textContent())!);
    expect(json['@context']).toBe('https://schema.org');
    expect(json['@graph'].map((item: { '@type': string }) => item['@type'])).toEqual([
      'Organization',
      'WebSite',
    ]);
  }

  const image = await page.locator('meta[property="og:image"]').getAttribute('content');
  expect(image).toBeTruthy();
  const imageResponse = await request.get(SITE + new URL(image!).pathname);
  expect(imageResponse.status()).toBe(200);
  expect(imageResponse.headers()['content-type']).toMatch(/^image\//);
});

test('crawlers are told to stay away until launch, and the sitemap uses the configured domain', async ({
  page,
  request,
}) => {
  await page.goto(SITE + '/');
  await expect(
    page.getByText(/no separate registration or trade mark status is claimed/),
  ).toBeVisible();
  const robots = await (await request.get(SITE + '/robots.txt')).text();
  if (process.env.NUA_SITE_INDEXABLE === 'true') {
    expect(robots).toMatch(/Allow: \\/);
    expect(robots).toContain('Sitemap: https://iksaa.com.au/sitemap.xml');
    await expect(page.locator('meta[name="robots"]')).toHaveAttribute('content', /index, follow/);
  } else {
    expect(robots).toMatch(/Disallow: \\/);
    await expect(page.locator('meta[name="robots"]')).toHaveAttribute('content', /noindex/);
  }
  // a launch-status page instead of dead links while the product apps are not deployed
  await page.goto(SITE + '/');
  await expect(
    page.locator('a[href*="app.iksaa.com.au"], a[href*="hire.iksaa.com.au"]'),
  ).toHaveCount(0);
  const sitemap = await (await request.get(SITE + '/sitemap.xml')).text();
  expect(sitemap).toContain('https://iksaa.com.au');
  expect((sitemap.match(/<loc>/g) ?? []).length).toBe(PAGES.length);
  expect((sitemap.match(/<lastmod>/g) ?? []).length).toBe(PAGES.length);
});

test('claims stay truthful: apps are not in stores, billing is a preview, free for job seekers', async ({
  page,
}) => {
  await page.goto(SITE + '/apps');
  await expect(page.getByText(/Not in the app stores yet/)).toBeVisible();
  await expect(page.locator('a[href*="apps.apple.com"], a[href*="play.google.com"]')).toHaveCount(
    0,
  );
  await page.goto(SITE + '/pricing');
  await expect(page.getByText(/Payments are not switched on/)).toBeVisible();
  await expect(page.getByText('A$19').first()).toBeVisible();
  await expect(page.getByText('A$30').first()).toBeVisible();
  await expect(page.getByText('A$10')).toHaveCount(0); // no employee price exists
  await page.goto(SITE + '/legal');
  await expect(page.getByRole('heading', { name: 'Who you are dealing with' })).toBeVisible();
  await expect(page.getByText('ABN 54 299 131 653', { exact: true })).toBeVisible();
  // never claims the name, domain or trade mark is available or registered
  for (const path of PAGES) {
    await page.goto(SITE + path);
    const text = (await page.locator('body').innerText()).toLowerCase();
    expect(text, path).not.toMatch(/\bai\b|artificial intelligence|saumil|vijaykumar|bhatt/);
    expect(text, path).not.toMatch(
      /registered trade ?mark|™|®|domain is available|name is available/,
    );
  }
});

test('works on a small phone with no sideways scrolling and loads nothing from other sites', async ({
  browser,
}) => {
  const ctx = await browser.newContext({ viewport: { width: 360, height: 740 } });
  const page = await ctx.newPage();
  const foreign: string[] = [];
  page.on('request', (r) => {
    const u = new URL(r.url());
    if (u.hostname !== 'localhost') foreign.push(r.url());
  });
  for (const path of PAGES) {
    await page.goto(SITE + path);
    const overflow = await page.evaluate(
      () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
    );
    expect(overflow, path).toBeLessThanOrEqual(0);
  }
  expect(foreign).toEqual([]);
});

test('the apps page walks people through both experiences without overclaiming', async ({
  page,
}) => {
  await page.goto(SITE + '/apps');
  const walk = page.locator('.walk');
  await expect(walk).toBeVisible();
  // job seeker steps by default
  await expect(walk.getByRole('heading', { name: 'Find work that fits' })).toBeVisible();
  await walk.getByRole('button', { name: /Share when you can work/ }).click();
  await expect(walk.getByRole('heading', { name: 'Share when you can work' })).toBeVisible();
  await expect(walk.getByRole('img', { name: /sample weekly availability/ })).toBeVisible();
  // employer steps
  await walk.getByRole('button', { name: /I’m hiring/ }).click();
  await walk.getByRole('button', { name: /Check the pay/ }).click();
  await expect(walk.getByText(/You confirm coverage and level/)).toBeVisible();
  await expect(walk.getByText(/not legal advice/)).toBeVisible();
  // truthfulness: fictional data is labelled, no store links, no award figures
  await expect(walk.getByText(/fictional sample data/i).first()).toBeVisible();
  await expect(page.locator('a[href*="apps.apple.com"], a[href*="play.google.com"]')).toHaveCount(
    0,
  );
  await expect(walk.getByText(/\$\d/)).toHaveCount(0);
});

test('the walkthrough fits a small phone with no sideways scrolling', async ({ browser }) => {
  const page = await (
    await browser.newContext({ viewport: { width: 360, height: 740 } })
  ).newPage();
  await page.goto(SITE + '/apps');
  await page.locator('.walk').scrollIntoViewIfNeeded();
  const overflow = await page.evaluate(
    () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
  );
  expect(overflow).toBeLessThanOrEqual(0);
});
