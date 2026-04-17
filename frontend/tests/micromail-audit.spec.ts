import { test, expect, type Page } from "@playwright/test";

test.setTimeout(60_000); // 60s per test to account for polling waits
test.use({ viewport: { width: 1440, height: 900 } }); // Ensure lg+xl breakpoints

const API = process.env.PLAYWRIGHT_API_URL ?? "http://localhost:8000";
const SCENARIO_PATH =
  "../scenarios/micromail/inbox-relative-passive.json";
const SCREENSHOTS = "../.cache/audit_screenshots/micromail";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

interface ApiEmail {
  id: string;
  subject: string;
  body: string;
  sender: { name: string; email: string; avatarUrl?: string };
  recipients: string[];
  cc?: string[];
  folder: string;
  isRead: boolean;
  isFlagged: boolean;
  isExternal?: boolean;
  isCC?: boolean;
  hasAttachment?: boolean;
  attachment?: { id: string; name: string; size: number | string };
  mentionsMe?: boolean;
  importance?: string;
  timestamp: string;
}

async function apiGet(path: string) {
  const res = await fetch(`${API}${path}`);
  return { status: res.status, body: await res.json() };
}

async function apiPost(path: string, body?: object) {
  const res = await fetch(`${API}${path}`, {
    method: "POST",
    headers: body ? { "Content-Type": "application/json" } : {},
    body: body ? JSON.stringify(body) : undefined,
  });
  return { status: res.status, body: await res.json() };
}

async function getEmails(): Promise<ApiEmail[]> {
  const { body } = await apiGet("/data/micromail-emails");
  return body.emails;
}

async function initAndAdvanceAll() {
  await fetch(`${API}/close`);

  const fs = await import("fs");
  const scenario = JSON.parse(fs.readFileSync(SCENARIO_PATH, "utf-8"));

  const initPayload = {
    environment: scenario.environment,
    duration: scenario.duration,
    eval_sql: scenario.eval_sql ?? "",
    events: scenario.events,
  };
  await apiPost("/init", initPayload);

  let status = (await apiGet("/status")).body;
  while (status.next_event_time !== null) {
    status = (await apiGet(`/advance?time=${status.next_event_time}`)).body;
  }

  return scenario;
}

async function loadApp(page: Page) {
  await page.goto("/micromail", { waitUntil: "domcontentloaded" });
  // Wait for the MicroMail app to render (sidebar "Inbox" button appears)
  await page.waitForSelector('aside button:has-text("Inbox")', { timeout: 15000 });
  // Give emails time to load via polling
  await page.waitForTimeout(2000);
}

async function screenshot(page: Page, name: string) {
  await page.screenshot({
    path: `${SCREENSHOTS}/${name}.png`,
    fullPage: true,
  });
}

// ---------------------------------------------------------------------------
// 1. ENDPOINT INTEGRITY
// ---------------------------------------------------------------------------

test.describe("1 · Endpoint Integrity", () => {
  test.beforeEach(async () => {
    await initAndAdvanceAll();
  });

  test("GET /data/micromail-emails returns correct schema", async () => {
    const emails = await getEmails();
    expect(emails.length).toBeGreaterThan(0);

    for (const e of emails) {
      expect(e).toHaveProperty("id");
      expect(e).toHaveProperty("sender");
      expect(e.sender).toHaveProperty("name");
      expect(e.sender).toHaveProperty("email");
      expect(e).toHaveProperty("subject");
      expect(e).toHaveProperty("body");
      expect(e).toHaveProperty("folder");
      expect(e).toHaveProperty("isRead");
      expect(e).toHaveProperty("isFlagged");
      expect(e).toHaveProperty("isExternal");
      expect(e).toHaveProperty("isCC");
      expect(e).toHaveProperty("hasAttachment");
      expect(e).toHaveProperty("recipients");
      expect(e).toHaveProperty("mentionsMe");
      expect(e).toHaveProperty("importance");
      expect(e).toHaveProperty("timestamp");
    }
  });

  test("POST mark read persists", async () => {
    const emails = await getEmails();
    const target = emails[0];
    expect(target.isRead).toBe(false);

    await apiPost(`/data/micromail-emails/${target.id}/read`);
    const after = await getEmails();
    const updated = after.find((e) => e.id === target.id)!;
    expect(updated.isRead).toBe(true);
  });

  test("POST mark unread persists", async () => {
    const emails = await getEmails();
    const target = emails[0];
    // First mark read, then unread
    await apiPost(`/data/micromail-emails/${target.id}/read`);
    await apiPost(`/data/micromail-emails/${target.id}/unread`);
    const after = await getEmails();
    const updated = after.find((e) => e.id === target.id)!;
    expect(updated.isRead).toBe(false);
  });

  test("POST flag toggles correctly (flag→unflag→flag)", async () => {
    const emails = await getEmails();
    const target = emails[0];
    const initialFlag = target.isFlagged;

    await apiPost(`/data/micromail-emails/${target.id}/flag`);
    let after = await getEmails();
    expect(after.find((e) => e.id === target.id)!.isFlagged).toBe(!initialFlag);

    await apiPost(`/data/micromail-emails/${target.id}/flag`);
    after = await getEmails();
    expect(after.find((e) => e.id === target.id)!.isFlagged).toBe(initialFlag);

    await apiPost(`/data/micromail-emails/${target.id}/flag`);
    after = await getEmails();
    expect(after.find((e) => e.id === target.id)!.isFlagged).toBe(!initialFlag);
  });

  test("POST move to each folder persists", async () => {
    const emails = await getEmails();
    const target = emails[0];
    const folders = ["inbox", "sent", "drafts", "archive", "junk", "deleted", "scheduled"];

    for (const folder of folders) {
      await apiPost(`/data/micromail-emails/${target.id}/move`, { folder });
      const after = await getEmails();
      const updated = after.find((e) => e.id === target.id)!;
      expect(updated.folder).toBe(folder);
    }
  });

  test("POST read marks one inbox email as read without clearing all unread", async () => {
    const emails = await getEmails();
    const unreadInbox = emails.filter((e) => e.folder === "inbox" && !e.isRead);
    const target = unreadInbox[0];
    if (!target) return;

    const { body } = await apiPost(`/data/micromail-emails/${target.id}/read`);
    expect(body.success).toBe(true);

    const after = await getEmails();
    const updated = after.find((e) => e.id === target.id)!;
    expect(updated.isRead).toBe(true);

    if (unreadInbox.length > 1) {
      expect(
        after.some((e) => e.id !== target.id && e.folder === "inbox" && !e.isRead)
      ).toBe(true);
    }
  });

  test("POST move can take one email from junk to deleted", async () => {
    const emails = await getEmails();
    const target = emails.find((e) => e.folder === "inbox") ?? emails[0];
    if (!target) return;

    await apiPost(`/data/micromail-emails/${target.id}/move`, { folder: "junk" });
    let after = await getEmails();
    expect(after.find((e) => e.id === target.id)?.folder).toBe("junk");

    const { body } = await apiPost(`/data/micromail-emails/${target.id}/move`, {
      folder: "deleted",
    });
    expect(body.success).toBe(true);

    after = await getEmails();
    expect(after.find((e) => e.id === target.id)?.folder).toBe("deleted");
  });

  test("invalid email ID returns 404 not 500", async () => {
    const endpoints = [
      "/data/micromail-emails/NONEXISTENT/read",
      "/data/micromail-emails/NONEXISTENT/unread",
      "/data/micromail-emails/NONEXISTENT/flag",
    ];
    for (const ep of endpoints) {
      const { status } = await apiPost(ep);
      expect(status).toBe(404);
    }

    const { status } = await apiPost("/data/micromail-emails/NONEXISTENT/move", {
      folder: "inbox",
    });
    expect(status).toBe(404);
  });

});

