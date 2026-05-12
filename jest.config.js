/** @type {import('jest').Config} */
module.exports = {
  testEnvironment: 'jest-environment-jsdom',
  setupFiles: ['<rootDir>/tests/setup.js'],
  testMatch: ['<rootDir>/tests/**/*.test.js'],
  collectCoverageFrom: [
    'www/js/shared.js',
    'www/js/index.js',
    'www/js/trial.js',
    'www/js/profil.js',
    'www/js/notifications.js',
  ],
  coverageReporters: ['text', 'lcov', 'html'],
  coverageDirectory: 'coverage',
  coverageThreshold: {
    global: { lines: 95, branches: 95, functions: 95, statements: 95 },
  },
  transform: {},
};
