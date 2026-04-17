// Canonical shape of the self user as returned by `/api/data/config`
// and as stored in `data/catalogs/users.json`. The backend is the single
// source of truth — frontends should never synthesize these fields.

export interface MicrofyProfile {
  followers?: number;
  following?: number;
  playlistCount?: number;
  likedTracksCount?: number;
  monthlyListeners?: number;
  isPremium?: boolean;
  joinedDate?: string;
  topGenres?: string[];
  recentlyPlayedArtists?: string[];
  publicPlaylists?: Array<{ id: string; name: string; trackCount: number }>;
}

export interface MicroscholarProfile {
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
}

export interface MicrogramProfile {
  followers?: number;
  following?: number;
  postsCount?: number;
  isVerified?: boolean;
  hasStory?: boolean;
  storyId?: string;
  website?: string;
}

export interface MicrohubProfile {
  followers?: number;
  following?: number;
  joinedDate?: string;
  pinnedRepos?: string[];
  achievements?: Array<{
    id: string;
    name: string;
    icon: string;
    description: string;
    earnedDate: string;
  }>;
  contributionData?: unknown;
}

export interface MicrodinProfile {
  company?: string;
  companyId?: string;
  industry?: string;
  connections?: number;
  profileViews?: number;
}

export interface ApiSelfUser {
  id: string;
  name: string;
  username: string;
  email: string;
  avatarUrl: string;
  bannerUrl?: string;
  bio?: string;
  jobTitle?: string;
  location?: string;
  interests?: string[];
  age?: number;
  gender?: string;
  race?: string;
  personality_tags?: string[];
  isSelf?: boolean;

  microdin?: MicrodinProfile;
  microfy?: MicrofyProfile;
  microhub?: MicrohubProfile;
  microscholar?: MicroscholarProfile;
  microgram?: MicrogramProfile;
}
