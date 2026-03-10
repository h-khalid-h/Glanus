import { defineConfig, devices } from '@playwright/test';

/**
 * Playwright E2E configuration for Glanus.
 *
 * Run:
 *   npm run test:e2e          — headless
 *   npm run test:e2e:ui       — interactive UI
 *   npm run test:e2e:headed   — headed browser
 */
export default defineConfig({
    testDir: './e2e',
    fullyParallel: false, // Run serially to avoid overloading dev server
    forbidOnly: !!process.env.CI,
    retries: process.env.CI ? 1 : 0,
    workers: 1, // Single worker for dev server stability
    reporter: process.env.CI ? 'github' : 'html',
    timeout: 90_000, // 90s per test — cold-start page compilation can take up to 60s

    use: {
        baseURL: process.env.PLAYWRIGHT_BASE_URL || 'http://localhost:3000',
        trace: 'on-first-retry',
        screenshot: 'only-on-failure',
        video: 'retain-on-failure',
    },

    projects: [
        {
            name: 'chromium',
            use: { ...devices['Desktop Chrome'] },
        },
    ],

    /* Start the dev server before running tests (unless CI provides it) */
    webServer: process.env.CI
        ? undefined
        : {
            command: 'npm run dev',
            url: 'http://localhost:3000',
            reuseExistingServer: true,
            timeout: 120_000,
        },
});
