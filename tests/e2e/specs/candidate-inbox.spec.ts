import AxeBuilder from '@axe-core/playwright';
import { expect, test, type APIRequestContext, type Browser, type Page } from '@playwright/test';

// Candidate invitations and messages on the website, against the real API. Each scenario uses a
// brand-new candidate so the employer's per-candidate decline cooldown never touches other specs.
const WEB = 'http://localhost:3000';
const API = 'http://localhost:8000';
const PASSWORD = 'nua-dev-password-1';
// A suburb no other spec searches, and every candidate made here stops being discoverable at the
// end, so these test people never turn up in another spec's talent search.
const SUBURB = 'Thornbury';
const made: Record<string, string>[] = [];

const auth = (token: string) => ({ Authorization: `Bearer ${token}` });
async function login(request: APIRequestContext, email: string, password = PASSWORD) {
  const r = await request.post(`${API}/v1/auth/login`, { data: { email, password } });
  return ((await r.json()) as { access_token: string }).access_token;
}

async function discoverableCandidate(request: APIRequestContext, tag: string) {
  const email = `${tag}-${Date.now()}-${Math.floor(Math.random() * 1e6)}@nua-crew.example.com`;
  const reg = await request.post(`${API}/v1/auth/register/candidate`, {
    data: { email, password: PASSWORD, full_name: `Inbox ${tag}`, accept_terms: true },
  });
  expect(reg.status()).toBe(201);
  const headers = auth(((await reg.json()) as { access_token: string }).access_token);
  const profile = await request.put(`${API}/v1/candidate/profile`, {
    headers,
    data: { full_name: `Inbox ${tag}`, suburb: SUBURB, state: 'VIC', postcode: '3070' },
  });
  expect(profile.ok()).toBeTruthy();
  const pref = await request.put(`${API}/v1/candidate/work-preferences/temporary`, {
    headers,
    data: { enabled: true, engagement_bases: ['employee'], hours_patterns: ['casual'] },
  });
  expect(pref.ok()).toBeTruthy();
  for (const path of ['talent-discovery', 'discovery/temporary']) {
    const r = await request.put(`${API}/v1/candidate/consents/${path}`, {
      headers,
      data: { granted: true },
    });
    expect(r.ok()).toBeTruthy();
  }
  made.push(headers);
  return { email, headers };
}

test.afterAll(async ({ request }) => {
  for (const headers of made) {
    await request.put(`${API}/v1/candidate/consents/talent-discovery`, {
      headers,
      data: { granted: false },
    });
  }
});

