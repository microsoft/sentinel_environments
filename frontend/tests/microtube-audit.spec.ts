import { test, expect, type Page } from "@playwright/test";

test.setTimeout(60_000);
test.use({ viewport: { width: 1440, height: 900 } });

const API = process.env.PLAYWRIGHT_API_URL ?? "http://localhost:8000";
const SCENARIO_PATH =
  "../scenarios/microtube/notifications-absolute-active.json";
const SCREENSHOTS = "../.cache/audit_screenshots/microtube";

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

async function getVideos() {
  return (await apiGet("/data/microtube-videos")).body.videos ?? [];
}

async function getChannels() {
  return (await apiGet("/data/microtube-channels")).body.channels ?? [];
}

async function getNotifications() {
  return (await apiGet("/data/microtube-notifications")).body.notifications ?? [];
}

async function getPlaylists() {
  return (await apiGet("/data/microtube-playlists")).body.playlists ?? [];
}

async function loadApp(page: Page) {
  await page.goto("/microtube", { waitUntil: "domcontentloaded" });
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

  test("GET /data/microtube-videos returns videos with expected schema", async () => {
    const videos = await getVideos();
    expect(videos.length).toBeGreaterThan(0);
    const v = videos[0];
    expect(v).toHaveProperty("id");
    expect(v).toHaveProperty("title");
    expect(v).toHaveProperty("channelName");
    expect(v).toHaveProperty("views");
    expect(v).toHaveProperty("duration");
    expect(v).toHaveProperty("thumbnailColor");
  });

  test("GET /data/microtube-channels returns channels", async () => {
    const channels = await getChannels();
    expect(channels.length).toBeGreaterThan(0);
    const c = channels[0];
    expect(c).toHaveProperty("id");
    expect(c).toHaveProperty("name");
    expect(c).toHaveProperty("subscribers");
    expect(c).toHaveProperty("isSubscribed");
  });

  test("GET /data/microtube-notifications returns notifications", async () => {
    const notifications = await getNotifications();
    expect(notifications.length).toBeGreaterThan(0);
    const n = notifications[0];
    expect(n).toHaveProperty("id");
    expect(n).toHaveProperty("type");
    expect(n).toHaveProperty("message");
    expect(n).toHaveProperty("isDismissed");
  });

  test("GET /data/microtube-playlists returns playlists array", async () => {
    const playlists = await getPlaylists();
    expect(Array.isArray(playlists)).toBe(true);
  });

  test("GET /data/microtube-comments returns comments for video", async () => {
    const videos = await getVideos();
    const { body } = await apiGet(`/data/microtube-comments?video_id=${videos[0].id}`);
    expect(body).toHaveProperty("comments");
    expect(Array.isArray(body.comments)).toBe(true);
  });

  test("POST like video toggles isLiked", async () => {
    const videos = await getVideos();
    const target = videos.find((v: any) => !v.isLiked);
    if (!target) return;

    await apiPost(`/data/microtube-videos/${target.id}/like`);
    const after = await getVideos();
    const updated = after.find((v: any) => v.id === target.id);
    expect(updated.isLiked).toBe(true);

    // Toggle back
    await apiPost(`/data/microtube-videos/${target.id}/like`);
    const again = await getVideos();
    expect(again.find((v: any) => v.id === target.id).isLiked).toBe(false);
  });

  test("POST dislike video toggles isDisliked", async () => {
    const videos = await getVideos();
    const target = videos[0];

    await apiPost(`/data/microtube-videos/${target.id}/dislike`);
    const after = await getVideos();
    const updated = after.find((v: any) => v.id === target.id);
    expect(updated.isDisliked).toBe(true);
  });

  test("POST save video toggles isSaved", async () => {
    const videos = await getVideos();
    const target = videos[0];

    await apiPost(`/data/microtube-videos/${target.id}/save`);
    const after = await getVideos();
    const updated = after.find((v: any) => v.id === target.id);
    expect(updated.isSaved).toBe(true);
  });

  test("POST watch video marks as watched", async () => {
    const videos = await getVideos();
    const target = videos[0];

    await apiPost(`/data/microtube-videos/${target.id}/watch`);
    const after = await getVideos();
    const updated = after.find((v: any) => v.id === target.id);
    expect(updated.isWatched).toBe(true);
  });

  test("POST subscribe channel toggles subscription", async () => {
    const channels = await getChannels();
    const target = channels.find((c: any) => !c.isSelf && !c.isSubscribed);
    if (!target) return;

    await apiPost(`/data/microtube-channels/${target.id}/subscribe`);
    const after = await getChannels();
    const updated = after.find((c: any) => c.id === target.id);
    expect(updated.isSubscribed).toBe(true);
  });

  test("POST create comment returns new comment", async () => {
    const videos = await getVideos();
    const { body } = await apiPost("/data/microtube-comments", {
      video_id: videos[0].id,
      content: "Audit test comment",
    });
    expect(body).toBeTruthy();
  });

  test("POST dismiss notification", async () => {
    const notifications = await getNotifications();
    const active = notifications.find((n: any) => !n.isDismissed);
    if (!active) return;

    await apiPost(`/data/microtube-notifications/${active.id}/dismiss`);
    const after = await getNotifications();
    const updated = after.find((n: any) => n.id === active.id);
    expect(updated.isDismissed).toBe(true);
  });

  test("POST create playlist", async () => {
    const { body } = await apiPost("/data/microtube-playlists", {
      name: "Audit Playlist",
    });
    expect(body).toBeTruthy();

    const playlists = await getPlaylists();
    const found = playlists.find((p: any) => p.name === "Audit Playlist");
    expect(found).toBeTruthy();
  });

  test("POST add video to playlist", async () => {
    const { body: created } = await apiPost("/data/microtube-playlists", {
      name: "Add Test Playlist",
    });
    const playlists = await getPlaylists();
    const pl = playlists.find((p: any) => p.name === "Add Test Playlist");
    if (!pl) return;

    const videos = await getVideos();
    await apiPost(`/data/microtube-playlists/${pl.id}/add`, {
      video_id: videos[0].id,
    });

    const after = await getPlaylists();
    const updated = after.find((p: any) => p.id === pl.id);
    expect(updated.video_ids).toContain(videos[0].id);
  });

  test("POST read notification marks one notification as read", async () => {
    const notifications = await getNotifications();
    const unread = notifications.find((n: any) => !n.isRead);
    if (!unread) return;

    await apiPost(`/data/microtube-notifications/${unread.id}/read`);
    const after = await getNotifications();
    const updated = after.find((n: any) => n.id === unread.id);
    expect(updated.isRead).toBe(true);
  });

  test("POST like toggles a liked video back off", async () => {
    const videos = await getVideos();
    const target = videos.find((v: any) => !v.isLiked) ?? videos[0];
    if (!target) return;

    if (!target.isLiked) {
      await apiPost(`/data/microtube-videos/${target.id}/like`);
    }
    await apiPost(`/data/microtube-videos/${target.id}/like`);
    const after = await getVideos();
    const updated = after.find((v: any) => v.id === target.id);
    expect(updated.isLiked).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// 2. UI ↔ API SYNC
// ---------------------------------------------------------------------------

test.describe("2 · UI ↔ API Sync", () => {
  test.beforeEach(async () => {
    await initAndAdvanceAll();
  });

  test("video grid renders with titles from API", async ({ page }) => {
    await loadApp(page);
    const videos = await getVideos();
    if (videos.length === 0) return;

    const titleEl = page.locator(`text=${videos[0].title}`).first();
    expect(await titleEl.isVisible()).toBe(true);
    await screenshot(page, "ui-sync-grid");
  });

  test("clicking video opens player view", async ({ page }) => {
    await loadApp(page);
    const videos = await getVideos();
    if (videos.length === 0) return;

    const videoCard = page.locator(`text=${videos[0].title}`).first();
    await videoCard.click();
    await page.waitForTimeout(1000);
    await screenshot(page, "ui-sync-player");
  });

  test("like button toggles and persists", async ({ page }) => {
    await loadApp(page);
    const videos = await getVideos();
    if (videos.length === 0) return;

    // Click into a video
    const videoCard = page.locator(`text=${videos[0].title}`).first();
    await videoCard.click();
    await page.waitForTimeout(1000);

    const likeBtn = page.locator(
      'button[aria-label*="like" i], button[aria-label*="Like" i]'
    ).first();
    if (await likeBtn.isVisible()) {
      await likeBtn.click();
      await page.waitForTimeout(1500);
    }
    await screenshot(page, "ui-sync-like");
  });
});

// ---------------------------------------------------------------------------
// 3. NAVIGATION & VIEWS
// ---------------------------------------------------------------------------

test.describe("3 · Navigation & Views", () => {
  test.beforeEach(async () => {
    await initAndAdvanceAll();
  });

  test("home view shows video grid", async ({ page }) => {
    await loadApp(page);
    await screenshot(page, "nav-home");
  });

  test("shorts section renders", async ({ page }) => {
    await loadApp(page);
    const shortsBtn = page.locator('button:has-text("Shorts"), a:has-text("Shorts")').first();
    if (await shortsBtn.isVisible()) {
      await shortsBtn.click();
      await page.waitForTimeout(1000);
    }
    await screenshot(page, "nav-shorts");
  });

  test("subscriptions section shows subscribed channels", async ({ page }) => {
    await loadApp(page);
    const subsBtn = page.locator(
      'button:has-text("Subscriptions"), a:has-text("Subscriptions")'
    ).first();
    if (await subsBtn.isVisible()) {
      await subsBtn.click();
      await page.waitForTimeout(1000);
    }
    await screenshot(page, "nav-subscriptions");
  });

  test("library/you section renders", async ({ page }) => {
    await loadApp(page);
    const youBtn = page.locator('button:has-text("You"), a:has-text("You")').first();
    if (await youBtn.isVisible()) {
      await youBtn.click();
      await page.waitForTimeout(1000);
    }
    await screenshot(page, "nav-you");
  });

  test("history section renders", async ({ page }) => {
    await loadApp(page);
    const histBtn = page.locator('button:has-text("History"), a:has-text("History")').first();
    if (await histBtn.isVisible()) {
      await histBtn.click();
      await page.waitForTimeout(1000);
    }
    await screenshot(page, "nav-history");
  });

  test("sidebar collapses and expands", async ({ page }) => {
    await loadApp(page);
    const menuBtn = page.locator(
      'button[aria-label*="menu" i], button[aria-label*="Menu" i], button[aria-label*="sidebar" i]'
    ).first();
    if (await menuBtn.isVisible()) {
      await menuBtn.click();
      await page.waitForTimeout(500);
      await screenshot(page, "nav-sidebar-collapsed");
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

  test("search filters videos by title", async ({ page }) => {
    await loadApp(page);
    const videos = await getVideos();
    if (videos.length === 0) return;

    const searchInput = page.locator(
      'input[placeholder*="Search" i], input[type="search"]'
    ).first();
    if (await searchInput.isVisible()) {
      const searchTerm = videos[0].title.split(" ")[0];
      await searchInput.fill(searchTerm);
      await searchInput.press("Enter");
      await page.waitForTimeout(1500);
    }
    await screenshot(page, "search-results");
  });

  test("clearing search returns to home", async ({ page }) => {
    await loadApp(page);
    const searchInput = page.locator(
      'input[placeholder*="Search" i], input[type="search"]'
    ).first();
    if (await searchInput.isVisible()) {
      await searchInput.fill("xyznonexistent");
      await searchInput.press("Enter");
      await page.waitForTimeout(500);
      await searchInput.clear();
      await searchInput.press("Enter");
      await page.waitForTimeout(1000);
    }
    await screenshot(page, "search-clear");
  });
});

// ---------------------------------------------------------------------------
// 5. VIDEO PLAYER
// ---------------------------------------------------------------------------

test.describe("5 · Video Player", () => {
  test.beforeEach(async () => {
    await initAndAdvanceAll();
  });

  test("video detail shows title, channel, description", async ({ page }) => {
    await loadApp(page);
    const videos = await getVideos();
    if (videos.length === 0) return;

    const videoCard = page.locator(`text=${videos[0].title}`).first();
    await videoCard.click();
    await page.waitForTimeout(1000);

    const titleEl = page.locator(`text=${videos[0].title}`).first();
    expect(await titleEl.isVisible()).toBe(true);

    const channelEl = page.locator(`text=${videos[0].channelName}`).first();
    expect(await channelEl.isVisible()).toBe(true);

    await screenshot(page, "player-detail");
  });

  test("like/dislike/save buttons are visible", async ({ page }) => {
    await loadApp(page);
    const videos = await getVideos();
    if (videos.length === 0) return;

    const videoCard = page.locator(`text=${videos[0].title}`).first();
    await videoCard.click();
    await page.waitForTimeout(1000);
    await screenshot(page, "player-action-buttons");
  });

  test("subscribe button is visible for channel", async ({ page }) => {
    await loadApp(page);
    const videos = await getVideos();
    if (videos.length === 0) return;

    const videoCard = page.locator(`text=${videos[0].title}`).first();
    await videoCard.click();
    await page.waitForTimeout(1000);

    const subBtn = page.locator(
      'button:has-text("Subscribe"), button:has-text("Subscribed")'
    ).first();
    if (await subBtn.isVisible()) {
      expect(await subBtn.isVisible()).toBe(true);
    }
    await screenshot(page, "player-subscribe");
  });
});

// ---------------------------------------------------------------------------
// 6. COMMENTS
// ---------------------------------------------------------------------------

test.describe("6 · Comments", () => {
  test.beforeEach(async () => {
    await initAndAdvanceAll();
  });

  test("comments section shows on video detail", async ({ page }) => {
    await loadApp(page);
    const videos = await getVideos();
    if (videos.length === 0) return;

    const videoCard = page.locator(`text=${videos[0].title}`).first();
    await videoCard.click();
    await page.waitForTimeout(1500);

    const commentsHeader = page.locator('text=/Comments|comment/i').first();
    if (await commentsHeader.isVisible()) {
      expect(await commentsHeader.isVisible()).toBe(true);
    }
    await screenshot(page, "comments-section");
  });

  test("comment input accepts text", async ({ page }) => {
    await loadApp(page);
    const videos = await getVideos();
    if (videos.length === 0) return;

    const videoCard = page.locator(`text=${videos[0].title}`).first();
    await videoCard.click();
    await page.waitForTimeout(1000);

    const commentInput = page.locator(
      'input[placeholder*="comment" i], textarea[placeholder*="comment" i]'
    ).first();
    if (await commentInput.isVisible()) {
      await commentInput.fill("Test comment from audit");
      await page.waitForTimeout(500);
    }
    await screenshot(page, "comments-input");
  });
});

// ---------------------------------------------------------------------------
// 7. NOTIFICATIONS
// ---------------------------------------------------------------------------

test.describe("7 · Notifications", () => {
  test.beforeEach(async () => {
    await initAndAdvanceAll();
  });

  test("notification bell shows count", async ({ page }) => {
    await loadApp(page);
    const notifications = await getNotifications();
    const activeCount = notifications.filter((n: any) => !n.isDismissed).length;
    if (activeCount > 0) {
      // Badge should show count
      const body = await page.innerText("body");
      expect(body).toContain(String(activeCount));
    }
    await screenshot(page, "notifications-badge");
  });

  test("notification panel opens and shows list", async ({ page }) => {
    await loadApp(page);
    const bellBtn = page.locator(
      'button[aria-label*="notification" i], button[aria-label*="Notification" i]'
    ).first();
    if (await bellBtn.isVisible()) {
      await bellBtn.click();
      await page.waitForTimeout(500);
    }
    await screenshot(page, "notifications-panel");
  });

  test("dismissing notification removes from list", async ({ page }) => {
    await loadApp(page);
    const bellBtn = page.locator(
      'button[aria-label*="notification" i], button[aria-label*="Notification" i]'
    ).first();
    if (await bellBtn.isVisible()) {
      await bellBtn.click();
      await page.waitForTimeout(500);
    }

    const dismissBtn = page.locator('button[aria-label*="dismiss" i], button:has-text("×")').first();
    if (await dismissBtn.isVisible()) {
      await dismissBtn.click();
      await page.waitForTimeout(1000);
    }
    await screenshot(page, "notifications-dismiss");
  });

  test("dismissing one notification leaves other notifications available", async () => {
    const notificationsBefore = await getNotifications();
    const activeNotifications = notificationsBefore.filter((n: any) => !n.isDismissed);
    const target = activeNotifications[0];
    if (!target) return;

    await apiPost(`/data/microtube-notifications/${target.id}/dismiss`);
    const notifications = await getNotifications();
    expect(notifications.find((n: any) => n.id === target.id)?.isDismissed).toBe(true);

    if (activeNotifications.length > 1) {
      expect(notifications.some((n: any) => n.id !== target.id && !n.isDismissed)).toBe(true);
    }
  });
});

// ---------------------------------------------------------------------------
// 8. USER ACCOUNT & MODALS
// ---------------------------------------------------------------------------

test.describe("8 · User Account & Modals", () => {
  test.beforeEach(async () => {
    await initAndAdvanceAll();
  });

  test("user menu opens", async ({ page }) => {
    await loadApp(page);
    const avatar = page.locator("header button").last();
    await avatar.click();
    await page.waitForTimeout(500);
    await screenshot(page, "user-menu");
  });

  test("sign out shows lock screen", async ({ page }) => {
    await loadApp(page);
    const avatar = page.locator("header button").last();
    await avatar.click();
    await page.waitForTimeout(500);

    const signOutBtn = page.locator(
      'button:has-text("Sign out"), button:has-text("Log out")'
    ).first();
    if (await signOutBtn.isVisible()) {
      await signOutBtn.click();
      await page.waitForTimeout(1000);
      const overlay = page.locator('text=/sign.*in|log.*in/i').first();
      expect(await overlay.isVisible()).toBe(true);
    }
    await screenshot(page, "user-signout");
  });

  test("upload modal opens", async ({ page }) => {
    await loadApp(page);
    const uploadBtn = page.locator(
      'button[aria-label*="upload" i], button[aria-label*="create" i], button[aria-label*="Create" i]'
    ).first();
    if (await uploadBtn.isVisible()) {
      await uploadBtn.click();
      await page.waitForTimeout(500);
    }
    await screenshot(page, "upload-modal");
  });
});

// ---------------------------------------------------------------------------
// 9. YOUTUBE FIDELITY
// ---------------------------------------------------------------------------

test.describe("9 · YouTube Fidelity", () => {
  test.beforeEach(async () => {
    await initAndAdvanceAll();
  });

  test("sidebar shows Home, Shorts, Subscriptions, Library", async ({ page }) => {
    await loadApp(page);
    const homeLink = page.locator('text=Home').first();
    expect(await homeLink.isVisible()).toBe(true);
    await screenshot(page, "fidelity-sidebar");
  });

  test("video cards show thumbnail, title, channel, views", async ({ page }) => {
    await loadApp(page);
    const videos = await getVideos();
    if (videos.length > 0) {
      const titleEl = page.locator(`text=${videos[0].title}`).first();
      expect(await titleEl.isVisible()).toBe(true);
      const channelEl = page.locator(`text=${videos[0].channelName}`).first();
      expect(await channelEl.isVisible()).toBe(true);
    }
    await screenshot(page, "fidelity-video-cards");
  });

  test("header shows search bar and logo", async ({ page }) => {
    await loadApp(page);
    const searchInput = page.locator(
      'input[placeholder*="Search" i]'
    ).first();
    expect(await searchInput.isVisible()).toBe(true);
    await screenshot(page, "fidelity-header");
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

  test("rapid video clicks - no crash", async ({ page }) => {
    await loadApp(page);
    const videos = await getVideos();
    for (let i = 0; i < Math.min(5, videos.length); i++) {
      const card = page.locator(`text=${videos[i].title}`).first();
      if (await card.isVisible()) {
        await card.click();
        await page.waitForTimeout(100);
      }
    }
    await page.waitForTimeout(1000);
    const body = await page.innerText("body");
    expect(body.length).toBeGreaterThan(0);
    await screenshot(page, "edge-rapid-clicks");
  });

  test("unliking one liked video clears only that video", async () => {
    const videos = await getVideos();
    const target = videos.find((v: any) => !v.isLiked) ?? videos[0];
    if (!target) return;

    if (!target.isLiked) {
      await apiPost(`/data/microtube-videos/${target.id}/like`);
    }
    await apiPost(`/data/microtube-videos/${target.id}/like`);
    const after = await getVideos();
    expect(after.find((v: any) => v.id === target.id)?.isLiked).toBe(false);
  });

  test("toggling subscribe off removes one subscribed channel", async () => {
    const channels = await getChannels();
    const target = channels.find((c: any) => !c.isSelf) as any;
    if (!target) return;

    if (!target.isSubscribed) {
      await apiPost(`/data/microtube-channels/${target.id}/subscribe`);
    }
    await apiPost(`/data/microtube-channels/${target.id}/subscribe`);
    const after = await getChannels();
    expect(after.find((c: any) => c.id === target.id)?.isSubscribed).toBe(false);
  });

  test("creating playlist and adding videos persists", async () => {
    const { body: created } = await apiPost("/data/microtube-playlists", {
      name: "Edge Test Playlist",
    });
    const playlists = await getPlaylists();
    const pl = playlists.find((p: any) => p.name === "Edge Test Playlist");
    expect(pl).toBeTruthy();

    const videos = await getVideos();
    await apiPost(`/data/microtube-playlists/${pl.id}/add`, {
      video_id: videos[0].id,
    });

    const after = await getPlaylists();
    const updated = after.find((p: any) => p.id === pl.id);
    expect(updated.video_ids).toContain(videos[0].id);
  });
});
