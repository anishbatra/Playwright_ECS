import { test, expect } from "@playwright/test";

test("login to your account @regression", async ({ page }) => {
  await page.goto("https://www.libertymutual.com/");
  await expect(page).toHaveTitle(
    "Liberty Mutual: A trusted insurance company for over 100 years"
  );
});
