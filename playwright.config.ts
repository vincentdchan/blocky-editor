import type { PlaywrightTestConfig } from "@playwright/test";

const config: PlaywrightTestConfig = {
  testDir: "tests",
  fullyParallel: true,
  use: {
    viewport: { width: 900, height: 600 },
  },
};

// eslint-disable-next-line @typescript-eslint/ban-ts-comment
// @ts-ignore
if (process.env.CI) {
  config.webServer = {
    command: "pnpm dev",
    port: 3000,
  };
}

export default config;