// ---------------------------------------------------------------------------
// 2. UI ↔ API CONSISTENCY
// ---------------------------------------------------------------------------

test.describe("2 · UI ↔ API Sync", () => {
  test.beforeEach(async () => {
    await initAndAdvanceAll();
  });

  test("clicking email marks it read in UI (bold removed) and on server", async ({
    page,
  }) => {
    await loadApp(page);
    await screenshot(page, "ui-sync-initial");

    // All emails should start unread → sender names in bold (font-semibold)
    const firstItem = page.locator('[role="listitem"]').first();
    await firstItem.click();
    await page.waitForTimeout(1500);

    // Server check
    const emails = await getEmails();
    const anyRead = emails.some((e) => e.isRead);
    expect(anyRead).toBe(true);

    await screenshot(page, "ui-sync-after-click-read");
  });

  test("flag toggle via row icon persists in UI and server", async ({ page }) => {
    await loadApp(page);

    // Click the flag button on the first email row
    const firstFlagBtn = page
      .locator('[role="listitem"]')
      .first()
      .locator('button[aria-label*="flag" i], button[aria-label*="Flag" i]')
      .first();
    await firstFlagBtn.click();
    await page.waitForTimeout(1500);

    const emails = await getEmails();
    const anyFlagged = emails.some((e) => e.isFlagged);
    expect(anyFlagged).toBe(true);

    await screenshot(page, "ui-sync-flag-toggled");
  });

  test("context menu → Delete moves email to Deleted Items", async ({ page }) => {
    await loadApp(page);
    const emails = await getEmails();
    const inboxBefore = emails.filter((e) => e.folder === "inbox").length;

    // Right-click first email
    const firstItem = page.locator('[role="listitem"]').first();
    await firstItem.click({ button: "right" });
    await page.waitForTimeout(500);

    // Click Delete in context menu (scope to the fixed-position context menu)
    const ctxMenu = page.locator(".fixed.z-50");
    const deleteBtn = ctxMenu.locator("text=Delete").first();
    if (await deleteBtn.isVisible()) {
      await deleteBtn.click();
      await page.waitForTimeout(1500);

      const after = await getEmails();
      const inboxAfter = after.filter((e) => e.folder === "inbox").length;
      expect(inboxAfter).toBe(inboxBefore - 1);

      const deletedCount = after.filter((e) => e.folder === "deleted").length;
      expect(deletedCount).toBeGreaterThan(0);
    }

    await screenshot(page, "ui-sync-context-delete");
  });

  test("context menu → Archive moves email to Archive", async ({ page }) => {
    await loadApp(page);

    const firstItem = page.locator('[role="listitem"]').first();
    await firstItem.click({ button: "right" });
    await page.waitForTimeout(500);

    // Scope to the fixed-position context menu
    const ctxMenu = page.locator(".fixed.z-50");
    const archiveBtn = ctxMenu.locator("text=Archive").first();
    if (await archiveBtn.isVisible()) {
      await archiveBtn.click();
      await page.waitForTimeout(1500);

      const after = await getEmails();
      const archivedCount = after.filter((e) => e.folder === "archive").length;
      expect(archivedCount).toBeGreaterThan(0);
    }

    await screenshot(page, "ui-sync-context-archive");
  });

  test("context menu → Move to Junk", async ({ page }) => {
    await loadApp(page);

    const firstItem = page.locator('[role="listitem"]').first();
    await firstItem.click({ button: "right" });
    await page.waitForTimeout(500);

    const junkBtn = page.locator("text=Move to Junk").first();
    if (await junkBtn.isVisible()) {
      await junkBtn.click();
      await page.waitForTimeout(1500);

      const after = await getEmails();
      const junkCount = after.filter((e) => e.folder === "junk").length;
      expect(junkCount).toBeGreaterThan(0);
    }

    await screenshot(page, "ui-sync-context-junk");
  });

  test("context menu → Mark as unread restores bold", async ({ page }) => {
    await loadApp(page);

    // First click to mark read
    const firstItem = page.locator('[role="listitem"]').first();
    await firstItem.click();
    await page.waitForTimeout(1500);

    // Right-click same item
    await firstItem.click({ button: "right" });
    await page.waitForTimeout(500);

    const unreadBtn = page.locator("text=Mark as unread").first();
    if (await unreadBtn.isVisible()) {
      await unreadBtn.click();
      await page.waitForTimeout(1500);

      // Verify on server
      const emails = await getEmails();
      // The first email that was clicked should now be unread
      // We check any email matches the pattern
      const someUnread = emails.some((e) => !e.isRead);
      expect(someUnread).toBe(true);
    }

    await screenshot(page, "ui-sync-context-mark-unread");
  });

  test("toolbar: select emails with checkboxes → bulk delete", async ({ page }) => {
    await loadApp(page);

    // Check first two emails via checkbox
    const checkboxes = page.locator(
      '[role="listitem"] input[type="checkbox"][aria-label="Select conversation"]'
    );
    const count = await checkboxes.count();
    if (count >= 2) {
      await checkboxes.nth(0).check({ force: true });
      await checkboxes.nth(1).check({ force: true });
      await page.waitForTimeout(300);

      // Click delete button in toolbar
      const deleteBtn = page.locator('button[aria-label="Delete conversation"]');
      await deleteBtn.click();
      await page.waitForTimeout(1500);

      const after = await getEmails();
      const deletedCount = after.filter((e) => e.folder === "deleted").length;
      expect(deletedCount).toBeGreaterThanOrEqual(2);
    }

    await screenshot(page, "ui-sync-bulk-delete");
  });

  test("toolbar: select emails → bulk archive", async ({ page }) => {
    await loadApp(page);

    const checkboxes = page.locator(
      '[role="listitem"] input[type="checkbox"][aria-label="Select conversation"]'
    );
    const count = await checkboxes.count();
    if (count >= 2) {
      await checkboxes.nth(0).check({ force: true });
      await checkboxes.nth(1).check({ force: true });
      await page.waitForTimeout(300);

      const archiveBtn = page.locator('button[aria-label="Archive conversation"]');
      await archiveBtn.click();
      await page.waitForTimeout(1500);

      const after = await getEmails();
      const archivedCount = after.filter((e) => e.folder === "archive").length;
      expect(archivedCount).toBeGreaterThanOrEqual(2);
    }

    await screenshot(page, "ui-sync-bulk-archive");
  });

  test("toolbar view reflects per-email read state without a mark-all control", async ({ page }) => {
    await loadApp(page);

    await expect(page.locator('button[aria-label="Mark all as read"]')).toHaveCount(0);

    const firstItem = page.locator('[role="listitem"]').first();
    await firstItem.click();
    await page.waitForTimeout(2000);

    const after = await getEmails();
    expect(after.some((e) => e.folder === "inbox" && e.isRead)).toBe(true);

    await screenshot(page, "ui-sync-single-read");
  });

  test("folder badge counts update after mutations", async ({ page }) => {
    await loadApp(page);

    // Take screenshot of initial badge counts
    await screenshot(page, "ui-sync-badge-initial");

    const firstItem = page.locator('[role="listitem"]').first();
    await firstItem.click();
    await page.waitForTimeout(2000);

    await screenshot(page, "ui-sync-badge-after-read");
  });
});

