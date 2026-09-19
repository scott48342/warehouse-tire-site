/** @type {import('jest').Config} */
module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  roots: ['<rootDir>/src'],
  testMatch: ['**/*.test.ts'],
  moduleNameMapper: {
    '^@/(.*)$': '<rootDir>/src/$1',
    // Legacy vitest-style suites run under jest via this shim (2026-09-19)
    '^vitest$': '<rootDir>/test-shims/vitest.ts',
  },
  transform: {
    '^.+\\.tsx?$': ['ts-jest', {
      tsconfig: {
        module: 'commonjs',
        esModuleInterop: true,
        allowSyntheticDefaultImports: true,
      },
    }],
  },
  setupFilesAfterEnv: [],
  collectCoverageFrom: [
    'src/lib/fitment-db/profileService.ts',
    'src/lib/aftermarketFitment.ts',
  ],
};
