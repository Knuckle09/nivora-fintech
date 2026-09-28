import { mkdir } from "node:fs/promises";
import { chromium } from "playwright";

const baseUrl = process.env.NIVORA_TEST_URL ?? "http://localhost:3000";
const browser = await chromium.launch({ headless: true });

try {
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 }, deviceScaleFactor: 1 });
  const errors = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await page.goto(`${baseUrl}/login`, { waitUntil: "networkidle" });
  await page.locator("nextjs-portal").evaluateAll((elements) => elements.forEach((element) => element.remove()));

  const desktop = await page.evaluate(() => ({
    width: window.innerWidth,
    documentWidth: document.documentElement.scrollWidth,
    inputLabels: [...document.querySelectorAll("input")].map((input) => input.labels?.length ?? 0),
    submitDisabled: document.querySelector('button[type="submit"]')?.disabled ?? false,
    configurationNotice: Boolean(document.querySelector(".auth-config-note"))
  }));
  if (desktop.documentWidth > desktop.width) throw new Error(`Desktop horizontal overflow: ${desktop.documentWidth}px in ${desktop.width}px.`);
  if (desktop.inputLabels.some((count) => count === 0)) throw new Error("An authentication input is missing its associated label.");
  if (desktop.configurationNotice && !desktop.submitDisabled) throw new Error("The unconfigured sign-in state should disable submission.");

  await page.getByRole("button", { name: "Create an account" }).click();
  if (await page.getByRole("heading", { name: "Start with clarity" }).count() !== 1) throw new Error("Sign-up mode did not open.");
  await page.getByRole("button", { name: "Sign in" }).click();
  if (await page.getByRole("heading", { name: "Welcome back" }).count() !== 1) throw new Error("Sign-in mode did not return.");

  await mkdir("public", { recursive: true });
  await page.screenshot({ path: "public/nivora-login.png", fullPage: true });

  for (const width of [390, 360, 320]) {
    await page.setViewportSize({ width, height: 844 });
    const mobile = await page.evaluate(() => ({ width: window.innerWidth, documentWidth: document.documentElement.scrollWidth }));
    if (mobile.documentWidth > mobile.width) throw new Error(`Mobile horizontal overflow: ${mobile.documentWidth}px in ${mobile.width}px.`);
    if (width === 390) await page.screenshot({ path: "public/nivora-login-mobile.png", fullPage: true });
  }

  await page.goto(`${baseUrl}/dashboard`, { waitUntil: "networkidle" });
  if (!new URL(page.url()).pathname.startsWith("/login")) throw new Error("An unauthenticated request was not redirected to sign-in.");
  if (errors.length) throw new Error(`Browser runtime errors: ${errors.join("; ")}`);
  console.log(JSON.stringify({ desktop, mobileWidthsChecked: [390, 360, 320], protectedDashboardRedirect: true, screenshots: ["public/nivora-login.png", "public/nivora-login-mobile.png"] }, null, 2));
} finally {
  await browser.close();
}
