/**
 * Environment Components
 *
 * These are the 10 unified environments for SentinelBench v2.
 * Each environment supports multi-task variants via URL parameters.
 *
 * URL Schema:
 *   /{environment}?task={type}&criteria={absolute|relative}&activity={active|passive}&duration={seconds}
 *
 * Each environment uses SQL-based evaluation queries for success verification.
 *
 * Target: 10 environments × 20 tasks × 5 durations = 1000 total configurations
 */

// 1. MicroMail - Email client environment
export { default as MicroMail, TASK_ID_MICROMAIL } from './MicroMail';

// 2. MicroChat - Team collaboration environment
export { default as MicroChat, TASK_ID_MICROCHAT } from './MicroChat';

// 3. MicroDin - Professional network environment
export { default as MicroDin, TASK_ID_MICRODIN } from './MicroDin';

// 4. MicroHub - Code repository environment
export { default as MicroHub, TASK_ID_MICROHUB } from './MicroHub';

// 5. MicroHood - Trading platform environment
export { default as MicroHood, TASK_ID_MICROHOOD } from './MicroHood';

// 6. MicroGram - Photo sharing environment
export { default as MicroGram, TASK_ID_MICROGRAM } from './MicroGram';

// 7. MicroTube - Video streaming environment
export { default as MicroTube, TASK_ID_MICROTUBE } from './MicroTube';

// 8. MicroFy - Music streaming environment
export { default as MicroFy, TASK_ID_MICROFY } from './MicroFy';

// 9. MicroLendar - Calendar environment
export { default as MicroLendar, TASK_ID_MICROLENDAR } from './MicroLendar';

// 10. MicroScholar - Academic search environment
export { default as MicroScholar, TASK_ID_MICROSCHOLAR } from './MicroScholar';
