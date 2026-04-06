const nextJest = require('next/jest')

const createJestConfig = nextJest({
    // Provide the path to your Next.js app to load next.config.js and .env files in your test environment
    dir: './',
})

// Integration test paths that require a running PostgreSQL database
const DB_TEST_PATHS = [
    '<rootDir>/__tests__/api/workspaces/',
    '<rootDir>/__tests__/api/assets/',
    '<rootDir>/__tests__/api/admin/',
    '<rootDir>/__tests__/security/rls-integration.test.ts',
]

// Add any custom config to be passed to Jest
const customJestConfig = {
    setupFilesAfterEnv: ['<rootDir>/jest.setup.js'],
    testEnvironment: 'jest-environment-jsdom',
    moduleNameMapper: {
        '^@/(.*)$': '<rootDir>/$1',
    },
    collectCoverageFrom: [
        'app/**/*.{js,jsx,ts,tsx}',
        'components/**/*.{js,jsx,ts,tsx}',
        'lib/**/*.{js,jsx,ts,tsx}',
        '!**/*.d.ts',
        '!**/node_modules/**',
        '!**/.next/**',
    ],
    testPathIgnorePatterns: [
        '<rootDir>/node_modules/',
        '<rootDir>/.next/',
        '<rootDir>/e2e/',
        '<rootDir>/__tests__/setup/',
        // Skip DB-dependent integration tests when no DATABASE_URL is configured
        ...(process.env.DATABASE_URL ? [] : DB_TEST_PATHS),
    ],
    coverageThreshold: {
        global: {
            branches: 60,
            functions: 60,
            lines: 70,
            statements: 70,
        },
    },
}

// createJestConfig is exported this way to ensure that next/jest can load the Next.js config which is async
module.exports = createJestConfig(customJestConfig)
