import { useCallback, useEffect, useRef, useState, useMemo } from "react";
import type { ApiSelfUser } from "../types/selfUser";

export interface ApiPaper {
  id: string;
  title: string;
  titleHtml: string;
  authorIds: string[];
  authorDetails: { id: string; name: string; avatarUrl: string; affiliation: string }[];
  authors: string;
  source: string;
  year: number;
  snippet: string;
  citedBy: number;
  versions: number;
  pdfLink: string;
  pdfSource: string;
  isBook: boolean;
  isTargetPaper: boolean;
  taskType: string;
  order: number;
  isSaved?: boolean;
  _arrivedAt?: number;
}

export interface ApiAlert {
  id: string;
  type: string;
  title: string;
  description: string;
  isRead: boolean;
  relatedPaperId: string;
  order: number;
}

export interface ApiCoauthor {
  authorId1: string;
  author1Name?: string;
  author1AvatarUrl?: string;
  authorId2: string;
  author2Name?: string;
  author2AvatarUrl?: string;
  sharedPapers: string[];
  order: number;
}

export interface ApiTaskConfig {
  environment: string;
  event_timeline_end: number;
  selfUser?: ApiSelfUser;
}

export interface ApiScholarUser {
  id: string;
  isSelf?: boolean;
  name: string;
  email?: string;
  avatarUrl: string;
  location?: string;
  microscholar?: {
    email?: string;
    affiliation?: string;
    department?: string;
    title?: string;
    interests?: string[];
    citations?: number;
    hIndex?: number;
    i10Index?: number;
    citationsSince2020?: number;
    hIndexSince2020?: number;
    isVerified?: boolean;
    homepage?: string;
    orcid?: string;
  };
}

export interface AdvancedSearchParams {
  allWords?: string;
  exactPhrase?: string;
  atLeastOne?: string;
  without?: string;
  author?: string;
  publication?: string;
  dateStart?: string;
  dateEnd?: string;
}

type SaveOverrides = Map<string, boolean>;
type AlertReadOverrides = Map<string, boolean>;

