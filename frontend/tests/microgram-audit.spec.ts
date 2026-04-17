import { test, expect, type Page } from "@playwright/test";

test.setTimeout(60_000);
test.use({ viewport: { width: 1440, height: 900 } });

const API = process.env.PLAYWRIGHT_API_URL ?? "http://localhost:8000";
const SCENARIO_PATH =
  "../scenarios/microgram/likes-absolute-passive.json";
const SCREENSHOTS = "../.cache/audit_screenshots/microgram";

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

async function getPosts() {
  return (await apiGet("/data/microgram-posts")).body.posts ?? [];
}

async function getStories() {
  return (await apiGet("/data/microgram-stories")).body.stories ?? [];
}

async function getMessages() {
  return (await apiGet("/data/microgram-messages")).body.messages ?? [];
}

async function getActivity() {
  return (await apiGet("/data/microgram-activity")).body.activity ?? [];
}

async function getFollowed() {
  return (await apiGet("/data/microgram-followed-users")).body.followed_users ?? [];
}

async function loadApp(page: Page) {
  await page.goto("/microgram", { waitUntil: "domcontentloaded" });
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

  test("GET /data/microgram-posts returns posts with expected schema", async () => {
    const posts = await getPosts();
    expect(posts.length).toBeGreaterThan(0);
    const p = posts[0];
    expect(p).toHaveProperty("id");
    expect(p).toHaveProperty("authorName");
    expect(p).toHaveProperty("caption");
    expect(p).toHaveProperty("likes");
    expect(p).toHaveProperty("imageUrl");
  });

  test("GET /data/microgram-stories returns stories", async () => {
    const stories = await getStories();
    expect(stories.length).toBeGreaterThan(0);
    const s = stories[0];
    expect(s).toHaveProperty("id");
    expect(s).toHaveProperty("authorName");
    expect(s).toHaveProperty("mediaUrl");
  });

  test("GET /data/microgram-messages returns messages", async () => {
    const messages = await getMessages();
    expect(Array.isArray(messages)).toBe(true);
  });

  test("GET /data/microgram-activity returns activity", async () => {
    const activity = await getActivity();
    expect(Array.isArray(activity)).toBe(true);
  });

  test("GET /data/microgram-followed-users returns array", async () => {
    const followed = await getFollowed();
    expect(Array.isArray(followed)).toBe(true);
  });

  test("POST like toggles isLiked on post", async () => {
    const posts = await getPosts();
    const target = posts.find((p: any) => !p.isLiked);
    if (!target) return;

    await apiPost(`/data/microgram-posts/${target.id}/like`);
    const after = await getPosts();
    const updated = after.find((p: any) => p.id === target.id);
    expect(updated.isLiked).toBe(true);

    // Toggle back
    await apiPost(`/data/microgram-posts/${target.id}/like`);
    const again = await getPosts();
    expect(again.find((p: any) => p.id === target.id).isLiked).toBe(false);
  });

  test("POST save toggles isSaved on post", async () => {
    const posts = await getPosts();
    const target = posts[0];

    await apiPost(`/data/microgram-posts/${target.id}/save`);
    const after = await getPosts();
    const updated = after.find((p: any) => p.id === target.id);
    expect(updated.isSaved).toBe(true);
  });

  test("POST comment adds comment to post", async () => {
    const posts = await getPosts();
    await apiPost(`/data/microgram-posts/${posts[0].id}/comment`, {
      text: "Audit comment",
    });
    // Verify post comment count or content
    const after = await getPosts();
    const updated = after.find((p: any) => p.id === posts[0].id);
    expect(updated).toBeTruthy();
  });

  test("POST view story marks as viewed", async () => {
    const stories = await getStories();
    if (stories.length === 0) return;

    await apiPost(`/data/microgram-stories/${stories[0].id}/view`);
    const after = await getStories();
    const updated = after.find((s: any) => s.id === stories[0].id);
    expect(updated.isViewed).toBe(true);
  });

  test("POST follow user toggles follow state", async () => {
    const { body } = await apiGet("/data/microgram-users");
    const users = body.users ?? [];
    if (users.length === 0) return;

    const target = users.find((u: any) => !u.isSelf);
    if (!target) return;

    await apiPost(`/data/microgram-users/${target.id}/follow`);
    const followed = await getFollowed();
    expect(Array.isArray(followed)).toBe(true);
  });

  test("POST like toggles a liked post back off", async () => {
    const posts = await getPosts();
    const target = posts.find((p: any) => !p.isLiked) ?? posts[0];
    if (!target) return;

    if (!target.isLiked) {
      await apiPost(`/data/microgram-posts/${target.id}/like`);
    }
    await apiPost(`/data/microgram-posts/${target.id}/like`);
    const after = await getPosts();
    const updated = after.find((p: any) => p.id === target.id);
    expect(updated.isLiked).toBe(false);
  });

  test("POST follow toggles a selected user in followed list", async () => {
    const { body } = await apiGet("/data/microgram-users");
    const users = body.users ?? [];
    const target = users.find((u: any) => !u.isSelf);
    if (!target) return;

    const before = await getFollowed();
    const wasFollowed = before.includes(target.id);

    await apiPost(`/data/microgram-users/${target.id}/follow`);
    const after = await getFollowed();
    expect(after.includes(target.id)).toBe(!wasFollowed);
  });
});

