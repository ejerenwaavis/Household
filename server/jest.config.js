/**
 * Jest Configuration
 * Test framework setup for backend API and database testing
 */

module.exports = {
  testEnvironment: 'node',
  collectCoverageFrom: [
    'src/**/*.js',
    '!src/**/*.test.js',
    '!src/config/**',
    '!src/index.js'
  ],
  testMatch: [
    '**/__tests__/**/*.js',
    '**/?(*.)+(spec|test).js'
  ],
  moduleNameMapper: {
    '^@/(.*)$': '<rootDir>/src/$1'
  },
  verbose: true,
  bail: false,
  testTimeout: 10000,
  setupFilesAfterEnv: ['<rootDir>/jest.setup.js'],
  coverageThresholds: {
    global: {
      branches: 50,
      functions: 50,
      lines: 50,
      statements: 50
    }
  }
};
