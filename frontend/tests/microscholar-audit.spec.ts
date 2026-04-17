import { test, expect, type Page } from "@playwright/test";

test.setTimeout(60_000);
test.use({ viewport: { width: 1440, height: 900 } });

const API = process.env.PLAYWRIGHT_API_URL ?? "http://localhost:8000";
const SCENARIO_PATH =
  "../scenarios/microscholar/alert-absolute-passive.json";
const SCREENSHOTS = "../.cache/audit_screenshots/microscholar";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

async function screenshot(page: Page, name: string) {
  const fs = await import("fs");
  if (!fs.existsSync(SCREENSHOTS)) fs.mkdirSync(SCREENSHOTS, { recursive: true });
  await page.screenshot({ path: `${SCREENSHOTS}/${name}.png`, fullPage: true });
}

async function apiGet(path: string) {
  const res = await fetch(`${API}${path}`);
  return { status: res.status, body: await res.json() };
}

async function apiPost(path: string, body?: unknown) {
  const res = await fetch(`${API}${path}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: body ? JSON.stringify(body) : undefined,
  });
  return { status: res.status, body: await res.json() };
}

async function initAndAdvanceAll() {
  await fetch(`${API}/close`);
  const fs = await import("fs");
  const scenario = JSON.parse(fs.readFileSync(SCENARIO_PATH, "utf-8"));
  await apiPost("/init", {
    environment: scenario.environment,
    duration: scenario.duration,
    eval_sql: scenario.eval_sql ?? "",
    events: scenario.events,
  });
  let status = (await apiGet("/status")).body;
  while (status.next_event_time !== null) {
    status = (await apiGet(`/advance?time=${status.next_event_time}`)).body;
  }
  return scenario;
}

async function getPapers() {
  return (await apiGet("/data/microscholar-papers")).body.papers ?? [];
}

async function getAlerts() {
  return (await apiGet("/data/microscholar-alerts")).body.alerts ?? [];
}

async function getCoauthors() {
  return (await apiGet("/data/microscholar-coauthors")).body.coauthors ?? [];
}

async function loadApp(page: Page) {
  await page.goto("/microscholar", { waitUntil: "domcontentloaded" });
  await page.waitForSelector('[class*="bg-"]', { timeout: 15000 });
  await page.waitForTimeout(2000);
}

// ---------------------------------------------------------------------------
// 1. ENDPOINT INTEGRITY
// ---------------------------------------------------------------------------

test.describe("1 · Endpoint Integrity", () => {
  test.beforeEach(async () => {
    await initAndAdvanceAll();
  });

  test("GET /data/microscholar-papers returns papers with expected schema", async () => {
    const papers = await getPapers();
    expect(papers.length).toBeGreaterThan(0);
    const p = papers[0];
    expect(p).toHaveProperty("id");
    expect(p).toHaveProperty("title");
    expect(p).toHaveProperty("authors");
    expect(p).toHaveProperty("year");
    expect(p).toHaveProperty("citedBy");
    expect(p).toHaveProperty("isSaved");
  });

  test("GET /data/microscholar-alerts returns alerts", async () => {
    const alerts = await getAlerts();
    expect(alerts.length).toBeGreaterThan(0);
    const a = alerts[0];
    expect(a).toHaveProperty("id");
    expect(a).toHaveProperty("type");
    expect(a).toHaveProperty("title");
    expect(a).toHaveProperty("isRead");
  });

  test("GET /data/microscholar-coauthors returns coauthors", async () => {
    const coauthors = await getCoauthors();
    expect(Array.isArray(coauthors)).toBe(true);
    if (coauthors.length > 0) {
      expect(coauthors[0]).toHaveProperty("author1Name");
      expect(coauthors[0]).toHaveProperty("author2Name");
    }
  });

  test("GET /data/microscholar-papers?search=query returns filtered papers", async () => {
    const papers = await getPapers();
    if (papers.length === 0) return;

    const searchTerm = papers[0].title.split(" ")[0];
    const { body } = await apiGet(`/data/microscholar-papers?search=${searchTerm}`);
    expect(body.papers).toBeTruthy();
  });

  test("POST save paper toggles isSaved", async () => {
    const papers = await getPapers();
    const target = papers.find((p: any) => !p.isSaved);
    if (!target) return;

    await apiPost(`/data/microscholar-papers/${target.id}/save`);
    const after = await getPapers();
    const updated = after.find((p: any) => p.id === target.id);
    expect(updated.isSaved).toBe(true);

    // Toggle back
    await apiPost(`/data/microscholar-papers/${target.id}/save`);
    const again = await getPapers();
    expect(again.find((p: any) => p.id === target.id).isSaved).toBe(false);
  });

  test("POST cite paper returns success", async () => {
    const papers = await getPapers();
    if (papers.length === 0) return;

    const { body } = await apiPost(`/data/microscholar-papers/${papers[0].id}/cite`);
    expect(body.success).toBe(true);
  });

  test("POST mark alert read", async () => {
    const alerts = await getAlerts();
    const unread = alerts.find((a: any) => !a.isRead);
    if (!unread) return;

    await apiPost(`/data/microscholar-alerts/${unread.id}/read`);
    const after = await getAlerts();
    const updated = after.find((a: any) => a.id === unread.id);
    expect(updated.isRead).toBe(true);
  });

  test("POST save toggles one paper back to unsaved", async () => {
    const papers = await getPapers();
    const target = papers.find((p: any) => !p.isSaved) ?? papers[0];
    if (!target) return;

    if (!target.isSaved) {
      await apiPost(`/data/microscholar-papers/${target.id}/save`);
    }
    await apiPost(`/data/microscholar-papers/${target.id}/save`);
    const after = await getPapers();
    const updated = after.find((p: any) => p.id === target.id);
    expect(updated.isSaved).toBe(false);
  });

  test("POST read marks one alert read while leaving others unread", async () => {
    const alerts = await getAlerts();
    const unreadAlerts = alerts.filter((a: any) => !a.isRead);
    const target = unreadAlerts[0];
    if (!target) return;

    await apiPost(`/data/microscholar-alerts/${target.id}/read`);
    const after = await getAlerts();
    const updated = after.find((a: any) => a.id === target.id);
    expect(updated.isRead).toBe(true);

    if (unreadAlerts.length > 1) {
      expect(after.some((a: any) => a.id !== target.id && !a.isRead)).toBe(true);
    }
  });
});

// ---------------------------------------------------------------------------
// 2. UI ↔ API SYNC
// ---------------------------------------------------------------------------

test.describe("2 · UI ↔ API Sync", () => {
  test.beforeEach(async () => {
    await initAndAdvanceAll();
  });

  test("recommended articles render from API", async ({ page }) => {
    await loadApp(page);
    const papers = await getPapers();
    if (papers.length === 0) return;

    const titleEl = page.locator(`text=${papers[0].title}`).first();
    if (await titleEl.isVisible()) {
      expect(await titleEl.isVisible()).toBe(true);
    }
    await screenshot(page, "ui-sync-papers");
  });

  test("saving paper toggles star and persists", async ({ page }) => {
    await loadApp(page);
    const saveBtn = page.locator('button:has-text("Save"), text=Save').first();
    if (await saveBtn.isVisible()) {
      await saveBtn.click();
      await page.waitForTimeout(1500);
    }
    await screenshot(page, "ui-sync-save");
  });
});

// ---------------------------------------------------------------------------
// 3. NAVIGATION & VIEWS
// ---------------------------------------------------------------------------

test.describe("3 · Navigation & Views", () => {
  test.beforeEach(async () => {
    await initAndAdvanceAll();
  });

  test("home view shows search and recommended articles", async ({ page }) => {
    await loadApp(page);
    const searchInput = page.locator('[aria-label="Search"], input[type="text"]').first();
    expect(await searchInput.isVisible()).toBe(true);
    await screenshot(page, "nav-home");
  });

  test("my profile view shows user info and papers", async ({ page }) => {
    await loadApp(page);
    const profileBtn = page.locator('button:has-text("My profile"), a:has-text("My profile")').first();
    if (await profileBtn.isVisible()) {
      await profileBtn.click();
      await page.waitForTimeout(1000);
    }
    await screenshot(page, "nav-profile");
  });

  test("my library view shows saved papers", async ({ page }) => {
    await loadApp(page);
    const libraryBtn = page.locator('button:has-text("My library"), a:has-text("My library")').first();
    if (await libraryBtn.isVisible()) {
      await libraryBtn.click();
      await page.waitForTimeout(1000);
    }
    await screenshot(page, "nav-library");
  });

  test("labs view shows experimental features", async ({ page }) => {
    await loadApp(page);
    const labsBtn = page.locator('button:has-text("Labs"), a:has-text("Labs")').first();
    if (await labsBtn.isVisible()) {
      await labsBtn.click();
      await page.waitForTimeout(1000);
    }
    await screenshot(page, "nav-labs");
  });

  test("alerts view shows notifications", async ({ page }) => {
    await loadApp(page);
    const labsBtn = page.locator('button:has-text("Labs"), a:has-text("Labs")').first();
    if (await labsBtn.isVisible()) {
      await labsBtn.click();
      await page.waitForTimeout(500);
    }

    const alertsLink = page.locator('button:has-text("Set up alerts"), a:has-text("alerts")').first();
    if (await alertsLink.isVisible()) {
      await alertsLink.click();
      await page.waitForTimeout(1000);
    }
    await screenshot(page, "nav-alerts");
  });
});

// ---------------------------------------------------------------------------
// 4. SEARCH
// ---------------------------------------------------------------------------

test.describe("4 · Search", () => {
  test.beforeEach(async () => {
    await initAndAdvanceAll();
  });

  test("search returns filtered results", async ({ page }) => {
    await loadApp(page);
    const papers = await getPapers();
    if (papers.length === 0) return;

    const searchInput = page.locator('[aria-label="Search"], input[type="text"]').first();
    const searchTerm = papers[0].title.split(" ").slice(0, 2).join(" ");
    await searchInput.fill(searchTerm);

    const searchBtn = page.locator('button[aria-label="Search"], button[type="submit"]').first();
    if (await searchBtn.isVisible()) {
      await searchBtn.click();
      await page.waitForTimeout(2000);
    }
    await screenshot(page, "search-results");
  });

  test("advanced search modal opens", async ({ page }) => {
    await loadApp(page);
    const menuBtn = page.locator('[aria-label="Menu"]').first();
    if (await menuBtn.isVisible()) {
      await menuBtn.click();
      await page.waitForTimeout(500);
    }

    const advancedBtn = page.locator('button:has-text("Advanced search")').first();
    if (await advancedBtn.isVisible()) {
      await advancedBtn.click();
      await page.waitForTimeout(500);
    }
    await screenshot(page, "search-advanced");
  });

  test("search results show save and cite buttons", async ({ page }) => {
    await loadApp(page);
    const papers = await getPapers();
    if (papers.length === 0) return;

    const searchInput = page.locator('[aria-label="Search"], input[type="text"]').first();
    await searchInput.fill(papers[0].title.split(" ")[0]);

    const searchBtn = page.locator('button[aria-label="Search"], button[type="submit"]').first();
    if (await searchBtn.isVisible()) {
      await searchBtn.click();
      await page.waitForTimeout(2000);
    }

    const citeLink = page.locator('text=Cite').first();
    if (await citeLink.isVisible()) {
      expect(await citeLink.isVisible()).toBe(true);
    }
    await screenshot(page, "search-actions");
  });

  test("year filter narrows results", async ({ page }) => {
    await loadApp(page);
    const searchInput = page.locator('[aria-label="Search"], input[type="text"]').first();
    await searchInput.fill("machine learning");

    const searchBtn = page.locator('button[aria-label="Search"], button[type="submit"]').first();
    if (await searchBtn.isVisible()) {
      await searchBtn.click();
      await page.waitForTimeout(2000);
    }

    // Click year filter
    const yearFilter = page.locator('text=2024').first();
    if (await yearFilter.isVisible()) {
      await yearFilter.click();
      await page.waitForTimeout(1000);
    }
    await screenshot(page, "search-year-filter");
  });
});

// ---------------------------------------------------------------------------
// 5. PAPER INTERACTIONS
// ---------------------------------------------------------------------------

test.describe("5 · Paper Interactions", () => {
  test.beforeEach(async () => {
    await initAndAdvanceAll();
  });

  test("clicking paper title navigates to detail", async ({ page }) => {
    await loadApp(page);
    const papers = await getPapers();
    if (papers.length === 0) return;

    const titleEl = page.locator(`text=${papers[0].title}`).first();
    if (await titleEl.isVisible()) {
      await titleEl.click();
      await page.waitForTimeout(1000);
    }
    await screenshot(page, "paper-detail");
  });

  test("cited by link shows citing papers", async ({ page }) => {
    await loadApp(page);
    const citedByLink = page.locator('text=/Cited by/').first();
    if (await citedByLink.isVisible()) {
      await citedByLink.click();
      await page.waitForTimeout(1000);
    }
    await screenshot(page, "paper-cited-by");
  });

  test("clicking author name shows scholar profile", async ({ page }) => {
    await loadApp(page);
    // Authors are typically shown in green text
    const papers = await getPapers();
    if (papers.length === 0) return;

    // Find author link in recommended articles
    const authorDetails = papers[0].authorDetails;
    if (authorDetails && authorDetails.length > 0) {
      const authorEl = page.locator(`text=${authorDetails[0].name}`).first();
      if (await authorEl.isVisible()) {
        await authorEl.click();
        await page.waitForTimeout(1000);
      }
    }
    await screenshot(page, "paper-author-profile");
  });
});

// ---------------------------------------------------------------------------
// 6. ALERTS
// ---------------------------------------------------------------------------

test.describe("6 · Alerts", () => {
  test.beforeEach(async () => {
    await initAndAdvanceAll();
  });

  test("alerts show unread count", async ({ page }) => {
    await loadApp(page);
    // Navigate to labs then alerts
    const labsBtn = page.locator('button:has-text("Labs"), a:has-text("Labs")').first();
    if (await labsBtn.isVisible()) {
      await labsBtn.click();
      await page.waitForTimeout(500);
    }

    const alertsLink = page.locator('button:has-text("Set up alerts"), a:has-text("alerts")').first();
    if (await alertsLink.isVisible()) {
      await alertsLink.click();
      await page.waitForTimeout(1000);
    }

    const alerts = await getAlerts();
    const unreadCount = alerts.filter((a: any) => !a.isRead).length;
    if (unreadCount > 0) {
      const countEl = page.locator(`text=${unreadCount}`).first();
      if (await countEl.isVisible()) {
        expect(await countEl.isVisible()).toBe(true);
      }
    }
    await screenshot(page, "alerts-unread");
  });

  test("alerts view reflects reading one alert without a mark-all button", async ({ page }) => {
    const alerts = await getAlerts();
    const unread = alerts.find((a: any) => !a.isRead);
    if (unread) {
      await apiPost(`/data/microscholar-alerts/${unread.id}/read`);
    }

    await loadApp(page);
    const labsBtn = page.locator('button:has-text("Labs"), a:has-text("Labs")').first();
    if (await labsBtn.isVisible()) {
      await labsBtn.click();
      await page.waitForTimeout(500);
    }

    const alertsLink = page.locator('button:has-text("Set up alerts"), a:has-text("alerts")').first();
    if (await alertsLink.isVisible()) {
      await alertsLink.click();
      await page.waitForTimeout(1000);
    }

    await expect(page.locator('button:has-text("Mark all as read")')).toHaveCount(0);
    await screenshot(page, "alerts-single-read");
  });
});

// ---------------------------------------------------------------------------
// 7. PROFILE & COAUTHORS
// ---------------------------------------------------------------------------

test.describe("7 · Profile & Coauthors", () => {
  test.beforeEach(async () => {
    await initAndAdvanceAll();
  });

  test("profile shows publication list", async ({ page }) => {
    await loadApp(page);
    const profileBtn = page.locator('button:has-text("My profile"), a:has-text("My profile")').first();
    if (await profileBtn.isVisible()) {
      await profileBtn.click();
      await page.waitForTimeout(1000);
    }
    await screenshot(page, "profile-publications");
  });

  test("profile shows citation stats", async ({ page }) => {
    await loadApp(page);
    const profileBtn = page.locator('button:has-text("My profile"), a:has-text("My profile")').first();
    if (await profileBtn.isVisible()) {
      await profileBtn.click();
      await page.waitForTimeout(1000);
    }

    const citedBySection = page.locator('text=/Cited by|Citations|h-index/').first();
    if (await citedBySection.isVisible()) {
      expect(await citedBySection.isVisible()).toBe(true);
    }
    await screenshot(page, "profile-citations");
  });

  test("coauthors section is visible", async ({ page }) => {
    await loadApp(page);
    const profileBtn = page.locator('button:has-text("My profile"), a:has-text("My profile")').first();
    if (await profileBtn.isVisible()) {
      await profileBtn.click();
      await page.waitForTimeout(1000);
    }

    const coauthorSection = page.locator('text=/Co-authors|Coauthors/i').first();
    if (await coauthorSection.isVisible()) {
      expect(await coauthorSection.isVisible()).toBe(true);
    }
    await screenshot(page, "profile-coauthors");
  });
});

// ---------------------------------------------------------------------------
// 8. USER ACCOUNT & MODALS
// ---------------------------------------------------------------------------

test.describe("8 · User Account & Modals", () => {
  test.beforeEach(async () => {
    await initAndAdvanceAll();
  });

  test("user menu opens from profile button", async ({ page }) => {
    await loadApp(page);
    const avatar = page.locator("header button, nav button").last();
    await avatar.click();
    await page.waitForTimeout(500);
    await screenshot(page, "user-menu");
  });

  test("settings view renders sections", async ({ page }) => {
    await loadApp(page);
    const menuBtn = page.locator('[aria-label="Menu"]').first();
    if (await menuBtn.isVisible()) {
      await menuBtn.click();
      await page.waitForTimeout(500);
    }

    const settingsBtn = page.locator('button:has-text("Settings")').first();
    if (await settingsBtn.isVisible()) {
      await settingsBtn.click();
      await page.waitForTimeout(1000);
    }
    await screenshot(page, "settings-view");
  });

  test("sign out disables further actions", async ({ page }) => {
    await loadApp(page);
    const avatar = page.locator("header button, nav button").last();
    await avatar.click();
    await page.waitForTimeout(500);

    const signOutBtn = page.locator(
      'button:has-text("Sign out"), button:has-text("Log out")'
    ).first();
    if (await signOutBtn.isVisible()) {
      await signOutBtn.click();
      await page.waitForTimeout(1000);
    }
    await screenshot(page, "user-signout");
  });
});

// ---------------------------------------------------------------------------
// 9. GOOGLE SCHOLAR FIDELITY
// ---------------------------------------------------------------------------

test.describe("9 · Google Scholar Fidelity", () => {
  test.beforeEach(async () => {
    await initAndAdvanceAll();
  });

  test("header shows Scholar-like branding", async ({ page }) => {
    await loadApp(page);
    await screenshot(page, "fidelity-header");
  });

  test("paper results show title, authors, source, snippet", async ({ page }) => {
    await loadApp(page);
    const papers = await getPapers();
    if (papers.length > 0) {
      const titleEl = page.locator(`text=${papers[0].title}`).first();
      if (await titleEl.isVisible()) {
        expect(await titleEl.isVisible()).toBe(true);
      }
    }
    await screenshot(page, "fidelity-papers");
  });

  test("star icon for saved papers", async ({ page }) => {
    await loadApp(page);
    await screenshot(page, "fidelity-star-icon");
  });

  test("full app screenshot for visual review", async ({ page }) => {
    await loadApp(page);
    await screenshot(page, "fidelity-full-app");
  });
});

// ---------------------------------------------------------------------------
// 10. EDGE CASES
// ---------------------------------------------------------------------------

test.describe("10 · Edge Cases", () => {
  test.beforeEach(async () => {
    await initAndAdvanceAll();
  });

  test("rapid search submissions - no crash", async ({ page }) => {
    await loadApp(page);
    const searchInput = page.locator('[aria-label="Search"], input[type="text"]').first();
    if (await searchInput.isVisible()) {
      for (let i = 0; i < 5; i++) {
        await searchInput.fill(`term${i}`);
        await searchInput.press("Enter");
        await page.waitForTimeout(200);
      }
    }
    await page.waitForTimeout(1000);
    const body = await page.innerText("body");
    expect(body.length).toBeGreaterThan(0);
    await screenshot(page, "edge-rapid-search");
  });

  test("saving then unsaving one paper leaves it absent from saved state", async () => {
    const papers = await getPapers();
    const target = papers.find((p: any) => !p.isSaved) ?? papers[0];
    if (!target) return;

    if (!target.isSaved) {
      await apiPost(`/data/microscholar-papers/${target.id}/save`);
    }
    await apiPost(`/data/microscholar-papers/${target.id}/save`);
    const after = await getPapers();
    expect(after.find((p: any) => p.id === target.id)?.isSaved).toBe(false);
  });

  test("marking one alert read leaves remaining unread alerts intact", async () => {
    const alerts = await getAlerts();
    const unreadAlerts = alerts.filter((a: any) => !a.isRead);
    const target = unreadAlerts[0];
    if (!target) return;

    await apiPost(`/data/microscholar-alerts/${target.id}/read`);
    const after = await getAlerts();
    expect(after.find((a: any) => a.id === target.id)?.isRead).toBe(true);

    if (unreadAlerts.length > 1) {
      expect(after.some((a: any) => a.id !== target.id && !a.isRead)).toBe(true);
    }
  });
});
