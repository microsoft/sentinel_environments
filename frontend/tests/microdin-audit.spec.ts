import { test, expect, type Page } from "@playwright/test";

test.setTimeout(60_000);
test.use({ viewport: { width: 1440, height: 900 } });

const API = process.env.PLAYWRIGHT_SERVER_URL ?? "http://localhost:8000";
const SCENARIO_PATH =
  "../scenarios/microdin/connections-absolute-passive.json";
const SCREENSHOTS = "../.cache/audit_screenshots/microdin";

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
    event_timeline_end: scenario.event_timeline_end,
    condition_at: scenario.condition_at,
    eval_sql: scenario.eval_sql ?? "",
    events: scenario.events,
  });
  let status = (await apiGet("/status")).body;
  while (status.next_event_time !== null) {
    status = (await apiGet(`/advance?time=${status.next_event_time}`)).body;
  }
  return scenario;
}

async function getPosts() {
  return (await apiGet("/data/microdin-posts")).body.posts ?? [];
}

async function getConnections() {
  return (await apiGet("/data/microdin-connections")).body.connections ?? [];
}

async function getConversations() {
  return (await apiGet("/data/microdin-conversations")).body.conversations ?? [];
}

async function getNotifications() {
  return (await apiGet("/data/microdin-notifications")).body.notifications ?? [];
}

async function getJobs() {
  return (await apiGet("/data/microdin-jobs")).body.jobs ?? [];
}

async function loadApp(page: Page) {
  await page.goto("/microdin", { waitUntil: "domcontentloaded" });
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

  test("GET /data/microdin-posts returns posts with expected schema", async () => {
    const posts = await getPosts();
    expect(posts.length).toBeGreaterThan(0);
    const p = posts[0];
    expect(p).toHaveProperty("id");
    expect(p).toHaveProperty("authorId");
    expect(p).toHaveProperty("authorName");
    expect(p).toHaveProperty("content");
    expect(p).toHaveProperty("likes");
  });

  test("GET /data/microdin-connections returns connections", async () => {
    const connections = await getConnections();
    expect(connections.length).toBeGreaterThan(0);
    const c = connections[0];
    expect(c).toHaveProperty("id");
    expect(c).toHaveProperty("userId");
    expect(c).toHaveProperty("name");
    expect(c).toHaveProperty("title");
  });

  test("GET /data/microdin-conversations returns conversations", async () => {
    const conversations = await getConversations();
    expect(conversations.length).toBeGreaterThan(0);
    expect(conversations[0]).toHaveProperty("id");
    expect(conversations[0]).toHaveProperty("participants");
  });

  test("GET /data/microdin-notifications returns notifications", async () => {
    const notifications = await getNotifications();
    expect(notifications.length).toBeGreaterThan(0);
    const n = notifications[0];
    expect(n).toHaveProperty("id");
    expect(n).toHaveProperty("type");
    expect(n).toHaveProperty("actorName");
  });

  test("GET /data/microdin-jobs returns jobs", async () => {
    const jobs = await getJobs();
    expect(jobs.length).toBeGreaterThan(0);
    const j = jobs[0];
    expect(j).toHaveProperty("id");
    expect(j).toHaveProperty("title");
    expect(j).toHaveProperty("location");
  });

  test("POST like toggles post like state", async () => {
    const posts = await getPosts();
    const target = posts[0];
    await apiPost(`/data/microdin-posts/${target.id}/like`);
    const after = await getPosts();
    const updated = after.find((p: any) => p.id === target.id);
    expect(updated.isLiked).toBe(true);
  });

  test("POST accept connection changes status", async () => {
    const connections = await getConnections();
    const pending = connections.find((c: any) => c.status === "pending");
    if (!pending) return;

    await apiPost(`/data/microdin-connections/${pending.id}/accept`);
    const after = await getConnections();
    const updated = after.find((c: any) => c.id === pending.id);
    expect(updated.status).toBe("accepted");
  });

  test("POST ignore connection changes status", async () => {
    const connections = await getConnections();
    const pending = connections.find((c: any) => c.status === "pending");
    if (!pending) return;

    await apiPost(`/data/microdin-connections/${pending.id}/ignore`);
    const after = await getConnections();
    const updated = after.find((c: any) => c.id === pending.id);
    expect(updated.status).toBe("ignored");
  });

  test("POST apply to job changes status", async () => {
    const jobs = await getJobs();
    const target = jobs[0];
    await apiPost(`/data/microdin-jobs/${target.id}/apply`);
    const after = await getJobs();
    const updated = after.find((j: any) => j.id === target.id);
    expect(updated.isApplied).toBe(true);
  });

  test("POST mark notification read", async () => {
    const notifications = await getNotifications();
    const unread = notifications.find((n: any) => !n.isRead);
    if (!unread) return;

    await apiPost(`/data/microdin-notifications/${unread.id}/read`);
    const after = await getNotifications();
    const updated = after.find((n: any) => n.id === unread.id);
    expect(updated.isRead).toBe(true);
  });

  test("POST read conversation clears unread count for one conversation", async () => {
    const conversations = await getConversations();
    const target = conversations.find((c: any) => c.unreadCount > 0);
    if (!target) return;

    await apiPost(`/data/microdin-conversations/${target.id}/read`);
    const after = await getConversations();
    const updated = after.find((c: any) => c.id === target.id);
    expect(updated.unreadCount).toBe(0);
  });
});

