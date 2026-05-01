// This file intentionally exports both React context Providers and their
// matching consumer hooks. Vite's fast-refresh would prefer one or the other
// per file, but co-locating them is the standard React pattern and the cost
// here (slightly less aggressive HMR for this single file) is acceptable.
/* eslint-disable react-refresh/only-export-components */

import { createContext, useContext } from "react";
import type { Dispatch, SetStateAction } from "react";
import type {
  ApiTaskConfig,
  ApiRepository,
  ApiHubUser,
  ApiIssue,
  ApiPullRequest,
  ApiCommit,
  ApiWorkflowRun,
  ApiWorkflow,
  ApiWikiPage,
  ApiProject,
  ApiActivity,
  ApiInsight,
  ApiRelease,
  ApiLabel,
  ApiSecurityAdvisory,
  ApiCodeScanAlert,
  ApiDeployment,
  ApiPackage,
} from "../../hooks/useMicrohubData";
// Type-only imports from "./index" are erased at compile time, so the apparent
// circular dependency is safe (contexts.tsx → index.tsx is types-only;
// index.tsx → contexts.tsx is the only runtime edge).
import type { ViewType, IssueState, SortOption, MicroHubUser, RepoFile } from "./index";

// ============================================================================
// THEME
// ============================================================================

export interface Theme {
  bg: string;
  bgSecondary: string;
  bgTertiary: string;
  bgHeader: string;
  text: string;
  textSecondary: string;
  textMuted: string;
  border: string;
  borderLight: string;
  hover: string;
  hoverSecondary: string;
  inputBg: string;
  codeBg: string;
  contribEmpty: string;
  badge: string;
  topicBg: string;
}

export interface ThemeContextValue {
  theme: Theme;
  darkMode: boolean;
  setDarkMode: Dispatch<SetStateAction<boolean>>;
}

const ThemeContext = createContext<ThemeContextValue | null>(null);
ThemeContext.displayName = "MicroHubThemeContext";

export const ThemeProvider = ThemeContext.Provider;

export function useTheme(): ThemeContextValue {
  const ctx = useContext(ThemeContext);
  if (!ctx) throw new Error("useTheme must be used inside <ThemeProvider>");
  return ctx;
}

// ============================================================================
// DATA
// ============================================================================
//
// Bundles everything from useMicrohubData() plus parent-derived memos and
// helpers that components read frequently. Re-derived every poll tick — that
// is fine: DOM identity (the bug we're fixing) does not depend on context
// value identity, only on component-type identity.

// Concrete types derived from local state in the parent.
export interface EditableProfileDraft {
  name: string;
  bio: string;
  company: string;
  location: string;
  website: string;
}

export type NotificationKind = "pr" | "issue" | "release";

export interface MicroHubNotification {
  id: string;
  title: string;
  read: boolean;
  type: NotificationKind;
  targetId: string | null;
}

export interface MergePRResult {
  success: boolean;
  [key: string]: unknown;
}

export interface CommentResult {
  success: boolean;
  [key: string]: unknown;
}

export interface CreateRepoPayload {
  name: string;
  description?: string;
  visibility?: "public" | "private";
  addReadme?: boolean;
  addGitignore?: boolean;
}

export interface InsightsContributorRow {
  userId: string;
  username: string;
  commits: number;
  additions: number;
  deletions: number;
}

export interface MicroHubDataContextValue {
  // Raw data from useMicrohubData
  repository: ApiRepository | null;
  issues: ApiIssue[];
  pulls: ApiPullRequest[];
  runs: ApiWorkflowRun[];
  activity: ApiActivity[];
  projects: ApiProject[];
  followingUsernames: string[];
  files: import("../../hooks/useMicrohubData").ApiFile[];
  commits: ApiCommit[];
  workflows: ApiWorkflow[];
  wiki: ApiWikiPage[];
  insights: ApiInsight[];
  releases: ApiRelease[];
  labels: ApiLabel[];
  security: ApiSecurityAdvisory[];
  codeScanning: ApiCodeScanAlert[];
  settings: Record<string, unknown> | null;
  deployments: ApiDeployment[];
  packages: ApiPackage[];
  users: Record<string, ApiHubUser>;
  userCreatedRepos: ApiRepository[];
  config: ApiTaskConfig | null;

  // Mutators (signatures match useMicrohubData)
  starRepo: () => Promise<void>;
  watchRepo: () => Promise<void>;
  forkRepo: () => Promise<void>;
  updateRepo: (updates: { name?: string; description?: string; visibility?: string }) => Promise<void>;
  mergePR: (prId: string, strategy?: string) => Promise<MergePRResult>;
  commentOnIssue: (issueId: string, body: string) => Promise<CommentResult>;
  commentOnPR: (prId: string, body: string) => Promise<CommentResult>;
  closeIssue: (issueId: string) => Promise<CommentResult>;
  followUser: (username: string) => Promise<void>;
  createRepo: (payload: CreateRepoPayload) => Promise<ApiRepository | null>;
  createIssue: (title: string, body: string) => Promise<ApiIssue | null>;

