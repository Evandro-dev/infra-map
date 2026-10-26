import { defineConfig } from '@playwright/test';

export default defineConfig({
  testDir: './tests/e2e',
  fullyParallel: false,
  workers: 1,
  timeout: 60_000,
  use: {
    baseURL: 'http://127.0.0.1:3001',
    viewport: { width: 1440, height: 1000 },
    screenshot: 'only-on-failure',
    trace: 'retain-on-failure',
  },
  webServer: [
    {
      command: 'npm run start --workspace=@infra/api',
      url: 'http://127.0.0.1:4001/health/ready',
      env: {
        API_PORT: '4001',
        ISL_MODE: 'disabled',
        ISL_REMOTE_EXEC_ENABLED: 'false',
        SUPPORT_OPERATOR_TOKEN: 'e2e-test-key-at-least-thirty-two-characters',
      },
      timeout: 60_000,
    },
    {
      command: 'npm exec --workspace=@infra/web -- next dev -H 127.0.0.1 -p 3001',
      url: 'http://127.0.0.1:3001',
      env: { API_INTERNAL_URL: 'http://127.0.0.1:4001', INFRA_MAP_E2E: 'true' },
      timeout: 60_000,
    },
  ],
});
