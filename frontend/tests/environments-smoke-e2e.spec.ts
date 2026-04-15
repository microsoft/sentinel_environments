import { expect, test } from "@playwright/test";

const API = process.env.PLAYWRIGHT_API_URL ?? "http://localhost:8000";

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

async function initAndAdvanceScenario(scenarioId: string) {
  await apiGet("/close");
  const scenario = await apiGet(`/scenarios/${scenarioId}`);
  const initPayload = {
    environment: scenario.environment,
    duration: scenario.duration,
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

type SmokeCase = {
  name: string;
  scenarioId: string;
  route: string;
  stableTexts: string[];
  dynamicText: () => Promise<string | null>;
};

const smokeCases: SmokeCase[] = [
  {
    name: "MicroChat",
    scenarioId: "microchat-unread-absolute-passive",
    route: "/microchat",
    stableTexts: ["chat", "teams", "calls"],
    dynamicText: async () => {
      const data = await apiGet("/data/microchat-conversations");
      return data.conversations?.[0]?.name ?? null;
    },
  },
  {
    name: "MicroDin",
    scenarioId: "microdin-connections-absolute-passive",
    route: "/microdin",
    stableTexts: ["my network", "jobs", "messaging"],
    dynamicText: async () => {
      const data = await apiGet("/data/microdin-posts");
      return data.posts?.[0]?.authorName ?? null;
    },
  },
  {
    name: "MicroFy",
    scenarioId: "microfy-likes-absolute-passive",
    route: "/microfy",
    stableTexts: ["home", "your library", "trending songs"],
    dynamicText: async () => {
      const data = await apiGet("/data/microfy-tracks");
      return data.tracks?.[0]?.title ?? null;
    },
  },
  {
    name: "MicroGram",
    scenarioId: "microgram-likes-absolute-passive",
    route: "/microgram",
    stableTexts: ["microgram", "your story", "load more posts"],
    dynamicText: async () => {
      const data = await apiGet("/data/microgram-posts");
      return data.posts?.[0]?.caption ?? null;
    },
  },
  {
    name: "MicroHood",
    scenarioId: "microhood-portfolio-absolute-passive",
    route: "/microhood",
    stableTexts: ["buying power", "search", "watchlist"],
    dynamicText: async () => {
      const data = await apiGet("/data/microhood-stocks");
      return data.stocks?.[0]?.symbol ?? null;
    },
  },
  {
    name: "MicroHub",
    scenarioId: "microhub-browse-absolute-passive",
    route: "/microhub",
    stableTexts: ["issues", "security", "insights"],
    dynamicText: async () => {
      const data = await apiGet("/data/microhub-repository");
      return data.repository?.name ?? null;
    },
  },
  {
    name: "MicroLendar",
    scenarioId: "microlendar-events-absolute-passive",
    route: "/microlendar",
    stableTexts: ["tasks", "work", "month"],
    dynamicText: async () => {
      const data = await apiGet("/data/microlendar-events");
      return data.events?.[0]?.title ?? null;
    },
  },
  {
    name: "MicroScholar",
    scenarioId: "microscholar-search-absolute-passive",
    route: "/microscholar",
    stableTexts: ["articles", "recommended articles", "try scholar labs"],
    dynamicText: async () => {
      const data = await apiGet("/data/microscholar-papers");
      return data.papers?.[0]?.title ?? null;
    },
  },
  {
    name: "MicroTube",
    scenarioId: "microtube-subscribers-absolute-passive",
    route: "/microtube",
    stableTexts: ["home", "shorts", "subscriptions"],
    dynamicText: async () => {
      const data = await apiGet("/data/microtube-videos");
      return data.videos?.[0]?.title ?? null;
    },
  },
];

test.describe("Environment smoke E2E", () => {
  for (const smokeCase of smokeCases) {
    test(`${smokeCase.name} renders initialized scenario data`, async ({ page }) => {
      await initAndAdvanceScenario(smokeCase.scenarioId);
      await authenticate(page);
      await page.goto(smokeCase.route);
      await page.waitForLoadState("networkidle");
      await page.waitForTimeout(3000);

      const bodyText = await page.locator("body").innerText();
      const bodyTextLower = bodyText.toLowerCase();
      for (const stableText of smokeCase.stableTexts) {
        expect(bodyTextLower).toContain(stableText);
      }

      const dynamicText = await smokeCase.dynamicText();
      expect(dynamicText).toBeTruthy();
      if (dynamicText) {
        expect(bodyText).toContain(dynamicText);
      }

      expect(bodyText).not.toContain("Environment mismatch");
      expect(bodyText).not.toContain("demo-sentinel-error");
    });
  }
});
