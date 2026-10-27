const original = { ...process.env };

function config(overrides: Record<string, string | undefined>) {
  for (const key of [
    'EAS_BUILD_PROFILE',
    'EXPO_PUBLIC_API_URL',
    'NUA_IOS_BUNDLE_ID',
    'NUA_ANDROID_PACKAGE',
    'NUA_EAS_PROJECT_ID',
  ]) {
    delete process.env[key];
  }
  Object.assign(process.env, overrides);
  jest.isolateModules(() => require('../app.config'));
}
afterEach(() => {
  process.env = { ...original };
});
const approved = {
  EAS_BUILD_PROFILE: 'production',
  EXPO_PUBLIC_API_URL: 'https://api.nua-crew.example.com',
  NUA_IOS_BUNDLE_ID: 'com.nua.crew.test',
  NUA_ANDROID_PACKAGE: 'com.nua.crew.test',
  NUA_EAS_PROJECT_ID: '12345678-1234-1234-1234-123456789abc',
};

it('permits ordinary development exports without pretending store setup exists', () => {
  expect(() => config({})).not.toThrow();
});
it.each(['http://localhost:8000', 'https://api.invalid', 'https://127.0.0.1'])(
  'refuses a distributable build using %s',
  (url) => {
    expect(() => config({ ...approved, EXPO_PUBLIC_API_URL: url })).toThrow(/HTTPS/);
  },
);
it('requires explicit bundle identifiers and an EAS project for store-bound builds', () => {
  expect(() => config({ ...approved, NUA_IOS_BUNDLE_ID: undefined })).toThrow(/owner-approved/);
  expect(() => config({ ...approved, NUA_EAS_PROJECT_ID: undefined })).toThrow(/EAS project/);
  expect(() => config(approved)).not.toThrow();
});
