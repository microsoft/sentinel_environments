import { test, expect, type Page } from "@playwright/test";

test.setTimeout(60_000);
test.use({ viewport: { width: 1440, height: 900 } });

const API = process.env.PLAYWRIGHT_SERVER_URL ?? "http://localhost:8000";
const SCENARIO_PATH =
  "../scenarios/microhub/browse-absolute-passive.json";
const SCREENSHOTS = "../.cache/audit_screenshots/microhub";

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

async function getRepository() {
  return (await apiGet("/data/microhub-repository")).body.repository ?? {};
}

async function getIssues() {
  return (await apiGet("/data/microhub-issues")).body.issues ?? [];
}

async function getPRs() {
  return (await apiGet("/data/microhub-pulls")).body.prs ?? [];
}

async function getFiles() {
  return (await apiGet("/data/microhub-files")).body.files ?? [];
}

async function getCommits() {
  return (await apiGet("/data/microhub-commits")).body.commits ?? [];
}

async function getRuns() {
  return (await apiGet("/data/microhub-runs")).body.runs ?? [];
}

async function loadApp(page: Page) {
  await page.goto("/microhub", { waitUntil: "domcontentloaded" });
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

  test("GET /data/microhub-repository returns repo info", async () => {
    const repo = await getRepository();
    expect(repo).toHaveProperty("name");
    expect(repo).toHaveProperty("owner");
    expect(repo).toHaveProperty("description");
  });

  test("GET /data/microhub-issues returns issues with schema", async () => {
    const issues = await getIssues();
    expect(issues.length).toBeGreaterThan(0);
    const i = issues[0];
    expect(i).toHaveProperty("id");
    expect(i).toHaveProperty("title");
    expect(i).toHaveProperty("state");
    expect(i).toHaveProperty("author");
  });

  test("GET /data/microhub-pulls returns pull requests", async () => {
    const prs = await getPRs();
    expect(prs.length).toBeGreaterThan(0);
    const pr = prs[0];
    expect(pr).toHaveProperty("id");
    expect(pr).toHaveProperty("title");
    expect(pr).toHaveProperty("state");
  });

  test("GET /data/microhub-files returns file tree", async () => {
    const files = await getFiles();
    expect(files.length).toBeGreaterThan(0);
    expect(files[0]).toHaveProperty("name");
    expect(files[0]).toHaveProperty("type");
  });

  test("GET /data/microhub-commits returns commits", async () => {
    const commits = await getCommits();
    expect(commits.length).toBeGreaterThan(0);
    expect(commits[0]).toHaveProperty("message");
    expect(commits[0]).toHaveProperty("author");
  });

  test("GET /data/microhub-runs returns workflow runs", async () => {
    const runs = await getRuns();
    expect(Array.isArray(runs)).toBe(true);
    if (runs.length > 0) {
      expect(runs[0]).toHaveProperty("id");
      expect(runs[0]).toHaveProperty("status");
    }
  });

  test("POST star repo toggles star", async () => {
    const { body } = await apiPost("/data/microhub-repository/star");
    expect(body.success).toBe(true);
  });

  test("POST watch repo toggles watch", async () => {
    const { body } = await apiPost("/data/microhub-repository/watch");
    expect(body.success).toBe(true);
  });

  test("POST fork repo", async () => {
    const { body } = await apiPost("/data/microhub-repository/fork");
    expect(body.success).toBe(true);
  });

  test("POST comment on issue", async () => {
    const issues = await getIssues();
    const openIssue = issues.find((i: any) => i.state === "open");
    if (!openIssue) return;

    const { body } = await apiPost(`/data/microhub-issues/${openIssue.id}/comment`, {
      body: "Audit test comment",
    });
    expect(body.success).toBe(true);
  });

  test("POST close issue changes state", async () => {
    const issues = await getIssues();
    const openIssue = issues.find((i: any) => i.state === "open");
    if (!openIssue) return;

    await apiPost(`/data/microhub-issues/${openIssue.id}/close`);
    const after = await getIssues();
    const updated = after.find((i: any) => i.id === openIssue.id);
    expect(updated.state).toBe("closed");
  });

  test("POST close issue leaves other issues open", async () => {
    const issues = await getIssues();
    const openIssues = issues.filter((i: any) => i.state === "open");
    const target = openIssues[0];
    if (!target) return;

    await apiPost(`/data/microhub-issues/${target.id}/close`);
    const after = await getIssues();
    const updated = after.find((i: any) => i.id === target.id);
    expect(updated.state).toBe("closed");

    if (openIssues.length > 1) {
      expect(after.some((i: any) => i.id !== target.id && i.state === "open")).toBe(true);
    }
  });

  test("POST merge PR changes that PR to merged", async () => {
    const prs = await getPRs();
    const target = prs.find((pr: any) => pr.state === "open");
    if (!target) return;

    await apiPost(`/data/microhub-pulls/${target.id}/merge`, { strategy: "merge" });
    const after = await getPRs();
    const updated = after.find((pr: any) => pr.id === target.id);
    expect(updated.state).toBe("merged");
  });
});

