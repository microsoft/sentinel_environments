/**
 * MicroTube Type Definitions
 *
 * Type definitions for the MicroTube environment (MicroTube video platform).
 * Actual data is stored in .jsonl files in this directory.
 */

export interface MicroTubeVideo {
  id: string;
  task: string;
  order: number;
  channel_id: string;
  title: string;
  description: string;
  views: number;
  likes: number;
  dislikes: number;
  comments: number;
  duration: string; // e.g., "12:34"
  thumbnailColor: string;
  /** Path to video file relative to public/, e.g., "videos/microtube/vid-1.webm" */
  videoSrc?: string;
  /** Path to thumbnail image relative to public/, e.g., "videos/microtube/thumbnails/vid-1.jpg" */
  thumbnailSrc?: string;
  publishedAt?: string;
  isLive?: boolean;
  isShort?: boolean;
}

export interface MicroTubeChannel {
  id: string;
  name: string;
  handle: string; // e.g., "@TechAcademy"
  subscribers: number;
  videos: number;
  /** Path to avatar image relative to public/, e.g., "videos/microtube/channels/tech-academy-avatar.jpg" */
  avatarSrc?: string;
  /** Path to banner image relative to public/, e.g., "videos/microtube/channels/tech-academy-banner.jpg" */
  bannerSrc?: string;
  /** Fallback color for avatar if no image */
  avatarColor?: string;
  description?: string;
  isVerified?: boolean;
  /** True if this is the current user's own channel */
  isSelf?: boolean;
}

export interface MicroTubeComment {
  id: string;
  task: string;
  order: number;
  video_id: string;
  user_id: string;
  content: string;
  likes: number;
  replies?: number;
}

export interface MicroTubeNotification {
  id: string;
  task: string;
  order: number;
  type: "upload" | "live" | "comment" | "mention" | "community";
  channel_id?: string;
  video_id?: string;
  message: string;
  isRead: boolean;
}

export interface MicroTubeSubscription {
  id: string;
  channel_id: string;
  subscribedAt: string;
  notificationsEnabled: boolean;
}
