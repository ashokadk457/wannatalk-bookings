import { defineConfig } from '@playwright/test';
export default defineConfig({
  testDir: './src/tests/browser',
  timeout: 30000,
  retries: 0,
  workers: 1,
  use: {
    baseURL: process.env.TEST_BASE_URL || 'http://127.0.0.1:5173',
    channel: 'chrome',
    headless: true,
    viewport: { width: 1440, height: 1000 },
    screenshot: 'only-on-failure',
  },
  reporter: [['list'], ['html', { open: 'never' }]],
});
