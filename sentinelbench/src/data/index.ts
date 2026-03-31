/**
 * SentinelBench Synthetic Data Index
 *
 * This is the centralized data access point for all environments.
 * All data is stored in .jsonl files and imported/parsed here.
 *
 * Pattern: Each environment has:
 *   - data/content/{env}/types.ts - TypeScript type definitions
 *   - data/content/{env}/*.jsonl - Raw data files
 */

// ============================================================================
// PROFILES (shared across all environments)
// ============================================================================

import users from './profiles/users.json';
import entities from './profiles/entities.json';
import type { UserProfile, Organization, OrganizationType } from './profiles/types';
export * from './profiles/types';

// ============================================================================
// TYPE RE-EXPORTS (from environment-specific types.ts files)
// ============================================================================

// MicroMail types
export * from './content/micromail/types';

// MicroLendar types
export * from './content/microlendar/types';

// MicroGram types
export * from './content/microgram/types';

// MicroHub types
export * from './content/microhub/types';

// MicroScholar types
export * from './content/microscholar/types';

// MicroChat types
export * from './content/microchat/types';

// MicroDin types
export * from './content/microdin/types';

// MicroTube types
export * from './content/microtube/types';

// MicroHood types
export * from './content/microhood/types';

// MicroFy types
export * from './content/microfy/types';

// ============================================================================
// RAW JSONL IMPORTS
// ============================================================================

// MicroMail
import micromailEmailsRaw from './content/micromail/emails.jsonl?raw';
import micromailAttachmentsRaw from './content/micromail/attachments.jsonl?raw';

// MicroLendar
import microlendarEventsRaw from './content/microlendar/events.jsonl?raw';

// MicroGram
import microgramPostsRaw from './content/microgram/posts.jsonl?raw';
import microgramStoriesRaw from './content/microgram/stories.jsonl?raw';
import microgramActivityRaw from './content/microgram/activity.jsonl?raw';
import microgramMessagesRaw from './content/microgram/messages.jsonl?raw';
import microgramSuggestionsRaw from './content/microgram/suggestions.jsonl?raw';

// MicroHub
import microhubRepositoryRaw from './content/microhub/repository.jsonl?raw';
import microhubLabelsRaw from './content/microhub/labels.jsonl?raw';
import microhubCommitsRaw from './content/microhub/commits.jsonl?raw';
import microhubReleasesRaw from './content/microhub/releases.jsonl?raw';
import microhubIssuesRaw from './content/microhub/issues.jsonl?raw';
import microhubPrsRaw from './content/microhub/prs.jsonl?raw';
import microhubDeploymentsRaw from './content/microhub/deployments.jsonl?raw';
import microhubPackagesRaw from './content/microhub/packages.jsonl?raw';
import microhubActivityRaw from './content/microhub/activity.jsonl?raw';
import microhubFilesRaw from './content/microhub/files.jsonl?raw';
import microhubWorkflowsRaw from './content/microhub/workflows.jsonl?raw';
import microhubWorkflowRunsRaw from './content/microhub/workflow-runs.jsonl?raw';
import microhubProjectsRaw from './content/microhub/projects.jsonl?raw';
import microhubWikiRaw from './content/microhub/wiki.jsonl?raw';
import microhubSecurityRaw from './content/microhub/security.jsonl?raw';
import microhubCodeScanningRaw from './content/microhub/code-scanning.jsonl?raw';
import microhubInsightsRaw from './content/microhub/insights.jsonl?raw';
import microhubSettingsRaw from './content/microhub/settings.jsonl?raw';

// MicroScholar
import microscholarPapersRaw from './content/microscholar/papers.jsonl?raw';
import microscholarAlertsRaw from './content/microscholar/alerts.jsonl?raw';
import microscholarCoauthorsRaw from './content/microscholar/coauthors.jsonl?raw';

// MicroChat
import microchatTeamsRaw from './content/microchat/teams.jsonl?raw';
import microchatMessagesRaw from './content/microchat/messages.jsonl?raw';
import microchatConversationsRaw from './content/microchat/conversations.jsonl?raw';
import microchatCallsRaw from './content/microchat/calls.jsonl?raw';

// MicroDin
import microdinPostsRaw from './content/microdin/posts.jsonl?raw';
import microdinConnectionsRaw from './content/microdin/connections.jsonl?raw';
import microdinMessagesRaw from './content/microdin/messages.jsonl?raw';
import microdinNotificationsRaw from './content/microdin/notifications.jsonl?raw';
import microdinJobsRaw from './content/microdin/jobs.jsonl?raw';

