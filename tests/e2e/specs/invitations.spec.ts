/**
 * Phases B-D end to end against the real API and database: an employer invites a consenting
 * candidate from the web, the candidate accepts in the phone screens (react-native-web build),
 * they exchange messages, and a block cuts the employer off. Real push delivery, Keychain,
 * keyboard and screen readers are NOT exercised here.
 */
import AxeBuilder from '@axe-core/playwright';
import { expect, test, type APIRequestContext, type Page } from '@playwright/test';

const APP = 'http://localhost:8081';
const API = 'http://localhost:8000';
const EMPLOYER = 'http://localhost:3001';
const PASSWORD = 'nua-dev-password-1';

const field = (page: Page, label: string) => page.locator(`[aria-label="${label}"]:visible`);
const tab = (page: Page, name: string) => page.getByRole('tab', { name: new RegExp(name) });

async function token(request: APIRequestContext, email: string) {
  const r = await request.post(`${API}/v1/auth/login`, { data: { email, password: PASSWORD } });
  return { Authorization: `Bearer ${(await r.json()).access_token}` };
}

test('employer invites, candidate accepts, they message, candidate blocks', async ({
  browser,
  page,
  request,
}) => {
  const stamp = Date.now();
  const jobTitle = `Invite Barista ${stamp}`;

  // ---- setup through the API: candidate-a opts in; owner-a has an open job ----
  const cand = await token(request, 'candidate-a@nua-crew.example.com');
  const pref = await request.put(`${API}/v1/candidate/work-preferences/temporary`, {
    headers: cand,
    data: { enabled: true, engagement_bases: ['employee'], hours_patterns: ['casual'] },
  });
  expect(pref.ok()).toBeTruthy();
  for (const path of ['talent-discovery', 'discovery/temporary']) {
    expect(
      (
        await request.put(`${API}/v1/candidate/consents/${path}`, {
          headers: cand,
          data: { granted: true },
        })
      ).ok(),
    ).toBeTruthy();
  }
  const owner = await token(request, 'owner-a@nua-crew.example.com');
  const me = await (await request.get(`${API}/v1/auth/me`, { headers: owner })).json();
  const eid = me.memberships[0].employer_id as string;
  const locs = await (
    await request.get(`${API}/v1/employers/${eid}/locations`, { headers: owner })
  ).json();
  const job = await (
    await request.post(`${API}/v1/employers/${eid}/jobs`, {
      headers: owner,
      data: {
        title: jobTitle,
        description: 'Morning espresso shifts.',
        employment_type: 'casual',
        location_id: locs[0].id,
        pay_min: '29',
        pay_max: '33',
        pay_period: 'hour',
        skills: ['Barista'],
      },
    })
  ).json();
  expect(
    (
      await request.post(`${API}/v1/employers/${eid}/jobs/${job.id}/publish`, { headers: owner })
    ).ok(),
  ).toBeTruthy();

  // ---- employer sends the invitation from the web ----
  const emp = await browser.newContext();
  const ep = await emp.newPage();
  await ep.goto(`${EMPLOYER}/login`);
  await ep.getByLabel(/email/i).fill('owner-a@nua-crew.example.com');
  await ep.getByLabel('Password').fill(PASSWORD);
  await ep.getByRole('button', { name: /log in/i }).click();
  await ep.waitForURL((u) => !u.pathname.startsWith('/login'));
  await ep.getByRole('link', { name: 'Find talent' }).click();
  await ep.getByLabel('Suburb').fill('Fitzroy');
  await ep.getByRole('button', { name: 'Search' }).click();
  const results = ep.getByRole('region', { name: 'Search results' });
  await expect(results.getByRole('heading', { name: /Alex C\./ })).toBeVisible();
  await results.getByText(/Invite Alex C\. to a job/).click();
  await results.getByLabel('Job').selectOption({ label: jobTitle });
  await results.getByLabel(/Short note/).fill('We would love to have you on the morning crew.');
  await results.getByRole('button', { name: 'Send invitation' }).click();
  await expect(ep.getByText(/Invitation created\. It is waiting in the candidate/)).toBeVisible();
  await expect(ep.getByRole('row', { name: /Alex C\..*Waiting for a reply/ })).toBeVisible();
  // never claims delivery or a read receipt
  await expect(ep.getByText(/delivered|seen|read by/i)).toHaveCount(0);

  // ---- candidate accepts on the phone screens ----
  await page.goto(APP);
  await page.getByRole('button', { name: 'Skip' }).click();
  await field(page, 'Email').fill('candidate-a@nua-crew.example.com');
  await field(page, 'Password').fill(PASSWORD);
  await page.getByRole('button', { name: 'Log in' }).click();
  await tab(page, 'Inbox').click();
  const card = page.getByRole('button', { name: new RegExp(`Invitation from .* for ${jobTitle}`) });
  await expect(card).toBeVisible();
  await card.click();
  await expect(page.getByText(/invited you/)).toBeVisible();
  await expect(page.getByText('We would love to have you on the morning crew.')).toBeVisible();
  await expect(page.getByText(/does not reserve a shift/)).toBeVisible();
  const a11y = await new AxeBuilder({ page }).analyze();
  expect(a11y.violations.filter((v) => v.impact === 'critical' || v.impact === 'serious')).toEqual(
    [],
  );
  await page.getByRole('button', { name: 'Accept and open a conversation' }).click();
  await page.getByRole('button', { name: 'Open conversation' }).click();
  await field(page, 'Message').fill('Hello! I can start next week.');
  await page.getByRole('button', { name: 'Send' }).click();
  await expect(page.getByText('Hello! I can start next week.')).toBeVisible();

  // ---- employer reads and replies ----
  await ep.goto(`${EMPLOYER}/messages`);
  await ep.getByRole('link', { name: /Alex C\./ }).click();
  await expect(ep.getByText('Hello! I can start next week.')).toBeVisible();
  await ep
    .getByRole('textbox', { name: 'Message' })
    .fill('Great, see you Monday at 7am. <script>alert(1)</script>');
  await ep.getByRole('button', { name: 'Send', exact: true }).click();
  await expect(ep.getByText('<script>alert(1)</script>', { exact: false })).toBeVisible(); // shown as text
  const a11yEmployer = await new AxeBuilder({ page: ep }).analyze();
  expect(
    a11yEmployer.violations.filter((v) => v.impact === 'critical' || v.impact === 'serious'),
  ).toEqual([]);

  await page.goto(APP);
  await tab(page, 'Inbox').click();
  await page.getByRole('tab', { name: /Messages/ }).click();
  await page
    .getByRole('button', { name: /Conversation with .* about/ })
    .first()
    .click();
  await expect(page.getByText(/see you Monday at 7am/)).toBeVisible();

  // ---- candidate blocks the employer: the thread closes for them ----
  await page.getByRole('button', { name: 'More' }).click();
  await page.getByRole('button', { name: /^Block / }).click();
  await expect(page.getByText(/They cannot find, invite or message you/)).toBeVisible();
  await page.getByRole('button', { name: 'Block', exact: true }).click();
  await ep.goto(`${EMPLOYER}/messages`);
  await expect(ep.getByText('No conversations yet.')).toBeVisible();
  // the employer's API access to that thread is gone as well
  const convs = await (
    await request.get(`${API}/v1/employers/${eid}/conversations`, { headers: owner })
  ).json();
  expect(convs).toEqual([]);
  await emp.close();
});