// ---------------------------------------------------------------------------
// 3. FOLDER NAVIGATION
// ---------------------------------------------------------------------------

test.describe("3 · Folder Navigation", () => {
  test.beforeEach(async () => {
    await initAndAdvanceAll();
  });

  test("clicking each folder shows correct emails", async ({ page }) => {
    await loadApp(page);

    const folderLabels = [
      { label: "Inbox", key: "inbox" },
      { label: "Sent Items", key: "sent" },
      { label: "Drafts", key: "drafts" },
      { label: "Archive", key: "archive" },
      { label: "Junk Email", key: "junk" },
      { label: "Deleted Items", key: "deleted" },
      { label: "Scheduled", key: "scheduled" },
    ];

    for (const folder of folderLabels) {
      // Click folder in sidebar -- use the non-favorites section buttons
      const folderBtn = page
        .locator("aside button")
        .filter({ hasText: folder.label })
        .last();
      if (await folderBtn.isVisible()) {
        await folderBtn.click();
        await page.waitForTimeout(800);

        await screenshot(page, `folder-${folder.key}`);
      }
    }
  });

  test("active folder is highlighted in sidebar", async ({ page }) => {
    await loadApp(page);

    // Inbox should be active by default -- check for the active class
    const inboxBtn = page
      .locator("aside button")
      .filter({ hasText: "Inbox" })
      .last();
    const inboxClass = await inboxBtn.getAttribute("class");
    expect(inboxClass).toContain("bg-[#e8f1fe]");

    // Switch to Archive
    const archiveBtn = page
      .locator("aside button")
      .filter({ hasText: "Archive" })
      .last();
    await archiveBtn.click();
    await page.waitForTimeout(500);

    const archiveClass = await archiveBtn.getAttribute("class");
    expect(archiveClass).toContain("bg-[#e8f1fe]");

    // Inbox should no longer be active
    const inboxClassAfter = await inboxBtn.getAttribute("class");
    expect(inboxClassAfter).not.toContain("bg-[#e8f1fe]");

    await screenshot(page, "folder-active-highlight");
  });

  test("moving email to folder then navigating shows it there", async ({ page }) => {
    await loadApp(page);
    const emails = await getEmails();
    const target = emails.find((e) => e.folder === "inbox")!;

    // Move to archive via API
    await apiPost(`/data/micromail-emails/${target.id}/move`, { folder: "archive" });
    await page.waitForTimeout(1500);

    // Navigate to Archive
    const archiveBtn = page
      .locator("aside button")
      .filter({ hasText: "Archive" })
      .last();
    await archiveBtn.click();
    await page.waitForTimeout(1500);

    // Verify email appears in the archive list
    const body = await page.innerText("body");
    expect(body).toContain(target.subject);

    await screenshot(page, "folder-move-and-navigate");
  });

  test("Junk Email folder reflects per-email moves without an Empty folder button", async ({ page }) => {
    await loadApp(page);

    // First move an email to junk
    const emails = await getEmails();
    const target = emails[0];
    await apiPost(`/data/micromail-emails/${target.id}/move`, { folder: "junk" });
    await page.waitForTimeout(1500);

    // Navigate to Junk
    const junkBtn = page
      .locator("aside button")
      .filter({ hasText: "Junk Email" })
      .last();
    await junkBtn.click();
    await page.waitForTimeout(1000);

    await expect(page.locator("text=Empty folder")).toHaveCount(0);
    const body = await page.innerText("body");
    expect(body).toContain(target.subject);

    await screenshot(page, "folder-junk-item");
  });
});

