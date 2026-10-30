import { afterEach, expect, it } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';
import { axe } from 'vitest-axe';
import { notificationHref, WorkspaceSteps, WorkspaceTask } from '../src/workspace';
afterEach(cleanup);
it('reports unavailable task data distinctly from a real zero and retains a labelled action', async () => {
  const { container } = render(
    <main>
      <h1>Workspace</h1>
      <WorkspaceSteps title="Next steps">
        <WorkspaceTask
          href="/shifts"
          title="Shift offers"
          detail="Review the time and pay."
          count={null}
        />
        <WorkspaceTask
          href="/notifications"
          title="Unread updates"
          detail="Your account updates."
          count={0}
        />
      </WorkspaceSteps>
    </main>,
  );
  expect(screen.getByLabelText('Unavailable').textContent).toBe('—');
  expect(screen.getByLabelText('0 items').textContent).toBe('0');
  expect(screen.getByRole('link', { name: /Shift offers/ }).getAttribute('href')).toBe('/shifts');
  expect((await axe(container)).violations).toEqual([]);
});
it('notification payloads cannot supply an open redirect or another tenant path', () => {
  expect(
    notificationHref(
      'attendance.correction_requested',
      { booking_id: '../other', url: 'https://evil.invalid' },
      true,
    ),
  ).toBe('/shifts');
  expect(
    notificationHref('application.status_changed', { application_id: '../../secret' }, true),
  ).toBe('/');
  expect(notificationHref('application.status_changed', { application_id: 'a-b-c' }, true)).toBe(
    '/applications/a-b-c',
  );
  expect(notificationHref('message_received', { conversation_id: 'c-1' }, true)).toBe(
    '/messages/c-1',
  );
});