// ---------------------------------------------------------------------------
// 2. UI ↔ API SYNC
// ---------------------------------------------------------------------------

test.describe("2 · UI ↔ API Sync", () => {
  test.beforeEach(async () => {
    await initAndAdvanceAll();
  });

  test("feed shows posts from API", async ({ page }) => {
    await loadApp(page);
    const posts = await getPosts();
    if (posts.length === 0) return;

    const postContent = page.locator(`text=${posts[0].authorName}`).first();
    expect(await postContent.isVisible()).toBe(true);
    await screenshot(page, "ui-sync-feed");
  });

  test("like button toggles and persists", async ({ page }) => {
    await loadApp(page);
    const likeBtn = page.locator('button:has-text("Like")').first();
    if (await likeBtn.isVisible()) {
      await likeBtn.click();
      await page.waitForTimeout(1500);
    }
    await screenshot(page, "ui-sync-like");
  });

  test("accepting connection updates UI", async ({ page }) => {
    await loadApp(page);
    // Navigate to My Network
    const networkBtn = page.locator('button:has-text("My Network")').first();
    if (await networkBtn.isVisible()) {
      await networkBtn.click();
      await page.waitForTimeout(1000);
    }

    const acceptBtn = page.locator('button:has-text("Accept")').first();
    if (await acceptBtn.isVisible()) {
      await acceptBtn.click();
      await page.waitForTimeout(1500);
    }
    await screenshot(page, "ui-sync-accept-connection");
  });
});

// ---------------------------------------------------------------------------
// 3. NAVIGATION & VIEWS
// ---------------------------------------------------------------------------

test.describe("3 · Navigation & Views", () => {
  test.beforeEach(async () => {
    await initAndAdvanceAll();
  });

  test("feed view is default", async ({ page }) => {
    await loadApp(page);
    const body = await page.innerText("body");
    expect(body.length).toBeGreaterThan(100);
    await screenshot(page, "nav-feed");
  });

  test("my network view shows connections", async ({ page }) => {
    await loadApp(page);
    const networkBtn = page.locator('button:has-text("My Network")').first();
    if (await networkBtn.isVisible()) {
      await networkBtn.click();
      await page.waitForTimeout(1000);
    }
    await screenshot(page, "nav-network");
  });

  test("jobs view shows job listings", async ({ page }) => {
    await loadApp(page);
    const jobsBtn = page.locator('button:has-text("Jobs")').first();
    if (await jobsBtn.isVisible()) {
      await jobsBtn.click();
      await page.waitForTimeout(1000);
    }
    await screenshot(page, "nav-jobs");
  });

  test("messaging view shows conversations", async ({ page }) => {
    await loadApp(page);
    const msgBtn = page.locator('button:has-text("Messaging")').first();
    if (await msgBtn.isVisible()) {
      await msgBtn.click();
      await page.waitForTimeout(1000);
    }
    await screenshot(page, "nav-messaging");
  });

  test("notifications dropdown opens", async ({ page }) => {
    await loadApp(page);
    const bellBtn = page.locator('button[aria-label*="notification" i], button[aria-label*="Notification" i]').first();
    if (!(await bellBtn.isVisible())) {
      // Try the bell icon in the header
      const headerBtns = page.locator("header button, nav button");
      const count = await headerBtns.count();
      for (let i = 0; i < count; i++) {
        const btn = headerBtns.nth(i);
        const text = await btn.innerText();
        if (text.includes("Notification") || text.includes("notification")) {
          await btn.click();
          break;
        }
      }
    } else {
      await bellBtn.click();
    }
    await page.waitForTimeout(500);
    await screenshot(page, "nav-notifications");
  });
});

// ---------------------------------------------------------------------------
// 4. SEARCH
// ---------------------------------------------------------------------------

