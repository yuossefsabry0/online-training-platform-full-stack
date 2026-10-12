'use strict';

module.exports = {
  testEnvironment: 'node',
  testMatch: ['**/__tests__/**/*.test.js'],
  setupFiles: ['<rootDir>/__tests__/setup.js'],
  testTimeout: 30000,
  forceExit: true,
  detectOpenHandles: true,
};
