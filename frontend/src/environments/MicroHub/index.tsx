import { useState, useEffect, useMemo, useCallback } from "react";
import { useHashRoute } from "../../hooks/useHashRoute";
import {
  GitBranch,
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
  Search,
  ChevronDown,
  ChevronRight,
  History,
  Tag,
  File,
  Copy,
  Check,
  MessageSquare,
  Link as LinkIcon,
  CheckCircle2,
  XCircle,
  Clock,
  Lock,
  Globe,
  Package,
  Building2,
  GitMerge,
  Verified,
  AlertTriangle,
  ShieldAlert,
  RefreshCw,
} from "lucide-react";

import { useMicrohubData } from "../../hooks/useMicrohubData";
import type { ApiFile, ApiIssue, ApiPullRequest, ApiHubUser } from "../../hooks/useMicrohubData";
import { classNames, computeRelativeTimestamp } from "./utils";
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
import { Avatar } from "./components/Avatar";
import { ClickableUsername } from "./components/ClickableUsername";
import { LabelBadge } from "./components/LabelBadge";
import { Header } from "./components/Header";
import { FileTreeItem } from "./components/FileTreeItem";
import { CommandPalette } from "./components/CommandPalette";
import { ProfileView } from "./components/ProfileView";
import { SettingsView } from "./components/SettingsView";

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

// HTML escape helper for syntax highlighting
const escapeHtml = (text: string): string => {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
};

