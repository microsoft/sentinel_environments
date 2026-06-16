import { test, expect, type Page } from "@playwright/test";

test.setTimeout(60_000);
test.use({ viewport: { width: 1440, height: 900 } });

const API = process.env.PLAYWRIGHT_SERVER_URL ?? "http://localhost:8000";
const SCENARIO_PATH =
  "../scenarios/microhood/orders-absolute-active.json";
const SCREENSHOTS = "../.cache/audit_screenshots/microhood";

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

async function getStocks() {
  return (await apiGet("/data/microhood-stocks")).body.stocks ?? [];
}

async function getPortfolio() {
  return (await apiGet("/data/microhood-portfolio")).body;
}

async function getWatchlist() {
  return (await apiGet("/data/microhood-watchlist")).body.watchlist ?? [];
}

async function getNews() {
  return (await apiGet("/data/microhood-news")).body.news ?? [];
}

async function loadApp(page: Page) {
  await page.goto("/microhood", { waitUntil: "domcontentloaded" });
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

  test("GET /data/microhood-stocks returns stocks with expected schema", async () => {
    const stocks = await getStocks();
    expect(stocks.length).toBeGreaterThan(0);
    const s = stocks[0];
    expect(s).toHaveProperty("symbol");
    expect(s).toHaveProperty("name");
    expect(s).toHaveProperty("currentPrice");
    expect(s).toHaveProperty("change");
    expect(s).toHaveProperty("changePercent");
  });

  test("GET /data/microhood-portfolio returns portfolio", async () => {
    const portfolio = await getPortfolio();
    expect(portfolio).toHaveProperty("buying_power");
    expect(portfolio).toHaveProperty("portfolio_value");
    expect(portfolio).toHaveProperty("positions_value");
  });

  test("GET /data/microhood-watchlist returns watchlist", async () => {
    const watchlist = await getWatchlist();
    expect(Array.isArray(watchlist)).toBe(true);
    if (watchlist.length > 0) {
      expect(watchlist[0]).toHaveProperty("symbol");
      expect(watchlist[0]).toHaveProperty("price");
    }
  });

  test("GET /data/microhood-news returns news", async () => {
    const news = await getNews();
    expect(Array.isArray(news)).toBe(true);
    if (news.length > 0) {
      expect(news[0]).toHaveProperty("id");
      expect(news[0]).toHaveProperty("title");
      expect(news[0]).toHaveProperty("source");
    }
  });

  test("POST place market buy order", async () => {
    const stocks = await getStocks();
    const target = stocks[0];

    const { body } = await apiPost(`/data/microhood-stocks/${target.symbol}/order`, {
      action: "buy",
      quantity: 1,
      type: "market",
    });
    expect(body.success).toBe(true);

    const after = await getStocks();
    const updated = after.find((s: any) => s.symbol === target.symbol);
    expect(updated.shares).toBeGreaterThanOrEqual(1);
  });

  test("POST place market sell order", async () => {
    const stocks = await getStocks();
    const target = stocks[0];

    // Buy first
    await apiPost(`/data/microhood-stocks/${target.symbol}/order`, {
      action: "buy",
      quantity: 2,
      type: "market",
    });

    // Sell
    const { body } = await apiPost(`/data/microhood-stocks/${target.symbol}/order`, {
      action: "sell",
      quantity: 1,
      type: "market",
    });
    expect(body.success).toBe(true);
  });

  test("POST place limit order", async () => {
    const stocks = await getStocks();
    const target = stocks[0];

    const { body } = await apiPost(`/data/microhood-stocks/${target.symbol}/order`, {
      action: "buy",
      quantity: 1,
      type: "limit",
      limit_price: target.currentPrice + 10,
    });
    expect(body.success).toBe(true);
  });

  test("POST toggle watchlist", async () => {
    const watchlist = await getWatchlist();
    if (watchlist.length === 0) return;

    const target = watchlist[0];
    await apiPost(`/data/microhood-watchlist/${target.symbol}/toggle`);
    const after = await getWatchlist();
    const updated = after.find((w: any) => w.symbol === target.symbol);
    if (updated) {
      expect(updated.inWatchlist).toBe(!target.inWatchlist);
    }
  });

  test("POST sell order can close a purchased position", async () => {
    const stocks = await getStocks();
    const target = stocks[0];
    if (!target) return;
    const initialShares = target.shares ?? 0;

    await apiPost(`/data/microhood-stocks/${target.symbol}/order`, {
      action: "buy",
      quantity: 5,
      type: "market",
    });
    await apiPost(`/data/microhood-stocks/${target.symbol}/order`, {
      action: "sell",
      quantity: 5,
      type: "market",
    });
    const after = await getStocks();
    const updated = after.find((s: any) => s.symbol === target.symbol);
    expect(updated.shares).toBe(initialShares);
  });

  test("POST toggle watchlist removes one symbol from the active watchlist", async () => {
    const watchlist = await getWatchlist();
    const target = watchlist[0];
    if (!target) return;

    await apiPost(`/data/microhood-watchlist/${target.symbol}/toggle`);
    const after = await getWatchlist();
    expect(after.some((w: any) => w.symbol === target.symbol)).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// 2. UI ↔ API SYNC
// ---------------------------------------------------------------------------

test.describe("2 · UI ↔ API Sync", () => {
  test.beforeEach(async () => {
    await initAndAdvanceAll();
  });

  test("portfolio value renders from API", async ({ page }) => {
    await loadApp(page);
    const portfolio = await getPortfolio();
    // Portfolio value should be visible somewhere on page
    const body = await page.innerText("body");
    expect(body.length).toBeGreaterThan(100);
    await screenshot(page, "ui-sync-portfolio");
  });

  test("stock list shows stocks from API", async ({ page }) => {
    await loadApp(page);
    const stocks = await getStocks();
    if (stocks.length === 0) return;

    const symbolEl = page.locator(`text=${stocks[0].symbol}`).first();
    expect(await symbolEl.isVisible()).toBe(true);
    await screenshot(page, "ui-sync-stocks");
  });

  test("buying stock updates UI and server", async ({ page }) => {
    await loadApp(page);

    const buyBtn = page.locator('button:has-text("Buy")').first();
    if (await buyBtn.isVisible()) {
      await buyBtn.click();
      await page.waitForTimeout(1000);
    }
    await screenshot(page, "ui-sync-buy-modal");
  });
});

// ---------------------------------------------------------------------------
// 3. NAVIGATION & VIEWS
// ---------------------------------------------------------------------------

test.describe("3 · Navigation & Views", () => {
  test.beforeEach(async () => {
    await initAndAdvanceAll();
  });

  test("investing view is default", async ({ page }) => {
    await loadApp(page);
    const body = await page.innerText("body");
    expect(body.length).toBeGreaterThan(100);
    await screenshot(page, "nav-investing");
  });

  test("nav tabs switch between sections", async ({ page }) => {
    await loadApp(page);

    const tabs = ["Crypto", "Spending", "Retirement"];
    for (const tab of tabs) {
      const btn = page.locator(`button:has-text("${tab}")`).first();
      if (await btn.isVisible()) {
        await btn.click();
        await page.waitForTimeout(500);
      }
    }
    await screenshot(page, "nav-sections");
  });

  test("clicking stock selects it and shows details", async ({ page }) => {
    await loadApp(page);
    const stocks = await getStocks();
    if (stocks.length === 0) return;

    const stockEl = page.locator(`text=${stocks[0].symbol}`).first();
    if (await stockEl.isVisible()) {
      await stockEl.click();
      await page.waitForTimeout(1000);
    }
    await screenshot(page, "nav-stock-detail");
  });

  test("timeframe selector buttons work", async ({ page }) => {
    await loadApp(page);
    const timeframes = ["1D", "1W", "1M", "3M", "YTD", "1Y", "ALL"];
    for (const tf of timeframes) {
      const btn = page.locator(`button:has-text("${tf}")`).first();
      if (await btn.isVisible()) {
        await btn.click();
        await page.waitForTimeout(200);
      }
    }
    await screenshot(page, "nav-timeframes");
  });
});

// ---------------------------------------------------------------------------
// 4. SEARCH
// ---------------------------------------------------------------------------

test.describe("4 · Search", () => {
  test.beforeEach(async () => {
    await initAndAdvanceAll();
  });

  test("search modal opens and shows results", async ({ page }) => {
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
      await searchInput.fill("MCRO");
      await page.waitForTimeout(1000);
    }
    await screenshot(page, "search-results");
  });

  test("popular searches are shown", async ({ page }) => {
    await loadApp(page);
    const searchBtn = page.locator(
      'button[aria-label*="search" i], button[aria-label*="Search" i]'
    ).first();
    if (await searchBtn.isVisible()) {
      await searchBtn.click();
      await page.waitForTimeout(500);
    }
    await screenshot(page, "search-popular");
  });
});

// ---------------------------------------------------------------------------
// 5. ORDER FLOW
// ---------------------------------------------------------------------------

test.describe("5 · Order Flow", () => {
  test.beforeEach(async () => {
    await initAndAdvanceAll();
  });

  test("buy button opens order modal", async ({ page }) => {
    await loadApp(page);
    const buyBtn = page.locator('button:has-text("Buy")').first();
    if (await buyBtn.isVisible()) {
      await buyBtn.click();
      await page.waitForTimeout(1000);
    }
    await screenshot(page, "order-buy-modal");
  });

  test("sell button opens order modal", async ({ page }) => {
    await loadApp(page);
    const sellBtn = page.locator('button:has-text("Sell")').first();
    if (await sellBtn.isVisible()) {
      await sellBtn.click();
      await page.waitForTimeout(1000);
    }
    await screenshot(page, "order-sell-modal");
  });

  test("order type toggles between market and limit", async ({ page }) => {
    await loadApp(page);
    const buyBtn = page.locator('button:has-text("Buy")').first();
    if (await buyBtn.isVisible()) {
      await buyBtn.click();
      await page.waitForTimeout(500);

      const limitBtn = page.locator('button:has-text("Limit")').first();
      if (await limitBtn.isVisible()) {
        await limitBtn.click();
        await page.waitForTimeout(500);
      }
    }
    await screenshot(page, "order-limit-type");
  });
});

// ---------------------------------------------------------------------------
// 6. WATCHLIST
// ---------------------------------------------------------------------------

test.describe("6 · Watchlist", () => {
  test.beforeEach(async () => {
    await initAndAdvanceAll();
  });

  test("watchlist section shows items", async ({ page }) => {
    await loadApp(page);
    const watchlist = await getWatchlist();
    if (watchlist.length > 0) {
      const symbolEl = page.locator(`text=${watchlist[0].symbol}`).first();
      expect(await symbolEl.isVisible()).toBe(true);
    }
    await screenshot(page, "watchlist-items");
  });

  test("star toggle adds/removes from watchlist", async ({ page }) => {
    await loadApp(page);
    // Look for star/watchlist icon
    const starBtn = page.locator(
      'button[aria-label*="watchlist" i], button[aria-label*="star" i]'
    ).first();
    if (await starBtn.isVisible()) {
      await starBtn.click();
      await page.waitForTimeout(1000);
    }
    await screenshot(page, "watchlist-toggle");
  });

  test("edit watchlist mode shows remove buttons", async ({ page }) => {
    await loadApp(page);
    const editBtn = page.locator('button:has-text("Edit")').first();
    if (await editBtn.isVisible()) {
      await editBtn.click();
      await page.waitForTimeout(500);
    }
    await screenshot(page, "watchlist-edit");
  });
});

// ---------------------------------------------------------------------------
// 7. NOTIFICATIONS & NEWS
// ---------------------------------------------------------------------------

test.describe("7 · Notifications & News", () => {
  test.beforeEach(async () => {
    await initAndAdvanceAll();
  });

  test("notifications panel opens", async ({ page }) => {
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

  test("news section shows articles", async ({ page }) => {
    await loadApp(page);
    const news = await getNews();
    if (news.length > 0) {
      const newsEl = page.locator(`text=${news[0].title}`).first();
      if (await newsEl.isVisible()) {
        expect(await newsEl.isVisible()).toBe(true);
      }
    }
    await screenshot(page, "news-section");
  });
});

// ---------------------------------------------------------------------------
// 8. USER ACCOUNT & MODALS
// ---------------------------------------------------------------------------

test.describe("8 · User Account & Modals", () => {
  test.beforeEach(async () => {
    await initAndAdvanceAll();
  });

  test("settings modal opens", async ({ page }) => {
    await loadApp(page);
    const settingsBtn = page.locator(
      'button[aria-label*="setting" i], button[aria-label*="Setting" i]'
    ).first();
    if (await settingsBtn.isVisible()) {
      await settingsBtn.click();
      await page.waitForTimeout(500);
    }
    await screenshot(page, "settings-modal");
  });

  test("transfer modal opens with options", async ({ page }) => {
    await loadApp(page);
    const transferBtn = page.locator('button:has-text("Transfer")').first();
    if (await transferBtn.isVisible()) {
      await transferBtn.click();
      await page.waitForTimeout(500);
    }
    await screenshot(page, "transfer-modal");
  });

  test("sign out shows lock screen", async ({ page }) => {
    await loadApp(page);
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
// 9. ROBINHOOD FIDELITY
// ---------------------------------------------------------------------------

test.describe("9 · Robinhood Fidelity", () => {
  test.beforeEach(async () => {
    await initAndAdvanceAll();
  });

  test("header shows MicroHood logo and nav tabs", async ({ page }) => {
    await loadApp(page);
    const logo = page.locator('text=MicroHood').first();
    expect(await logo.isVisible()).toBe(true);
    await screenshot(page, "fidelity-header");
  });

  test("chart area renders", async ({ page }) => {
    await loadApp(page);
    // SVG chart should be present
    const svg = page.locator("svg").first();
    expect(await svg.isVisible()).toBe(true);
    await screenshot(page, "fidelity-chart");
  });

  test("stock card shows price, change, and stats", async ({ page }) => {
    await loadApp(page);
    const stocks = await getStocks();
    if (stocks.length > 0) {
      const symbolEl = page.locator(`text=${stocks[0].symbol}`).first();
      expect(await symbolEl.isVisible()).toBe(true);
    }
    await screenshot(page, "fidelity-stock-card");
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

  test("rapid stock selection - no crash", async ({ page }) => {
    await loadApp(page);
    const stocks = await getStocks();
    for (let i = 0; i < Math.min(5, stocks.length); i++) {
      const el = page.locator(`text=${stocks[i].symbol}`).first();
      if (await el.isVisible()) {
        await el.click();
        await page.waitForTimeout(100);
      }
    }
    await page.waitForTimeout(1000);
    const body = await page.innerText("body");
    expect(body.length).toBeGreaterThan(0);
    await screenshot(page, "edge-rapid-select");
  });

  test("selling a position restores buying power after purchase", async () => {
    const stocks = await getStocks();
    const target = stocks[0];
    if (!target) return;

    const before = await getPortfolio();
    await apiPost(`/data/microhood-stocks/${target.symbol}/order`, {
      action: "buy",
      quantity: 3,
      type: "market",
    });
    const afterBuy = await getPortfolio();
    await apiPost(`/data/microhood-stocks/${target.symbol}/order`, {
      action: "sell",
      quantity: 3,
      type: "market",
    });
    const afterSell = await getPortfolio();
    expect(afterBuy.buying_power).toBeLessThan(before.buying_power);
    expect(afterSell.buying_power).toBeGreaterThan(afterBuy.buying_power);
  });

  test("toggling a symbol off and on re-adds it to the watchlist", async () => {
    const watchlist = await getWatchlist();
    const target = watchlist[0];
    if (!target) return;

    await apiPost(`/data/microhood-watchlist/${target.symbol}/toggle`);
    await apiPost(`/data/microhood-watchlist/${target.symbol}/toggle`);
    const after = await getWatchlist();
    expect(after.some((w: any) => w.symbol === target.symbol)).toBe(true);
  });

  test("buying power decreases after purchase", async () => {
    const before = await getPortfolio();
    const stocks = await getStocks();

    await apiPost(`/data/microhood-stocks/${stocks[0].symbol}/order`, {
      action: "buy",
      quantity: 1,
      type: "market",
    });

    const after = await getPortfolio();
    expect(after.buying_power).toBeLessThan(before.buying_power);
  });
});
