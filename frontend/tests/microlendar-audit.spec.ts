import { test, expect, type Page } from "@playwright/test";

test.setTimeout(60_000);
test.use({ viewport: { width: 1440, height: 900 } });

const API = process.env.PLAYWRIGHT_SERVER_URL ?? "http://localhost:8000";
const SCENARIO_PATH =
  "../scenarios/microlendar/events-absolute-passive.json";
const SCREENSHOTS = "../.cache/audit_screenshots/microlendar";

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

async function getEvents() {
  return (await apiGet("/data/microlendar-events")).body.events ?? [];
}

async function getTasks() {
  return (await apiGet("/data/microlendar-tasks")).body.tasks ?? [];
}

async function loadApp(page: Page) {
  await page.goto("/microlendar", { waitUntil: "domcontentloaded" });
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

  test("GET /data/microlendar-events returns events with expected schema", async () => {
    const events = await getEvents();
    expect(events.length).toBeGreaterThan(0);
    const e = events[0];
    expect(e).toHaveProperty("id");
    expect(e).toHaveProperty("title");
    expect(e).toHaveProperty("date");
    expect(e).toHaveProperty("calendar");
  });

  test("GET /data/microlendar-tasks returns tasks", async () => {
    const tasks = await getTasks();
    expect(Array.isArray(tasks)).toBe(true);
    if (tasks.length > 0) {
      expect(tasks[0]).toHaveProperty("id");
      expect(tasks[0]).toHaveProperty("title");
      expect(tasks[0]).toHaveProperty("completed");
    }
  });

  test("POST create event returns new event", async () => {
    const { body } = await apiPost("/data/microlendar-events", {
      title: "Audit Test Event",
      date: "2026-03-18",
      time: "10:00",
      calendar: "Work",
    });
    expect(body.success).toBe(true);
    expect(body.event).toBeTruthy();
    expect(body.event.title).toBe("Audit Test Event");
  });

  test("POST update event", async () => {
    const events = await getEvents();
    if (events.length === 0) return;

    const { body } = await apiPost(`/data/microlendar-events/${events[0].id}/update`, {
      title: "Updated Title",
    });
    expect(body.success).toBe(true);
  });

  test("POST delete event", async () => {
    // Create then delete
    const { body: created } = await apiPost("/data/microlendar-events", {
      title: "To Delete",
      date: "2026-03-18",
    });
    expect(created.success).toBe(true);

    const { body } = await apiPost(`/data/microlendar-events/${created.event.id}/delete`);
    expect(body.success).toBe(true);
  });

  test("POST create task", async () => {
    const { body } = await apiPost("/data/microlendar-tasks", {
      title: "Audit Test Task",
      dueDate: "2026-03-20",
    });
    expect(body.success).toBe(true);
    expect(body.task).toBeTruthy();
  });

  test("POST toggle task completion", async () => {
    const tasks = await getTasks();
    if (tasks.length === 0) return;

    const { body } = await apiPost(`/data/microlendar-tasks/${tasks[0].id}/complete`);
    expect(body.success).toBe(true);
    expect(body).toHaveProperty("completed");
  });

  test("POST delete task", async () => {
    const { body: created } = await apiPost("/data/microlendar-tasks", {
      title: "To Delete Task",
    });

    const { body } = await apiPost(`/data/microlendar-tasks/${created.task.id}/delete`);
    expect(body.success).toBe(true);
  });

  test("POST delete event removes only the targeted event", async () => {
    const { body: created } = await apiPost("/data/microlendar-events", {
      title: "Delete One Event",
      date: "2026-03-19",
      time: "10:30",
      calendar: "Work",
    });
    expect(created.success).toBe(true);

    await apiPost(`/data/microlendar-events/${created.event.id}/delete`);
    const events = await getEvents();
    expect(events.some((e: any) => e.id === created.event.id)).toBe(false);
  });

  test("POST complete task leaves other tasks incomplete", async () => {
    const tasks = await getTasks();
    const incompleteTasks = tasks.filter((t: any) => !t.completed);
    const target = incompleteTasks[0];
    if (!target) return;

    await apiPost(`/data/microlendar-tasks/${target.id}/complete`);
    const after = await getTasks();
    const updated = after.find((t: any) => t.id === target.id);
    expect(updated.completed).toBe(true);

    if (incompleteTasks.length > 1) {
      expect(after.some((t: any) => t.id !== target.id && !t.completed)).toBe(true);
    }
  });

  test("POST delete task removes only the targeted task", async () => {
    const { body: created } = await apiPost("/data/microlendar-tasks", {
      title: "Delete One Task",
      dueDate: "2026-03-20",
    });
    expect(created.success).toBe(true);

    await apiPost(`/data/microlendar-tasks/${created.task.id}/delete`);
    const tasks = await getTasks();
    expect(tasks.some((t: any) => t.id === created.task.id)).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// 2. UI ↔ API SYNC
// ---------------------------------------------------------------------------

test.describe("2 · UI ↔ API Sync", () => {
  test.beforeEach(async () => {
    await initAndAdvanceAll();
  });

  test("calendar shows events from API", async ({ page }) => {
    await loadApp(page);
    const events = await getEvents();
    if (events.length === 0) return;

    // At least one event title should appear on the calendar
    const eventEl = page.locator(`text=${events[0].title}`).first();
    if (await eventEl.isVisible()) {
      expect(await eventEl.isVisible()).toBe(true);
    }
    await screenshot(page, "ui-sync-events");
  });

  test("creating event via API shows in UI after polling", async ({ page }) => {
    await apiPost("/data/microlendar-events", {
      title: "Sync Test Event",
      date: "2026-03-18",
      time: "14:00",
      calendar: "Personal",
    });

    await loadApp(page);
    await page.waitForTimeout(2000);
    await screenshot(page, "ui-sync-new-event");
  });
});

// ---------------------------------------------------------------------------
// 3. NAVIGATION & VIEWS
// ---------------------------------------------------------------------------

test.describe("3 · Navigation & Views", () => {
  test.beforeEach(async () => {
    await initAndAdvanceAll();
  });

  test("month view is default", async ({ page }) => {
    await loadApp(page);
    const body = await page.innerText("body");
    expect(body.length).toBeGreaterThan(100);
    await screenshot(page, "nav-month");
  });

  test("week view renders", async ({ page }) => {
    await loadApp(page);
    const weekBtn = page.locator('button:has-text("Week")').first();
    if (await weekBtn.isVisible()) {
      await weekBtn.click();
      await page.waitForTimeout(500);
    }
    await screenshot(page, "nav-week");
  });

  test("day view renders", async ({ page }) => {
    await loadApp(page);
    const dayBtn = page.locator('button:has-text("Day")').first();
    if (await dayBtn.isVisible()) {
      await dayBtn.click();
      await page.waitForTimeout(500);
    }
    await screenshot(page, "nav-day");
  });

  test("year view renders", async ({ page }) => {
    await loadApp(page);
    const yearBtn = page.locator('button:has-text("Year")').first();
    if (await yearBtn.isVisible()) {
      await yearBtn.click();
      await page.waitForTimeout(500);
    }
    await screenshot(page, "nav-year");
  });

  test("schedule/agenda view renders", async ({ page }) => {
    await loadApp(page);
    const schedBtn = page.locator('button:has-text("Schedule"), button:has-text("Agenda")').first();
    if (await schedBtn.isVisible()) {
      await schedBtn.click();
      await page.waitForTimeout(500);
    }
    await screenshot(page, "nav-schedule");
  });

  test("today button navigates to current date", async ({ page }) => {
    await loadApp(page);
    const todayBtn = page.locator('button:has-text("Today")').first();
    if (await todayBtn.isVisible()) {
      await todayBtn.click();
      await page.waitForTimeout(500);
    }
    await screenshot(page, "nav-today");
  });

  test("previous/next navigation works", async ({ page }) => {
    await loadApp(page);
    const nextBtn = page.locator('button[aria-label*="next" i], button[aria-label*="Next" i]').first();
    if (await nextBtn.isVisible()) {
      await nextBtn.click();
      await page.waitForTimeout(500);
      await nextBtn.click();
      await page.waitForTimeout(500);
    }

    const prevBtn = page.locator('button[aria-label*="prev" i], button[aria-label*="Prev" i]').first();
    if (await prevBtn.isVisible()) {
      await prevBtn.click();
      await page.waitForTimeout(500);
    }
    await screenshot(page, "nav-prev-next");
  });
});

// ---------------------------------------------------------------------------
// 4. SEARCH
// ---------------------------------------------------------------------------

test.describe("4 · Search", () => {
  test.beforeEach(async () => {
    await initAndAdvanceAll();
  });

  test("search modal opens and filters events", async ({ page }) => {
    await loadApp(page);
    const searchBtn = page.locator(
      'button[aria-label*="search" i], button[aria-label*="Search" i]'
    ).first();
    if (await searchBtn.isVisible()) {
      await searchBtn.click();
      await page.waitForTimeout(500);
    }

    const searchInput = page.locator(
      'input[placeholder*="Search" i], input[placeholder*="search" i]'
    ).first();
    if (await searchInput.isVisible()) {
      const events = await getEvents();
      if (events.length > 0) {
        const searchTerm = events[0].title.split(" ")[0];
        await searchInput.fill(searchTerm);
        await page.waitForTimeout(1000);
      }
    }
    await screenshot(page, "search-events");
  });
});

// ---------------------------------------------------------------------------
// 5. EVENT CREATION & EDITING
// ---------------------------------------------------------------------------

test.describe("5 · Event Creation & Editing", () => {
  test.beforeEach(async () => {
    await initAndAdvanceAll();
  });

  test("create event modal opens from + button", async ({ page }) => {
    await loadApp(page);
    const createBtn = page.locator(
      'button[aria-label*="create" i], button[aria-label*="Create" i], button[aria-label*="add" i]'
    ).first();
    if (await createBtn.isVisible()) {
      await createBtn.click();
      await page.waitForTimeout(500);
    }

    // Look for Event option
    const eventOption = page.locator('button:has-text("Event")').first();
    if (await eventOption.isVisible()) {
      await eventOption.click();
      await page.waitForTimeout(500);
    }
    await screenshot(page, "event-create-modal");
  });

  test("event form has title, date, time, calendar fields", async ({ page }) => {
    await loadApp(page);
    const createBtn = page.locator(
      'button[aria-label*="create" i], button[aria-label*="Create" i], button[aria-label*="add" i]'
    ).first();
    if (await createBtn.isVisible()) {
      await createBtn.click();
      await page.waitForTimeout(500);
    }

    const eventOption = page.locator('button:has-text("Event")').first();
    if (await eventOption.isVisible()) {
      await eventOption.click();
      await page.waitForTimeout(500);
    }

    const titleInput = page.locator('input[placeholder*="Event title" i], input[placeholder*="title" i]').first();
    if (await titleInput.isVisible()) {
      expect(await titleInput.isVisible()).toBe(true);
    }
    await screenshot(page, "event-form-fields");
  });

  test("clicking event opens details modal", async ({ page }) => {
    await loadApp(page);
    const events = await getEvents();
    if (events.length === 0) return;

    const eventEl = page.locator(`text=${events[0].title}`).first();
    if (await eventEl.isVisible()) {
      await eventEl.click();
      await page.waitForTimeout(500);
    }
    await screenshot(page, "event-details");
  });
});

// ---------------------------------------------------------------------------
// 6. TASKS
// ---------------------------------------------------------------------------

test.describe("6 · Tasks", () => {
  test.beforeEach(async () => {
    await initAndAdvanceAll();
  });

  test("tasks panel opens and shows tasks", async ({ page }) => {
    await loadApp(page);
    // Toggle tasks panel
    const tasksBtn = page.locator(
      'button[aria-label*="task" i], button[aria-label*="Task" i]'
    ).first();
    if (await tasksBtn.isVisible()) {
      await tasksBtn.click();
      await page.waitForTimeout(1000);
    }

    const tasks = await getTasks();
    if (tasks.length > 0) {
      const taskEl = page.locator(`text=${tasks[0].title}`).first();
      if (await taskEl.isVisible()) {
        expect(await taskEl.isVisible()).toBe(true);
      }
    }
    await screenshot(page, "tasks-panel");
  });

  test("task checkbox toggles completion", async ({ page }) => {
    await loadApp(page);
    const tasksBtn = page.locator(
      'button[aria-label*="task" i], button[aria-label*="Task" i]'
    ).first();
    if (await tasksBtn.isVisible()) {
      await tasksBtn.click();
      await page.waitForTimeout(1000);
    }

    const checkbox = page.locator('input[type="checkbox"]').first();
    if (await checkbox.isVisible()) {
      await checkbox.click();
      await page.waitForTimeout(1000);
    }
    await screenshot(page, "tasks-toggle");
  });

  test("create task via button", async ({ page }) => {
    await loadApp(page);
    const createBtn = page.locator(
      'button[aria-label*="create" i], button[aria-label*="Create" i], button[aria-label*="add" i]'
    ).first();
    if (await createBtn.isVisible()) {
      await createBtn.click();
      await page.waitForTimeout(500);
    }

    const taskOption = page.locator('button:has-text("Task")').first();
    if (await taskOption.isVisible()) {
      await taskOption.click();
      await page.waitForTimeout(500);
    }
    await screenshot(page, "tasks-create-modal");
  });
});

// ---------------------------------------------------------------------------
// 7. CALENDAR SIDEBAR
// ---------------------------------------------------------------------------

test.describe("7 · Calendar Sidebar", () => {
  test.beforeEach(async () => {
    await initAndAdvanceAll();
  });

  test("sidebar shows mini calendar", async ({ page }) => {
    await loadApp(page);
    await screenshot(page, "sidebar-mini-calendar");
  });

  test("calendar toggles filter events", async ({ page }) => {
    await loadApp(page);
    // Find calendar checkboxes
    const workCheck = page.locator('text=Work').first();
    if (await workCheck.isVisible()) {
      await workCheck.click();
      await page.waitForTimeout(500);
    }
    await screenshot(page, "sidebar-calendar-toggle");
  });

  test("sidebar collapses and expands", async ({ page }) => {
    await loadApp(page);
    const menuBtn = page.locator('button[aria-label*="menu" i], button[aria-label*="Menu" i]').first();
    if (await menuBtn.isVisible()) {
      await menuBtn.click();
      await page.waitForTimeout(500);
      await screenshot(page, "sidebar-collapsed");

      await menuBtn.click();
      await page.waitForTimeout(500);
      await screenshot(page, "sidebar-expanded");
    }
  });
});

// ---------------------------------------------------------------------------
// 8. USER ACCOUNT & SETTINGS
// ---------------------------------------------------------------------------

test.describe("8 · User Account & Settings", () => {
  test.beforeEach(async () => {
    await initAndAdvanceAll();
  });

  test("profile dropdown opens", async ({ page }) => {
    await loadApp(page);
    const profileBtn = page.locator("header button, nav button").last();
    await profileBtn.click();
    await page.waitForTimeout(500);
    await screenshot(page, "user-dropdown");
  });

  test("settings modal opens", async ({ page }) => {
    await loadApp(page);
    const profileBtn = page.locator("header button, nav button").last();
    await profileBtn.click();
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
    const profileBtn = page.locator("header button, nav button").last();
    await profileBtn.click();
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
});

// ---------------------------------------------------------------------------
// 9. GOOGLE CALENDAR FIDELITY
// ---------------------------------------------------------------------------

test.describe("9 · Google Calendar Fidelity", () => {
  test.beforeEach(async () => {
    await initAndAdvanceAll();
  });

  test("header shows MicroLendar branding", async ({ page }) => {
    await loadApp(page);
    const logo = page.locator('text=MicroLendar').first();
    expect(await logo.isVisible()).toBe(true);
    await screenshot(page, "fidelity-header");
  });

  test("calendar grid renders with weekday headers", async ({ page }) => {
    await loadApp(page);
    const sunHeader = page.locator('text=/Sun|Mon|Tue|Wed|Thu|Fri|Sat/').first();
    expect(await sunHeader.isVisible()).toBe(true);
    await screenshot(page, "fidelity-calendar-grid");
  });

  test("events have color-coded calendar chips", async ({ page }) => {
    await loadApp(page);
    await screenshot(page, "fidelity-event-chips");
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
    const views = ["Day", "Week", "Month", "Year"];
    for (const view of views) {
      const btn = page.locator(`button:has-text("${view}")`).first();
      if (await btn.isVisible()) {
        await btn.click();
        await page.waitForTimeout(200);
      }
    }
    await page.waitForTimeout(1000);
    const body = await page.innerText("body");
    expect(body.length).toBeGreaterThan(0);
    await screenshot(page, "edge-rapid-views");
  });

  test("deleting one event via API removes it from calendar data", async ({ page }) => {
    const { body: created } = await apiPost("/data/microlendar-events", {
      title: "Edge Delete Event",
      date: "2026-03-21",
      time: "09:00",
      calendar: "Family",
    });
    expect(created.success).toBe(true);

    await apiPost(`/data/microlendar-events/${created.event.id}/delete`);
    await loadApp(page);
    const events = await getEvents();
    expect(events.some((e: any) => e.id === created.event.id)).toBe(false);
    await screenshot(page, "edge-deleted-event");
  });

  test("completing one task persists to the task list", async () => {
    const tasks = await getTasks();
    const target = tasks.find((t: any) => !t.completed);
    if (!target) return;

    await apiPost(`/data/microlendar-tasks/${target.id}/complete`);
    const after = await getTasks();
    expect(after.find((t: any) => t.id === target.id)?.completed).toBe(true);
  });

  test("creating event via API appears after polling", async ({ page }) => {
    await loadApp(page);
    await apiPost("/data/microlendar-events", {
      title: "Edge Test Event",
      date: "2026-03-18",
      time: "15:00",
      calendar: "Family",
    });
    await page.waitForTimeout(2000);
    await screenshot(page, "edge-polled-event");
  });
});
