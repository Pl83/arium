/** @type {import('jest').Config} */
module.exports = {
  testEnvironment: 'jest-environment-jsdom',
  setupFiles: ['<rootDir>/tests/setup.ts'],
  testMatch: ['<rootDir>/tests/**/*.test.ts'],
  transform: {
    '^.+\\.tsx?$': ['ts-jest', { tsconfig: 'tsconfig.jest.json' }],
  },
  collectCoverageFrom: [
    'src/shared.ts',
    'src/namefilter.ts',
    'src/blocklist.ts',
    'src/daylog.ts',
    'src/index.ts',
    'src/trial.ts',
    'src/profil.ts',
    'src/notifications.ts',
    'src/supabase.ts',
    'src/rankings.ts',
    'src/chronicle.ts',
  ],
  coverageReporters: ['text', 'lcov', 'html'],
  coverageDirectory: 'coverage',
  coverageThreshold: {
    global: { lines: 95, branches: 95, functions: 95, statements: 95 },
  },
};
