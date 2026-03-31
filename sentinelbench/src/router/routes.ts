import { FC } from "react";

// =============================================================================
// =============================================================================
// ENVIRONMENT COMPONENTS (from src/environments/)
// These are unified environments with multi-task support via URL parameters
// =============================================================================
// =============================================================================
import MicroMail, { TASK_ID_MICROMAIL } from "../environments/MicroMail";
import MicroHub, { TASK_ID_MICROHUB } from "../environments/MicroHub";
import MicroGram, { TASK_ID_MICROGRAM } from "../environments/MicroGram";
import MicroLendar, { TASK_ID_MICROLENDAR } from "../environments/MicroLendar";
import MicroScholar, { TASK_ID_MICROSCHOLAR } from "../environments/MicroScholar";
import MicroChat, { TASK_ID_MICROCHAT } from "../environments/MicroChat";
import MicroHood, { TASK_ID_MICROHOOD } from "../environments/MicroHood";
import MicroDin, { TASK_ID_MICRODIN } from "../environments/MicroDin";
import MicroTube, { TASK_ID_MICROTUBE } from "../environments/MicroTube";
import MicroFy, { TASK_ID_MICROFY } from "../environments/MicroFy";

export interface RouteConfig {
  /**
   * Optional unique task identifier for dataset export.
   * When omitted, defaults to `path`.
   */
  id?: string;
  /**
   * Used to control which tasks are shown by default in the UI.
   * `environment` = current benchmark environments (src/environments/).
   */
  category?: "environment";
  path: string;
  title: string;
  description: string;
  url?: string;
  icon: string;
  component: FC | null;
  tags: string[];
  base_task?: string;
  task_type?: "time-based" | "repetition-based";
  task_description?: string;
  penalties?: boolean;
  penalty?: string;
  variants?: Array<{
    path: string;
    title: string;
    component: FC;
  }>;
}

