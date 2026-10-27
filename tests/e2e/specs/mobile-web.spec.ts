/**
 * Exercises the mobile app's real screens (react-native-web build) against the real API and DB.
 * Native-only behaviour (Keychain, biometrics, push, share sheet) cannot run in a browser and is
 * covered by unit tests; this proves the screens, navigation, API wiring and token refresh work.
 */
import AxeBuilder from '@axe-core/playwright';
import { expect, test, type APIRequestContext, type Page } from '@playwright/test';

const APP = 'http://localhost:8081';
const API = 'http://localhost:8000';
const PASSWORD = 'nua-dev-password-1';

async function employerToken(request: APIRequestContext) {
  const r = await request.post(`${API}/v1/auth/login`, {
    data: { email: 'owner-a@nua-crew.example.com', password: PASSWORD },
  });
  const { access_token } = await r.json();
  const auth = { Authorization: `Bearer ${access_token}` };
  const me = await (await request.get(`${API}/v1/auth/me`, { headers: auth })).json();
  return { auth, eid: me.memberships[0].employer_id as string };
}

async function publishJob(
  request: APIRequestContext,
  title: string,
  extra: Record<string, unknown> = {},
) {
  const { auth, eid } = await employerToken(request);
  const locs = await (
    await request.get(`${API}/v1/employers/${eid}/locations`, { headers: auth })
  ).json();
  const created = await request.post(`${API}/v1/employers/${eid}/jobs`, {
    headers: auth,
    data: {
      title,
      description: 'Pull espresso shots on weekday mornings.',
      employment_type: 'casual',
      category: 'Hospitality',
      location_id: locs[0].id,
      pay_min: '29',
      pay_max: '33',
      pay_period: 'hour',
      skills: ['Barista', 'Customer Service'],
      ...extra,
    },
  });
  const job = await created.json();
  expect(
    (
      await request.post(`${API}/v1/employers/${eid}/jobs/${job.id}/publish`, { headers: auth })
    ).ok(),
  ).toBeTruthy();
  return { jobId: job.id as string, eid, auth };
}

async function skipWelcome(page: Page) {
  await page.goto(APP);
  await page.getByRole('button', { name: 'Skip' }).click();
}

async function signIn(page: Page, email = 'candidate-a@nua-crew.example.com', password = PASSWORD) {
  await skipWelcome(page);
  await field(page, 'Email').fill(email);
  await field(page, 'Password').fill(password);
  await page.getByRole('button', { name: 'Log in' }).click();
}

// Tab names include an icon-font glyph, so match the label anywhere in the name.
const tab = (page: Page, name: string) => page.getByRole('tab', { name: new RegExp(name) });
// Stacked screens stay mounted but hidden; only address the visible one.
const field = (page: Page, label: string) => page.locator(`[aria-label="${label}"]:visible`);

