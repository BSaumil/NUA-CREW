module.exports = {
  preset: 'jest-expo',
  setupFilesAfterEnv: ['<rootDir>/jest.setup.ts'],
  moduleNameMapper: { '^@/(.*)$': '<rootDir>/src/$1' },
  // pnpm nests packages under node_modules/.pnpm/<pkg>/node_modules/<pkg>, so allow that segment.
  transformIgnorePatterns: [
    '/node_modules/(?!(\\.pnpm|(jest-)?react-native|@react-native(-community)?|expo(nent)?|@expo(nent)?/.*|@expo-google-fonts/.*|react-navigation|@react-navigation/.*|@nua-crew/.*|@tanstack/.*))',
  ],
  testTimeout: 20000, // first React Native render in a worker is slow on busy CI machines
  testMatch: ['**/__tests__/**/*.test.[jt]s?(x)'],
  testPathIgnorePatterns: ['/node_modules/', '/dist', '/dist-native'],
};
