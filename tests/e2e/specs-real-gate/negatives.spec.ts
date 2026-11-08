import { expect, test, type APIRequestContext } from '@playwright/test';

/**
 * Stage D negatives on the SHIPPED gates (see playwright.real-gate.config.ts). Each case asserts
 * the real HTTP status the API returns, or what the real employer app renders. Nothing here weakens
 * a production rule: a negative that passed because a gate was off would be worthless, so the
 * config leaves every gate at its shipped default.
 */
const API = 'http://localhost:8000';
const HIRE = 'http://localhost:3001';
const PASSWORD = 'a-long-setup-password-123';

const unique = (tag: string) =>
  `${tag}-${Date.now()}-${Math.floor(Math.random() * 1e6)}@nua-crew.example.com`;

/** A checksum-valid ABN that is unique to this call. */
function validAbn(): string {
  const weights = [10, 1, 3, 5, 7, 9, 11, 13, 15, 17, 19];
  const tail = Array.from({ length: 9 }, () => Math.floor(Math.random() * 10));
  for (let prefix = 10; prefix < 100; prefix += 1) {
    const digits = [Math.floor(prefix / 10), prefix % 10, ...tail];
    const sum = digits.reduce((acc, d, i) => acc + (i === 0 ? d - 1 : d) * weights[i]!, 0);
    if (sum % 89 === 0) return digits.join('');
  }
  throw new Error('no checksum-valid ABN found');
}

const candidateBody = (over: Record<string, unknown> = {}) => ({
  email: unique('neg-candidate'),
  password: PASSWORD,
  full_name: 'Negative Tester',
  accept_terms: true,
  ...over,
});

const employerBody = (over: Record<string, unknown> = {}) => ({
  email: unique('neg-employer'),
  password: PASSWORD,
  full_name: 'Negative Owner',
  organisation_name: `Negative Cafe ${Date.now()}`,
  abn: validAbn(),
  accept_terms: true,
  ...over,
});

async function registerEmployer(request: APIRequestContext) {
  const body = employerBody();
  const res = await request.post(`${API}/v1/auth/register/employer`, { data: body });
  expect(res.status()).toBe(201);
  const token = ((await res.json()) as { access_token: string }).access_token;
  const headers = { Authorization: `Bearer ${token}` };
  const me = await request.get(`${API}/v1/auth/me`, { headers });
  const employerId = ((await me.json()) as { memberships: { employer_id: string }[] })
    .memberships[0]!.employer_id;
  return { headers, employerId, body };
}

test.describe('candidate registration', () => {
  test('is refused without consent, with a weak password, for a non-AU country, or twice', async ({
    request,
  }) => {
    const post = (data: unknown) => request.post(`${API}/v1/auth/register/candidate`, { data });

    expect((await post(candidateBody({ accept_terms: false }))).status()).toBe(422);
    const noConsent: Record<string, unknown> = candidateBody();
    delete noConsent.accept_terms;
    expect((await post(noConsent)).status()).toBe(422);
    expect((await post(candidateBody({ password: 'short' }))).status()).toBe(422);
    expect((await post(candidateBody({ country_code: 'NZ' }))).status()).toBe(422);

    const first = candidateBody();
    expect((await post(first)).status()).toBe(201);
    expect((await post(first)).status()).toBe(409); // duplicate email
  });

  test('talent discovery consent is OFF by default', async ({ request }) => {
    const res = await request.post(`${API}/v1/auth/register/candidate`, { data: candidateBody() });
    expect(res.status()).toBe(201);
    const token = ((await res.json()) as { access_token: string }).access_token;
    const profile = await request.get(`${API}/v1/candidate/profile`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    expect(profile.status()).toBe(200);
    expect(((await profile.json()) as { discoverable: boolean }).discoverable).toBe(false);
  });
});

test.describe('employer registration', () => {
  test('is refused without an ABN, with a bad checksum, for a non-AU country, or a taken ABN', async ({
    request,
  }) => {
    const post = (data: unknown) => request.post(`${API}/v1/auth/register/employer`, { data });

    const noAbn: Record<string, unknown> = employerBody();
    delete noAbn.abn;
    expect((await post(noAbn)).status()).toBe(422);
    expect((await post(employerBody({ abn: '12 345 678 901' }))).status()).toBe(422); // checksum
    expect((await post(employerBody({ country_code: 'NZ' }))).status()).toBe(422);
    expect((await post(employerBody({ accept_terms: false }))).status()).toBe(422);

    const abn = validAbn();
    expect((await post(employerBody({ abn }))).status()).toBe(201);
    expect((await post(employerBody({ abn }))).status()).toBe(409); // ABN already registered
  });
});

test.describe('who may act on a business', () => {
  test('another business, a candidate and an anonymous caller cannot read or create its jobs', async ({
    request,
  }) => {
    const a = await registerEmployer(request);
    const b = await registerEmployer(request);
    const candidate = await request.post(`${API}/v1/auth/register/candidate`, {
      data: candidateBody(),
    });
    const candidateHeaders = {
      Authorization: `Bearer ${((await candidate.json()) as { access_token: string }).access_token}`,
    };
    const url = `${API}/v1/employers/${a.employerId}/jobs`;

    // Control: the owner can read its own jobs, so the refusals below are about tenancy, not a
    // broken route or a bad token.
    expect((await request.get(url, { headers: a.headers })).status()).toBe(200);

    // Another business gets a 404, not a 403: the other tenant's data is not even confirmed to exist.
    expect((await request.get(url, { headers: b.headers })).status()).toBe(404);
    expect((await request.get(url, { headers: candidateHeaders })).status()).toBe(404);
    expect((await request.get(url)).status()).toBe(401);

    const job = {
      title: 'Cross-tenant attempt',
      description: 'Should never be created.',
      employment_type: 'part_time',
    };
    const create = await request.post(url, { headers: b.headers, data: job });
    expect(create.status()).toBe(404);
  });

  test('an unconfirmed email cannot create a job even for its own business', async ({
    request,
  }) => {
    const a = await registerEmployer(request);
    const res = await request.post(`${API}/v1/employers/${a.employerId}/jobs`, {
      headers: a.headers,
      data: {
        title: 'Unconfirmed owner',
        description: 'Blocked by the verified-email gate.',
        employment_type: 'part_time',
      },
    });
    expect(res.status()).toBe(403);
    expect(JSON.stringify(await res.json())).toMatch(/email/i);
  });
});

test.describe('sign-in return paths cannot be turned into redirects', () => {
  for (const hostile of [
    'https://evil.test',
    '//evil.test',
    '/\\evil.test',
    '/jobs/new%0d%0aSet-Cookie:x=1',
    'javascript:alert(1)',
  ]) {
    test(`next=${hostile} falls back to the home page`, async ({ page }) => {
      await page.goto(`${HIRE}/login?next=${encodeURIComponent(hostile)}`);
      await expect(page.locator('input[name="next"]')).toHaveValue('/');
    });
  }

  test('a signed-out visit to /jobs/new keeps only the allow-listed return path', async ({
    page,
  }) => {
    await page.goto(`${HIRE}/jobs/new`);
    await expect(page).toHaveURL(/\/login\?next=%2Fjobs%2Fnew$/);
    await expect(page.locator('input[name="next"]')).toHaveValue('/jobs/new');
  });
});
