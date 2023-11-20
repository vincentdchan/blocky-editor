import { test, expect } from "@playwright/test";

test("can open example page", async ({ page }) => {
  await page.goto("http://localhost:3000/");
  await expect(page).toHaveTitle(/Blocky Editor Example/);
});
