import { useCallback, useEffect, useRef, useState } from "react";

// ---------------------------------------------------------------------------
// API response types
// ---------------------------------------------------------------------------

export interface ApiTaskConfig {
  environment: string;
  duration: number;
  selfUser?: any;
}

export interface ApiRepository {
  id: string;
  owner: string;
  ownerType: string;
  name: string;
  fullName: string;
  description: string;
  isPrivate: boolean;
  isFork: boolean;
  stars: number;
  forks: number;
  watchers: number;
  openIssues: number;
  language: string;
  languageColor: string;
  languages: { name: string; percentage: number; color: string }[];
  license: string;
  defaultBranch: string;
  branches: string[];
  tags: string[];
  topics: string[];
  websiteUrl?: string;
  commits: number;
  isStarred: boolean;
  isWatched: boolean;
  isForked: boolean;
}

export interface ApiFile {
  id: string;
  name: string;
  path: string;
  type: "file" | "folder";
  parentId: string | null;
  size?: number;
  language?: string;
  lastCommit: { sha: string; message: string };
  content?: string;
  order: number;
}

export interface ApiIssue {
  id: string;
  number: number;
  title: string;
  body: string;
  state: "open" | "closed";
  author: string;
  authorId: string;
  assignees: string[];
  labelIds: string[];
  comments: ApiComment[];
  milestone?: string;
  order: number;
}

export interface ApiComment {
  id: string;
  author: string;
  authorId?: string;
  body: string;
  reactions?: { emoji: string; count: number }[];
  order: number;
}

export interface ApiPullRequest {
  id: string;
  number: number;
  title: string;
  body: string;
  state: "open" | "closed" | "merged";
  author: string;
  authorId: string;
  assignees: string[];
  reviewers: string[];
  labelIds: string[];
  sourceBranch: string;
  targetBranch: string;
  commits: number;
  additions: number;
  deletions: number;
  filesChanged: number;
  reviewStatus: string;
  checks: { name: string; status: string }[];
  comments: ApiComment[];
  order: number;
}

export interface ApiCommit {
  id: string;
  sha: string;
  message: string;
  description?: string;
  author: string;
  authorId: string;
  branch: string;
  additions: number;
  deletions: number;
  filesChanged: string[];
  verified: boolean;
  order: number;
}

export interface ApiWorkflowRun {
  id: string;
  workflowId: string;
  workflowName: string;
  runNumber: number;
  status: string;
  conclusion: string | null;
  branch: string;
  commit: { sha: string; message: string };
  actor: string;
  actorId: string;
  event: string;
  duration: number | null;
  jobs: {
    id: string;
    name: string;
    status: string;
    conclusion: string | null;
    steps: { name: string; status: string; conclusion: string | null; duration?: number }[];
    duration?: number;
  }[];
  order: number;
}

export interface ApiWorkflow {
  id: string;
  name: string;
  path: string;
  state: string;
}

export interface ApiWikiPage {
  id: string;
  title: string;
  slug: string;
  content: string;
  lastEditedBy: string;
  lastEditedById: string;
  order: number;
}

export interface ApiProject {
  id: string;
  name: string;
  description: string;
  state: string;
  creator: string;
  creatorId: string;
  columns: {
    id: string;
    name: string;
    cards: { id: string; type: string; contentId?: string; note?: string; order: number }[];
    order: number;
  }[];
  order: number;
}

export interface ApiActivity {
  id: string;
  type: string;
  actor: string;
  actorId: string;
  repo: string;
  payload: Record<string, unknown>;
  order: number;
}

export interface ApiInsight {
  id: string;
  type: string;
  data: unknown;
}

export interface ApiRelease {
  id: string;
  tagName: string;
  name: string;
  body: string;
  author: string;
  authorId: string;
  isLatest: boolean;
  isPrerelease: boolean;
  assets: { name: string; size: string; downloads: number }[];
  order: number;
}

export interface ApiLabel {
  id: string;
  name: string;
  color: string;
  description: string;
  order: number;
}

export interface ApiSecurityAdvisory {
  id: string;
  severity: string;
  title: string;
  description: string;
  package: string;
  vulnerableVersions: string;
  patchedVersions: string;
  state: string;
  cveId?: string;
  order: number;
}

export interface ApiCodeScanAlert {
  id: string;
  rule: string;
  severity: string;
  description: string;
  file: string;
  line: number;
  state: string;
  order: number;
}

export interface ApiDeployment {
  id: string;
  environment: string;
  status: string;
  url: string;
  creator: string;
  order: number;
}

