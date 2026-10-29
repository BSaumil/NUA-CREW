import { fireEvent, screen, waitFor } from '@testing-library/react-native';
import MyRoles from '../app/my-roles';
import { api } from '../src/api/client';
import { fail, ok, renderApp } from './helpers';

jest.mock('../src/api/client', () => ({
  ...jest.requireActual('../src/api/client'),
  api: { GET: jest.fn(), PUT: jest.fn() },
}));
const GET = api.GET as unknown as jest.Mock;
const PUT = api.PUT as unknown as jest.Mock;

const role = (code: string, title: string, over = {}) => ({
  code,
  title,
  department_code: 'd',
  department_name: 'Restaurant and fine-dining FOH',
  tier: 7,
  workstream: 'foh',
  indicative_text: '',
  needs_review: false,
  aliases: [],
  matched_alias: null,
  ...over,
});
const departments = [{ code: 'd', name: 'Restaurant and fine-dining FOH', role_count: 24 }];

function serve(
  mine: unknown[],
  found = [role('HC-0060', 'Waiter / Waitress', { matched_alias: 'waitstaff' })],
) {
  GET.mockImplementation(async (path: string) => {
    if (path === '/v1/candidate/roles') return ok(mine);
    if (path === '/v1/taxonomy/departments') return ok(departments);
    if (path === '/v1/taxonomy/roles') return ok(found);
    throw new Error(`unexpected GET ${path}`);
  });
}
beforeEach(() => {
  GET.mockReset();
  PUT.mockReset();
});

it('shows the empty state, finds a role by its synonym, adds it as the main role and saves', async () => {
  serve([]);
  PUT.mockImplementation(async (_p: string, o: { body: { roles: unknown[] } }) =>
    ok(
      o.body.roles.map(() => ({
        role: role('HC-0060', 'Waiter / Waitress'),
        years_experience: 2,
        is_primary: true,
      })),
    ),
  );
  await renderApp(<MyRoles />);
  expect(await screen.findByText(/No roles yet/)).toBeTruthy();
  await fireEvent.changeText(screen.getByLabelText('Search roles'), 'waitstaff');
  const add = await screen.findByRole('button', {
    name: 'Add Waiter / Waitress, Restaurant and fine-dining FOH',
  });
  expect(screen.getByText(/also called “waitstaff”/)).toBeTruthy();
  await fireEvent.press(add);
  expect(screen.getByText('Main role')).toBeTruthy();
  await fireEvent.press(
    screen.getByRole('button', { name: 'More years of experience as Waiter / Waitress' }),
  );
  await fireEvent.press(
    screen.getByRole('button', { name: 'More years of experience as Waiter / Waitress' }),
  );
  expect(screen.getByText('2 yrs')).toBeTruthy();
  await fireEvent.press(screen.getByRole('button', { name: 'Save my roles' }));
  await waitFor(() => expect(PUT).toHaveBeenCalled());
  expect(PUT.mock.calls[0]![1].body).toEqual({
    roles: [{ role_code: 'HC-0060', years_experience: 2, is_primary: true }],
  });
  expect(await screen.findByText(/Saved\. Your job matches now use these roles/)).toBeTruthy();
});

it('keeps what the person entered when saving fails', async () => {
  serve([{ role: role('HC-0060', 'Waiter / Waitress'), years_experience: 3, is_primary: true }]);
  PUT.mockResolvedValue(fail(500, 'Server error'));
  await renderApp(<MyRoles />);
  expect(await screen.findByText('3 yrs')).toBeTruthy();
  await fireEvent.press(screen.getByRole('button', { name: 'Save my roles' }));
  expect(await screen.findByText(/Your roles are still here/)).toBeTruthy();
  expect(screen.getByText('3 yrs')).toBeTruthy();
});

it('lets the person remove a role with an accessible control', async () => {
  serve([{ role: role('HC-0060', 'Waiter / Waitress'), years_experience: null, is_primary: true }]);
  await renderApp(<MyRoles />);
  await fireEvent.press(await screen.findByRole('button', { name: 'Remove Waiter / Waitress' }));
  expect(await screen.findByText(/No roles yet/)).toBeTruthy();
});

it('proposes roles found in the resume only when asked, and adds nothing until chosen', async () => {
  GET.mockImplementation(async (path: string) => {
    if (path === '/v1/candidate/roles') return ok([]);
    if (path === '/v1/taxonomy/departments') return ok(departments);
    if (path === '/v1/taxonomy/roles') return ok([]);
    if (path === '/v1/candidate/roles/suggestions')
      return ok([{ role: role('HC-0032', 'Barista'), matched_text: 'Barista', mentions: 3 }]);
    throw new Error(`unexpected GET ${path}`);
  });
  await renderApp(<MyRoles />);
  await screen.findByText(/No roles yet/);
  expect(GET.mock.calls.some((c) => c[0] === '/v1/candidate/roles/suggestions')).toBe(false);
  await fireEvent.press(screen.getByRole('button', { name: 'Find roles in my resume' }));
  const add = await screen.findByRole('button', { name: 'Add Barista, found in your resume' });
  expect(screen.getByText(/Found “Barista” 3× in your resume/)).toBeTruthy();
  expect(screen.getByText(/No roles yet/)).toBeTruthy(); // still nothing chosen
  await fireEvent.press(add);
  expect(screen.getByText('Main role')).toBeTruthy();
});
