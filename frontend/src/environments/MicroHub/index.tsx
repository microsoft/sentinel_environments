import { useState, useEffect, useMemo, useCallback } from "react";
import { useHashRoute } from "../../hooks/useHashRoute";
import {
  GitFork,
  GitPullRequest,
  Star,
  Eye,
  Code,
  CircleDot,
  Play,
  Table2,
  BookOpen,
  Shield,
  BarChart3,
  ChevronDown,
  XCircle,
  Lock,
  Globe,
  Building2,
} from "lucide-react";

import { useMicrohubData } from "../../hooks/useMicrohubData";
import type { ApiFile, ApiIssue, ApiPullRequest, ApiHubUser } from "../../hooks/useMicrohubData";
import { classNames } from "./utils";
import {
  ThemeProvider,
  MicroHubDataProvider,
  MicroHubUIProvider,
  useTheme,
  useMicrohubCtx,
  useMicrohubUI,
} from "./contexts";
import type {
  ThemeContextValue,
  MicroHubDataContextValue,
  MicroHubUIContextValue,
  MicroHubNotification,
  EditableProfileDraft,
} from "./contexts";
import { Header } from "./components/Header";
import { CommandPalette } from "./components/CommandPalette";
import { ProfileView } from "./components/ProfileView";
import { SettingsView } from "./components/SettingsView";
import { FileBrowser } from "./components/FileBrowser";
import { FileView } from "./components/FileView";
import { CommitsView } from "./components/CommitsView";
import { IssuesList } from "./components/IssuesList";
import { IssueDetail } from "./components/IssueDetail";
import { PullRequestsList } from "./components/PullRequestsList";
import { PRDetail } from "./components/PRDetail";
import { ActionsView } from "./components/ActionsView";
import { ProjectsView } from "./components/ProjectsView";
import { WikiView } from "./components/WikiView";
import { SecurityView } from "./components/SecurityView";
import { InsightsView } from "./components/InsightsView";

// ============================================================================
// LOCAL TYPE DEFINITIONS (extending UserProfile with microhub data)
// ============================================================================

interface MicroHubAchievement {
  id: string;
  name: string;
  icon: string;
  description: string;
  earnedDate: string;
}

export type { MicroHubAchievement };

export interface MicroHubUser {
  id: string;
  isSelf?: boolean;
  name: string;
  username: string;
  email: string;
  avatarUrl: string;
  bio: string;
  jobTitle?: string;
  location: string;
  company?: string;
  website?: string;
  followers: number;
  following: number;
  joinedDate: string;
  pinnedRepos?: string[];
  achievements?: MicroHubAchievement[];
  contributionData?: number[];
}

export type RepoFile = ApiFile & { children?: RepoFile[] };

// Build tree structure from flat file list
const buildFileTree = (flatFiles: ApiFile[]): RepoFile[] => {
  const fileMap = new Map<string, RepoFile>();
  const rootFiles: RepoFile[] = [];

  // First pass: create map and initialize children arrays
  flatFiles.forEach(file => {
    fileMap.set(file.id, { ...file, children: file.type === 'folder' ? [] : undefined });
  });

  // Second pass: build tree structure
  flatFiles.forEach(file => {
    const node = fileMap.get(file.id)!;
    if (file.parentId === null) {
      rootFiles.push(node);
    } else {
      const parent = fileMap.get(file.parentId);
      if (parent && parent.children) {
        parent.children.push(node);
      }
    }
  });

  // Sort by order
  const sortByOrder = (files: RepoFile[]): RepoFile[] => {
    return files.sort((a, b) => a.order - b.order).map(f => ({
      ...f,
      children: f.children ? sortByOrder(f.children) : undefined
    }));
  };

  return sortByOrder(rootFiles);
};

export const TASK_ID_MICROHUB = "microhub";

// ============================================================================
// TYPE DEFINITIONS
// ============================================================================

export type ViewType = "code" | "issues" | "pulls" | "actions" | "projects" | "wiki" | "security" | "insights" | "issue-detail" | "pr-detail" | "settings" | "profile" | "file-view" | "commits";
export type IssueState = "open" | "closed" | "all";
export type SortOption = "newest" | "oldest" | "most-commented" | "recently-updated";


// ============================================================================
// UTILITY FUNCTIONS
// ============================================================================
//
// classNames, computeRelativeTimestamp, escapeHtml, and highlightCode all
// live in ./utils so extracted child components under ./components/ can
// reuse them without creating a runtime cycle through index.tsx.

// ============================================================================
// MODULE-SCOPE COMPONENTS
// ============================================================================
//
// IMPORTANT: Components rendered as <X /> JSX must live at module scope.
// Defining them inside MicroHub() makes their function identity change on
// every parent render — React then unmounts/remounts their entire DOM
// subtree on each render. With useMicrohubData polling every 1s, that
// remount churn destroys DOM identity for click targets like the Issues
// tab below, breaking browser-agent screenshot→click flows.