  // Parent-derived memos
  microhubUsers: MicroHubUser[];
  selfUser: MicroHubUser | undefined;
  fileTree: RepoFile[];
  allIssues: ApiIssue[];
  allPRs: ApiPullRequest[];
  filteredIssues: ApiIssue[];
  filteredPRs: ApiPullRequest[];
  insightsContributorsData: InsightsContributorRow[];

  // Counts
  openIssuesCount: number;
  closedIssuesCount: number;
  openPRsCount: number;
  closedPRsCount: number;
  unreadNotifications: number;

  // Currently-selected items (derived from route)
  selectedIssue: ApiIssue | null;
  selectedPR: ApiPullRequest | null;
  selectedFile: RepoFile | null;
  viewingProfile: MicroHubUser | null;

  // Helpers
  startTime: number;
  getUserByUsername: (username: string) => MicroHubUser | undefined;
  getFileByPath: (path: string) => RepoFile | undefined;
  getLabelsByIds: (ids: string[]) => (ApiLabel | undefined)[];
}

const MicroHubDataContext = createContext<MicroHubDataContextValue | null>(null);
MicroHubDataContext.displayName = "MicroHubDataContext";

export const MicroHubDataProvider = MicroHubDataContext.Provider;

export function useMicrohubCtx(): MicroHubDataContextValue {
  const ctx = useContext(MicroHubDataContext);
  if (!ctx) throw new Error("useMicrohubCtx must be used inside <MicroHubDataProvider>");
  return ctx;
}

// ============================================================================
// UI
// ============================================================================
//
// Route + dropdown/modal/form state + handler callbacks. Most fields are
// state setters that components only invoke on user interaction, so they
// rarely change between polls.

export interface MicroHubUIContextValue {
  // Route
  currentView: ViewType;
  selectedIssueId: string | null;
  selectedPRId: string | null;
  selectedFilePath: string | null;
  viewingProfileUsername: string | null;
  setRoute: (view: ViewType, id?: string | null) => void;

  // Auth (UI-only)
  isLoggedIn: boolean;
  isSignedOut: boolean;
  setIsSignedOut: Dispatch<SetStateAction<boolean>>;

  // Search / filter / sort
  searchQuery: string;
  setSearchQuery: Dispatch<SetStateAction<string>>;
  issueFilter: IssueState;
  setIssueFilter: Dispatch<SetStateAction<IssueState>>;
  issueSort: SortOption;
  setIssueSort: Dispatch<SetStateAction<SortOption>>;
  prFilter: IssueState;
  setPrFilter: Dispatch<SetStateAction<IssueState>>;

  // Repo / file-tree state
  selectedBranch: string;
  setSelectedBranch: Dispatch<SetStateAction<string>>;
  expandedFolders: string[];
  setExpandedFolders: Dispatch<SetStateAction<string[]>>;
  toggleFolder: (path: string) => void;

  // Editor / comment state
  newCommentText: string;
  setNewCommentText: Dispatch<SetStateAction<string>>;

  // View-specific state (lifted in the original code at line 489+)
  selectedWorkflow: string | null;
  setSelectedWorkflow: Dispatch<SetStateAction<string | null>>;
  selectedWorkflowRun: string | null;
  setSelectedWorkflowRun: Dispatch<SetStateAction<string | null>>;
  securityActiveTab: "advisories" | "code-scanning";
  setSecurityActiveTab: Dispatch<SetStateAction<"advisories" | "code-scanning">>;
  selectedProject: string | null;
  setSelectedProject: Dispatch<SetStateAction<string | null>>;
  selectedWikiPage: string;
  setSelectedWikiPage: Dispatch<SetStateAction<string>>;
  mergeDropdownOpen: boolean;
  setMergeDropdownOpen: Dispatch<SetStateAction<boolean>>;
  selectedMergeMethod: "merge" | "squash" | "rebase";
  setSelectedMergeMethod: Dispatch<SetStateAction<"merge" | "squash" | "rebase">>;
  expandedReleases: boolean;
  setExpandedReleases: Dispatch<SetStateAction<boolean>>;
  expandedDeployments: boolean;
  setExpandedDeployments: Dispatch<SetStateAction<boolean>>;