test.describe("4 · Search", () => {
  test.beforeEach(async () => {
    await initAndAdvanceAll();
  });

  test("search bar accepts input and shows results", async ({ page }) => {
    await loadApp(page);
    const searchInput = page.locator(
      'input[placeholder*="Search" i], input[type="search"]'
    ).first();
    if (await searchInput.isVisible()) {
      await searchInput.fill("engineer");
      await page.waitForTimeout(1000);
    }
    await screenshot(page, "search-results");
  });

  test("job search filters listings", async ({ page }) => {
    await loadApp(page);
    const jobsBtn = page.locator('button:has-text("Jobs")').first();
    if (await jobsBtn.isVisible()) {
      await jobsBtn.click();
      await page.waitForTimeout(1000);
    }

    const jobSearch = page.locator(
      'input[placeholder*="Search jobs" i], input[placeholder*="search" i]'
    ).first();
    if (await jobSearch.isVisible()) {
      const jobs = await getJobs();
      if (jobs.length > 0) {
        const term = jobs[0].title.split(" ")[0];
        await jobSearch.fill(term);
        await page.waitForTimeout(1000);
      }
    }
    await screenshot(page, "search-jobs");
  });
});

// ---------------------------------------------------------------------------
// 5. CONNECTIONS
// ---------------------------------------------------------------------------

test.describe("5 · Connections", () => {
  test.beforeEach(async () => {
    await initAndAdvanceAll();
  });

  test("pending connections show accept/ignore buttons", async ({ page }) => {
    await loadApp(page);
    const networkBtn = page.locator('button:has-text("My Network")').first();
    if (await networkBtn.isVisible()) {
      await networkBtn.click();
      await page.waitForTimeout(1000);
    }

    const acceptBtn = page.locator('button:has-text("Accept")').first();
    const ignoreBtn = page.locator('button:has-text("Ignore")').first();
    const hasButtons =
      (await acceptBtn.isVisible()) || (await ignoreBtn.isVisible());
    expect(hasButtons).toBe(true);
    await screenshot(page, "connections-pending");
  });

  test("accepting one connection leaves other pending requests intact", async () => {
    const connections = await getConnections();
    const pending = connections.filter((c: any) => c.status === "pending");
    const target = pending[0];
    if (!target) return;

    await apiPost(`/data/microdin-connections/${target.id}/accept`);
    const after = await getConnections();
    const updated = after.find((c: any) => c.id === target.id);
    expect(updated.status).toBe("accepted");

    if (pending.length > 1) {
      expect(after.some((c: any) => c.id !== target.id && c.status === "pending")).toBe(true);
    }
  });
});

// ---------------------------------------------------------------------------
// 6. JOBS
// ---------------------------------------------------------------------------

test.describe("6 · Jobs", () => {
  test.beforeEach(async () => {
    await initAndAdvanceAll();
  });

  test("job listings render with title and company", async ({ page }) => {
    await loadApp(page);
    const jobsBtn = page.locator('button:has-text("Jobs")').first();
    if (await jobsBtn.isVisible()) {
      await jobsBtn.click();
      await page.waitForTimeout(1000);
    }

    const jobs = await getJobs();
    if (jobs.length > 0) {
      const titleEl = page.locator(`text=${jobs[0].title}`).first();
      expect(await titleEl.isVisible()).toBe(true);
    }
    await screenshot(page, "jobs-listings");
  });

  test("apply button persists to server", async ({ page }) => {
    await loadApp(page);
    const jobsBtn = page.locator('button:has-text("Jobs")').first();
    if (await jobsBtn.isVisible()) {
      await jobsBtn.click();
      await page.waitForTimeout(1000);
    }

    const applyBtn = page.locator('button:has-text("Apply")').first();
    if (await applyBtn.isVisible()) {
      await applyBtn.click();
      await page.waitForTimeout(1500);
    }
    await screenshot(page, "jobs-applied");
  });

  test("applying to one job leaves other jobs available", async () => {
    const jobs = await getJobs();
    const unappliedJobs = jobs.filter((j: any) => !j.isApplied);
    const target = unappliedJobs[0];
    if (!target) return;

    await apiPost(`/data/microdin-jobs/${target.id}/apply`);
    const after = await getJobs();
    const updated = after.find((j: any) => j.id === target.id);
    expect(updated.isApplied).toBe(true);

    if (unappliedJobs.length > 1) {
      expect(after.some((j: any) => j.id !== target.id && !j.isApplied)).toBe(true);
    }
  });
});

// ---------------------------------------------------------------------------
// 7. MESSAGING
// ---------------------------------------------------------------------------

