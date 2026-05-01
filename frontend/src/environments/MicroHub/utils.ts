// Shared utility functions used by MicroHub's index.tsx and its extracted
// child components. Lives in its own module so component files can import
// these without creating a runtime circular import with index.tsx.

export const classNames = (...classes: (string | false | null | undefined)[]) =>
  classes.filter(Boolean).join(" ");

export const getInitials = (name: string) =>
  name
    .split(" ")
    .slice(0, 2)
    .map((n) => n[0])
    .join("")
    .toUpperCase();

export const getAvatarColor = (name: string) => {
  const colors = ["#e11d48", "#db2777", "#c026d3", "#9333ea", "#7c3aed", "#6366f1", "#3b82f6", "#0ea5e9", "#14b8a6", "#22c55e", "#eab308", "#f97316"];
  const index = name.charCodeAt(0) % colors.length;
  return colors[index];
};

/**
 * Format a relative timestamp ("3 hours ago", "yesterday", etc.) for display
 * next to commits, releases, etc.
 *
 * `order` is the position of an item in its source list, where lower numbers
 * are newer. Each step represents 30 simulated minutes — that produces a
 * realistic-looking spread of timestamps for static data shipped with the
 * environment without ever hitting "in the future".
 *
 * If `createdAt` (real epoch ms) is provided, it overrides the order-based
 * heuristic — used for items created during the session so they show
 * "just now" at creation and age in real time.
 */
export const computeRelativeTimestamp = (
  order: number,
  sessionStartTime: number,
  createdAt?: number,
): string => {
  let totalMinutesAgo: number;
  if (createdAt && createdAt > 0) {
    totalMinutesAgo = Math.floor((Date.now() - createdAt) / 60000);
  } else {
    const simulatedMinutesAgo = order * 30;
    const realElapsedMinutes = Math.floor((Date.now() - sessionStartTime) / 60000);
    totalMinutesAgo = simulatedMinutesAgo + realElapsedMinutes;
  }

  if (totalMinutesAgo < 1) return "just now";
  if (totalMinutesAgo < 60) return `${totalMinutesAgo} minutes ago`;
  if (totalMinutesAgo < 120) return "1 hour ago";
  if (totalMinutesAgo < 1440) return `${Math.floor(totalMinutesAgo / 60)} hours ago`;
  if (totalMinutesAgo < 2880) return "yesterday";
  if (totalMinutesAgo < 10080) return `${Math.floor(totalMinutesAgo / 1440)} days ago`;
  if (totalMinutesAgo < 43200) return `${Math.floor(totalMinutesAgo / 10080)} weeks ago`;
  return `${Math.floor(totalMinutesAgo / 43200)} months ago`;
};