  // Header / chrome state
  createMenuOpen: boolean;
  setCreateMenuOpen: Dispatch<SetStateAction<boolean>>;
  inboxOpen: boolean;
  setInboxOpen: Dispatch<SetStateAction<boolean>>;
  branchDropdownOpen: boolean;
  setBranchDropdownOpen: Dispatch<SetStateAction<boolean>>;
  userMenuOpen: boolean;
  setUserMenuOpen: Dispatch<SetStateAction<boolean>>;
  notificationsOpen: boolean;
  setNotificationsOpen: Dispatch<SetStateAction<boolean>>;
  headerDropdown: string | null;
  setHeaderDropdown: Dispatch<SetStateAction<string | null>>;
  codeDropdownOpen: boolean;
  setCodeDropdownOpen: Dispatch<SetStateAction<boolean>>;
  sortDropdownOpen: boolean;
  setSortDropdownOpen: Dispatch<SetStateAction<boolean>>;
  commandPaletteOpen: boolean;
  setCommandPaletteOpen: Dispatch<SetStateAction<boolean>>;
  sideMenuOpen: boolean;
  setSideMenuOpen: Dispatch<SetStateAction<boolean>>;

  // Modals + their form state
  editProfileOpen: boolean;
  setEditProfileOpen: Dispatch<SetStateAction<boolean>>;
  editedProfile: EditableProfileDraft | null;
  setEditedProfile: Dispatch<SetStateAction<EditableProfileDraft | null>>;
  newIssueModalOpen: boolean;
  setNewIssueModalOpen: Dispatch<SetStateAction<boolean>>;
  newPRModalOpen: boolean;
  setNewPRModalOpen: Dispatch<SetStateAction<boolean>>;
  newRepoModalOpen: boolean;
  setNewRepoModalOpen: Dispatch<SetStateAction<boolean>>;
  importRepoModalOpen: boolean;
  setImportRepoModalOpen: Dispatch<SetStateAction<boolean>>;
  newIssueTitle: string;
  setNewIssueTitle: Dispatch<SetStateAction<string>>;
  newIssueBody: string;
  setNewIssueBody: Dispatch<SetStateAction<string>>;
  newPRTitle: string;
  setNewPRTitle: Dispatch<SetStateAction<string>>;
  newPRBody: string;
  setNewPRBody: Dispatch<SetStateAction<string>>;
  newPRSourceBranch: string;
  setNewPRSourceBranch: Dispatch<SetStateAction<string>>;
  newPRTargetBranch: string;
  setNewPRTargetBranch: Dispatch<SetStateAction<string>>;
  newRepoName: string;
  setNewRepoName: Dispatch<SetStateAction<string>>;
  newRepoDescription: string;
  setNewRepoDescription: Dispatch<SetStateAction<string>>;
  newRepoVisibility: "public" | "private";
  setNewRepoVisibility: Dispatch<SetStateAction<"public" | "private">>;
  newRepoReadme: boolean;
  setNewRepoReadme: Dispatch<SetStateAction<boolean>>;
  newRepoGitignore: boolean;
  setNewRepoGitignore: Dispatch<SetStateAction<boolean>>;
  newRepoSubmitting: boolean;
  setNewRepoSubmitting: Dispatch<SetStateAction<boolean>>;

  // User-created items (lifted state)
  userCreatedIssues: ApiIssue[];
  setUserCreatedIssues: Dispatch<SetStateAction<ApiIssue[]>>;
  userCreatedPRs: ApiPullRequest[];
  setUserCreatedPRs: Dispatch<SetStateAction<ApiPullRequest[]>>;

  // Misc UI state
  hoveredContribution: { week: number; day: number; count: number; x: number; y: number } | null;
  setHoveredContribution: Dispatch<SetStateAction<{ week: number; day: number; count: number; x: number; y: number } | null>>;
  toast: { message: string; type: "info" | "success" | "warning" } | null;
  setToast: Dispatch<SetStateAction<{ message: string; type: "info" | "success" | "warning" } | null>>;
  notifications: MicroHubNotification[];
  setNotifications: Dispatch<SetStateAction<MicroHubNotification[]>>;

  // Stable handlers (all useCallback'd in the parent)
  handleViewProfile: (username: string) => void;
  handleStarToggle: () => void;
  handleWatchToggle: () => void;
  handleFork: () => void;
  handleViewFile: (path: string) => void;
  handleMergePR: (prId: string) => void;
  handleNotificationClick: (notification: MicroHubNotification) => void;
}

const MicroHubUIContext = createContext<MicroHubUIContextValue | null>(null);
MicroHubUIContext.displayName = "MicroHubUIContext";

export const MicroHubUIProvider = MicroHubUIContext.Provider;

export function useMicrohubUI(): MicroHubUIContextValue {
  const ctx = useContext(MicroHubUIContext);
  if (!ctx) throw new Error("useMicrohubUI must be used inside <MicroHubUIProvider>");
  return ctx;
}
