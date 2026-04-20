module.exports = {
    testEnvironment: 'node',
    coverageDirectory: 'coverage',
    collectCoverageFrom: [
        'server/**/*.js',
        '!server/__tests__/**',
        '!server/index.js'
    ],
    testMatch: [
        '**/__tests__/**/*.test.js'
    ],
    verbose: true,
    testTimeout: 10000,
    setupFilesAfterEnv: ['<rootDir>/server/__tests__/setup.js']
};