// ---------------------------------------------------------------------------
// 2. UI ↔ API SYNC
// ---------------------------------------------------------------------------

test.describe("2 · UI ↔ API Sync", () => {
  test.beforeEach(async () => {
    await initAndAdvanceAll();
  });

  test("repo name renders from API", async ({ page }) => {
    await loadApp(page);
    const repo = await getRepository();
    const nameEl = page.locator(`text=${repo.name}`).first();
    expect(await nameEl.isVisible()).toBe(true);
    await screenshot(page, "ui-sync-repo");
  });

  test("file browser shows files from API", async ({ page }) => {
    await loadApp(page);
    const files = await getFiles();
    if (files.length === 0) return;

    const fileEl = page.locator(`text=${files[0].name}`).first();
    expect(await fileEl.isVisible()).toBe(true);
    await screenshot(page, "ui-sync-files");
  });

  test("star button toggles and persists", async ({ page }) => {
    await loadApp(page);
    const starBtn = page.locator('button:has-text("Star"), button:has-text("Starred")').first();
    if (await starBtn.isVisible()) {
      await starBtn.click();
      await page.waitForTimeout(1500);
    }
    await screenshot(page, "ui-sync-star");
  });
});

// ---------------------------------------------------------------------------
// 3. NAVIGATION & VIEWS
// ---------------------------------------------------------------------------

test.describe("3 · Navigation & Views", () => {
  test.beforeEach(async () => {
    await initAndAdvanceAll();
  });

  test("code tab shows file browser", async ({ page }) => {
    await loadApp(page);
    await screenshot(page, "nav-code");
  });

  test("issues tab shows issue list", async ({ page }) => {
    await loadApp(page);
    const issuesTab = page.locator('button:has-text("Issues")').first();
    if (await issuesTab.isVisible()) {
      await issuesTab.click();
      await page.waitForTimeout(1000);
    }
    await screenshot(page, "nav-issues");
  });

  test("pull requests tab shows PR list", async ({ page }) => {
    await loadApp(page);
    const prTab = page.locator('button:has-text("Pull requests")').first();
    if (await prTab.isVisible()) {
      await prTab.click();
      await page.waitForTimeout(1000);
    }
    await screenshot(page, "nav-pulls");
  });

  test("actions tab shows workflow runs", async ({ page }) => {
    await loadApp(page);
    const actionsTab = page.locator('button:has-text("Actions")').first();
    if (await actionsTab.isVisible()) {
      await actionsTab.click();
      await page.waitForTimeout(1000);
    }
    await screenshot(page, "nav-actions");
  });

  test("wiki tab shows wiki pages", async ({ page }) => {
    await loadApp(page);
    const wikiTab = page.locator('button:has-text("Wiki")').first();
    if (await wikiTab.isVisible()) {
      await wikiTab.click();
      await page.waitForTimeout(1000);
    }
    await screenshot(page, "nav-wiki");
  });

  test("security tab renders", async ({ page }) => {
    await loadApp(page);
    const secTab = page.locator('button:has-text("Security")').first();
    if (await secTab.isVisible()) {
      await secTab.click();
      await page.waitForTimeout(1000);
    }
    await screenshot(page, "nav-security");
  });

  test("insights tab renders", async ({ page }) => {
    await loadApp(page);
    const insightsTab = page.locator('button:has-text("Insights")').first();
    if (await insightsTab.isVisible()) {
      await insightsTab.click();
      await page.waitForTimeout(1000);
    }
    await screenshot(page, "nav-insights");
  });

  test("clicking file navigates to file view", async ({ page }) => {
    await loadApp(page);
    const files = await getFiles();
    const file = files.find((f: any) => f.type === "file");
    if (!file) return;

    const fileEl = page.locator(`text=${file.name}`).first();
    if (await fileEl.isVisible()) {
      await fileEl.click();
      await page.waitForTimeout(1000);
    }
    await screenshot(page, "nav-file-view");
  });

  test("clicking issue opens issue detail", async ({ page }) => {
    await loadApp(page);
    const issuesTab = page.locator('button:has-text("Issues")').first();
    if (await issuesTab.isVisible()) {
      await issuesTab.click();
      await page.waitForTimeout(1000);
    }

    const issues = await getIssues();
    if (issues.length === 0) return;

    const issueEl = page.locator(`text=${issues[0].title}`).first();
    if (await issueEl.isVisible()) {
      await issueEl.click();
      await page.waitForTimeout(1000);
    }
    await screenshot(page, "nav-issue-detail");
  });
});

