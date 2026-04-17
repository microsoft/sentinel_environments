import { test, expect, type Page } from "@playwright/test";

test.setTimeout(60_000);
test.use({ viewport: { width: 1440, height: 900 } });

const API = process.env.PLAYWRIGHT_API_URL ?? "http://localhost:8000";
const SCENARIO_PATH =
  "../scenarios/microchat/unread-absolute-active.json";
const SCREENSHOTS = "../.cache/audit_screenshots/microchat";

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

async function getConversations() {
  return (await apiGet("/data/microchat-conversations")).body.conversations ?? [];
}

async function getMessages(conversationId?: string) {
  const path = conversationId
    ? `/data/microchat-messages?conversation_id=${conversationId}`
    : "/data/microchat-messages";
  return (await apiGet(path)).body.messages ?? [];
}

async function getTeams() {
  return (await apiGet("/data/microchat-teams")).body.teams ?? [];
}

async function getCalls() {
  return (await apiGet("/data/microchat-calls")).body.calls ?? [];
}

async function loadApp(page: Page) {
  await page.goto("/microchat", { waitUntil: "domcontentloaded" });
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

  test("GET /data/microchat-conversations returns conversations with expected schema", async () => {
    const conversations = await getConversations();
    expect(conversations.length).toBeGreaterThan(0);
    const c = conversations[0];
    expect(c).toHaveProperty("id");
    expect(c).toHaveProperty("name");
    expect(c).toHaveProperty("type");
    expect(c).toHaveProperty("participantIds");
    expect(c).toHaveProperty("isPinned");
    expect(c).toHaveProperty("isMuted");
  });

  test("GET /data/microchat-messages returns messages with expected schema", async () => {
    const messages = await getMessages();
    expect(messages.length).toBeGreaterThan(0);
    const m = messages[0];
    expect(m).toHaveProperty("id");
    expect(m).toHaveProperty("conversationId");
    expect(m).toHaveProperty("senderId");
    expect(m).toHaveProperty("senderName");
    expect(m).toHaveProperty("content");
  });

  test("GET /data/microchat-teams returns teams with channels", async () => {
    const teams = await getTeams();
    expect(teams.length).toBeGreaterThan(0);
    const t = teams[0];
    expect(t).toHaveProperty("id");
    expect(t).toHaveProperty("name");
    expect(t).toHaveProperty("channels");
    expect(Array.isArray(t.channels)).toBe(true);
  });

  test("GET /data/microchat-calls returns calls", async () => {
    const calls = await getCalls();
    expect(Array.isArray(calls)).toBe(true);
    if (calls.length > 0) {
      expect(calls[0]).toHaveProperty("id");
      expect(calls[0]).toHaveProperty("type");
    }
  });

  test("POST mark message as read returns success", async () => {
    const messages = await getMessages();
    const unread = messages.find((m: any) => !m.isRead);
    if (!unread) return;

    const { body } = await apiPost(`/data/microchat-messages/${unread.id}/read`);
    expect(body.success).toBe(true);
  });

  test("POST react to message returns success", async () => {
    const messages = await getMessages();
    if (messages.length === 0) return;

    const { body } = await apiPost(`/data/microchat-messages/${messages[0].id}/react`, {
      emoji: "👍",
    });
    expect(body.success).toBe(true);
  });

  test("POST pin conversation toggles pin state", async () => {
    const conversations = await getConversations();
    if (conversations.length === 0) return;

    const { body } = await apiPost(
      `/data/microchat-conversations/${conversations[0].id}/pin`
    );
    expect(body.success).toBe(true);
    expect(body).toHaveProperty("isPinned");
  });

  test("POST mute conversation toggles mute state", async () => {
    const conversations = await getConversations();
    if (conversations.length === 0) return;

    const { body } = await apiPost(
      `/data/microchat-conversations/${conversations[0].id}/mute`
    );
    expect(body.success).toBe(true);
    expect(body).toHaveProperty("isMuted");
  });

  test("POST mark message as read updates only the targeted message", async () => {
    const before = await getMessages();
    const unreadMessages = before.filter((m: any) => !m.isRead);
    const target = unreadMessages[0];
    if (!target) return;

    await apiPost(`/data/microchat-messages/${target.id}/read`);
    const after = await getMessages();
    const updated = after.find((m: any) => m.id === target.id);
    expect(updated.isRead).toBe(true);

    if (unreadMessages.length > 1) {
      const remainingUnread = after.filter((m: any) => !m.isRead);
      expect(remainingUnread.length).toBeGreaterThan(0);
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

  test("conversations render in sidebar from API data", async ({ page }) => {
    await loadApp(page);
    const conversations = await getConversations();
    if (conversations.length === 0) return;

    const convName = page.locator(`text=${conversations[0].name}`).first();
    expect(await convName.isVisible()).toBe(true);
    await screenshot(page, "ui-sync-conversations");
  });

  test("clicking conversation shows its messages", async ({ page }) => {
    await loadApp(page);
    const conversations = await getConversations();
    if (conversations.length === 0) return;

    const convItem = page.locator(`text=${conversations[0].name}`).first();
    await convItem.click();
    await page.waitForTimeout(1500);

    // Message input should appear
    const input = page.locator('input[placeholder*="Type a new message"]').first();
    expect(await input.isVisible()).toBe(true);
    await screenshot(page, "ui-sync-messages");
  });

  test("reading one message via API is reflected when the UI loads", async ({ page }) => {
    const messages = await getMessages();
    const unread = messages.find((m: any) => !m.isRead);
    if (unread) {
      await apiPost(`/data/microchat-messages/${unread.id}/read`);
      const after = await getMessages();
      expect(after.find((m: any) => m.id === unread.id)?.isRead).toBe(true);
    }

    await loadApp(page);
    await page.waitForTimeout(2000);
    await screenshot(page, "ui-sync-read-message");
  });
});

// ---------------------------------------------------------------------------
// 3. NAVIGATION & VIEWS
// ---------------------------------------------------------------------------

test.describe("3 · Navigation & Views", () => {
  test.beforeEach(async () => {
    await initAndAdvanceAll();
  });

  test("chat view is default and shows sidebar", async ({ page }) => {
    await loadApp(page);
    // Should see conversations list
    const conversations = await getConversations();
    if (conversations.length > 0) {
      const convItem = page.locator(`text=${conversations[0].name}`).first();
      expect(await convItem.isVisible()).toBe(true);
    }
    await screenshot(page, "nav-chat-view");
  });

  test("teams view shows team cards", async ({ page }) => {
    await loadApp(page);
    const teamsBtn = page.locator('button:has-text("Teams")').first();
    if (await teamsBtn.isVisible()) {
      await teamsBtn.click();
      await page.waitForTimeout(1000);
    }
    await screenshot(page, "nav-teams-view");
  });

  test("calendar view renders", async ({ page }) => {
    await loadApp(page);
    const calBtn = page.locator('button:has-text("Calendar")').first();
    if (await calBtn.isVisible()) {
      await calBtn.click();
      await page.waitForTimeout(1000);
    }
    await screenshot(page, "nav-calendar-view");
  });

  test("calls view shows call history", async ({ page }) => {
    await loadApp(page);
    const callsBtn = page.locator('button:has-text("Calls")').first();
    if (await callsBtn.isVisible()) {
      await callsBtn.click();
      await page.waitForTimeout(1000);
    }
    await screenshot(page, "nav-calls-view");
  });

  test("chat filters switch between All, Unread, Meetings", async ({ page }) => {
    await loadApp(page);

    const unreadFilter = page.locator('button:has-text("Unread")').first();
    if (await unreadFilter.isVisible()) {
      await unreadFilter.click();
      await page.waitForTimeout(500);
      await screenshot(page, "nav-filter-unread");
    }

    const allFilter = page.locator('button:has-text("All")').first();
    if (await allFilter.isVisible()) {
      await allFilter.click();
      await page.waitForTimeout(500);
    }
  });
});

// ---------------------------------------------------------------------------
// 4. SEARCH
// ---------------------------------------------------------------------------

test.describe("4 · Search", () => {
  test.beforeEach(async () => {
    await initAndAdvanceAll();
  });

  test("search bar filters conversations", async ({ page }) => {
    await loadApp(page);
    const searchInput = page.locator(
      'input[placeholder*="Search" i], input[placeholder*="search" i]'
    ).first();
    if (await searchInput.isVisible()) {
      const conversations = await getConversations();
      if (conversations.length > 0) {
        const searchTerm = conversations[0].name.split(" ")[0];
        await searchInput.fill(searchTerm);
        await page.waitForTimeout(1000);
      }
    }
    await screenshot(page, "search-conversations");
  });

  test("clearing search shows all conversations", async ({ page }) => {
    await loadApp(page);
    const searchInput = page.locator(
      'input[placeholder*="Search" i], input[placeholder*="search" i]'
    ).first();
    if (await searchInput.isVisible()) {
      await searchInput.fill("xyznonexistent");
      await page.waitForTimeout(500);
      await searchInput.clear();
      await page.waitForTimeout(1000);
    }
    await screenshot(page, "search-clear");
  });
});

// ---------------------------------------------------------------------------
// 5. MESSAGING
// ---------------------------------------------------------------------------

test.describe("5 · Messaging", () => {
  test.beforeEach(async () => {
    await initAndAdvanceAll();
  });

  test("message input is present after selecting conversation", async ({ page }) => {
    await loadApp(page);
    const conversations = await getConversations();
    if (conversations.length === 0) return;

    await page.locator(`text=${conversations[0].name}`).first().click();
    await page.waitForTimeout(1000);

    const input = page.locator('input[placeholder*="Type a new message"]').first();
    expect(await input.isVisible()).toBe(true);
    await screenshot(page, "msg-input");
  });

  test("sending a message appends to chat", async ({ page }) => {
    await loadApp(page);
    const conversations = await getConversations();
    if (conversations.length === 0) return;

    await page.locator(`text=${conversations[0].name}`).first().click();
    await page.waitForTimeout(1000);

    const input = page.locator('input[placeholder*="Type a new message"]').first();
    if (await input.isVisible()) {
      await input.fill("Audit test message");
      await input.press("Enter");
      await page.waitForTimeout(1500);

      const msgEl = page.locator("text=Audit test message").first();
      expect(await msgEl.isVisible()).toBe(true);
    }
    await screenshot(page, "msg-sent");
  });

  test("hover on message shows reaction buttons", async ({ page }) => {
    await loadApp(page);
    const conversations = await getConversations();
    if (conversations.length === 0) return;

    await page.locator(`text=${conversations[0].name}`).first().click();
    await page.waitForTimeout(1000);

    const messages = await getMessages(conversations[0].id);
    if (messages.length === 0) return;

    const msgEl = page.locator(`text=${messages[0].content}`).first();
    if (await msgEl.isVisible()) {
      await msgEl.hover();
      await page.waitForTimeout(500);
    }
    await screenshot(page, "msg-hover-reactions");
  });
});

// ---------------------------------------------------------------------------
// 6. REACTIONS
// ---------------------------------------------------------------------------

test.describe("6 · Reactions", () => {
  test.beforeEach(async () => {
    await initAndAdvanceAll();
  });

  test("clicking quick reaction adds emoji to message", async ({ page }) => {
    await loadApp(page);
    const conversations = await getConversations();
    if (conversations.length === 0) return;

    await page.locator(`text=${conversations[0].name}`).first().click();
    await page.waitForTimeout(1000);

    const messages = await getMessages(conversations[0].id);
    if (messages.length === 0) return;

    const msgEl = page.locator(`text=${messages[0].content}`).first();
    if (await msgEl.isVisible()) {
      await msgEl.hover();
      await page.waitForTimeout(500);

      const thumbsUp = page.locator('button:has-text("👍")').first();
      if (await thumbsUp.isVisible()) {
        await thumbsUp.click();
        await page.waitForTimeout(1000);
      }
    }
    await screenshot(page, "reaction-added");
  });

  test("reaction persists to server", async () => {
    const messages = await getMessages();
    if (messages.length === 0) return;

    await apiPost(`/data/microchat-messages/${messages[0].id}/react`, { emoji: "❤️" });
    const updated = await getMessages();
    const msg = updated.find((m: any) => m.id === messages[0].id);
    if (msg) {
      const hasReaction = msg.reactions?.some((r: any) => r.emoji === "❤️");
      expect(hasReaction).toBe(true);
    }
  });
});

// ---------------------------------------------------------------------------
// 7. TEAMS & CHANNELS
// ---------------------------------------------------------------------------

test.describe("7 · Teams & Channels", () => {
  test.beforeEach(async () => {
    await initAndAdvanceAll();
  });

  test("teams view lists available teams", async ({ page }) => {
    await loadApp(page);
    const teamsBtn = page.locator('button:has-text("Teams")').first();
    if (await teamsBtn.isVisible()) {
      await teamsBtn.click();
      await page.waitForTimeout(1000);
    }

    const teams = await getTeams();
    if (teams.length > 0) {
      const teamEl = page.locator(`text=${teams[0].name}`).first();
      expect(await teamEl.isVisible()).toBe(true);
    }
    await screenshot(page, "teams-list");
  });

  test("clicking team shows its channels", async ({ page }) => {
    await loadApp(page);
    const teamsBtn = page.locator('button:has-text("Teams")').first();
    if (await teamsBtn.isVisible()) {
      await teamsBtn.click();
      await page.waitForTimeout(1000);
    }

    const teams = await getTeams();
    if (teams.length === 0) return;

    const teamEl = page.locator(`text=${teams[0].name}`).first();
    await teamEl.click();
    await page.waitForTimeout(1000);

    if (teams[0].channels?.length > 0) {
      const channelEl = page.locator(`text=${teams[0].channels[0].name}`).first();
      expect(await channelEl.isVisible()).toBe(true);
    }
    await screenshot(page, "teams-channels");
  });
});

// ---------------------------------------------------------------------------
// 8. USER ACCOUNT & MODALS
// ---------------------------------------------------------------------------

test.describe("8 · User Account & Modals", () => {
  test.beforeEach(async () => {
    await initAndAdvanceAll();
  });

  test("profile dropdown opens from avatar", async ({ page }) => {
    await loadApp(page);
    const avatar = page.locator("header button, nav button").last();
    await avatar.click();
    await page.waitForTimeout(500);
    await screenshot(page, "user-dropdown");
  });

  test("settings modal opens", async ({ page }) => {
    await loadApp(page);
    // Open profile menu first
    const avatar = page.locator("header button, nav button").last();
    await avatar.click();
    await page.waitForTimeout(500);

    const settingsBtn = page.locator('button:has-text("Settings")').first();
    if (await settingsBtn.isVisible()) {
      await settingsBtn.click();
      await page.waitForTimeout(500);
    }
    await screenshot(page, "settings-modal");
  });

  test("sign out shows lock screen", async ({ page }) => {
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

      const overlay = page.locator('text=/sign.*in|log.*in|signed.*out/i').first();
      expect(await overlay.isVisible()).toBe(true);
    }
    await screenshot(page, "user-signout");
  });
});

// ---------------------------------------------------------------------------
// 9. TEAMS/SLACK FIDELITY
// ---------------------------------------------------------------------------

test.describe("9 · Teams Fidelity", () => {
  test.beforeEach(async () => {
    await initAndAdvanceAll();
  });

  test("left icon sidebar with nav buttons visible", async ({ page }) => {
    await loadApp(page);
    // Should have chat/teams/calendar/calls navigation
    const body = await page.innerText("body");
    expect(body.length).toBeGreaterThan(100);
    await screenshot(page, "fidelity-sidebar");
  });

  test("conversation list shows avatars and last message", async ({ page }) => {
    await loadApp(page);
    await screenshot(page, "fidelity-conversation-list");
  });

  test("chat header shows participant info and call buttons", async ({ page }) => {
    await loadApp(page);
    const conversations = await getConversations();
    if (conversations.length === 0) return;

    await page.locator(`text=${conversations[0].name}`).first().click();
    await page.waitForTimeout(1000);
    await screenshot(page, "fidelity-chat-header");
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

  test("rapid conversation switching - no crash", async ({ page }) => {
    await loadApp(page);
    const conversations = await getConversations();
    for (let i = 0; i < Math.min(5, conversations.length); i++) {
      const conv = page.locator(`text=${conversations[i].name}`).first();
      if (await conv.isVisible()) {
        await conv.click();
        await page.waitForTimeout(200);
      }
    }
    await page.waitForTimeout(1000);
    const body = await page.innerText("body");
    expect(body.length).toBeGreaterThan(0);
    await screenshot(page, "edge-rapid-switch");
  });

  test("reading one message leaves remaining unread state intact", async ({ page }) => {
    const before = await getMessages();
    const unreadMessages = before.filter((m: any) => !m.isRead);
    if (unreadMessages.length === 0) return;

    await apiPost(`/data/microchat-messages/${unreadMessages[0].id}/read`);
    await loadApp(page);
    await page.waitForTimeout(2000);

    const after = await getMessages();
    if (unreadMessages.length > 1) {
      expect(after.some((m: any) => !m.isRead)).toBe(true);
    }
    await screenshot(page, "edge-partial-read");
  });

  test("empty search yields no crash", async ({ page }) => {
    await loadApp(page);
    const searchInput = page.locator(
      'input[placeholder*="Search" i]'
    ).first();
    if (await searchInput.isVisible()) {
      await searchInput.fill("");
      await page.waitForTimeout(500);
    }
    const body = await page.innerText("body");
    expect(body.length).toBeGreaterThan(0);
    await screenshot(page, "edge-empty-search");
  });
});