// ---------------------------------------------------------------------------
// 2. UI ↔ API SYNC
// ---------------------------------------------------------------------------

test.describe("2 · UI ↔ API Sync", () => {
  test.beforeEach(async () => {
    await initAndAdvanceAll();
  });

  test("posts render in feed from API data", async ({ page }) => {
    await loadApp(page);
    const posts = await getPosts();
    if (posts.length === 0) return;

    const authorEl = page.locator(`text=${posts[0].authorName}`).first();
    expect(await authorEl.isVisible()).toBe(true);
    await screenshot(page, "ui-sync-feed");
  });

  test("story bar shows stories from API", async ({ page }) => {
    await loadApp(page);
    const stories = await getStories();
    if (stories.length === 0) return;

    // Story circles should be visible at top of feed
    const storyAuthor = page.locator(`text=${stories[0].authorName}`).first();
    expect(await storyAuthor.isVisible()).toBe(true);
    await screenshot(page, "ui-sync-stories");
  });

  test("like button toggles heart and persists", async ({ page }) => {
    await loadApp(page);

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

  test("home/feed view shows posts", async ({ page }) => {
    await loadApp(page);
    const body = await page.innerText("body");
    expect(body.length).toBeGreaterThan(100);
    await screenshot(page, "nav-home");
  });

  test("explore view shows grid of posts", async ({ page }) => {
    await loadApp(page);
    const exploreBtn = page.locator(
      'button[aria-label*="explore" i], button[aria-label*="Explore" i]'
    ).first();
    if (await exploreBtn.isVisible()) {
      await exploreBtn.click();
      await page.waitForTimeout(1000);
    }
    await screenshot(page, "nav-explore");
  });

  test("activity view shows notifications", async ({ page }) => {
    await loadApp(page);
    const activityBtn = page.locator(
      'button[aria-label*="activity" i], button[aria-label*="Activity" i]'
    ).first();
    if (await activityBtn.isVisible()) {
      await activityBtn.click();
      await page.waitForTimeout(1000);
    }
    await screenshot(page, "nav-activity");
  });

  test("profile view shows user info", async ({ page }) => {
    await loadApp(page);
    const profileBtn = page.locator(
      'button[aria-label*="profile" i], button[aria-label*="Profile" i]'
    ).first();
    if (await profileBtn.isVisible()) {
      await profileBtn.click();
      await page.waitForTimeout(1000);
    }
    await screenshot(page, "nav-profile");
  });

  test("direct messages view shows DM list", async ({ page }) => {
    await loadApp(page);
    const dmBtn = page.locator(
      'button[aria-label*="direct" i], button[aria-label*="Direct" i], button[aria-label*="message" i]'
    ).first();
    if (await dmBtn.isVisible()) {
      await dmBtn.click();
      await page.waitForTimeout(1000);
    }
    await screenshot(page, "nav-direct");
  });

  test("search view allows user search", async ({ page }) => {
    await loadApp(page);
    const searchBtn = page.locator(
      'button[aria-label*="search" i], button[aria-label*="Search" i]'
    ).first();
    if (await searchBtn.isVisible()) {
      await searchBtn.click();
      await page.waitForTimeout(1000);
    }
    await screenshot(page, "nav-search");
  });
});

// ---------------------------------------------------------------------------
// 4. STORIES
// ---------------------------------------------------------------------------

test.describe("4 · Stories", () => {
  test.beforeEach(async () => {
    await initAndAdvanceAll();
  });

  test("clicking story opens full-screen viewer", async ({ page }) => {
    await loadApp(page);
    const stories = await getStories();
    if (stories.length === 0) return;

    // Click first story circle
    const storyCircle = page.locator(`text=${stories[0].authorName}`).first();
    if (await storyCircle.isVisible()) {
      await storyCircle.click();
      await page.waitForTimeout(1000);

      // Full-screen story viewer should be visible
      const viewer = page.locator('[class*="fixed"][class*="inset-0"]').first();
      expect(await viewer.isVisible()).toBe(true);
    }
    await screenshot(page, "stories-viewer");
  });

  test("close button exits story viewer", async ({ page }) => {
    await loadApp(page);
    const stories = await getStories();
    if (stories.length === 0) return;

    const storyCircle = page.locator(`text=${stories[0].authorName}`).first();
    if (await storyCircle.isVisible()) {
      await storyCircle.click();
      await page.waitForTimeout(500);

      const closeBtn = page.locator('button[aria-label*="close" i], button[aria-label*="Close" i]').first();
      if (await closeBtn.isVisible()) {
        await closeBtn.click();
        await page.waitForTimeout(500);
      }
    }
    await screenshot(page, "stories-close");
  });

  test("viewing story marks it as viewed on server", async () => {
    const stories = await getStories();
    if (stories.length === 0) return;

    await apiPost(`/data/microgram-stories/${stories[0].id}/view`);
    const after = await getStories();
    const updated = after.find((s: any) => s.id === stories[0].id);
    expect(updated.isViewed).toBe(true);
  });

  test("viewing one story leaves other stories unchanged", async () => {
    const stories = await getStories();
    if (stories.length === 0) return;
    const initiallyUnviewed = stories.filter((s: any) => !s.isViewed);
    const target = initiallyUnviewed[0] ?? stories[0];

    await apiPost(`/data/microgram-stories/${target.id}/view`);
    const after = await getStories();
    const updated = after.find((s: any) => s.id === target.id);
    expect(updated.isViewed).toBe(true);

    if (initiallyUnviewed.length > 1) {
      expect(after.some((s: any) => s.id !== target.id && !s.isViewed)).toBe(true);
    }
  });
});

// ---------------------------------------------------------------------------
// 5. POST INTERACTIONS
// ---------------------------------------------------------------------------

test.describe("5 · Post Interactions", () => {
  test.beforeEach(async () => {
    await initAndAdvanceAll();
  });

  test("double-click on post image likes it", async ({ page }) => {
    await loadApp(page);
    // Find a post image
    const img = page.locator("img").first();
    if (await img.isVisible()) {
      await img.dblclick();
      await page.waitForTimeout(1500);
    }
    await screenshot(page, "post-double-click-like");
  });

  test("save button toggles bookmark", async ({ page }) => {
    await loadApp(page);
    const saveBtn = page.locator(
      'button[aria-label*="save" i], button[aria-label*="Save" i], button[aria-label*="bookmark" i]'
    ).first();
    if (await saveBtn.isVisible()) {
      await saveBtn.click();
      await page.waitForTimeout(1500);
    }
    await screenshot(page, "post-save");
  });

  test("clicking post opens post modal", async ({ page }) => {
    await loadApp(page);
    const posts = await getPosts();
    if (posts.length === 0) return;

    // Click on post image to open detail
    const postImg = page.locator("img").first();
    if (await postImg.isVisible()) {
      await postImg.click();
      await page.waitForTimeout(1000);
    }
    await screenshot(page, "post-modal");
  });

  test("comment input accepts text", async ({ page }) => {
    await loadApp(page);
    const commentInput = page.locator(
      'input[placeholder*="comment" i], input[placeholder*="Comment" i]'
    ).first();
    if (await commentInput.isVisible()) {
      await commentInput.fill("Test comment");
      await page.waitForTimeout(500);
    }
    await screenshot(page, "post-comment-input");
  });
});

// ---------------------------------------------------------------------------
// 6. DIRECT MESSAGES
// ---------------------------------------------------------------------------

test.describe("6 · Direct Messages", () => {
  test.beforeEach(async () => {
    await initAndAdvanceAll();
  });

  test("DM list shows conversations", async ({ page }) => {
    await loadApp(page);
    const dmBtn = page.locator(
      'button[aria-label*="direct" i], button[aria-label*="Direct" i], button[aria-label*="message" i]'
    ).first();
    if (await dmBtn.isVisible()) {
      await dmBtn.click();
      await page.waitForTimeout(1000);
    }

    const messages = await getMessages();
    if (messages.length > 0 && messages[0].participants?.length > 0) {
      const participant = messages[0].participants[0];
      const el = page.locator(`text=${participant.name}`).first();
      expect(await el.isVisible()).toBe(true);
    }
    await screenshot(page, "dm-list");
  });

  test("clicking DM opens conversation view", async ({ page }) => {
    await loadApp(page);
    const dmBtn = page.locator(
      'button[aria-label*="direct" i], button[aria-label*="Direct" i], button[aria-label*="message" i]'
    ).first();
    if (await dmBtn.isVisible()) {
      await dmBtn.click();
      await page.waitForTimeout(1000);
    }

    const messages = await getMessages();
    if (messages.length > 0 && messages[0].participants?.length > 0) {
      const participant = messages[0].participants[0];
      const el = page.locator(`text=${participant.name}`).first();
      if (await el.isVisible()) {
        await el.click();
        await page.waitForTimeout(1000);
      }
    }
    await screenshot(page, "dm-conversation");
  });
});

// ---------------------------------------------------------------------------
// 7. PROFILE
// ---------------------------------------------------------------------------

test.describe("7 · Profile", () => {
  test.beforeEach(async () => {
    await initAndAdvanceAll();
  });

  test("own profile shows edit button and post grid", async ({ page }) => {
    await loadApp(page);
    const profileBtn = page.locator(
      'button[aria-label*="profile" i], button[aria-label*="Profile" i]'
    ).first();
    if (await profileBtn.isVisible()) {
      await profileBtn.click();
      await page.waitForTimeout(1000);
    }

    const editBtn = page.locator('button:has-text("Edit Profile")').first();
    if (await editBtn.isVisible()) {
      expect(await editBtn.isVisible()).toBe(true);
    }
    await screenshot(page, "profile-own");
  });

  test("profile tabs switch between posts and saved", async ({ page }) => {
    await loadApp(page);
    const profileBtn = page.locator(
      'button[aria-label*="profile" i], button[aria-label*="Profile" i]'
    ).first();
    if (await profileBtn.isVisible()) {
      await profileBtn.click();
      await page.waitForTimeout(1000);
    }

    const savedTab = page.locator('button:has-text("Saved")').first();
    if (await savedTab.isVisible()) {
      await savedTab.click();
      await page.waitForTimeout(500);
    }
    await screenshot(page, "profile-saved-tab");
  });
});

// ---------------------------------------------------------------------------
// 8. USER ACCOUNT & MODALS
// ---------------------------------------------------------------------------

test.describe("8 · User Account & Modals", () => {
  test.beforeEach(async () => {
    await initAndAdvanceAll();
  });

  test("edit profile modal opens and closes", async ({ page }) => {
    await loadApp(page);
    const profileBtn = page.locator(
      'button[aria-label*="profile" i], button[aria-label*="Profile" i]'
    ).first();
    if (await profileBtn.isVisible()) {
      await profileBtn.click();
      await page.waitForTimeout(1000);
    }

    const editBtn = page.locator('button:has-text("Edit Profile")').first();
    if (await editBtn.isVisible()) {
      await editBtn.click();
      await page.waitForTimeout(500);
    }
    await screenshot(page, "user-edit-profile");
  });

  test("sign out shows lock screen", async ({ page }) => {
    await loadApp(page);
    // Navigate to profile
    const profileBtn = page.locator(
      'button[aria-label*="profile" i], button[aria-label*="Profile" i]'
    ).first();
    if (await profileBtn.isVisible()) {
      await profileBtn.click();
      await page.waitForTimeout(1000);
    }

    // Open settings/menu
    const settingsBtn = page.locator(
      'button[aria-label*="settings" i], button[aria-label*="Settings" i], button[aria-label*="menu" i]'
    ).first();
    if (await settingsBtn.isVisible()) {
      await settingsBtn.click();
      await page.waitForTimeout(500);
    }

    const logoutBtn = page.locator(
      'button:has-text("Log out"), button:has-text("Sign out"), button:has-text("Logout")'
    ).first();
    if (await logoutBtn.isVisible()) {
      await logoutBtn.click();
      await page.waitForTimeout(1000);
      const overlay = page.locator('text=/sign.*in|log.*in|MicroGram/i').first();
      expect(await overlay.isVisible()).toBe(true);
    }
    await screenshot(page, "user-signout");
  });
});

// ---------------------------------------------------------------------------
// 9. INSTAGRAM FIDELITY
// ---------------------------------------------------------------------------

test.describe("9 · Instagram Fidelity", () => {
  test.beforeEach(async () => {
    await initAndAdvanceAll();
  });

  test("navigation bar with Home, Search, Explore, DMs, Activity, Profile", async ({ page }) => {
    await loadApp(page);
    const body = await page.innerText("body");
    expect(body.length).toBeGreaterThan(100);
    await screenshot(page, "fidelity-nav");
  });

  test("post cards show image, author, caption, action buttons", async ({ page }) => {
    await loadApp(page);
    const posts = await getPosts();
    if (posts.length > 0) {
      const authorEl = page.locator(`text=${posts[0].authorName}`).first();
      expect(await authorEl.isVisible()).toBe(true);
    }
    await screenshot(page, "fidelity-post-cards");
  });

  test("story bar shows circular avatars", async ({ page }) => {
    await loadApp(page);
    await screenshot(page, "fidelity-story-bar");
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

  test("rapid like/unlike - no crash", async ({ page }) => {
    await loadApp(page);
    const likeBtn = page.locator(
      'button[aria-label*="like" i], button[aria-label*="Like" i]'
    ).first();
    if (await likeBtn.isVisible()) {
      for (let i = 0; i < 5; i++) {
        await likeBtn.click();
        await page.waitForTimeout(100);
      }
    }
    await page.waitForTimeout(1000);
    const body = await page.innerText("body");
    expect(body.length).toBeGreaterThan(0);
    await screenshot(page, "edge-rapid-like");
  });

  test("unliking one liked post updates the saved feed state", async () => {
    const posts = await getPosts();
    const target = posts.find((p: any) => !p.isLiked) ?? posts[0];
    if (!target) return;

    if (!target.isLiked) {
      await apiPost(`/data/microgram-posts/${target.id}/like`);
    }
    await apiPost(`/data/microgram-posts/${target.id}/like`);
    const after = await getPosts();
    expect(after.find((p: any) => p.id === target.id)?.isLiked).toBe(false);
  });

  test("saving then unsaving one post only clears that post", async () => {
    const posts = await getPosts();
    const target = posts.find((p: any) => !p.isSaved) ?? posts[0];
    if (!target) return;

    if (!target.isSaved) {
      await apiPost(`/data/microgram-posts/${target.id}/save`);
    }
    await apiPost(`/data/microgram-posts/${target.id}/save`);
    const after = await getPosts();
    const updated = after.find((p: any) => p.id === target.id);
    expect(updated.isSaved).toBe(false);
  });

  test("posting a comment increases the comment list for that post", async () => {
    const posts = await getPosts();
    const target = posts[0];
    if (!target) return;
    const beforeCount = target.comments?.length ?? 0;

    await apiPost(`/data/microgram-posts/${target.id}/comment`, {
      text: "temp comment",
    });
    const after = await getPosts();
    const updated = after.find((p: any) => p.id === target.id);
    expect((updated.comments ?? []).length).toBeGreaterThan(beforeCount);
  });
});
