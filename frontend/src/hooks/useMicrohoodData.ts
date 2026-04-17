import { useCallback, useEffect, useRef, useState } from "react";
import type { ApiSelfUser } from "../types/selfUser";

export interface ApiStock {
  symbol: string;
  name: string;
  color: string;
  orgId: string;
  currentPrice: number;
  change: number;
  changePercent: number;
  shares: number;
  avgCost: number;
}

export interface ApiWatchlistItem {
  symbol: string;
  name: string;
  price: number;
  change: number;
  changePercent: number;
  inWatchlist: boolean;
}

export interface ApiNews {
  id: string;
  source: string;
  title: string;
  time: string;
}

export interface ApiPortfolio {
  buying_power: number;
  positions_value: number;
  portfolio_value: number;
  total_gain: number;
  total_gain_percent: number;
}

export interface ApiTaskConfig {
  environment: string;
  duration: number;
  selfUser?: ApiSelfUser;
}

export function useMicrohoodData() {
  const [stocks, setStocks] = useState<ApiStock[]>([]);
  const [watchlist, setWatchlist] = useState<ApiWatchlistItem[]>([]);
  const [news, setNews] = useState<ApiNews[]>([]);
  const [portfolio, setPortfolio] = useState<ApiPortfolio | null>(null);
  const [config, setConfig] = useState<ApiTaskConfig | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const configLoaded = useRef(false);
  const mismatch = useRef(false);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const fetchData = useCallback(() => {
    if (mismatch.current) return;

    // Retry config until loaded
    if (!configLoaded.current) {
      fetch("/api/data/config")
        .then((r) => {
          if (!r.ok) throw new Error(`Config fetch failed: ${r.status}`);
          return r.json();
        })
        .then((data: ApiTaskConfig) => {
          if (data.environment !== "microhood") {
            mismatch.current = true;
            setError(
              `Environment mismatch: server is running "${data.environment}" but this is the MicroHood UI.`
            );
            setIsLoading(false);
            return;
          }
          configLoaded.current = true;
          setConfig(data);
        })
        .catch(() => {}); // Will retry on next poll
    }

    // Poll stocks, portfolio, watchlist, news in parallel
    Promise.all([
      fetch("/api/data/microhood-stocks"),
      fetch("/api/data/microhood-portfolio"),
      fetch("/api/data/microhood-watchlist"),
      fetch("/api/data/microhood-news"),
    ])
      .then(async ([stocksRes, portfolioRes, watchlistRes, newsRes]) => {
        if (!stocksRes.ok) throw new Error(`Stocks fetch failed: ${stocksRes.status}`);
        if (!portfolioRes.ok) throw new Error(`Portfolio fetch failed: ${portfolioRes.status}`);
        if (!watchlistRes.ok) throw new Error(`Watchlist fetch failed: ${watchlistRes.status}`);
        if (!newsRes.ok) throw new Error(`News fetch failed: ${newsRes.status}`);

        const [stocksData, portfolioData, watchlistData, newsData] = await Promise.all([
          stocksRes.json(),
          portfolioRes.json(),
          watchlistRes.json(),
          newsRes.json(),
        ]);

        setStocks(stocksData.stocks ?? []);
        setPortfolio(portfolioData as ApiPortfolio);
        setWatchlist(watchlistData.watchlist ?? []);
        setNews(newsData.news ?? []);
        setError(null);
        setIsLoading(false);
      })
      .catch((e) => {
        setError(String(e));
        setIsLoading(false);
      });
  }, []);

  useEffect(() => {
    fetchData();
    pollRef.current = setInterval(fetchData, 1000);
    return () => {
      if (pollRef.current) clearInterval(pollRef.current);
    };
  }, [fetchData]);

  // Mutation helpers
  const placeOrder = useCallback(
    async (
      symbol: string,
      action: "buy" | "sell",
      quantity: number,
      type: "market" | "limit" = "market",
      limitPrice?: number
    ): Promise<{ success: boolean; error?: string }> => {
      const res = await fetch(`/api/data/microhood-stocks/${symbol}/order`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action,
          quantity,
          type,
          limit_price: limitPrice ?? null,
        }),
      }).catch(() => null);
      if (!res) return { success: false, error: "Network error" };
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        return { success: false, error: data.detail || "Order failed" };
      }
      return res.json();
    },
    []
  );

  const toggleWatchlist = useCallback(async (symbol: string) => {
    await fetch(`/api/data/microhood-watchlist/${symbol}/toggle`, {
      method: "POST",
    }).catch(() => {});
  }, []);

  return {
    stocks,
    watchlist,
    news,
    portfolio,
    config,
    isLoading,
    error,
    placeOrder,
    toggleWatchlist,
  };
}
