/**
 * Jest Setup File
 * Runs before each test suite
 */

// Increase timeout for database operations
jest.setTimeout(10000);

// Mock console methods in tests (optional)
global.console = {
  ...console,
  // Suppress console.log in tests
  log: jest.fn(),
  debug: jest.fn(),
  info: jest.fn(),
  warn: jest.fn(),
  error: jest.fn(),
};
