export default {
  testEnvironment: 'jsdom',
  roots: ['<rootDir>/src'],
  testMatch: ['**/__tests__/**/*.js', '**/*.test.js', '**/*.spec.js'],
  moduleNameMapper: {
    '\\.(css|less|scss|sass)$': 'identity-obj-proxy',
    '\\.(jpg|jpeg|png|gif|svg)$': 'identity-obj-proxy'
  },
  setupFilesAfterEnv: ['<rootDir>/src/setupTests.js'],
  transform: {
    '^.+\\.(js|jsx)$': 'babel-jest'
  },
  extensionsToTreatAsEsm: ['.jsx'],
  transformIgnorePatterns: [
    'node_modules/(?!(axios)/)'
  ],
  collectCoverageFrom: [
    'src/**/*.{js,jsx}',
    '!src/main.jsx',
    '!src/index.css',
    '!src/**/index.js'
  ],
  coverageThreshold: {
    global: {
      branches: 50,
      functions: 50,
      lines: 50,
      statements: 50
    },
    './src/services/': {
      branches: 70,
      functions: 70,
      lines: 70,
      statements: 70
    }
  }
};
