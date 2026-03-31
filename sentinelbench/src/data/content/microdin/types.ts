/**
 * MicroDin Type Definitions
 *
 * Type definitions for the MicroDin environment (MicroDin platform).
 * Actual data is stored in .jsonl files in this directory.
 *
 * Note: Timestamps are NOT stored statically. The `order` field controls
 * when items appear during a task, and display times are computed dynamically
 * based on when items actually appeared in the session.
 */

// ============================================================================
// POST TYPES
// ============================================================================

export interface MicroDinPost {
  id: string;
  authorId: string;
  content: string;
  imageUrl?: string;
  likes: number;
  comments: MicroDinComment[];
  shares: number;
  isLiked?: boolean;
  order: number;
  taskType?: 'posts' | 'noise';
}

export interface MicroDinComment {
  id: string;
  authorId: string;
  text: string;
  likes: number;
  replies?: MicroDinComment[];
}

// ============================================================================
// CONNECTION TYPES
// ============================================================================

export interface MicroDinConnection {
  id: string;
  userId: string;
  status: 'pending' | 'connected' | 'ignored';
  mutualConnections: number;
  order: number;
  taskType?: 'connections' | 'noise';
}

// ============================================================================
// MESSAGING TYPES
// ============================================================================

export interface MicroDinConversation {
  id: string;
  participantIds: string[];
  lastMessage: string;
  unreadCount: number;
  messages: MicroDinMessage[];
  order: number;
  taskType?: 'messages' | 'noise';
}

export interface MicroDinMessage {
  id: string;
  senderId: string;
  text: string;
  isRead?: boolean;
  order: number;
}

// ============================================================================
// NOTIFICATION TYPES
// ============================================================================

export interface MicroDinNotification {
  id: string;
  type: 'like' | 'comment' | 'connection' | 'mention' | 'job' | 'profile_view';
  actorId: string;
  targetPostId?: string;
  text?: string;
  isRead?: boolean;
  order: number;
  taskType?: 'notifications' | 'noise';
}

// ============================================================================
// JOB TYPES
// ============================================================================

export interface MicroDinJob {
  id: string;
  title: string;
  companyId: string;
  location: string;
  type: 'full-time' | 'part-time' | 'contract' | 'internship';
  description: string;
  requirements: string[];
  applicants: number;
  isApplied?: boolean;
  isSaved?: boolean;
  order: number;
  taskType?: 'jobs' | 'noise';
}

// ============================================================================
// COMPANY TYPES
// ============================================================================

export interface MicroDinCompany {
  id: string;
  name: string;
  industry: string;
  size: string;
  location: string;
  about: string;
  employees: number;
  followers: number;
  logoColor: string;
  initial: string;
}

// ============================================================================
// PERSON TYPES (Extended profile data)
// ============================================================================

export interface MicroDinPerson {
  id: string;
  userId: string;
  headline: string;
  about: string;
  experience: MicroDinExperience[];
  education: MicroDinEducation[];
  skills: string[];
  connections: number;
}

export interface MicroDinExperience {
  role: string;
  companyId: string;
  duration: string;
  location: string;
  description: string;
}

export interface MicroDinEducation {
  degree: string;
  school: string;
  years: string;
}
