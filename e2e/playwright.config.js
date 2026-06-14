const { defineConfig, devices } = require('@playwright/test');

// Tests E2E contre la stack docker-compose déjà lancée :
//   Frontoffice -> http://localhost:5173, Backoffice -> http://localhost:5174,
//   API -> http://localhost:3000, PostgreSQL -> localhost:5432
module.exports = defineConfig({
  testDir: './tests',
  fullyParallel: false,
  workers: 1,
  retries: 0,
  timeout: 60000,
  reporter: [
    ['html', { outputFolder: 'playwright-report', open: 'never' }],
    ['list'],
  ],
  use: {
    screenshot: 'only-on-failure',
    video: 'retain-on-failure',
    locale: 'fr-FR',
  },
  projects: [
    {
      name: 'frontoffice',
      testMatch: /frontoffice\.spec\.js/,
      use: { ...devices['Desktop Chrome'], baseURL: 'http://localhost:5173' },
    },
    {
      name: 'backoffice',
      testMatch: /backoffice\.spec\.js/,
      use: { ...devices['Desktop Chrome'], baseURL: 'http://localhost:5174' },
    },
  ],
});
