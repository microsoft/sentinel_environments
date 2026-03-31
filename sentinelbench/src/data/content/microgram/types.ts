/**
 * MicroGram Type Definitions
 *
 * Type definitions for the MicroGram environment (photo sharing platform).
 * Actual data is stored in .jsonl files in this directory.
 *
 * Note: Timestamps are NOT stored statically. The `order` field controls
 * when items appear during a task, and display times are computed dynamically
 * based on when items actually appeared in the session.
 */

// ============================================================================
// POST TYPES
// ============================================================================

export interface MicroGramPost {
  id: string;
  authorId: string;
  imageUrl: string;
  caption: string;
  location?: string;
  likes: number;
  comments: MicroGramComment[];
  isLiked?: boolean;
  isSaved?: boolean;
  isTargetPost?: boolean;
  order: number;
  taskType?: 'like' | 'comment' | 'save' | 'target' | 'noise';
}

export interface MicroGramComment {
  id: string;
  authorId: string;
  text: string;
  likes?: number;
  replies?: MicroGramComment[];
}

// ============================================================================
// STORY TYPES
// ============================================================================

export interface MicroGramStory {
  id: string;
  authorId: string;
  mediaUrl: string;
  mediaType: 'image' | 'video';
  duration?: number;
  isViewed?: boolean;
  order: number;
}

// ============================================================================
// MESSAGING TYPES
// ============================================================================

export interface MicroGramDirectMessage {
  id: string;
  participantIds: string[];
  lastMessage: string;
  unreadCount: number;
  messages: MicroGramMessage[];
  order: number;
}

export interface MicroGramMessage {
  id: string;
  senderId: string;
  text: string;
  isRead?: boolean;
  order: number;
  postPreview?: {
    postId: string;
    imageUrl: string;
    caption?: string;
  };
}

// ============================================================================
// ACTIVITY TYPES
// ============================================================================

export interface MicroGramActivity {
  id: string;
  type: 'like' | 'comment' | 'follow' | 'mention' | 'tag';
  actorId: string;
  targetPostId?: string;
  text?: string;
  isRead?: boolean;
  order: number;
}

// ============================================================================
// OTHER TYPES
// ============================================================================

export interface MicroGramSuggestion {
  userId: string;
  reason: string;
  order: number;
}

export interface MicroGramExploreTile {
  id: string;
  postId: string;
  imageUrl: string;
  isVideo?: boolean;
  isCarousel?: boolean;
}