const RepoHeader = () => {
  const { theme } = useTheme();
  const { repository, openIssuesCount, openPRsCount } = useMicrohubCtx();
  const {
    currentView,
    setRoute,
    handleViewProfile,
    handleWatchToggle,
    handleFork,
    handleStarToggle,
  } = useMicrohubUI();

  // Defensive: parent's success path (line ~3223 early-returns when repository
  // is null) means RepoHeader is only mounted with a non-null repository,
  // but the context exposes it as nullable.
  if (!repository) return null;

  return (
    <div className={classNames("border-b px-4 py-4", theme.bgSecondary, theme.border)}>
      <div className="flex items-center space-x-2 text-sm mb-3">
        <Building2 className={classNames("w-4 h-4", theme.textSecondary)} />
        <a href="#" className="text-blue-500 hover:underline" onClick={(e) => { e.preventDefault(); handleViewProfile(repository.owner); }}>
          {repository.owner}
        </a>
        <span className={theme.textMuted}>/</span>
        <a href="#" className="text-blue-500 hover:underline font-semibold" onClick={(e) => { e.preventDefault(); setRoute("code"); }}>
          {repository.name}
        </a>
        <span className={classNames("px-2 py-0.5 text-xs border rounded-full", theme.border, theme.textSecondary)}>
          {repository.isPrivate ? (
            <><Lock className="w-3 h-3 inline mr-1" />Private</>
          ) : (
            <><Globe className="w-3 h-3 inline mr-1" />Public</>
          )}
        </span>
      </div>

      <div className="flex items-center justify-between flex-wrap gap-2">
        <div className="flex items-center space-x-2">
          <div className="flex items-center">
            <button
              onClick={handleWatchToggle}
              className={classNames(
                "flex items-center space-x-1 px-3 py-1 text-sm border rounded-l-md",
                theme.bgTertiary, theme.border, theme.text,
                repository.isWatched ? "border-blue-500" : theme.hover
              )}
            >
              <Eye className="w-4 h-4" />
              <span>{repository.isWatched ? "Unwatch" : "Watch"}</span>
              <ChevronDown className="w-3 h-3" />
            </button>
            <span className={classNames("px-2 py-1 text-sm border border-l-0 rounded-r-md", theme.bgTertiary, theme.border)}>
              {repository.watchers}
            </span>
          </div>

          <div className="flex items-center">
            <button
              onClick={handleFork}
              className={classNames(
                "flex items-center space-x-1 px-3 py-1 text-sm border rounded-l-md",
                theme.bgTertiary, theme.border, theme.text,
                repository.isForked ? "border-green-500 text-green-600" : theme.hover
              )}
              disabled={repository.isForked}
            >
              <GitFork className="w-4 h-4" />
              <span>{repository.isForked ? "Forked" : "Fork"}</span>
            </button>
            <span className={classNames("px-2 py-1 text-sm border border-l-0 rounded-r-md", theme.bgTertiary, theme.border)}>
              {repository.forks}
            </span>
          </div>

          <div className="flex items-center">
            <button
              onClick={handleStarToggle}
              className={classNames(
                "flex items-center space-x-1 px-3 py-1 text-sm border rounded-l-md",
                theme.bgTertiary, theme.border, theme.text,
                repository.isStarred ? "border-yellow-500 text-yellow-600" : theme.hover
              )}
            >
              <Star className={classNames("w-4 h-4", repository.isStarred && "fill-yellow-400")} />
              <span>{repository.isStarred ? "Starred" : "Star"}</span>
            </button>
            <span className={classNames("px-2 py-1 text-sm border border-l-0 rounded-r-md", theme.bgTertiary, theme.border)}>
              {repository.stars.toLocaleString()}
            </span>
          </div>
        </div>
      </div>

      <nav className="flex items-center space-x-1 mt-4 overflow-x-auto">
        {[
          { key: "code", label: "Code", icon: Code },
          { key: "issues", label: "Issues", icon: CircleDot, count: openIssuesCount },
          { key: "pulls", label: "Pull requests", icon: GitPullRequest, count: openPRsCount },
          { key: "actions", label: "Actions", icon: Play },
          { key: "projects", label: "Projects", icon: Table2 },
          { key: "wiki", label: "Wiki", icon: BookOpen },
          { key: "security", label: "Security", icon: Shield },
          { key: "insights", label: "Insights", icon: BarChart3 },
        ].map((tab) => (
          <button
            key={tab.key}
            onClick={() => { setRoute(tab.key as ViewType); }}
            className={classNames(
              "flex items-center space-x-1 px-3 py-2 text-sm rounded-md whitespace-nowrap",
              currentView === tab.key || (tab.key === "code" && currentView === "file-view") || (tab.key === "issues" && currentView === "issue-detail") || (tab.key === "pulls" && currentView === "pr-detail")
                ? classNames(theme.bgTertiary, theme.text, "border-b-2 border-orange-500")
                : classNames(theme.textSecondary, theme.hover)
            )}
          >
            <tab.icon className="w-4 h-4" />
            <span>{tab.label}</span>
            {tab.count !== undefined && (
              <span className={classNames("ml-1 px-1.5 py-0.5 text-xs rounded-full", theme.badge)}>{tab.count}</span>
            )}
          </button>
        ))}
      </nav>
    </div>
  );
};

// ============================================================================
// MAIN COMPONENT
// ============================================================================