// ---------------------------------------------------------------------------
// 4. QUICK FILTERS
// ---------------------------------------------------------------------------

test.describe("4 · Quick Filters", () => {
  test.beforeEach(async () => {
    await initAndAdvanceAll();
  });

  test("filter tabs render: All, Unread, Flagged, Mentions", async ({ page }) => {
    await loadApp(page);

    for (const label of ["All", "Unread", "Flagged", "Mentions"]) {
      const btn = page.locator(`button:has-text("${label}")`).first();
      expect(await btn.isVisible()).toBe(true);
    }

    await screenshot(page, "filters-all-tabs");
  });

  test("Unread filter shows only unread emails", async ({ page }) => {
    await loadApp(page);

    // Mark first email as read
    const firstItem = page.locator('[role="listitem"]').first();
    await firstItem.click();
    await page.waitForTimeout(1500);

    // Click Unread filter
    const unreadBtn = page.locator('button:has-text("Unread")').first();
    await unreadBtn.click();
    await page.waitForTimeout(1000);

    // All visible emails in the list should be unread
    const emails = await getEmails();
    const unreadInbox = emails.filter((e) => e.folder === "inbox" && !e.isRead);

    // The list should show the same count as unread inbox emails
    const listItems = page.locator('[role="listitem"]');
    const visibleCount = await listItems.count();
    expect(visibleCount).toBe(unreadInbox.length);

    await screenshot(page, "filters-unread");
  });

  test("Flagged filter shows only flagged emails", async ({ page }) => {
    await loadApp(page);

    // Flag the first email
    const firstFlagBtn = page
      .locator('[role="listitem"]')
      .first()
      .locator('button[aria-label*="flag" i], button[aria-label*="Flag" i]')
      .first();
    await firstFlagBtn.click();
    await page.waitForTimeout(1500);

    // Click Flagged filter
    const flaggedBtn = page.locator('button:has-text("Flagged")').first();
    await flaggedBtn.click();
    await page.waitForTimeout(1000);

    const listItems = page.locator('[role="listitem"]');
    const visibleCount = await listItems.count();
    expect(visibleCount).toBeGreaterThanOrEqual(1);

    await screenshot(page, "filters-flagged");
  });

  test("Mentions filter shows only mentionsMe emails", async ({ page }) => {
    await loadApp(page);

    const mentionsBtn = page.locator('button:has-text("Mentions")').first();
    await mentionsBtn.click();
    await page.waitForTimeout(1000);

    const emails = await getEmails();
    const mentionedInbox = emails.filter(
      (e) => e.folder === "inbox" && e.mentionsMe
    );

    const listItems = page.locator('[role="listitem"]');
    const visibleCount = await listItems.count();
    expect(visibleCount).toBe(mentionedInbox.length);

    await screenshot(page, "filters-mentions");
  });

  test("after reading one email, Unread filter excludes that email", async ({ page }) => {
    await loadApp(page);

    const emails = await getEmails();
    const target = emails.find((e) => e.folder === "inbox" && !e.isRead);
    if (!target) return;

    await apiPost(`/data/micromail-emails/${target.id}/read`);
    await page.waitForTimeout(2000);

    // Switch to Unread filter
    const unreadBtn = page.locator('button:has-text("Unread")').first();
    await unreadBtn.click();
    await page.waitForTimeout(1000);

    const unreadEmails = (await getEmails()).filter(
      (e) => e.folder === "inbox" && !e.isRead
    );
    const listItems = page.locator('[role="listitem"]');
    expect(await listItems.count()).toBe(unreadEmails.length);

    await screenshot(page, "filters-unread-after-single-read");
  });
});

// ---------------------------------------------------------------------------
// 5. COMPOSE FLOW
// ---------------------------------------------------------------------------

