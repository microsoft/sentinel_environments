/**
 * MicroHub Type Definitions
 *
 * Type definitions for the MicroHub environment (MicroHub platform).
 * Actual data is stored in .jsonl files in this directory.
 *
 * Note: Timestamps are NOT stored statically. The `order` field controls
 * when items appear during a task, and display times are computed dynamically
 * based on when items actually appeared in the session.
 */

// ============================================================================
// REPOSITORY TYPES
// ============================================================================

export interface MicroHubRepository {
  id: string;
  owner: string;
  ownerType: 'organization' | 'user';
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
  languages: MicroHubLanguage[];
  license: string;
  defaultBranch: string;
  branches: string[];
  tags: string[];
  topics: string[];
  websiteUrl?: string;
  commits: number;
}

export interface MicroHubLanguage {
  name: string;
  percentage: number;
  color: string;
}

// ============================================================================
// LABEL TYPES
// ============================================================================

export interface MicroHubLabel {
  id: string;
  name: string;
  color: string;
  description: string;
  order: number;
}

// ============================================================================
// COMMIT TYPES
// ============================================================================

export interface MicroHubCommit {
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

// ============================================================================
// RELEASE TYPES
// ============================================================================

export interface MicroHubRelease {
  id: string;
  tagName: string;
  name: string;
  body: string;
  author: string;
  authorId: string;
  isLatest: boolean;
  isPrerelease: boolean;
  assets: MicroHubReleaseAsset[];
  order: number;
}

export interface MicroHubReleaseAsset {
  name: string;
  size: string;
  downloads: number;
}

// ============================================================================
// ISSUE TYPES
// ============================================================================

export interface MicroHubIssue {
  id: string;
  number: number;
  title: string;
  body: string;
  state: 'open' | 'closed';
  author: string;
  authorId: string;
  assignees: string[];
  labelIds: string[];
  comments: MicroHubIssueComment[];
  milestone?: string;
  order: number;
}

export interface MicroHubIssueComment {
  id: string;
  author: string;
  authorId: string;
  body: string;
  reactions: MicroHubReaction[];
  order: number;
}

export interface MicroHubReaction {
  emoji: string;
  count: number;
}

// ============================================================================
// PULL REQUEST TYPES
// ============================================================================

export interface MicroHubPullRequest {
  id: string;
  number: number;
  title: string;
  body: string;
  state: 'open' | 'closed' | 'merged';
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
  reviewStatus: 'approved' | 'changes-requested' | 'review-required' | 'pending' | 'draft';
  checks: MicroHubCheck[];
  comments: MicroHubPRComment[];
  order: number;
}

export interface MicroHubCheck {
  name: string;
  status: 'success' | 'failure' | 'pending';
}

export interface MicroHubPRComment {
  id: string;
  author: string;
  authorId: string;
  body: string;
  reactions: MicroHubReaction[];
  order: number;
}

// ============================================================================
// DEPLOYMENT TYPES
// ============================================================================

export interface MicroHubDeployment {
  id: string;
  environment: 'production' | 'staging' | 'preview';
  status: 'success' | 'failure' | 'pending';
  url: string;
  creator: string;
  order: number;
}

// ============================================================================
// PACKAGE TYPES
// ============================================================================

export interface MicroHubPackage {
  id: string;
  name: string;
  type: 'npm' | 'docker' | 'maven';
  version: string;
  downloads: number;
  order: number;
}

// ============================================================================
// ACTIVITY TYPES
// ============================================================================

export interface MicroHubActivity {
  id: string;
  type: 'push' | 'pr_opened' | 'pr_merged' | 'issue_opened' | 'comment' | 'star' | 'release';
  actor: string;
  actorId: string;
  repo: string;
  payload: Record<string, unknown>;
  order: number;
}

// ============================================================================
// FILE TREE TYPES
// ============================================================================

export interface MicroHubFile {
  id: string;
  name: string;
  path: string;
  type: 'file' | 'folder';
  parentId: string | null;  // null for root-level files/folders
  size?: number;
  language?: string;
  lastCommit: {
    sha: string;
    message: string;
  };
  content?: string;
  order: number;
  children?: MicroHubFile[];  // Computed when building tree from flat data
}

// ============================================================================
// ACTIONS / WORKFLOW TYPES
// ============================================================================

export interface MicroHubWorkflow {
  id: string;
  name: string;
  path: string;  // e.g., ".microhub/workflows/ci.yml"
  state: 'active' | 'disabled';
}

export interface MicroHubWorkflowRun {
  id: string;
  workflowId: string;
  workflowName: string;
  runNumber: number;
  status: 'completed' | 'in_progress' | 'queued' | 'waiting';
  conclusion: 'success' | 'failure' | 'cancelled' | 'skipped' | null;
  branch: string;
  commit: {
    sha: string;
    message: string;
  };
  actor: string;
  actorId: string;
  event: 'push' | 'pull_request' | 'schedule' | 'workflow_dispatch' | 'release';
  duration?: number;  // in seconds
  jobs: MicroHubWorkflowJob[];
  order: number;
}

export interface MicroHubWorkflowJob {
  id: string;
  name: string;
  status: 'completed' | 'in_progress' | 'queued' | 'waiting';
  conclusion: 'success' | 'failure' | 'cancelled' | 'skipped' | null;
  steps: MicroHubWorkflowStep[];
  duration?: number;
}

export interface MicroHubWorkflowStep {
  name: string;
  status: 'completed' | 'in_progress' | 'queued';
  conclusion: 'success' | 'failure' | 'skipped' | null;
  duration?: number;
}

// ============================================================================
// PROJECTS TYPES (Kanban Board)
// ============================================================================

export interface MicroHubProject {
  id: string;
  name: string;
  description: string;
  state: 'open' | 'closed';
  creator: string;
  creatorId: string;
  columns: MicroHubProjectColumn[];
  order: number;
}

export interface MicroHubProjectColumn {
  id: string;
  name: string;
  cards: MicroHubProjectCard[];
  order: number;
}

export interface MicroHubProjectCard {
  id: string;
  type: 'issue' | 'pull_request' | 'note';
  contentId?: string;  // ID of issue or PR if linked
  note?: string;  // For note-type cards
  order: number;
}

// ============================================================================
// WIKI TYPES
// ============================================================================

export interface MicroHubWikiPage {
  id: string;
  title: string;
  slug: string;
  content: string;  // Markdown content
  lastEditedBy: string;
  lastEditedById: string;
  order: number;
}

// ============================================================================
// SECURITY TYPES
// ============================================================================

export interface MicroHubSecurityAdvisory {
  id: string;
  severity: 'critical' | 'high' | 'moderate' | 'low';
  title: string;
  description: string;
  package: string;
  vulnerableVersions: string;
  patchedVersions: string;
  state: 'open' | 'dismissed' | 'fixed';
  cveId?: string;
  order: number;
}

export interface MicroHubCodeScanAlert {
  id: string;
  rule: string;
  severity: 'error' | 'warning' | 'note';
  description: string;
  file: string;
  line: number;
  state: 'open' | 'dismissed' | 'fixed';
  order: number;
}

export interface MicroHubSecretScanAlert {
  id: string;
  secretType: string;
  secret: string;  // Partially masked
  file: string;
  state: 'open' | 'resolved';
  order: number;
}

// ============================================================================
// INSIGHTS TYPES
// ============================================================================

export interface MicroHubContributorStats {
  userId: string;
  username: string;
  commits: number;
  additions: number;
  deletions: number;
}

export interface MicroHubCommitActivity {
  week: string;  // ISO date of week start
  total: number;
  days: number[];  // commits per day (Sun-Sat)
}

export interface MicroHubCodeFrequency {
  week: string;
  additions: number;
  deletions: number;
}

export interface MicroHubTrafficData {
  views: { count: number; uniques: number };
  clones: { count: number; uniques: number };
  referrers: { source: string; count: number; uniques: number }[];
  popularContent: { path: string; count: number; uniques: number }[];
}

// ============================================================================
// SETTINGS TYPES
// ============================================================================

export interface MicroHubRepoSettings {
  general: {
    name: string;
    description: string;
    visibility: 'public' | 'private';
    defaultBranch: string;
    features: {
      issues: boolean;
      projects: boolean;
      wiki: boolean;
      discussions: boolean;
    };
  };
  branches: {
    protectionRules: MicroHubBranchProtection[];
  };
  collaborators: {
    userId: string;
    username: string;
    role: 'admin' | 'write' | 'read';
  }[];
}

export interface MicroHubBranchProtection {
  id: string;
  pattern: string;
  requirePullRequest: boolean;
  requiredApprovals: number;
  requireStatusChecks: boolean;
  requiredChecks: string[];
  includeAdmins: boolean;
}