const MicroHub = () => {
  // API hook
  const {
    repository, issues, pulls, runs, activity, projects, followingUsernames,
    files, commits, workflows, wiki, insights, releases, labels, security,
    codeScanning, settings, deployments, packages, users, userCreatedRepos,
    config, isLoading, error,
    starRepo, watchRepo, forkRepo, updateRepo, mergePR, commentOnIssue, commentOnPR,
    closeIssue, followUser, createRepo, createIssue,
  } = useMicrohubData();

  // Derive users into MicroHubUser[]
  const microhubUsers = useMemo<MicroHubUser[]>(() => {
    return Object.values(users)
      .filter((u): u is ApiHubUser & { microhub: NonNullable<ApiHubUser['microhub']> } => !!u.microhub)
      .map(u => ({
        id: u.id,
        isSelf: u.isSelf,
        name: u.name,
        username: u.username,
        email: u.email,
        avatarUrl: u.avatarUrl,
        bio: u.bio ?? "",
        jobTitle: u.jobTitle,
        location: u.location ?? "",
        company: u.microhub?.company,
        website: u.microhub?.website,
        followers: u.microhub?.followers ?? 0,
        following: u.microhub?.following ?? 0,
        joinedDate: u.microhub?.joinedDate ?? "",
        pinnedRepos: u.microhub?.pinnedRepos,
        achievements: u.microhub?.achievements,
        contributionData: u.microhub?.contributionData,
      }));
  }, [users]);

  const selfUser = useMemo<MicroHubUser | undefined>(() => {
    const selfId = config?.selfUser?.id;
    const resolved = (selfId ? microhubUsers.find((u) => u.id === selfId) : undefined) ?? microhubUsers.find((u) => u.isSelf);
    if (resolved) return resolved;

    const raw = config?.selfUser;
    if (!raw) return undefined;
    return {
      id: raw.id,
      isSelf: true,
      name: raw.name,
      username: raw.username,
      email: raw.email,
      avatarUrl: raw.avatarUrl,
      bio: raw.bio ?? "",
      jobTitle: raw.jobTitle ?? "",
      location: raw.location ?? "",
      followers: raw.microhub?.followers ?? 0,
      following: raw.microhub?.following ?? 0,
      joinedDate: raw.microhub?.joinedDate ?? "",
    };
  }, [config?.selfUser, microhubUsers]);
  const getUserByUsername = useCallback((username: string) => microhubUsers.find(u => u.username === username), [microhubUsers]);

  // Build file tree from flat files
  const fileTree = useMemo(() => buildFileTree(files), [files]);

  const getFileByPath = useCallback((path: string, fls: RepoFile[] = fileTree): RepoFile | undefined => {
    for (const file of fls) {
      if (file.path === path) return file;
      if (file.children) {
        const found = getFileByPath(path, file.children);
        if (found) return found;
      }
    }
    return undefined;
  }, [fileTree]);

  const getLabelsByIds = useCallback((labelIds: string[]) =>
    labelIds.map(id => labels.find(l => l.id === id)).filter(Boolean), [labels]);

  // UI-only state
  const [startTime] = useState(Date.now());
  const [route, setRoute] = useHashRoute<ViewType>(["code", "issues", "pulls", "actions", "projects", "wiki", "security", "insights", "issue-detail", "pr-detail", "settings", "profile", "file-view", "commits"] as const, "code");
  const currentView = route.view;
  const selectedIssueId = currentView === "issue-detail" ? route.id : null;
  const selectedPRId = currentView === "pr-detail" ? route.id : null;
  const selectedFilePath = currentView === "file-view" ? route.id : null;
  const viewingProfileUsername = currentView === "profile" ? route.id : null;
  const [isLoggedIn] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [issueFilter, setIssueFilter] = useState<IssueState>("open");
  const [issueSort, setIssueSort] = useState<SortOption>("newest");
  const [prFilter, setPrFilter] = useState<IssueState>("open");
  const [prSort] = useState<SortOption>("newest");
  const [selectedBranch, setSelectedBranch] = useState("main");
  const [isSignedOut, setIsSignedOut] = useState(false);
  const [expandedFolders, setExpandedFolders] = useState<string[]>([]);
  const [darkMode, setDarkMode] = useState(false);
  const [newCommentText, setNewCommentText] = useState("");

  // Set selectedBranch from repository when it arrives
  useEffect(() => {
    if (repository?.defaultBranch) {
      setSelectedBranch(repository.defaultBranch);
    }
  }, [repository?.defaultBranch]);

  // View-specific state (lifted to prevent reset on re-render)
  const [selectedWorkflow, setSelectedWorkflow] = useState<string | null>(null);
  const [selectedWorkflowRun, setSelectedWorkflowRun] = useState<string | null>(null);
  const [securityActiveTab, setSecurityActiveTab] = useState<"advisories" | "code-scanning">("advisories");
  const [selectedProject, setSelectedProject] = useState<string | null>(null);
  const [selectedWikiPage, setSelectedWikiPage] = useState<string>("");
  const [mergeDropdownOpen, setMergeDropdownOpen] = useState(false);
  const [selectedMergeMethod, setSelectedMergeMethod] = useState<"merge" | "squash" | "rebase">("merge");
  const [expandedReleases, setExpandedReleases] = useState(false);
  const [expandedDeployments, setExpandedDeployments] = useState(false);
  const [createMenuOpen, setCreateMenuOpen] = useState(false);
  const [inboxOpen, setInboxOpen] = useState(false);
  const [editProfileOpen, setEditProfileOpen] = useState(false);
  const [hoveredContribution, setHoveredContribution] = useState<{week: number; day: number; count: number; x: number; y: number} | null>(null);

  // Set initial project/wiki selections when data arrives
  useEffect(() => { if (projects.length > 0 && !selectedProject) setSelectedProject(projects[0].id); }, [projects, selectedProject]);
  useEffect(() => { if (wiki.length > 0 && !selectedWikiPage) setSelectedWikiPage(wiki[0].id); }, [wiki, selectedWikiPage]);

  // Editable profile data (for self user)
  const [editedProfile, setEditedProfile] = useState<EditableProfileDraft | null>(null);

  // New issue/PR creation state
  const [newIssueModalOpen, setNewIssueModalOpen] = useState(false);
  const [newPRModalOpen, setNewPRModalOpen] = useState(false);
  const [newRepoModalOpen, setNewRepoModalOpen] = useState(false);
  const [importRepoModalOpen, setImportRepoModalOpen] = useState(false);
  const [newIssueTitle, setNewIssueTitle] = useState("");
  const [newIssueBody, setNewIssueBody] = useState("");
  const [newPRTitle, setNewPRTitle] = useState("");
  const [newPRBody, setNewPRBody] = useState("");
  const [newPRSourceBranch, setNewPRSourceBranch] = useState("");
  const [newPRTargetBranch, setNewPRTargetBranch] = useState("main");
  const [userCreatedIssues, setUserCreatedIssues] = useState<ApiIssue[]>([]);
  const [userCreatedPRs, setUserCreatedPRs] = useState<ApiPullRequest[]>([]);
  const [newRepoName, setNewRepoName] = useState("");
  const [newRepoDescription, setNewRepoDescription] = useState("");
  const [newRepoVisibility, setNewRepoVisibility] = useState<"public" | "private">("public");
  const [newRepoReadme, setNewRepoReadme] = useState(false);
  const [newRepoGitignore, setNewRepoGitignore] = useState(false);
  const [newRepoSubmitting, setNewRepoSubmitting] = useState(false);

  // Dropdowns
  const [branchDropdownOpen, setBranchDropdownOpen] = useState(false);
  const [userMenuOpen, setUserMenuOpen] = useState(false);
  const [notificationsOpen, setNotificationsOpen] = useState(false);
  const [headerDropdown, setHeaderDropdown] = useState<string | null>(null);
  const [codeDropdownOpen, setCodeDropdownOpen] = useState(false);
  const [sortDropdownOpen, setSortDropdownOpen] = useState(false);
  const [commandPaletteOpen, setCommandPaletteOpen] = useState(false);
  const [sideMenuOpen, setSideMenuOpen] = useState(false);
  const [toast, setToast] = useState<{ message: string; type: "info" | "success" | "warning" } | null>(null);

  // Notifications (simple state)
  const [notifications, setNotifications] = useState<MicroHubNotification[]>([
    { id: "n1", title: "PR #167 approved by palves", read: false, type: "pr", targetId: "pr1" },
    { id: "n2", title: "New comment on issue #156", read: false, type: "issue", targetId: "i1" },
    { id: "n3", title: "Release v2.1.0 published", read: true, type: "release", targetId: null },
  ]);

  const handleNotificationClick = useCallback((notification: MicroHubNotification) => {
    // Mark as read
    setNotifications(prev => prev.map(n => n.id === notification.id ? { ...n, read: true } : n));
    setNotificationsOpen(false);

    // Navigate based on type
    if (notification.type === "pr" && notification.targetId) {
      setRoute("pr-detail", notification.targetId);
    } else if (notification.type === "issue" && notification.targetId) {
      setRoute("issue-detail", notification.targetId);
    }
  }, [setRoute]);

  // Keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === "k") {
        e.preventDefault();
        setCommandPaletteOpen(prev => !prev);
      }
      if (e.key === "Escape") {
        setCommandPaletteOpen(false);
        setBranchDropdownOpen(false);
        setUserMenuOpen(false);
        setNotificationsOpen(false);
        setCodeDropdownOpen(false);
        setSortDropdownOpen(false);
        setCreateMenuOpen(false);
        setInboxOpen(false);
        setEditProfileOpen(false);
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, []);

  // Close header dropdown when clicking outside
  useEffect(() => {
    if (!headerDropdown) return;
    const handleClickOutside = (e: MouseEvent) => {
      const target = e.target as HTMLElement;
      if (!target.closest('nav')) {
        setHeaderDropdown(null);
      }
    };
    document.addEventListener('click', handleClickOutside);
    return () => document.removeEventListener('click', handleClickOutside);
  }, [headerDropdown]);

  // Event handlers
  const handleStarToggle = useCallback(() => {
    starRepo();
  }, [starRepo]);

  const handleWatchToggle = useCallback(() => {
    watchRepo();
  }, [watchRepo]);

  const handleFork = useCallback(() => {
    forkRepo();
  }, [forkRepo]);

  const handleViewProfile = useCallback((username: string) => {
    setRoute("profile", username);
  }, [setRoute]);

  const handleViewFile = useCallback((path: string) => {
    setRoute("file-view", path);
  }, [setRoute]);

  const toggleFolder = useCallback((path: string) => {
    setExpandedFolders(prev =>
      prev.includes(path) ? prev.filter(p => p !== path) : [...prev, path]
    );
  }, []);

  const handleMergePR = useCallback((prId: string) => {
    mergePR(prId, selectedMergeMethod);
  }, [mergePR, selectedMergeMethod]);

  // Theme colors - white mode (default) vs dark mode
  const theme = useMemo(() => ({
    // Main backgrounds
    bg: darkMode ? "bg-[#0d1117]" : "bg-white",
    bgSecondary: darkMode ? "bg-[#161b22]" : "bg-gray-50",
    bgTertiary: darkMode ? "bg-[#21262d]" : "bg-gray-100",
    bgHeader: darkMode ? "bg-[#161b22]" : "bg-gray-900",
    // Text colors
    text: darkMode ? "text-white" : "text-gray-900",
    textSecondary: darkMode ? "text-gray-400" : "text-gray-600",
    textMuted: darkMode ? "text-gray-500" : "text-gray-400",
    // Borders
    border: darkMode ? "border-gray-700" : "border-gray-200",
    borderLight: darkMode ? "border-gray-800" : "border-gray-100",
    // Interactive
    hover: darkMode ? "hover:bg-gray-800" : "hover:bg-gray-100",
    hoverSecondary: darkMode ? "hover:bg-gray-700" : "hover:bg-gray-200",
    // Inputs
    inputBg: darkMode ? "bg-[#0d1117]" : "bg-white",
    // Code blocks
    codeBg: darkMode ? "bg-[#161b22]" : "bg-gray-50",
    // Specific colors for contribution graph
    contribEmpty: darkMode ? "#161b22" : "#ebedf0",
    // Badge/count styling
    badge: darkMode ? "bg-gray-700 text-gray-300" : "bg-gray-200 text-gray-700",
    // Topic tag styling
    topicBg: darkMode ? "bg-blue-900/30 text-blue-400 hover:bg-blue-900/50" : "bg-blue-100 text-blue-700 hover:bg-blue-200",
  }), [darkMode]);

  // Combine API issues/pulls with locally-created ones
  const allIssues = useMemo(() => {
    // Server's /microhub-issues already merges user-created issues from the session;
    // dedupe so local-optimistic entries don't show up twice after the next poll.
    const seen = new Set(issues.map(i => i.id));
    const extras = userCreatedIssues.filter(i => !seen.has(i.id));
    return [...extras, ...issues];
  }, [userCreatedIssues, issues]);
  const allPRs = useMemo(() => [...userCreatedPRs, ...pulls], [userCreatedPRs, pulls]);

  // Filtered and sorted data
  const filteredIssues = useMemo(() => {
    let filtered = [...allIssues];
    if (issueFilter !== "all") {
      filtered = filtered.filter(i => i.state === issueFilter);
    }
    if (searchQuery) {
      filtered = filtered.filter(i =>
        i.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
        i.body.toLowerCase().includes(searchQuery.toLowerCase())
      );
    }
    return filtered.sort((a, b) => {
      switch (issueSort) {
        case "oldest":
          return a.number - b.number;
        case "most-commented":
          return b.comments.length - a.comments.length;
        default:
          return b.number - a.number;
      }
    });
  }, [issueFilter, issueSort, searchQuery, allIssues]);

  const filteredPRs = useMemo(() => {
    let filtered = [...allPRs];
    if (prFilter !== "all") {
      filtered = filtered.filter(pr => pr.state === prFilter || (prFilter === "closed" && pr.state === "merged"));
    }
    return filtered.sort((a, b) => {
      switch (prSort) {
        case "oldest":
          return a.number - b.number;
        default:
          return b.number - a.number;
      }
    });
  }, [prFilter, prSort, allPRs]);

  const openIssuesCount = allIssues.filter(i => i.state === "open").length;
  const closedIssuesCount = allIssues.filter(i => i.state === "closed").length;
  const openPRsCount = allPRs.filter(pr => pr.state === "open").length;
  const closedPRsCount = allPRs.filter(pr => pr.state === "closed" || pr.state === "merged").length;
  const unreadNotifications = notifications.filter(n => !n.read).length;

  // Compute contributor stats from actual commits data for Insights view
  const insightsContributorsData = useMemo(() => {
    const statsMap = new Map<string, { userId: string; username: string; commits: number; additions: number; deletions: number }>();
    commits.forEach(commit => {
      const existing = statsMap.get(commit.author);
      if (existing) {
        existing.commits += 1;
        existing.additions += commit.additions;
        existing.deletions += commit.deletions;
      } else {
        statsMap.set(commit.author, {
          userId: commit.authorId,
          username: commit.author,
          commits: 1,
          additions: commit.additions,
          deletions: commit.deletions,
        });
      }
    });
    return Array.from(statsMap.values()).sort((a, b) => b.commits - a.commits);
  }, [commits]);

  const selectedIssue = selectedIssueId ? allIssues.find(i => i.id === selectedIssueId) ?? null : null;
  const selectedPR = selectedPRId ? allPRs.find(pr => pr.id === selectedPRId) ?? null : null;
  const selectedFile = selectedFilePath ? getFileByPath(selectedFilePath) ?? null : null;
  const viewingProfile = useMemo<MicroHubUser | null>(() => {
    if (!viewingProfileUsername) return null;
    const existing = getUserByUsername(viewingProfileUsername);
    if (existing) return existing;
    // Synthesize an org profile when clicking an owner handle that isn't in the user list
    // (e.g. "themicrocorporate" is an organization, not a regular MicroHub user).
    if (repository && viewingProfileUsername === repository.owner) {
      return {
        id: `org-${repository.owner}`,
        name: repository.owner,
        username: repository.owner,
        email: "",
        avatarUrl: "",
        bio: `${repository.owner} organization`,
        location: "",
        followers: 0,
        following: 0,
        joinedDate: "",
      };
    }
    return null;
  }, [viewingProfileUsername, getUserByUsername, repository]);

  // ============================================================================
  // RENDER COMPONENTS
  // ============================================================================
  //
  // Avatar, ClickableUsername, LabelBadge live at module scope (see
  // ./components/) and are imported above. Larger view components (Header,
  // FileTreeItem, ProfileView, etc.) remain inline below pending later
  // extraction phases.


  // Header
  // (extracted to ./components/Header.tsx — module-scope, consumes contexts)

  // Render view content
  const renderContent = () => {
    if (currentView === "profile") return <ProfileView />;
    if (currentView === "settings") return <SettingsView />;

    return (
      <>
        <RepoHeader />
        <main className="max-w-7xl mx-auto">
          {currentView === "code" && <FileBrowser />}
          {currentView === "file-view" && <FileView />}
          {currentView === "commits" && <CommitsView />}
          {currentView === "issues" && <IssuesList />}
          {currentView === "issue-detail" && <IssueDetail />}
          {currentView === "pulls" && <PullRequestsList />}
          {currentView === "pr-detail" && <PRDetail />}
          {currentView === "actions" && <ActionsView />}
          {currentView === "projects" && <ProjectsView />}
          {currentView === "wiki" && <WikiView />}
          {currentView === "security" && <SecurityView />}
          {currentView === "insights" && <InsightsView />}
        </main>
      </>
    );
  };

  // ============================================================================
  // CONTEXT PROVIDER VALUES
  // ============================================================================
  //
  // Three contexts (Theme, Data, UI) split the closure scope into semantic
  // surfaces. Memoizing each value with useMemo keyed on its actual inputs
  // is good hygiene, but the bug fix does *not* depend on context value
  // stability — DOM identity is preserved by component-type stability
  // (module-scope components), not by context value stability.

  const themeContextValue = useMemo<ThemeContextValue>(
    () => ({ theme, darkMode, setDarkMode }),
    [theme, darkMode]
  );

  const dataContextValue = useMemo<MicroHubDataContextValue>(
    () => ({
      // Raw data
      repository, issues, pulls, runs, activity, projects, followingUsernames,
      files, commits, workflows, wiki, insights, releases, labels, security,
      codeScanning, settings, deployments, packages, users, userCreatedRepos,
      config,
      // Mutators
      starRepo, watchRepo, forkRepo, updateRepo, mergePR,
      commentOnIssue, commentOnPR, closeIssue, followUser, createRepo, createIssue,
      // Parent-derived
      microhubUsers, selfUser, fileTree, allIssues, allPRs,
      filteredIssues, filteredPRs, insightsContributorsData,
      // Counts
      openIssuesCount, closedIssuesCount, openPRsCount, closedPRsCount, unreadNotifications,
      // Selections
      selectedIssue, selectedPR, selectedFile, viewingProfile,
      // Helpers
      startTime, getUserByUsername, getFileByPath, getLabelsByIds,
    }),
    [
      repository, issues, pulls, runs, activity, projects, followingUsernames,
      files, commits, workflows, wiki, insights, releases, labels, security,
      codeScanning, settings, deployments, packages, users, userCreatedRepos,
      config,
      starRepo, watchRepo, forkRepo, updateRepo, mergePR,
      commentOnIssue, commentOnPR, closeIssue, followUser, createRepo, createIssue,
      microhubUsers, selfUser, fileTree, allIssues, allPRs,
      filteredIssues, filteredPRs, insightsContributorsData,
      openIssuesCount, closedIssuesCount, openPRsCount, closedPRsCount, unreadNotifications,
      selectedIssue, selectedPR, selectedFile, viewingProfile,
      startTime, getUserByUsername, getFileByPath, getLabelsByIds,
    ]
  );

  const uiContextValue = useMemo<MicroHubUIContextValue>(
    () => ({
      // Route
      currentView, selectedIssueId, selectedPRId, selectedFilePath, viewingProfileUsername, setRoute,
      // Auth
      isLoggedIn, isSignedOut, setIsSignedOut,
      // Search/filter/sort
      searchQuery, setSearchQuery, issueFilter, setIssueFilter,
      issueSort, setIssueSort, prFilter, setPrFilter,
      // Repo / file-tree state
      selectedBranch, setSelectedBranch, expandedFolders, setExpandedFolders, toggleFolder,
      // Editor / comment state
      newCommentText, setNewCommentText,
      // View-specific state (lifted)
      selectedWorkflow, setSelectedWorkflow, selectedWorkflowRun, setSelectedWorkflowRun,
      securityActiveTab, setSecurityActiveTab, selectedProject, setSelectedProject,
      selectedWikiPage, setSelectedWikiPage, mergeDropdownOpen, setMergeDropdownOpen,
      selectedMergeMethod, setSelectedMergeMethod, expandedReleases, setExpandedReleases,
      expandedDeployments, setExpandedDeployments,
      // Header / chrome
      createMenuOpen, setCreateMenuOpen, inboxOpen, setInboxOpen,
      branchDropdownOpen, setBranchDropdownOpen, userMenuOpen, setUserMenuOpen,
      notificationsOpen, setNotificationsOpen, headerDropdown, setHeaderDropdown,
      codeDropdownOpen, setCodeDropdownOpen, sortDropdownOpen, setSortDropdownOpen,
      commandPaletteOpen, setCommandPaletteOpen, sideMenuOpen, setSideMenuOpen,
      // Modals + form state
      editProfileOpen, setEditProfileOpen, editedProfile, setEditedProfile,
      newIssueModalOpen, setNewIssueModalOpen, newPRModalOpen, setNewPRModalOpen,
      newRepoModalOpen, setNewRepoModalOpen, importRepoModalOpen, setImportRepoModalOpen,
      newIssueTitle, setNewIssueTitle, newIssueBody, setNewIssueBody,
      newPRTitle, setNewPRTitle, newPRBody, setNewPRBody,
      newPRSourceBranch, setNewPRSourceBranch, newPRTargetBranch, setNewPRTargetBranch,
      newRepoName, setNewRepoName, newRepoDescription, setNewRepoDescription,
      newRepoVisibility, setNewRepoVisibility, newRepoReadme, setNewRepoReadme,
      newRepoGitignore, setNewRepoGitignore, newRepoSubmitting, setNewRepoSubmitting,
      // User-created
      userCreatedIssues, setUserCreatedIssues, userCreatedPRs, setUserCreatedPRs,
      // Misc
      hoveredContribution, setHoveredContribution, toast, setToast,
      notifications, setNotifications,
      // Stable handlers
      handleViewProfile, handleStarToggle, handleWatchToggle, handleFork,
      handleViewFile, handleMergePR, handleNotificationClick,
    }),
    [
      currentView, selectedIssueId, selectedPRId, selectedFilePath, viewingProfileUsername, setRoute,
      isLoggedIn, isSignedOut,
      searchQuery, issueFilter, issueSort, prFilter,
      selectedBranch, expandedFolders, toggleFolder,
      newCommentText,
      selectedWorkflow, selectedWorkflowRun, securityActiveTab, selectedProject,
      selectedWikiPage, mergeDropdownOpen, selectedMergeMethod,
      expandedReleases, expandedDeployments,
      createMenuOpen, inboxOpen, branchDropdownOpen, userMenuOpen,
      notificationsOpen, headerDropdown, codeDropdownOpen, sortDropdownOpen,
      commandPaletteOpen, sideMenuOpen,
      editProfileOpen, editedProfile,
      newIssueModalOpen, newPRModalOpen, newRepoModalOpen, importRepoModalOpen,
      newIssueTitle, newIssueBody, newPRTitle, newPRBody,
      newPRSourceBranch, newPRTargetBranch,
      newRepoName, newRepoDescription, newRepoVisibility,
      newRepoReadme, newRepoGitignore, newRepoSubmitting,
      userCreatedIssues, userCreatedPRs,
      hoveredContribution, toast, notifications,
      handleViewProfile, handleStarToggle, handleWatchToggle, handleFork,
      handleViewFile, handleMergePR, handleNotificationClick,
    ]
  );

  if (!config || isLoading || !repository) {
    const isNetworkError = error && /failed to fetch|networkerror/i.test(error);
    const isNoSession = error && /409/.test(error);
    const isMismatch = error && /environment mismatch/i.test(error);
    return (
      <div className="flex items-center justify-center h-screen bg-gray-900">
        <div className="text-center max-w-md px-6">
          <div className="text-4xl mb-3">⌨️</div>
          <h1 className="text-xl font-semibold mb-6 text-white">MicroHub</h1>
          {!error ? (
            <>
              <div className="w-8 h-8 border-2 border-white border-t-transparent rounded-full animate-spin mx-auto mb-4" />
              <p className="text-sm text-gray-400">Connecting to MicroHub...</p>
            </>
          ) : isNetworkError ? (
            <>
              <p className="font-medium mb-2 text-white">Could not connect to the server</p>
              <p className="text-sm text-gray-400 mb-3">Make sure the API server is running on port 8000.</p>
              <p className="text-xs font-mono bg-gray-800 rounded px-3 py-2 text-gray-400 mt-2">uvicorn server.server:app --port 8000</p>
            </>
          ) : isNoSession ? (
            <>
              <p className="font-medium mb-2 text-white">No scenario initialized</p>
              <p className="text-sm text-gray-400 mb-3">The server is running but no scenario has been loaded. Use the CLI harness or POST /init to start a scenario.</p>
              <p className="text-xs font-mono bg-gray-800 rounded px-3 py-2 text-gray-400 mt-2">python -m server.run_simulation &lt;scenario.json&gt;</p>
            </>
          ) : isMismatch ? (
            <>
              <p className="font-medium mb-2 text-white">Wrong environment</p>
              <p className="text-sm text-gray-400 mb-3">{error}</p>
              <p className="text-sm text-gray-400">Navigate to the correct environment from the desktop, or re-init with a MicroHub scenario.</p>
            </>
          ) : (
            <>
              <p className="font-medium mb-2 text-white">Connection Error</p>
              <p className="text-sm text-red-400">{error}</p>
            </>
          )}
        </div>
      </div>
    );
  }

  return (
    <ThemeProvider value={themeContextValue}>
      <MicroHubDataProvider value={dataContextValue}>
        <MicroHubUIProvider value={uiContextValue}>
          <div className={classNames("min-h-screen", theme.bg, theme.text)}>
            <Header />

      {/* Side Menu (hamburger menu) */}
      {sideMenuOpen && (
        <>
          <div className="fixed inset-0 bg-black/50 z-40" onClick={() => setSideMenuOpen(false)} />
          <div className="fixed left-0 top-0 h-full w-72 bg-[#161b22] z-50 shadow-xl overflow-y-auto">
            <div className="p-4 border-b border-gray-700">
              <div className="flex items-center justify-between mb-4">
                <img src="desktop/github-icon.png" alt="MicroHub" className="w-8 h-8 object-contain" />
                <button onClick={() => setSideMenuOpen(false)} className="p-1.5 hover:bg-gray-700 rounded">
                  <XCircle className="w-5 h-5" />
                </button>
              </div>
            </div>
            <div className="p-2">
              <div className="mb-4">
                <p className="px-3 py-2 text-xs font-semibold text-gray-500 uppercase">Navigation</p>
                {[
                  { key: "code", label: "Code", icon: Code },
                  { key: "issues", label: "Issues", icon: CircleDot },
                  { key: "pulls", label: "Pull requests", icon: GitPullRequest },
                  { key: "actions", label: "Actions", icon: Play },
                  { key: "projects", label: "Projects", icon: Table2 },
                  { key: "wiki", label: "Wiki", icon: BookOpen },
                  { key: "security", label: "Security", icon: Shield },
                  { key: "insights", label: "Insights", icon: BarChart3 },
                ].map((item) => (
                  <button
                    key={item.key}
                    onClick={() => { setRoute(item.key as ViewType); setSideMenuOpen(false); }}
                    className={classNames(
                      "w-full flex items-center space-x-3 px-3 py-2 rounded-md text-sm",
                      currentView === item.key ? "bg-gray-700 text-white" : "text-gray-300 hover:bg-gray-800"
                    )}
                  >
                    <item.icon className="w-4 h-4" />
                    <span>{item.label}</span>
                  </button>
                ))}
              </div>
              <div className="border-t border-gray-700 pt-4">
                <p className="px-3 py-2 text-xs font-semibold text-gray-500 uppercase">Repository</p>
                <div className="px-3 py-2 text-sm text-gray-300">
                  <div className="flex items-center space-x-2 mb-2">
                    <span className="text-gray-400">{repository!.owner}</span>
                    <span className="text-gray-600">/</span>
                    <span className="font-semibold text-white">{repository!.name}</span>
                  </div>
                  <div className="flex items-center space-x-4 text-xs text-gray-500">
                    <span className="flex items-center space-x-1"><Star className="w-3 h-3" /><span>{repository!.stars}</span></span>
                    <span className="flex items-center space-x-1"><GitFork className="w-3 h-3" /><span>{repository!.forks}</span></span>
                    <span className="flex items-center space-x-1"><Eye className="w-3 h-3" /><span>{repository!.watchers}</span></span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </>
      )}

      {renderContent()}

      <CommandPalette />

      {/* Lock screen overlay */}
      {isSignedOut && (
        <div className="fixed inset-0 z-50 flex items-center justify-center" style={{ backgroundColor: "rgba(0,0,0,0.7)", backdropFilter: "blur(6px)" }}>
          <div className="rounded-lg shadow-2xl p-8 w-[360px] flex flex-col items-center" style={{ backgroundColor: "#161b22", border: "1px solid #30363d" }}>
            <div className="text-2xl font-bold mb-6 text-white">MicroHub</div>
            <div className="w-20 h-20 rounded-full flex items-center justify-center text-white text-2xl font-bold mb-4" style={{ backgroundColor: "#30363d" }}>
              {selfUser?.name?.charAt(0) || "U"}
            </div>
            <div className="text-lg font-semibold text-white mb-1">{selfUser?.name || "User"}</div>
            <div className="text-sm mb-6" style={{ color: "#8b949e" }}>{selfUser?.username || "user"}</div>
            <input type="password" readOnly value="••••••••" className="w-full px-4 py-2 rounded mb-4 text-center" style={{ backgroundColor: "#0d1117", color: "#8b949e", border: "1px solid #30363d" }} />
            <button onClick={() => setIsSignedOut(false)} className="w-full py-2 text-white rounded font-semibold hover:opacity-90 transition-opacity" style={{ backgroundColor: "#238636" }}>
              Sign in
            </button>
          </div>
        </div>
      )}

      {/* New Issue Modal */}
      {newIssueModalOpen && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50" onClick={() => setNewIssueModalOpen(false)}>
          <div className={classNames("w-full max-w-2xl rounded-lg shadow-xl", theme.bgSecondary)} onClick={e => e.stopPropagation()}>
            <div className={classNames("flex items-center justify-between p-4 border-b", theme.border)}>
              <h2 className="text-lg font-semibold">Create new issue</h2>
              <button onClick={() => setNewIssueModalOpen(false)} className={classNames("p-1 rounded", theme.hover)}>
                <XCircle className="w-5 h-5" />
              </button>
            </div>
            <div className="p-4 space-y-4">
              <div>
                <label className={classNames("block text-sm font-medium mb-1", theme.textSecondary)}>Title</label>
                <input
                  type="text"
                  value={newIssueTitle}
                  onChange={(e) => setNewIssueTitle(e.target.value)}
                  placeholder="Issue title"
                  className={classNames("w-full px-3 py-2 rounded-md border text-sm", theme.inputBg, theme.border)}
                />
              </div>
              <div>
                <label className={classNames("block text-sm font-medium mb-1", theme.textSecondary)}>Description</label>
                <textarea
                  value={newIssueBody}
                  onChange={(e) => setNewIssueBody(e.target.value)}
                  placeholder="Describe the issue..."
                  rows={8}
                  className={classNames("w-full px-3 py-2 rounded-md border text-sm font-mono", theme.inputBg, theme.border)}
                />
              </div>
            </div>
            <div className={classNames("flex justify-end gap-2 p-4 border-t", theme.border)}>
              <button
                onClick={() => setNewIssueModalOpen(false)}
                className={classNames("px-4 py-2 text-sm rounded-md border", theme.border, theme.hover)}
              >
                Cancel
              </button>
              <button
                onClick={async () => {
                  if (!newIssueTitle.trim()) return;
                  const created = await createIssue(newIssueTitle.trim(), newIssueBody);
                  if (!created) return;
                  // Optimistically show the new issue using the server's canonical id, so
                  // comments posted immediately after creation address the right record.
                  // The next poll will include it too — dedupe by id.
                  setUserCreatedIssues(prev =>
                    prev.some(i => i.id === created.id) ? prev : [created, ...prev]
                  );
                  setNewIssueTitle("");
                  setNewIssueBody("");
                  setNewIssueModalOpen(false);
                  setRoute("issues");
                }}
                disabled={!newIssueTitle.trim()}
                className={classNames(
                  "px-4 py-2 text-sm rounded-md text-white",
                  newIssueTitle.trim() ? "bg-green-600 hover:bg-green-700" : "bg-gray-600 cursor-not-allowed"
                )}
              >
                Submit new issue
              </button>
            </div>
          </div>
        </div>
      )}

      {/* New Pull Request Modal */}
      {newPRModalOpen && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50" onClick={() => setNewPRModalOpen(false)}>
          <div className={classNames("w-full max-w-2xl rounded-lg shadow-xl", theme.bgSecondary)} onClick={e => e.stopPropagation()}>
            <div className={classNames("flex items-center justify-between p-4 border-b", theme.border)}>
              <h2 className="text-lg font-semibold">Open a pull request</h2>
              <button onClick={() => setNewPRModalOpen(false)} className={classNames("p-1 rounded", theme.hover)}>
                <XCircle className="w-5 h-5" />
              </button>
            </div>
            <div className="p-4 space-y-4">
              <div className="flex items-center space-x-2 text-sm">
                <span className={theme.textSecondary}>base:</span>
                <select
                  value={newPRTargetBranch}
                  onChange={(e) => setNewPRTargetBranch(e.target.value)}
                  className={classNames("px-2 py-1 rounded border text-sm", theme.inputBg, theme.border)}
                >
                  {repository!.branches.map(b => <option key={b} value={b}>{b}</option>)}
                </select>
                <span className={theme.textSecondary}>← compare:</span>
                <select
                  value={newPRSourceBranch}
                  onChange={(e) => setNewPRSourceBranch(e.target.value)}
                  className={classNames("px-2 py-1 rounded border text-sm", theme.inputBg, theme.border)}
                >
                  <option value="">Select branch</option>
                  {repository!.branches.filter(b => b !== newPRTargetBranch).map(b => <option key={b} value={b}>{b}</option>)}
                </select>
              </div>
              <div>
                <label className={classNames("block text-sm font-medium mb-1", theme.textSecondary)}>Title</label>
                <input
                  type="text"
                  value={newPRTitle}
                  onChange={(e) => setNewPRTitle(e.target.value)}
                  placeholder="Pull request title"
                  className={classNames("w-full px-3 py-2 rounded-md border text-sm", theme.inputBg, theme.border)}
                />
              </div>
              <div>
                <label className={classNames("block text-sm font-medium mb-1", theme.textSecondary)}>Description</label>
                <textarea
                  value={newPRBody}
                  onChange={(e) => setNewPRBody(e.target.value)}
                  placeholder="Describe your changes..."
                  rows={6}
                  className={classNames("w-full px-3 py-2 rounded-md border text-sm font-mono", theme.inputBg, theme.border)}
                />
              </div>
            </div>
            <div className={classNames("flex justify-end gap-2 p-4 border-t", theme.border)}>
              <button
                onClick={() => setNewPRModalOpen(false)}
                className={classNames("px-4 py-2 text-sm rounded-md border", theme.border, theme.hover)}
              >
                Cancel
              </button>
              <button
                onClick={() => {
                  if (!newPRTitle.trim() || !newPRSourceBranch) return;
                  const maxPRNumber = Math.max(...pulls.map(p => p.number), ...userCreatedPRs.map(p => p.number), 0);
                  const newPR = {
                    id: `user-pr-${Date.now()}`,
                    number: maxPRNumber + 1,
                    title: newPRTitle,
                    body: newPRBody,
                    state: 'open' as const,
                    author: selfUser?.username || 'unknown',
                    authorId: selfUser?.id || 'unknown',
                    assignees: [],
                    reviewers: [],
                    labelIds: [],
                    sourceBranch: newPRSourceBranch,
                    targetBranch: newPRTargetBranch,
                    commits: 1,
                    additions: Math.floor(Math.random() * 200) + 10,
                    deletions: Math.floor(Math.random() * 50) + 5,
                    filesChanged: Math.floor(Math.random() * 5) + 1,
                    reviewStatus: 'pending' as const,
                    checks: [{ name: 'CI', status: 'pending' as const }],
                    comments: [],
                    order: -1,
                  };
                  setUserCreatedPRs(prev => [newPR, ...prev]);
                  setNewPRTitle("");
                  setNewPRBody("");
                  setNewPRSourceBranch("");
                  setNewPRModalOpen(false);
                  setRoute("pulls");
                }}
                disabled={!newPRTitle.trim() || !newPRSourceBranch}
                className={classNames(
                  "px-4 py-2 text-sm rounded-md text-white",
                  newPRTitle.trim() && newPRSourceBranch ? "bg-green-600 hover:bg-green-700" : "bg-gray-600 cursor-not-allowed"
                )}
              >
                Create pull request
              </button>
            </div>
          </div>
        </div>
      )}

      {/* New Repository Modal */}
      {newRepoModalOpen && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50" onClick={() => setNewRepoModalOpen(false)}>
          <div className={classNames("w-full max-w-lg rounded-lg shadow-xl", theme.bgSecondary)} onClick={e => e.stopPropagation()}>
            <div className={classNames("flex items-center justify-between p-4 border-b", theme.border)}>
              <h2 className="text-lg font-semibold">Create a new repository</h2>
              <button onClick={() => setNewRepoModalOpen(false)} className={classNames("p-1 rounded", theme.hover)}>
                <XCircle className="w-5 h-5" />
              </button>
            </div>
            <div className="p-4 space-y-4">
              <div>
                <label className={classNames("block text-sm font-medium mb-1", theme.textSecondary)}>Repository name</label>
                <input
                  type="text"
                  value={newRepoName}
                  onChange={(e) => setNewRepoName(e.target.value)}
                  placeholder="my-new-repo"
                  className={classNames("w-full px-3 py-2 rounded-md border text-sm", theme.inputBg, theme.border)}
                />
              </div>
              <div>
                <label className={classNames("block text-sm font-medium mb-1", theme.textSecondary)}>Description (optional)</label>
                <input
                  type="text"
                  value={newRepoDescription}
                  onChange={(e) => setNewRepoDescription(e.target.value)}
                  placeholder="Short description of your repository"
                  className={classNames("w-full px-3 py-2 rounded-md border text-sm", theme.inputBg, theme.border)}
                />
              </div>
              <div className="space-y-2">
                <label className={classNames("flex items-center space-x-2 text-sm", theme.textSecondary)}>
                  <input
                    type="radio"
                    name="visibility"
                    checked={newRepoVisibility === "public"}
                    onChange={() => setNewRepoVisibility("public")}
                    className="text-green-500"
                  />
                  <Globe className="w-4 h-4" />
                  <span>Public</span>
                </label>
                <label className={classNames("flex items-center space-x-2 text-sm", theme.textSecondary)}>
                  <input
                    type="radio"
                    name="visibility"
                    checked={newRepoVisibility === "private"}
                    onChange={() => setNewRepoVisibility("private")}
                    className="text-green-500"
                  />
                  <Lock className="w-4 h-4" />
                  <span>Private</span>
                </label>
              </div>
              <div className="space-y-2">
                <label className={classNames("flex items-center space-x-2 text-sm")}>
                  <input
                    type="checkbox"
                    checked={newRepoReadme}
                    onChange={(e) => setNewRepoReadme(e.target.checked)}
                    className="rounded"
                  />
                  <span>Add a README file</span>
                </label>
                <label className={classNames("flex items-center space-x-2 text-sm")}>
                  <input
                    type="checkbox"
                    checked={newRepoGitignore}
                    onChange={(e) => setNewRepoGitignore(e.target.checked)}
                    className="rounded"
                  />
                  <span>Add .gitignore</span>
                </label>
              </div>
            </div>
            <div className={classNames("flex justify-end gap-2 p-4 border-t", theme.border)}>
              <button
                onClick={() => {
                  setNewRepoModalOpen(false);
                  setNewRepoName("");
                  setNewRepoDescription("");
                  setNewRepoVisibility("public");
                  setNewRepoReadme(false);
                  setNewRepoGitignore(false);
                }}
                className={classNames("px-4 py-2 text-sm rounded-md border", theme.border, theme.hover)}
              >
                Cancel
              </button>
              <button
                onClick={async () => {
                  const trimmed = newRepoName.trim();
                  if (!trimmed || newRepoSubmitting) return;
                  setNewRepoSubmitting(true);
                  const created = await createRepo({
                    name: trimmed,
                    description: newRepoDescription.trim(),
                    visibility: newRepoVisibility,
                    addReadme: newRepoReadme,
                    addGitignore: newRepoGitignore,
                  });
                  setNewRepoSubmitting(false);
                  if (!created) return;
                  setNewRepoModalOpen(false);
                  setNewRepoName("");
                  setNewRepoDescription("");
                  setNewRepoVisibility("public");
                  setNewRepoReadme(false);
                  setNewRepoGitignore(false);
                  if (selfUser?.username) handleViewProfile(selfUser.username);
                }}
                disabled={!newRepoName.trim() || newRepoSubmitting}
                className={classNames(
                  "px-4 py-2 text-sm rounded-md text-white",
                  newRepoName.trim() && !newRepoSubmitting ? "bg-green-600 hover:bg-green-700" : "bg-gray-600 cursor-not-allowed"
                )}
              >
                {newRepoSubmitting ? "Creating..." : "Create repository"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Import Repository Modal */}
      {importRepoModalOpen && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50" onClick={() => setImportRepoModalOpen(false)}>
          <div className={classNames("w-full max-w-lg rounded-lg shadow-xl", theme.bgSecondary)} onClick={e => e.stopPropagation()}>
            <div className={classNames("flex items-center justify-between p-4 border-b", theme.border)}>
              <h2 className="text-lg font-semibold">Import a repository</h2>
              <button onClick={() => setImportRepoModalOpen(false)} className={classNames("p-1 rounded", theme.hover)}>
                <XCircle className="w-5 h-5" />
              </button>
            </div>
            <div className="p-4 space-y-4">
              <div>
                <label className={classNames("block text-sm font-medium mb-1", theme.textSecondary)}>Your old repository's clone URL</label>
                <input
                  type="text"
                  placeholder="https://microhub.dev/user/repo.git"
                  className={classNames("w-full px-3 py-2 rounded-md border text-sm", theme.inputBg, theme.border)}
                />
              </div>
              <div>
                <label className={classNames("block text-sm font-medium mb-1", theme.textSecondary)}>Repository name</label>
                <input
                  type="text"
                  placeholder="my-imported-repo"
                  className={classNames("w-full px-3 py-2 rounded-md border text-sm", theme.inputBg, theme.border)}
                />
              </div>
              <div className="space-y-2">
                <label className={classNames("flex items-center space-x-2 text-sm", theme.textSecondary)}>
                  <input type="radio" name="import-visibility" defaultChecked className="text-green-500" />
                  <Globe className="w-4 h-4" />
                  <span>Public</span>
                </label>
                <label className={classNames("flex items-center space-x-2 text-sm", theme.textSecondary)}>
                  <input type="radio" name="import-visibility" className="text-green-500" />
                  <Lock className="w-4 h-4" />
                  <span>Private</span>
                </label>
              </div>
            </div>
            <div className={classNames("flex justify-end gap-2 p-4 border-t", theme.border)}>
              <button
                onClick={() => setImportRepoModalOpen(false)}
                className={classNames("px-4 py-2 text-sm rounded-md border", theme.border, theme.hover)}
              >
                Cancel
              </button>
              <button
                onClick={() => setImportRepoModalOpen(false)}
                className="px-4 py-2 text-sm bg-green-600 hover:bg-green-700 rounded-md text-white"
              >
                Begin import
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Toast Notification */}
      {toast && (
        <div className={classNames(
          "fixed bottom-4 left-1/2 -translate-x-1/2 px-4 py-3 rounded-lg shadow-lg z-50 flex items-center space-x-2 animate-pulse",
          toast.type === "info" && "bg-blue-900/90 border border-blue-700 text-blue-100",
          toast.type === "success" && "bg-green-900/90 border border-green-700 text-green-100",
          toast.type === "warning" && "bg-yellow-900/90 border border-yellow-700 text-yellow-100"
        )}>
          <span className="text-sm">{toast.message}</span>
          <button onClick={() => setToast(null)} className="ml-2 opacity-70 hover:opacity-100">
            <XCircle className="w-4 h-4" />
          </button>
        </div>
      )}
    </div>
        </MicroHubUIProvider>
      </MicroHubDataProvider>
    </ThemeProvider>
  );
};

export default MicroHub;