// Simple syntax highlighting
const highlightCode = (code: string, language: string): string => {
  // First escape HTML special characters to prevent XSS and rendering issues
  const escaped = escapeHtml(code);

  // Basic keyword highlighting for TypeScript/JavaScript
  if (["typescript", "javascript", "ts", "js"].includes(language.toLowerCase())) {
    // Use inline styles to avoid issues with Tailwind class names containing numbers
    return escaped
      .replace(/\b(import|export|from|const|let|var|function|return|if|else|for|while|class|interface|type|extends|implements|new|this|async|await|try|catch|throw|default)\b/g, '<span style="color:#c084fc">$1</span>')
      .replace(/\b(true|false|null|undefined)\b/g, '<span style="color:#fb923c">$1</span>')
      .replace(/(&#039;|&quot;|`)([^&#]*?)\1/g, '<span style="color:#4ade80">$&</span>')
      .replace(/\/\/.*/g, '<span style="color:#6b7280">$&</span>')
      .replace(/\b(\d+)\b/g, '<span style="color:#60a5fa">$1</span>');
  }

  // For JSON
  if (["json"].includes(language.toLowerCase())) {
    return escaped
      .replace(/(&#039;|&quot;)([^&#]*?)\1/g, '<span style="color:#4ade80">$&</span>')
      .replace(/\b(true|false|null)\b/g, '<span style="color:#fb923c">$1</span>')
      .replace(/\b(\d+)\b/g, '<span style="color:#60a5fa">$1</span>');
  }

  // For markdown, just return escaped
  if (["markdown", "md"].includes(language.toLowerCase())) {
    return escaped
      .replace(/^(#{1,6})\s+(.*)$/gm, '<span style="color:#c084fc">$1</span> <span style="font-weight:bold">$2</span>')
      .replace(/\*\*([^*]+)\*\*/g, '<span style="font-weight:bold">$1</span>')
      .replace(/`([^`]+)`/g, '<span style="color:#f472b6;background:#1f2937;padding:0 4px;border-radius:4px">$1</span>');
  }

  return escaped;
};

// computeRelativeTimestamp lives in ./utils so extracted child components can
// reuse it without creating a runtime cycle through index.tsx.

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

  // File Tree Component
  // (extracted to ./components/FileTreeItem.tsx — module-scope + React.memo,
  // consumes Theme + UI contexts)

  // File Browser (Code view)
  const FileBrowser = () => (
    <div className="flex flex-col lg:flex-row gap-6 p-4">
      <div className="flex-1">
        <div className="flex items-center justify-between mb-4 flex-wrap gap-2">
          <div className="flex items-center space-x-2">
            <div className="relative">
              <button
                onClick={() => setBranchDropdownOpen(!branchDropdownOpen)}
                className={classNames("flex items-center space-x-2 px-3 py-1.5 border rounded-md text-sm", theme.bgTertiary, theme.border, theme.hover)}
              >
                <GitBranch className="w-4 h-4" />
                <span>{selectedBranch}</span>
                <ChevronDown className="w-4 h-4" />
              </button>

              {branchDropdownOpen && (
                <div className={classNames("absolute left-0 mt-2 w-64 border rounded-lg shadow-lg z-10", theme.bgSecondary, theme.border)}>
                  <div className={classNames("p-2 border-b", theme.border)}>
                    <input type="text" placeholder="Find a branch..." className={classNames("w-full px-3 py-1.5 border rounded-md text-sm", theme.inputBg, theme.border)} />
                  </div>
                  <div className="p-2">
                    <div className={classNames("text-xs mb-1", theme.textSecondary)}>Branches</div>
                    {repository!.branches.map(branch => (
                      <button
                        key={branch}
                        onClick={() => { setSelectedBranch(branch); setBranchDropdownOpen(false); }}
                        className={classNames(
                          "w-full text-left px-3 py-1.5 rounded text-sm flex items-center",
                          theme.hover,
                          branch === selectedBranch && theme.bgTertiary
                        )}
                      >
                        {branch === selectedBranch && <Check className="w-4 h-4 mr-2 text-green-400" />}
                        <span className={branch !== selectedBranch ? "ml-6" : ""}>{branch}</span>
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>

            <span className={classNames("text-sm", theme.textSecondary)}>
              <GitBranch className="w-4 h-4 inline mr-1" />
              {repository!.branches.length} branches
            </span>
            <span className={classNames("text-sm", theme.textSecondary)}>
              <Tag className="w-4 h-4 inline mr-1" />
              {repository!.tags.length} tags
            </span>
          </div>

          <div className="flex items-center space-x-2">
            <div className="relative">
              <button
                onClick={() => setCodeDropdownOpen(!codeDropdownOpen)}
                className="flex items-center space-x-2 px-3 py-1.5 bg-green-600 hover:bg-green-700 rounded-md text-sm text-white"
              >
                <Code className="w-4 h-4" />
                <span>Code</span>
                <ChevronDown className="w-4 h-4" />
              </button>

              {codeDropdownOpen && (
                <div className={classNames("absolute right-0 mt-2 w-80 border rounded-lg shadow-lg z-10", theme.bgSecondary, theme.border)}>
                  <div className="p-3">
                    <div className={classNames("text-xs mb-2", theme.textSecondary)}>Clone</div>
                    <div className="flex items-center">
                      <input
                        type="text"
                        readOnly
                        value={`https://microhub.dev/${repository!.fullName}.git`}
                        className={classNames("flex-1 px-3 py-1.5 border rounded-l-md text-sm", theme.inputBg, theme.border)}
                      />
                      <button className={classNames("px-3 py-1.5 border border-l-0 rounded-r-md", theme.bgTertiary, theme.border, theme.hover)}>
                        <Copy className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>

        {commits.length > 0 && (
        <div className={classNames("flex items-center justify-between p-3 border rounded-t-md", theme.bgSecondary, theme.border)}>
          <div className="flex items-center space-x-3">
            <Avatar user={getUserByUsername(commits[0].author)} size="sm" />
            <span className="text-sm font-medium">{commits[0].author}</span>
            <span className={classNames("text-sm", theme.textSecondary)}>{commits[0].message}</span>
            {commits[0].verified && <Verified className="w-4 h-4 text-green-500" />}
          </div>
          <div className={classNames("flex items-center space-x-3 text-sm", theme.textSecondary)}>
            <span className="font-mono text-blue-400">{commits[0].sha}</span>
            <span>{computeRelativeTimestamp(commits[0].order, startTime)}</span>
            <button onClick={() => setRoute("commits")} className="flex items-center hover:text-blue-400">
              <History className="w-4 h-4 mr-1" />
              {repository!.commits.toLocaleString()} commits
            </button>
          </div>
        </div>
        )}

        <div className={classNames("border border-t-0 rounded-b-md", theme.border)}>
          {fileTree.map(file => (
            <FileTreeItem key={file.id} file={file} />
          ))}
        </div>

        {/* README */}
        <div className={classNames("mt-6 border rounded-md", theme.border)}>
          <div className={classNames("px-4 py-3 border-b flex items-center justify-between", theme.bgSecondary, theme.border)}>
            <div className="flex items-center space-x-2">
              <BookOpen className="w-4 h-4" />
              <span className="font-medium">README.md</span>
            </div>
          </div>
          <div className={classNames("p-6 prose max-w-none", darkMode ? "prose-invert" : "")}>
            <h1 className="text-2xl font-bold mb-4">{repository!.name}</h1>
            <p className={classNames("mb-4", theme.textSecondary)}>{repository!.description}</p>
            <h2 className="text-xl font-semibold mt-6 mb-3">Features</h2>
            <ul className={classNames("list-disc list-inside space-y-2", theme.textSecondary)}>
              <li>Real-time Collaboration - Work together with your team</li>
              <li>Authentication - Secure OAuth-based authentication</li>
              <li>Plugin System - Extend functionality with custom plugins</li>
              <li>Dark Mode - System-aware theme with manual toggle</li>
              <li>Notifications - Real-time WebSocket notifications</li>
            </ul>
            <h2 className="text-xl font-semibold mt-6 mb-3">Quick Start</h2>
            <pre className={classNames("p-4 rounded-md text-sm overflow-x-auto", theme.codeBg)}>
              <code>{`npm install
npm run dev`}</code>
            </pre>
          </div>
        </div>
      </div>

      {/* Sidebar */}
      <div className="w-full lg:w-80 space-y-6">
        <div>
          <h3 className="font-semibold mb-3">About</h3>
          <p className={classNames("text-sm mb-3", theme.textSecondary)}>{repository!.description}</p>
          {repository!.websiteUrl && (
            <a href="#" className="flex items-center space-x-2 text-sm text-blue-400 hover:underline mb-3">
              <LinkIcon className="w-4 h-4" />
              <span>{repository!.websiteUrl}</span>
            </a>
          )}
          <div className="mb-3">
            <div className="flex flex-wrap gap-2">
              {repository!.topics.map(topic => (
                <span key={topic} className={classNames("px-2 py-1 text-xs rounded-full cursor-pointer", theme.topicBg)}>
                  {topic}
                </span>
              ))}
            </div>
          </div>
          <div className="space-y-2 text-sm">
            <div className={classNames("flex items-center space-x-2", theme.textSecondary)}>
              <BookOpen className="w-4 h-4" /><span>Readme</span>
            </div>
            <div className={classNames("flex items-center space-x-2", theme.textSecondary)}>
              <File className="w-4 h-4" /><span>{repository!.license} license</span>
            </div>
            <div className={classNames("flex items-center space-x-2", theme.textSecondary)}>
              <Star className="w-4 h-4" /><span>{repository!.stars.toLocaleString()} stars</span>
            </div>
            <div className={classNames("flex items-center space-x-2", theme.textSecondary)}>
              <Eye className="w-4 h-4" /><span>{repository!.watchers} watching</span>
            </div>
            <div className={classNames("flex items-center space-x-2", theme.textSecondary)}>
              <GitFork className="w-4 h-4" /><span>{repository!.forks} forks</span>
            </div>
          </div>
        </div>

        {/* Releases */}
        <div>
          <h3 className="font-semibold mb-3 flex items-center justify-between">
            <span>Releases</span>
            <span className={classNames("text-xs px-2 py-0.5 rounded-full", theme.bgTertiary)}>{releases.length}</span>
          </h3>
          <div className="space-y-2">
            {(expandedReleases ? releases : releases.slice(0, 1)).map(release => (
              <div key={release.id} className={classNames("flex items-start space-x-2 cursor-pointer p-1 -m-1 rounded", theme.hover)} onClick={() => setExpandedReleases(!expandedReleases)}>
                <Tag className="w-4 h-4 text-green-500 mt-0.5" />
                <div>
                  <div className="flex items-center space-x-2">
                    <span className="text-sm font-medium">{release.tagName}</span>
                    {release.isLatest && <span className="text-xs bg-green-600 text-white px-1.5 py-0.5 rounded">Latest</span>}
                  </div>
                  <span className={classNames("text-xs", theme.textSecondary)}>{computeRelativeTimestamp(release.order, startTime)}</span>
                </div>
              </div>
            ))}
            {!expandedReleases && releases.length > 1 && (
              <button onClick={() => setExpandedReleases(true)} className="text-sm text-blue-400 hover:underline">+ {releases.length - 1} releases</button>
            )}
            {expandedReleases && (
              <button onClick={() => setExpandedReleases(false)} className="text-sm text-blue-400 hover:underline">Show less</button>
            )}
          </div>
        </div>

        {/* Packages */}
        <div>
          <h3 className="font-semibold mb-3 flex items-center justify-between">
            <span>Packages</span>
            <span className={classNames("text-xs px-2 py-0.5 rounded-full", theme.bgTertiary)}>{packages.length}</span>
          </h3>
          <div className="space-y-2">
            {packages.map(pkg => (
              <div key={pkg.id} className="flex items-center space-x-2 text-sm">
                <Package className={classNames("w-4 h-4", theme.textSecondary)} />
                <span>{pkg.name}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Deployments */}
        <div>
          <h3 className="font-semibold mb-3 flex items-center justify-between">
            <span>Deployments</span>
            <span className={classNames("text-xs px-2 py-0.5 rounded-full", theme.bgTertiary)}>{deployments.length}</span>
          </h3>
          <div className="space-y-2">
            {(expandedDeployments ? deployments : deployments.slice(0, 2)).map(dep => (
              <div key={dep.id} className={classNames("flex items-center space-x-2 text-sm cursor-pointer p-1 -m-1 rounded", theme.hover)} onClick={() => setExpandedDeployments(!expandedDeployments)}>
                {dep.status === "success" ? (
                  <CheckCircle2 className="w-4 h-4 text-green-500" />
                ) : (
                  <Clock className="w-4 h-4 text-yellow-500" />
                )}
                <span>{dep.environment}</span>
                <span className={theme.textSecondary}>{computeRelativeTimestamp(dep.order, startTime)}</span>
              </div>
            ))}
            {!expandedDeployments && deployments.length > 2 && (
              <button onClick={() => setExpandedDeployments(true)} className="text-sm text-blue-400 hover:underline">+ {deployments.length - 2} deployments</button>
            )}
            {expandedDeployments && (
              <button onClick={() => setExpandedDeployments(false)} className="text-sm text-blue-400 hover:underline">Show less</button>
            )}
          </div>
        </div>

        {/* Contributors */}
        <div>
          <h3 className="font-semibold mb-3 flex items-center justify-between">
            <span>Contributors</span>
            <span className={classNames("text-xs px-2 py-0.5 rounded-full", theme.bgTertiary)}>{microhubUsers.length}</span>
          </h3>
          <div className="flex flex-wrap gap-1">
            {microhubUsers.map(user => (
              <Avatar key={user.id} user={user} size="sm" showTooltip />
            ))}
          </div>
        </div>

        {/* Languages */}
        <div>
          <h3 className="font-semibold mb-3">Languages</h3>
          <div className="h-2 rounded-full overflow-hidden flex">
            {repository!.languages.map((lang, i) => (
              <div key={i} style={{ width: `${lang.percentage}%`, backgroundColor: lang.color }} />
            ))}
          </div>
          <div className="flex flex-wrap gap-3 mt-2 text-sm">
            {repository!.languages.map(lang => (
              <span key={lang.name} className="flex items-center">
                <span className="w-3 h-3 rounded-full mr-1" style={{ backgroundColor: lang.color }} />
                {lang.name} {lang.percentage}%
              </span>
            ))}
          </div>
        </div>
      </div>
    </div>
  );

  // File View with Syntax Highlighting
  const FileView = () => {
    if (!selectedFile || selectedFile.type === "folder") return null;

    const lines = selectedFile.content?.split("\n") || [];

    return (
      <div className="p-4">
        <div className={classNames("flex items-center space-x-2 text-sm mb-4", theme.textSecondary)}>
          <a href="#" onClick={(e) => { e.preventDefault(); setRoute("code"); }} className="text-blue-400 hover:underline">
            {repository!.name}
          </a>
          {selectedFile.path.split("/").map((part, i, arr) => {
            const isLast = i === arr.length - 1;
            // Build the path up to this part for navigation
            const pathUpToHere = arr.slice(0, i + 1).join("/");

            const handleBreadcrumbClick = () => {
              if (isLast) return; // Don't navigate if clicking current file
              // Expand all folders up to this path and go back to code view
              const pathParts = pathUpToHere.split("/");
              const foldersToExpand: string[] = [];
              for (let j = 1; j <= pathParts.length; j++) {
                foldersToExpand.push(pathParts.slice(0, j).join("/"));
              }
              setExpandedFolders(prev => [...new Set([...prev, ...foldersToExpand])]);
              setRoute("code");
            };

            return (
              <span key={i} className="flex items-center">
                <span className="mx-1">/</span>
                <span
                  className={isLast ? theme.text : "text-blue-400 hover:underline cursor-pointer"}
                  onClick={!isLast ? handleBreadcrumbClick : undefined}
                >
                  {part}
                </span>
              </span>
            );
          })}
        </div>

        <div className={classNames("border rounded-md", theme.border)}>
          <div className={classNames("px-4 py-2 border-b flex items-center justify-between", theme.bgSecondary, theme.border)}>
            <div className="flex items-center space-x-4 text-sm">
              <span>{lines.length} lines</span>
              <span>{selectedFile.size ? `${(selectedFile.size / 1024).toFixed(1)} KB` : ""}</span>
            </div>
            <div className="flex items-center space-x-2">
              <button className={classNames("p-1.5 rounded", theme.hover)}><Copy className="w-4 h-4" /></button>
            </div>
          </div>
          <div className="overflow-x-auto">
            <pre className="text-sm leading-6">
              <code>
                {lines.map((line, i) => (
                  <div key={i} className={classNames("flex", theme.hover)}>
                    <span className={classNames("w-12 text-right pr-4 select-none border-r", theme.textMuted, theme.borderLight, theme.bg)}>
                      {i + 1}
                    </span>
                    <span
                      className="pl-4 flex-1"
                      dangerouslySetInnerHTML={{ __html: highlightCode(line || " ", selectedFile.language || "plaintext") }}
                    />
                  </div>
                ))}
              </code>
            </pre>
          </div>
        </div>
      </div>
    );
  };

  // Commits View
  const CommitsView = () => (
    <div className="p-4">
      <h2 className="text-xl font-semibold mb-4">Commits</h2>
      <div className={classNames("border rounded-md", theme.border)}>
        {commits.map((commit, index) => (
          <div key={commit.id} className={classNames("p-4 flex items-start justify-between", index < commits.length - 1 && classNames("border-b", theme.borderLight))}>
            <div className="flex items-start space-x-3">
              <Avatar user={getUserByUsername(commit.author)} size="sm" />
              <div>
                <div className="flex items-center space-x-2">
                  <span className="font-medium">{commit.message}</span>
                  {commit.verified && <span title="Verified"><Verified className="w-4 h-4 text-green-500" /></span>}
                </div>
                {commit.description && <p className={classNames("text-sm mt-1", theme.textSecondary)}>{commit.description}</p>}
                <div className={classNames("text-xs mt-1", theme.textSecondary)}>
                  <span className="text-blue-400 hover:underline cursor-pointer" onClick={() => handleViewProfile(commit.author)}>{commit.author}</span>
                  {" "}committed {computeRelativeTimestamp(commit.order, startTime)}
                </div>
              </div>
            </div>
            <div className="flex items-center space-x-3 text-sm">
              <span className="font-mono text-blue-400">{commit.sha}</span>
              <button className={classNames("p-1 rounded", theme.hover)}><Copy className="w-4 h-4" /></button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );



  // Issues List
  const IssuesList = () => (
    <div className="p-4">
      <div className="flex items-center justify-between mb-4 flex-wrap gap-2">
        <div className="flex items-center space-x-2 flex-1">
          <div className="relative flex-1 max-w-lg">
            <Search className={classNames("absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4", theme.textSecondary)} />
            <input
              type="text"
              placeholder="Search all issues"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className={classNames("w-full pl-10 pr-4 py-1.5 border rounded-md text-sm", theme.inputBg, theme.border)}
            />
          </div>
          <button className={classNames("px-3 py-1.5 text-sm border rounded-md flex items-center", theme.bgTertiary, theme.border, theme.hover)}>
            <Tag className="w-4 h-4 mr-1" />Labels
          </button>
        </div>
        <button
          onClick={() => setNewIssueModalOpen(true)}
          className="px-4 py-1.5 text-sm bg-green-600 hover:bg-green-700 rounded-md text-white font-medium"
        >
          New issue
        </button>
      </div>

      <div className={classNames("flex items-center justify-between border-b pb-3 mb-4", theme.border)}>
        <div className="flex items-center space-x-4">
          <button onClick={() => setIssueFilter("open")} className={classNames("flex items-center space-x-1 text-sm", issueFilter === "open" ? classNames(theme.text, "font-medium") : theme.textSecondary)}>
            <CircleDot className="w-4 h-4" /><span>{openIssuesCount} Open</span>
          </button>
          <button onClick={() => setIssueFilter("closed")} className={classNames("flex items-center space-x-1 text-sm", issueFilter === "closed" ? classNames(theme.text, "font-medium") : theme.textSecondary)}>
            <CheckCircle2 className="w-4 h-4" /><span>{closedIssuesCount} Closed</span>
          </button>
        </div>
        <div className="relative">
          <button onClick={() => setSortDropdownOpen(!sortDropdownOpen)} className={classNames("flex items-center space-x-1 text-sm", theme.textSecondary)}>
            <span>Sort</span><ChevronDown className="w-4 h-4" />
          </button>
          {sortDropdownOpen && (
            <div className={classNames("absolute right-0 mt-2 w-48 border rounded-lg shadow-lg z-10", theme.bgSecondary, theme.border)}>
              {[{ key: "newest", label: "Newest" }, { key: "oldest", label: "Oldest" }, { key: "most-commented", label: "Most commented" }].map(option => (
                <button key={option.key} onClick={() => { setIssueSort(option.key as SortOption); setSortDropdownOpen(false); }} className={classNames("w-full text-left px-4 py-2 text-sm", theme.hover, issueSort === option.key && theme.text)}>
                  {issueSort === option.key && <Check className="w-4 h-4 inline mr-2" />}
                  <span className={issueSort !== option.key ? "ml-6" : ""}>{option.label}</span>
                </button>
              ))}
            </div>
          )}
        </div>
      </div>

      <div className={classNames("border rounded-md", theme.border)}>
        {filteredIssues.length === 0 ? (
          <div className={classNames("p-8 text-center", theme.textSecondary)}>
            <CircleDot className="w-12 h-12 mx-auto mb-4 opacity-50" />
            <p className="text-lg font-medium mb-2">No issues found</p>
          </div>
        ) : (
          filteredIssues.map((issue, index) => (
            <div key={issue.id} onClick={() => { setRoute("issue-detail", issue.id); }} className={classNames("flex items-start p-4 cursor-pointer", theme.hover, index < filteredIssues.length - 1 && classNames("border-b", theme.borderLight))}>
              <div className="mr-3 mt-1">
                {issue.state === "open" ? <CircleDot className="w-4 h-4 text-green-500" /> : <CheckCircle2 className="w-4 h-4 text-purple-500" />}
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center flex-wrap gap-2">
                  <span className={classNames("font-medium hover:text-blue-400", theme.text)}>{issue.title}</span>
                  {getLabelsByIds(issue.labelIds).map(label => label && <LabelBadge key={label.id} label={label} />)}
                </div>
                <div className={classNames("text-xs mt-1", theme.textSecondary)}>
                  #{issue.number} opened {computeRelativeTimestamp(issue.order, startTime, issue.createdAt)} by <span className="hover:text-blue-400 cursor-pointer" onClick={(e) => { e.stopPropagation(); handleViewProfile(issue.author); }}>{issue.author}</span>
                </div>
              </div>
              <div className="flex items-center space-x-4 ml-4">
                {issue.assignees.length > 0 && (
                  <div className="flex -space-x-1">
                    {issue.assignees.slice(0, 3).map(username => <Avatar key={username} user={getUserByUsername(username)} size="sm" />)}
                  </div>
                )}
                {issue.comments.length > 0 && (
                  <div className={classNames("flex items-center space-x-1 text-sm", theme.textSecondary)}>
                    <MessageSquare className="w-4 h-4" /><span>{issue.comments.length}</span>
                  </div>
                )}
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );

  // Issue Detail
  const IssueDetail = () => {
    if (!selectedIssue) return null;
    const author = getUserByUsername(selectedIssue.author);

    return (
      <div className="p-4 max-w-4xl mx-auto">
        <div className="mb-6">
          <h1 className="text-2xl font-semibold mb-2">
            {selectedIssue.title}
            <span className={classNames("font-normal ml-2", theme.textSecondary)}>#{selectedIssue.number}</span>
          </h1>
          <div className="flex items-center space-x-2">
            <span className={classNames("flex items-center space-x-1 px-3 py-1 rounded-full text-sm font-medium", selectedIssue.state === "open" ? "bg-green-900/30 text-green-400" : "bg-purple-900/30 text-purple-400")}>
              {selectedIssue.state === "open" ? <CircleDot className="w-4 h-4" /> : <CheckCircle2 className="w-4 h-4" />}
              <span className="capitalize">{selectedIssue.state}</span>
            </span>
            <span className={classNames("text-sm", theme.textSecondary)}>
              <ClickableUsername username={selectedIssue.author} className="font-medium" />
              {" "}opened this issue {computeRelativeTimestamp(selectedIssue.order, startTime, selectedIssue.createdAt)} · {selectedIssue.comments.length} comment{selectedIssue.comments.length !== 1 ? "s" : ""}
            </span>
          </div>
        </div>

        <div className="flex gap-6">
          <div className="flex-1">
            <div className={classNames("border rounded-md mb-4", theme.border)}>
              <div className={classNames("px-4 py-2 border-b flex items-center justify-between rounded-t-md", theme.bgSecondary, theme.border)}>
                <div className="flex items-center space-x-2">
                  <Avatar user={author} size="sm" />
                  <ClickableUsername username={selectedIssue.author} className="font-medium text-sm" />
                  <span className={classNames("text-sm", theme.textSecondary)}>commented {computeRelativeTimestamp(selectedIssue.order, startTime, selectedIssue.createdAt)}</span>
                </div>
              </div>
              <div className="p-4">
                <div className={classNames("prose prose-sm max-w-none whitespace-pre-wrap", darkMode ? "prose-invert" : "")}>{selectedIssue.body}</div>
              </div>
            </div>

            {selectedIssue.comments.map(comment => {
              const commentAuthor = getUserByUsername(comment.author);
              return (
                <div key={comment.id} className={classNames("border rounded-md mb-4", theme.border)}>
                  <div className={classNames("px-4 py-2 border-b flex items-center space-x-2 rounded-t-md", theme.bgSecondary, theme.border)}>
                    <Avatar user={commentAuthor} size="sm" />
                    <ClickableUsername username={comment.author} className="font-medium text-sm" />
                    <span className={classNames("text-sm", theme.textSecondary)}>commented {computeRelativeTimestamp(comment.order, startTime)}</span>
                  </div>
                  <div className="p-4">
                    <p className="text-sm">{comment.body}</p>
                    {(comment.reactions?.length ?? 0) > 0 && (
                      <div className="flex items-center space-x-2 mt-3">
                        {(comment.reactions ?? []).map((reaction, i) => (
                          <span key={i} className={classNames("px-2 py-0.5 rounded-full text-sm", theme.bgTertiary)}>{reaction.emoji} {reaction.count}</span>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              );
            })}

            {/* Add comment form */}
            <div className={classNames("border rounded-md", theme.border)}>
              <div className={classNames("px-4 py-2 border-b rounded-t-md", theme.bgSecondary, theme.border)}>
                <span className="text-sm font-medium">Add a comment</span>
              </div>
              <div className="p-4">
                <textarea
                  value={newCommentText}
                  onChange={(e) => setNewCommentText(e.target.value)}
                  placeholder="Leave a comment"
                  className={classNames("w-full p-3 border rounded-md text-sm resize-none", theme.inputBg, theme.border, theme.text)}
                  rows={4}
                />
                <div className="flex justify-end mt-3">
                  <button
                    onClick={() => {
                      if (!newCommentText.trim()) return;
                      commentOnIssue(selectedIssue.id, newCommentText.trim());
                      setNewCommentText("");
                    }}
                    disabled={!newCommentText.trim()}
                    className={classNames(
                      "px-4 py-1.5 text-sm rounded-md font-medium",
                      newCommentText.trim()
                        ? "bg-green-600 hover:bg-green-700 text-white"
                        : "bg-gray-600 text-gray-400 cursor-not-allowed"
                    )}
                  >
                    Comment
                  </button>
                </div>
              </div>
            </div>
          </div>

          <div className="w-64 space-y-4">
            <div>
              <h4 className={classNames("text-xs font-medium mb-2", theme.textSecondary)}>Assignees</h4>
              {selectedIssue.assignees.length > 0 ? (
                <div className="space-y-2">
                  {selectedIssue.assignees.map(username => {
                    const user = getUserByUsername(username);
                    return (
                      <div key={username} className="flex items-center space-x-2 cursor-pointer hover:text-blue-400" onClick={() => handleViewProfile(username)}>
                        <Avatar user={user} size="sm" />
                        <span className="text-sm">{username}</span>
                      </div>
                    );
                  })}
                </div>
              ) : (
                <p className={classNames("text-sm", theme.textSecondary)}>No one assigned</p>
              )}
            </div>
            <div>
              <h4 className={classNames("text-xs font-medium mb-2", theme.textSecondary)}>Labels</h4>
              {selectedIssue.labelIds.length > 0 ? (
                <div className="flex flex-wrap gap-1">{getLabelsByIds(selectedIssue.labelIds).map(label => label && <LabelBadge key={label.id} label={label} />)}</div>
              ) : (
                <p className={classNames("text-sm", theme.textSecondary)}>None yet</p>
              )}
            </div>
            {selectedIssue.milestone && (
              <div>
                <h4 className={classNames("text-xs font-medium mb-2", theme.textSecondary)}>Milestone</h4>
                <p className="text-sm">{selectedIssue.milestone}</p>
              </div>
            )}
          </div>
        </div>
      </div>
    );
  };

  // Pull Requests List
  const PullRequestsList = () => (
    <div className="p-4">
      <div className="flex items-center justify-between mb-4 flex-wrap gap-2">
        <div className="flex items-center space-x-2 flex-1">
          <div className="relative flex-1 max-w-lg">
            <Search className={classNames("absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4", theme.textSecondary)} />
            <input type="text" placeholder="Search all pull requests" className={classNames("w-full pl-10 pr-4 py-1.5 border rounded-md text-sm", theme.inputBg, theme.border)} />
          </div>
        </div>
        <button
          onClick={() => setNewPRModalOpen(true)}
          className="px-4 py-1.5 text-sm bg-green-600 hover:bg-green-700 rounded-md text-white font-medium"
        >
          New pull request
        </button>
      </div>

      <div className={classNames("flex items-center justify-between border-b pb-3 mb-4", theme.border)}>
        <div className="flex items-center space-x-4">
          <button onClick={() => setPrFilter("open")} className={classNames("flex items-center space-x-1 text-sm", prFilter === "open" ? classNames(theme.text, "font-medium") : theme.textSecondary)}>
            <GitPullRequest className="w-4 h-4" /><span>{openPRsCount} Open</span>
          </button>
          <button onClick={() => setPrFilter("closed")} className={classNames("flex items-center space-x-1 text-sm", prFilter === "closed" ? classNames(theme.text, "font-medium") : theme.textSecondary)}>
            <CheckCircle2 className="w-4 h-4" /><span>{closedPRsCount} Closed</span>
          </button>
        </div>
      </div>

      <div className={classNames("border rounded-md", theme.border)}>
        {filteredPRs.map((pr, index) => (
          <div key={pr.id} onClick={() => { setRoute("pr-detail", pr.id); }} className={classNames("flex items-start p-4 cursor-pointer", theme.hover, index < filteredPRs.length - 1 && classNames("border-b", theme.borderLight))}>
            <div className="mr-3 mt-1">
              {pr.state === "open" ? <GitPullRequest className="w-4 h-4 text-green-500" /> : pr.state === "merged" ? <GitMerge className="w-4 h-4 text-purple-500" /> : <GitPullRequest className="w-4 h-4 text-red-500" />}
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center flex-wrap gap-2">
                <span className={classNames("font-medium hover:text-blue-400", theme.text)}>{pr.title}</span>
                {getLabelsByIds(pr.labelIds).map(label => label && <LabelBadge key={label.id} label={label} />)}
              </div>
              <div className={classNames("text-xs mt-1", theme.textSecondary)}>
                #{pr.number} opened {computeRelativeTimestamp(pr.order, startTime)} by <span className="hover:text-blue-400 cursor-pointer" onClick={(e) => { e.stopPropagation(); handleViewProfile(pr.author); }}>{pr.author}</span>
                <span className="ml-2">{pr.sourceBranch} → {pr.targetBranch}</span>
              </div>
              <div className="flex items-center space-x-2 mt-2">
                {pr.checks.map((check, i) => (
                  <span key={i} className="flex items-center text-xs">
                    {check.status === "success" ? <CheckCircle2 className="w-3 h-3 text-green-500 mr-1" /> : check.status === "failure" ? <XCircle className="w-3 h-3 text-red-500 mr-1" /> : <Clock className="w-3 h-3 text-yellow-500 mr-1" />}
                    {check.name}
                  </span>
                ))}
              </div>
            </div>
            <div className="flex items-center space-x-4 ml-4">
              <span className={classNames("px-2 py-0.5 text-xs rounded-full", pr.reviewStatus === "approved" ? "bg-green-900/30 text-green-400" : pr.reviewStatus === "changes-requested" ? "bg-red-900/30 text-red-400" : pr.reviewStatus === "draft" ? classNames(theme.bgTertiary, theme.textSecondary) : "bg-yellow-900/30 text-yellow-400")}>
                {pr.reviewStatus === "approved" ? "Approved" : pr.reviewStatus === "changes-requested" ? "Changes requested" : pr.reviewStatus === "draft" ? "Draft" : "Review required"}
              </span>
              {pr.comments.length > 0 && (
                <div className={classNames("flex items-center space-x-1 text-sm", theme.textSecondary)}>
                  <MessageSquare className="w-4 h-4" /><span>{pr.comments.length}</span>
                </div>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );

  // PR Detail
  const PRDetail = () => {
    if (!selectedPR) return null;
    const author = getUserByUsername(selectedPR.author);

    return (
      <div className="p-4 max-w-4xl mx-auto">
        <div className="mb-6">
          <h1 className="text-2xl font-semibold mb-2">
            {selectedPR.title}
            <span className={classNames("font-normal ml-2", theme.textSecondary)}>#{selectedPR.number}</span>
          </h1>
          <div className="flex items-center space-x-2 flex-wrap">
            <span className={classNames("flex items-center space-x-1 px-3 py-1 rounded-full text-sm font-medium", selectedPR.state === "open" ? "bg-green-900/30 text-green-400" : selectedPR.state === "merged" ? "bg-purple-900/30 text-purple-400" : "bg-red-900/30 text-red-400")}>
              {selectedPR.state === "merged" ? <GitMerge className="w-4 h-4" /> : <GitPullRequest className="w-4 h-4" />}
              <span className="capitalize">{selectedPR.state}</span>
            </span>
            <span className={classNames("text-sm", theme.textSecondary)}>
              <span className="font-medium">{selectedPR.author}</span>
              {" "}wants to merge into <span className="font-mono text-blue-400">{selectedPR.targetBranch}</span>
              {" "}from <span className="font-mono text-blue-400">{selectedPR.sourceBranch}</span>
            </span>
          </div>
        </div>

        <div className="flex gap-6">
          <div className="flex-1">
            <div className={classNames("border rounded-md mb-4", theme.border)}>
              <div className={classNames("px-4 py-2 border-b rounded-t-md flex items-center space-x-2", theme.bgSecondary, theme.border)}>
                <Avatar user={author} size="sm" />
                <span className="font-medium text-sm">{selectedPR.author}</span>
                <span className={classNames("text-sm", theme.textSecondary)}>commented {computeRelativeTimestamp(selectedPR.order, startTime)}</span>
              </div>
              <div className="p-4">
                <div className={classNames("prose prose-sm max-w-none whitespace-pre-wrap", darkMode ? "prose-invert" : "")}>{selectedPR.body}</div>
              </div>
            </div>

            {selectedPR.comments.map(comment => {
              const commentAuthor = getUserByUsername(comment.author);
              return (
                <div key={comment.id} className={classNames("border rounded-md mb-4", theme.border)}>
                  <div className={classNames("px-4 py-2 border-b rounded-t-md flex items-center space-x-2", theme.bgSecondary, theme.border)}>
                    <Avatar user={commentAuthor} size="sm" />
                    <span className="font-medium text-sm">{comment.author}</span>
                    <span className={classNames("text-sm", theme.textSecondary)}>commented {computeRelativeTimestamp(comment.order, startTime)}</span>
                  </div>
                  <div className="p-4">
                    <p className="text-sm">{comment.body}</p>
                  </div>
                </div>
              );
            })}

            {/* Add comment form for PR */}
            <div className={classNames("border rounded-md mb-4", theme.border)}>
              <div className={classNames("px-4 py-2 border-b rounded-t-md", theme.bgSecondary, theme.border)}>
                <span className="text-sm font-medium">Add a comment</span>
              </div>
              <div className="p-4">
                <textarea
                  value={newCommentText}
                  onChange={(e) => setNewCommentText(e.target.value)}
                  placeholder="Leave a comment"
                  className={classNames("w-full p-3 border rounded-md text-sm resize-none", theme.inputBg, theme.border, theme.text)}
                  rows={4}
                />
                <div className="flex justify-end mt-3">
                  <button
                    onClick={() => {
                      if (!newCommentText.trim()) return;
                      commentOnPR(selectedPR.id, newCommentText.trim());
                      setNewCommentText("");
                    }}
                    disabled={!newCommentText.trim()}
                    className={classNames(
                      "px-4 py-1.5 text-sm rounded-md font-medium",
                      newCommentText.trim()
                        ? "bg-green-600 hover:bg-green-700 text-white"
                        : "bg-gray-600 text-gray-400 cursor-not-allowed"
                    )}
                  >
                    Comment
                  </button>
                </div>
              </div>
            </div>

            {selectedPR.state === "open" && (
              <div className={classNames("border rounded-md p-4", theme.border)}>
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="font-medium">Ready to merge?</h3>
                    <p className={classNames("text-sm", theme.textSecondary)}>All checks have passed</p>
                  </div>
                  <div className="relative">
                    <div className="flex">
                      <button
                        onClick={() => handleMergePR(selectedPR.id)}
                        className="px-4 py-1.5 text-sm bg-green-600 hover:bg-green-700 rounded-l-md text-white border-r border-green-700"
                      >
                        {selectedMergeMethod === "merge" && "Merge pull request"}
                        {selectedMergeMethod === "squash" && "Squash and merge"}
                        {selectedMergeMethod === "rebase" && "Rebase and merge"}
                      </button>
                      <button
                        onClick={() => setMergeDropdownOpen(!mergeDropdownOpen)}
                        className="px-2 py-1.5 bg-green-600 hover:bg-green-700 rounded-r-md text-white"
                      >
                        <ChevronDown className="w-4 h-4" />
                      </button>
                    </div>
                    {mergeDropdownOpen && (
                      <div className={classNames("absolute right-0 bottom-full mb-1 w-72 rounded-md shadow-lg border z-20", theme.bg, theme.border)}>
                        <div className="py-1">
                          <button
                            onClick={() => { setSelectedMergeMethod("merge"); setMergeDropdownOpen(false); }}
                            className={classNames("w-full text-left px-4 py-3", theme.hover, selectedMergeMethod === "merge" && theme.bgTertiary)}
                          >
                            <div className="flex items-center space-x-2">
                              {selectedMergeMethod === "merge" && <Check className="w-4 h-4 text-green-500" />}
                              {selectedMergeMethod !== "merge" && <div className="w-4" />}
                              <div>
                                <div className="font-medium text-sm">Create a merge commit</div>
                                <div className={classNames("text-xs", theme.textSecondary)}>All commits will be added with a merge commit.</div>
                              </div>
                            </div>
                          </button>
                          <button
                            onClick={() => { setSelectedMergeMethod("squash"); setMergeDropdownOpen(false); }}
                            className={classNames("w-full text-left px-4 py-3", theme.hover, selectedMergeMethod === "squash" && theme.bgTertiary)}
                          >
                            <div className="flex items-center space-x-2">
                              {selectedMergeMethod === "squash" && <Check className="w-4 h-4 text-green-500" />}
                              {selectedMergeMethod !== "squash" && <div className="w-4" />}
                              <div>
                                <div className="font-medium text-sm">Squash and merge</div>
                                <div className={classNames("text-xs", theme.textSecondary)}>Commits will be combined into one commit.</div>
                              </div>
                            </div>
                          </button>
                          <button
                            onClick={() => { setSelectedMergeMethod("rebase"); setMergeDropdownOpen(false); }}
                            className={classNames("w-full text-left px-4 py-3", theme.hover, selectedMergeMethod === "rebase" && theme.bgTertiary)}
                          >
                            <div className="flex items-center space-x-2">
                              {selectedMergeMethod === "rebase" && <Check className="w-4 h-4 text-green-500" />}
                              {selectedMergeMethod !== "rebase" && <div className="w-4" />}
                              <div>
                                <div className="font-medium text-sm">Rebase and merge</div>
                                <div className={classNames("text-xs", theme.textSecondary)}>Commits will be rebased onto the base branch.</div>
                              </div>
                            </div>
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            )}
          </div>

          <div className="w-64 space-y-4">
            <div>
              <h4 className={classNames("text-xs font-medium mb-2", theme.textSecondary)}>Reviewers</h4>
              {selectedPR.reviewers.length > 0 ? (
                <div className="space-y-2">
                  {selectedPR.reviewers.map(username => {
                    const user = getUserByUsername(username);
                    return (
                      <div key={username} className="flex items-center space-x-2">
                        <Avatar user={user} size="sm" />
                        <span className="text-sm">{username}</span>
                      </div>
                    );
                  })}
                </div>
              ) : (
                <p className={classNames("text-sm", theme.textSecondary)}>No reviewers</p>
              )}
            </div>
            <div>
              <h4 className={classNames("text-xs font-medium mb-2", theme.textSecondary)}>Labels</h4>
              {selectedPR.labelIds.length > 0 ? (
                <div className="flex flex-wrap gap-1">{getLabelsByIds(selectedPR.labelIds).map(label => label && <LabelBadge key={label.id} label={label} />)}</div>
              ) : (
                <p className={classNames("text-sm", theme.textSecondary)}>None yet</p>
              )}
            </div>
            <div>
              <h4 className={classNames("text-xs font-medium mb-2", theme.textSecondary)}>Checks</h4>
              <div className="space-y-1">
                {selectedPR.checks.map((check, i) => (
                  <div key={i} className="flex items-center space-x-2 text-sm">
                    {check.status === "success" ? <CheckCircle2 className="w-4 h-4 text-green-500" /> : check.status === "failure" ? <XCircle className="w-4 h-4 text-red-500" /> : <Clock className="w-4 h-4 text-yellow-500" />}
                    <span>{check.name}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  };

  // ============================================================================
  // ACTIONS VIEW - Workflow Runs
  // ============================================================================
  const ActionsView = () => {
    // Using lifted state: selectedWorkflow, setSelectedWorkflow, selectedWorkflowRun, setSelectedWorkflowRun

    const filteredRuns = selectedWorkflow
      ? runs.filter(run => run.workflowId === selectedWorkflow)
      : runs;

    const selectedRunData = selectedWorkflowRun ? runs.find(r => r.id === selectedWorkflowRun) : null;

    const getStatusIcon = (status: string, conclusion: string | null) => {
      if (status === "in_progress") return <RefreshCw className="w-4 h-4 text-yellow-500 animate-spin" />;
      if (status === "queued") return <Clock className="w-4 h-4 text-gray-500" />;
      if (conclusion === "success") return <CheckCircle2 className="w-4 h-4 text-green-500" />;
      if (conclusion === "failure") return <XCircle className="w-4 h-4 text-red-500" />;
      return <Clock className="w-4 h-4 text-gray-500" />;
    };

    const formatDuration = (seconds: number | null | undefined) => {
      if (!seconds) return "--";
      if (seconds < 60) return `${seconds}s`;
      const mins = Math.floor(seconds / 60);
      const secs = seconds % 60;
      return `${mins}m ${secs}s`;
    };

    if (selectedRunData) {
      return (
        <div className="p-4">
          <button onClick={() => setSelectedWorkflowRun(null)} className={classNames("flex items-center space-x-2 mb-4 text-sm", theme.textSecondary, "hover:text-blue-400")}>
            <ChevronRight className="w-4 h-4 rotate-180" />
            <span>All workflow runs</span>
          </button>

          <div className="flex items-center space-x-3 mb-6">
            {getStatusIcon(selectedRunData.status, selectedRunData.conclusion)}
            <div>
              <h1 className="text-xl font-semibold">{selectedRunData.commit.message}</h1>
              <p className={classNames("text-sm", theme.textSecondary)}>
                {selectedRunData.workflowName} #{selectedRunData.runNumber} · {selectedRunData.event} · {selectedRunData.branch}
              </p>
            </div>
          </div>

          <div className={classNames("border rounded-lg", theme.border)}>
            <div className={classNames("px-4 py-3 border-b", theme.bgSecondary, theme.border)}>
              <h3 className="font-medium">Jobs</h3>
            </div>
            <div className="divide-y" style={{ borderColor: darkMode ? "#374151" : "#e5e7eb" }}>
              {selectedRunData.jobs.map(job => (
                <div key={job.id} className="p-4">
                  <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center space-x-2">
                      {getStatusIcon(job.status, job.conclusion)}
                      <span className="font-medium">{job.name}</span>
                    </div>
                    <span className={classNames("text-sm", theme.textSecondary)}>{formatDuration(job.duration)}</span>
                  </div>
                  <div className={classNames("ml-6 border-l-2 pl-4 space-y-2", theme.border)}>
                    {job.steps.map((step, idx) => (
                      <div key={idx} className="flex items-center justify-between text-sm">
                        <div className="flex items-center space-x-2">
                          {getStatusIcon(step.status, step.conclusion)}
                          <span>{step.name}</span>
                        </div>
                        <span className={theme.textSecondary}>{formatDuration(step.duration)}</span>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      );
    }

    return (
      <div className="p-4">
        <div className="flex gap-6">
          {/* Sidebar - Workflows */}
          <div className="w-64 flex-shrink-0">
            <h3 className={classNames("text-sm font-medium mb-2", theme.textSecondary)}>Workflows</h3>
            <div className={classNames("border rounded-lg", theme.border)}>
              <button
                onClick={() => setSelectedWorkflow(null)}
                className={classNames("w-full text-left px-3 py-2 text-sm", !selectedWorkflow ? theme.bgTertiary : theme.hover)}
              >
                All workflows
              </button>
              {workflows.map(wf => (
                <button
                  key={wf.id}
                  onClick={() => setSelectedWorkflow(wf.id)}
                  className={classNames("w-full text-left px-3 py-2 text-sm border-t", theme.borderLight, selectedWorkflow === wf.id ? theme.bgTertiary : theme.hover)}
                >
                  {wf.name}
                </button>
              ))}
            </div>
          </div>

          {/* Main content - Runs */}
          <div className="flex-1">
            <div className={classNames("border rounded-lg", theme.border)}>
              <div className={classNames("px-4 py-3 border-b", theme.bgSecondary, theme.border)}>
                <h2 className="font-medium">{filteredRuns.length} workflow runs</h2>
              </div>
              <div className="divide-y" style={{ borderColor: darkMode ? "#374151" : "#e5e7eb" }}>
                {filteredRuns.map(run => (
                  <div key={run.id} onClick={() => setSelectedWorkflowRun(run.id)} className={classNames("px-4 py-3 cursor-pointer", theme.hover)}>
                    <div className="flex items-center justify-between">
                      <div className="flex items-center space-x-3">
                        {getStatusIcon(run.status, run.conclusion)}
                        <div>
                          <p className="font-medium text-sm">{run.commit.message}</p>
                          <p className={classNames("text-xs", theme.textSecondary)}>
                            {run.workflowName} #{run.runNumber} · {run.event} · {run.branch}
                          </p>
                        </div>
                      </div>
                      <div className={classNames("text-right text-xs", theme.textSecondary)}>
                        <p>{formatDuration(run.duration)}</p>
                        <p>{computeRelativeTimestamp(run.order, startTime)}</p>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  };

  // ============================================================================
  // projects VIEW - Kanban Board
  // ============================================================================
  const ProjectsView = () => {
    // Using lifted state: selectedProject, setSelectedProject

    const currentProject = projects.find(p => p.id === selectedProject);

    const getCardContent = (card: { type: string; contentId?: string; note?: string }) => {
      if (card.type === "note") return { title: card.note || "", subtitle: "Note" };
      if (card.type === "issue" && card.contentId) {
        const issue = issues.find(i => i.id === card.contentId);
        return issue ? { title: issue.title, subtitle: `#${issue.number} · ${issue.state}` } : { title: "Unknown issue", subtitle: "" };
      }
      if (card.type === "pull_request" && card.contentId) {
        const pr = pulls.find(p => p.id === card.contentId);
        return pr ? { title: pr.title, subtitle: `#${pr.number} · ${pr.state}` } : { title: "Unknown PR", subtitle: "" };
      }
      return { title: "Unknown", subtitle: "" };
    };

    return (
      <div className="p-4">
        {/* Project selector */}
        <div className="flex items-center space-x-4 mb-6">
          <h2 className="text-lg font-semibold">Projects</h2>
          <div className="flex space-x-2">
            {projects.map(proj => (
              <button
                key={proj.id}
                onClick={() => setSelectedProject(proj.id)}
                className={classNames(
                  "px-3 py-1.5 text-sm rounded-md",
                  selectedProject === proj.id ? "bg-blue-600 text-white" : classNames(theme.bgTertiary, theme.hover)
                )}
              >
                {proj.name}
              </button>
            ))}
          </div>
        </div>

        {currentProject && (
          <>
            <p className={classNames("text-sm mb-4", theme.textSecondary)}>{currentProject.description}</p>

            {/* Kanban board */}
            <div className="flex gap-4 overflow-x-auto pb-4">
              {currentProject.columns.sort((a, b) => a.order - b.order).map(column => (
                <div key={column.id} className={classNames("w-72 flex-shrink-0 border rounded-lg", theme.border, theme.bgSecondary)}>
                  <div className={classNames("px-3 py-2 border-b font-medium text-sm flex items-center justify-between", theme.border)}>
                    <span>{column.name}</span>
                    <span className={classNames("text-xs px-1.5 py-0.5 rounded", theme.badge)}>{column.cards.length}</span>
                  </div>
                  <div className="p-2 space-y-2 min-h-[200px]">
                    {column.cards.sort((a, b) => a.order - b.order).map(card => {
                      const content = getCardContent(card);
                      return (
                        <div key={card.id} className={classNames("p-3 rounded border text-sm cursor-pointer", theme.bg, theme.border, theme.hover)}>
                          <p className="font-medium">{content.title}</p>
                          <p className={classNames("text-xs mt-1", theme.textSecondary)}>{content.subtitle}</p>
                        </div>
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>
          </>
        )}
      </div>
    );
  };

  // ============================================================================
  // WIKI VIEW
  // ============================================================================
  const WikiView = () => {
    // Using lifted state: selectedWikiPage, setSelectedWikiPage

    const currentPage = wiki.find(p => p.id === selectedWikiPage);

    return (
      <div className="p-4 flex gap-6">
        {/* Sidebar - Pages */}
        <div className="w-56 flex-shrink-0">
          <h3 className={classNames("text-sm font-medium mb-3", theme.textSecondary)}>Pages</h3>
          <div className={classNames("border rounded-lg", theme.border)}>
            {wiki.map((page, idx) => (
              <button
                key={page.id}
                onClick={() => setSelectedWikiPage(page.id)}
                className={classNames(
                  "w-full text-left px-3 py-2 text-sm flex items-center space-x-2",
                  idx > 0 && classNames("border-t", theme.borderLight),
                  selectedWikiPage === page.id ? theme.bgTertiary : theme.hover
                )}
              >
                <BookOpen className="w-4 h-4" />
                <span>{page.title}</span>
              </button>
            ))}
          </div>
        </div>

        {/* Content */}
        <div className="flex-1">
          {currentPage && (
            <div className={classNames("border rounded-lg", theme.border)}>
              <div className={classNames("px-4 py-3 border-b flex items-center justify-between", theme.bgSecondary, theme.border)}>
                <h1 className="text-xl font-semibold">{currentPage.title}</h1>
                <div className={classNames("flex items-center space-x-2 text-sm", theme.textSecondary)}>
                  <span>Last edited by</span>
                  <span className="font-medium">{currentPage.lastEditedBy}</span>
                </div>
              </div>
              <div className={classNames("p-6 prose max-w-none", darkMode ? "prose-invert" : "")}>
                {currentPage.content.split("\n").map((line, idx) => {
                  if (line.startsWith("# ")) return <h1 key={idx} className="text-2xl font-bold mt-0 mb-4">{line.slice(2)}</h1>;
                  if (line.startsWith("## ")) return <h2 key={idx} className="text-xl font-semibold mt-6 mb-3">{line.slice(3)}</h2>;
                  if (line.startsWith("### ")) return <h3 key={idx} className="text-lg font-medium mt-4 mb-2">{line.slice(4)}</h3>;
                  if (line.startsWith("```")) return null;
                  if (line.startsWith("- ")) return <li key={idx} className="ml-4">{line.slice(2)}</li>;
                  if (line.trim() === "") return <br key={idx} />;
                  return <p key={idx} className="mb-2">{line}</p>;
                })}
              </div>
            </div>
          )}
        </div>
      </div>
    );
  };

  // ============================================================================
  // SECURITY VIEW
  // ============================================================================
  const SecurityView = () => {
    // Using lifted state: securityActiveTab, setSecurityActiveTab

    const getSeverityColor = (severity: string) => {
      switch (severity) {
        case "critical": return "bg-red-900/30 text-red-400 border-red-500";
        case "high": return "bg-orange-900/30 text-orange-400 border-orange-500";
        case "error": return "bg-red-900/30 text-red-400 border-red-500";
        case "moderate": return "bg-yellow-900/30 text-yellow-400 border-yellow-500";
        case "warning": return "bg-yellow-900/30 text-yellow-400 border-yellow-500";
        case "low": return "bg-blue-900/30 text-blue-400 border-blue-500";
        case "note": return "bg-gray-700/30 text-gray-400 border-gray-500";
        default: return "bg-gray-700/30 text-gray-400 border-gray-500";
      }
    };

    const getStateColor = (state: string) => {
      switch (state) {
        case "open": return "text-yellow-500";
        case "fixed": return "text-green-500";
        case "dismissed": return "text-gray-500";
        default: return "text-gray-500";
      }
    };

    return (
      <div className="p-4">
        <h2 className="text-lg font-semibold mb-4">Security Overview</h2>

        {/* Tabs */}
        <div className={classNames("flex space-x-1 border-b mb-4", theme.border)}>
          <button
            onClick={() => setSecurityActiveTab("advisories")}
            className={classNames(
              "px-4 py-2 text-sm font-medium",
              securityActiveTab === "advisories" ? "border-b-2 border-orange-500" : theme.textSecondary
            )}
          >
            <div className="flex items-center space-x-2">
              <AlertTriangle className="w-4 h-4" />
              <span>Dependabot alerts</span>
              <span className={classNames("px-1.5 py-0.5 text-xs rounded", theme.badge)}>
                {security.filter(a => a.state === "open").length}
              </span>
            </div>
          </button>
          <button
            onClick={() => setSecurityActiveTab("code-scanning")}
            className={classNames(
              "px-4 py-2 text-sm font-medium",
              securityActiveTab === "code-scanning" ? "border-b-2 border-orange-500" : theme.textSecondary
            )}
          >
            <div className="flex items-center space-x-2">
              <ShieldAlert className="w-4 h-4" />
              <span>Code scanning</span>
              <span className={classNames("px-1.5 py-0.5 text-xs rounded", theme.badge)}>
                {codeScanning.filter(a => a.state === "open").length}
              </span>
            </div>
          </button>
        </div>

        {/* Content */}
        <div className={classNames("border rounded-lg", theme.border)}>
          {securityActiveTab === "advisories" && (
            <div className="divide-y" style={{ borderColor: darkMode ? "#374151" : "#e5e7eb" }}>
              {security.map(advisory => (
                <div key={advisory.id} className={classNames("p-4", theme.hover)}>
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <div className="flex items-center space-x-2 mb-1">
                        <span className={classNames("px-2 py-0.5 text-xs font-medium rounded border", getSeverityColor(advisory.severity))}>
                          {advisory.severity}
                        </span>
                        <span className={classNames("text-xs", getStateColor(advisory.state))}>{advisory.state}</span>
                      </div>
                      <h3 className="font-medium">{advisory.title}</h3>
                      <p className={classNames("text-sm mt-1", theme.textSecondary)}>{advisory.description}</p>
                      <div className={classNames("flex items-center space-x-4 mt-2 text-xs", theme.textSecondary)}>
                        <span><strong>Package:</strong> {advisory.package}</span>
                        <span><strong>Vulnerable:</strong> {advisory.vulnerableVersions}</span>
                        <span><strong>Patched:</strong> {advisory.patchedVersions}</span>
                        {advisory.cveId && <span className="font-mono">{advisory.cveId}</span>}
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}

          {securityActiveTab === "code-scanning" && (
            <div className="divide-y" style={{ borderColor: darkMode ? "#374151" : "#e5e7eb" }}>
              {codeScanning.map(alert => (
                <div key={alert.id} className={classNames("p-4", theme.hover)}>
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <div className="flex items-center space-x-2 mb-1">
                        <span className={classNames("px-2 py-0.5 text-xs font-medium rounded border", getSeverityColor(alert.severity))}>
                          {alert.severity}
                        </span>
                        <span className={classNames("text-xs", getStateColor(alert.state))}>{alert.state}</span>
                        <span className={classNames("text-xs font-mono", theme.textSecondary)}>{alert.rule}</span>
                      </div>
                      <h3 className="font-medium">{alert.description}</h3>
                      <p className={classNames("text-sm mt-1 font-mono", theme.textSecondary)}>
                        {alert.file}:{alert.line}
                      </p>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    );
  };

  // ============================================================================
  // INSIGHTS VIEW
  // ============================================================================
  const InsightsView = () => {
    // Using lifted state: insightsContributorsData (computed from actual commits)
    const contributorsData = insightsContributorsData;

    // Use static commit activity data (represents historical weekly activity)
    const commitActivityData = insights.find(d => d.type === "commit_activity")?.data as { week: string; total: number; days: number[] }[] || [];

    const maxCommits = Math.max(...contributorsData.map(c => c.commits), 1);

    return (
      <div className="p-4">
        <h2 className="text-lg font-semibold mb-6">Insights</h2>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Contributors */}
          <div className={classNames("border rounded-lg", theme.border)}>
            <div className={classNames("px-4 py-3 border-b", theme.bgSecondary, theme.border)}>
              <h3 className="font-medium">Contributors</h3>
            </div>
            <div className="p-4 space-y-3">
              {contributorsData.slice(0, 8).map(contributor => {
                const user = getUserByUsername(contributor.username);
                return (
                  <div key={contributor.userId} className="flex items-center space-x-3">
                    <Avatar user={user} size="sm" />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between">
                        <span className="text-sm font-medium truncate">{contributor.username}</span>
                        <span className={classNames("text-xs", theme.textSecondary)}>{contributor.commits} commits</span>
                      </div>
                      <div className={classNames("h-2 rounded-full mt-1", theme.bgTertiary)}>
                        <div
                          className="h-full rounded-full bg-green-500"
                          style={{ width: `${(contributor.commits / maxCommits) * 100}%` }}
                        />
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Commit Activity */}
          <div className={classNames("border rounded-lg", theme.border)}>
            <div className={classNames("px-4 py-3 border-b", theme.bgSecondary, theme.border)}>
              <h3 className="font-medium">Commit Activity</h3>
            </div>
            <div className="p-4">
              <div className="flex items-end space-x-1 h-32">
                {commitActivityData.slice(-12).map((week, idx) => {
                  const maxWeeklyCommits = Math.max(...commitActivityData.map(w => w.total), 1);
                  const height = (week.total / maxWeeklyCommits) * 100;
                  return (
                    <div key={idx} className="flex-1 flex flex-col items-center">
                      <div
                        className="w-full bg-green-500 rounded-t"
                        style={{ height: `${height}%`, minHeight: week.total > 0 ? "4px" : "0" }}
                        title={`${week.week}: ${week.total} commits`}
                      />
                    </div>
                  );
                })}
              </div>
              <div className={classNames("flex justify-between mt-2 text-xs", theme.textSecondary)}>
                <span>12 weeks ago</span>
                <span>Now</span>
              </div>
            </div>
          </div>

          {/* Stats Summary */}
          <div className={classNames("border rounded-lg lg:col-span-2", theme.border)}>
            <div className={classNames("px-4 py-3 border-b", theme.bgSecondary, theme.border)}>
              <h3 className="font-medium">Summary</h3>
            </div>
            <div className="p-4 grid grid-cols-2 md:grid-cols-4 gap-4">
              <div className={classNames("p-4 rounded-lg text-center", theme.bgTertiary)}>
                <p className="text-2xl font-bold">{contributorsData.length}</p>
                <p className={classNames("text-sm", theme.textSecondary)}>Contributors</p>
              </div>
              <div className={classNames("p-4 rounded-lg text-center", theme.bgTertiary)}>
                <p className="text-2xl font-bold">{contributorsData.reduce((sum, c) => sum + c.commits, 0)}</p>
                <p className={classNames("text-sm", theme.textSecondary)}>Total Commits</p>
              </div>
              <div className={classNames("p-4 rounded-lg text-center", theme.bgTertiary)}>
                <p className="text-2xl font-bold text-green-500">+{contributorsData.reduce((sum, c) => sum + c.additions, 0).toLocaleString()}</p>
                <p className={classNames("text-sm", theme.textSecondary)}>Lines Added</p>
              </div>
              <div className={classNames("p-4 rounded-lg text-center", theme.bgTertiary)}>
                <p className="text-2xl font-bold text-red-500">-{contributorsData.reduce((sum, c) => sum + c.deletions, 0).toLocaleString()}</p>
                <p className={classNames("text-sm", theme.textSecondary)}>Lines Deleted</p>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  };



  // Render view content
  const renderContent = () => {
    if (currentView === "profile") return <ProfileView />;
    if (currentView === "settings") return <SettingsView />;

    // ========================================================================
    // LOAD-BEARING: do NOT convert these to <X /> JSX.
    // ========================================================================
    //
    // The bare-call form (`FileBrowser()` etc.) inlines the function's JSX
    // directly into this component's render output, so React never sees them
    // as separate components. That sidesteps the unmount/remount bug that
    // affected JSX-style usages (`<X />`) of inline-defined components when
    // useMicrohubData polls every 1s — see plan.md, the Phase 0–6 history,
    // and the comment block above `RepoHeader` for full background.
    //
    // If you want consistent `<X />` JSX everywhere, FIRST move each of these
    // to a module-scope component file under ./components/ that consumes the
    // contexts (the Phase 7 work). Doing the rename without the extraction
    // will silently reintroduce DOM-identity churn for every Code/Issues/PR/
    // Actions/etc. interactive element, breaking browser-agent click flows.
    return (
      <>
        <RepoHeader />
        <main className="max-w-7xl mx-auto">
          {currentView === "code" && FileBrowser()}
          {currentView === "file-view" && FileView()}
          {currentView === "commits" && CommitsView()}
          {currentView === "issues" && IssuesList()}
          {currentView === "issue-detail" && IssueDetail()}
          {currentView === "pulls" && PullRequestsList()}
          {currentView === "pr-detail" && PRDetail()}
          {currentView === "actions" && ActionsView()}
          {currentView === "projects" && ProjectsView()}
          {currentView === "wiki" && WikiView()}
          {currentView === "security" && SecurityView()}
          {currentView === "insights" && InsightsView()}
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
