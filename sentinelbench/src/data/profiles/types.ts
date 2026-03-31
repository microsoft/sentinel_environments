/**
 * Profile Type Definitions
 *
 * Unified type definitions for users and entities across all environments.
 * - Users: Individual people (stored in users.json)
 * - Entities: Organizations, channels, bands, etc. (stored in entities.json)
 */

// ============================================================================
// USER PROFILE TYPES
// ============================================================================

export interface UserProfile {
  /** Unique identifier, e.g., "user000" */
  id: string;

  /** Whether this is the current/self user */
  isSelf?: boolean;

  /** Display name */
  name: string;

  /** Username/handle */
  username: string;

  /** Email address */
  email: string;

  /** User's age */
  age: number;

  /** User's race/ethnicity */
  race: string;

  /** User's location */
  location: string;

  /** Personality descriptors */
  personality_tags: string[];

  /** Path to avatar image, e.g., "images/avatars/user000.png" */
  avatarUrl: string;

  /** Path to banner image, e.g., "images/banners/user000.png" */
  bannerUrl: string;

  /** User biography/about text */
  bio: string;

  /** User's gender */
  gender: string;

  /** Job title/occupation */
  jobTitle: string;

  /** User's interests */
  interests: string[];

  /** Platform-specific data */
  social?: UserSocialData;
  microhub?: UserMicroHubData;
  scholar?: UserScholarData;
  microfy?: UserMicrofyData;
  microdin?: UserMicroDinData;
}

// ----------------------------------------------------------------------------
// User Platform Data
// ----------------------------------------------------------------------------

/**
 * MicroGram social data
 */
export interface UserSocialData {
  /** Number of followers */
  followers: number;

  /** Number of accounts following */
  following: number;

  /** Number of posts */
  postsCount: number;

  /** Whether the account is verified */
  isVerified: boolean;

  /** Personal website URL */
  website?: string;

  /** Whether the user has an active story */
  hasStory?: boolean;

  /** Story ID if hasStory is true */
  storyId?: string;
}

/**
 * MicroHub platform data for users
 */
export interface UserMicroHubData {
  /** Number of followers */
  followers: number;

  /** Number of accounts following */
  following: number;

  /** When user joined, e.g., "March 2022" */
  joinedDate: string;

  /** List of pinned repository paths */
  pinnedRepos: string[];

  /** User achievements/badges */
  achievements: UserMicroHubAchievement[];

  /** Contribution activity data (array of commit counts) */
  contributionData: number[];
}

export interface UserMicroHubAchievement {
  /** Achievement ID */
  id: string;

  /** Achievement name */
  name: string;

  /** Emoji icon */
  icon: string;

  /** Achievement description */
  description: string;

  /** When achievement was earned */
  earnedDate: string;
}

/**
 * MicroScholar platform data for users
 */
export interface UserScholarData {
  /** Academic email */
  email: string;

  /** Institution affiliation */
  affiliation: string;

  /** Department name */
  department: string;

  /** Academic title */
  title: string;

  /** Research interests */
  interests: string[];

  /** Total citation count */
  citations: number;

  /** h-index */
  hIndex: number;

  /** i10-index */
  i10Index: number;

  /** Citations since 2020 */
  citationsSince2020: number;

  /** h-index since 2020 */
  hIndexSince2020: number;

  /** Whether profile is verified */
  isVerified: boolean;

  /** Personal homepage URL */
  homepage?: string;

  /** ORCID identifier */
  orcid?: string;
}

/**
 * MicroFy platform data for users
 */
export interface UserMicrofyData {
  /** Number of followers */
  followers: number;

  /** Number of accounts following */
  following: number;

  /** Number of playlists */
  playlistCount: number;

  /** Number of liked tracks */
  likedTracksCount: number;

  /** Monthly listeners (for artists) */
  monthlyListeners: number;

  /** Whether user has premium subscription */
  isPremium: boolean;

  /** When user joined, e.g., "January 2023" */
  joinedDate: string;

  /** Top genres */
  topGenres: string[];

  /** Recently played artist names */
  recentlyPlayedArtists: string[];

  /** Public playlists */
  publicPlaylists: UserMicrofyPlaylist[];
}

export interface UserMicrofyPlaylist {
  /** Playlist ID */
  id: string;

  /** Playlist name */
  name: string;

  /** Number of tracks */
  trackCount: number;
}

/**
 * MicroDin (professional network) platform data for users
 */
export interface UserMicroDinData {
  /** Company name */
  company: string;

  /** Company ID reference */
  companyId: string;

  /** Industry */
  industry: string;

  /** Number of connections */
  connections: number;

  /** Profile views */
  profileViews: number;
}

// ----------------------------------------------------------------------------
// User Helper Types
// ----------------------------------------------------------------------------

/** User with social profile (MicroGram) */
export type SocialUser = UserProfile & { social: UserSocialData };

/** User with MicroHub profile */
export type MicroHubUser = UserProfile & { microhub: UserMicroHubData };

