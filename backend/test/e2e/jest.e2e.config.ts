/**
 * Jest E2E Configuration
 *
 * Uses globalSetup to seed data once, then runs suites sequentially.
 */
import type { Config } from 'jest';

const config: Config = {
  testEnvironment: 'node',
  testTimeout: 60_000,
  maxWorkers: 1,
  testMatch: ['<rootDir>/suites/*.e2e.ts'],
  globalSetup: '<rootDir>/global-setup.ts',
  globalTeardown: '<rootDir>/global-teardown.ts',
  transform: {
    '^.+\\.ts$': [
      'ts-jest',
      {
        tsconfig: {
          module: 'commonjs',
          moduleResolution: 'node',
          esModuleInterop: true,
          allowSyntheticDefaultImports: true,
          target: 'ES2023',
          strict: true,
          skipLibCheck: true,
          types: ['jest', 'node'],
        },
      },
    ],
  },
  moduleFileExtensions: ['ts', 'js', 'json'],
};

export default config;