export function useMicroscholarData() {
  const [rawPapers, setRawPapers] = useState<ApiPaper[]>([]);
  const [rawAlerts, setRawAlerts] = useState<ApiAlert[]>([]);
  const [coauthors, setCoauthors] = useState<ApiCoauthor[]>([]);
  const [config, setConfig] = useState<ApiTaskConfig | null>(null);
  const [users, setUsers] = useState<Record<string, ApiScholarUser>>({});
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Local overrides for optimistic UI updates
  const [saveOverrides, setSaveOverrides] = useState<SaveOverrides>(new Map());
  const [alertReadOverrides, setAlertReadOverrides] = useState<AlertReadOverrides>(new Map());

  const configLoaded = useRef(false);
  const usersLoaded = useRef(false);
  const mismatch = useRef(false);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Always poll ALL papers (no search filter) -- search is a separate one-shot fetch
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
          if (data.environment !== "microscholar") {
            mismatch.current = true;
            setError(`Environment mismatch: server is running "${data.environment}" but this is the MicroScholar UI.`);
            setIsLoading(false);
            return;
          }
          configLoaded.current = true;
          setConfig(data);
        })
        .catch(() => {});
    }

    // Fetch scholar users once
    if (!usersLoaded.current) {
      fetch("/api/data/microscholar-users")
        .then((r) => {
          if (!r.ok) throw new Error(`Users fetch failed: ${r.status}`);
          return r.json();
        })
        .then((data) => {
          usersLoaded.current = true;
          const userMap: Record<string, ApiScholarUser> = {};
          for (const u of data.users ?? []) {
            userMap[u.id] = u;
          }
          setUsers(userMap);
        })
        .catch(() => {});
    }

    // Poll all data in parallel
    Promise.all([
      fetch("/api/data/microscholar-papers").then((r) => {
        if (!r.ok) throw new Error(`Papers fetch failed: ${r.status}`);
        return r.json();
      }),
      fetch("/api/data/microscholar-alerts").then((r) => {
        if (!r.ok) throw new Error(`Alerts fetch failed: ${r.status}`);
        return r.json();
      }),
      fetch("/api/data/microscholar-coauthors").then((r) => {
        if (!r.ok) throw new Error(`Coauthors fetch failed: ${r.status}`);
        return r.json();
      }),
    ])
      .then(([papersData, alertsData, coauthorsData]) => {
        const now = Date.now();
        const incoming: ApiPaper[] = papersData.papers ?? [];
        setRawPapers((prev) => {
          const knownIds = new Set(prev.map((p) => p.id));
          return incoming.map((p) =>
            knownIds.has(p.id)
              ? { ...p, _arrivedAt: prev.find((x) => x.id === p.id)?._arrivedAt }
              : { ...p, _arrivedAt: now }
          );
        });
        setRawAlerts(alertsData.alerts ?? []);
        setCoauthors(coauthorsData.coauthors ?? []);
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

  // Apply local overrides
  const papers = useMemo<ApiPaper[]>(() => {
    return rawPapers.map((paper) => {
      const isSaved = saveOverrides.has(paper.id)
        ? (saveOverrides.get(paper.id) as boolean)
        : paper.isSaved ?? false;
      return { ...paper, isSaved };
    });
  }, [rawPapers, saveOverrides]);

  const alerts = useMemo<ApiAlert[]>(() => {
    return rawAlerts.map((alert) => {
      const isRead = alertReadOverrides.has(alert.id)
        ? (alertReadOverrides.get(alert.id) as boolean)
        : alert.isRead;
      return { ...alert, isRead };
    });
  }, [rawAlerts, alertReadOverrides]);

  // One-shot server-side search (not part of polling)
  const searchPapers = useCallback(async (query: string): Promise<ApiPaper[]> => {
    try {
      const res = await fetch(`/api/data/microscholar-papers?search=${encodeURIComponent(query)}`);
      if (!res.ok) return [];
      const data = await res.json();
      return data.papers ?? [];
    } catch {
      return [];
    }
  }, []);

  const advancedSearchPapers = useCallback(async (params: AdvancedSearchParams): Promise<ApiPaper[]> => {
    try {
      const urlParams = new URLSearchParams({ advanced: "true" });
      if (params.allWords) urlParams.set("allWords", params.allWords);
      if (params.exactPhrase) urlParams.set("exactPhrase", params.exactPhrase);
      if (params.atLeastOne) urlParams.set("atLeastOne", params.atLeastOne);
      if (params.without) urlParams.set("without", params.without);
      if (params.author) urlParams.set("author", params.author);
      if (params.publication) urlParams.set("publication", params.publication);
      if (params.dateStart) urlParams.set("dateStart", params.dateStart);
      if (params.dateEnd) urlParams.set("dateEnd", params.dateEnd);
      const res = await fetch(`/api/data/microscholar-papers?${urlParams.toString()}`);
      if (!res.ok) return [];
      const data = await res.json();
      return data.papers ?? [];
    } catch {
      return [];
    }
  }, []);

  // Mutation helpers
  const citePaper = useCallback(async (paperId: string) => {
    await fetch(`/api/data/microscholar-papers/${paperId}/cite`, { method: "POST" }).catch(() => {});
  }, []);

  const savePaper = useCallback(async (paperId: string) => {
    const current = rawPapers.find((p) => p.id === paperId);
    const currentSaved = saveOverrides.has(paperId)
      ? (saveOverrides.get(paperId) as boolean)
      : current?.isSaved ?? false;
    setSaveOverrides((prev) => new Map(prev).set(paperId, !currentSaved));
    await fetch(`/api/data/microscholar-papers/${paperId}/save`, { method: "POST" }).catch(() => {});
  }, [rawPapers, saveOverrides]);

  const markAlertRead = useCallback(async (alertId: string) => {
    setAlertReadOverrides((prev) => new Map(prev).set(alertId, true));
    await fetch(`/api/data/microscholar-alerts/${alertId}/read`, { method: "POST" }).catch(() => {});
  }, []);

  return {
    papers,
    alerts,
    coauthors,
    config,
    users,
    isLoading,
    error,
    citePaper,
    savePaper,
    markAlertRead,
    searchPapers,
    advancedSearchPapers,
  };
}