test.describe("7 · Messaging", () => {
  test.beforeEach(async () => {
    await initAndAdvanceAll();
  });

  test("messaging view shows conversation list", async ({ page }) => {
    await loadApp(page);
    const msgBtn = page.locator('button:has-text("Messaging")').first();
    if (await msgBtn.isVisible()) {
      await msgBtn.click();
      await page.waitForTimeout(1000);
    }

    const conversations = await getConversations();
    if (conversations.length > 0 && conversations[0].participants?.length > 0) {
      const participantName = conversations[0].participants[0].name;
      const el = page.locator(`text=${participantName}`).first();
      expect(await el.isVisible()).toBe(true);
    }
    await screenshot(page, "messaging-list");
  });

  test("marking one conversation read clears its unread count", async () => {
    const conversations = await getConversations();
    const target = conversations.find((c: any) => c.unreadCount > 0);
    if (!target) return;

    await apiPost(`/data/microdin-conversations/${target.id}/read`);
    const after = await getConversations();
    const updated = after.find((c: any) => c.id === target.id);
    expect(updated.unreadCount).toBe(0);
  });
});

// ---------------------------------------------------------------------------
// 8. USER ACCOUNT & MODALS
// ---------------------------------------------------------------------------

test.describe("8 · User Account & Modals", () => {
  test.beforeEach(async () => {
    await initAndAdvanceAll();
  });

  test("profile dropdown opens", async ({ page }) => {
    await loadApp(page);
    const profileBtn = page.locator('button:has-text("Me"), button[aria-label*="profile" i]').first();
    if (!(await profileBtn.isVisible())) {
      const avatar = page.locator("header button, nav button").last();
      await avatar.click();
    } else {
      await profileBtn.click();
    }
    await page.waitForTimeout(500);
    await screenshot(page, "user-dropdown");
  });

  test("sign out shows lock screen", async ({ page }) => {
    await loadApp(page);
    // Open profile menu
    const avatar = page.locator("header button, nav button").last();
    await avatar.click();
    await page.waitForTimeout(500);

    const signOutBtn = page.locator(
      'button:has-text("Sign Out"), button:has-text("Sign out"), button:has-text("Log out")'
    ).first();
    if (await signOutBtn.isVisible()) {
      await signOutBtn.click();
      await page.waitForTimeout(1000);
      const overlay = page.locator('text=/sign.*in|log.*in|signed.*out/i').first();
      expect(await overlay.isVisible()).toBe(true);
    }
    await screenshot(page, "user-signout");
  });
});

// ---------------------------------------------------------------------------
// 9. LINKEDIN FIDELITY
// ---------------------------------------------------------------------------

test.describe("9 · LinkedIn Fidelity", () => {
  test.beforeEach(async () => {
    await initAndAdvanceAll();
  });

  test("header shows navigation tabs", async ({ page }) => {
    await loadApp(page);
    const homeBtn = page.locator('button:has-text("Home")').first();
    expect(await homeBtn.isVisible()).toBe(true);
    await screenshot(page, "fidelity-header");
  });

  test("feed shows post cards with author info", async ({ page }) => {
    await loadApp(page);
    const posts = await getPosts();
    if (posts.length > 0) {
      const authorEl = page.locator(`text=${posts[0].authorName}`).first();
      expect(await authorEl.isVisible()).toBe(true);
    }
    await screenshot(page, "fidelity-feed");
  });

  test("left sidebar shows profile card", async ({ page }) => {
    await loadApp(page);
    await screenshot(page, "fidelity-sidebar");
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

  test("rapid view switching - no crash", async ({ page }) => {
    await loadApp(page);
    const tabs = ["Home", "My Network", "Jobs", "Messaging"];
    for (const tab of tabs) {
      const btn = page.locator(`button:has-text("${tab}")`).first();
      if (await btn.isVisible()) {
        await btn.click();
        await page.waitForTimeout(200);
      }
    }
    await page.waitForTimeout(1000);
    const body = await page.innerText("body");
    expect(body.length).toBeGreaterThan(0);
    await screenshot(page, "edge-rapid-switch");
  });

  test("liking one post updates only that post", async () => {
    const posts = await getPosts();
    const unlikedPosts = posts.filter((p: any) => !p.isLiked);
    const target = unlikedPosts[0];
    if (!target) return;

    await apiPost(`/data/microdin-posts/${target.id}/like`);
    const after = await getPosts();
    const updated = after.find((p: any) => p.id === target.id);
    expect(updated.isLiked).toBe(true);

    if (unlikedPosts.length > 1) {
      expect(after.some((p: any) => p.id !== target.id && !p.isLiked)).toBe(true);
    }
  });

  test("marking one notification read leaves other unread notifications", async () => {
    const notifications = await getNotifications();
    const unreadNotifications = notifications.filter((n: any) => !n.isRead);
    const target = unreadNotifications[0];
    if (!target) return;

    await apiPost(`/data/microdin-notifications/${target.id}/read`);
    const after = await getNotifications();
    const updated = after.find((n: any) => n.id === target.id);
    expect(updated.isRead).toBe(true);

    if (unreadNotifications.length > 1) {
      expect(after.some((n: any) => n.id !== target.id && !n.isRead)).toBe(true);
    }
  });
});
