import * as Sharing from 'expo-sharing';
import { api } from '../src/api/client';
import { exportAccount } from '../src/features/account-export';
import { session } from '../src/api/session';

const mockFile = {
  exists: true,
  create: jest.fn(),
  write: jest.fn(),
  delete: jest.fn(),
  uri: 'file:///private/export.json',
};
jest.mock('expo-file-system', () => ({
  File: jest.fn(() => mockFile),
  Paths: { cache: '/private' },
}));
jest.mock('expo-sharing', () => ({ isAvailableAsync: jest.fn(), shareAsync: jest.fn() }));
jest.mock('../src/api/client', () => ({
  ...jest.requireActual('../src/api/client'),
  api: { GET: jest.fn() },
}));
beforeEach(() => {
  jest.clearAllMocks();
  mockFile.delete.mockReset();
  (Sharing.isAvailableAsync as jest.Mock).mockResolvedValue(true);
  (Sharing.shareAsync as jest.Mock).mockResolvedValue(undefined);
  (api.GET as jest.Mock).mockResolvedValue({
    data: { account: { email: 'private@example.invalid' } },
    response: { ok: true },
  });
});
it('removes the temporary export after sharing', async () => {
  await exportAccount();
  expect(mockFile.write).toHaveBeenCalled();
  expect(mockFile.delete).toHaveBeenCalledTimes(1);
});
it('removes the export even if the share sheet fails', async () => {
  (Sharing.shareAsync as jest.Mock).mockRejectedValue(new Error('cancelled'));
  await expect(exportAccount()).rejects.toThrow('cancelled');
  expect(mockFile.delete).toHaveBeenCalledTimes(1);
});
it('does not fetch private data when sharing is unavailable', async () => {
  (Sharing.isAvailableAsync as jest.Mock).mockResolvedValue(false);
  expect(await exportAccount()).toMatch(/not available/);
  expect(api.GET).not.toHaveBeenCalled();
});
it('reports cleanup failures truthfully', async () => {
  mockFile.delete.mockImplementation(() => {
    throw new Error('storage unavailable');
  });
  await expect(exportAccount()).rejects.toThrow('temporary export could not be removed');
});

it('does not export a new account after a session change during the sharing check', async () => {
  let release!: (available: boolean) => void;
  (Sharing.isAvailableAsync as jest.Mock).mockReturnValueOnce(
    new Promise((r) => {
      release = r;
    }),
  );
  const pending = exportAccount();
  await session.clear();
  release(true);
  await expect(pending).rejects.toThrow('session changed');
  expect(api.GET).not.toHaveBeenCalled();
});
