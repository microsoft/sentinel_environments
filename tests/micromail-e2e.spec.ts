import { test, expect } from "@playwright/test";

const API = "http://localhost:8000";
const SCENARIO_PATH = "./sentinel_api/micromail/scenarios/micromail-attachment-absolute-active.json";

async function apiGet(path: string) {
  const res = await fetch(`${API}${path}`);
  return res.json();
}

async function apiPost(path: string, body?: object) {
  const res = await fetch(`${API}${path}`, {
    method: "POST",
    headers: body ? { "Content-Type": "application/json" } : {},
    body: body ? JSON.stringify(body) : undefined,
  });
  return res.json();
}

async function initAndAdvanceAll() {
  // Close any existing session
  await apiGet("/close");

  // Load scenario
  const fs = await import("fs");
  const scenario = JSON.parse(fs.readFileSync(SCENARIO_PATH, "utf-8"));

  // Init
  const initPayload = {
    environment: scenario.environment,
    duration: scenario.duration,
    eval_sql: scenario.eval_sql ?? "",
    events: scenario.events,
  };
  await apiPost("/init", initPayload);

  // Advance through all events
  let status = await apiGet("/status");
  while (status.next_event_time !== null) {
    status = await apiGet(`/advance?time=${status.next_event_time}`);
  }

  return scenario;
}

async function authenticate(page: import("@playwright/test").Page) {
  // Set localStorage auth flag before navigating
  await page.goto("/");
  await page.evaluate(() => localStorage.setItem("isAuthenticated", "true"));
}

test.describe("MicroMail E2E", () => {
  test("emails load and render in the inbox", async ({ page }) => {
    const scenario = await initAndAdvanceAll();

    await authenticate(page);
    await page.goto("/micromail");
    await page.waitForLoadState("networkidle");

    // Wait for polling to fetch emails (1s interval + render)
    await page.waitForTimeout(3000);

    // Should see email subjects in the page
    const bodyText = await page.innerText("body");
    expect(bodyText).toContain("Q3 Financial Report"); // att-01 subject

    // Should show inbox with emails
    expect(bodyText.toLowerCase()).toContain("inbox");

    // Take screenshot
    await page.screenshot({ path: "../sentinel_api/test_frontend_inbox.png", fullPage: true });
  });

  test("clicking an email marks it as read on the server", async ({ page }) => {
    await initAndAdvanceAll();

    await authenticate(page);
    await page.goto("/micromail");
    await page.waitForLoadState("networkidle");
    await page.waitForTimeout(3000);

    // All emails start unread - verify
    let emails = (await apiGet("/data/emails")).emails;
    const allUnread = emails.every((e: { isRead: boolean }) => !e.isRead);
    expect(allUnread).toBe(true);

    // Click the first email row
    const firstRow = page.locator('[role="option"]').first();
    if (await firstRow.isVisible()) {
      await firstRow.click();
      await page.waitForTimeout(2000); // Wait for API call + poll

      // Check server state
      emails = (await apiGet("/data/emails")).emails;
      const anyRead = emails.some((e: { isRead: boolean }) => e.isRead);
      expect(anyRead).toBe(true);
    }
  });

  test("evaluate returns success after all events", async ({ page }) => {
    await initAndAdvanceAll();

    // eval_sql is the sole arbiter — evaluate should succeed
    const result = await apiPost("/evaluate");
    expect(result.success).toBe(true);
  });

  test("error state when server has no session", async ({ page }) => {
    // Close any session - server is up but no init
    await apiGet("/close");

    await authenticate(page);
    await page.goto("/micromail");
    await page.waitForLoadState("networkidle");
    await page.waitForTimeout(3000);

    // Should show an error or empty state (not demo emails)
    const bodyText = await page.innerText("body");
    // Should NOT contain demo mode content
    expect(bodyText).not.toContain("[DEMO MODE]");
    expect(bodyText).not.toContain("demo-sentinel-error");
  });
});