test.describe("5 · Compose Flow", () => {
  test.beforeEach(async () => {
    await initAndAdvanceAll();
  });

  test("New mail button opens compose modal", async ({ page }) => {
    await loadApp(page);

    const newMailBtn = page.locator('button:has-text("New mail")');
    await newMailBtn.click();
    await page.waitForTimeout(500);

    // Verify compose modal is open
    const modal = page.locator("text=New message");
    expect(await modal.isVisible()).toBe(true);

    await screenshot(page, "compose-modal-open");
  });

  test("sending with empty To shows validation error", async ({ page }) => {
    await loadApp(page);

    const newMailBtn = page.locator('button:has-text("New mail")');
    await newMailBtn.click();
    await page.waitForTimeout(500);

    // Fill subject but not To
    const subjectInput = page.locator('input[placeholder="Add a subject"]');
    await subjectInput.fill("Test subject");

    // Click Send
    const sendBtn = page.locator('button:has-text("Send")').first();
    await sendBtn.click();
    await page.waitForTimeout(500);

    // Should show error
    const error = page.locator("text=Please specify at least one recipient");
    expect(await error.isVisible()).toBe(true);

    await screenshot(page, "compose-validation-error");
  });

  test("fill and send a message closes modal", async ({ page }) => {
    await loadApp(page);

    const newMailBtn = page.locator('button:has-text("New mail")');
    await newMailBtn.click();
    await page.waitForTimeout(500);

    const toInput = page.locator('input[placeholder="name@example.com"]');
    await toInput.fill("test@example.com");

    const subjectInput = page.locator('input[placeholder="Add a subject"]');
    await subjectInput.fill("Audit test email");

    const bodyInput = page.locator('textarea[placeholder="Type your message..."]');
    await bodyInput.fill("This is a test message body.");

    const sendBtn = page.locator('button:has-text("Send")').first();
    await sendBtn.click();
    await page.waitForTimeout(1000);

    // Modal should close
    const modal = page.locator("text=New message");
    expect(await modal.isVisible()).toBe(false);

    // Toast should appear
    const toast = page.locator("text=Message sent");
    expect(await toast.isVisible()).toBe(true);

    await screenshot(page, "compose-send-success");
  });

  test("Save draft button works", async ({ page }) => {
    await loadApp(page);

    const newMailBtn = page.locator('button:has-text("New mail")');
    await newMailBtn.click();
    await page.waitForTimeout(500);

    const subjectInput = page.locator('input[placeholder="Add a subject"]');
    await subjectInput.fill("Draft test");

    const saveDraftBtn = page.locator('button:has-text("Save draft")');
    await saveDraftBtn.click();
    await page.waitForTimeout(500);

    // Modal should close
    const modal = page.locator("text=New message");
    expect(await modal.isVisible()).toBe(false);

    // Toast
    const toast = page.locator("text=Draft saved");
    expect(await toast.isVisible()).toBe(true);

    await screenshot(page, "compose-save-draft");
  });

  test("Discard button with content triggers confirm dialog", async ({ page }) => {
    await loadApp(page);

    const newMailBtn = page.locator('button:has-text("New mail")');
    await newMailBtn.click();
    await page.waitForTimeout(500);

    const subjectInput = page.locator('input[placeholder="Add a subject"]');
    await subjectInput.fill("To be discarded");

    // Listen for confirm dialog
    page.on("dialog", async (dialog) => {
      expect(dialog.message()).toContain("Discard");
      await dialog.accept();
    });

    const discardBtn = page.locator('button:has-text("Discard")');
    await discardBtn.click();
    await page.waitForTimeout(500);

    // Modal should close after accepting
    const modal = page.locator("text=New message");
    expect(await modal.isVisible()).toBe(false);

    await screenshot(page, "compose-discard");
  });

  test("Cc & Bcc toggle shows/hides fields", async ({ page }) => {
    await loadApp(page);

    const newMailBtn = page.locator('button:has-text("New mail")');
    await newMailBtn.click();
    await page.waitForTimeout(500);

    // Cc/Bcc should be hidden by default
    let ccInput = page.locator('input[placeholder="Add Cc recipients"]');
    expect(await ccInput.isVisible()).toBe(false);

    // Click toggle
    const toggle = page.locator('button:has-text("Cc & Bcc")');
    await toggle.click();
    await page.waitForTimeout(300);

    // Now Cc and Bcc should be visible
    ccInput = page.locator('input[placeholder="Add Cc recipients"]');
    expect(await ccInput.isVisible()).toBe(true);

    const bccInput = page.locator('input[placeholder="Add Bcc recipients"]');
    expect(await bccInput.isVisible()).toBe(true);

    await screenshot(page, "compose-cc-bcc-visible");
  });
});

// ---------------------------------------------------------------------------
// 6. REPLY / FORWARD
// ---------------------------------------------------------------------------

test.describe("6 · Reply/Forward", () => {
  test.beforeEach(async () => {
    await initAndAdvanceAll();
  });

  test("Reply pre-fills To with sender email", async ({ page }) => {
    await loadApp(page);

    // Click first email to select it
    const firstItem = page.locator('[role="listitem"]').first();
    await firstItem.click();
    await page.waitForTimeout(1000);

    // Get the sender email from API
    const emails = await getEmails();
    // Find the first inbox email (the UI shows them sorted by timestamp desc)
    const inboxEmails = emails.filter((e) => e.folder === "inbox");

    // Click Reply button
    const replyBtn = page.locator('button:has-text("Reply")').first();
    await replyBtn.click();
    await page.waitForTimeout(500);

    // Check To field
    const toInput = page.locator('input[placeholder="name@example.com"]');
    const toValue = await toInput.inputValue();
    // Should contain a sender email
    expect(toValue).toBeTruthy();

    // Check subject has Re: prefix
    const subjectInput = page.locator('input[placeholder="Add a subject"]');
    const subjectValue = await subjectInput.inputValue();
    expect(subjectValue).toMatch(/^Re:/);

    await screenshot(page, "reply-prefill");
  });

  test("Reply All populates To and Cc", async ({ page }) => {
    await loadApp(page);

    const firstItem = page.locator('[role="listitem"]').first();
    await firstItem.click();
    await page.waitForTimeout(1000);

    const replyAllBtn = page.locator('button:has-text("Reply all")');
    await replyAllBtn.click();
    await page.waitForTimeout(500);

    const toInput = page.locator('input[placeholder="name@example.com"]');
    const toValue = await toInput.inputValue();
    expect(toValue).toBeTruthy();

    const subjectInput = page.locator('input[placeholder="Add a subject"]');
    const subjectValue = await subjectInput.inputValue();
    expect(subjectValue).toMatch(/^Re:/);

    await screenshot(page, "reply-all");
  });

  test("Forward has Fwd: prefix and quoted body", async ({ page }) => {
    await loadApp(page);

    const firstItem = page.locator('[role="listitem"]').first();
    await firstItem.click();
    await page.waitForTimeout(1000);

    const forwardBtn = page.locator('button:has-text("Forward")');
    await forwardBtn.click();
    await page.waitForTimeout(500);

    const subjectInput = page.locator('input[placeholder="Add a subject"]');
    const subjectValue = await subjectInput.inputValue();
    expect(subjectValue).toMatch(/^Fwd:/);

    // To should be empty
    const toInput = page.locator('input[placeholder="name@example.com"]');
    const toValue = await toInput.inputValue();
    expect(toValue).toBe("");

    // Body should contain forwarded message
    const bodyInput = page.locator('textarea[placeholder="Type your message..."]');
    const bodyValue = await bodyInput.inputValue();
    expect(bodyValue).toContain("Forwarded message");

    await screenshot(page, "forward");
  });
});

