/**
 * MicroFy Type Definitions
 *
 * Type definitions for the MicroFy environment (music streaming platform).
 * Actual data is stored in .jsonl files in this directory.
 *
 * Note: Timestamps are NOT stored statically. The `order` field controls
 * when items appear during a task, and display times are computed dynamically
 * based on when items actually appeared in the session.
 */

// ============================================================================
// TRACK TYPES
// ============================================================================

export interface MicroFyTrack {
  id: string;
  title: string;
  artistId: string;
  artistName: string;
  albumId?: string;
  albumName?: string;
  duration: string; // Format: "M:SS" (e.g., "3:45")
  durationSeconds: number;
  description?: string;
  coverColor: string; // Hex color for placeholder cover
  coverInitials: string; // Initials for placeholder cover
  genre?: string;
  lyrics?: string;
  isExplicit?: boolean;
  playCount?: number;
  // Task-related fields
  isNewRelease?: boolean;
  order: number;
  taskType?: 'newrelease' | 'liked' | 'playlist' | 'noise';
}

// ============================================================================
// ARTIST TYPES
// ============================================================================

export interface MicroFyArtist {
  id: string;
  name: string;
  bio?: string;
  genre?: string;
  followers: number;
  monthlyListeners?: number;
  coverColor: string;
  coverInitials: string;
  isVerified?: boolean;
  order: number;
}

// ============================================================================
// PLAYLIST TYPES
// ============================================================================

export interface MicroFyPlaylist {
  id: string;
  name: string;
  description?: string;
  ownerId: string;
  ownerName: string;
  trackIds: string[];
  followerCount: number;
  coverColor: string;
  coverInitials: string;
  isPublic: boolean;
  order: number;
}

// ============================================================================
// MOOD/GENRE TYPES
// ============================================================================

export interface MicroFyMood {
  id: string;
  name: string;
  description?: string;
  coverColor: string;
  order: number;
}

// ============================================================================
// ACTIVITY TYPES (for followers, likes, plays tracking)
// ============================================================================

export interface MicroFyActivity {
  id: string;
  type: 'follow' | 'like' | 'play' | 'playlist_add' | 'new_release';
  actorId?: string;
  actorName?: string;
  targetId: string;
  targetType: 'track' | 'artist' | 'playlist' | 'user';
  targetName: string;
  order: number;
  taskType?: 'target' | 'noise';
}

// ============================================================================
// USER MUSIC PROFILE (nested in users.json under "microfy" key)
// ============================================================================

export interface MicroFyUserProfile {
  followers: number;
  following: number;
  playlistCount: number;
  likedTracksCount: number;
  monthlyListeners: number;
  isPremium: boolean;
  joinedDate: string;
  topGenres: string[];
  recentlyPlayedArtists: string[];
  // Note: User's playlists are stored in playlists.jsonl with ownerId reference
}