// MicroTube
import microtubeVideosRaw from './content/microtube/videos.jsonl?raw';
import microtubeChannelsRaw from './content/microtube/channels.jsonl?raw';
import microtubeCommentsRaw from './content/microtube/comments.jsonl?raw';
import microtubeNotificationsRaw from './content/microtube/notifications.jsonl?raw';

// MicroHood
import microhoodStocksRaw from './content/microhood/stocks.jsonl?raw';
import microhoodWatchlistRaw from './content/microhood/watchlist.jsonl?raw';
import microhoodNewsRaw from './content/microhood/news.jsonl?raw';
import microhoodPriceTraces from './content/microhood/stock_price_traces.json';

// MicroFy
import microfyTracksRaw from './content/microfy/tracks.jsonl?raw';
import microfyMoodsRaw from './content/microfy/moods.jsonl?raw';
import microfyPlaylistsRaw from './content/microfy/playlists.jsonl?raw';

// ============================================================================
// JSONL PARSER
// ============================================================================

const parseJsonl = <T>(rawContent: string): T[] => {
  if (!rawContent || !rawContent.trim()) return [];
  return rawContent
    .trim()
    .split('\n')
    .filter(line => line.trim())
    .map(line => JSON.parse(line));
};

// Helper to parse single-line JSONL (for single objects like repository)
const parseJsonlSingle = <T>(rawContent: string): T | null => {
  const parsed = parseJsonl<T>(rawContent);
  return parsed.length > 0 ? parsed[0] : null;
};

// ============================================================================
// IMPORT TYPES FOR PARSING
// ============================================================================

import type { MicromailEmail, MicromailAttachment } from './content/micromail/types';

import type { MicroLendarEvent } from './content/microlendar/types';

import type {
  MicroGramPost,
  MicroGramStory,
  MicroGramActivity,
  MicroGramDirectMessage,
  MicroGramSuggestion,
} from './content/microgram/types';

import type {
  MicroHubRepository,
  MicroHubLabel,
  MicroHubCommit,
  MicroHubRelease,
  MicroHubIssue,
  MicroHubPullRequest,
  MicroHubDeployment,
  MicroHubPackage,
  MicroHubActivity,
  MicroHubFile,
  MicroHubWorkflow,
  MicroHubWorkflowRun,
  MicroHubProject,
  MicroHubWikiPage,
  MicroHubSecurityAdvisory,
  MicroHubCodeScanAlert,
  MicroHubRepoSettings,
} from './content/microhub/types';

import type {
  MicroScholarPaper,
  MicroScholarAlert,
  MicroScholarCoauthor,
} from './content/microscholar/types';

import type {
  MicroChatTeam,
  MicroChatSampleMessage,
  MicroChatConversation,
  MicroChatCall,
} from './content/microchat/types';

import type {
  MicroDinPost,
  MicroDinConnection,
  MicroDinConversation,
  MicroDinNotification,
  MicroDinJob,
  MicroDinCompany,
} from './content/microdin/types';

import type {
  MicroTubeVideo,
  MicroTubeChannel,
  MicroTubeComment,
  MicroTubeNotification,
} from './content/microtube/types';

import type {
  MicroHoodStock,
  MicroHoodWatchlistItem,
  MicroHoodNews,
} from './content/microhood/types';

import type {
  MicroFyTrack,
  MicroFyArtist,
  MicroFyMood,
  MicroFyPlaylist,
} from './content/microfy/types';

// ============================================================================
// SYNTHETIC DATA EXPORT
// ============================================================================

