import { defineConfig, devices } from '@playwright/test';
import {
  FRONTEND_BASE_URL,
  BACKEND_API_URL,
} from './tests/e2e-env/constants.cjs';

/**
 * Playwright E2E config for SmartCart's frontend.
 *
 * The whole run is self-contained: `globalSetup` boots a throwaway copy of
 * the real backend (unmodified `backend/src/app.js`) against an in-memory
 * MongoDB replica set — never the real Atlas cluster in backend/.env — and
 * `webServer` below starts a real Vite dev server pointed at that ephemeral
 * backend. See tests/e2e-env/global-setup.cjs for the full rationale.
 *
 * `workers: 1` is deliberate: every test shares one ephemeral backend and
 * one in-memory database, so cross-test data isolation under parallelism
 * isn't guaranteed — correctness over speed for this first QA pass.
 */
export default defineConfig({
  testDir: './tests',
  fullyParallel: false,
  workers: 1,
  forbidOnly: Boolean(process.env.CI),
  retries: process.env.CI ? 1 : 0,
  reporter: [['html', { open: 'never' }], ['list']],
  globalSetup: './tests/e2e-env/global-setup.cjs',

  use: {
    baseURL: FRONTEND_BASE_URL,
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
    video: 'off',
  },

  // Never reuse an already-running dev server: it could be a real one
  // pointed at the real backend/Atlas cluster, which this suite must never
  // touch. --strictPort makes a port conflict a loud startup failure
  // instead of silently binding elsewhere.
  webServer: {
    command: 'npm run dev -- --port 5173 --strictPort',
    url: FRONTEND_BASE_URL,
    reuseExistingServer: false,
    timeout: 60_000,
    env: { VITE_API_BASE_URL: BACKEND_API_URL },
  },

  projects: [
    {
      // Logs in as TEST QA Admin through the real /login UI form and saves
      // the resulting storageState — see tests/auth.setup.js.
      name: 'setup',
      testMatch: /auth\.setup\.js/,
    },
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'], viewport: { width: 1280, height: 800 } },
      testIgnore: /responsive\//,
      dependencies: ['setup'],
    },
    // Responsive suite only — three viewports, kept separate from the main
    // project so the rest of the suite isn't tripled in run time.
    {
      name: 'responsive-mobile-375',
      use: { ...devices['Desktop Chrome'], viewport: { width: 375, height: 812 } },
      testMatch: /responsive\//,
      dependencies: ['setup'],
    },
    {
      name: 'responsive-tablet-768',
      use: { ...devices['Desktop Chrome'], viewport: { width: 768, height: 1024 } },
      testMatch: /responsive\//,
      dependencies: ['setup'],
    },
    {
      name: 'responsive-desktop-1280',
      use: { ...devices['Desktop Chrome'], viewport: { width: 1280, height: 800 } },
      testMatch: /responsive\//,
      dependencies: ['setup'],
    },
  ],
});
