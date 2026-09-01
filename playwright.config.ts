import { defineConfig } from '@playwright/test';

export default defineConfig({
  testDir: './tests/e2e',
  outputDir: '.tmp_e2e/results',
  fullyParallel: false,
  workers: 1,
  timeout: 90_000,
  expect: { timeout: 15_000 },
  reporter: [['list']],
  webServer: process.env.E2E_BASE_URL
    ? undefined
    : [
        {
          command: 'node tests/e2e/mock-scheduling-server.mjs',
          port: 3004,
          reuseExistingServer: true,
          timeout: 30_000,
        },
        {
          command: 'pnpm --filter @learn-and-build/web dev',
          port: 3100,
          reuseExistingServer: true,
          timeout: 120_000,
          env: { SCHEDULING_SERVICE_ORIGIN: 'http://127.0.0.1:3004' },
        },
      ],
  use: {
    baseURL: process.env.E2E_BASE_URL ?? 'http://localhost:3100',
    browserName: 'chromium',
    channel: 'chrome',
    headless: true,
    viewport: { width: 390, height: 844 },
    screenshot: 'only-on-failure',
    trace: 'retain-on-failure',
  },
});