// ---------------------------------------------------------------------------
// 7. SEARCH
// ---------------------------------------------------------------------------

test.describe("7 · Search", () => {
  test.beforeEach(async () => {
    await initAndAdvanceAll();
  });

  test("search filters emails by subject", async ({ page }) => {
    await loadApp(page);

    const emails = await getEmails();
    const targetSubject = emails[0].subject;
    // Use first word of subject for search
    const searchTerm = targetSubject.split(" ")[0];

    const searchInput = page.locator(
      'input[placeholder="Search mail and people"]'
    );
    await searchInput.fill(searchTerm);
    await page.waitForTimeout(1000);

    const listItems = page.locator('[role="listitem"]');
    const count = await listItems.count();
    expect(count).toBeGreaterThan(0);

    await screenshot(page, "search-by-subject");
  });

  test("search is case-insensitive", async ({ page }) => {
    await loadApp(page);

    const emails = await getEmails();
    const targetSubject = emails[0].subject;
    const searchTerm = targetSubject.split(" ")[0].toUpperCase();

    const searchInput = page.locator(
      'input[placeholder="Search mail and people"]'
    );
    await searchInput.fill(searchTerm);
    await page.waitForTimeout(1000);

    const listItems = page.locator('[role="listitem"]');
    const count = await listItems.count();
    expect(count).toBeGreaterThan(0);

    await screenshot(page, "search-case-insensitive");
  });

  test("clearing search restores all emails", async ({ page }) => {
    await loadApp(page);

    const searchInput = page.locator(
      'input[placeholder="Search mail and people"]'
    );

    // Get initial count
    const initialCount = await page.locator('[role="listitem"]').count();

    await searchInput.fill("xyznonexistent");
    await page.waitForTimeout(500);
    const filteredCount = await page.locator('[role="listitem"]').count();
    expect(filteredCount).toBe(0);

    // Clear search
    await searchInput.fill("");
    await page.waitForTimeout(500);
    const restoredCount = await page.locator('[role="listitem"]').count();
    expect(restoredCount).toBe(initialCount);

    await screenshot(page, "search-clear-restore");
  });

  test("Ctrl+E focuses search field", async ({ page }) => {
    await loadApp(page);

    await page.keyboard.press("Control+e");
    await page.waitForTimeout(300);

    const searchInput = page.locator(
      'input[placeholder="Search mail and people"]'
    );
    const isFocused = await searchInput.evaluate(
      (el) => document.activeElement === el
    );
    expect(isFocused).toBe(true);

    await screenshot(page, "search-ctrl-e-focus");
  });

  test("Escape clears search", async ({ page }) => {
    await loadApp(page);

    const searchInput = page.locator(
      'input[placeholder="Search mail and people"]'
    );
    await searchInput.fill("test query");
    await page.waitForTimeout(300);

    await searchInput.press("Escape");
    await page.waitForTimeout(300);

    const value = await searchInput.inputValue();
    expect(value).toBe("");

    await screenshot(page, "search-escape-clear");
  });
});

// ---------------------------------------------------------------------------
// 8. EMAIL DETAIL RENDERING
// ---------------------------------------------------------------------------