test('candidate discovers, saves, reads the match, applies and follows the employer', async ({
  page,
  request,
}) => {
  const title = `Mobile Barista ${Date.now()}`;
  const { auth, eid } = await publishJob(request, title);

  await signIn(page);
  await expect(tab(page, 'Discover')).toBeVisible();

  // Search finds it, with honest trust and pay labelling on the card.
  await field(page, 'Search jobs').fill(title);
  const card = page.getByRole('button', { name: new RegExp(`^${title},`) });
  await expect(card).toBeVisible();
  await expect(page.getByText('Verified business · not an endorsement').first()).toBeVisible();
  await expect(page.getByText('Disclosed').first()).toBeVisible();

  // Save from the list; it appears under Saved and can be removed.
  await page.getByRole('button', { name: `Save ${title}` }).click();
  await expect(page.getByRole('button', { name: `Remove ${title} from saved jobs` })).toBeVisible();
  await tab(page, 'Saved').click();
  await expect(page.getByRole('button', { name: new RegExp(`^${title},`) })).toBeVisible();
  await tab(page, 'Discover').click();

  // Detail: match is an estimate with evidence, not a promise.
  await page.getByRole('button', { name: new RegExp(`^${title},`) }).click();
  await expect(page.getByRole('heading', { name: title })).toBeVisible();
  await page.getByRole('tab', { name: 'My match' }).click();
  await expect(page.getByText(/not a prediction of being hired/).first()).toBeVisible();
  await page.getByRole('tab', { name: 'Overview' }).click();

  // Apply (with the seeded resume) and land on the application timeline.
  await page.getByRole('button', { name: 'Apply', exact: true }).click();
  await field(page, 'Note to the employer (optional)').fill('Available from next week.');
  await page.getByRole('button', { name: 'Submit application' }).click();
  await expect(page.getByText('You submitted this application')).toBeVisible();
  const appUrl = page.url();

  // The employer advances the application; the candidate sees it and gets an alert.
  const pipeline = await (
    await request.get(
      `${API}/v1/employers/${eid}/jobs/${(await (await request.get(`${API}/v1/jobs`, { params: { q: title } })).json()).items[0].id}/applications`,
      { headers: auth },
    )
  ).json();
  const status = await request.post(
    `${API}/v1/employers/${eid}/applications/${pipeline[0].application_id}/status`,
    { headers: auth, data: { to_status: 'under_review' } },
  );
  expect(status.ok()).toBeTruthy();
  await page.goto(appUrl);
  await expect(page.getByText('The employer updated your status')).toBeVisible();
  await page.goto(APP);
  // Alerts moved behind the bell on Discover when navigation was simplified.
  await page.getByRole('button', { name: 'Notifications', exact: true }).click();
  await expect(page.getByText(`Your application for ${title} is under review`)).toBeVisible();
  await page
    .getByRole('button', { name: /Unread\. Your application for/ })
    .first()
    .click();
  await expect(page.getByText('The employer updated your status')).toBeVisible();

  // Applications tab lists it as active with the employer-made status.
  await page.goto(APP);
  await tab(page, 'Applications').click();
  await expect(
    page.getByRole('button', { name: new RegExp(`^${title}, .*status under review`) }),
  ).toBeVisible();
});

test('signed-out deep links go to sign-in, and an employer account lands in the hiring workspace', async ({
  page,
}) => {
  await page.goto(`${APP}/job/00000000-0000-0000-0000-000000000000`);
  await expect(page.getByRole('button', { name: 'Skip' }).or(field(page, 'Email'))).toBeVisible();
  await signIn(page, 'owner-a@nua-crew.example.com');
  // Employers use the native hiring workspace; they never get the job-seeker tabs or data.
  await expect(page.getByRole('heading', { name: 'Build your next team.' })).toBeVisible();
  await expect(tab(page, 'Discover')).toHaveCount(0);
});

test('saved searches: created from filters, listed with an alerts switch', async ({ page }) => {
  const name = `barista-${Date.now()}`;
  await signIn(page);
  await field(page, 'Search jobs').fill(name);
  await page.getByRole('button', { name: 'Casual', exact: true }).click();
  await page.getByRole('button', { name: 'Save this search & get alerts' }).click();
  await page.waitForTimeout(600); // let the typing debounce fire while the sheet is open
  await page.getByRole('textbox', { name: 'Name' }).fill(`My ${name} search`);
  await page.waitForTimeout(600); // ...and again after editing: the name must survive
  await page.getByRole('button', { name: 'Save', exact: true }).click();
  await tab(page, 'Saved').click();
  await page.getByRole('button', { name: /^Searches/ }).click();
  await expect(page.getByRole('button', { name: new RegExp(`My ${name} search`) })).toBeVisible();
  const sw = page.getByRole('switch', { name: `Alerts for My ${name} search` });
  await expect(sw).toBeChecked();
  await sw.click();
  await expect(sw).not.toBeChecked();
});