async function inviteFromOwner(request: APIRequestContext, name: string, note: string) {
  const owner = auth(await login(request, 'owner-b@nua-crew.example.com'));
  const me = await (await request.get(`${API}/v1/auth/me`, { headers: owner })).json();
  const eid = me.memberships[0].employer_id as string;
  const locs = await (
    await request.get(`${API}/v1/employers/${eid}/locations`, { headers: owner })
  ).json();
  const job = await (
    await request.post(`${API}/v1/employers/${eid}/jobs`, {
      headers: owner,
      data: {
        title: `Inbox Barista ${Date.now()}`,
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
  const found = await (
    await request.post(`${API}/v1/employers/${eid}/talent/search`, {
      headers: owner,
      data: { kind: 'temporary', suburb: SUBURB, job_id: job.id },
    })
  ).json();
  const ref = (found.items as { ref: string; display_name: string }[]).find((c) =>
    c.display_name.startsWith(name),
  )?.ref;
  expect(ref, 'the new candidate is discoverable by the employer').toBeTruthy();
  const sent = await request.post(`${API}/v1/employers/${eid}/invitations`, {
    headers: { ...owner, 'Idempotency-Key': `e2e-${Date.now()}-${Math.random()}` },
    data: { ref, job_id: job.id, kind: 'temporary', note },
  });
  expect(sent.status()).toBe(201);
  return { owner, eid, jobTitle: job.title as string, invitation: await sent.json() };
}

async function signIn(browser: Browser, email: string): Promise<Page> {
  const page = await (await browser.newContext()).newPage();
  await page.goto(`${WEB}/login`);
  await page.getByLabel('Email', { exact: true }).fill(email);
  await page.getByLabel('Password', { exact: true }).fill(PASSWORD);
  await page.getByRole('button', { name: 'Log in', exact: true }).click();
  await expect(page).not.toHaveURL(/\/login/);
  return page;
}

async function noSeriousA11y(page: Page) {
  const results = await new AxeBuilder({ page }).analyze();
  expect(
    results.violations.filter((v) => v.impact === 'serious' || v.impact === 'critical'),
  ).toEqual([]);
}

test('a candidate accepts an invitation, messages the employer, reports a message and ends it', async ({
  browser,
  request,
}) => {
  const c = await discoverableCandidate(request, 'Acceptor');
  const note = 'We would love to have you on the morning crew.';
  const { owner, eid, jobTitle } = await inviteFromOwner(request, 'Inbox A', note);

  const page = await signIn(browser, c.email);
  await page.goto(`${WEB}/inbox`);
  await expect(
    page.getByRole('heading', { level: 1, name: 'Invitations and messages' }),
  ).toBeVisible();
  const row = page.getByRole('listitem').filter({ hasText: 'Waiting for you' });
  await expect(row).toContainText('New');
  await noSeriousA11y(page);
  await row.getByRole('link').click();

  // The invitation shows what it is, in plain words, and what it is not.
  await expect(page.getByText(note)).toBeVisible();
  await expect(
    page
      .getByText(/not an application, a job offer/i)
      .or(page.getByText(/does not reserve a shift/i)),
  ).toBeVisible();
  await expect(page.getByRole('heading', { level: 1 })).toContainText('Fictional');
  await noSeriousA11y(page);
  await page.getByRole('button', { name: 'Accept and open a conversation' }).click();

  // Accepting opens a conversation; the first message goes through and shows once.
  await expect(page.locator('p[role="status"]', { hasText: 'Accepted' })).toBeVisible();
  await page.getByLabel('Message', { exact: true }).fill('Hello! I can start next week.');
  await page.getByRole('button', { name: 'Send' }).click();
  await expect(page.getByText('Hello! I can start next week.')).toHaveCount(1);
  await noSeriousA11y(page);

  // The employer replies through the API; the candidate sees it and can report that message.
  const convs = await (
    await request.get(`${API}/v1/employers/${eid}/conversations`, { headers: owner })
  ).json();
  const conv = convs.find((x: { job_title: string }) => x.job_title === jobTitle);
  const reply = await request.post(`${API}/v1/employers/${eid}/conversations/${conv.id}/messages`, {
    headers: owner,
    data: { body: 'Great, see you Monday <b>7am</b>.' },
  });
  expect(reply.status()).toBe(201);
  await page.reload();
  // Message text is shown as text: the markup is visible, never rendered.
  await expect(page.getByText('Great, see you Monday <b>7am</b>.')).toBeVisible();
  await page.getByText('Report this message').click();
  await page.getByLabel('What is wrong?').fill('Testing the report path');
  await page.getByRole('button', { name: 'Send report' }).click();
  await expect(page.locator('p[role="status"]', { hasText: 'review this report' })).toBeVisible();

  // Ending the conversation closes it for both; no send form remains.
  await page.getByText('End this conversation').click();
  await page.getByRole('button', { name: 'End conversation' }).click();
  await expect(page.getByText('This conversation has been closed.')).toBeVisible();
  await expect(page.getByLabel('Message', { exact: true })).toHaveCount(0);
});

test('a candidate declines without giving a reason and can pause new invitations', async ({
  browser,
  request,
}) => {
  const c = await discoverableCandidate(request, 'Decliner');
  await inviteFromOwner(request, 'Inbox D', 'Would you like a trial shift?');
  const page = await signIn(browser, c.email);
  await page.goto(`${WEB}/inbox`);
  await page.getByRole('listitem').filter({ hasText: 'Waiting for you' }).getByRole('link').click();
  await expect(page.getByLabel(/reason/i)).toHaveCount(0);
  await page.getByRole('button', { name: 'Decline' }).click();
  await expect(page.locator('p[role="status"]', { hasText: 'Invitation declined' })).toBeVisible();
  await expect(page.getByRole('listitem').filter({ hasText: 'Declined' })).toHaveCount(1);

  await page.getByRole('button', { name: 'Pause new invitations' }).click();
  await expect(
    page.locator('p[role="status"]', { hasText: 'New invitations are paused' }),
  ).toBeVisible();
  await expect(page.getByRole('button', { name: 'Allow new invitations' })).toBeVisible();
  await page.getByRole('button', { name: 'Allow new invitations' }).click();
  await expect(page.getByRole('button', { name: 'Pause new invitations' })).toBeVisible();
});

test('one candidate cannot open another candidate’s invitation or conversation', async ({
  browser,
  request,
}) => {
  const owner = await discoverableCandidate(request, 'Holder');
  const other = await discoverableCandidate(request, 'Snooper');
  const sent = await inviteFromOwner(request, 'Inbox H', 'A private invitation.');
  const page = await signIn(browser, other.email);
  const res = await page.goto(`${WEB}/inbox/invitations/${sent.invitation.id}`);
  expect(res?.status()).toBe(404);
  await expect(page.getByText('A private invitation.')).toHaveCount(0);
  expect(owner.email).not.toBe(other.email);
});

test('the inbox pages need a candidate login', async ({ page }) => {
  for (const path of ['/inbox', '/inbox/invitations/00000000-0000-0000-0000-000000000000']) {
    await page.goto(`${WEB}${path}`);
    await expect(page).toHaveURL(/\/login/);
  }
});