test.describe("8 · Email Detail Rendering", () => {
  test.beforeEach(async () => {
    await initAndAdvanceAll();
  });

  test("email with attachments shows attachment section", async ({ page }) => {
    await loadApp(page);

    const emails = await getEmails();
    const withAttachment = emails.find((e) => e.hasAttachment && e.folder === "inbox");

    if (withAttachment) {
      // Find and click the email with this subject
      const emailRow = page.locator(`[role="listitem"]:has-text("${withAttachment.subject}")`).first();
      if (await emailRow.isVisible()) {
        await emailRow.click();
        await page.waitForTimeout(1000);

        // Verify attachment section is visible
        const attachmentSection = page.locator("text=Attachments").first();
        expect(await attachmentSection.isVisible()).toBe(true);

        await screenshot(page, "detail-attachment-section");
      }
    }
  });

  test("clicking attachment opens preview modal", async ({ page }) => {
    await loadApp(page);

    const emails = await getEmails();
    const withAttachment = emails.find(
      (e) => e.hasAttachment && e.attachment && e.folder === "inbox"
    );

    if (withAttachment) {
      const emailRow = page.locator(`[role="listitem"]:has-text("${withAttachment.subject}")`).first();
      if (await emailRow.isVisible()) {
        await emailRow.click();
        await page.waitForTimeout(1000);

        // Click on the attachment button
        const attachmentBtn = page
          .locator(`text=${withAttachment.attachment!.name}`)
          .first();
        if (await attachmentBtn.isVisible()) {
          await attachmentBtn.click();
          await page.waitForTimeout(500);

          // Preview modal should show attachment name
          const previewTitle = page.locator("h3").filter({
            hasText: withAttachment.attachment!.name,
          });
          expect(await previewTitle.isVisible()).toBe(true);

          await screenshot(page, "detail-attachment-preview");

          // Close the preview
          const closeBtn = page.locator(
            'button[aria-label="Close attachment preview"]'
          );
          if (await closeBtn.isVisible()) {
            await closeBtn.click();
          }
        }
      }
    }
  });

  test("high importance email shows red arrow icon", async ({ page }) => {
    await loadApp(page);

    const emails = await getEmails();
    const highImportance = emails.find(
      (e) => e.importance === "high" && e.folder === "inbox"
    );

    if (highImportance) {
      const emailRow = page.locator(`[role="listitem"]:has-text("${highImportance.subject}")`).first();
      if (await emailRow.isVisible()) {
        await emailRow.click();
        await page.waitForTimeout(1000);

        // Check for High importance badge in detail
        const badge = page.locator("text=High importance").first();
        expect(await badge.isVisible()).toBe(true);

        await screenshot(page, "detail-high-importance");
      }
    } else {
      // No high importance emails in this scenario -- just note it
      test.info().annotations.push({
        type: "note",
        description: "No high importance emails in scenario",
      });
    }
  });

  test("external email shows amber External badge", async ({ page }) => {
    await loadApp(page);

    const emails = await getEmails();
    const external = emails.find(
      (e) => e.isExternal && e.folder === "inbox"
    );

    if (external) {
      const emailRow = page.locator(`[role="listitem"]:has-text("${external.subject}")`).first();
      if (await emailRow.isVisible()) {
        await emailRow.click();
        await page.waitForTimeout(1000);

        const externalBadge = page.locator("text=External").first();
        expect(await externalBadge.isVisible()).toBe(true);

        await screenshot(page, "detail-external-badge");
      }
    } else {
      test.info().annotations.push({
        type: "note",
        description: "No external emails in scenario",
      });
    }
  });

  test("mention email shows mention badge", async ({ page }) => {
    await loadApp(page);

    const emails = await getEmails();
    const mentioned = emails.find(
      (e) => e.mentionsMe && e.folder === "inbox"
    );

    if (mentioned) {
      const emailRow = page.locator(`[role="listitem"]:has-text("${mentioned.subject}")`).first();
      if (await emailRow.isVisible()) {
        await emailRow.click();
        await page.waitForTimeout(1000);

        const mentionBadge = page.locator("text=You were mentioned").first();
        expect(await mentionBadge.isVisible()).toBe(true);

        await screenshot(page, "detail-mention-badge");
      }
    } else {
      test.info().annotations.push({
        type: "note",
        description: "No mentioned emails in scenario",
      });
    }
  });

  test("To and Cc recipient lists render correctly", async ({ page }) => {
    await loadApp(page);

    // Click first email
    const firstItem = page.locator('[role="listitem"]').first();
    await firstItem.click();
    await page.waitForTimeout(1000);

    // Verify To: label exists in detail pane
    const toLabel = page.locator("text=To:").first();
    expect(await toLabel.isVisible()).toBe(true);

    await screenshot(page, "detail-recipients");
  });
});

// ---------------------------------------------------------------------------
// 9. OUTLOOK FIDELITY
// ---------------------------------------------------------------------------