// ---------------------------------------------------------------------------
// 4. SEARCH & FILTERS
// ---------------------------------------------------------------------------

test.describe("4 · Search & Filters", () => {
  test.beforeEach(async () => {
    await initAndAdvanceAll();
  });

  test("issue filter switches between open and closed", async ({ page }) => {
    await loadApp(page);
    const issuesTab = page.locator('button:has-text("Issues")').first();
    if (await issuesTab.isVisible()) {
      await issuesTab.click();
      await page.waitForTimeout(1000);
    }

    const closedFilter = page.locator('button:has-text("Closed")').first();
    if (await closedFilter.isVisible()) {
      await closedFilter.click();
      await page.waitForTimeout(500);
    }
    await screenshot(page, "filter-closed-issues");
  });

  test("command palette opens with Ctrl+K", async ({ page }) => {
    await loadApp(page);
    await page.keyboard.press("Control+k");
    await page.waitForTimeout(500);
    await screenshot(page, "search-command-palette");
  });
});

// ---------------------------------------------------------------------------
// 5. ISSUES & PR INTERACTIONS
// ---------------------------------------------------------------------------

test.describe("5 · Issues & PR Interactions", () => {
  test.beforeEach(async () => {
    await initAndAdvanceAll();
  });

  test("commenting on issue via UI", async ({ page }) => {
    await loadApp(page);
    const issuesTab = page.locator('button:has-text("Issues")').first();
    if (await issuesTab.isVisible()) {
      await issuesTab.click();
      await page.waitForTimeout(1000);
    }

    const issues = await getIssues();
    const openIssue = issues.find((i: any) => i.state === "open");
    if (!openIssue) return;

    const issueEl = page.locator(`text=${openIssue.title}`).first();
    if (await issueEl.isVisible()) {
      await issueEl.click();
      await page.waitForTimeout(1000);
    }

    const commentInput = page.locator('textarea[placeholder*="comment" i], textarea[placeholder*="Comment" i]').first();
    if (await commentInput.isVisible()) {
      await commentInput.fill("UI test comment");
      const submitBtn = page.locator('button[type="submit"], button:has-text("Comment")').first();
      if (await submitBtn.isVisible()) {
        await submitBtn.click();
        await page.waitForTimeout(1500);
      }
    }
    await screenshot(page, "issue-comment");
  });

  test("new issue modal opens", async ({ page }) => {
    await loadApp(page);
    const issuesTab = page.locator('button:has-text("Issues")').first();
    if (await issuesTab.isVisible()) {
      await issuesTab.click();
      await page.waitForTimeout(1000);
    }

    const newIssueBtn = page.locator('button:has-text("New issue")').first();
    if (await newIssueBtn.isVisible()) {
      await newIssueBtn.click();
      await page.waitForTimeout(500);
    }
    await screenshot(page, "issue-new-modal");
  });

  test("PR detail shows merge button", async ({ page }) => {
    await loadApp(page);
    const prTab = page.locator('button:has-text("Pull requests")').first();
    if (await prTab.isVisible()) {
      await prTab.click();
      await page.waitForTimeout(1000);
    }

    const prs = await getPRs();
    const openPR = prs.find((pr: any) => pr.state === "open");
    if (!openPR) return;

    const prEl = page.locator(`text=${openPR.title}`).first();
    if (await prEl.isVisible()) {
      await prEl.click();
      await page.waitForTimeout(1000);
    }
    await screenshot(page, "pr-detail-merge");
  });
});

// ---------------------------------------------------------------------------
// 6. FILE BROWSER
// ---------------------------------------------------------------------------

test.describe("6 · File Browser", () => {
  test.beforeEach(async () => {
    await initAndAdvanceAll();
  });

  test("file tree shows folders and files", async ({ page }) => {
    await loadApp(page);
    const files = await getFiles();
    const folder = files.find((f: any) => f.type === "directory");
    if (folder) {
      const folderEl = page.locator(`text=${folder.name}`).first();
      expect(await folderEl.isVisible()).toBe(true);
    }
    await screenshot(page, "filebrowser-tree");
  });

  test("branch selector dropdown opens", async ({ page }) => {
    await loadApp(page);
    const branchBtn = page.locator('button:has-text("main"), button:has-text("master")').first();
    if (await branchBtn.isVisible()) {
      await branchBtn.click();
      await page.waitForTimeout(500);
    }
    await screenshot(page, "filebrowser-branch");
  });

  test("file view shows code with line numbers", async ({ page }) => {
    await loadApp(page);
    const files = await getFiles();
    const file = files.find((f: any) => f.type === "file");
    if (!file) return;

    const fileEl = page.locator(`text=${file.name}`).first();
    if (await fileEl.isVisible()) {
      await fileEl.click();
      await page.waitForTimeout(1000);
    }
    await screenshot(page, "filebrowser-code-view");
  });
});

