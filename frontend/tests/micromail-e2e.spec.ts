import { test, expect } from "@playwright/test";

const API = process.env.PLAYWRIGHT_SERVER_URL ?? "http://localhost:8000";
const SCENARIO_PATH = "../scenarios/micromail/inbox-relative-passive.json";

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
  await apiGet("/close");

  const fs = await import("fs");
  const scenario = JSON.parse(fs.readFileSync(SCENARIO_PATH, "utf-8"));

  const initPayload = {
    environment: scenario.environment,
    event_timeline_end: scenario.event_timeline_end,
    condition_at: scenario.condition_at,
    eval_sql: scenario.eval_sql ?? "",
    events: scenario.events,
  };
  await apiPost("/init", initPayload);

  let status = await apiGet("/status");
  while (status.next_event_time !== null) {
    status = await apiGet(`/advance?time=${status.next_event_time}`);
  }

  return scenario;
}

async function authenticate(page: import("@playwright/test").Page) {
  await page.goto("/");
}

test.describe("MicroMail E2E", () => {
  test("emails load and render in the inbox", async ({ page }) => {
    await initAndAdvanceAll();

    await authenticate(page);
    await page.goto("/micromail");
    await page.waitForLoadState("networkidle");
    await page.waitForTimeout(3000);

    const bodyText = await page.innerText("body");
    expect(bodyText).toContain("Q3 Financial Report");
    expect(bodyText.toLowerCase()).toContain("inbox");

    await page.screenshot({ path: "../server/test_frontend_inbox.png", fullPage: true });
  });

  test("clicking an email marks it as read on the server", async ({ page }) => {
    await initAndAdvanceAll();

    await authenticate(page);
    await page.goto("/micromail");
    await page.waitForLoadState("networkidle");
    await page.waitForTimeout(3000);

    let emails = (await apiGet("/data/micromail-emails")).emails;
    const allUnread = emails.every((e: { isRead: boolean }) => !e.isRead);
    expect(allUnread).toBe(true);

    const firstRow = page.locator('[role="option"]').first();
    if (await firstRow.isVisible()) {
      await firstRow.click();
      await page.waitForTimeout(2000);

      emails = (await apiGet("/data/micromail-emails")).emails;
      const anyRead = emails.some((e: { isRead: boolean }) => e.isRead);
      expect(anyRead).toBe(true);
    }
  });

  test("evaluate returns success after all events", async () => {
    await initAndAdvanceAll();

    // Non-noop scenarios require the /contact gate at or after condition_at
    // before /evaluate can pass. Advancing all events puts sim-time past
    // condition_at, so visiting /contact now satisfies the gate.
    await fetch(`${API}/contact`);

    const result = await apiPost("/evaluate");
    expect(result.success).toBe(true);
  });

  test("error state when server has no session", async ({ page }) => {
    await apiGet("/close");

    await authenticate(page);
    await page.goto("/micromail");
    await page.waitForLoadState("networkidle");
    await page.waitForTimeout(3000);

    const bodyText = await page.innerText("body");
    expect(bodyText).not.toContain("[DEMO MODE]");
    expect(bodyText).not.toContain("demo-sentinel-error");
  });
});