test('a new user can register, set up a profile, and permanently delete the account', async ({
  page,
}) => {
  const email = `new-${Date.now()}@nua-crew.example.com`;
  await skipWelcome(page);
  await page.getByRole('link', { name: 'Create a free account' }).click();
  await field(page, 'Full name').fill('Nina New');
  await field(page, 'Email').fill(email);
  await field(page, 'Password').fill('a-long-enough-password');
  await page.getByRole('button', { name: 'Create account' }).click();
  await expect(page.getByText('You need to accept the terms to continue')).toBeVisible();
  await page.getByRole('switch', { name: /I agree to the terms/ }).click();
  await page.getByRole('button', { name: 'Create account' }).click();
  await expect(tab(page, 'Discover')).toBeVisible();

  await tab(page, 'Profile').click();
  await expect(page.getByText('Profile strength')).toBeVisible();
  await field(page, 'Headline').fill('Barista and coffee nerd');
  await field(page, 'Suburb').fill('Fitzroy');
  await page.getByRole('button', { name: 'Casual', exact: true }).click();
  await field(page, 'Add a skill').fill('Barista');
  await page.getByRole('button', { name: 'Add skill' }).click();
  await page.getByRole('button', { name: 'Save profile' }).click();
  await expect(page.getByText('Profile saved')).toBeVisible();

  await page.getByRole('button', { name: 'Settings' }).click();
  await expect(
    page.getByRole('switch', { name: 'Let verified employers discover my profile' }),
  ).not.toBeChecked();
  await page.getByRole('button', { name: 'Delete my account' }).click();
  await expect(page.getByText(/permanently erases your profile/)).toBeVisible();
  await field(page, 'Confirm with your password').fill('a-long-enough-password');
  await page.getByRole('button', { name: 'Delete everything' }).click();
  await expect(field(page, 'Email')).toBeVisible(); // back at sign-in

  await field(page, 'Email').fill(email);
  await field(page, 'Password').fill('a-long-enough-password');
  await page.getByRole('button', { name: 'Log in' }).click();
  await expect(page.getByText('Email or password is incorrect')).toBeVisible();
});

test('a short-lived access token is refreshed transparently', async ({ page }) => {
  await signIn(page);
  await expect(tab(page, 'Discover')).toBeVisible();
  // Corrupt the in-memory expectation by invalidating the access token server-side: sign in again
  // elsewhere does not matter; instead force a 401 for one request and watch the app recover.
  let refreshed = 0;
  page.on('request', (r) => {
    if (r.url().endsWith('/v1/auth/refresh')) refreshed++;
  });
  let broke = false;
  await page.route(`${API}/v1/candidate/applications`, async (route) => {
    if (!broke) {
      broke = true;
      return route.fulfill({
        status: 401,
        contentType: 'application/json',
        body: JSON.stringify({ error: { code: 'invalid_token', message: 'expired' } }),
      });
    }
    return route.continue();
  });
  await tab(page, 'Applications').click();
  await expect(page.getByRole('heading', { name: 'Applications' })).toBeVisible();
  await expect(page.getByText('Something went wrong')).toHaveCount(0);
  expect(refreshed).toBeGreaterThanOrEqual(1);
  expect(broke).toBe(true);
});

test('shows an offline banner and keeps cached results readable', async ({ page, context }) => {
  await signIn(page);
  await expect(page.getByText(/jobs? ·/)).toBeVisible();
  await context.setOffline(true);
  await expect(page.getByText(/You are offline/)).toBeVisible();
  await expect(page.getByText(/jobs? ·/)).toBeVisible();
  await context.setOffline(false);
  await expect(page.getByText(/You are offline/)).toHaveCount(0);
});

for (const scheme of ['light', 'dark'] as const) {
  test(`accessibility (axe) of key mobile screens — ${scheme}`, async ({ page }) => {
    await page.emulateMedia({ colorScheme: scheme });
    const scan = async (label: string) => {
      const r = await new AxeBuilder({ page })
        .withTags(['wcag2a', 'wcag2aa', 'wcag21aa'])
        .analyze();
      expect(
        r.violations.map(
          (v) =>
            `${label} ${v.id}: ${v.nodes
              .map((n) => n.target.join(' '))
              .slice(0, 3)
              .join(' | ')}`,
        ),
      ).toEqual([]);
    };
    await skipWelcome(page);
    await scan('login');
    await field(page, 'Email').fill('candidate-a@nua-crew.example.com');
    await field(page, 'Password').fill(PASSWORD);
    await page.getByRole('button', { name: 'Log in' }).click();
    await expect(page.getByText(/jobs? ·/)).toBeVisible();
    await scan('discover');
    await page
      .getByRole('button', { name: /^Barista,/ })
      .first()
      .click();
    await expect(page.getByRole('tab', { name: 'My match' })).toBeVisible();
    await scan('job detail');
    await page.goBack();
    await tab(page, 'Profile').click();
    await expect(page.getByText('Profile strength')).toBeVisible();
    await scan('profile');
  });
}
