import { chromium } from "@playwright/test";
import dotenv from "dotenv"; // Import dotenv here
import path from "path";
import { selfHealFlow } from "./utils/selfHealingActions";
import { validateSelfHealingFlow } from "./utils/selfHealingActions";

// Global setup function to set up base URL as per target environment passed on CLI
async function globalSetup() {
  const env_name = process.env.TARGET_ENV ?? "dev";
  // Use path.join() for cross-platform compatibility (Windows/Linux/macOS)
  const envFilePath = path.join("env", `.env.${env_name}`);
  console.log("Loading environment variables from:", envFilePath);
  dotenv.config({
    path: envFilePath, // Cross-platform path to environment file
    override: true,
  });
  console.log("username is ", process.env.TEST_USER);
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext();
  const page = await context.newPage();
  console.log("url is", process.env.BASE_URL);
  await page.goto(process.env.BASE_URL ?? "https://www.libertymutual.com/");
  await page.getByText("Log in").first().click();
  await page.getByRole("menuitem", { name: "Log in" }).first().click();

  const results = await selfHealFlow(page, [
    {
      action: "fill",
      locator: '[name="username123"]',   //incorrect locator
      value: process.env.TEST_USER || "",
      role: "username",
    },
    {
      action: "fill",
      locator: '[name="password123"]',    //incorrect locator
      value: process.env.PASSWORD || "",
      role: "password",
    },
    {
      action: "click",
      locator: '[name="submit"]',
      role: "submit",
    },
  ]);
  await validateSelfHealingFlow(results);
  await page.context().storageState({ path: "login.json" });
  await page.close();
}

export default globalSetup;
