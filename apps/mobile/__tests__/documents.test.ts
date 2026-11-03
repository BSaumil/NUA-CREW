import { api, authFetch } from '../src/api/client';
import { session, SessionChangedError } from '../src/api/session';
import { uploadDocument } from '../src/api/documents';

jest.mock('../src/api/client', () => ({
  ...jest.requireActual('../src/api/client'),
  api: { POST: jest.fn() },
  authFetch: jest.fn(),
}));
const POST = api.POST as jest.Mock;
const upload = authFetch as jest.Mock;
const metadata = {
  kind: 'resume' as const,
  title: 'My resume',
  filename: 'resume.pdf',
  content_type: 'application/pdf' as const,
  size_bytes: 5,
  client_key: 'stable-upload-key',
};
beforeEach(() => jest.clearAllMocks());
afterEach(() => jest.restoreAllMocks());

it('does not reserve or upload after the selected account changes', async () => {
  jest.spyOn(session, 'generation').mockReturnValue(2);
  await expect(uploadDocument(metadata, new Uint8Array(5), 1)).rejects.toBeInstanceOf(
    SessionChangedError,
  );
  expect(POST).not.toHaveBeenCalled();
  expect(upload).not.toHaveBeenCalled();
});

it('does not send private bytes if the session changes while reserving a file', async () => {
  let revision = 1;
  jest.spyOn(session, 'generation').mockImplementation(() => revision);
  POST.mockImplementation(async () => {
    revision = 2;
    return { data: { id: 'document-1' }, response: { ok: true } as Response };
  });
  await expect(uploadDocument(metadata, new Uint8Array(5), 1)).rejects.toBeInstanceOf(
    SessionChangedError,
  );
  expect(upload).not.toHaveBeenCalled();
});
