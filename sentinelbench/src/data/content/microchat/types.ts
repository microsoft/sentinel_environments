/**
 * MicroChat Type Definitions
 *
 * Type definitions for the MicroChat environment (Microsoft Teams replica).
 * Actual data is stored in .jsonl files in this directory.
 *
 * Note: Timestamps are NOT stored statically. The `order` field controls
 * when items appear during a task, and display times are computed dynamically
 * based on when items actually appeared in the session.
 */

// ============================================================================
// TEAM TYPES
// ============================================================================

export interface MicroChatTeam {
  id: string;
  name: string;
  description?: string;
  avatarUrl?: string;
  avatarColor: string;
  avatarInitials: string;
  memberCount: number;
  /** User IDs of team members (references users.json) */
  memberIds: string[];
  /** User ID of team owner */
  ownerId: string;
  channels: MicroChatChannel[];
  order: number;
}

export interface MicroChatChannel {
  id: string;
  name: string;
  description?: string;
  unreadCount: number;
  isPinned: boolean;
}

// ============================================================================
// CONVERSATION TYPES
// ============================================================================

export interface MicroChatConversation {
  id: string;
  type: 'direct' | 'group' | 'meeting' | 'channel';
  name: string;
  /** User IDs of participants (references users.json) */
  participantIds: string[];
  avatarColor?: string;
  teamId?: string;
  isPinned: boolean;
  isMuted: boolean;
  order: number;
}

export interface MicroChatMessage {
  id: string;
  conversationId: string;
  senderId: string;
  content: string;
  isRead: boolean;
  reactions?: MicroChatReaction[];
  attachments?: MicroChatAttachment[];
  replyToId?: string;
  order: number;
}

export interface MicroChatReaction {
  emoji: string;
  userIds: string[];
}

export interface MicroChatAttachment {
  name: string;
  type: 'file' | 'image' | 'link';
  size?: string;
  url?: string;
}

// ============================================================================
// SAMPLE MESSAGE TYPES
// ============================================================================

export interface MicroChatSampleMessage {
  id: string;
  content: string;
  /** Category of message for contextual generation */
  category: 'project' | 'meeting' | 'general' | 'technical' | 'social';
}

// ============================================================================
// CALL HISTORY TYPES
// ============================================================================

export interface MicroChatCall {
  id: string;
  /** Display name for the call */
  name: string;
  /** User ID if it's a 1:1 call (references users.json), null for group calls */
  userId: string | null;
  /** Type of call */
  type: 'incoming' | 'outgoing' | 'group';
  /** Duration of the call (e.g., "12:34"), empty string if missed */
  duration: string;
  /** Relative time display (e.g., "2 hours ago", "Yesterday") */
  time: string;
  /** Whether the call was missed */
  missed: boolean;
  /** Order for display sorting */
  order: number;
}

// ============================================================================
// ACTIVITY TYPES
// ============================================================================

export interface MicroChatActivity {
  id: string;
  type: 'mention' | 'reply' | 'reaction' | 'team_add' | 'meeting_reminder';
  /** User ID who triggered the activity (not needed for meeting_reminder) */
  actorId?: string;
  /** Conversation where the activity occurred */
  targetConversationId?: string;
  /** Channel name for channel mentions */
  channelName?: string;
  /** Team ID for team_add events */
  teamId?: string;
  /** Team name for team_add events */
  teamName?: string;
  /** Meeting name for meeting_reminder events */
  meetingName?: string;
  /** Meeting time for meeting_reminder events */
  meetingTime?: string;
  /** Message text or preview */
  text?: string;
  /** Preview of the message that was reacted to */
  messagePreview?: string;
  /** Emoji for reaction events */
  emoji?: string;
  /** Whether the activity has been read */
  isRead: boolean;
  /** Order for display sorting */
  order: number;
  /** Timestamp when the activity occurred (generated dynamically) */
  timestamp?: number;
}