export const routes: RouteConfig[] = [
  // ===========================================================================
  // ===========================================================================
  // ENVIRONMENT REPLICAS - Current Benchmark Environments
  // Each environment supports 20 task variants via URL parameters:
  //   5 task types × 2 criteria (absolute/relative) × 2 activity (passive/active)
  // ===========================================================================
  // ===========================================================================

  // ===========================================================================
  // MICROMAIL (Email Client)
  // ===========================================================================
  {
    path: TASK_ID_MICROMAIL,
    title: "MicroMail",
    description: "Email client environment (variant selectable via URL params).",
    url: "{base_url}/micromail",
    icon: "📧",
    component: MicroMail,
    category: "environment",
    tags: ["sentinel", "environment", "monitoring", "email", "productivity", "configurable"],
    base_task: "micromail",
    task_type: "time-based",
    task_description: "Email client environment. Select one of 20 variants via URL params: task (unread|junk|attachment|flagged|inbox), criteria (absolute|relative), activity (active|passive), duration (seconds).",
    penalties: false,
    penalty: "Low"
  },

  // ===========================================================================
  // MICROHUB (Code Repository)
  // ===========================================================================
  {
    path: TASK_ID_MICROHUB,
    title: "MicroHub",
    description: "Code repository environment with repositories, issues, and pull requests",
    url: "{base_url}/microhub",
    icon: "⌨️",
    component: MicroHub,
    category: "environment",
    tags: ["sentinel", "environment", "monitoring", "code", "repository"],
    base_task: "microhub",
    task_type: "time-based",
    task_description: "Code repository environment supporting task variants via URL parameters: task (stars|issues|prs|commits|releases), criteria (absolute|relative), activity (active|passive), and duration.",
    penalties: false,
    penalty: "Low"
  },

  // ===========================================================================
  // MICROGRAM (Photo Sharing)
  // ===========================================================================
  {
    path: TASK_ID_MICROGRAM,
    title: "MicroGram",
    description: "Photo sharing environment with task variants via URL parameters.",
    url: "{base_url}/microgram",
    icon: "📸",
    component: MicroGram,
    category: "environment",
    tags: ["sentinel", "environment", "monitoring", "social", "photos"],
    base_task: "microgram",
    task_type: "time-based",
    task_description: "Photo sharing environment supporting multiple task variants. Tasks are configured via URL params: task (like|comment|follow|save|story), criteria (absolute|relative), activity (active|passive), and duration. Each combination has a unique evaluation query.",
    penalties: false,
    penalty: "Low"
  },

  // ===========================================================================
  // MICROLENDAR (Calendar)
  // ===========================================================================
  {
    path: TASK_ID_MICROLENDAR,
    title: "MicroLendar",
    description: "Calendar environment with task variants via URL parameters.",
    url: "{base_url}/microlendar",
    icon: "📅",
    component: MicroLendar,
    category: "environment",
    tags: ["sentinel", "environment", "monitoring", "calendar", "scheduling"],
    base_task: "microlendar",
    task_type: "time-based",
    task_description: "Calendar environment supporting multiple task variants. Tasks are configured via URL params: task (events|today|work|tasks|conflict), criteria (absolute|relative), activity (active|passive), and duration.",
    penalties: false,
    penalty: "Low"
  },

  // ===========================================================================
  // MICROSCHOLAR (Academic Search)
  // ===========================================================================
  {
    path: TASK_ID_MICROSCHOLAR,
    title: "MicroScholar",
    description: "Academic search environment with task variants via URL parameters",
    url: "{base_url}/microscholar",
    icon: "🎓",
    component: MicroScholar,
    category: "environment",
    tags: ["sentinel", "environment", "monitoring", "research", "academic"],
    base_task: "microscholar",
    task_type: "time-based",
    task_description: "Academic search environment supporting multiple task variants. Tasks are configured via URL parameters: task (citation|new_paper|cited_by|alert|search), criteria (absolute|relative), activity (active|passive), and duration. Each combination has a unique evaluation query.",
    penalties: false,
    penalty: "Low"
  },

  // ===========================================================================
  // MICROCHAT (Team Collaboration)
  // ===========================================================================
  {
    path: TASK_ID_MICROCHAT,
    title: "MicroChat",
    description: "Team collaboration environment with chat and workspaces",
    url: "{base_url}/microchat",
    icon: "💬",
    component: MicroChat,
    category: "environment",
    tags: ["sentinel", "environment", "monitoring", "chat", "collaboration"],
    base_task: "microchat",
    task_type: "time-based",
    task_description: "Team collaboration environment supporting task variants via URL parameters: task (messages|mentions|reactions|channels|calls), criteria (absolute|relative), activity (active|passive), and duration.",
    penalties: false,
    penalty: "Low"
  },

  // ===========================================================================
  // MICRODIN (Professional Network)
  // ===========================================================================
  {
    path: TASK_ID_MICRODIN,
    title: "MicroDin",
    description: "Professional network environment with task variants via URL parameters",
    url: "{base_url}/microdin",
    icon: "💼",
    component: MicroDin,
    category: "environment",
    tags: ["sentinel", "environment", "monitoring", "professional", "network"],
    base_task: "microdin",
    task_type: "time-based",
    task_description: "Professional network environment supporting multiple task variants. Tasks are configured via URL params: task (posts|connections|messages|notifications|jobs), criteria (absolute|relative), activity (active|passive), and duration. Each combination has a unique evaluation query.",
    penalties: false,
    penalty: "Low"
  },

  // ===========================================================================
  // MICROHOOD (Trading Platform)
  // ===========================================================================
  {
    path: TASK_ID_MICROHOOD,
    title: "MicroHood",
    description: "Stock trading platform environment with task variants via URL parameters",
    url: "{base_url}/microhood",
    icon: "📈",
    component: MicroHood,
    category: "environment",
    tags: ["sentinel", "environment", "monitoring", "trading", "stocks", "finance"],
    base_task: "microhood",
    task_type: "time-based",
    task_description: "Stock trading platform environment supporting multiple task variants. Tasks are configured via URL params: task (price|portfolio|orders|alerts|watchlist), criteria (absolute|relative), activity (active|passive), and duration. Each combination has a unique evaluation query.",
    penalties: false,
    penalty: "Low"
  },

  // ===========================================================================
  // MICROTUBE (Video Streaming)
  // ===========================================================================
  {
    path: TASK_ID_MICROTUBE,
    title: "MicroTube",
    description: "Video streaming platform environment with task variants via URL parameters",
    url: "{base_url}/microtube",
    icon: "📺",
    component: MicroTube,
    category: "environment",
    tags: ["sentinel", "environment", "monitoring", "video", "streaming"],
    base_task: "microtube",
    task_type: "time-based",
    task_description: "Video streaming platform environment supporting multiple task variants. Tasks are configured via URL params: task (subscribers|views|likes|comments|notifications), criteria (absolute|relative), activity (active|passive), and duration. Each combination has a unique evaluation query.",
    penalties: false,
    penalty: "Low"
  },

  // ===========================================================================
  // MICROFY (Music Streaming)
  // ===========================================================================
  {
    path: TASK_ID_MICROFY,
    title: "MicroFy",
    description: "Music streaming environment with task variants via URL parameters",
    url: "{base_url}/microfy",
    icon: "🎧",
    component: MicroFy,
    category: "environment",
    tags: ["sentinel", "environment", "monitoring", "music", "streaming"],
    base_task: "microfy",
    task_type: "time-based",
    task_description: "Music streaming environment supporting multiple task variants. Tasks are configured via URL params: task (newreleases|followers|playlists|likes|plays), criteria (absolute|relative), activity (active|passive), and duration. Each combination has a unique evaluation query.",
    penalties: false,
    penalty: "Low"
  },
];