export interface ApiPackage {
  id: string;
  name: string;
  type: string;
  version: string;
  downloads: number;
  order: number;
}

// ---------------------------------------------------------------------------
// Hook
// ---------------------------------------------------------------------------

export function useMicrohubData() {
  // Dynamic data (polled)
  const [repository, setRepository] = useState<ApiRepository | null>(null);
  const [issues, setIssues] = useState<ApiIssue[]>([]);
  const [pulls, setPulls] = useState<ApiPullRequest[]>([]);
  const [runs, setRuns] = useState<ApiWorkflowRun[]>([]);
  const [activity, setActivity] = useState<ApiActivity[]>([]);
  const [projects, setProjects] = useState<ApiProject[]>([]);
  const [followingUsernames, setFollowingUsernames] = useState<string[]>([]);

  // Static data (fetched once)
  const [files, setFiles] = useState<ApiFile[]>([]);
  const [commits, setCommits] = useState<ApiCommit[]>([]);
  const [workflows, setWorkflows] = useState<ApiWorkflow[]>([]);
  const [wiki, setWiki] = useState<ApiWikiPage[]>([]);
  const [insights, setInsights] = useState<ApiInsight[]>([]);
  const [releases, setReleases] = useState<ApiRelease[]>([]);
  const [labels, setLabels] = useState<ApiLabel[]>([]);
  const [security, setSecurity] = useState<ApiSecurityAdvisory[]>([]);
  const [codeScanning, setCodeScanning] = useState<ApiCodeScanAlert[]>([]);
  const [settings, setSettings] = useState<Record<string, unknown> | null>(null);
  const [deployments, setDeployments] = useState<ApiDeployment[]>([]);
  const [packages, setPackages] = useState<ApiPackage[]>([]);
  const [users, setUsers] = useState<Record<string, unknown>>({});

  const [config, setConfig] = useState<ApiTaskConfig | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const configLoaded = useRef(false);
  const staticLoaded = useRef(false);
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
          if (data.environment !== "microhub") {
            mismatch.current = true;
            setError(
              `Environment mismatch: server is running "${data.environment}" but this is the MicroHub UI.`
            );
            setIsLoading(false);
            return;
          }
          configLoaded.current = true;
          setConfig(data);
        })
        .catch(() => {});
    }

    // Fetch static data once
    if (!staticLoaded.current) {
      Promise.all([
        fetch("/api/data/microhub-files").then((r) => r.ok ? r.json() : null),
        fetch("/api/data/microhub-commits").then((r) => r.ok ? r.json() : null),
        fetch("/api/data/microhub-workflows").then((r) => r.ok ? r.json() : null),
        fetch("/api/data/microhub-wiki").then((r) => r.ok ? r.json() : null),
        fetch("/api/data/microhub-insights").then((r) => r.ok ? r.json() : null),
        fetch("/api/data/microhub-releases").then((r) => r.ok ? r.json() : null),
        fetch("/api/data/microhub-labels").then((r) => r.ok ? r.json() : null),
        fetch("/api/data/microhub-security").then((r) => r.ok ? r.json() : null),
        fetch("/api/data/microhub-code-scanning").then((r) => r.ok ? r.json() : null),
        fetch("/api/data/microhub-settings").then((r) => r.ok ? r.json() : null),
        fetch("/api/data/microhub-deployments").then((r) => r.ok ? r.json() : null),
        fetch("/api/data/microhub-packages").then((r) => r.ok ? r.json() : null),
        fetch("/api/data/microhub-users").then((r) => r.ok ? r.json() : null),
      ])
        .then(([
          filesData, commitsData, workflowsData, wikiData, insightsData,
          releasesData, labelsData, securityData, scanningData, settingsData,
          deploymentsData, packagesData, usersData,
        ]) => {
          if (filesData) setFiles(filesData.files ?? []);
          if (commitsData) setCommits(commitsData.commits ?? []);
          if (workflowsData) setWorkflows(workflowsData.workflows ?? []);
          if (wikiData) setWiki(wikiData.pages ?? []);
          if (insightsData) setInsights(insightsData.insights ?? []);
          if (releasesData) setReleases(releasesData.releases ?? []);
          if (labelsData) setLabels(labelsData.labels ?? []);
          if (securityData) setSecurity(securityData.advisories ?? []);
          if (scanningData) setCodeScanning(scanningData.alerts ?? []);
          if (settingsData) setSettings(settingsData.settings ?? null);
          if (deploymentsData) setDeployments(deploymentsData.deployments ?? []);
          if (packagesData) setPackages(packagesData.packages ?? []);
          if (usersData) {
            const userMap: Record<string, unknown> = {};
            for (const u of usersData.users ?? []) {
              (userMap as Record<string, unknown>)[(u as { id: string }).id] = u;
            }
            setUsers(userMap);
          }
          staticLoaded.current = true;
        })
        .catch(() => {});
    }

    // Poll dynamic data
    Promise.all([
      fetch("/api/data/microhub-repository").then((r) => {
        if (!r.ok) throw new Error(`Repository fetch failed: ${r.status}`);
        return r.json();
      }),
      fetch("/api/data/microhub-issues").then((r) => {
        if (!r.ok) throw new Error(`Issues fetch failed: ${r.status}`);
        return r.json();
      }),
      fetch("/api/data/microhub-pulls").then((r) => {
        if (!r.ok) throw new Error(`Pulls fetch failed: ${r.status}`);
        return r.json();
      }),
      fetch("/api/data/microhub-runs").then((r) => {
        if (!r.ok) throw new Error(`Runs fetch failed: ${r.status}`);
        return r.json();
      }),
      fetch("/api/data/microhub-activity").then((r) => {
        if (!r.ok) throw new Error(`Activity fetch failed: ${r.status}`);
        return r.json();
      }),
      fetch("/api/data/microhub-projects").then((r) => {
        if (!r.ok) throw new Error(`Projects fetch failed: ${r.status}`);
        return r.json();
      }),
      fetch("/api/data/microhub-following").then((r) => {
        if (!r.ok) throw new Error(`Following fetch failed: ${r.status}`);
        return r.json();
      }),
    ])
      .then(([repoData, issuesData, pullsData, runsData, activityData, projectsData, followingData]) => {
        setRepository(repoData.repository ?? null);
        setIssues(issuesData.issues ?? []);
        setPulls(pullsData.prs ?? []);
        setRuns(runsData.runs ?? []);
        setActivity(activityData.activity ?? []);
        setProjects(projectsData.projects ?? []);
        setFollowingUsernames(followingData.following ?? []);
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
  const starRepo = useCallback(async () => {
    await fetch("/api/data/microhub-repository/star", { method: "POST" }).catch(() => {});
  }, []);

  const watchRepo = useCallback(async () => {
    await fetch("/api/data/microhub-repository/watch", { method: "POST" }).catch(() => {});
  }, []);

  const forkRepo = useCallback(async () => {
    await fetch("/api/data/microhub-repository/fork", { method: "POST" }).catch(() => {});
  }, []);

  const mergePR = useCallback(async (prId: string, strategy: string = "merge") => {
    const res = await fetch(`/api/data/microhub-pulls/${prId}/merge`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ strategy }),
    }).catch(() => null);
    if (!res) return { success: false };
    return res.json();
  }, []);

  const commentOnIssue = useCallback(async (issueId: string, body: string) => {
    const res = await fetch(`/api/data/microhub-issues/${issueId}/comment`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ body }),
    }).catch(() => null);
    if (!res) return { success: false };
    return res.json();
  }, []);

  const commentOnPR = useCallback(async (prId: string, body: string) => {
    const res = await fetch(`/api/data/microhub-pulls/${prId}/comment`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ body }),
    }).catch(() => null);
    if (!res) return { success: false };
    return res.json();
  }, []);

  const closeIssue = useCallback(async (issueId: string) => {
    const res = await fetch(`/api/data/microhub-issues/${issueId}/close`, {
      method: "POST",
    }).catch(() => null);
    if (!res) return { success: false };
    return res.json();
  }, []);

  const followUser = useCallback(async (username: string) => {
    await fetch(`/api/data/microhub-users/${username}/follow`, {
      method: "POST",
    }).catch(() => {});
  }, []);

  const performAction = useCallback(async (action: string) => {
    const res = await fetch(`/api/data/actions/${action}`, {
      method: "POST",
    }).catch(() => null);
    if (!res) return { success: false };
    return res.json();
  }, []);

  return {
    // Dynamic
    repository,
    issues,
    pulls,
    runs,
    activity,
    projects,
    followingUsernames,
    // Static
    files,
    commits,
    workflows,
    wiki,
    insights,
    releases,
    labels,
    security,
    codeScanning,
    settings,
    deployments,
    packages,
    users,
    // Meta
    config,
    isLoading,
    error,
    // Mutations
    starRepo,
    watchRepo,
    forkRepo,
    mergePR,
    commentOnIssue,
    commentOnPR,
    closeIssue,
    followUser,
    performAction,
  };
}