export const syntheticData = {
  /**
   * Centralized user profiles with nested environment-specific data.
   * Access environment data via: user.social, user.microhub, user.scholar
   */
  users: users as UserProfile[],

  /**
   * Centralized entity profiles with cross-platform data.
   * Includes channels, companies, bands, institutions, news outlets, etc.
   */
  entities: entities as Organization[],

  /**
   * Environment-specific content data.
   * All data is parsed from JSONL files at import time.
   */
  content: {
    // MicroMail - Microsoft Outlook replica
    micromail: {
      emails: parseJsonl<MicromailEmail>(micromailEmailsRaw),
      attachments: parseJsonl<MicromailAttachment>(micromailAttachmentsRaw),
    },

    // MicroLendar - calendar app
    microlendar: {
      events: parseJsonl<MicroLendarEvent>(microlendarEventsRaw),
    },

    // MicroGram - photo sharing app
    microgram: {
      posts: parseJsonl<MicroGramPost>(microgramPostsRaw),
      stories: parseJsonl<MicroGramStory>(microgramStoriesRaw),
      activity: parseJsonl<MicroGramActivity>(microgramActivityRaw),
      messages: parseJsonl<MicroGramDirectMessage>(microgramMessagesRaw),
      suggestions: parseJsonl<MicroGramSuggestion>(microgramSuggestionsRaw),
    },

    // MicroHub - MicroHub - code hosting replica
    microhub: {
      repository: parseJsonlSingle<MicroHubRepository>(microhubRepositoryRaw),
      labels: parseJsonl<MicroHubLabel>(microhubLabelsRaw),
      commits: parseJsonl<MicroHubCommit>(microhubCommitsRaw),
      releases: parseJsonl<MicroHubRelease>(microhubReleasesRaw),
      issues: parseJsonl<MicroHubIssue>(microhubIssuesRaw),
      prs: parseJsonl<MicroHubPullRequest>(microhubPrsRaw),
      deployments: parseJsonl<MicroHubDeployment>(microhubDeploymentsRaw),
      packages: parseJsonl<MicroHubPackage>(microhubPackagesRaw),
      activity: parseJsonl<MicroHubActivity>(microhubActivityRaw),
      files: parseJsonl<MicroHubFile>(microhubFilesRaw),
      workflows: parseJsonl<MicroHubWorkflow>(microhubWorkflowsRaw),
      workflowRuns: parseJsonl<MicroHubWorkflowRun>(microhubWorkflowRunsRaw),
      projects: parseJsonl<MicroHubProject>(microhubProjectsRaw),
      wiki: parseJsonl<MicroHubWikiPage>(microhubWikiRaw),
      security: parseJsonl<MicroHubSecurityAdvisory>(microhubSecurityRaw),
      codeScanning: parseJsonl<MicroHubCodeScanAlert>(microhubCodeScanningRaw),
      insights: parseJsonl<Record<string, unknown>>(microhubInsightsRaw),
      settings: parseJsonlSingle<MicroHubRepoSettings>(microhubSettingsRaw),
    },

    // MicroScholar - academic search app
    microscholar: {
      papers: parseJsonl<MicroScholarPaper>(microscholarPapersRaw),
      alerts: parseJsonl<MicroScholarAlert>(microscholarAlertsRaw),
      coauthors: parseJsonl<MicroScholarCoauthor>(microscholarCoauthorsRaw),
    },

    // MicroChat - Microsoft Teams replica
    microchat: {
      teams: parseJsonl<MicroChatTeam>(microchatTeamsRaw),
      sampleMessages: parseJsonl<MicroChatSampleMessage>(microchatMessagesRaw),
      conversations: parseJsonl<MicroChatConversation>(microchatConversationsRaw),
      calls: parseJsonl<MicroChatCall>(microchatCallsRaw),
    },

    // MicroDin - professional network replica
    // Companies are derived from entities (type: 'company' with platforms.microdin)
    microdin: {
      posts: parseJsonl<MicroDinPost>(microdinPostsRaw),
      connections: parseJsonl<MicroDinConnection>(microdinConnectionsRaw),
      conversations: parseJsonl<MicroDinConversation>(microdinMessagesRaw),
      notifications: parseJsonl<MicroDinNotification>(microdinNotificationsRaw),
      jobs: parseJsonl<MicroDinJob>(microdinJobsRaw),
      companies: (entities as Organization[])
        .filter(o => o.type === 'company' && o.platforms?.microdin)
        .map(o => ({
          id: o.platforms!.microdin!.companyId,
          name: o.name,
          industry: o.platforms!.microdin!.industry || 'Technology',
          size: o.platforms!.microdin!.size || '1-50 employees',
          location: o.platforms!.microdin!.location || '',
          about: o.description || '',
          employees: o.platforms!.microdin!.employees || 0,
          followers: o.platforms!.microdin!.followers || 0,
          logoColor: o.avatarColor || '#6366f1',
          initial: o.initials || o.name.charAt(0),
        })) as MicroDinCompany[],
    },

    // MicroTube - video platform replica
    microtube: {
      videos: parseJsonl<MicroTubeVideo>(microtubeVideosRaw),
      channels: parseJsonl<MicroTubeChannel>(microtubeChannelsRaw),
      comments: parseJsonl<MicroTubeComment>(microtubeCommentsRaw),
      notifications: parseJsonl<MicroTubeNotification>(microtubeNotificationsRaw),
    },

    // MicroHood - Brokerage replica
    microhood: {
      stocks: parseJsonl<MicroHoodStock>(microhoodStocksRaw),
      watchlist: parseJsonl<MicroHoodWatchlistItem>(microhoodWatchlistRaw),
      news: parseJsonl<MicroHoodNews>(microhoodNewsRaw),
      priceTraces: microhoodPriceTraces as Record<string, number[]>,
    },

    // MicroFy - Music streaming replica
    // Artists are derived from entities (type: 'band')
    microfy: {
      tracks: parseJsonl<MicroFyTrack>(microfyTracksRaw),
      artists: (entities as Organization[])
        .filter(o => o.type === 'band')
        .map((o, index) => ({
          id: o.platforms?.microfy?.artistId || o.id,
          name: o.name,
          bio: o.description,
          genre: o.platforms?.microfy?.genre,
          followers: o.platforms?.microfy?.followers || 0,
          monthlyListeners: o.platforms?.microfy?.monthlyListeners,
          coverColor: o.avatarColor || '#1db954',
          coverInitials: o.initials || o.name.substring(0, 2).toUpperCase(),
          isVerified: o.isVerified,
          order: index,
        })) as MicroFyArtist[],
      moods: parseJsonl<MicroFyMood>(microfyMoodsRaw),
      playlists: parseJsonl<MicroFyPlaylist>(microfyPlaylistsRaw),
    },
  },
};

