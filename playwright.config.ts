import { defineConfig, devices } from '@playwright/test';

process.env.NO_PROXY = [process.env.NO_PROXY, '127.0.0.1', 'localhost'].filter(Boolean).join(',');
process.env.no_proxy = process.env.NO_PROXY;

export default defineConfig({
  testDir: './e2e',
  fullyParallel: false,
  workers: 1,
  timeout: 45000,
  use: {
    ...devices['Desktop Chrome'],
    channel: 'chrome',
    baseURL: 'http://127.0.0.1:5173',
    screenshot: 'only-on-failure',
  },
  webServer: {
    command: 'npm run dev -- --port 5173 --strictPort',
    url: 'http://127.0.0.1:5173',
    reuseExistingServer: true,
  },
});