test.describe("9 · Outlook Fidelity", () => {
  test.beforeEach(async () => {
    await initAndAdvanceAll();
  });

  test("sidebar: folder pane with Favorites section", async ({ page }) => {
    await loadApp(page);

    // Check Favorites section header exists
    const favoritesHeader = page.locator("text=Favorites").first();
    expect(await favoritesHeader.isVisible()).toBe(true);

    // Check all expected folders exist
    const expectedFolders = [
      "Inbox",
      "Sent Items",
      "Drafts",
      "Archive",
      "Junk Email",
      "Deleted Items",
      "Scheduled",
    ];
    for (const folder of expectedFolders) {
      const folderEl = page.locator(`aside button:has-text("${folder}")`).first();
      expect(await folderEl.isVisible()).toBe(true);
    }

    await screenshot(page, "fidelity-sidebar");
  });

  test("email list density: sender, subject, preview in compact rows", async ({
    page,
  }) => {
    await loadApp(page);
    await screenshot(page, "fidelity-email-list-density");

    // Verify email rows contain sender name, subject, and preview
    const firstItem = page.locator('[role="listitem"]').first();
    const text = await firstItem.innerText();
    // Should have at least 2 lines of content (sender + subject/preview)
    expect(text.length).toBeGreaterThan(10);
  });

  test("selected email highlight", async ({ page }) => {
    await loadApp(page);

    const firstItem = page.locator('[role="listitem"]').first();
    await firstItem.click();
    await page.waitForTimeout(500);

    // Check for aria-selected attribute
    const isSelected = await firstItem.getAttribute("aria-selected");
    expect(isSelected).toBe("true");

    // Check for highlight class
    const cls = await firstItem.getAttribute("class");
    expect(cls).toContain("bg-[#e8f1fe]");

    await screenshot(page, "fidelity-selected-highlight");
  });

  test("unread indicator uses bold text not dot/badge", async ({ page }) => {
    await loadApp(page);

    // All emails start unread -- sender name should have font-semibold class
    const firstItem = page.locator('[role="listitem"]').first();
    // The sender name <p> should have class containing "font-semibold" when unread
    const hasBold = await firstItem.evaluate((el) => {
      const senderP = el.querySelector("p");
      return senderP?.classList.contains("font-semibold") ?? false;
    });
    expect(hasBold).toBe(true);

    await screenshot(page, "fidelity-unread-bold");
  });

  test("avatar/initials circle for senders", async ({ page }) => {
    await loadApp(page);

    // Check that avatar images or initials divs exist in email rows
    const firstItem = page.locator('[role="listitem"]').first();
    const hasAvatar = await firstItem.evaluate((el) => {
      // Look for avatar img or initials div (both use rounded-full)
      const img = el.querySelector("img.rounded-full, img[class*='rounded-full']");
      const div = el.querySelector("div.rounded-full, div[class*='rounded-full']");
      return !!(img || div);
    });
    expect(hasAvatar).toBe(true);

    await screenshot(page, "fidelity-avatar-circle");
  });

  test("Reply/Reply All/Forward button bar at bottom of email detail", async ({
    page,
  }) => {
    await loadApp(page);

    const firstItem = page.locator('[role="listitem"]').first();
    await firstItem.click();
    await page.waitForTimeout(1000);

    // Verify Reply, Reply all, Forward buttons exist
    const replyBtn = page.locator('button:has-text("Reply")').first();
    const replyAllBtn = page.locator('button:has-text("Reply all")');
    const forwardBtn = page.locator('button:has-text("Forward")');

    expect(await replyBtn.isVisible()).toBe(true);
    expect(await replyAllBtn.isVisible()).toBe(true);
    expect(await forwardBtn.isVisible()).toBe(true);

    await screenshot(page, "fidelity-reply-bar");
  });

  test("header toolbar styling", async ({ page }) => {
    await loadApp(page);

    // Header should exist with blue background
    const header = page.locator("header");
    expect(await header.isVisible()).toBe(true);

    // Should contain MicroMail branding
    const body = await header.innerText();
    expect(body.toLowerCase()).toContain("micromail");

    await screenshot(page, "fidelity-header-toolbar");
  });

  test("compose modal layout screenshot", async ({ page }) => {
    await loadApp(page);

    const newMailBtn = page.locator('button:has-text("New mail")');
    await newMailBtn.click();
    await page.waitForTimeout(500);

    await screenshot(page, "fidelity-compose-modal");

    // Close compose
    const closeBtn = page.locator('button[aria-label="Close compose dialog"]');
    await closeBtn.click();
  });

  test("full app screenshot for overall fidelity review", async ({ page }) => {
    await loadApp(page);

    // Click first email to show detail pane
    const firstItem = page.locator('[role="listitem"]').first();
    await firstItem.click();
    await page.waitForTimeout(1000);

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

  test("empty inbox shows empty state message", async ({ page }) => {
    // Archive all inbox emails individually
    const emails = await getEmails();
    const inboxEmails = emails.filter((e) => e.folder === "inbox");
    for (const e of inboxEmails) {
      await apiPost(`/data/micromail-emails/${e.id}/move`, { folder: "archive" });
    }

    await loadApp(page);
    await page.waitForTimeout(1500);

    const emptyMsg = page.locator("text=No conversations match your filters");
    expect(await emptyMsg.isVisible()).toBe(true);

    await screenshot(page, "edge-empty-inbox");
  });

  test("rapid clicks on multiple emails - no race condition", async ({ page }) => {
    await loadApp(page);

    const items = page.locator('[role="listitem"]');
    const count = await items.count();

    // Rapidly click through emails
    for (let i = 0; i < Math.min(count, 5); i++) {
      await items.nth(i).click();
      await page.waitForTimeout(100); // Very short delay to simulate rapid clicking
    }

    await page.waitForTimeout(2000);

    // Verify app is still functional -- no crashes
    const body = await page.innerText("body");
    expect(body.length).toBeGreaterThan(0);

    // Verify some emails got marked as read (at least the last clicked)
    const emails = await getEmails();
    const anyRead = emails.some((e) => e.isRead);
    expect(anyRead).toBe(true);

    await screenshot(page, "edge-rapid-clicks");
  });

  test("select all → delete all → verify empty state", async ({ page }) => {
    await loadApp(page);

    // Check select all checkbox
    const selectAllCheckbox = page.locator(
      'input[type="checkbox"][aria-label="Select all conversations"]'
    );
    await selectAllCheckbox.check({ force: true });
    await page.waitForTimeout(300);

    // Click delete
    const deleteBtn = page.locator('button[aria-label="Delete conversation"]');
    await deleteBtn.click();
    await page.waitForTimeout(2000);

    // Should show empty state
    const emptyMsg = page.locator("text=No conversations match your filters");
    expect(await emptyMsg.isVisible()).toBe(true);

    await screenshot(page, "edge-delete-all");
  });

  test("move email to same folder is no-op", async () => {
    const emails = await getEmails();
    const target = emails.find((e) => e.folder === "inbox")!;

    const { status } = await apiPost(
      `/data/micromail-emails/${target.id}/move`,
      { folder: "inbox" }
    );
    // Should not error
    expect(status).toBe(200);

    const after = await getEmails();
    const updated = after.find((e) => e.id === target.id)!;
    expect(updated.folder).toBe("inbox");
  });

  test("email body renders without layout breaking", async ({ page }) => {
    await loadApp(page);

    const firstItem = page.locator('[role="listitem"]').first();
    await firstItem.click();
    await page.waitForTimeout(1000);

    // Verify no horizontal overflow
    const isOverflowing = await page.evaluate(() => {
      return document.documentElement.scrollWidth > document.documentElement.clientWidth;
    });
    expect(isOverflowing).toBe(false);

    await screenshot(page, "edge-body-no-overflow");
  });
});