/** User with Scholar profile (MicroScholar) */
export type ScholarUser = UserProfile & { scholar: UserScholarData };

/** User with Microfy profile (MicroFy) */
export type MicrofyUser = UserProfile & { microfy: UserMicrofyData };

/** User with MicroDin profile (MicroDin) */
export type MicroDinUser = UserProfile & { microdin: UserMicroDinData };

// ============================================================================
// ENTITY TYPES (Organizations, Channels, Bands, etc.)
// ============================================================================

export type OrganizationType =
  | 'company'
  | 'channel'
  | 'band'
  | 'institution'
  | 'news_outlet'
  | 'microhub_org';

export interface Organization {
  /** Unique identifier, e.g., "org-techcorp" */
  id: string;

  /** Type of organization */
  type: OrganizationType;

  /** Display name */
  name: string;

  /** Handle/username, e.g., "@TechAcademy" */
  handle: string | null;

  /** Description/about text */
  description: string;

  /** Whether the organization is verified */
  isVerified: boolean;

  /** Whether this is the current user's own organization */
  isSelf?: boolean;

  // Visual Assets
  /** Path to avatar image, e.g., "images/orgs/org-techcorp-avatar.png" */
  avatarUrl: string | null;

  /** Path to banner image, e.g., "images/orgs/org-techcorp-banner.png" */
  bannerUrl: string | null;

  /** Fallback color for avatar */
  avatarColor: string;

  /** Fallback initials for avatar */
  initials: string;

  /** Platform-specific data */
  platforms: OrganizationPlatforms;
}

// ----------------------------------------------------------------------------
// Entity Platform Data
// ----------------------------------------------------------------------------

export interface OrganizationPlatforms {
  /** MicroTube channel data */
  microtube?: MicroTubePlatformData;

  /** MicroDin company data */
  microdin?: MicroDinPlatformData;

  /** MicroFy artist data */
  microfy?: MicroFyPlatformData;

  /** MicroHub organization data */
  microhub?: MicroHubPlatformData;

  /** MicroHood (stock trading) data */
  stocks?: StocksPlatformData;

  /** MicroScholar institution data */
  scholar?: ScholarPlatformData;

  /** MicroHood news outlet data */
  news?: NewsPlatformData;
}

export interface MicroTubePlatformData {
  /** Channel ID used in videos.jsonl, e.g., "ch-tech" */
  channelId: string;
  /** Number of subscribers */
  subscribers: number;
  /** Number of videos */
  videoCount: number;
}

export interface MicroDinPlatformData {
  /** Company ID used in jobs.jsonl, e.g., "company-techcorp" */
  companyId: string;
  /** Industry category */
  industry: string;
  /** Company size range */
  size: string;
  /** Number of employees */
  employees: number;
  /** Number of followers */
  followers: number;
  /** Location */
  location: string;
}

export interface MicroFyPlatformData {
  /** Artist ID used in tracks.jsonl, e.g., "artist-001" */
  artistId: string;
  /** Music genre */
  genre: string;
  /** Number of followers */
  followers: number;
  /** Monthly listeners */
  monthlyListeners: number;
}

export interface MicroHubPlatformData {
  /** Organization ID/slug, e.g., "themicrocorporate" */
  orgId: string;
  /** Number of repositories */
  repos: number;
  /** Number of members */
  members: number;
}

export interface StocksPlatformData {
  /** Stock ticker symbol */
  symbol: string;
  /** Market sector */
  sector: string;
}

export interface ScholarPlatformData {
  /** Type of institution */
  type: 'university' | 'lab' | 'journal';
  /** Department name */
  department?: string;
}

export interface NewsPlatformData {
  /** News category */
  category: 'finance' | 'tech' | 'general';
}

// ----------------------------------------------------------------------------
// Entity Helper Types
// ----------------------------------------------------------------------------

/** Get entities by type */
export type OrganizationByType<T extends OrganizationType> = Organization & { type: T };

/** MicroTube Channel Entity (convenience type for entities.json) */
export type MicroTubeChannelEntity = OrganizationByType<'channel'> & {
  platforms: { microtube: MicroTubePlatformData };
};

/** MicroDin Company Entity (convenience type for entities.json) */
export type MicroDinCompanyEntity = OrganizationByType<'company'> & {
  platforms: { microdin: MicroDinPlatformData };
};

/** MicroFy Artist Entity (convenience type for entities.json) */
export type MicroFyArtistEntity = OrganizationByType<'band'> & {
  platforms: { microfy: MicroFyPlatformData };
};

/** MicroHub Organization (convenience type) */
export type MicroHubOrganization = OrganizationByType<'microhub_org'> & {
  platforms: { microhub: MicroHubPlatformData };
};

/** Academic Institution (convenience type) */
export type AcademicInstitution = OrganizationByType<'institution'> & {
  platforms: { scholar: ScholarPlatformData };
};

/** News Outlet (convenience type) */
export type NewsOutlet = OrganizationByType<'news_outlet'> & {
  platforms: { news: NewsPlatformData };
};