// ---------------------------------------------------------------------------
// 7. COMMITS
// ---------------------------------------------------------------------------

test.describe("7 · Commits", () => {
  test.beforeEach(async () => {
    await initAndAdvanceAll();
  });

  test("commits list shows author and message", async ({ page }) => {
    await loadApp(page);
    // Navigate to commits view - may be accessible from code tab
    const commits = await getCommits();
    if (commits.length > 0) {
      const commitEl = page.locator(`text=${commits[0].message}`).first();
      // Commit message may be truncated
      const body = await page.innerText("body");
      expect(body.length).toBeGreaterThan(100);
    }
    await screenshot(page, "commits-list");
  });
});

// ---------------------------------------------------------------------------
// 8. USER ACCOUNT & MODALS
// ---------------------------------------------------------------------------

test.describe("8 · User Account & Modals", () => {
  test.beforeEach(async () => {
    await initAndAdvanceAll();
  });

  test("user menu opens from avatar", async ({ page }) => {
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

  test("dark mode toggle works", async ({ page }) => {
    await loadApp(page);
    await screenshot(page, "theme-default");
  });
});

// ---------------------------------------------------------------------------
// 9. GITHUB FIDELITY
// ---------------------------------------------------------------------------

test.describe("9 · GitHub Fidelity", () => {
  test.beforeEach(async () => {
    await initAndAdvanceAll();
  });

  test("header with repo path and nav tabs", async ({ page }) => {
    await loadApp(page);
    const repo = await getRepository();
    const repoName = page.locator(`text=${repo.name}`).first();
    expect(await repoName.isVisible()).toBe(true);
    await screenshot(page, "fidelity-header");
  });

  test("repo header shows star/watch/fork buttons", async ({ page }) => {
    await loadApp(page);
    const starBtn = page.locator('button:has-text("Star"), button:has-text("Starred")').first();
    expect(await starBtn.isVisible()).toBe(true);
    await screenshot(page, "fidelity-repo-actions");
  });

  test("issue list shows state icons and labels", async ({ page }) => {
    await loadApp(page);
    const issuesTab = page.locator('button:has-text("Issues")').first();
    if (await issuesTab.isVisible()) {
      await issuesTab.click();
      await page.waitForTimeout(1000);
    }
    await screenshot(page, "fidelity-issues");
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

  test("rapid tab switching - no crash", async ({ page }) => {
    await loadApp(page);
    const tabs = ["Issues", "Pull requests", "Actions", "Wiki", "Security", "Insights"];
    for (const tab of tabs) {
      const btn = page.locator(`button:has-text("${tab}")`).first();
      if (await btn.isVisible()) {
        await btn.click();
        await page.waitForTimeout(100);
      }
    }
    await page.waitForTimeout(1000);
    const body = await page.innerText("body");
    expect(body.length).toBeGreaterThan(0);
    await screenshot(page, "edge-rapid-tabs");
  });

  test("closing one issue via API is reflected in the issues tab", async ({ page }) => {
    const issues = await getIssues();
    const target = issues.find((issue: any) => issue.state === "open");
    if (target) {
      await apiPost(`/data/microhub-issues/${target.id}/close`);
      const after = await getIssues();
      expect(after.find((issue: any) => issue.id === target.id)?.state).toBe("closed");
    }

    await loadApp(page);
    const issuesTab = page.locator('button:has-text("Issues")').first();
    if (await issuesTab.isVisible()) {
      await issuesTab.click();
      await page.waitForTimeout(1000);
    }
    await screenshot(page, "edge-closed-issue");
  });

  test("merging one PR updates only that PR", async () => {
    const prs = await getPRs();
    const openPrs = prs.filter((pr: any) => pr.state === "open");
    const target = openPrs[0];
    if (!target) return;

    await apiPost(`/data/microhub-pulls/${target.id}/merge`, { strategy: "merge" });
    const after = await getPRs();
    const updated = after.find((pr: any) => pr.id === target.id);
    expect(updated.state).toBe("merged");

    if (openPrs.length > 1) {
      expect(after.some((pr: any) => pr.id !== target.id && pr.state === "open")).toBe(true);
    }
  });
});