// ============================================================================
// USER HELPER FUNCTIONS
// ============================================================================

const typedUsers = users as UserProfile[];

/**
 * Get a user by ID
 */
export const getUserById = (id: string): UserProfile | undefined =>
  typedUsers.find(u => u.id === id);

/**
 * Get the self user (isSelf === true)
 */
export const getSelfUser = (): UserProfile | undefined =>
  typedUsers.find(u => u.isSelf);

/**
 * Get users with social profile data
 */
export const getUsersWithSocial = (): UserProfile[] =>
  typedUsers.filter(u => u.social);

/**
 * Get users with microhub profile data
 */
export const getUsersWithMicroHub = (): UserProfile[] =>
  typedUsers.filter(u => u.microhub);

/**
 * Get users with scholar profile data
 */
export const getUsersWithScholar = (): UserProfile[] =>
  typedUsers.filter(u => u.scholar);

/**
 * Get all users (for MicroDin and other environments needing full user list)
 */
export const getAllUsers = (): UserProfile[] => typedUsers;

// ============================================================================
// ENTITY HELPER FUNCTIONS
// ============================================================================

const orgs = entities as Organization[];

/**
 * Get an organization by ID
 */
export const getOrganizationById = (id: string): Organization | undefined =>
  orgs.find(o => o.id === id);

/**
 * Get organizations by type
 */
export const getOrganizationsByType = (type: OrganizationType): Organization[] =>
  orgs.filter(o => o.type === type);

/**
 * Get all organizations
 */
export const getAllOrganizations = (): Organization[] => orgs;

/**
 * Get organization by platform-specific ID (e.g., channelId, companyId, artistId)
 */
export const getOrganizationByPlatformId = (
  platform: 'microtube' | 'microdin' | 'microfy' | 'microhub',
  platformId: string
): Organization | undefined => {
  return orgs.find(o => {
    const platformData = o.platforms[platform];
    if (!platformData) return false;
    switch (platform) {
      case 'microtube':
        return (platformData as { channelId: string }).channelId === platformId;
      case 'microdin':
        return (platformData as { companyId: string }).companyId === platformId;
      case 'microfy':
        return (platformData as { artistId: string }).artistId === platformId;
      case 'microhub':
        return (platformData as { orgId: string }).orgId === platformId;
      default:
        return false;
    }
  });
};

/**
 * Get MicroTube channels (convenience function)
 */
export const getMicroTubeChannels = (): Organization[] =>
  orgs.filter(o => o.platforms.microtube);

/**
 * Get MicroDin companies (convenience function)
 */
export const getMicroDinCompanies = (): Organization[] =>
  orgs.filter(o => o.platforms.microdin);

/**
 * Get MicroFy artists (convenience function)
 */
export const getMicroFyArtists = (): Organization[] =>
  orgs.filter(o => o.platforms.microfy);


/**
 * Get MicroHub organizations (convenience function)
 */
export const getMicroHubOrganizations = (): Organization[] =>
  orgs.filter(o => o.platforms.microhub);

/**
 * Get news outlets (convenience function)
 */
export const getNewsOutlets = (): Organization[] =>
  orgs.filter(o => o.platforms.news);

/**
 * Get academic institutions (convenience function)
 */
export const getAcademicInstitutions = (): Organization[] =>
  orgs.filter(o => o.platforms.scholar);
