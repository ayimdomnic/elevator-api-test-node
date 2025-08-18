import type { Config } from 'jest';

const config: Config = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  testMatch: ['**/?(*.)+(spec|test).ts'],
  moduleNameMapper: {
    '^@app/(.*)$': '<rootDir>/src/$1',
    '^@app/controllers/(.*)$': '<rootDir>/src/controllers/$1',
    '^@app/services/(.*)$': '<rootDir>/src/services/$1',
    '^@app/repositories/(.*)$': '<rootDir>/src/repositories/$1',
    '^@app/middleware/(.*)$': '<rootDir>/src/middleware/$1',
    '^@app/utils/(.*)$': '<rootDir>/src/utils/$1',
    '^@app/config/(.*)$': '<rootDir>/src/config/$1',
    '^@app/workers/(.*)$': '<rootDir>/src/workers/$1',
    '^@app/types/(.*)$': '<rootDir>/src/types/$1',
  },
  setupFilesAfterEnv: ['<rootDir>/tests/setup.ts'],
  coverageDirectory: 'coverage',
  collectCoverage: true,
  coverageReporters: ['json', 'lcov', 'text', 'clover'],
  coverageThreshold: {
    global: {
      branches: 80,
      functions: 80,
      lines: 80,
      statements: 80,
    },
  },
  clearMocks: true,
  resetMocks: true,
};

export default config;
