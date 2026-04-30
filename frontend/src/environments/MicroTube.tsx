import React, { useState, useEffect, useRef, useCallback, useMemo } from "react";

import { useMicrotubeData } from "../hooks/useMicrotubeData";
import { useHashRoute } from "../hooks/useHashRoute";

export const TASK_ID_MICROTUBE = "microtube";

// SVG Icons - matching video platform design language
interface IconProps {
  size?: number;
  className?: string;
}

const MenuIcon = ({ size = 24, className = "" }: IconProps) => (
  <svg width={size} height={size} viewBox="0 0 24 24" className={className} fill="currentColor">
    <path d="M3 18h18v-2H3v2zm0-5h18v-2H3v2zm0-7v2h18V6H3z" />
  </svg>
);

const SearchIcon = ({ size = 24, className = "" }: IconProps) => (
  <svg width={size} height={size} viewBox="0 0 24 24" className={className} fill="currentColor">
    <path d="M15.5 14h-.79l-.28-.27C15.41 12.59 16 11.11 16 9.5 16 5.91 13.09 3 9.5 3S3 5.91 3 9.5 5.91 16 9.5 16c1.61 0 3.09-.59 4.23-1.57l.27.28v.79l5 4.99L20.49 19l-4.99-5zm-6 0C7.01 14 5 11.99 5 9.5S7.01 5 9.5 5 14 7.01 14 9.5 11.99 14 9.5 14z" />
  </svg>
);

const MicIcon = ({ size = 24, className = "" }: IconProps) => (
  <svg width={size} height={size} viewBox="0 0 24 24" className={className} fill="currentColor">
    <path d="M12 14c1.66 0 2.99-1.34 2.99-3L15 5c0-1.66-1.34-3-3-3S9 3.34 9 5v6c0 1.66 1.34 3 3 3zm5.3-3c0 3-2.54 5.1-5.3 5.1S6.7 14 6.7 11H5c0 3.41 2.72 6.23 6 6.72V21h2v-3.28c3.28-.48 6-3.3 6-6.72h-1.7z" />
  </svg>
);

const NotificationsIcon = ({ size = 24, className = "" }: IconProps) => (
  <svg width={size} height={size} viewBox="0 0 24 24" className={className} fill="currentColor">
    <path d="M12 22c1.1 0 2-.9 2-2h-4c0 1.1.89 2 2 2zm6-6v-5c0-3.07-1.64-5.64-4.5-6.32V4c0-.83-.67-1.5-1.5-1.5s-1.5.67-1.5 1.5v.68C7.63 5.36 6 7.92 6 11v5l-2 2v1h16v-1l-2-2z" />
  </svg>
);

const VideoCallIcon = ({ size = 24, className = "" }: IconProps) => (
  <svg width={size} height={size} viewBox="0 0 24 24" className={className} fill="currentColor">
    <path d="M17 10.5V7c0-.55-.45-1-1-1H4c-.55 0-1 .45-1 1v10c0 .55.45 1 1 1h12c.55 0 1-.45 1-1v-3.5l4 4v-11l-4 4zM14 13h-3v3H9v-3H6v-2h3V8h2v3h3v2z" />
  </svg>
);

const SettingsIcon = ({ size = 24, className = "" }: IconProps) => (
  <svg width={size} height={size} viewBox="0 0 24 24" className={className} fill="currentColor">
    <path d="M19.14 12.94c.04-.3.06-.61.06-.94 0-.32-.02-.64-.07-.94l2.03-1.58c.18-.14.23-.41.12-.61l-1.92-3.32c-.12-.22-.37-.29-.59-.22l-2.39.96c-.5-.38-1.03-.7-1.62-.94l-.36-2.54c-.04-.24-.24-.41-.48-.41h-3.84c-.24 0-.43.17-.47.41l-.36 2.54c-.59.24-1.13.57-1.62.94l-2.39-.96c-.22-.08-.47 0-.59.22L2.74 8.87c-.12.21-.08.47.12.61l2.03 1.58c-.05.3-.09.63-.09.94s.02.64.07.94l-2.03 1.58c-.18.14-.23.41-.12.61l1.92 3.32c.12.22.37.29.59.22l2.39-.96c.5.38 1.03.7 1.62.94l.36 2.54c.05.24.24.41.48.41h3.84c.24 0 .44-.17.47-.41l.36-2.54c.59-.24 1.13-.56 1.62-.94l2.39.96c.22.08.47 0 .59-.22l1.92-3.32c.12-.22.07-.47-.12-.61l-2.01-1.58zM12 15.6c-1.98 0-3.6-1.62-3.6-3.6s1.62-3.6 3.6-3.6 3.6 1.62 3.6 3.6-1.62 3.6-3.6 3.6z" />
  </svg>
);

const HomeIcon = ({ size = 24, className = "" }: IconProps) => (
  <svg width={size} height={size} viewBox="0 0 24 24" className={className} fill="currentColor">
    <path d="M10 20v-6h4v6h5v-8h3L12 3 2 12h3v8z" />
  </svg>
);

const ShortsIcon = ({ size = 24, className = "" }: IconProps) => (
  <svg width={size} height={size} viewBox="0 0 24 24" className={className} fill="currentColor">
    <path d="M10 14.65v-5.3L15 12l-5 2.65zm7.77-4.33l-1.2-.5L18 9.06c1.84-.96 2.53-3.23 1.56-5.06s-3.24-2.53-5.07-1.56L6 6.94c-1.29.68-2.07 2.04-2 3.49.07 1.42.93 2.67 2.22 3.25.03.01 1.2.5 1.2.5L6 14.93c-1.83.97-2.53 3.24-1.56 5.07.97 1.83 3.24 2.53 5.07 1.56l8.5-4.5c1.29-.68 2.06-2.04 1.99-3.49-.07-1.42-.94-2.68-2.23-3.25zm-.23 5.86l-8.5 4.5c-1.34.71-3.01.2-3.72-1.14-.71-1.34-.2-3.01 1.14-3.72l2.04-1.08v-1.21l-.69-.28-1.11-.46c-.99-.41-1.65-1.35-1.7-2.41-.05-1.06.52-2.06 1.46-2.56l8.5-4.5c1.34-.71 3.01-.2 3.72 1.14.71 1.34.2 3.01-1.14 3.72L15.5 9.26v1.21l1.8.74c.99.41 1.65 1.35 1.7 2.41.05 1.06-.52 2.06-1.46 2.56z" />
  </svg>
);

const SubscriptionsIcon = ({ size = 24, className = "" }: IconProps) => (
  <svg width={size} height={size} viewBox="0 0 24 24" className={className} fill="currentColor">
    <path d="M10 18v-6l5 3-5 3zm7-15H7v2h10V3zm3 3H4v2h16V6zm2 3H2v12h20V9zM3 10h18v10H3V10z" />
  </svg>
);

const LibraryIcon = ({ size = 24, className = "" }: IconProps) => (
  <svg width={size} height={size} viewBox="0 0 24 24" className={className} fill="currentColor">
    <path d="M4 6H2v14c0 1.1.9 2 2 2h14v-2H4V6zm16-4H8c-1.1 0-2 .9-2 2v12c0 1.1.9 2 2 2h12c1.1 0 2-.9 2-2V4c0-1.1-.9-2-2-2zm-8 12.5v-9l6 4.5-6 4.5z" />
  </svg>
);

const HistoryIcon = ({ size = 24, className = "" }: IconProps) => (
  <svg width={size} height={size} viewBox="0 0 24 24" className={className} fill="currentColor">
    <path d="M13 3c-4.97 0-9 4.03-9 9H1l3.89 3.89.07.14L9 12H6c0-3.87 3.13-7 7-7s7 3.13 7 7-3.13 7-7 7c-1.93 0-3.68-.79-4.94-2.06l-1.42 1.42C8.27 19.99 10.51 21 13 21c4.97 0 9-4.03 9-9s-4.03-9-9-9zm-1 5v5l4.28 2.54.72-1.21-3.5-2.08V8H12z" />
  </svg>
);


const LikeIcon = ({ size = 24, className = "" }: IconProps) => (
  <svg width={size} height={size} viewBox="0 0 24 24" className={className} fill="currentColor">
    <path d="M1 21h4V9H1v12zm22-11c0-1.1-.9-2-2-2h-6.31l.95-4.57.03-.32c0-.41-.17-.79-.44-1.06L14.17 1 7.59 7.59C7.22 7.95 7 8.45 7 9v10c0 1.1.9 2 2 2h9c.83 0 1.54-.5 1.84-1.22l3.02-7.05c.09-.23.14-.47.14-.73v-2z" />
  </svg>
);

const DislikeIcon = ({ size = 24, className = "" }: IconProps) => (
  <svg width={size} height={size} viewBox="0 0 24 24" className={className} fill="currentColor">
    <path d="M15 3H6c-.83 0-1.54.5-1.84 1.22l-3.02 7.05c-.09.23-.14.47-.14.73v2c0 1.1.9 2 2 2h6.31l-.95 4.57-.03.32c0 .41.17.79.44 1.06L9.83 23l6.59-6.59c.36-.36.58-.86.58-1.41V5c0-1.1-.9-2-2-2zm4 0v12h4V3h-4z" />
  </svg>
);

const ShareIcon = ({ size = 24, className = "" }: IconProps) => (
  <svg width={size} height={size} viewBox="0 0 24 24" className={className} fill="currentColor">
    <path d="M18 16.08c-.76 0-1.44.3-1.96.77L8.91 12.7c.05-.23.09-.46.09-.7s-.04-.47-.09-.7l7.05-4.11c.54.5 1.25.81 2.04.81 1.66 0 3-1.34 3-3s-1.34-3-3-3-3 1.34-3 3c0 .24.04.47.09.7L8.04 9.81C7.5 9.31 6.79 9 6 9c-1.66 0-3 1.34-3 3s1.34 3 3 3c.79 0 1.5-.31 2.04-.81l7.12 4.16c-.05.21-.08.43-.08.65 0 1.61 1.31 2.92 2.92 2.92 1.61 0 2.92-1.31 2.92-2.92s-1.31-2.92-2.92-2.92z" />
  </svg>
);

const SaveIcon = ({ size = 24, className = "" }: IconProps) => (
  <svg width={size} height={size} viewBox="0 0 24 24" className={className} fill="currentColor">
    <path d="M14 10H2v2h12v-2zm0-4H2v2h12V6zm4 8v-4h-2v4h-4v2h4v4h2v-4h4v-2h-4zM2 16h8v-2H2v2z" />
  </svg>
);

const MoreIcon = ({ size = 24, className = "" }: IconProps) => (
  <svg width={size} height={size} viewBox="0 0 24 24" className={className} fill="currentColor">
    <path d="M12 8c1.1 0 2-.9 2-2s-.9-2-2-2-2 .9-2 2 .9 2 2 2zm0 2c-1.1 0-2 .9-2 2s.9 2 2 2 2-.9 2-2-.9-2-2-2zm0 6c-1.1 0-2 .9-2 2s.9 2 2 2 2-.9 2-2-.9-2-2-2z" />
  </svg>
);

const PlayIcon = ({ size = 24, className = "" }: IconProps) => (
  <svg width={size} height={size} viewBox="0 0 24 24" className={className} fill="currentColor">
    <path d="M8 5v14l11-7z" />
  </svg>
);

const PauseIcon = ({ size = 24, className = "" }: IconProps) => (
  <svg width={size} height={size} viewBox="0 0 24 24" className={className} fill="currentColor">
    <path d="M6 19h4V5H6v14zm8-14v14h4V5h-4z" />
  </svg>
);

const VolumeUpIcon = ({ size = 24, className = "" }: IconProps) => (
  <svg width={size} height={size} viewBox="0 0 24 24" className={className} fill="currentColor">
    <path d="M3 9v6h4l5 5V4L7 9H3zm13.5 3c0-1.77-1.02-3.29-2.5-4.03v8.05c1.48-.73 2.5-2.25 2.5-4.02zM14 3.23v2.06c2.89.86 5 3.54 5 6.71s-2.11 5.85-5 6.71v2.06c4.01-.91 7-4.49 7-8.77s-2.99-7.86-7-8.77z" />
  </svg>
);

const VolumeOffIcon = ({ size = 24, className = "" }: IconProps) => (
  <svg width={size} height={size} viewBox="0 0 24 24" className={className} fill="currentColor">
    <path d="M16.5 12c0-1.77-1.02-3.29-2.5-4.03v2.21l2.45 2.45c.03-.2.05-.41.05-.63zm2.5 0c0 .94-.2 1.82-.54 2.64l1.51 1.51C20.63 14.91 21 13.5 21 12c0-4.28-2.99-7.86-7-8.77v2.06c2.89.86 5 3.54 5 6.71zM4.27 3L3 4.27 7.73 9H3v6h4l5 5v-6.73l4.25 4.25c-.67.52-1.42.93-2.25 1.18v2.06c1.38-.31 2.63-.95 3.69-1.81L19.73 21 21 19.73l-9-9L4.27 3zM12 4L9.91 6.09 12 8.18V4z" />
  </svg>
);

const FullscreenIcon = ({ size = 24, className = "" }: IconProps) => (
  <svg width={size} height={size} viewBox="0 0 24 24" className={className} fill="currentColor">
    <path d="M7 14H5v5h5v-2H7v-3zm-2-4h2V7h3V5H5v5zm12 7h-3v2h5v-5h-2v3zM14 5v2h3v3h2V5h-5z" />
  </svg>
);

const FullscreenExitIcon = ({ size = 24, className = "" }: IconProps) => (
  <svg width={size} height={size} viewBox="0 0 24 24" className={className} fill="currentColor">
    <path d="M5 16h3v3h2v-5H5v2zm3-8H5v2h5V5H8v3zm6 11h2v-3h3v-2h-5v5zm2-11V5h-2v5h5V8h-3z" />
  </svg>
);

const ClosedCaptionIcon = ({ size = 24, className = "" }: IconProps) => (
  <svg width={size} height={size} viewBox="0 0 24 24" className={className} fill="currentColor">
    <path d="M19 4H5c-1.11 0-2 .9-2 2v12c0 1.1.89 2 2 2h14c1.1 0 2-.9 2-2V6c0-1.1-.9-2-2-2zm-8 7H9.5v-.5h-2v3h2V13H11v1c0 .55-.45 1-1 1H7c-.55 0-1-.45-1-1v-4c0-.55.45-1 1-1h3c.55 0 1 .45 1 1v1zm7 0h-1.5v-.5h-2v3h2V13H18v1c0 .55-.45 1-1 1h-3c-.55 0-1-.45-1-1v-4c0-.55.45-1 1-1h3c.55 0 1 .45 1 1v1z" />
  </svg>
);

const TheaterModeIcon = ({ size = 24, className = "" }: IconProps) => (
  <svg width={size} height={size} viewBox="0 0 24 24" className={className} fill="currentColor">
    <path d="M19 6H5c-1.1 0-2 .9-2 2v8c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2V8c0-1.1-.9-2-2-2zm0 10H5V8h14v8z" />
  </svg>
);

const ChevronRightIcon = ({ size = 24, className = "" }: IconProps) => (
  <svg width={size} height={size} viewBox="0 0 24 24" className={className} fill="currentColor">
    <path d="M10 6L8.59 7.41 13.17 12l-4.58 4.59L10 18l6-6z" />
  </svg>
);

const ChevronLeftIcon = ({ size = 24, className = "" }: IconProps) => (
  <svg width={size} height={size} viewBox="0 0 24 24" className={className} fill="currentColor">
    <path d="M15.41 7.41L14 6l-6 6 6 6 1.41-1.41L10.83 12z" />
  </svg>
);

const TrendingIcon = ({ size = 24, className = "" }: IconProps) => (
  <svg width={size} height={size} viewBox="0 0 24 24" className={className} fill="currentColor">
    <path d="M16 6l2.29 2.29-4.88 4.88-4-4L2 16.59 3.41 18l6-6 4 4 6.3-6.29L22 12V6z" />
  </svg>
);

const MusicNoteIcon = ({ size = 24, className = "" }: IconProps) => (
  <svg width={size} height={size} viewBox="0 0 24 24" className={className} fill="currentColor">
    <path d="M12 3v10.55c-.59-.34-1.27-.55-2-.55-2.21 0-4 1.79-4 4s1.79 4 4 4 4-1.79 4-4V7h4V3h-6z" />
  </svg>
);

const MovieIcon = ({ size = 24, className = "" }: IconProps) => (
  <svg width={size} height={size} viewBox="0 0 24 24" className={className} fill="currentColor">
    <path d="M18 4l2 4h-3l-2-4h-2l2 4h-3l-2-4H8l2 4H7L5 4H4c-1.1 0-1.99.9-1.99 2L2 18c0 1.1.9 2 2 2h16c1.1 0 2-.9 2-2V4h-4z" />
  </svg>
);

const LiveTvIcon = ({ size = 24, className = "" }: IconProps) => (
  <svg width={size} height={size} viewBox="0 0 24 24" className={className} fill="currentColor">
    <path d="M21 6h-7.59l3.29-3.29L16 2l-4 4-4-4-.71.71L10.59 6H3c-1.1 0-2 .89-2 2v12c0 1.1.9 2 2 2h18c1.1 0 2-.9 2-2V8c0-1.11-.9-2-2-2zm0 14H3V8h18v12zM9 10v8l7-4z" />
  </svg>
);

const SportsEsportsIcon = ({ size = 24, className = "" }: IconProps) => (
  <svg width={size} height={size} viewBox="0 0 24 24" className={className} fill="currentColor">
    <path d="M21.58 16.09l-1.09-7.66C20.21 6.46 18.52 5 16.53 5H7.47C5.48 5 3.79 6.46 3.51 8.43l-1.09 7.66C2.2 17.63 3.39 19 4.94 19c.68 0 1.32-.27 1.8-.75L9 16h6l2.25 2.25c.48.48 1.13.75 1.8.75 1.56 0 2.75-1.37 2.53-2.91zM11 11H9v2H8v-2H6v-1h2V8h1v2h2v1zm4-1c-.55 0-1-.45-1-1s.45-1 1-1 1 .45 1 1-.45 1-1 1zm2 3c-.55 0-1-.45-1-1s.45-1 1-1 1 .45 1 1-.45 1-1 1z" />
  </svg>
);

const NewspaperIcon = ({ size = 24, className = "" }: IconProps) => (
  <svg width={size} height={size} viewBox="0 0 24 24" className={className} fill="currentColor">
    <path d="M22 3l-1.67 1.67L18.67 3 17 4.67 15.33 3l-1.66 1.67L12 3l-1.67 1.67L8.67 3 7 4.67 5.33 3 3.67 4.67 2 3v16c0 1.1.9 2 2 2h16c1.1 0 2-.9 2-2V3zM11 19H4v-6h7v6zm9 0h-7v-2h7v2zm0-4h-7v-2h7v2zm0-4H4V8h16v3z" />
  </svg>
);


const SchoolIcon = ({ size = 24, className = "" }: IconProps) => (
  <svg width={size} height={size} viewBox="0 0 24 24" className={className} fill="currentColor">
    <path d="M5 13.18v4L12 21l7-3.82v-4L12 17l-7-3.82zM12 3L1 9l11 6 9-4.91V17h2V9L12 3z" />
  </svg>
);

const CheckroomIcon = ({ size = 24, className = "" }: IconProps) => (
  <svg width={size} height={size} viewBox="0 0 24 24" className={className} fill="currentColor">
    <path d="M21.6 18.2L13 11.75v-.91c1.65-.49 2.8-2.17 2.43-4.05-.26-1.31-1.3-2.4-2.61-2.7C10.54 3.57 8.5 5.3 8.5 7.5h2c0-.83.67-1.5 1.5-1.5s1.5.67 1.5 1.5c0 .84-.69 1.5-1.53 1.5-.55 0-.97.44-.97.98v1.77L2.4 18.2c-.77.58-.36 1.8.6 1.8h18c.96 0 1.37-1.22.6-1.8zM6 18l6-4.5 6 4.5H6z" />
  </svg>
);

const PodcastsIcon = ({ size = 24, className = "" }: IconProps) => (
  <svg width={size} height={size} viewBox="0 0 24 24" className={className} fill="currentColor">
    <path d="M14 12c0 .74-.4 1.38-1 1.72V22h-2v-8.28c-.6-.35-1-.98-1-1.72 0-1.1.9-2 2-2s2 .9 2 2zm-2-6c-3.31 0-6 2.69-6 6 0 1.74.75 3.31 1.94 4.4l1.42-1.42C8.53 14.25 8 13.19 8 12c0-2.21 1.79-4 4-4s4 1.79 4 4c0 1.19-.53 2.25-1.36 2.98l1.42 1.42C17.25 15.31 18 13.74 18 12c0-3.31-2.69-6-6-6zm0-4C6.48 2 2 6.48 2 12c0 2.85 1.2 5.41 3.11 7.24l1.42-1.42C4.98 16.36 4 14.29 4 12c0-4.41 3.59-8 8-8s8 3.59 8 8c0 2.29-.98 4.36-2.53 5.82l1.42 1.42C20.8 17.41 22 14.85 22 12c0-5.52-4.48-10-10-10z" />
  </svg>
);

const SportsIcon = ({ size = 24, className = "" }: IconProps) => (
  <svg width={size} height={size} viewBox="0 0 24 24" className={className} fill="currentColor">
    <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zM8 17.5c-1.38 0-2.5-1.12-2.5-2.5s1.12-2.5 2.5-2.5 2.5 1.12 2.5 2.5-1.12 2.5-2.5 2.5zM9.5 8c0-1.38 1.12-2.5 2.5-2.5s2.5 1.12 2.5 2.5-1.12 2.5-2.5 2.5S9.5 9.38 9.5 8zm6.5 9.5c-1.38 0-2.5-1.12-2.5-2.5s1.12-2.5 2.5-2.5 2.5 1.12 2.5 2.5-1.12 2.5-2.5 2.5z" />
  </svg>
);


const ShoppingBagIcon = ({ size = 24, className = "" }: IconProps) => (
  <svg width={size} height={size} viewBox="0 0 24 24" className={className} fill="currentColor">
    <path d="M18 6h-2c0-2.21-1.79-4-4-4S8 3.79 8 6H6c-1.1 0-2 .9-2 2v12c0 1.1.9 2 2 2h12c1.1 0 2-.9 2-2V8c0-1.1-.9-2-2-2zm-6-2c1.1 0 2 .9 2 2h-4c0-1.1.9-2 2-2zm6 16H6V8h12v12z" />
  </svg>
);

const ChevronUpIcon = ({ size = 24, className = "" }: IconProps) => (
  <svg width={size} height={size} viewBox="0 0 24 24" className={className} fill="currentColor">
    <path d="M7.41 15.41L12 10.83l4.59 4.58L18 14l-6-6-6 6z" />
  </svg>
);

const ChevronDownIcon = ({ size = 24, className = "" }: IconProps) => (
  <svg width={size} height={size} viewBox="0 0 24 24" className={className} fill="currentColor">
    <path d="M7.41 8.59L12 13.17l4.59-4.58L18 10l-6 6-6-6z" />
  </svg>
);

const CloseIcon = ({ size = 24, className = "" }: IconProps) => (
  <svg width={size} height={size} viewBox="0 0 24 24" className={className} fill="currentColor">
    <path d="M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z" />
  </svg>
);

const CommentIcon = ({ size = 24, className = "" }: IconProps) => (
  <svg width={size} height={size} viewBox="0 0 24 24" className={className} fill="currentColor">
    <path d="M21.99 4c0-1.1-.89-2-1.99-2H4c-1.1 0-2 .9-2 2v12c0 1.1.9 2 2 2h14l4 4-.01-18zM18 14H6v-2h12v2zm0-3H6V9h12v2zm0-3H6V6h12v2z" />
  </svg>
);

// Types
type SidebarState = "expanded" | "collapsed";
type PlayerState = "unloaded" | "loading" | "paused" | "playing" | "buffering" | "ended" | "error";
type VolumeState = "muted" | "low" | "medium" | "high";
type FullscreenState = "windowed" | "theater" | "fullscreen";
type NavSection = "home" | "shorts" | "subscriptions" | "you" | "history" | "profile" | "watch" | "channel" | "search-results" | "shopping" | "music" | "movies" | "live" | "gaming" | "news" | "sports" | "courses" | "fashion" | "podcasts" | "premium" | "yt-music" | "about" | "press" | "copyright" | "contact" | "creators" | "advertise" | "developers" | "terms" | "privacy" | "policy" | "how-it-works" | "test-features";

const NAV_SECTIONS: readonly NavSection[] = ["home", "shorts", "subscriptions", "you", "history", "profile", "watch", "channel", "search-results", "shopping", "music", "movies", "live", "gaming", "news", "sports", "courses", "fashion", "podcasts", "premium", "yt-music", "about", "press", "copyright", "contact", "creators", "advertise", "developers", "terms", "privacy", "policy", "how-it-works", "test-features"] as const;
type ProfileTab = "videos" | "playlists" | "community" | "about";

interface ChannelData {
  id: string;
  name: string;
  handle: string;
  subscribers: number;
  videosCount: number;
  description: string;
  avatarColor: string;
  avatarUrl?: string;
  bannerUrl?: string;
  isVerified: boolean;
  userId?: string; // Link to user profile if available
}

interface CommentData {
  id: string;
  videoId: string;
  userId: string;
  userName: string;
  userAvatar: string;
  userAvatarUrl?: string;
  content: string;
  likes: number;
  timestamp: string;
  replies?: CommentData[];
}

interface VideoData {
  id: string;
  title: string;
  channel: string;
  channelId: string;
  channelAvatar: string;
  channelAvatarUrl?: string;
  views: string;
  timestamp: string;
  duration: string;
  thumbnailColor: string;
  description?: string;
  /** Path to video file relative to public/, e.g., "videos/microtube/vid-1.webm" */
  videoSrc?: string;
  /** Path to thumbnail image relative to public/, e.g., "videos/microtube/thumbnails/vid-1.jpg" */
  thumbnailSrc?: string;
}

// Toast notification interface
interface Toast {
  id: string;
  message: string;
  type: 'info' | 'success' | 'error';
  duration?: number;
}

// Community post interface
interface CommunityPost {
  id: string;
  content: string;
  timestamp: string;
  likes: number;
}


// Generate placeholder video thumbnails with gradient (fallback when no real thumbnail)
const generatePlaceholderThumbnail = (color: string) => {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="360" height="202">
    <defs>
      <linearGradient id="grad-${color}" x1="0%" y1="0%" x2="100%" y2="100%">
        <stop offset="0%" style="stop-color:${color};stop-opacity:1" />
        <stop offset="100%" style="stop-color:${adjustColor(color, -30)};stop-opacity:1" />
      </linearGradient>
    </defs>
    <rect width="360" height="202" fill="url(#grad-${color})"/>
    <rect x="150" y="86" width="60" height="30" rx="4" fill="rgba(0,0,0,0.8)"/>
    <path d="M 175 93 L 175 109 L 187 101 Z" fill="white"/>
  </svg>`;
  return `data:image/svg+xml;base64,${btoa(svg)}`;
};

// Get thumbnail source - uses real thumbnail if available, otherwise generates placeholder
const getThumbnail = (video: VideoData) => {
  if (video.thumbnailSrc) {
    return `/${video.thumbnailSrc}`;
  }
  return generatePlaceholderThumbnail(video.thumbnailColor);
};

const adjustColor = (hex: string, amount: number) => {
  const num = parseInt(hex.replace("#", ""), 16);
  const r = Math.max(0, Math.min(255, (num >> 16) + amount));
  const g = Math.max(0, Math.min(255, ((num >> 8) & 0x00FF) + amount));
  const b = Math.max(0, Math.min(255, (num & 0x0000FF) + amount));
  return `#${((r << 16) | (g << 8) | b).toString(16).padStart(6, '0')}`;
};

// Helper to format view counts
const formatViews = (views: number): string => {
  if (views >= 1000000) return `${(views / 1000000).toFixed(1)}M views`;
  if (views >= 1000) return `${(views / 1000).toFixed(1)}K views`;
  return `${views} views`;
};

// Helper to get relative timestamp
const getRelativeTimestamp = (order: number): string => {
  const timestamps = ["1 day ago", "2 days ago", "3 days ago", "5 days ago", "1 week ago", "2 weeks ago"];
  return timestamps[order % timestamps.length] || "1 week ago";
};

// Sidebar navigation items (element-008 to element-029 from interaction map)
const SIDEBAR_PRIMARY = [
  { id: "element-008", icon: HomeIcon, label: "Home", section: "home" as NavSection, href: "/", requiresAuth: false },
  { id: "element-009", icon: ShortsIcon, label: "Shorts", section: "shorts" as NavSection, href: "/shorts", requiresAuth: false },
  { id: "element-010", icon: SubscriptionsIcon, label: "Subscriptions", section: "subscriptions" as NavSection, href: "/feed/subscriptions", requiresAuth: false },
];

const SIDEBAR_YOU = [
  { id: "element-011", icon: LibraryIcon, label: "You", section: "you" as NavSection, href: "/feed/you", requiresAuth: false },
  { id: "element-012", icon: HistoryIcon, label: "History", section: "history" as NavSection, href: "/feed/history", requiresAuth: false },
];

const SIDEBAR_EXPLORE = [
  { id: "element-013", icon: ShoppingBagIcon, label: "Shopping", href: "/shopping", section: "shopping" as NavSection },
  { id: "element-014", icon: MusicNoteIcon, label: "Music", href: "/music", section: "music" as NavSection },
  { id: "element-015", icon: MovieIcon, label: "Movies", href: "/movies", section: "movies" as NavSection },
  { id: "element-016", icon: LiveTvIcon, label: "Live", href: "/live", section: "live" as NavSection },
  { id: "element-017", icon: SportsEsportsIcon, label: "Gaming", href: "/gaming", section: "gaming" as NavSection },
  { id: "element-018", icon: NewspaperIcon, label: "News", href: "/news", section: "news" as NavSection },
  { id: "element-019", icon: SportsIcon, label: "Sports", href: "/sports", section: "sports" as NavSection },
  { id: "element-020", icon: SchoolIcon, label: "Courses", href: "/courses", section: "courses" as NavSection },
  { id: "element-021", icon: CheckroomIcon, label: "Fashion & Beauty", href: "/fashion", section: "fashion" as NavSection },
  { id: "element-022", icon: PodcastsIcon, label: "Podcasts", href: "/podcasts", section: "podcasts" as NavSection },
];

const SIDEBAR_MORE = [
  { id: "element-024", icon: TrendingIcon, label: "MicroTube Premium", href: "/premium", section: "premium" as NavSection },
  { id: "element-025", icon: LiveTvIcon, label: "MicroTube Music", href: "/yt-music", section: "yt-music" as NavSection },
];

const PLAYBACK_SPEEDS = [0.25, 0.5, 0.75, 1, 1.25, 1.5, 1.75, 2];
const VIDEO_QUALITIES = ["Auto", "1080p", "720p", "480p", "360p", "240p", "144p"];

export default function MicroTube() {
  // Server data hook -- all data and mutations
  const {
    videos: apiVideos,
    channels: apiChannels,
    notifications: apiNotifications,
    playlists: apiPlaylists,
    fetchComments: apiFetchComments,
    likeVideo: apiLikeVideo,
    dislikeVideo: apiDislikeVideo,
    saveVideo: apiSaveVideo,
    watchVideo: apiWatchVideo,
    subscribeChannel: apiSubscribeChannel,
    postComment: apiPostComment,
    dismissNotification: apiDismissNotification,
    markNotificationRead: apiMarkNotificationRead,
    createPlaylist: apiCreatePlaylist,
    addToPlaylist: apiAddToPlaylist,
    config,
    isLoading,
    error,
  } = useMicrotubeData();

  // Track which videos were present on first load (preloaded) vs. arrived later
  const initialVideoIds = useRef<Set<string> | null>(null);
  const videoArrivalTimes = useRef<Map<string, number>>(new Map());

  if (apiVideos.length > 0 && initialVideoIds.current === null) {
    initialVideoIds.current = new Set(apiVideos.map(v => v.id));
  }

  // Record arrival time for new videos
  for (const v of apiVideos) {
    if (initialVideoIds.current && !initialVideoIds.current.has(v.id) && !videoArrivalTimes.current.has(v.id)) {
      videoArrivalTimes.current.set(v.id, Date.now());
    }
  }

  // Derive UI-format data from API
  const SAMPLE_VIDEOS: VideoData[] = useMemo(() =>
    apiVideos.map((v): VideoData => {
      let timestamp: string;
      if (v.publishedAt) {
        timestamp = v.publishedAt;
      } else if (videoArrivalTimes.current.has(v.id)) {
        const elapsedMs = Date.now() - videoArrivalTimes.current.get(v.id)!;
        const elapsedMin = Math.floor(elapsedMs / 60000);
        if (elapsedMin < 1) timestamp = "Just now";
        else if (elapsedMin < 60) timestamp = `${elapsedMin} minute${elapsedMin === 1 ? '' : 's'} ago`;
        else timestamp = `${Math.floor(elapsedMin / 60)} hour${Math.floor(elapsedMin / 60) === 1 ? '' : 's'} ago`;
      } else {
        timestamp = getRelativeTimestamp(v.order);
      }

      return {
        id: v.id,
        title: v.title,
        channel: v.channelName,
        channelId: v.channel_id,
        channelAvatar: v.channelName.split(' ').map((n: string) => n[0]).join('').slice(0, 2),
        channelAvatarUrl: v.channelAvatarSrc ? `/${v.channelAvatarSrc}` : undefined,
        views: formatViews(v.views),
        timestamp,
        duration: v.duration,
        thumbnailColor: v.thumbnailColor,
        description: v.description,
        videoSrc: v.videoSrc,
        thumbnailSrc: v.thumbnailSrc,
      };
    }).sort((a, b) => {
      const aIsNew = videoArrivalTimes.current.has(a.id);
      const bIsNew = videoArrivalTimes.current.has(b.id);
      if (aIsNew && !bIsNew) return -1;
      if (!aIsNew && bIsNew) return 1;
      if (aIsNew && bIsNew) {
        return videoArrivalTimes.current.get(b.id)! - videoArrivalTimes.current.get(a.id)!;
      }
      return 0;
    }), [apiVideos]);

  const CHANNELS: ChannelData[] = useMemo(() =>
    apiChannels.map((ch): ChannelData => ({
      id: ch.id,
      name: ch.name,
      handle: ch.handle,
      subscribers: ch.subscribers,
      videosCount: ch.videos,
      description: ch.description,
      avatarColor: ch.avatarColor,
      avatarUrl: ch.avatarSrc ? `/${ch.avatarSrc}` : undefined,
      bannerUrl: ch.bannerSrc ? `/${ch.bannerSrc}` : undefined,
      isVerified: ch.isVerified,
    })), [apiChannels]);

  const selfChannel = useMemo(() => apiChannels.find(ch => ch.isSelf), [apiChannels]);

  // Local UI state (not persisted to server)
  interface LocalState {
    sidebarState: SidebarState;
    searchQuery: string;
    volume: number;
    isMuted: boolean;
    playbackSpeed: number;
    captionsEnabled: boolean;
    videoQuality: string;
    profileTab: ProfileTab;
    darkMode: boolean;
    communityPosts: CommunityPost[];
    deletedVideos: string[];
    videoQueue: string[];
    likedComments: string[];
    dislikedComments: string[];
    shortsComments: { [shortId: string]: CommentData[] };
    commentReplies: { [commentId: string]: CommentData[] };
    likedPosts: string[];
    betaEnrolled: boolean;
  }

  const [state, setState] = useState<LocalState>({
    sidebarState: "expanded",
    searchQuery: "",
    volume: 100,
    isMuted: false,
    playbackSpeed: 1,
    captionsEnabled: false,
    videoQuality: "Auto",
    profileTab: "videos",
    darkMode: true,
    communityPosts: [],
    deletedVideos: [],
    videoQueue: [],
    likedComments: [],
    dislikedComments: [],
    shortsComments: {},
    commentReplies: {},
    likedPosts: [],
    betaEnrolled: false,
  });

  const [route, setRoute] = useHashRoute<NavSection>(NAV_SECTIONS, "home");
  const currentView = route.view;
  const watchingVideoId = currentView === "watch" ? route.id : null;
  const viewingShortId = currentView === "shorts" ? route.id : null;
  const viewingChannelId = currentView === "channel" ? route.id : null;

  const [isSignedOut, setIsSignedOut] = useState(false);
  const [playerState, setPlayerState] = useState<PlayerState>("unloaded");
  const [volumeState, setVolumeState] = useState<VolumeState>("high");
  const [fullscreenState, setFullscreenState] = useState<FullscreenState>("windowed");
  const [searchSuggestions, setSearchSuggestions] = useState<string[]>([]);
  const [showSearchSuggestions, setShowSearchSuggestions] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [videoDuration, setVideoDuration] = useState(0);
  const [showSettings, setShowSettings] = useState(false);
  const [showVideoSettings, setShowVideoSettings] = useState(false);
  const [showSpeedMenu, setShowSpeedMenu] = useState(false);
  const [showQualityMenu, setShowQualityMenu] = useState(false);
  const [hoveredVideo, setHoveredVideo] = useState<string | null>(null);
  const [showMoreMenu, setShowMoreMenu] = useState(false);
  const [showShareModal, setShowShareModal] = useState(false);
  const [hoveredElement, setHoveredElement] = useState<string | null>(null);
  const [showNotificationsPanel, setShowNotificationsPanel] = useState(false);
  const [showUploadModal, setShowUploadModal] = useState(false);
  const [searchResults, setSearchResults] = useState<VideoData[]>([]);
  const [showSaveModal, setShowSaveModal] = useState(false);
  const [showCustomizeModal, setShowCustomizeModal] = useState(false);
  const [showManageVideosModal, setShowManageVideosModal] = useState(false);
  const [newComment, setNewComment] = useState("");
  const commentInputRef = useRef<HTMLInputElement>(null);

  const searchInputRef = useRef<HTMLInputElement>(null);
  const playerContainerRef = useRef<HTMLDivElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const [videoError, setVideoError] = useState(false);
  void videoError; // Used in video player error handling

  // New feature states
  const [toasts, setToasts] = useState<Toast[]>([]);
  const [showShortsCommentsModal, setShowShortsCommentsModal] = useState(false);
  const [showShortsShareModal, setShowShortsShareModal] = useState(false);
  const [showCreatePlaylistModal, setShowCreatePlaylistModal] = useState(false);
  const [newPlaylistName, setNewPlaylistName] = useState("");
  const [communityPostText, setCommunityPostText] = useState("");
  const [shortsTransition, setShortsTransition] = useState<'none' | 'up' | 'down'>('none');
  const [newShortsComment, setNewShortsComment] = useState("");

  // New functionality modal states
  const [showClipModal, setShowClipModal] = useState(false);
  const [showReportModal, setShowReportModal] = useState(false);
  const [showPremiumModal, setShowPremiumModal] = useState(false);
  const [showAdvertiseModal, setShowAdvertiseModal] = useState(false);
  const [showEditVideoModal, setShowEditVideoModal] = useState(false);
  const [showVoiceSearchModal, setShowVoiceSearchModal] = useState(false);
  const [editingVideoId, setEditingVideoId] = useState<string | null>(null);
  const [replyingToCommentId, setReplyingToCommentId] = useState<string | null>(null);
  const [replyText, setReplyText] = useState("");
  const [clipStartTime, setClipStartTime] = useState(0);
  const [clipEndTime, setClipEndTime] = useState(30);
  const [reportReason, setReportReason] = useState("");

  // API-derived lookup sets for rendering -- maps video/channel ID to boolean state
  const videoStateMap = useMemo(() => {
    const map: Record<string, { isLiked: boolean; isDisliked: boolean; isSaved: boolean; isWatched: boolean }> = {};
    for (const v of apiVideos) {
      map[v.id] = { isLiked: v.isLiked, isDisliked: v.isDisliked, isSaved: v.isSaved, isWatched: v.isWatched };
    }
    return map;
  }, [apiVideos]);

  const channelStateMap = useMemo(() => {
    const map: Record<string, boolean> = {};
    for (const ch of apiChannels) {
      map[ch.id] = ch.isSubscribed;
    }
    return map;
  }, [apiChannels]);

  // Derived lists for rendering (subscriptions, library sections, etc.)
  const subscribedChannelIds = useMemo(() => apiChannels.filter(ch => ch.isSubscribed).map(ch => ch.id), [apiChannels]);
  const likedVideoIds = useMemo(() => apiVideos.filter(v => v.isLiked).map(v => v.id), [apiVideos]);
  const savedVideoIds = useMemo(() => apiVideos.filter(v => v.isSaved).map(v => v.id), [apiVideos]);
  const watchedVideoIds = useMemo(() => apiVideos.filter(v => v.isWatched).map(v => v.id), [apiVideos]);

  // Compatibility helpers matching old state.* patterns
  const isVideoLiked = useCallback((id: string) => videoStateMap[id]?.isLiked ?? false, [videoStateMap]);
  const isVideoDisliked = useCallback((id: string) => videoStateMap[id]?.isDisliked ?? false, [videoStateMap]);
  const isVideoSaved = useCallback((id: string) => videoStateMap[id]?.isSaved ?? false, [videoStateMap]);
  const isVideoWatched = useCallback((id: string) => videoStateMap[id]?.isWatched ?? false, [videoStateMap]);
  const isChannelSubscribed = useCallback((id: string) => channelStateMap[id] ?? false, [channelStateMap]);

  // Toast notification helper - reserved for future use
  const showToast = useCallback((message: string, type: 'info' | 'success' | 'error' = 'info') => {
    const id = `toast-${Date.now()}`;
    setToasts(prev => [...prev, { id, message, type }]);
    setTimeout(() => {
      setToasts(prev => prev.filter(t => t.id !== id));
    }, 3000);
  }, []);
  void showToast; // Reserved for future toast notifications

  // Helper functions for channel navigation
  const getChannelById = useCallback((channelId: string): ChannelData | undefined => {
    return CHANNELS.find(ch => ch.id === channelId);
  }, [CHANNELS]);

  const navigateToChannel = useCallback((channelId: string) => {
    setState(prev => ({ ...prev, profileTab: "videos" }));
    if (channelId === "ch-self") {
      setRoute("profile");
    } else {
      setRoute("channel", channelId);
    }
  }, [setRoute]);

  const getVideosForChannel = useCallback((channelId: string): VideoData[] => {
    return SAMPLE_VIDEOS.filter(v => v.channelId === channelId);
  }, [SAMPLE_VIDEOS]);

  // Comments state -- fetched on demand from API
  const [loadedComments, setLoadedComments] = useState<CommentData[]>([]);

  const getCommentsForVideo = useCallback((videoId: string): CommentData[] => {
    return loadedComments.filter(c => c.videoId === videoId);
  }, [loadedComments]);

  useEffect(() => {
    const prev = document.title;
    document.title = "MicroTube";
    return () => { document.title = prev; };
  }, []);

  // Fetch comments when current video changes
  useEffect(() => {
    if (watchingVideoId) {
      apiFetchComments(watchingVideoId).then(comments => {
        const mapped = comments.map((c): CommentData => ({
          id: c.id,
          videoId: c.video_id,
          userId: c.user_id,
          userName: c.userName,
          userAvatar: c.userName.split(' ').map((n: string) => n[0]).join('').slice(0, 2),
          userAvatarUrl: c.userAvatar ? `/${c.userAvatar}` : undefined,
          content: c.content,
          likes: c.likes,
          timestamp: 'Recently',
        }));
        setLoadedComments(mapped);
      });
    }
  }, [watchingVideoId, apiFetchComments]);

  const addComment = useCallback(async (content: string) => {
    if (!watchingVideoId || !content.trim()) return;

    const result = await apiPostComment(watchingVideoId, content.trim());
    if (result) {
      const selfName = config?.selfUser?.name || selfChannel?.name || "You";
      const selfInitials = selfName.split(" ").map(n => n[0]).join("").slice(0, 2).toUpperCase();
      const selfAvatarUrl = config?.selfUser?.avatarUrl
        || (selfChannel?.avatarSrc ? `/${selfChannel.avatarSrc}` : undefined);
      // Add optimistically to local display
      const newCommentData: CommentData = {
        id: result.id || `user-comment-${Date.now()}`,
        videoId: watchingVideoId,
        userId: config?.selfUser?.id || "user000",
        userName: selfName,
        userAvatar: selfInitials,
        userAvatarUrl: selfAvatarUrl,
        content: content.trim(),
        likes: 0,
        timestamp: "Just now",
      };
      setLoadedComments(prev => [newCommentData, ...prev]);
    }
    setNewComment("");
  }, [watchingVideoId, apiPostComment, selfChannel, config]);

  const saveVideo = useCallback((videoId: string) => {
    apiSaveVideo(videoId);
    setShowSaveModal(false);
  }, [apiSaveVideo]);

  // Add community post
  const addCommunityPost = useCallback((content: string) => {
    if (!content.trim()) return;
    const newPost: CommunityPost = {
      id: `post-${Date.now()}`,
      content: content.trim(),
      timestamp: 'Just now',
      likes: 0,
    };
    setState(prev => ({
      ...prev,
      communityPosts: [newPost, ...prev.communityPosts],
    }));
    setCommunityPostText("");
  }, []);

  // Delete video (mark as deleted)
  const deleteVideo = useCallback((videoId: string) => {
    setState(prev => ({
      ...prev,
      deletedVideos: [...prev.deletedVideos, videoId],
    }));
  }, []);

  // Dismiss notification
  const dismissNotification = useCallback((notifId: string) => {
    apiDismissNotification(notifId);
  }, [apiDismissNotification]);

  // Mark notification as read
  const markNotificationRead = useCallback((notifId: string) => {
    apiMarkNotificationRead(notifId);
  }, [apiMarkNotificationRead]);

  // Create playlist
  const createPlaylist = useCallback(async (name: string) => {
    if (!name.trim()) return;
    const result = await apiCreatePlaylist(name.trim());
    if (result && watchingVideoId) {
      await apiAddToPlaylist(result.id, watchingVideoId);
    }
    setNewPlaylistName("");
    setShowCreatePlaylistModal(false);
  }, [watchingVideoId, apiCreatePlaylist, apiAddToPlaylist]);

  // Like comment (mutually exclusive with dislike)
  const toggleCommentLike = useCallback((commentId: string) => {
    setState(prev => ({
      ...prev,
      likedComments: prev.likedComments.includes(commentId)
        ? prev.likedComments.filter(id => id !== commentId)
        : [...prev.likedComments, commentId],
      dislikedComments: prev.dislikedComments.filter(id => id !== commentId),
    }));
  }, []);

  // Add shorts comment
  const addShortsComment = useCallback(async (shortId: string, content: string) => {
    if (!content.trim()) return;
    await apiPostComment(shortId, content.trim());
    const selfName = config?.selfUser?.name || selfChannel?.name || "You";
    const selfInitials = selfName.split(" ").map(n => n[0]).join("").slice(0, 2).toUpperCase();
    const newCommentData: CommentData = {
      id: `shorts-comment-${Date.now()}`,
      videoId: shortId,
      userId: config?.selfUser?.id || "user000",
      userName: selfName,
      userAvatar: selfInitials,
      userAvatarUrl: config?.selfUser?.avatarUrl
        || (selfChannel?.avatarSrc ? `/${selfChannel.avatarSrc}` : undefined),
      content: content.trim(),
      likes: 0,
      timestamp: "Just now",
    };
    setState(prev => ({
      ...prev,
      shortsComments: {
        ...prev.shortsComments,
        [shortId]: [...(prev.shortsComments[shortId] || []), newCommentData],
      },
    }));
    setNewShortsComment("");
  }, [apiPostComment, config, selfChannel]);

  // Navigate shorts with animation
  const navigateShort = useCallback((direction: 'up' | 'down', currentIndex: number, shortsList: VideoData[]) => {
    const newIndex = direction === 'up' ? currentIndex - 1 : currentIndex + 1;
    if (newIndex < 0 || newIndex >= shortsList.length) return;

    setShortsTransition(direction);
    setTimeout(() => {
      setRoute("shorts", shortsList[newIndex].id);
      setShortsTransition('none');
    }, 200);
  }, [setRoute]);

  // Get visible videos (excluding deleted)
  const getVisibleVideos = useCallback((videos: VideoData[]) => {
    return videos.filter(v => !state.deletedVideos.includes(v.id));
  }, [state.deletedVideos]);

  // Add video to queue
  const addToQueue = useCallback((videoId: string) => {
    setState(prev => ({
      ...prev,
      videoQueue: prev.videoQueue.includes(videoId)
        ? prev.videoQueue
        : [...prev.videoQueue, videoId],
    }));
  }, []);

  // Toggle comment dislike
  const toggleCommentDislike = useCallback((commentId: string) => {
    setState(prev => ({
      ...prev,
      dislikedComments: prev.dislikedComments.includes(commentId)
        ? prev.dislikedComments.filter(id => id !== commentId)
        : [...prev.dislikedComments, commentId],
      // Remove like if disliking
      likedComments: prev.likedComments.filter(id => id !== commentId),
    }));
  }, []);

  // Add reply to comment
  const addCommentReply = useCallback(async (parentCommentId: string, content: string) => {
    if (!content.trim()) return;
    if (watchingVideoId) {
      await apiPostComment(watchingVideoId, content.trim());
    }
    const selfName = config?.selfUser?.name || selfChannel?.name || "You";
    const selfInitials = selfName.split(" ").map(n => n[0]).join("").slice(0, 2).toUpperCase();
    const newReply: CommentData = {
      id: `reply-${Date.now()}`,
      videoId: watchingVideoId || "",
      userId: config?.selfUser?.id || "user000",
      userName: selfName,
      userAvatar: selfInitials,
      userAvatarUrl: config?.selfUser?.avatarUrl
        || (selfChannel?.avatarSrc ? `/${selfChannel.avatarSrc}` : undefined),
      content: content.trim(),
      likes: 0,
      timestamp: "Just now",
    };
    setState(prev => ({
      ...prev,
      commentReplies: {
        ...prev.commentReplies,
        [parentCommentId]: [...(prev.commentReplies[parentCommentId] || []), newReply],
      },
    }));
    setReplyingToCommentId(null);
    setReplyText("");
  }, [watchingVideoId, apiPostComment, config, selfChannel]);

  // Toggle post like
  const togglePostLike = useCallback((postId: string) => {
    setState(prev => ({
      ...prev,
      likedPosts: prev.likedPosts.includes(postId)
        ? prev.likedPosts.filter(id => id !== postId)
        : [...prev.likedPosts, postId],
    }));
  }, []);

  // Toggle beta enrollment
  const toggleBetaEnrollment = useCallback(() => {
    setState(prev => ({
      ...prev,
      betaEnrolled: !prev.betaEnrolled,
    }));
  }, []);

  // Voice search simulation
  const startVoiceSearch = useCallback(() => {
    setShowVoiceSearchModal(true);
    // Auto-close after 3 seconds
    setTimeout(() => {
      setShowVoiceSearchModal(false);
    }, 3000);
  }, []);

  // Get active notifications (not dismissed) -- from API
  const activeNotifications = useMemo(() => {
    return apiNotifications
      .filter(n => !n.isDismissed)
      .map(n => ({
        id: n.id,
        channel: n.channelName || '',
        message: n.message,
        time: '',
        avatar: n.channelAvatarSrc ? `/${n.channelAvatarSrc}` : '#666',
        read: n.isRead,
      }));
  }, [apiNotifications]);

  // Search suggestions (element-003)
  const handleSearchInput = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const query = e.target.value;
    setState((prev) => ({ ...prev, searchQuery: query }));

    if (query.length > 0) {
      setShowSearchSuggestions(true);
      setSearchSuggestions([
        `${query} tutorial`,
        `${query} full video`,
        `${query} explained`,
        `${query} 2024`,
        `how to ${query}`,
      ]);
    } else {
      setShowSearchSuggestions(false);
      setSearchSuggestions([]);
    }
  }, []);

  const handleSearchSubmit = useCallback((e: React.FormEvent) => {
    e.preventDefault();
    if (state.searchQuery.trim()) {
      setShowSearchSuggestions(false);
      const query = state.searchQuery.toLowerCase();
      const filtered = SAMPLE_VIDEOS.filter(video =>
        video.title.toLowerCase().includes(query) ||
        video.channel.toLowerCase().includes(query)
      );
      setSearchResults(filtered);
      setRoute("search-results", state.searchQuery);
    }
  }, [state.searchQuery, SAMPLE_VIDEOS, setRoute]);

  const clearSearch = useCallback(() => {
    setState((prev) => ({ ...prev, searchQuery: "" }));
    setRoute("home");
    setShowSearchSuggestions(false);
    setSearchSuggestions([]);
    setSearchResults([]);
  }, [setRoute]);

  // Hydrate searchQuery + searchResults from the URL when landing on
  // #search-results/{query} via refresh, Back/Forward, or shareable link.
  useEffect(() => {
    if (currentView === "search-results" && route.id) {
      setState(prev => prev.searchQuery === route.id ? prev : { ...prev, searchQuery: route.id! });
      const q = route.id.toLowerCase();
      setSearchResults(SAMPLE_VIDEOS.filter(v =>
        v.title.toLowerCase().includes(q) || v.channel.toLowerCase().includes(q)
      ));
    }
  }, [currentView, route.id, SAMPLE_VIDEOS]);

  // Sidebar toggle (element-001)
  const toggleSidebar = useCallback(() => {
    setState((prev) => ({
      ...prev,
      sidebarState: prev.sidebarState === "expanded" ? "collapsed" : "expanded",
    }));
  }, []);

  // Get current video object from SAMPLE_VIDEOS
  const currentVideoData = useMemo(() => {
    if (!watchingVideoId) return null;
    return SAMPLE_VIDEOS.find(v => v.id === watchingVideoId) || null;
  }, [watchingVideoId, SAMPLE_VIDEOS]);

  // Video player controls
  const loadVideo = useCallback((videoId: string) => {
    setRoute("watch", videoId);
    apiWatchVideo(videoId);
    setVideoError(false);
    setPlayerState("loading");
    // If video has a real source, the video element will handle duration
    const video = SAMPLE_VIDEOS.find(v => v.id === videoId);
    if (!video?.videoSrc) {
      // No real video, use simulated duration
      setTimeout(() => {
        setPlayerState("paused");
        setVideoDuration(180);
        setCurrentTime(0);
      }, 500);
    }
  }, [SAMPLE_VIDEOS, apiWatchVideo, setRoute]);

  const togglePlayPause = useCallback(() => {
    if (playerState === "paused" || playerState === "ended") {
      setPlayerState("playing");
      videoRef.current?.play();
    } else if (playerState === "playing") {
      setPlayerState("paused");
      videoRef.current?.pause();
    }
  }, [playerState]);

  const toggleMute = useCallback(() => {
    setState((prev) => ({ ...prev, isMuted: !prev.isMuted }));
    setVolumeState(state.isMuted ? "high" : "muted");
    if (videoRef.current) {
      videoRef.current.muted = !state.isMuted;
    }
  }, [state.isMuted]);

  const handleVolumeChange = useCallback((newVolume: number) => {
    setState((prev) => ({ ...prev, volume: newVolume, isMuted: newVolume === 0 }));
    if (videoRef.current) {
      videoRef.current.volume = newVolume / 100;
      videoRef.current.muted = newVolume === 0;
    }
    if (newVolume === 0) {
      setVolumeState("muted");
    } else if (newVolume <= 33) {
      setVolumeState("low");
    } else if (newVolume <= 66) {
      setVolumeState("medium");
    } else {
      setVolumeState("high");
    }
  }, []);

  const toggleFullscreen = useCallback(() => {
    if (fullscreenState === "windowed" || fullscreenState === "theater") {
      playerContainerRef.current?.requestFullscreen();
      setFullscreenState("fullscreen");
    } else {
      document.exitFullscreen();
      setFullscreenState("windowed");
    }
  }, [fullscreenState]);

  const toggleTheaterMode = useCallback(() => {
    if (fullscreenState === "fullscreen") return;
    setFullscreenState(fullscreenState === "theater" ? "windowed" : "theater");
  }, [fullscreenState]);

  const seekVideo = useCallback((time: number) => {
    setCurrentTime(time);
    if (videoRef.current) {
      videoRef.current.currentTime = time;
    }
  }, []);

  const likeVideo = useCallback(() => {
    if (watchingVideoId) {
      apiLikeVideo(watchingVideoId);
    }
  }, [watchingVideoId, apiLikeVideo]);

  const dislikeVideo = useCallback(() => {
    if (watchingVideoId) {
      apiDislikeVideo(watchingVideoId);
    }
  }, [watchingVideoId, apiDislikeVideo]);

  const toggleSubscribe = useCallback((channel: string) => {
    apiSubscribeChannel(channel);
  }, [apiSubscribeChannel]);

  const changePlaybackSpeed = useCallback((speed: number) => {
    setState((prev) => ({ ...prev, playbackSpeed: speed }));
    setShowSpeedMenu(false);
  }, []);

  const changeQuality = useCallback((quality: string) => {
    setState((prev) => ({ ...prev, videoQuality: quality }));
    setShowQualityMenu(false);
  }, []);

  useEffect(() => {
    if (videoRef.current) {
      videoRef.current.playbackRate = state.playbackSpeed;
    }
  }, [state.playbackSpeed, watchingVideoId]);

  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key !== "Escape") return;
      const active = document.activeElement as HTMLElement | null;
      if (active && (active.tagName === "INPUT" || active.tagName === "TEXTAREA" || active.isContentEditable)) {
        return;
      }
      if (fullscreenState === "fullscreen") {
        document.exitFullscreen();
      }
      setShowSettings(false);
      setShowSearchSuggestions(false);
      setShowVideoSettings(false);
      setShowMoreMenu(false);
      setShowShareModal(false);
    };
    window.addEventListener("keydown", handleEscape);
    return () => window.removeEventListener("keydown", handleEscape);
  }, [fullscreenState]);

  // Format time for display
  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, "0")}`;
  };

  const getVolumeIcon = () => {
    if (state.isMuted || volumeState === "muted") return VolumeOffIcon;
    return VolumeUpIcon;
  };

  const currentVideo = watchingVideoId ? SAMPLE_VIDEOS.find(v => v.id === watchingVideoId) : null;

  // Light mode colors
  const lightModeColors = {
    bg: '#ffffff',
    headerBg: '#ffffff',
    sidebarBg: '#ffffff',
    cardBg: '#f2f2f2',
    text: '#0f0f0f',
    textSecondary: '#606060',
    border: '#e5e5e5',
    hover: '#e5e5e5',
  };

  const darkModeColors = {
    bg: '#0f0f0f',
    headerBg: '#0f0f0f',
    sidebarBg: '#0f0f0f',
    cardBg: '#272727',
    text: '#f1f1f1',
    textSecondary: '#aaa',
    border: '#3f3f3f',
    hover: '#3f3f3f',
  };

  const colors = state.darkMode ? darkModeColors : lightModeColors;

  // ---------------------------------------------------------------------------
  // Loading Gate
  // ---------------------------------------------------------------------------
  if (!config || isLoading) {
    const isNetworkError = error && /failed to fetch|networkerror/i.test(error);
    const isNoSession = error && /409/.test(error);
    const isMismatch = error && /environment mismatch/i.test(error);
    return (
      <div className="flex items-center justify-center h-screen bg-[#0f0f0f]">
        <div className="text-center max-w-md px-6">
          <div className="text-4xl mb-3">📺</div>
          <h1 className="text-xl font-semibold mb-6 text-white">MicroTube</h1>
          {!error ? (
            <>
              <div className="w-8 h-8 border-2 border-red-500 border-t-transparent rounded-full animate-spin mx-auto mb-4" />
              <p className="text-sm text-gray-400">Connecting to MicroTube...</p>
            </>
          ) : isNetworkError ? (
            <>
              <p className="font-medium mb-2 text-white">Could not connect to the server</p>
              <p className="text-sm text-gray-400 mb-3">Make sure the API server is running on port 8000.</p>
              <p className="text-xs font-mono bg-gray-800 rounded px-3 py-2 text-gray-400 mt-2">uvicorn server.server:app --port 8000</p>
            </>
          ) : isNoSession ? (
            <>
              <p className="font-medium mb-2 text-white">No scenario initialized</p>
              <p className="text-sm text-gray-400 mb-3">The server is running but no scenario has been loaded. Use the CLI harness or POST /init to start a scenario.</p>
              <p className="text-xs font-mono bg-gray-800 rounded px-3 py-2 text-gray-400 mt-2">python -m server.run_simulation &lt;scenario.json&gt;</p>
            </>
          ) : isMismatch ? (
            <>
              <p className="font-medium mb-2 text-white">Wrong environment</p>
              <p className="text-sm text-gray-400 mb-3">{error}</p>
              <p className="text-sm text-gray-400">Navigate to the correct environment from the desktop, or re-init with a MicroTube scenario.</p>
            </>
          ) : (
            <>
              <p className="font-medium mb-2 text-white">Connection Error</p>
              <p className="text-sm text-red-400">{error}</p>
            </>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className={`microtube-root ${state.darkMode ? 'dark' : 'light'}`} style={{
      ...styles.container,
      backgroundColor: colors.bg,
      color: colors.text,
    }}>
      {/* Header (elements 001-007) */}
      <header style={{
        ...styles.header,
        backgroundColor: colors.headerBg,
        borderBottom: state.darkMode ? 'none' : `1px solid ${colors.border}`,
      }}>
        <div style={styles.headerLeft}>
          {/* element-001: Guide Button */}
          <button
            onClick={toggleSidebar}
            onMouseEnter={() => setHoveredElement('guide')}
            onMouseLeave={() => setHoveredElement(null)}
            style={{
              ...styles.iconButton,
              backgroundColor: hoveredElement === 'guide' ? colors.hover : 'transparent',
              color: colors.text,
            }}
            aria-label="Guide"
            title="Guide"
          >
            <MenuIcon size={24} />
          </button>

          {/* element-002: Logo */}
          <div style={styles.logo} onClick={() => {
            setState(prev => ({ ...prev, searchQuery: "" }));
            setRoute("home");
            setSearchResults([]);
          }}>
            <img src="desktop/microtube-icon.png" alt="MicroTube" style={{ width: 28, height: 20, marginRight: 2, objectFit: 'contain' }} />
            <span style={styles.logoText}>MicroTube</span>
          </div>
        </div>

        <div style={styles.headerCenter}>
          {/* element-003: Search Form */}
          <form onSubmit={handleSearchSubmit} style={styles.searchForm}>
            <div style={styles.searchContainer}>
              <input
                ref={searchInputRef}
                type="text"
                placeholder="Search"
                value={state.searchQuery}
                onChange={handleSearchInput}
                onFocus={() => state.searchQuery && setShowSearchSuggestions(true)}
                onBlur={() => setTimeout(() => setShowSearchSuggestions(false), 200)}
                style={{
                  ...styles.searchInput,
                  backgroundColor: state.darkMode ? '#121212' : '#fff',
                  borderColor: colors.border,
                  color: colors.text,
                }}
                aria-label="Search"
                name="search_query"
              />
              {state.searchQuery && (
                <button
                  type="button"
                  onClick={clearSearch}
                  style={{...styles.clearButton, color: colors.textSecondary}}
                  aria-label="Clear search"
                >
                  ✕
                </button>
              )}
              {showSearchSuggestions && searchSuggestions.length > 0 && (
                <div style={{
                  ...styles.searchSuggestions,
                  backgroundColor: colors.cardBg,
                  borderColor: colors.border,
                }}>
                  {searchSuggestions.map((suggestion, idx) => (
                    <div
                      key={idx}
                      onMouseEnter={() => setHoveredElement(`suggestion-${idx}`)}
                      onMouseLeave={() => setHoveredElement(null)}
                      style={{
                        ...styles.suggestion,
                        backgroundColor: hoveredElement === `suggestion-${idx}` ? colors.hover : 'transparent',
                        color: colors.text,
                      }}
                      onClick={() => {
                        setState((prev) => ({ ...prev, searchQuery: suggestion }));
                        setShowSearchSuggestions(false);
                      }}
                    >
                      <SearchIcon size={20} />
                      <span style={{ marginLeft: 12 }}>{suggestion}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
            {/* element-004: Search Button */}
            <button
              type="submit"
              onMouseEnter={() => setHoveredElement('search-btn')}
              onMouseLeave={() => setHoveredElement(null)}
              style={{
                ...styles.searchButton,
                backgroundColor: hoveredElement === 'search-btn' ? colors.hover : (state.darkMode ? '#222222' : '#f8f8f8'),
                borderColor: colors.border,
                color: colors.text,
              }}
              aria-label="Search"
              title="Search"
            >
              <SearchIcon size={24} />
            </button>
          </form>

          {/* element-005: Voice Search */}
          <button
            onMouseEnter={() => setHoveredElement('voice')}
            onMouseLeave={() => setHoveredElement(null)}
            onClick={startVoiceSearch}
            style={{
              ...styles.voiceSearchButton,
              backgroundColor: hoveredElement === 'voice' ? colors.hover : 'transparent',
              color: colors.text,
            }}
            aria-label="Search with your voice"
            title="Search with your voice"
          >
            <MicIcon size={24} />
          </button>
        </div>

        <div style={styles.headerRight}>
          {/* element-006: Create/Upload */}
          {!isSignedOut && (
            <button
              onMouseEnter={() => setHoveredElement('create')}
              onMouseLeave={() => setHoveredElement(null)}
              style={{
                ...styles.iconButton,
                backgroundColor: hoveredElement === 'create' ? colors.hover : 'transparent',
                color: colors.text,
              }}
              aria-label="Create"
              title="Create"
              onClick={() => setShowUploadModal(true)}
            >
              <VideoCallIcon size={24} />
            </button>
          )}

          {/* Notifications */}
          {!isSignedOut && (
            <div style={{ position: 'relative' }}>
              <button
                onMouseEnter={() => setHoveredElement('notifications')}
                onMouseLeave={() => setHoveredElement(null)}
                style={{
                  ...styles.iconButton,
                  backgroundColor: hoveredElement === 'notifications' ? colors.hover : 'transparent',
                  color: colors.text,
                }}
                aria-label="Notifications"
                title="Notifications"
                onClick={() => { setShowNotificationsPanel(!showNotificationsPanel); setShowSettings(false); }}
              >
                <NotificationsIcon size={24} />
                {activeNotifications.filter(n => !n.read).length > 0 && (
                  <span style={{
                    position: 'absolute',
                    top: 4,
                    right: 4,
                    backgroundColor: '#ff0000',
                    color: '#fff',
                    fontSize: 10,
                    fontWeight: 'bold',
                    borderRadius: 10,
                    padding: '1px 5px',
                    minWidth: 16,
                    textAlign: 'center',
                  }}>{activeNotifications.filter(n => !n.read).length}</span>
                )}
              </button>
              {showNotificationsPanel && (
                <div style={{
                  position: 'absolute',
                  top: '100%',
                  right: 0,
                  width: 400,
                  maxHeight: 500,
                  backgroundColor: colors.cardBg,
                  borderRadius: 12,
                  boxShadow: '0 4px 32px rgba(0,0,0,0.5)',
                  overflow: 'hidden',
                  zIndex: 3000,
                  color: colors.text,
                }}>
                  <div style={{ padding: '16px 20px', borderBottom: `1px solid ${colors.border}`, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span style={{ fontSize: 16, fontWeight: 500 }}>Notifications</span>
                    <button onClick={() => setShowNotificationsPanel(false)} style={{ background: 'none', border: 'none', color: colors.textSecondary, cursor: 'pointer', fontSize: 20 }}>×</button>
                  </div>
                  <div style={{ maxHeight: 400, overflowY: 'auto' }}>
                    {activeNotifications.length > 0 ? (
                      activeNotifications.map((notif) => (
                        <div
                          key={notif.id}
                          style={{
                            padding: '12px 20px',
                            display: 'flex',
                            gap: 12,
                            alignItems: 'flex-start',
                            cursor: 'pointer',
                            backgroundColor: !notif.read ? 'rgba(62,166,255,0.1)' : 'transparent',
                            position: 'relative',
                          }}
                          onClick={() => {
                            markNotificationRead(notif.id);
                            // Navigate to a video when notification is clicked
                            const video = SAMPLE_VIDEOS.find(v => notif.message.toLowerCase().includes(v.title.toLowerCase().split(' ')[0])) || SAMPLE_VIDEOS[0];
                            if (video) {
                              setRoute("watch", video.id);
                            }
                            setShowNotificationsPanel(false);
                          }}
                          onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = colors.hover)}
                          onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = !notif.read ? 'rgba(62,166,255,0.1)' : 'transparent')}
                        >
                          {notif.avatar && notif.avatar.startsWith('/') ? (
                            <img
                              src={notif.avatar}
                              alt={notif.channel}
                              style={{ width: 40, height: 40, borderRadius: '50%', objectFit: 'cover', flexShrink: 0 }}
                            />
                          ) : (
                            <div style={{ width: 40, height: 40, borderRadius: '50%', backgroundColor: notif.avatar || '#666', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', fontWeight: 'bold', fontSize: 14, flexShrink: 0 }}>{notif.channel[0]}</div>
                          )}
                          <div style={{ flex: 1 }}>
                            <div style={{ fontSize: 14 }}><strong>{notif.channel}</strong> {notif.message}</div>
                            <div style={{ fontSize: 12, color: colors.textSecondary, marginTop: 4 }}>{notif.time}</div>
                          </div>
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              dismissNotification(notif.id);
                            }}
                            style={{ background: 'none', border: 'none', color: '#aaa', cursor: 'pointer', fontSize: 16, padding: 4 }}
                            title="Dismiss"
                          >×</button>
                        </div>
                      ))
                    ) : (
                      <div style={{ padding: 24, textAlign: 'center', color: '#aaa' }}>
                        No notifications
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* element-006: Settings */}
          <button
            onMouseEnter={() => setHoveredElement('settings-header')}
            onMouseLeave={() => setHoveredElement(null)}
            style={{
              ...styles.iconButton,
              backgroundColor: hoveredElement === 'settings-header' ? colors.hover : 'transparent',
              color: colors.text,
            }}
            aria-label="Settings"
            title="Settings"
            onClick={() => { setShowSettings(!showSettings); setShowNotificationsPanel(false); }}
          >
            <SettingsIcon size={24} />
          </button>

          {/* element-007: Sign In / Profile */}
          {!isSignedOut ? (
            <div
              style={{ ...styles.profileButton, cursor: 'pointer' }}
              title="Your channel"
              onClick={() => setRoute("profile")}
            >
              {selfChannel?.avatarSrc ? (
                <img
                  src={selfChannel?.avatarSrc ? `/${selfChannel.avatarSrc}` : ''}
                  alt={selfChannel?.name || 'You'}
                  style={{ ...styles.avatar, objectFit: 'cover' }}
                />
              ) : (
                <div style={styles.avatar}>{selfChannel?.name?.charAt(0) || 'U'}</div>
              )}
            </div>
          ) : (
            <button
              style={styles.signInButton}
              onClick={() => setState(prev => ({ ...prev, isLoggedIn: true }))}
              aria-label="Sign in"
            >
              <div style={styles.signInIcon}>
                <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm0 3c1.66 0 3 1.34 3 3s-1.34 3-3 3-3-1.34-3-3 1.34-3 3-3zm0 14.2c-2.5 0-4.71-1.28-6-3.22.03-1.99 4-3.08 6-3.08 1.99 0 5.97 1.09 6 3.08-1.29 1.94-3.5 3.22-6 3.22z"/>
                </svg>
              </div>
              <span>Sign in</span>
            </button>
          )}
        </div>

        {/* Settings dropdown */}
        {showSettings && (
          <div style={{...styles.settingsDropdown, backgroundColor: colors.cardBg, color: colors.text}}>
            <div
              style={{
                ...styles.settingsItem,
                backgroundColor: hoveredElement === 'setting-appearance' ? colors.hover : 'transparent',
              }}
              onMouseEnter={() => setHoveredElement('setting-appearance')}
              onMouseLeave={() => setHoveredElement(null)}
              onClick={() => {
                setState(prev => ({ ...prev, darkMode: !prev.darkMode }));
              }}
            >
              Appearance: {state.darkMode ? 'Dark' : 'Light'}
            </div>
            <hr style={{...styles.divider, borderColor: colors.border}} />
            <div
              style={{
                ...styles.settingsItem,
                backgroundColor: hoveredElement === 'setting-logout' ? colors.hover : 'transparent',
                color: '#f44',
              }}
              onMouseEnter={() => setHoveredElement('setting-logout')}
              onMouseLeave={() => setHoveredElement(null)}
              onClick={() => { setShowSettings(false); setIsSignedOut(true); }}
            >
              Sign out
            </div>
          </div>
        )}
      </header>

      <div style={{...styles.mainContent, backgroundColor: colors.bg}}>
        {/* Sidebar (elements 008-029) */}
        <aside
          style={{
            ...styles.sidebar,
            width: state.sidebarState === "expanded" ? "240px" : "72px",
            backgroundColor: colors.sidebarBg,
          }}
        >
          <div style={styles.sidebarSection}>
            {SIDEBAR_PRIMARY.map((item) => {
              const Icon = item.icon;
              const isActive = item.section === currentView;
              return (
                <button
                  key={item.id}
                  onMouseEnter={() => setHoveredElement(item.id)}
                  onMouseLeave={() => setHoveredElement(null)}
                  style={{
                    ...styles.sidebarItem,
                    ...(isActive ? styles.sidebarItemActive : {}),
                    backgroundColor: !isActive && hoveredElement === item.id ? colors.hover : (isActive ? colors.cardBg : 'transparent'),
                    justifyContent: state.sidebarState === "expanded" ? "flex-start" : "center",
                    color: colors.text,
                  }}
                  onClick={() => {
                    if (item.requiresAuth && !!isSignedOut) {
                      return;
                    }
                    setState((prev) => ({ ...prev, searchQuery: "" }));
                    setRoute(item.section);
                    setSearchResults([]);
                  }}
                  aria-label={item.label}
                  title={item.label}
                >
                  <Icon size={24} />
                  {state.sidebarState === "expanded" && (
                    <span style={styles.sidebarLabel}>{item.label}</span>
                  )}
                </button>
              );
            })}
          </div>

          {state.sidebarState === "expanded" && (
            <>
              <hr style={{...styles.sidebarDivider, borderColor: colors.border}} />

              <div style={styles.sidebarSection}>
                <div style={{...styles.sidebarSectionTitle, color: colors.textSecondary}}>You</div>
                {SIDEBAR_YOU.map((item) => {
                  const Icon = item.icon;
                  return (
                    <button
                      key={item.id}
                      onMouseEnter={() => setHoveredElement(item.id)}
                      onMouseLeave={() => setHoveredElement(null)}
                      style={{
                        ...styles.sidebarItem,
                        backgroundColor: hoveredElement === item.id ? colors.hover : 'transparent',
                        color: colors.text,
                      }}
                      onClick={() => {
                        setState((prev) => ({ ...prev, searchQuery: "" }));
                        setRoute(item.section);
                        setSearchResults([]);
                      }}
                      title={item.label}
                    >
                      <Icon size={24} />
                      <span style={styles.sidebarLabel}>{item.label}</span>
                    </button>
                  );
                })}
              </div>

              <hr style={{...styles.sidebarDivider, borderColor: colors.border}} />

              <div style={styles.sidebarSection}>
                <div style={{...styles.sidebarSectionTitle, color: colors.textSecondary}}>Explore</div>
                {SIDEBAR_EXPLORE.map((item) => {
                  const Icon = item.icon;
                  return (
                    <button
                      key={item.id}
                      onMouseEnter={() => setHoveredElement(item.id)}
                      onMouseLeave={() => setHoveredElement(null)}
                      style={{
                        ...styles.sidebarItem,
                        backgroundColor: hoveredElement === item.id ? colors.hover : 'transparent',
                        color: colors.text,
                      }}
                      title={item.label}
                      onClick={() => {
                        setState((prev) => ({ ...prev, searchQuery: "" }));
                        setRoute(item.section);
                        setSearchResults([]);
                      }}
                    >
                      <Icon size={24} />
                      <span style={styles.sidebarLabel}>{item.label}</span>
                    </button>
                  );
                })}
              </div>

              <hr style={{...styles.sidebarDivider, borderColor: colors.border}} />

              <div style={styles.sidebarSection}>
                <div style={{...styles.sidebarSectionTitle, color: colors.textSecondary}}>More from MicroTube</div>
                {SIDEBAR_MORE.map((item) => {
                  const Icon = item.icon;
                  return (
                    <button
                      key={item.id}
                      onMouseEnter={() => setHoveredElement(item.id)}
                      onMouseLeave={() => setHoveredElement(null)}
                      style={{
                        ...styles.sidebarItem,
                        backgroundColor: hoveredElement === item.id ? colors.hover : 'transparent',
                        color: colors.text,
                      }}
                      title={item.label}
                      onClick={() => {
                        setState((prev) => ({ ...prev, searchQuery: "" }));
                        setRoute(item.section);
                        setSearchResults([]);
                      }}
                    >
                      <Icon size={24} />
                      <span style={styles.sidebarLabel}>{item.label}</span>
                    </button>
                  );
                })}
              </div>

              <hr style={styles.sidebarDivider} />

              <div style={{ ...styles.sidebarSection, fontSize: 13, color: '#aaa', padding: '12px 24px' }}>
                <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                  <button
                    onClick={() => { setState((prev) => ({ ...prev, searchQuery: "" })); setRoute("about"); setSearchResults([]); }}
                    onMouseEnter={() => setHoveredElement('footer-about')}
                    onMouseLeave={() => setHoveredElement(null)}
                    style={{
                      ...styles.footerLink,
                      color: hoveredElement === 'footer-about' ? '#fff' : '#aaa',
                    }}
                  >About</button>
                  <button
                    onClick={() => { setState((prev) => ({ ...prev, searchQuery: "" })); setRoute("press"); setSearchResults([]); }}
                    onMouseEnter={() => setHoveredElement('footer-press')}
                    onMouseLeave={() => setHoveredElement(null)}
                    style={{
                      ...styles.footerLink,
                      color: hoveredElement === 'footer-press' ? '#fff' : '#aaa',
                    }}
                  >Press</button>
                  <button
                    onClick={() => { setState((prev) => ({ ...prev, searchQuery: "" })); setRoute("copyright"); setSearchResults([]); }}
                    onMouseEnter={() => setHoveredElement('footer-copyright')}
                    onMouseLeave={() => setHoveredElement(null)}
                    style={{
                      ...styles.footerLink,
                      color: hoveredElement === 'footer-copyright' ? '#fff' : '#aaa',
                    }}
                  >Copyright</button>
                </div>
                <div style={{ marginTop: 8, display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                  <button
                    onClick={() => { setState((prev) => ({ ...prev, searchQuery: "" })); setRoute("contact"); setSearchResults([]); }}
                    onMouseEnter={() => setHoveredElement('footer-contact')}
                    onMouseLeave={() => setHoveredElement(null)}
                    style={{
                      ...styles.footerLink,
                      color: hoveredElement === 'footer-contact' ? '#fff' : '#aaa',
                    }}
                  >Contact us</button>
                  <button
                    onClick={() => { setState((prev) => ({ ...prev, searchQuery: "" })); setRoute("creators"); setSearchResults([]); }}
                    onMouseEnter={() => setHoveredElement('footer-creators')}
                    onMouseLeave={() => setHoveredElement(null)}
                    style={{
                      ...styles.footerLink,
                      color: hoveredElement === 'footer-creators' ? '#fff' : '#aaa',
                    }}
                  >Creators</button>
                </div>
                <div style={{ marginTop: 8, display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                  <button
                    onClick={() => { setState((prev) => ({ ...prev, searchQuery: "" })); setRoute("advertise"); setSearchResults([]); }}
                    onMouseEnter={() => setHoveredElement('footer-advertise')}
                    onMouseLeave={() => setHoveredElement(null)}
                    style={{
                      ...styles.footerLink,
                      color: hoveredElement === 'footer-advertise' ? '#fff' : '#aaa',
                    }}
                  >Advertise</button>
                  <button
                    onClick={() => { setState((prev) => ({ ...prev, searchQuery: "" })); setRoute("developers"); setSearchResults([]); }}
                    onMouseEnter={() => setHoveredElement('footer-developers')}
                    onMouseLeave={() => setHoveredElement(null)}
                    style={{
                      ...styles.footerLink,
                      color: hoveredElement === 'footer-developers' ? '#fff' : '#aaa',
                    }}
                  >Developers</button>
                </div>
                <div style={{ marginTop: 16, display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                  <button
                    onClick={() => { setState((prev) => ({ ...prev, searchQuery: "" })); setRoute("terms"); setSearchResults([]); }}
                    onMouseEnter={() => setHoveredElement('footer-terms')}
                    onMouseLeave={() => setHoveredElement(null)}
                    style={{
                      ...styles.footerLink,
                      color: hoveredElement === 'footer-terms' ? '#fff' : '#aaa',
                    }}
                  >Terms</button>
                  <button
                    onClick={() => { setState((prev) => ({ ...prev, searchQuery: "" })); setRoute("privacy"); setSearchResults([]); }}
                    onMouseEnter={() => setHoveredElement('footer-privacy')}
                    onMouseLeave={() => setHoveredElement(null)}
                    style={{
                      ...styles.footerLink,
                      color: hoveredElement === 'footer-privacy' ? '#fff' : '#aaa',
                    }}
                  >Privacy</button>
                  <button
                    onClick={() => { setState((prev) => ({ ...prev, searchQuery: "" })); setRoute("policy"); setSearchResults([]); }}
                    onMouseEnter={() => setHoveredElement('footer-policy')}
                    onMouseLeave={() => setHoveredElement(null)}
                    style={{
                      ...styles.footerLink,
                      color: hoveredElement === 'footer-policy' ? '#fff' : '#aaa',
                    }}
                  >Policy & Safety</button>
                </div>
                <div style={{ marginTop: 8 }}>
                  <button
                    onClick={() => { setState((prev) => ({ ...prev, searchQuery: "" })); setRoute("how-it-works"); setSearchResults([]); }}
                    onMouseEnter={() => setHoveredElement('footer-how')}
                    onMouseLeave={() => setHoveredElement(null)}
                    style={{
                      ...styles.footerLink,
                      color: hoveredElement === 'footer-how' ? '#fff' : '#aaa',
                    }}
                  >How MicroTube works</button>
                </div>
                <div style={{ marginTop: 8 }}>
                  <button
                    onClick={() => { setState((prev) => ({ ...prev, searchQuery: "" })); setRoute("test-features"); setSearchResults([]); }}
                    onMouseEnter={() => setHoveredElement('footer-test')}
                    onMouseLeave={() => setHoveredElement(null)}
                    style={{
                      ...styles.footerLink,
                      color: hoveredElement === 'footer-test' ? '#fff' : '#aaa',
                    }}
                  >Test new features</button>
                </div>
                <div style={{ marginTop: 16, color: '#717171' }}>© 2024 MicroTube</div>
              </div>
            </>
          )}
        </aside>

        {/* Main video area */}
        <main
          style={{
            ...styles.content,
            marginLeft: state.sidebarState === "expanded" ? "240px" : "72px",
            backgroundColor: colors.bg,
            color: colors.text,
          }}
        >
          {currentView === "watch" && watchingVideoId ? (
            <div style={{ display: 'flex', gap: 24, maxWidth: fullscreenState === "theater" ? '100%' : '1600px', margin: '0 auto' }}>
              {/* Main video column */}
              <div
                ref={playerContainerRef}
                style={{
                  flex: 1,
                  minWidth: 0,
                  ...(fullscreenState === "theater" ? styles.theaterMode : {}),
                }}
              >
              {/* Video player (element-030) */}
              {currentVideoData?.videoSrc && !videoError ? (
                <video
                  ref={videoRef}
                  src={`/${currentVideoData.videoSrc}`}
                  style={styles.videoElement}
                  poster={currentVideoData.thumbnailSrc ? `/${currentVideoData.thumbnailSrc}` : undefined}
                  onClick={togglePlayPause}
                  onLoadedMetadata={(e) => {
                    const video = e.currentTarget;
                    setVideoDuration(video.duration);
                    setPlayerState("paused");
                    video.volume = state.volume / 100;
                    video.muted = state.isMuted;
                  }}
                  onTimeUpdate={(e) => {
                    setCurrentTime(e.currentTarget.currentTime);
                  }}
                  onEnded={() => {
                    setPlayerState("ended");
                  }}
                  onError={() => {
                    setVideoError(true);
                    // Fallback to simulated video
                    setVideoDuration(180);
                    setPlayerState("paused");
                  }}
                  onPlay={() => setPlayerState("playing")}
                  onPause={() => setPlayerState("paused")}
                />
              ) : (
                <div style={styles.videoPlaceholder}>
                  <div style={styles.videoPlaceholderOverlay}>
                    <div style={styles.videoPlaceholderText}>
                      {currentVideoData ? currentVideoData.title : "Video Player"}
                      <div style={{ fontSize: 14, marginTop: 8, opacity: 0.7 }}>
                        {videoError ? "Video unavailable - showing preview" : "Click play to start playback"}
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* Player controls */}
              <div style={styles.playerControls}>
                <div style={styles.progressBarContainer}>
                  <input
                    type="range"
                    min="0"
                    max={videoDuration}
                    value={currentTime}
                    onChange={(e) => seekVideo(Number(e.target.value))}
                    style={styles.progressBar}
                    aria-label="Seek"
                  />
                </div>

                <div style={styles.controlsRow}>
                  <div style={styles.controlsLeft}>
                    {/* element-030: Play/Pause */}
                    <button
                      onClick={togglePlayPause}
                      onMouseEnter={() => setHoveredElement('play-pause')}
                      onMouseLeave={() => setHoveredElement(null)}
                      style={{
                        ...styles.controlButton,
                        backgroundColor: hoveredElement === 'play-pause' ? colors.hover : 'transparent',
                        color: colors.text,
                      }}
                      aria-label={playerState === "playing" ? "Pause (k)" : "Play (k)"}
                      title={playerState === "playing" ? "Pause (k)" : "Play (k)"}
                    >
                      {playerState === "playing" ? <PauseIcon size={24} /> : <PlayIcon size={24} />}
                    </button>

                    {/* element-031: Volume */}
                    <button
                      onClick={toggleMute}
                      onMouseEnter={() => setHoveredElement('volume')}
                      onMouseLeave={() => setHoveredElement(null)}
                      style={{
                        ...styles.controlButton,
                        backgroundColor: hoveredElement === 'volume' ? colors.hover : 'transparent',
                        color: colors.text,
                      }}
                      aria-label="Mute (m)"
                      title="Mute (m)"
                    >
                      {React.createElement(getVolumeIcon(), { size: 24 })}
                    </button>

                    <input
                      type="range"
                      min="0"
                      max="100"
                      value={state.volume}
                      onChange={(e) => handleVolumeChange(Number(e.target.value))}
                      style={styles.volumeSlider}
                      aria-label="Volume"
                    />

                    <span style={styles.timeDisplay}>
                      {formatTime(currentTime)} / {formatTime(videoDuration)}
                    </span>
                  </div>

                  <div style={styles.controlsRight}>
                    {/* element-032: Captions */}
                    <button
                      onMouseEnter={() => setHoveredElement('captions')}
                      onMouseLeave={() => setHoveredElement(null)}
                      style={{
                        ...styles.controlButton,
                        backgroundColor: hoveredElement === 'captions' ? colors.hover : 'transparent',
                        color: colors.text,
                      }}
                      aria-label="Subtitles/closed captions"
                      title="Subtitles/closed captions (c)"
                      onClick={() => setState(prev => ({ ...prev, captionsEnabled: !prev.captionsEnabled }))}
                    >
                      <ClosedCaptionIcon size={24} />
                    </button>

                    {/* element-033: Settings */}
                    <div style={{ position: 'relative' }}>
                      <button
                        onMouseEnter={() => setHoveredElement('video-settings')}
                        onMouseLeave={() => setHoveredElement(null)}
                        style={{
                          ...styles.controlButton,
                          backgroundColor: hoveredElement === 'video-settings' ? colors.hover : 'transparent',
                          color: colors.text,
                        }}
                        aria-label="Settings"
                        title="Settings"
                        onClick={() => setShowVideoSettings(!showVideoSettings)}
                      >
                        <SettingsIcon size={24} />
                      </button>

                      {showVideoSettings && (
                        <div style={styles.videoSettingsMenu}>
                          {!showSpeedMenu && !showQualityMenu ? (
                            <>
                              <div
                                style={styles.videoSettingsItem}
                                onClick={() => setShowQualityMenu(true)}
                              >
                                <span>Quality</span>
                                <div style={{ display: 'flex', alignItems: 'center', gap: 8, color: '#aaa' }}>
                                  <span>{state.videoQuality}</span>
                                  <ChevronRightIcon size={20} />
                                </div>
                              </div>
                              <div
                                style={styles.videoSettingsItem}
                                onClick={() => setShowSpeedMenu(true)}
                              >
                                <span>Playback speed</span>
                                <div style={{ display: 'flex', alignItems: 'center', gap: 8, color: '#aaa' }}>
                                  <span>{state.playbackSpeed === 1 ? 'Normal' : `${state.playbackSpeed}x`}</span>
                                  <ChevronRightIcon size={20} />
                                </div>
                              </div>
                            </>
                          ) : showSpeedMenu ? (
                            <>
                              <div
                                style={styles.videoSettingsItem}
                                onClick={() => setShowSpeedMenu(false)}
                              >
                                <ChevronLeftIcon size={20} />
                                <span style={{ marginLeft: 8 }}>Playback speed</span>
                              </div>
                              <hr style={styles.divider} />
                              {PLAYBACK_SPEEDS.map(speed => (
                                <div
                                  key={speed}
                                  style={{
                                    ...styles.videoSettingsItem,
                                    ...(state.playbackSpeed === speed ? { fontWeight: 500 } : {}),
                                  }}
                                  onClick={() => changePlaybackSpeed(speed)}
                                >
                                  {speed === 1 ? 'Normal' : `${speed}`}
                                </div>
                              ))}
                            </>
                          ) : (
                            <>
                              <div
                                style={styles.videoSettingsItem}
                                onClick={() => setShowQualityMenu(false)}
                              >
                                <ChevronLeftIcon size={20} />
                                <span style={{ marginLeft: 8 }}>Quality</span>
                              </div>
                              <hr style={styles.divider} />
                              {VIDEO_QUALITIES.map(quality => (
                                <div
                                  key={quality}
                                  style={{
                                    ...styles.videoSettingsItem,
                                    ...(state.videoQuality === quality ? { fontWeight: 500 } : {}),
                                  }}
                                  onClick={() => changeQuality(quality)}
                                >
                                  {quality}
                                </div>
                              ))}
                            </>
                          )}
                        </div>
                      )}
                    </div>

                    {/* element-034: Theater mode */}
                    <button
                      onClick={toggleTheaterMode}
                      onMouseEnter={() => setHoveredElement('theater')}
                      onMouseLeave={() => setHoveredElement(null)}
                      style={{
                        ...styles.controlButton,
                        backgroundColor: hoveredElement === 'theater' ? colors.hover : 'transparent',
                        color: colors.text,
                      }}
                      aria-label="Theater mode (t)"
                      title="Theater mode (t)"
                    >
                      <TheaterModeIcon size={24} />
                    </button>

                    {/* element-035: Fullscreen */}
                    <button
                      onClick={toggleFullscreen}
                      onMouseEnter={() => setHoveredElement('fullscreen')}
                      onMouseLeave={() => setHoveredElement(null)}
                      style={{
                        ...styles.controlButton,
                        backgroundColor: hoveredElement === 'fullscreen' ? colors.hover : 'transparent',
                        color: colors.text,
                      }}
                      aria-label="Full screen (f)"
                      title="Full screen (f)"
                    >
                      {fullscreenState === "fullscreen" ?
                        <FullscreenExitIcon size={24} /> :
                        <FullscreenIcon size={24} />
                      }
                    </button>
                  </div>
                </div>
              </div>

              {/* Video info */}
              <div style={styles.videoInfo}>
                <h1 style={styles.videoTitle}>{currentVideo?.title || "Video Title"}</h1>

                <div style={styles.videoMeta}>
                  <div style={styles.channelInfo}>
                    {currentVideo?.channelAvatarUrl ? (
                      <img
                        src={currentVideo.channelAvatarUrl}
                        alt={currentVideo.channel}
                        style={{ ...styles.channelAvatar, cursor: 'pointer', objectFit: 'cover' }}
                        onClick={() => currentVideo && navigateToChannel(currentVideo.channelId)}
                      />
                    ) : (
                      <div
                        style={{ ...styles.channelAvatar, cursor: 'pointer' }}
                        onClick={() => currentVideo && navigateToChannel(currentVideo.channelId)}
                      >{currentVideo?.channelAvatar || "C"}</div>
                    )}
                    <div>
                      <div
                        style={{ ...styles.channelName, cursor: 'pointer' }}
                        onClick={() => currentVideo && navigateToChannel(currentVideo.channelId)}
                        onMouseEnter={(e) => (e.currentTarget.style.color = '#fff')}
                        onMouseLeave={(e) => (e.currentTarget.style.color = '#aaa')}
                      >{currentVideo?.channel || "Channel Name"}</div>
                      <div style={styles.subscriberCount}>
                        {(() => {
                          const channel = currentVideo ? getChannelById(currentVideo.channelId) : null;
                          return channel ? `${channel.subscribers.toLocaleString()} subscribers` : '1.2M subscribers';
                        })()}
                      </div>
                    </div>
                    <button
                      onMouseEnter={() => setHoveredElement('subscribe')}
                      onMouseLeave={() => setHoveredElement(null)}
                      style={{
                        ...styles.subscribeButton,
                        ...(currentVideo && isChannelSubscribed(currentVideo.channelId) ? styles.subscribedButton : {}),
                        opacity: hoveredElement === 'subscribe' ? 0.9 : 1,
                      }}
                      onClick={() => currentVideo && toggleSubscribe(currentVideo.channelId)}
                                          >
                      {currentVideo && isChannelSubscribed(currentVideo.channelId) ? "Subscribed" : "Subscribe"}
                    </button>
                  </div>

                  <div style={styles.videoActions}>
                    <div style={styles.actionButtonGroup}>
                      <button
                        onClick={likeVideo}
                        onMouseEnter={() => setHoveredElement('like-btn')}
                        onMouseLeave={() => setHoveredElement(null)}
                        style={{
                          ...styles.actionButton,
                          ...styles.actionButtonLeft,
                          ...(watchingVideoId && isVideoLiked(watchingVideoId) ? styles.actionButtonActive : {}),
                          backgroundColor: hoveredElement === 'like-btn' ? colors.hover : colors.cardBg,
                        }}
                                                title="I like this"
                      >
                        <LikeIcon size={24} />
                        <span style={{ marginLeft: 6 }}>
                          {watchingVideoId && isVideoLiked(watchingVideoId) ? "Liked" : "Like"}
                        </span>
                      </button>
                      <div style={styles.actionButtonDivider} />
                      <button
                        onClick={dislikeVideo}
                        onMouseEnter={() => setHoveredElement('dislike-btn')}
                        onMouseLeave={() => setHoveredElement(null)}
                        style={{
                          ...styles.actionButton,
                          ...styles.actionButtonRight,
                          ...(watchingVideoId && isVideoDisliked(watchingVideoId) ? styles.actionButtonActive : {}),
                          backgroundColor: hoveredElement === 'dislike-btn' ? colors.hover : colors.cardBg,
                        }}
                                                title="I dislike this"
                      >
                        <DislikeIcon size={24} />
                      </button>
                    </div>

                    <button
                      onMouseEnter={() => setHoveredElement('share')}
                      onMouseLeave={() => setHoveredElement(null)}
                      style={{
                        ...styles.actionButton,
                        backgroundColor: hoveredElement === 'share' ? colors.hover : colors.cardBg,
                      }}
                      onClick={() => setShowShareModal(true)}
                      title="Share"
                    >
                      <ShareIcon size={24} />
                      <span style={{ marginLeft: 6 }}>Share</span>
                    </button>

                    <button
                      onMouseEnter={() => setHoveredElement('save')}
                      onMouseLeave={() => setHoveredElement(null)}
                      style={{
                        ...styles.actionButton,
                        backgroundColor: hoveredElement === 'save' ? colors.hover : colors.cardBg,
                        ...(watchingVideoId && isVideoSaved(watchingVideoId) ? { color: '#3ea6ff' } : {}),
                      }}
                                            title="Save to playlist"
                      onClick={() => !isSignedOut && setShowSaveModal(true)}
                    >
                      <SaveIcon size={24} />
                      <span style={{ marginLeft: 6 }}>{watchingVideoId && isVideoSaved(watchingVideoId) ? "Saved" : "Save"}</span>
                    </button>

                    <div style={{ position: 'relative' }}>
                      <button
                        onMouseEnter={() => setHoveredElement('more')}
                        onMouseLeave={() => setHoveredElement(null)}
                        style={{
                          ...styles.actionButton,
                          backgroundColor: hoveredElement === 'more' ? colors.hover : colors.cardBg,
                        }}
                        onClick={() => setShowMoreMenu(!showMoreMenu)}
                        title="More"
                      >
                        <MoreIcon size={24} />
                      </button>
                      {showMoreMenu && (
                        <div style={{
                          position: 'absolute',
                          top: '100%',
                          right: 0,
                          backgroundColor: colors.cardBg,
                          color: colors.text,
                          borderRadius: 12,
                          boxShadow: '0 4px 32px rgba(0,0,0,0.5)',
                          overflow: 'hidden',
                          zIndex: 1000,
                          minWidth: 200,
                        }}>
                          {[
                            { label: 'Add to queue', action: () => { if (watchingVideoId) addToQueue(watchingVideoId); } },
                            { label: 'Save to Watch later', action: () => { if (watchingVideoId) saveVideo(watchingVideoId); } },
                            { label: 'Save to playlist', action: () => setShowSaveModal(true) },
                            { label: 'Download', action: () => {} },
                            { label: 'Clip', action: () => setShowClipModal(true) },
                            { label: 'Report', action: () => setShowReportModal(true) },
                          ].map((item, i) => (
                            <div
                              key={i}
                              onClick={() => { item.action(); setShowMoreMenu(false); }}
                              style={{
                                padding: '12px 16px',
                                cursor: 'pointer',
                                fontSize: 14,
                              }}
                              onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = '#3f3f3f')}
                              onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = 'transparent')}
                            >
                              {item.label}
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                </div>

                {/* Description area */}
                <div style={styles.descriptionBox}>
                  <div style={{ fontWeight: 500, marginBottom: 8 }}>
                    {currentVideo?.views} • {currentVideo?.timestamp}
                  </div>
                  <div style={{ color: colors.text, whiteSpace: 'pre-line' }}>
                    {currentVideo?.description || "No description available."}
                  </div>
                </div>
              </div>

              {/* Comments section */}
              <div style={styles.commentsSection}>
                <div style={{ fontSize: 20, fontWeight: 500, marginBottom: 24 }}>
                  {watchingVideoId ? getCommentsForVideo(watchingVideoId).length : 0} Comments
                </div>
                <div style={{ marginBottom: 24 }}>
                  <div style={styles.commentInput}>
                    {selfChannel?.avatarSrc ? (
                      <img src={selfChannel?.avatarSrc ? `/${selfChannel.avatarSrc}` : ''} alt={selfChannel?.name || 'You'} style={{ ...styles.channelAvatar, objectFit: 'cover' }} />
                    ) : (
                      <div style={styles.channelAvatar}>{selfChannel?.name?.charAt(0) || "U"}</div>
                    )}
                    <input
                      ref={commentInputRef}
                      type="text"
                      placeholder="Add a comment..."
                      style={styles.commentTextInput}
                      value={newComment}
                      onChange={(e) => setNewComment(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter' && newComment.trim()) {
                          addComment(newComment);
                        }
                      }}
                    />
                  </div>
                  {newComment.trim() && (
                    <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginTop: 8 }}>
                      <button
                        style={{
                          padding: '8px 16px',
                          backgroundColor: 'transparent',
                          color: '#aaa',
                          border: 'none',
                          borderRadius: 20,
                          cursor: 'pointer',
                        }}
                        onClick={() => setNewComment("")}
                      >Cancel</button>
                      <button
                        style={{
                          padding: '8px 16px',
                          backgroundColor: '#3ea6ff',
                          color: '#0f0f0f',
                          border: 'none',
                          borderRadius: 20,
                          fontWeight: 500,
                          cursor: 'pointer',
                        }}
                        onClick={() => addComment(newComment)}
                      >Comment</button>
                    </div>
                  )}
                </div>

                {/* Display comments */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                  {watchingVideoId && getCommentsForVideo(watchingVideoId).map((comment) => (
                    <div key={comment.id} style={{ display: 'flex', gap: 12 }}>
                      {comment.userAvatarUrl ? (
                        <img
                          src={comment.userAvatarUrl}
                          alt={comment.userName}
                          style={{
                            width: 40,
                            height: 40,
                            borderRadius: '50%',
                            objectFit: 'cover',
                            cursor: 'pointer',
                            flexShrink: 0,
                          }}
                          onClick={() => navigateToChannel(comment.videoId.startsWith('ch-') ? comment.videoId : 'ch-tech')}
                        />
                      ) : (
                        <div
                          style={{
                            width: 40,
                            height: 40,
                            borderRadius: '50%',
                            backgroundColor: '#3ea6ff',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            fontSize: 14,
                            fontWeight: 500,
                            color: '#fff',
                            cursor: 'pointer',
                            flexShrink: 0,
                          }}
                          onClick={() => navigateToChannel(comment.videoId.startsWith('ch-') ? comment.videoId : 'ch-tech')}
                        >{comment.userAvatar}</div>
                      )}
                      <div style={{ flex: 1 }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                          <span
                            style={{ fontWeight: 500, fontSize: 13, cursor: 'pointer' }}
                            onClick={() => navigateToChannel(comment.videoId.startsWith('ch-') ? comment.videoId : 'ch-tech')}
                          >{comment.userName}</span>
                          <span style={{ color: '#aaa', fontSize: 12 }}>{comment.timestamp}</span>
                        </div>
                        <p style={{ margin: 0, fontSize: 14, lineHeight: 1.4 }}>{comment.content}</p>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 16, marginTop: 8 }}>
                          <button
                            style={{
                              display: 'flex',
                              alignItems: 'center',
                              gap: 4,
                              background: 'none',
                              border: 'none',
                              color: state.likedComments.includes(comment.id) ? '#3ea6ff' : '#aaa',
                              cursor: 'pointer',
                              padding: 4,
                            }}
                            onClick={() => {
                              if (!isSignedOut) {
                                toggleCommentLike(comment.id);
                              }
                            }}
                          >
                            <LikeIcon size={16} />
                            <span style={{ fontSize: 12 }}>{comment.likes + (state.likedComments.includes(comment.id) ? 1 : 0)}</span>
                          </button>
                          <button
                            style={{
                              display: 'flex',
                              alignItems: 'center',
                              gap: 4,
                              background: 'none',
                              border: 'none',
                              color: state.dislikedComments.includes(comment.id) ? '#3ea6ff' : '#aaa',
                              cursor: 'pointer',
                              padding: 4,
                            }}
                            onClick={() => {
                              if (!isSignedOut) {
                                toggleCommentDislike(comment.id);
                              }
                            }}
                          >
                            <DislikeIcon size={16} />
                          </button>
                          <button
                            style={{
                              background: 'none',
                              border: 'none',
                              color: replyingToCommentId === comment.id ? '#3ea6ff' : '#aaa',
                              cursor: 'pointer',
                              fontSize: 12,
                              padding: 4,
                            }}
                            onClick={() => {
                              if (!isSignedOut) {
                                setReplyingToCommentId(replyingToCommentId === comment.id ? null : comment.id);
                                setReplyText("");
                              }
                            }}
                          >Reply</button>
                        </div>
                        {/* Reply input */}
                        {replyingToCommentId === comment.id && (
                          <div style={{ marginTop: 12, display: 'flex', gap: 8 }}>
                            <input
                              type="text"
                              value={replyText}
                              onChange={(e) => setReplyText(e.target.value)}
                              placeholder="Add a reply..."
                              style={{
                                flex: 1,
                                padding: '8px 12px',
                                backgroundColor: colors.cardBg,
                                border: `1px solid ${colors.border}`,
                                borderRadius: 20,
                                color: colors.text,
                                fontSize: 13,
                              }}
                              onKeyDown={(e) => {
                                if (e.key === 'Enter' && replyText.trim()) {
                                  addCommentReply(comment.id, replyText);
                                }
                              }}
                            />
                            <button
                              onClick={() => addCommentReply(comment.id, replyText)}
                              disabled={!replyText.trim()}
                              style={{
                                padding: '8px 16px',
                                backgroundColor: replyText.trim() ? '#3ea6ff' : colors.cardBg,
                                color: replyText.trim() ? '#0f0f0f' : colors.textSecondary,
                                border: 'none',
                                borderRadius: 20,
                                cursor: replyText.trim() ? 'pointer' : 'default',
                                fontSize: 13,
                                fontWeight: 500,
                              }}
                            >Reply</button>
                          </div>
                        )}
                        {/* Show replies */}
                        {state.commentReplies[comment.id] && state.commentReplies[comment.id].length > 0 && (
                          <div style={{ marginTop: 12, marginLeft: 24, borderLeft: `2px solid ${colors.border}`, paddingLeft: 12 }}>
                            {state.commentReplies[comment.id].map((reply) => (
                              <div key={reply.id} style={{ marginBottom: 12 }}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                                  <div style={{ width: 24, height: 24, borderRadius: '50%', backgroundColor: '#3ea6ff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 10, color: '#fff' }}>
                                    {reply.userAvatar}
                                  </div>
                                  <span style={{ fontWeight: 500, fontSize: 12 }}>{reply.userName}</span>
                                  <span style={{ color: '#aaa', fontSize: 11 }}>{reply.timestamp}</span>
                                </div>
                                <p style={{ margin: 0, fontSize: 13, lineHeight: 1.4, marginLeft: 32 }}>{reply.content}</p>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
              </div>
              {/* Related Videos Sidebar */}
              {fullscreenState !== "theater" && (
                <div style={{ width: 400, flexShrink: 0 }}>
                  <h3 style={{ fontSize: 16, fontWeight: 500, marginBottom: 16 }}>Related videos</h3>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                    {SAMPLE_VIDEOS.filter(v => v.id !== watchingVideoId).slice(0, 10).map((video) => (
                      <div
                        key={video.id}
                        style={{ display: 'flex', gap: 8, cursor: 'pointer', padding: 4, borderRadius: 8 }}
                        onClick={() => loadVideo(video.id)}
                        onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = '#272727')}
                        onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = 'transparent')}
                      >
                        <div style={{ width: 168, height: 94, flexShrink: 0, position: 'relative', borderRadius: 8, overflow: 'hidden' }}>
                          <img src={getThumbnail(video)} alt={video.title} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                          <span style={{ position: 'absolute', bottom: 4, right: 4, backgroundColor: 'rgba(0,0,0,0.8)', padding: '2px 4px', borderRadius: 2, fontSize: 11 }}>{video.duration}</span>
                        </div>
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <h4 style={{ fontSize: 13, fontWeight: 500, marginBottom: 4, lineHeight: 1.3, display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>{video.title}</h4>
                          <p style={{ fontSize: 12, color: '#aaa', marginBottom: 2 }}>{video.channel}</p>
                          <p style={{ fontSize: 11, color: '#717171' }}>{video.views} • {video.timestamp}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          ) : currentView === 'profile' ? (
            // Profile / Your Channel page
            <div style={{ padding: 24 }}>
              {/* Channel banner */}
              {selfChannel?.bannerSrc ? (
                <img
                  src={selfChannel?.bannerSrc ? `/${selfChannel.bannerSrc}` : ''}
                  alt="Channel banner"
                  style={{
                    width: '100%',
                    height: 180,
                    objectFit: 'cover',
                    borderRadius: 12,
                    marginBottom: 24,
                  }}
                />
              ) : (
                <div style={{
                  height: 180,
                  background: 'linear-gradient(135deg, #3ea6ff 0%, #065fd4 100%)',
                  borderRadius: 12,
                  marginBottom: 24,
                }} />
              )}

              {/* Channel info */}
              <div style={{ display: 'flex', gap: 24, marginBottom: 32 }}>
                {selfChannel?.avatarSrc ? (
                  <img
                    src={selfChannel?.avatarSrc ? `/${selfChannel.avatarSrc}` : ''}
                    alt={selfChannel?.name || 'You'}
                    style={{
                      width: 128,
                      height: 128,
                      borderRadius: '50%',
                      objectFit: 'cover',
                    }}
                  />
                ) : (
                  <div style={{
                    width: 128,
                    height: 128,
                    borderRadius: '50%',
                    backgroundColor: '#3ea6ff',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontSize: 48,
                    fontWeight: 'bold',
                    color: '#fff',
                  }}>{(selfChannel?.name || config?.selfUser?.name)?.charAt(0) || "U"}</div>
                )}
                <div style={{ flex: 1 }}>
                  <h1 style={{ fontSize: 36, fontWeight: 'bold', marginBottom: 8 }}>{config?.selfUser?.name || selfChannel?.name || ""}</h1>
                  <p style={{ color: '#aaa', marginBottom: 4 }}>@{selfChannel?.handle?.replace('@', '') || config?.selfUser?.username || "yourchannel"} • {(selfChannel?.subscribers ?? 0).toLocaleString()} subscribers • {getVideosForChannel("ch-self").length} videos</p>
                  <p style={{ color: '#aaa', marginBottom: 16 }}>{selfChannel?.description || "Welcome to my channel!"}</p>
                  <div style={{ display: 'flex', gap: 12 }}>
                    <button
                      style={{
                        padding: '10px 20px',
                        backgroundColor: '#3ea6ff',
                        color: '#0f0f0f',
                        border: 'none',
                        borderRadius: 20,
                        fontWeight: 500,
                        cursor: 'pointer',
                      }}
                      onClick={() => setShowCustomizeModal(true)}
                    >Customize channel</button>
                    <button
                      style={{
                        padding: '10px 20px',
                        backgroundColor: '#272727',
                        color: '#fff',
                        border: 'none',
                        borderRadius: 20,
                        fontWeight: 500,
                        cursor: 'pointer',
                      }}
                      onClick={() => setShowManageVideosModal(true)}
                    >Manage videos</button>
                  </div>
                </div>
              </div>

              {/* Channel tabs */}
              <div style={{ display: 'flex', gap: 24, borderBottom: '1px solid #3f3f3f', marginBottom: 24 }}>
                {(['videos', 'playlists', 'community', 'about'] as ProfileTab[]).map((tab) => (
                  <button
                    key={tab}
                    style={{
                      background: 'none',
                      border: 'none',
                      color: state.profileTab === tab ? '#fff' : '#aaa',
                      padding: '12px 0',
                      fontSize: 14,
                      fontWeight: 500,
                      cursor: 'pointer',
                      borderBottom: state.profileTab === tab ? '2px solid #fff' : '2px solid transparent',
                      marginBottom: -1,
                      textTransform: 'capitalize',
                    }}
                    onClick={() => setState(prev => ({ ...prev, profileTab: tab }))}
                  >{tab}</button>
                ))}
              </div>

              {/* Tab content */}
              {state.profileTab === 'videos' ? (
                <>
                  <h2 style={{ fontSize: 18, fontWeight: 500, marginBottom: 16 }}>Your Videos</h2>
                  <div style={styles.videoGrid}>
                    {getVideosForChannel("ch-self").map((video) => (
                      <div
                        key={video.id}
                        style={styles.videoCard}
                        onMouseEnter={() => setHoveredVideo(video.id)}
                        onMouseLeave={() => setHoveredVideo(null)}
                        onClick={() => loadVideo(video.id)}
                      >
                        <div style={styles.thumbnailContainer}>
                          <img src={getThumbnail(video)} alt={video.title} style={styles.thumbnail} />
                          <span style={styles.videoDuration}>{video.duration}</span>
                          {hoveredVideo === video.id && <div style={styles.thumbnailOverlay}><PlayIcon size={48} /></div>}
                        </div>
                        <div style={styles.videoDetails}>
                          <div style={styles.videoCardInfo}>
                            <h3 style={{...styles.videoCardTitle, color: colors.text}}>{video.title}</h3>
                            <p style={{...styles.videoCardMeta, color: colors.textSecondary}}>{video.views} • {video.timestamp}</p>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                  {getVideosForChannel("ch-self").length === 0 && (
                    <div style={{ textAlign: 'center', padding: 48, color: colors.textSecondary }}>
                      <p>No videos yet. Click "Manage videos" to upload your first video!</p>
                    </div>
                  )}
                </>
              ) : state.profileTab === 'playlists' ? (
                <div style={{ padding: 24 }}>
                  {apiPlaylists.length > 0 ? (
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: 16 }}>
                      {apiPlaylists.map(playlist => (
                        <div key={playlist.id} style={{ backgroundColor: '#272727', borderRadius: 8, padding: 16 }}>
                          <h4 style={{ marginBottom: 8 }}>{playlist.name}</h4>
                          <p style={{ fontSize: 12, color: '#aaa' }}>{playlist.video_ids.length} videos</p>
                        </div>
                      ))}
                      <div
                        style={{ backgroundColor: '#272727', borderRadius: 8, padding: 16, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: 80 }}
                        onClick={() => setShowCreatePlaylistModal(true)}
                      >
                        <span style={{ fontSize: 24, marginRight: 8 }}>+</span> New Playlist
                      </div>
                    </div>
                  ) : (
                    <div style={{ textAlign: 'center', padding: 48, color: '#aaa' }}>
                      <div style={{ display: 'flex', justifyContent: 'center' }}>
                        <LibraryIcon size={64} />
                      </div>
                      <h3 style={{ marginTop: 16, marginBottom: 8, color: '#fff' }}>No playlists yet</h3>
                      <p>Create playlists to organize your favorite videos</p>
                      <button
                        style={{
                          marginTop: 16,
                          padding: '10px 20px',
                          backgroundColor: '#3ea6ff',
                          color: '#0f0f0f',
                          border: 'none',
                          borderRadius: 20,
                          fontWeight: 500,
                          cursor: 'pointer',
                        }}
                        onClick={() => setShowCreatePlaylistModal(true)}
                      >Create playlist</button>
                    </div>
                  )}
                </div>
              ) : state.profileTab === 'community' ? (
                <div style={{ padding: 24 }}>
                  <div style={{
                    maxWidth: 600,
                    margin: '0 auto 24px',
                    padding: 16,
                    backgroundColor: '#272727',
                    borderRadius: 12,
                  }}>
                    <textarea
                      placeholder="Share something with your community..."
                      value={communityPostText}
                      onChange={(e) => setCommunityPostText(e.target.value)}
                      style={{
                        width: '100%',
                        minHeight: 100,
                        backgroundColor: 'transparent',
                        border: 'none',
                        color: '#fff',
                        fontSize: 14,
                        resize: 'none',
                        outline: 'none',
                      }}
                    />
                    <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 12 }}>
                      <button
                        style={{
                          padding: '8px 16px',
                          backgroundColor: communityPostText.trim() ? '#3ea6ff' : '#3f3f3f',
                          color: communityPostText.trim() ? '#0f0f0f' : '#717171',
                          border: 'none',
                          borderRadius: 20,
                          fontWeight: 500,
                          cursor: communityPostText.trim() ? 'pointer' : 'default',
                        }}
                        onClick={() => addCommunityPost(communityPostText)}
                        disabled={!communityPostText.trim()}
                      >Post</button>
                    </div>
                  </div>
                  {/* Display community posts */}
                  {state.communityPosts.length > 0 ? (
                    <div style={{ maxWidth: 600, margin: '0 auto' }}>
                      {state.communityPosts.map(post => (
                        <div key={post.id} style={{ backgroundColor: '#272727', borderRadius: 12, padding: 16, marginBottom: 16 }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 12 }}>
                            {selfChannel?.avatarSrc ? (
                              <img src={selfChannel?.avatarSrc ? `/${selfChannel.avatarSrc}` : ''} alt={selfChannel?.name || 'You'} style={{ width: 40, height: 40, borderRadius: '50%', objectFit: 'cover' }} />
                            ) : (
                              <div style={{ width: 40, height: 40, borderRadius: '50%', backgroundColor: '#666', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>{selfChannel?.name?.charAt(0) || 'U'}</div>
                            )}
                            <div>
                              <div style={{ fontWeight: 500 }}>{selfChannel?.name || 'You'}</div>
                              <div style={{ fontSize: 12, color: '#aaa' }}>{post.timestamp}</div>
                            </div>
                          </div>
                          <p style={{ color: '#f1f1f1', whiteSpace: 'pre-wrap' }}>{post.content}</p>
                          <div style={{ marginTop: 12, display: 'flex', gap: 16 }}>
                            <button
                              onClick={() => togglePostLike(post.id)}
                              style={{
                                background: 'none',
                                border: 'none',
                                color: state.likedPosts.includes(post.id) ? '#3ea6ff' : '#aaa',
                                cursor: 'pointer',
                                display: 'flex',
                                alignItems: 'center',
                                gap: 4
                              }}
                            >
                              <LikeIcon size={16} /> {post.likes + (state.likedPosts.includes(post.id) ? 1 : 0)}
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div style={{ textAlign: 'center', color: '#aaa', padding: 24 }}>
                      <p>No posts yet. Share something with your community!</p>
                    </div>
                  )}
                </div>
              ) : (
                <div style={{ maxWidth: 800 }}>
                  <h3 style={{ marginBottom: 16 }}>About</h3>
                  <div style={{ marginBottom: 24 }}>
                    <h4 style={{ color: '#aaa', marginBottom: 8, fontSize: 12, textTransform: 'uppercase' }}>Description</h4>
                    <p style={{ lineHeight: 1.6 }}>{selfChannel?.description || "Welcome to my channel! Subscribe for more content."}</p>
                  </div>
                  <div style={{ marginBottom: 24 }}>
                    <h4 style={{ color: '#aaa', marginBottom: 8, fontSize: 12, textTransform: 'uppercase' }}>Stats</h4>
                    <p>Joined: January 2024</p>
                    <p>{(selfChannel?.subscribers ?? 0).toLocaleString()} subscribers</p>
                    <p>{getVideosForChannel("ch-self").length} videos</p>
                  </div>
                </div>
              )}
            </div>
          ) : currentView === 'channel' && viewingChannelId ? (
            // Viewing another channel's page
            (() => {
              const channel = getChannelById(viewingChannelId);
              const channelVideos = getVideosForChannel(viewingChannelId);
              if (!channel) return <div style={{ padding: 24, color: '#aaa' }}>Channel not found</div>;
              return (
                <div style={{ padding: 24 }}>
                  {/* Channel banner */}
                  {channel.bannerUrl ? (
                    <img
                      src={channel.bannerUrl}
                      alt={`${channel.name} banner`}
                      style={{
                        width: '100%',
                        height: 180,
                        objectFit: 'cover',
                        borderRadius: 12,
                        marginBottom: 24,
                      }}
                    />
                  ) : (
                    <div style={{
                      height: 180,
                      background: `linear-gradient(135deg, ${channel.avatarColor} 0%, ${adjustColor(channel.avatarColor, -30)} 100%)`,
                      borderRadius: 12,
                      marginBottom: 24,
                    }} />
                  )}

                  {/* Channel info */}
                  <div style={{ display: 'flex', gap: 24, marginBottom: 32 }}>
                    {channel.avatarUrl ? (
                      <img
                        src={channel.avatarUrl}
                        alt={channel.name}
                        style={{
                          width: 128,
                          height: 128,
                          borderRadius: '50%',
                          objectFit: 'cover',
                        }}
                      />
                    ) : (
                      <div style={{
                        width: 128,
                        height: 128,
                        borderRadius: '50%',
                        backgroundColor: channel.avatarColor,
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        fontSize: 48,
                        fontWeight: 'bold',
                        color: '#fff',
                      }}>{channel.name.charAt(0)}</div>
                    )}
                    <div style={{ flex: 1 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
                        <h1 style={{ fontSize: 36, fontWeight: 'bold' }}>{channel.name}</h1>
                        {channel.isVerified && (
                          <svg width={20} height={20} viewBox="0 0 24 24" fill="#aaa">
                            <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-2 15l-5-5 1.41-1.41L10 14.17l7.59-7.59L19 8l-9 9z"/>
                          </svg>
                        )}
                      </div>
                      <p style={{ color: '#aaa', marginBottom: 4 }}>{channel.handle} • {channel.subscribers.toLocaleString()} subscribers • {channel.videosCount} videos</p>
                      <p style={{ color: '#aaa', marginBottom: 16 }}>{channel.description}</p>
                      <button
                        style={{
                          padding: '10px 20px',
                          backgroundColor: isChannelSubscribed(channel.id) ? '#272727' : '#fff',
                          color: isChannelSubscribed(channel.id) ? '#fff' : '#0f0f0f',
                          border: 'none',
                          borderRadius: 20,
                          fontWeight: 500,
                          cursor: 'pointer',
                        }}
                        onClick={() => toggleSubscribe(channel.id)}
                      >{isChannelSubscribed(channel.id) ? "Subscribed" : "Subscribe"}</button>
                    </div>
                  </div>

                  {/* Channel tabs */}
                  <div style={{ display: 'flex', gap: 24, borderBottom: '1px solid #3f3f3f', marginBottom: 24 }}>
                    {(['videos', 'playlists', 'community', 'about'] as ProfileTab[]).map((tab) => (
                      <button
                        key={tab}
                        style={{
                          background: 'none',
                          border: 'none',
                          color: state.profileTab === tab ? '#fff' : '#aaa',
                          padding: '12px 0',
                          fontSize: 14,
                          fontWeight: 500,
                          cursor: 'pointer',
                          borderBottom: state.profileTab === tab ? '2px solid #fff' : '2px solid transparent',
                          marginBottom: -1,
                          textTransform: 'capitalize',
                        }}
                        onClick={() => setState(prev => ({ ...prev, profileTab: tab }))}
                      >{tab}</button>
                    ))}
                  </div>

                  {/* Channel videos */}
                  {state.profileTab === 'videos' ? (
                    <>
                      <h2 style={{ fontSize: 18, fontWeight: 500, marginBottom: 16 }}>Videos</h2>
                      <div style={styles.videoGrid}>
                        {channelVideos.map((video) => (
                          <div
                            key={video.id}
                            style={styles.videoCard}
                            onMouseEnter={() => setHoveredVideo(video.id)}
                            onMouseLeave={() => setHoveredVideo(null)}
                            onClick={() => loadVideo(video.id)}
                          >
                            <div style={styles.thumbnailContainer}>
                              <img src={getThumbnail(video)} alt={video.title} style={styles.thumbnail} />
                              <span style={styles.videoDuration}>{video.duration}</span>
                              {hoveredVideo === video.id && <div style={styles.thumbnailOverlay}><PlayIcon size={48} /></div>}
                            </div>
                            <div style={styles.videoDetails}>
                              <div style={styles.videoCardInfo}>
                                <h3 style={{...styles.videoCardTitle, color: colors.text}}>{video.title}</h3>
                                <p style={{...styles.videoCardMeta, color: colors.textSecondary}}>{video.views} • {video.timestamp}</p>
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                      {channelVideos.length === 0 && (
                        <div style={{ textAlign: 'center', padding: 48, color: colors.textSecondary }}>
                          <p>This channel hasn't uploaded any videos yet.</p>
                        </div>
                      )}
                    </>
                  ) : state.profileTab === 'about' ? (
                    <div style={{ maxWidth: 800 }}>
                      <h3 style={{ marginBottom: 16 }}>About</h3>
                      <div style={{ marginBottom: 24 }}>
                        <h4 style={{ color: '#aaa', marginBottom: 8, fontSize: 12, textTransform: 'uppercase' }}>Description</h4>
                        <p style={{ lineHeight: 1.6 }}>{channel.description}</p>
                      </div>
                      <div style={{ marginBottom: 24 }}>
                        <h4 style={{ color: '#aaa', marginBottom: 8, fontSize: 12, textTransform: 'uppercase' }}>Stats</h4>
                        <p>{channel.subscribers.toLocaleString()} subscribers</p>
                        <p>{channel.videosCount} videos</p>
                      </div>
                    </div>
                  ) : (
                    <div style={{ textAlign: 'center', padding: 48, color: '#aaa' }}>
                      <p>No content available</p>
                    </div>
                  )}
                </div>
              );
            })()
          ) : currentView === 'search-results' ? (
            // Search results
            <div style={{ padding: 24 }}>
              <h2 style={{ fontSize: 18, marginBottom: 16 }}>
                {searchResults.length > 0 ? `Results for "${state.searchQuery}"` : `No results for "${state.searchQuery}"`}
              </h2>
              {searchResults.length > 0 ? (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                  {searchResults.map((video) => (
                    <div
                      key={video.id}
                      style={{ display: 'flex', gap: 16, cursor: 'pointer', padding: 8, borderRadius: 8 }}
                      onClick={() => loadVideo(video.id)}
                      onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = '#272727')}
                      onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = 'transparent')}
                    >
                      <div style={{ width: 360, height: 202, flexShrink: 0, position: 'relative', borderRadius: 12, overflow: 'hidden' }}>
                        <img src={getThumbnail(video)} alt={video.title} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                        <span style={styles.videoDuration}>{video.duration}</span>
                      </div>
                      <div style={{ flex: 1 }}>
                        <h3 style={{ fontSize: 18, fontWeight: 500, marginBottom: 8, lineHeight: 1.3 }}>{video.title}</h3>
                        <p style={{ fontSize: 12, color: '#aaa', marginBottom: 8 }}>{video.views} • {video.timestamp}</p>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
                          {video.channelAvatarUrl ? (
                            <img src={video.channelAvatarUrl} alt={video.channel} style={{ width: 24, height: 24, borderRadius: '50%', objectFit: 'cover' }} />
                          ) : (
                            <div style={{ width: 24, height: 24, borderRadius: '50%', backgroundColor: '#555', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 10 }}>{video.channelAvatar}</div>
                          )}
                          <span style={{ fontSize: 12, color: '#aaa' }}>{video.channel}</span>
                        </div>
                        <p style={{ fontSize: 12, color: '#aaa', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>
                          Watch this amazing video about {video.title.toLowerCase()}. Perfect for beginners and experts alike.
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div style={{ textAlign: 'center', padding: 48, color: '#aaa' }}>
                  <div style={{ display: 'flex', justifyContent: 'center' }}>
                    <SearchIcon size={64} />
                  </div>
                  <p style={{ marginTop: 16 }}>Try different keywords or check your spelling</p>
                </div>
              )}
            </div>
          ) : currentView === 'shorts' && viewingShortId ? (
            // Shorts Player - fullscreen vertical video experience
            (() => {
              const shortsList = SAMPLE_VIDEOS.slice(0, 8);
              const currentIndex = shortsList.findIndex(v => v.id === viewingShortId);
              const currentShortVideo = shortsList[currentIndex];
              const channel = CHANNELS.find(c => c.id === currentShortVideo?.channelId);

              if (!currentShortVideo) return null;

              return (
                <div style={{
                  display: 'flex',
                  justifyContent: 'center',
                  alignItems: 'center',
                  height: 'calc(100vh - 56px)',
                  backgroundColor: '#0f0f0f',
                  position: 'relative',
                }}>
                  {/* Main Short Container */}
                  <div style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 16,
                    maxHeight: '100%',
                  }}>
                    {/* Short Video */}
                    <div style={{
                      width: 360,
                      height: 640,
                      backgroundColor: currentShortVideo.thumbnailColor,
                      borderRadius: 12,
                      position: 'relative',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      overflow: 'hidden',
                    }}>
                      {/* Video placeholder */}
                      <PlayIcon size={72} />

                      {/* Bottom info overlay */}
                      <div style={{
                        position: 'absolute',
                        bottom: 0,
                        left: 0,
                        right: 0,
                        padding: 16,
                        background: 'linear-gradient(transparent, rgba(0,0,0,0.8))',
                      }}>
                        {/* Channel info */}
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
                          {channel?.avatarUrl ? (
                            <img src={channel.avatarUrl} alt={channel.name} style={{ width: 36, height: 36, borderRadius: '50%', objectFit: 'cover' }} />
                          ) : (
                            <div style={{ width: 36, height: 36, borderRadius: '50%', backgroundColor: channel?.avatarColor || '#666', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 14 }}>
                              {currentShortVideo.channelAvatar}
                            </div>
                          )}
                          <span style={{ fontWeight: 500 }}>@{channel?.handle || 'user'}</span>
                          <button
                            onClick={() => {
                              if (channel && !isChannelSubscribed(channel.id)) {
                                apiSubscribeChannel(channel.id);
                              }
                            }}
                            style={{
                              padding: '6px 12px',
                              backgroundColor: isChannelSubscribed(channel?.id || '') ? '#3f3f3f' : '#fff',
                              color: isChannelSubscribed(channel?.id || '') ? '#fff' : '#0f0f0f',
                              border: 'none',
                              borderRadius: 20,
                              fontSize: 13,
                              fontWeight: 500,
                              cursor: 'pointer',
                            }}
                          >
                            {isChannelSubscribed(channel?.id || '') ? 'Subscribed' : 'Subscribe'}
                          </button>
                        </div>

                        {/* Title */}
                        <p style={{ fontSize: 14, lineHeight: 1.4 }}>{currentShortVideo.title}</p>
                      </div>
                    </div>

                    {/* Action buttons - right side */}
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                      {/* Like */}
                      <button
                        onClick={() => {
                          apiLikeVideo(currentShortVideo.id);
                        }}
                        style={{
                          display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4,
                          background: 'none', border: 'none', cursor: 'pointer', color: isVideoLiked(currentShortVideo.id) ? '#3ea6ff' : '#fff',
                        }}
                      >
                        <div style={{ width: 48, height: 48, borderRadius: '50%', backgroundColor: '#272727', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                          <LikeIcon size={24} />
                        </div>
                        <span style={{ fontSize: 12 }}>{isVideoLiked(currentShortVideo.id) ? 'Liked' : 'Like'}</span>
                      </button>

                      {/* Dislike */}
                      <button
                        onClick={() => {
                          apiDislikeVideo(currentShortVideo.id);
                        }}
                        style={{
                          display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4,
                          background: 'none', border: 'none', cursor: 'pointer', color: isVideoDisliked(currentShortVideo.id) ? '#3ea6ff' : '#fff',
                        }}
                      >
                        <div style={{ width: 48, height: 48, borderRadius: '50%', backgroundColor: '#272727', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                          <DislikeIcon size={24} />
                        </div>
                        <span style={{ fontSize: 12 }}>Dislike</span>
                      </button>

                      {/* Comments */}
                      <button
                        onClick={() => setShowShortsCommentsModal(true)}
                        style={{
                          display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4,
                          background: 'none', border: 'none', cursor: 'pointer', color: '#fff',
                        }}
                      >
                        <div style={{ width: 48, height: 48, borderRadius: '50%', backgroundColor: '#272727', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                          <CommentIcon size={24} />
                        </div>
                        <span style={{ fontSize: 12 }}>{(state.shortsComments[currentShortVideo.id] || []).length}</span>
                      </button>

                      {/* Share */}
                      <button
                        onClick={() => setShowShortsShareModal(true)}
                        style={{
                          display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4,
                          background: 'none', border: 'none', cursor: 'pointer', color: '#fff',
                        }}
                      >
                        <div style={{ width: 48, height: 48, borderRadius: '50%', backgroundColor: '#272727', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                          <ShareIcon size={24} />
                        </div>
                        <span style={{ fontSize: 12 }}>Share</span>
                      </button>

                      {/* Navigation - Up */}
                      {currentIndex > 0 && (
                        <button
                          onClick={() => navigateShort('up', currentIndex, shortsList)}
                          style={{
                            display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4,
                            background: 'none', border: 'none', cursor: 'pointer', color: '#fff', marginTop: 16,
                            transition: 'transform 0.2s ease',
                            transform: shortsTransition === 'up' ? 'scale(0.9)' : 'scale(1)',
                          }}
                        >
                          <div style={{
                            width: 48, height: 48, borderRadius: '50%', backgroundColor: '#272727',
                            display: 'flex', alignItems: 'center', justifyContent: 'center',
                            transition: 'background-color 0.2s ease',
                          }}>
                            <ChevronUpIcon size={24} />
                          </div>
                        </button>
                      )}

                      {/* Navigation - Down */}
                      {currentIndex < shortsList.length - 1 && (
                        <button
                          onClick={() => navigateShort('down', currentIndex, shortsList)}
                          style={{
                            display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4,
                            background: 'none', border: 'none', cursor: 'pointer', color: '#fff',
                            transition: 'transform 0.2s ease',
                            transform: shortsTransition === 'down' ? 'scale(0.9)' : 'scale(1)',
                          }}
                        >
                          <div style={{
                            width: 48, height: 48, borderRadius: '50%', backgroundColor: '#272727',
                            display: 'flex', alignItems: 'center', justifyContent: 'center',
                            transition: 'background-color 0.2s ease',
                          }}>
                            <ChevronDownIcon size={24} />
                          </div>
                        </button>
                      )}
                    </div>
                  </div>

                  {/* Shorts Comments Modal */}
                  {showShortsCommentsModal && (
                    <div
                      style={{
                        position: 'absolute', top: 0, right: 0, bottom: 0,
                        width: 400, backgroundColor: '#212121',
                        boxShadow: '-4px 0 20px rgba(0,0,0,0.5)',
                        display: 'flex', flexDirection: 'column',
                        zIndex: 100,
                      }}
                      onClick={(e) => e.stopPropagation()}
                    >
                      <div style={{ padding: 16, borderBottom: '1px solid #3f3f3f', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <span style={{ fontWeight: 500 }}>Comments</span>
                        <button onClick={() => setShowShortsCommentsModal(false)} style={{ background: 'none', border: 'none', color: '#fff', cursor: 'pointer', fontSize: 20 }}>×</button>
                      </div>
                      <div style={{ flex: 1, overflowY: 'auto', padding: 16 }}>
                        {(state.shortsComments[currentShortVideo.id] || []).length > 0 ? (
                          (state.shortsComments[currentShortVideo.id] || []).map(comment => (
                            <div key={comment.id} style={{ marginBottom: 16 }}>
                              <div style={{ display: 'flex', gap: 12 }}>
                                <div style={{ width: 32, height: 32, borderRadius: '50%', backgroundColor: '#666', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 12 }}>{comment.userAvatar}</div>
                                <div>
                                  <div style={{ fontSize: 12, fontWeight: 500 }}>{comment.userName}</div>
                                  <div style={{ fontSize: 14, marginTop: 4 }}>{comment.content}</div>
                                  <div style={{ fontSize: 11, color: '#aaa', marginTop: 4 }}>{comment.timestamp}</div>
                                </div>
                              </div>
                            </div>
                          ))
                        ) : (
                          <div style={{ textAlign: 'center', color: '#aaa', padding: 24 }}>No comments yet. Be the first!</div>
                        )}
                      </div>
                      <div style={{ padding: 16, borderTop: '1px solid #3f3f3f' }}>
                        <div style={{ display: 'flex', gap: 8 }}>
                          <input
                            type="text"
                            placeholder="Add a comment..."
                            value={newShortsComment}
                            onChange={(e) => setNewShortsComment(e.target.value)}
                            style={{ flex: 1, padding: 12, backgroundColor: '#3f3f3f', border: 'none', borderRadius: 20, color: '#fff', outline: 'none' }}
                            onKeyDown={(e) => {
                              if (e.key === 'Enter' && newShortsComment.trim()) {
                                addShortsComment(currentShortVideo.id, newShortsComment);
                              }
                            }}
                          />
                          <button
                            onClick={() => addShortsComment(currentShortVideo.id, newShortsComment)}
                            disabled={!newShortsComment.trim()}
                            style={{
                              padding: '8px 16px',
                              backgroundColor: newShortsComment.trim() ? '#3ea6ff' : '#3f3f3f',
                              color: newShortsComment.trim() ? '#0f0f0f' : '#717171',
                              border: 'none', borderRadius: 20, cursor: newShortsComment.trim() ? 'pointer' : 'default',
                            }}
                          >Send</button>
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Shorts Share Modal */}
                  {showShortsShareModal && (
                    <div
                      style={{
                        position: 'absolute', top: '50%', left: '50%', transform: 'translate(-50%, -50%)',
                        backgroundColor: '#282828', borderRadius: 12, padding: 24, width: 320,
                        boxShadow: '0 4px 32px rgba(0,0,0,0.5)', zIndex: 100,
                      }}
                      onClick={(e) => e.stopPropagation()}
                    >
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
                        <span style={{ fontWeight: 500, fontSize: 18 }}>Share</span>
                        <button onClick={() => setShowShortsShareModal(false)} style={{ background: 'none', border: 'none', color: '#fff', cursor: 'pointer', fontSize: 20 }}>×</button>
                      </div>
                      <div style={{ display: 'flex', gap: 16, justifyContent: 'center', marginBottom: 16 }}>
                        {['Copy', 'Twitter', 'Facebook', 'Email'].map(platform => (
                          <button
                            key={platform}
                            onClick={() => {
                              setShowShortsShareModal(false);
                            }}
                            style={{
                              display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8,
                              background: 'none', border: 'none', cursor: 'pointer', color: '#fff',
                            }}
                          >
                            <div style={{ width: 48, height: 48, borderRadius: '50%', backgroundColor: '#3f3f3f', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                              <span style={{ fontSize: 16 }}>{platform[0]}</span>
                            </div>
                            <span style={{ fontSize: 11 }}>{platform}</span>
                          </button>
                        ))}
                      </div>
                      <div style={{ display: 'flex', gap: 8 }}>
                        <input
                          type="text"
                          readOnly
                          value={`https://microtube.com/shorts/${currentShortVideo.id}`}
                          style={{ flex: 1, padding: 12, backgroundColor: '#3f3f3f', border: 'none', borderRadius: 4, color: '#fff' }}
                        />
                        <button
                          onClick={() => {
                            navigator.clipboard.writeText(`https://microtube.com/shorts/${currentShortVideo.id}`);
                            setShowShortsShareModal(false);
                          }}
                          style={{ padding: '12px 16px', backgroundColor: '#3ea6ff', color: '#0f0f0f', border: 'none', borderRadius: 4, cursor: 'pointer', fontWeight: 500 }}
                        >Copy</button>
                      </div>
                    </div>
                  )}

                  {/* Close button */}
                  <button
                    onClick={() => setRoute("shorts")}
                    style={{
                      position: 'absolute', top: 16, left: 16,
                      background: 'none', border: 'none', cursor: 'pointer', color: '#fff',
                      display: 'flex', alignItems: 'center', gap: 8,
                    }}
                  >
                    <CloseIcon size={24} />
                  </button>
                </div>
              );
            })()
          ) : currentView === 'shorts' ? (
            // Shorts page - grid of shorts thumbnails
            <div style={{ padding: '24px', maxWidth: '1200px', margin: '0 auto' }}>
              <h2 style={{ fontSize: 24, fontWeight: 600, marginBottom: 24, display: 'flex', alignItems: 'center', gap: 12 }}>
                <ShortsIcon size={28} />
                Shorts
              </h2>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))', gap: 16 }}>
                {SAMPLE_VIDEOS.slice(0, 8).map((video) => (
                  <div
                    key={video.id}
                    style={{
                      backgroundColor: '#272727',
                      borderRadius: 12,
                      overflow: 'hidden',
                      cursor: 'pointer',
                      transition: 'transform 0.2s',
                    }}
                    onClick={() => setRoute("shorts", video.id)}
                    onMouseEnter={(e) => (e.currentTarget.style.transform = 'scale(1.02)')}
                    onMouseLeave={(e) => (e.currentTarget.style.transform = 'scale(1)')}
                  >
                    <div style={{ position: 'relative', aspectRatio: '9/16', backgroundColor: video.thumbnailColor, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                      <PlayIcon size={48} />
                      <span style={{ position: 'absolute', bottom: 8, right: 8, backgroundColor: 'rgba(0,0,0,0.8)', padding: '2px 6px', borderRadius: 4, fontSize: 11 }}>{video.duration}</span>
                    </div>
                    <div style={{ padding: 10 }}>
                      <h3 style={{ fontSize: 13, fontWeight: 500, marginBottom: 4, lineHeight: 1.3, overflow: 'hidden', textOverflow: 'ellipsis', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical' }}>{video.title}</h3>
                      <p style={{ fontSize: 12, color: '#aaa' }}>{video.views}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ) : currentView === 'subscriptions' ? (
            // Subscriptions page
            <div style={{ padding: '24px' }}>
              <h2 style={{ fontSize: 24, fontWeight: 600, marginBottom: 24, display: 'flex', alignItems: 'center', gap: 12 }}>
                <SubscriptionsIcon size={28} />
                Subscriptions
              </h2>
              {subscribedChannelIds.length > 0 ? (
                <>
                  <div style={{ display: 'flex', gap: 16, marginBottom: 24, overflowX: 'auto', paddingBottom: 8 }}>
                    {subscribedChannelIds.map((channelId) => {
                      const channel = CHANNELS.find(c => c.id === channelId);
                      if (!channel) return null;
                      return (
                        <div
                          key={channelId}
                          style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8, cursor: 'pointer', minWidth: 80 }}
                          onClick={() => navigateToChannel(channelId)}
                        >
                          {channel.avatarUrl ? (
                            <img src={channel.avatarUrl} alt={channel.name} style={{ width: 56, height: 56, borderRadius: '50%', objectFit: 'cover', border: '2px solid #3ea6ff' }} />
                          ) : (
                            <div style={{ width: 56, height: 56, borderRadius: '50%', backgroundColor: channel.avatarColor, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 20, fontWeight: 600, border: '2px solid #3ea6ff' }}>
                              {channel.name.split(' ').map(n => n[0]).join('').slice(0, 2)}
                            </div>
                          )}
                          <span style={{ fontSize: 12, color: '#aaa', textAlign: 'center' }}>{channel.name}</span>
                        </div>
                      );
                    })}
                  </div>
                  <h3 style={{ fontSize: 18, fontWeight: 500, marginBottom: 16 }}>Latest videos</h3>
                  <div style={styles.videoGrid}>
                    {SAMPLE_VIDEOS.filter(v => isChannelSubscribed(v.channelId)).map((video) => (
                      <div key={video.id} style={styles.videoCard} onClick={() => loadVideo(video.id)}>
                        <div style={styles.thumbnailContainer}>
                          <img src={getThumbnail(video)} alt={video.title} style={styles.thumbnail} />
                          <span style={styles.videoDuration}>{video.duration}</span>
                        </div>
                        <div style={styles.videoDetails}>
                          <div style={styles.videoCardAvatar}>{video.channelAvatar}</div>
                          <div style={styles.videoCardInfo}>
                            <h3 style={{...styles.videoCardTitle, color: colors.text}}>{video.title}</h3>
                            <p style={{...styles.videoCardChannel, color: colors.textSecondary}}>{video.channel}</p>
                            <p style={{...styles.videoCardMeta, color: colors.textSecondary}}>{video.views} • {video.timestamp}</p>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </>
              ) : (
                <div style={{ textAlign: 'center', padding: 48, color: colors.textSecondary }}>
                  <div style={{ display: 'flex', justifyContent: 'center' }}>
                    <SubscriptionsIcon size={64} />
                  </div>
                  <p style={{ marginTop: 16, fontSize: 18 }}>No subscriptions yet</p>
                  <p style={{ marginTop: 8, color: colors.textSecondary }}>Subscribe to channels to see their latest videos here</p>
                </div>
              )}
            </div>
          ) : currentView === 'you' ? (
            // You/Library page
            <div style={{ padding: '24px' }}>
              <h2 style={{ fontSize: 24, fontWeight: 600, marginBottom: 24, display: 'flex', alignItems: 'center', gap: 12 }}>
                <LibraryIcon size={28} />
                Your Library
              </h2>

              {/* Liked Videos Section */}
              <div style={{ marginBottom: 32 }}>
                <h3 style={{ fontSize: 18, fontWeight: 500, marginBottom: 16, display: 'flex', alignItems: 'center', gap: 8 }}>
                  <LikeIcon size={20} />
                  Liked videos ({likedVideoIds.length})
                </h3>
                {likedVideoIds.length > 0 ? (
                  <div style={{ display: 'flex', gap: 16, overflowX: 'auto', paddingBottom: 8 }}>
                    {SAMPLE_VIDEOS.filter(v => isVideoLiked(v.id)).slice(0, 6).map((video) => (
                      <div key={video.id} style={{ minWidth: 200, cursor: 'pointer' }} onClick={() => loadVideo(video.id)}>
                        <div style={{ position: 'relative', borderRadius: 8, overflow: 'hidden', marginBottom: 8 }}>
                          <img src={getThumbnail(video)} alt={video.title} style={{ width: '100%', aspectRatio: '16/9', objectFit: 'cover' }} />
                          <span style={styles.videoDuration}>{video.duration}</span>
                        </div>
                        <h4 style={{ fontSize: 13, fontWeight: 500, marginBottom: 4, lineHeight: 1.3 }}>{video.title}</h4>
                        <p style={{ fontSize: 12, color: '#aaa' }}>{video.channel}</p>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p style={{ color: '#717171' }}>Videos you like will appear here</p>
                )}
              </div>

              {/* Saved Videos Section */}
              <div style={{ marginBottom: 32 }}>
                <h3 style={{ fontSize: 18, fontWeight: 500, marginBottom: 16, display: 'flex', alignItems: 'center', gap: 8 }}>
                  <SaveIcon size={20} />
                  Saved videos ({savedVideoIds.length})
                </h3>
                {savedVideoIds.length > 0 ? (
                  <div style={{ display: 'flex', gap: 16, overflowX: 'auto', paddingBottom: 8 }}>
                    {SAMPLE_VIDEOS.filter(v => isVideoSaved(v.id)).slice(0, 6).map((video) => (
                      <div key={video.id} style={{ minWidth: 200, cursor: 'pointer' }} onClick={() => loadVideo(video.id)}>
                        <div style={{ position: 'relative', borderRadius: 8, overflow: 'hidden', marginBottom: 8 }}>
                          <img src={getThumbnail(video)} alt={video.title} style={{ width: '100%', aspectRatio: '16/9', objectFit: 'cover' }} />
                          <span style={styles.videoDuration}>{video.duration}</span>
                        </div>
                        <h4 style={{ fontSize: 13, fontWeight: 500, marginBottom: 4, lineHeight: 1.3 }}>{video.title}</h4>
                        <p style={{ fontSize: 12, color: '#aaa' }}>{video.channel}</p>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p style={{ color: '#717171' }}>Videos you save will appear here</p>
                )}
              </div>

              {/* Subscribed Channels */}
              <div>
                <h3 style={{ fontSize: 18, fontWeight: 500, marginBottom: 16, display: 'flex', alignItems: 'center', gap: 8 }}>
                  <SubscriptionsIcon size={20} />
                  Subscriptions ({subscribedChannelIds.length})
                </h3>
                {subscribedChannelIds.length > 0 ? (
                  <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap' }}>
                    {subscribedChannelIds.map((channelId) => {
                      const channel = CHANNELS.find(c => c.id === channelId);
                      if (!channel) return null;
                      return (
                        <div
                          key={channelId}
                          style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '8px 16px', backgroundColor: '#272727', borderRadius: 8, cursor: 'pointer' }}
                          onClick={() => navigateToChannel(channelId)}
                        >
                          {channel.avatarUrl ? (
                            <img src={channel.avatarUrl} alt={channel.name} style={{ width: 40, height: 40, borderRadius: '50%', objectFit: 'cover' }} />
                          ) : (
                            <div style={{ width: 40, height: 40, borderRadius: '50%', backgroundColor: channel.avatarColor, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 14 }}>
                              {channel.name.split(' ').map(n => n[0]).join('').slice(0, 2)}
                            </div>
                          )}
                          <span>{channel.name}</span>
                        </div>
                      );
                    })}
                  </div>
                ) : (
                  <p style={{ color: '#717171' }}>Channels you subscribe to will appear here</p>
                )}
              </div>
            </div>
          ) : currentView === 'history' ? (
            // History page
            <div style={{ padding: '24px' }}>
              <h2 style={{ fontSize: 24, fontWeight: 600, marginBottom: 24, display: 'flex', alignItems: 'center', gap: 12 }}>
                <HistoryIcon size={28} />
                Watch history
              </h2>
              {watchedVideoIds.length > 0 ? (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                  {SAMPLE_VIDEOS.filter(v => isVideoWatched(v.id)).map((video) => (
                    <div
                      key={video.id}
                      style={{ display: 'flex', gap: 16, cursor: 'pointer', padding: 8, borderRadius: 8 }}
                      onClick={() => loadVideo(video.id)}
                      onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = '#272727')}
                      onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = 'transparent')}
                    >
                      <div style={{ width: 200, height: 112, flexShrink: 0, position: 'relative', borderRadius: 8, overflow: 'hidden' }}>
                        <img src={getThumbnail(video)} alt={video.title} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                        <span style={styles.videoDuration}>{video.duration}</span>
                      </div>
                      <div style={{ flex: 1 }}>
                        <h3 style={{ fontSize: 16, fontWeight: 500, marginBottom: 8, lineHeight: 1.3 }}>{video.title}</h3>
                        <p style={{ fontSize: 13, color: '#aaa', marginBottom: 4 }}>{video.channel}</p>
                        <p style={{ fontSize: 12, color: '#717171' }}>{video.views} • {video.timestamp}</p>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div style={{ textAlign: 'center', padding: 48, color: '#aaa' }}>
                  <div style={{ display: 'flex', justifyContent: 'center' }}>
                    <HistoryIcon size={64} />
                  </div>
                  <p style={{ marginTop: 16, fontSize: 18 }}>No watch history</p>
                  <p style={{ marginTop: 8, color: '#717171' }}>Videos you watch will appear here</p>
                </div>
              )}
            </div>
          ) : currentView === 'shopping' ? (
            <div style={{ padding: '24px', maxWidth: 1200, margin: '0 auto' }}>
              <div style={{ textAlign: 'center', padding: 64, backgroundColor: '#1a1a1a', borderRadius: 12 }}>
                <div style={{ display: 'flex', justifyContent: 'center' }}>
                  <ShoppingBagIcon size={64} />
                </div>
                <h2 style={{ fontSize: 24, fontWeight: 600, marginTop: 24, marginBottom: 8, color: '#fff' }}>Shopping</h2>
                <p style={{ color: '#aaa', marginBottom: 24 }}>Browse products from your favorite creators</p>
                <p style={{ fontSize: 18, color: '#717171' }}>Shopping is coming soon</p>
                <p style={{ marginTop: 8, color: '#717171' }}>Discover products featured in videos from channels you love</p>
              </div>
            </div>
          ) : currentView === 'music' ? (
            <div style={{ padding: '24px', maxWidth: 1200, margin: '0 auto' }}>
              <div style={{ textAlign: 'center', padding: 64, backgroundColor: '#1a1a1a', borderRadius: 12 }}>
                <div style={{ display: 'flex', justifyContent: 'center' }}>
                  <MusicNoteIcon size={64} />
                </div>
                <h2 style={{ fontSize: 24, fontWeight: 600, marginTop: 24, marginBottom: 8, color: '#fff' }}>Music</h2>
                <p style={{ color: '#aaa', marginBottom: 24 }}>Discover music videos, live performances, and more</p>
                <p style={{ fontSize: 18, color: '#717171' }}>Explore Music content</p>
                <p style={{ marginTop: 8, color: '#717171' }}>Music videos, live concerts, artist channels, and playlists</p>
              </div>
            </div>
          ) : currentView === 'movies' ? (
            <div style={{ padding: '24px', maxWidth: 1200, margin: '0 auto' }}>
              <div style={{ textAlign: 'center', padding: 64, backgroundColor: '#1a1a1a', borderRadius: 12 }}>
                <div style={{ display: 'flex', justifyContent: 'center' }}>
                  <MovieIcon size={64} />
                </div>
                <h2 style={{ fontSize: 24, fontWeight: 600, marginTop: 24, marginBottom: 8, color: '#fff' }}>Movies</h2>
                <p style={{ color: '#aaa', marginBottom: 24 }}>Watch movies, documentaries, and TV shows</p>
                <p style={{ fontSize: 18, color: '#717171' }}>Browse Movies & TV</p>
                <p style={{ marginTop: 8, color: '#717171' }}>Rent, buy, or watch free movies and shows</p>
              </div>
            </div>
          ) : currentView === 'live' ? (
            <div style={{ padding: '24px', maxWidth: 1200, margin: '0 auto' }}>
              <div style={{ textAlign: 'center', padding: 64, backgroundColor: '#1a1a1a', borderRadius: 12 }}>
                <div style={{ display: 'flex', justifyContent: 'center' }}>
                  <LiveTvIcon size={64} />
                </div>
                <h2 style={{ fontSize: 24, fontWeight: 600, marginTop: 24, marginBottom: 8, color: '#fff' }}>Live</h2>
                <p style={{ color: '#aaa', marginBottom: 24 }}>Watch live streams from around the world</p>
                <p style={{ fontSize: 18, color: '#717171' }}>No live streams right now</p>
                <p style={{ marginTop: 8, color: '#717171' }}>Check back later for live content from your favorite creators</p>
              </div>
            </div>
          ) : currentView === 'gaming' ? (
            <div style={{ padding: '24px', maxWidth: 1200, margin: '0 auto' }}>
              <div style={{ textAlign: 'center', padding: 64, backgroundColor: '#1a1a1a', borderRadius: 12 }}>
                <div style={{ display: 'flex', justifyContent: 'center' }}>
                  <SportsEsportsIcon size={64} />
                </div>
                <h2 style={{ fontSize: 24, fontWeight: 600, marginTop: 24, marginBottom: 8, color: '#fff' }}>Gaming</h2>
                <p style={{ color: '#aaa', marginBottom: 24 }}>Watch gaming videos, live streams, and esports</p>
                <p style={{ fontSize: 18, color: '#717171' }}>Explore Gaming content</p>
                <p style={{ marginTop: 8, color: '#717171' }}>Let's plays, walkthroughs, esports, and gaming news</p>
              </div>
            </div>
          ) : currentView === 'news' ? (
            <div style={{ padding: '24px', maxWidth: 1200, margin: '0 auto' }}>
              <div style={{ textAlign: 'center', padding: 64, backgroundColor: '#1a1a1a', borderRadius: 12 }}>
                <div style={{ display: 'flex', justifyContent: 'center' }}>
                  <NewspaperIcon size={64} />
                </div>
                <h2 style={{ fontSize: 24, fontWeight: 600, marginTop: 24, marginBottom: 8, color: '#fff' }}>News</h2>
                <p style={{ color: '#aaa', marginBottom: 24 }}>Stay informed with the latest news</p>
                <p style={{ fontSize: 18, color: '#717171' }}>News & Current Events</p>
                <p style={{ marginTop: 8, color: '#717171' }}>Breaking news, analysis, and coverage from trusted sources</p>
              </div>
            </div>
          ) : currentView === 'sports' ? (
            <div style={{ padding: '24px', maxWidth: 1200, margin: '0 auto' }}>
              <div style={{ textAlign: 'center', padding: 64, backgroundColor: '#1a1a1a', borderRadius: 12 }}>
                <div style={{ display: 'flex', justifyContent: 'center' }}>
                  <SportsIcon size={64} />
                </div>
                <h2 style={{ fontSize: 24, fontWeight: 600, marginTop: 24, marginBottom: 8, color: '#fff' }}>Sports</h2>
                <p style={{ color: '#aaa', marginBottom: 24 }}>Watch highlights, live games, and sports content</p>
                <p style={{ fontSize: 18, color: '#717171' }}>Sports Hub</p>
                <p style={{ marginTop: 8, color: '#717171' }}>Highlights, live sports, analysis, and athlete channels</p>
              </div>
            </div>
          ) : currentView === 'courses' ? (
            <div style={{ padding: '24px', maxWidth: 1200, margin: '0 auto' }}>
              <div style={{ textAlign: 'center', padding: 64, backgroundColor: '#1a1a1a', borderRadius: 12 }}>
                <div style={{ display: 'flex', justifyContent: 'center' }}>
                  <SchoolIcon size={64} />
                </div>
                <h2 style={{ fontSize: 24, fontWeight: 600, marginTop: 24, marginBottom: 8, color: '#fff' }}>Courses</h2>
                <p style={{ color: '#aaa', marginBottom: 24 }}>Learn new skills with educational content</p>
                <p style={{ fontSize: 18, color: '#717171' }}>Learning Hub</p>
                <p style={{ marginTop: 8, color: '#717171' }}>Tutorials, courses, and educational content from expert creators</p>
              </div>
            </div>
          ) : currentView === 'fashion' ? (
            <div style={{ padding: '24px', maxWidth: 1200, margin: '0 auto' }}>
              <div style={{ textAlign: 'center', padding: 64, backgroundColor: '#1a1a1a', borderRadius: 12 }}>
                <div style={{ display: 'flex', justifyContent: 'center' }}>
                  <CheckroomIcon size={64} />
                </div>
                <h2 style={{ fontSize: 24, fontWeight: 600, marginTop: 24, marginBottom: 8, color: '#fff' }}>Fashion & Beauty</h2>
                <p style={{ color: '#aaa', marginBottom: 24 }}>Discover style tips, tutorials, and trends</p>
                <p style={{ fontSize: 18, color: '#717171' }}>Fashion & Beauty Hub</p>
                <p style={{ marginTop: 8, color: '#717171' }}>Style guides, makeup tutorials, and fashion trends</p>
              </div>
            </div>
          ) : currentView === 'podcasts' ? (
            <div style={{ padding: '24px', maxWidth: 1200, margin: '0 auto' }}>
              <div style={{ textAlign: 'center', padding: 64, backgroundColor: '#1a1a1a', borderRadius: 12 }}>
                <div style={{ display: 'flex', justifyContent: 'center' }}>
                  <PodcastsIcon size={64} />
                </div>
                <h2 style={{ fontSize: 24, fontWeight: 600, marginTop: 24, marginBottom: 8, color: '#fff' }}>Podcasts</h2>
                <p style={{ color: '#aaa', marginBottom: 24 }}>Listen to podcasts from your favorite creators</p>
                <p style={{ fontSize: 18, color: '#717171' }}>Podcast Hub</p>
                <p style={{ marginTop: 8, color: '#717171' }}>Discover video podcasts, interviews, and discussions</p>
              </div>
            </div>
          ) : currentView === 'premium' ? (
            <div style={{ padding: '24px', maxWidth: 800, margin: '0 auto' }}>
              <div style={{ textAlign: 'center', padding: 48, backgroundColor: '#1a1a1a', borderRadius: 16 }}>
                <div style={{ display: 'flex', justifyContent: 'center' }}>
                  <TrendingIcon size={64} />
                </div>
                <h2 style={{ fontSize: 28, fontWeight: 600, marginTop: 24, marginBottom: 16 }}>MicroTube Premium</h2>
                <p style={{ color: '#aaa', marginBottom: 32, fontSize: 16 }}>
                  Ad-free videos, background play, downloads, and more
                </p>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 16, textAlign: 'left', maxWidth: 400, margin: '0 auto 32px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}><span style={{ color: '#3ea6ff' }}>✓</span> Ad-free videos and music</div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}><span style={{ color: '#3ea6ff' }}>✓</span> Download to watch offline</div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}><span style={{ color: '#3ea6ff' }}>✓</span> Background playback</div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}><span style={{ color: '#3ea6ff' }}>✓</span> MicroTube Music Premium included</div>
                </div>
                <button
                  onClick={() => setShowPremiumModal(true)}
                  style={{ padding: '12px 32px', backgroundColor: '#3ea6ff', color: '#0f0f0f', border: 'none', borderRadius: 24, fontSize: 16, fontWeight: 600, cursor: 'pointer' }}
                >
                  Get Premium
                </button>
              </div>
            </div>
          ) : currentView === 'yt-music' ? (
            <div style={{ padding: '24px', maxWidth: 800, margin: '0 auto' }}>
              <div style={{ textAlign: 'center', padding: 48, backgroundColor: '#1a1a1a', borderRadius: 16 }}>
                <div style={{ display: 'flex', justifyContent: 'center' }}>
                  <MusicNoteIcon size={64} />
                </div>
                <h2 style={{ fontSize: 28, fontWeight: 600, marginTop: 24, marginBottom: 16 }}>MicroTube Music</h2>
                <p style={{ color: '#aaa', marginBottom: 32, fontSize: 16 }}>
                  A new music service with official albums, playlists, and more
                </p>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 16, textAlign: 'left', maxWidth: 400, margin: '0 auto 32px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}><span style={{ color: '#ff0000' }}>♪</span> Millions of songs</div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}><span style={{ color: '#ff0000' }}>♪</span> Official albums and playlists</div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}><span style={{ color: '#ff0000' }}>♪</span> Personalized mixes</div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}><span style={{ color: '#ff0000' }}>♪</span> Music videos</div>
                </div>
                <button
                  onClick={() => setRoute('home')}
                  style={{ padding: '12px 32px', backgroundColor: '#ff0000', color: '#fff', border: 'none', borderRadius: 24, fontSize: 16, fontWeight: 600, cursor: 'pointer' }}
                >
                  Try MicroTube Music
                </button>
              </div>
            </div>
          ) : currentView === 'about' ? (
            <div style={{ padding: '24px', maxWidth: 800, margin: '0 auto' }}>
              <h2 style={{ fontSize: 24, fontWeight: 600, marginBottom: 24 }}>About MicroTube</h2>
              <div style={{ backgroundColor: '#1a1a1a', borderRadius: 12, padding: 24 }}>
                <p style={{ color: '#aaa', lineHeight: 1.8, marginBottom: 16 }}>
                  MicroTube is a video sharing platform that allows users to upload, view, rate, share, and comment on videos.
                  Our mission is to give everyone a voice and show them the world.
                </p>
                <p style={{ color: '#aaa', lineHeight: 1.8 }}>
                  We believe that everyone deserves to have a voice, and that the world is a better place when we listen, share, and build community through stories.
                </p>
              </div>
            </div>
          ) : currentView === 'press' ? (
            <div style={{ padding: '24px', maxWidth: 800, margin: '0 auto' }}>
              <h2 style={{ fontSize: 24, fontWeight: 600, marginBottom: 24 }}>Press</h2>
              <div style={{ backgroundColor: '#1a1a1a', borderRadius: 12, padding: 24 }}>
                <p style={{ color: '#aaa', lineHeight: 1.8, marginBottom: 16 }}>
                  For press inquiries, please contact our media relations team.
                </p>
                <p style={{ color: '#717171' }}>Email: press@microtube.example.com</p>
              </div>
            </div>
          ) : currentView === 'copyright' ? (
            <div style={{ padding: '24px', maxWidth: 800, margin: '0 auto' }}>
              <h2 style={{ fontSize: 24, fontWeight: 600, marginBottom: 24 }}>Copyright</h2>
              <div style={{ backgroundColor: '#1a1a1a', borderRadius: 12, padding: 24 }}>
                <p style={{ color: '#aaa', lineHeight: 1.8, marginBottom: 16 }}>
                  MicroTube respects the intellectual property rights of others and expects users to do the same.
                </p>
                <p style={{ color: '#aaa', lineHeight: 1.8 }}>
                  If you believe your copyright has been infringed, please submit a copyright complaint through our Help Center.
                </p>
              </div>
            </div>
          ) : currentView === 'contact' ? (
            <div style={{ padding: '24px', maxWidth: 800, margin: '0 auto' }}>
              <h2 style={{ fontSize: 24, fontWeight: 600, marginBottom: 24 }}>Contact Us</h2>
              <div style={{ backgroundColor: '#1a1a1a', borderRadius: 12, padding: 24 }}>
                <p style={{ color: '#aaa', lineHeight: 1.8, marginBottom: 16 }}>
                  Have a question or feedback? We'd love to hear from you.
                </p>
                <p style={{ color: '#717171', marginBottom: 8 }}>General inquiries: contact@microtube.example.com</p>
                <p style={{ color: '#717171', marginBottom: 8 }}>Support: support@microtube.example.com</p>
                <p style={{ color: '#717171' }}>Business: business@microtube.example.com</p>
              </div>
            </div>
          ) : currentView === 'creators' ? (
            <div style={{ padding: '24px', maxWidth: 800, margin: '0 auto' }}>
              <h2 style={{ fontSize: 24, fontWeight: 600, marginBottom: 24 }}>Creators</h2>
              <div style={{ backgroundColor: '#1a1a1a', borderRadius: 12, padding: 24 }}>
                <p style={{ color: '#aaa', lineHeight: 1.8, marginBottom: 16 }}>
                  Join millions of creators sharing their stories with the world.
                </p>
                <p style={{ color: '#aaa', lineHeight: 1.8 }}>
                  MicroTube provides creators with tools to build audiences, express creativity, and earn money doing what they love.
                </p>
                <button
                  onClick={() => setShowUploadModal(true)}
                  style={{ marginTop: 16, padding: '10px 24px', backgroundColor: '#3ea6ff', color: '#0f0f0f', border: 'none', borderRadius: 20, fontWeight: 500, cursor: 'pointer' }}
                >
                  Start Creating
                </button>
              </div>
            </div>
          ) : currentView === 'advertise' ? (
            <div style={{ padding: '24px', maxWidth: 800, margin: '0 auto' }}>
              <h2 style={{ fontSize: 24, fontWeight: 600, marginBottom: 24 }}>Advertise on MicroTube</h2>
              <div style={{ backgroundColor: '#1a1a1a', borderRadius: 12, padding: 24 }}>
                <p style={{ color: '#aaa', lineHeight: 1.8, marginBottom: 16 }}>
                  Reach billions of people where they choose to watch. MicroTube advertising solutions help you connect with the audiences that matter most to your business.
                </p>
                <button
                  onClick={() => setShowAdvertiseModal(true)}
                  style={{ marginTop: 16, padding: '10px 24px', backgroundColor: '#3ea6ff', color: '#0f0f0f', border: 'none', borderRadius: 20, fontWeight: 500, cursor: 'pointer' }}
                >
                  Get Started
                </button>
              </div>
            </div>
          ) : currentView === 'developers' ? (
            <div style={{ padding: '24px', maxWidth: 800, margin: '0 auto' }}>
              <h2 style={{ fontSize: 24, fontWeight: 600, marginBottom: 24 }}>Developers</h2>
              <div style={{ backgroundColor: '#1a1a1a', borderRadius: 12, padding: 24 }}>
                <p style={{ color: '#aaa', lineHeight: 1.8, marginBottom: 16 }}>
                  Build with MicroTube APIs and integrate video functionality into your applications.
                </p>
                <p style={{ color: '#aaa', lineHeight: 1.8 }}>
                  Access our comprehensive developer documentation, API references, and SDKs.
                </p>
                <button
                  onClick={() => setRoute('about')}
                  style={{ marginTop: 16, padding: '10px 24px', backgroundColor: '#3ea6ff', color: '#0f0f0f', border: 'none', borderRadius: 20, fontWeight: 500, cursor: 'pointer' }}
                >
                  View Documentation
                </button>
              </div>
            </div>
          ) : currentView === 'terms' ? (
            <div style={{ padding: '24px', maxWidth: 800, margin: '0 auto' }}>
              <h2 style={{ fontSize: 24, fontWeight: 600, marginBottom: 24 }}>Terms of Service</h2>
              <div style={{ backgroundColor: '#1a1a1a', borderRadius: 12, padding: 24 }}>
                <p style={{ color: '#aaa', lineHeight: 1.8, marginBottom: 16 }}>
                  Welcome to MicroTube. By using our services, you agree to these terms. Please read them carefully.
                </p>
                <h3 style={{ fontSize: 16, fontWeight: 500, marginTop: 24, marginBottom: 12 }}>Your Use of the Service</h3>
                <p style={{ color: '#717171', lineHeight: 1.8 }}>
                  You may use the Service only as permitted by law. We may suspend or stop providing our Services to you if you do not comply with our terms or policies.
                </p>
              </div>
            </div>
          ) : currentView === 'privacy' ? (
            <div style={{ padding: '24px', maxWidth: 800, margin: '0 auto' }}>
              <h2 style={{ fontSize: 24, fontWeight: 600, marginBottom: 24 }}>Privacy Policy</h2>
              <div style={{ backgroundColor: '#1a1a1a', borderRadius: 12, padding: 24 }}>
                <p style={{ color: '#aaa', lineHeight: 1.8, marginBottom: 16 }}>
                  Your privacy is important to us. This Privacy Policy explains how we collect, use, and protect your information.
                </p>
                <h3 style={{ fontSize: 16, fontWeight: 500, marginTop: 24, marginBottom: 12 }}>Information We Collect</h3>
                <p style={{ color: '#717171', lineHeight: 1.8 }}>
                  We collect information you provide directly to us, such as when you create an account, upload content, or contact us for support.
                </p>
              </div>
            </div>
          ) : currentView === 'policy' ? (
            <div style={{ padding: '24px', maxWidth: 800, margin: '0 auto' }}>
              <h2 style={{ fontSize: 24, fontWeight: 600, marginBottom: 24 }}>Policy & Safety</h2>
              <div style={{ backgroundColor: '#1a1a1a', borderRadius: 12, padding: 24 }}>
                <p style={{ color: '#aaa', lineHeight: 1.8, marginBottom: 16 }}>
                  MicroTube is committed to maintaining a safe and vibrant community. Our policies help keep the platform safe for everyone.
                </p>
                <h3 style={{ fontSize: 16, fontWeight: 500, marginTop: 24, marginBottom: 12 }}>Community Guidelines</h3>
                <p style={{ color: '#717171', lineHeight: 1.8 }}>
                  Our Community Guidelines are designed to ensure our community stays protected. Content that violates these guidelines may be removed.
                </p>
              </div>
            </div>
          ) : currentView === 'how-it-works' ? (
            <div style={{ padding: '24px', maxWidth: 800, margin: '0 auto' }}>
              <h2 style={{ fontSize: 24, fontWeight: 600, marginBottom: 24 }}>How MicroTube Works</h2>
              <div style={{ backgroundColor: '#1a1a1a', borderRadius: 12, padding: 24 }}>
                <p style={{ color: '#aaa', lineHeight: 1.8, marginBottom: 16 }}>
                  MicroTube is a video sharing platform where users can upload, watch, and share videos.
                </p>
                <h3 style={{ fontSize: 16, fontWeight: 500, marginTop: 24, marginBottom: 12 }}>Recommendations</h3>
                <p style={{ color: '#717171', lineHeight: 1.8, marginBottom: 16 }}>
                  Our recommendation system suggests videos based on your watch history, likes, and subscriptions.
                </p>
                <h3 style={{ fontSize: 16, fontWeight: 500, marginTop: 24, marginBottom: 12 }}>Monetization</h3>
                <p style={{ color: '#717171', lineHeight: 1.8 }}>
                  Creators can earn money through ads, channel memberships, Super Chat, and merchandise.
                </p>
              </div>
            </div>
          ) : currentView === 'test-features' ? (
            <div style={{ padding: '24px', maxWidth: 800, margin: '0 auto' }}>
              <h2 style={{ fontSize: 24, fontWeight: 600, marginBottom: 24 }}>Test New Features</h2>
              <div style={{ backgroundColor: '#1a1a1a', borderRadius: 12, padding: 24 }}>
                <p style={{ color: '#aaa', lineHeight: 1.8, marginBottom: 16 }}>
                  Be among the first to try new features before they're released to everyone.
                </p>
                <p style={{ color: '#717171', lineHeight: 1.8, marginBottom: 16 }}>
                  Premium members get early access to experimental features. Your feedback helps shape the future of MicroTube.
                </p>
                <button
                  onClick={toggleBetaEnrollment}
                  style={{ padding: '10px 24px', backgroundColor: state.betaEnrolled ? '#2ba640' : '#3ea6ff', color: state.betaEnrolled ? '#fff' : '#0f0f0f', border: 'none', borderRadius: 20, fontWeight: 500, cursor: 'pointer' }}
                >
                  {state.betaEnrolled ? 'Enrolled in Beta' : 'Join the Beta Program'}
                </button>
              </div>
            </div>
          ) : (
            // Video grid (home)
            <div style={styles.videoGrid}>
              {SAMPLE_VIDEOS.map((video) => (
                <div
                  key={video.id}
                  style={styles.videoCard}
                  onMouseEnter={() => setHoveredVideo(video.id)}
                  onMouseLeave={() => setHoveredVideo(null)}
                  onClick={() => loadVideo(video.id)}
                >
                  <div style={styles.thumbnailContainer}>
                    <img
                      src={getThumbnail(video)}
                      alt={video.title}
                      style={styles.thumbnail}
                    />
                    <span style={styles.videoDuration}>{video.duration}</span>
                    {hoveredVideo === video.id && (
                      <div style={styles.thumbnailOverlay}>
                        <PlayIcon size={48} />
                      </div>
                    )}
                  </div>
                  <div style={styles.videoDetails}>
                    {video.channelAvatarUrl ? (
                      <img
                        src={video.channelAvatarUrl}
                        alt={video.channel}
                        style={{ ...styles.videoCardAvatar, cursor: 'pointer', objectFit: 'cover' }}
                        onClick={(e) => {
                          e.stopPropagation();
                          navigateToChannel(video.channelId);
                        }}
                      />
                    ) : (
                      <div
                        style={{ ...styles.videoCardAvatar, cursor: 'pointer' }}
                        onClick={(e) => {
                          e.stopPropagation();
                          navigateToChannel(video.channelId);
                        }}
                      >{video.channelAvatar}</div>
                    )}
                    <div style={styles.videoCardInfo}>
                      <h3 style={{...styles.videoCardTitle, color: colors.text}}>{video.title}</h3>
                      <p
                        style={{ ...styles.videoCardChannel, cursor: 'pointer', color: colors.textSecondary }}
                        onClick={(e) => {
                          e.stopPropagation();
                          navigateToChannel(video.channelId);
                        }}
                        onMouseEnter={(e) => (e.currentTarget.style.color = colors.text)}
                        onMouseLeave={(e) => (e.currentTarget.style.color = colors.textSecondary)}
                      >{video.channel}</p>
                      <p style={{...styles.videoCardMeta, color: colors.textSecondary}}>
                        {video.views} • {video.timestamp}
                      </p>
                    </div>
                    <button
                      style={styles.videoCardMenu}
                      onClick={(e) => {
                        e.stopPropagation();
                        setShowMoreMenu(true);
                      }}
                      title="Action menu"
                    >
                      <MoreIcon size={20} />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </main>
      </div>

      {/* Share Modal */}
      {showShareModal && (
        <div style={styles.modalOverlay} onClick={() => setShowShareModal(false)}>
          <div style={styles.shareModal} onClick={(e) => e.stopPropagation()}>
            <div style={styles.modalHeader}>
              <h3>Share</h3>
              <button
                style={styles.modalClose}
                onClick={() => setShowShareModal(false)}
              >
                ✕
              </button>
            </div>
            <div style={styles.modalBody}>
              <input
                type="text"
                value={`https://microtube.io/watch?v=${watchingVideoId}`}
                readOnly
                style={styles.shareInput}
                onClick={(e) => (e.target as HTMLInputElement).select()}
              />
              <button
                onMouseEnter={() => setHoveredElement('copy-btn')}
                onMouseLeave={() => setHoveredElement(null)}
                style={{
                  ...styles.copyButton,
                  opacity: hoveredElement === 'copy-btn' ? 0.9 : 1,
                }}
                onClick={() => {
                  navigator.clipboard.writeText(`https://microtube.io/watch?v=${watchingVideoId}`);
                  setShowShareModal(false);
                }}
              >Copy</button>
            </div>
          </div>
        </div>
      )}

      {/* Upload Modal */}
      {showUploadModal && (
        <div style={styles.modalOverlay} onClick={() => setShowUploadModal(false)}>
          <div style={{
            ...styles.shareModal,
            width: 600,
            maxWidth: '90vw',
          }} onClick={(e) => e.stopPropagation()}>
            <div style={styles.modalHeader}>
              <h3>Upload video</h3>
              <button style={styles.modalClose} onClick={() => setShowUploadModal(false)}>✕</button>
            </div>
            <div style={{ padding: 40, textAlign: 'center' }}>
              <div style={{
                width: 120,
                height: 120,
                margin: '0 auto 24px',
                borderRadius: '50%',
                backgroundColor: '#282828',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}>
                <svg width={48} height={48} viewBox="0 0 24 24" fill="#909090">
                  <path d="M9 16h6v-6h4l-7-7-7 7h4zm-4 2h14v2H5z"/>
                </svg>
              </div>
              <p style={{ fontSize: 15, marginBottom: 8 }}>Drag and drop video files to upload</p>
              <p style={{ fontSize: 13, color: '#aaa', marginBottom: 24 }}>Your videos will be private until you publish them.</p>
              <button
                style={{
                  padding: '10px 24px',
                  backgroundColor: '#3ea6ff',
                  color: '#0f0f0f',
                  border: 'none',
                  borderRadius: 2,
                  fontWeight: 500,
                  fontSize: 14,
                  cursor: 'pointer',
                }}
                onClick={() => {
                  setShowUploadModal(false);
                }}
              >SELECT FILES</button>
            </div>
            <div style={{ padding: '16px 24px', borderTop: '1px solid #3f3f3f', fontSize: 12, color: '#aaa' }}>
              By submitting your videos to MicroTube, you acknowledge that you agree to MicroTube's Terms of Service and Community Guidelines.
            </div>
          </div>
        </div>
      )}

      {/* Customize Channel Modal */}
      {showCustomizeModal && (
        <div style={styles.modalOverlay} onClick={() => setShowCustomizeModal(false)}>
          <div style={{
            ...styles.shareModal,
            width: 600,
            maxWidth: '90vw',
          }} onClick={(e) => e.stopPropagation()}>
            <div style={styles.modalHeader}>
              <h3>Customize channel</h3>
              <button style={styles.modalClose} onClick={() => setShowCustomizeModal(false)}>✕</button>
            </div>
            <div style={{ padding: 24 }}>
              <div style={{ marginBottom: 24 }}>
                <label style={{ display: 'block', marginBottom: 8, color: '#aaa', fontSize: 12, textTransform: 'uppercase' }}>Channel name</label>
                <input
                  type="text"
                  defaultValue={selfChannel?.name || config?.selfUser?.name || ""}
                  style={{
                    width: '100%',
                    padding: '12px 16px',
                    backgroundColor: '#272727',
                    border: '1px solid #3f3f3f',
                    borderRadius: 4,
                    color: '#fff',
                    fontSize: 14,
                  }}
                />
              </div>
              <div style={{ marginBottom: 24 }}>
                <label style={{ display: 'block', marginBottom: 8, color: '#aaa', fontSize: 12, textTransform: 'uppercase' }}>Handle</label>
                <input
                  type="text"
                  defaultValue={`@${selfChannel?.handle?.replace('@', '') || "yourchannel"}`}
                  style={{
                    width: '100%',
                    padding: '12px 16px',
                    backgroundColor: '#272727',
                    border: '1px solid #3f3f3f',
                    borderRadius: 4,
                    color: '#fff',
                    fontSize: 14,
                  }}
                />
              </div>
              <div style={{ marginBottom: 24 }}>
                <label style={{ display: 'block', marginBottom: 8, color: '#aaa', fontSize: 12, textTransform: 'uppercase' }}>Description</label>
                <textarea
                  defaultValue={selfChannel?.description || "Welcome to my channel!"}
                  style={{
                    width: '100%',
                    padding: '12px 16px',
                    backgroundColor: '#272727',
                    border: '1px solid #3f3f3f',
                    borderRadius: 4,
                    color: '#fff',
                    fontSize: 14,
                    minHeight: 100,
                    resize: 'vertical',
                  }}
                />
              </div>
              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 12 }}>
                <button
                  style={{
                    padding: '10px 20px',
                    backgroundColor: 'transparent',
                    color: '#3ea6ff',
                    border: 'none',
                    borderRadius: 20,
                    fontWeight: 500,
                    cursor: 'pointer',
                  }}
                  onClick={() => setShowCustomizeModal(false)}
                >Cancel</button>
                <button
                  style={{
                    padding: '10px 20px',
                    backgroundColor: '#3ea6ff',
                    color: '#0f0f0f',
                    border: 'none',
                    borderRadius: 20,
                    fontWeight: 500,
                    cursor: 'pointer',
                  }}
                  onClick={() => {
                    setShowCustomizeModal(false);
                  }}
                >Save</button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Manage Videos Modal */}
      {showManageVideosModal && (
        <div style={styles.modalOverlay} onClick={() => setShowManageVideosModal(false)}>
          <div style={{
            ...styles.shareModal,
            width: 800,
            maxWidth: '90vw',
            maxHeight: '80vh',
            overflow: 'hidden',
            display: 'flex',
            flexDirection: 'column',
          }} onClick={(e) => e.stopPropagation()}>
            <div style={styles.modalHeader}>
              <h3>Manage videos</h3>
              <button style={styles.modalClose} onClick={() => setShowManageVideosModal(false)}>✕</button>
            </div>
            <div style={{ padding: 24, overflowY: 'auto', flex: 1 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
                <h4 style={{ margin: 0 }}>Your Videos ({getVideosForChannel("ch-self").length})</h4>
                <button
                  style={{
                    padding: '10px 20px',
                    backgroundColor: '#3ea6ff',
                    color: '#0f0f0f',
                    border: 'none',
                    borderRadius: 20,
                    fontWeight: 500,
                    cursor: 'pointer',
                  }}
                  onClick={() => {
                    setShowManageVideosModal(false);
                    setShowUploadModal(true);
                  }}
                >Upload video</button>
              </div>
              {getVisibleVideos(getVideosForChannel("ch-self")).length > 0 ? (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                  {getVisibleVideos(getVideosForChannel("ch-self")).map((video) => (
                    <div key={video.id} style={{
                      display: 'flex',
                      gap: 16,
                      padding: 12,
                      backgroundColor: '#272727',
                      borderRadius: 8,
                    }}>
                      <div style={{
                        width: 160,
                        height: 90,
                        borderRadius: 8,
                        overflow: 'hidden',
                        flexShrink: 0,
                      }}>
                        <img src={getThumbnail(video)} alt={video.title} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                      </div>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <h5 style={{ margin: '0 0 8px 0', fontSize: 14, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{video.title}</h5>
                        <p style={{ margin: 0, fontSize: 12, color: '#aaa' }}>{video.views} • {video.timestamp}</p>
                        <p style={{ margin: '4px 0 0', fontSize: 12, color: '#aaa' }}>Duration: {video.duration}</p>
                      </div>
                      <div style={{ display: 'flex', gap: 8 }}>
                        <button
                          style={{
                            padding: '8px 12px',
                            backgroundColor: '#3f3f3f',
                            color: '#fff',
                            border: 'none',
                            borderRadius: 4,
                            cursor: 'pointer',
                            fontSize: 12,
                          }}
                          onClick={() => {
                            setEditingVideoId(video.id);
                            setShowEditVideoModal(true);
                          }}
                        >Edit</button>
                        <button
                          style={{
                            padding: '8px 12px',
                            backgroundColor: '#3f3f3f',
                            color: '#f00',
                            border: 'none',
                            borderRadius: 4,
                            cursor: 'pointer',
                            fontSize: 12,
                          }}
                          onClick={() => deleteVideo(video.id)}
                        >Delete</button>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div style={{ textAlign: 'center', padding: 48, color: '#aaa' }}>
                  <p>No videos uploaded yet</p>
                  <p style={{ fontSize: 12, marginTop: 8 }}>Upload your first video to get started!</p>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Save to Playlist Modal */}
      {showSaveModal && watchingVideoId && (
        <div style={styles.modalOverlay} onClick={() => setShowSaveModal(false)}>
          <div style={{
            ...styles.shareModal,
            width: 300,
          }} onClick={(e) => e.stopPropagation()}>
            <div style={styles.modalHeader}>
              <h3>Save to...</h3>
              <button style={styles.modalClose} onClick={() => setShowSaveModal(false)}>✕</button>
            </div>
            <div style={{ padding: 16 }}>
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 12,
                  padding: '12px 8px',
                  cursor: 'pointer',
                  borderRadius: 4,
                  backgroundColor: isVideoSaved(watchingVideoId) ? '#272727' : 'transparent',
                }}
                onClick={() => saveVideo(watchingVideoId)}
              >
                <input
                  type="checkbox"
                  checked={isVideoSaved(watchingVideoId)}
                  readOnly
                  style={{ width: 18, height: 18 }}
                />
                <span>Watch later</span>
              </div>
              {apiPlaylists.map(pl => {
                const inPlaylist = pl.video_ids.includes(watchingVideoId);
                return (
                  <div
                    key={pl.id}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: 12,
                      padding: '12px 8px',
                      cursor: inPlaylist ? 'default' : 'pointer',
                      borderRadius: 4,
                      backgroundColor: inPlaylist ? '#272727' : 'transparent',
                    }}
                    onClick={() => {
                      if (!inPlaylist) apiAddToPlaylist(pl.id, watchingVideoId);
                    }}
                  >
                    <input
                      type="checkbox"
                      checked={inPlaylist}
                      readOnly
                      style={{ width: 18, height: 18 }}
                    />
                    <span>{pl.name}</span>
                  </div>
                );
              })}
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 12,
                  padding: '12px 8px',
                  cursor: 'pointer',
                  borderRadius: 4,
                }}
                onClick={() => setShowCreatePlaylistModal(true)}
              >
                <span style={{ fontSize: 18, width: 18, textAlign: 'center' }}>+</span>
                <span>Create new playlist</span>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Create Playlist Modal */}
      {showCreatePlaylistModal && (
        <div style={styles.modalOverlay} onClick={() => setShowCreatePlaylistModal(false)}>
          <div style={{
            ...styles.shareModal,
            width: 360,
          }} onClick={(e) => e.stopPropagation()}>
            <div style={styles.modalHeader}>
              <h3>Create new playlist</h3>
              <button style={styles.modalClose} onClick={() => setShowCreatePlaylistModal(false)}>✕</button>
            </div>
            <div style={{ padding: 16 }}>
              <label style={{ fontSize: 12, color: '#aaa', display: 'block', marginBottom: 8 }}>Name</label>
              <input
                type="text"
                placeholder="Enter playlist name..."
                value={newPlaylistName}
                onChange={(e) => setNewPlaylistName(e.target.value)}
                style={{
                  width: '100%',
                  padding: 12,
                  backgroundColor: '#121212',
                  border: '1px solid #3f3f3f',
                  borderRadius: 4,
                  color: '#fff',
                  fontSize: 14,
                  outline: 'none',
                }}
                autoFocus
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && newPlaylistName.trim()) {
                    createPlaylist(newPlaylistName);
                  }
                }}
              />
              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginTop: 16 }}>
                <button
                  onClick={() => setShowCreatePlaylistModal(false)}
                  style={{
                    padding: '8px 16px',
                    backgroundColor: 'transparent',
                    color: '#3ea6ff',
                    border: 'none',
                    borderRadius: 4,
                    cursor: 'pointer',
                  }}
                >Cancel</button>
                <button
                  onClick={() => createPlaylist(newPlaylistName)}
                  disabled={!newPlaylistName.trim()}
                  style={{
                    padding: '8px 16px',
                    backgroundColor: newPlaylistName.trim() ? '#3ea6ff' : '#3f3f3f',
                    color: newPlaylistName.trim() ? '#0f0f0f' : '#717171',
                    border: 'none',
                    borderRadius: 4,
                    cursor: newPlaylistName.trim() ? 'pointer' : 'default',
                    fontWeight: 500,
                  }}
                >Create</button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Premium Modal */}
      {showPremiumModal && (
        <div style={styles.modalOverlay} onClick={() => setShowPremiumModal(false)}>
          <div style={{
            ...styles.shareModal,
            width: 400,
          }} onClick={(e) => e.stopPropagation()}>
            <div style={styles.modalHeader}>
              <h3>Get MicroTube Premium</h3>
              <button style={styles.modalClose} onClick={() => setShowPremiumModal(false)}>✕</button>
            </div>
            <div style={{ padding: 24, textAlign: 'center' }}>
              <div style={{ fontSize: 48, marginBottom: 16 }}>⭐</div>
              <h4 style={{ marginBottom: 16, fontSize: 18 }}>$11.99/month</h4>
              <p style={{ color: '#aaa', marginBottom: 24, fontSize: 14 }}>
                Ad-free videos, background play, downloads, and MicroTube Music included.
              </p>
              <button
                onClick={() => setShowPremiumModal(false)}
                style={{
                  padding: '12px 32px',
                  backgroundColor: '#3ea6ff',
                  color: '#0f0f0f',
                  border: 'none',
                  borderRadius: 24,
                  fontSize: 14,
                  fontWeight: 600,
                  cursor: 'pointer',
                  width: '100%',
                }}
              >
                Start Free Trial
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Advertise Modal */}
      {showAdvertiseModal && (
        <div style={styles.modalOverlay} onClick={() => setShowAdvertiseModal(false)}>
          <div style={{
            ...styles.shareModal,
            width: 400,
          }} onClick={(e) => e.stopPropagation()}>
            <div style={styles.modalHeader}>
              <h3>Advertise on MicroTube</h3>
              <button style={styles.modalClose} onClick={() => setShowAdvertiseModal(false)}>✕</button>
            </div>
            <div style={{ padding: 24 }}>
              <p style={{ color: '#aaa', marginBottom: 16, fontSize: 14 }}>
                Reach your audience with targeted video ads across MicroTube's platform.
              </p>
              <div style={{ marginBottom: 16 }}>
                <label style={{ fontSize: 12, color: '#aaa', display: 'block', marginBottom: 8 }}>Business Email</label>
                <input
                  type="email"
                  placeholder="Enter your business email"
                  style={{
                    width: '100%',
                    padding: 12,
                    backgroundColor: '#121212',
                    border: '1px solid #3f3f3f',
                    borderRadius: 4,
                    color: '#fff',
                    fontSize: 14,
                    outline: 'none',
                  }}
                />
              </div>
              <button
                onClick={() => setShowAdvertiseModal(false)}
                style={{
                  padding: '10px 24px',
                  backgroundColor: '#3ea6ff',
                  color: '#0f0f0f',
                  border: 'none',
                  borderRadius: 20,
                  fontWeight: 500,
                  cursor: 'pointer',
                  width: '100%',
                }}
              >
                Contact Sales
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Clip Modal */}
      {showClipModal && (
        <div style={styles.modalOverlay} onClick={() => setShowClipModal(false)}>
          <div style={{
            ...styles.shareModal,
            width: 420,
          }} onClick={(e) => e.stopPropagation()}>
            <div style={styles.modalHeader}>
              <h3>Create Clip</h3>
              <button style={styles.modalClose} onClick={() => setShowClipModal(false)}>✕</button>
            </div>
            <div style={{ padding: 24 }}>
              <p style={{ color: '#aaa', marginBottom: 16, fontSize: 14 }}>
                Create a 5-60 second clip from this video to share with others.
              </p>
              <div style={{ marginBottom: 16 }}>
                <label style={{ fontSize: 12, color: '#aaa', display: 'block', marginBottom: 8 }}>Start Time (seconds)</label>
                <input
                  type="number"
                  value={clipStartTime}
                  onChange={(e) => setClipStartTime(Number(e.target.value))}
                  min={0}
                  style={{
                    width: '100%',
                    padding: 12,
                    backgroundColor: '#121212',
                    border: '1px solid #3f3f3f',
                    borderRadius: 4,
                    color: '#fff',
                    fontSize: 14,
                    outline: 'none',
                  }}
                />
              </div>
              <div style={{ marginBottom: 16 }}>
                <label style={{ fontSize: 12, color: '#aaa', display: 'block', marginBottom: 8 }}>End Time (seconds)</label>
                <input
                  type="number"
                  value={clipEndTime}
                  onChange={(e) => setClipEndTime(Number(e.target.value))}
                  min={clipStartTime + 5}
                  max={clipStartTime + 60}
                  style={{
                    width: '100%',
                    padding: 12,
                    backgroundColor: '#121212',
                    border: '1px solid #3f3f3f',
                    borderRadius: 4,
                    color: '#fff',
                    fontSize: 14,
                    outline: 'none',
                  }}
                />
              </div>
              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
                <button
                  onClick={() => setShowClipModal(false)}
                  style={{
                    padding: '8px 16px',
                    backgroundColor: 'transparent',
                    color: '#3ea6ff',
                    border: 'none',
                    borderRadius: 4,
                    cursor: 'pointer',
                  }}
                >Cancel</button>
                <button
                  onClick={() => setShowClipModal(false)}
                  style={{
                    padding: '8px 16px',
                    backgroundColor: '#3ea6ff',
                    color: '#0f0f0f',
                    border: 'none',
                    borderRadius: 4,
                    cursor: 'pointer',
                    fontWeight: 500,
                  }}
                >Create Clip</button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Report Modal */}
      {showReportModal && (
        <div style={styles.modalOverlay} onClick={() => setShowReportModal(false)}>
          <div style={{
            ...styles.shareModal,
            width: 400,
          }} onClick={(e) => e.stopPropagation()}>
            <div style={styles.modalHeader}>
              <h3>Report Video</h3>
              <button style={styles.modalClose} onClick={() => setShowReportModal(false)}>✕</button>
            </div>
            <div style={{ padding: 24 }}>
              <p style={{ color: '#aaa', marginBottom: 16, fontSize: 14 }}>
                Why are you reporting this video?
              </p>
              {['Sexual content', 'Violent or repulsive content', 'Hateful or abusive content', 'Spam or misleading', 'Harmful or dangerous acts'].map((reason) => (
                <div
                  key={reason}
                  onClick={() => setReportReason(reason)}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 12,
                    padding: '12px 8px',
                    cursor: 'pointer',
                    borderRadius: 4,
                    backgroundColor: reportReason === reason ? '#272727' : 'transparent',
                  }}
                >
                  <input
                    type="radio"
                    checked={reportReason === reason}
                    readOnly
                    style={{ width: 16, height: 16 }}
                  />
                  <span style={{ fontSize: 14 }}>{reason}</span>
                </div>
              ))}
              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginTop: 16 }}>
                <button
                  onClick={() => { setShowReportModal(false); setReportReason(''); }}
                  style={{
                    padding: '8px 16px',
                    backgroundColor: 'transparent',
                    color: '#3ea6ff',
                    border: 'none',
                    borderRadius: 4,
                    cursor: 'pointer',
                  }}
                >Cancel</button>
                <button
                  onClick={() => { setShowReportModal(false); setReportReason(''); }}
                  disabled={!reportReason}
                  style={{
                    padding: '8px 16px',
                    backgroundColor: reportReason ? '#3ea6ff' : '#3f3f3f',
                    color: reportReason ? '#0f0f0f' : '#717171',
                    border: 'none',
                    borderRadius: 4,
                    cursor: reportReason ? 'pointer' : 'default',
                    fontWeight: 500,
                  }}
                >Submit</button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Voice Search Modal */}
      {showVoiceSearchModal && (
        <div style={styles.modalOverlay} onClick={() => setShowVoiceSearchModal(false)}>
          <div style={{
            ...styles.shareModal,
            width: 360,
            textAlign: 'center',
          }} onClick={(e) => e.stopPropagation()}>
            <div style={{ padding: 48 }}>
              <div style={{
                width: 80,
                height: 80,
                borderRadius: '50%',
                backgroundColor: '#cc0000',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                margin: '0 auto 24px',
                animation: 'pulse 1.5s ease-in-out infinite',
              }}>
                <MicIcon size={40} />
              </div>
              <h3 style={{ marginBottom: 8 }}>Listening...</h3>
              <p style={{ color: '#aaa', fontSize: 14 }}>Say something to search</p>
            </div>
          </div>
        </div>
      )}

      {/* Edit Video Modal */}
      {showEditVideoModal && editingVideoId && (
        <div style={styles.modalOverlay} onClick={() => { setShowEditVideoModal(false); setEditingVideoId(null); }}>
          <div style={{
            ...styles.shareModal,
            width: 480,
          }} onClick={(e) => e.stopPropagation()}>
            <div style={styles.modalHeader}>
              <h3>Edit Video</h3>
              <button style={styles.modalClose} onClick={() => { setShowEditVideoModal(false); setEditingVideoId(null); }}>✕</button>
            </div>
            <div style={{ padding: 24 }}>
              <div style={{ marginBottom: 16 }}>
                <label style={{ fontSize: 12, color: '#aaa', display: 'block', marginBottom: 8 }}>Title</label>
                <input
                  type="text"
                  defaultValue={SAMPLE_VIDEOS.find((v: VideoData) => v.id === editingVideoId)?.title || ''}
                  style={{
                    width: '100%',
                    padding: 12,
                    backgroundColor: '#121212',
                    border: '1px solid #3f3f3f',
                    borderRadius: 4,
                    color: '#fff',
                    fontSize: 14,
                    outline: 'none',
                  }}
                />
              </div>
              <div style={{ marginBottom: 16 }}>
                <label style={{ fontSize: 12, color: '#aaa', display: 'block', marginBottom: 8 }}>Description</label>
                <textarea
                  rows={4}
                  defaultValue={SAMPLE_VIDEOS.find((v: VideoData) => v.id === editingVideoId)?.description || ''}
                  style={{
                    width: '100%',
                    padding: 12,
                    backgroundColor: '#121212',
                    border: '1px solid #3f3f3f',
                    borderRadius: 4,
                    color: '#fff',
                    fontSize: 14,
                    outline: 'none',
                    resize: 'vertical',
                  }}
                />
              </div>
              <div style={{ marginBottom: 16 }}>
                <label style={{ fontSize: 12, color: '#aaa', display: 'block', marginBottom: 8 }}>Visibility</label>
                <select
                  style={{
                    width: '100%',
                    padding: 12,
                    backgroundColor: '#121212',
                    border: '1px solid #3f3f3f',
                    borderRadius: 4,
                    color: '#fff',
                    fontSize: 14,
                    outline: 'none',
                  }}
                >
                  <option value="public">Public</option>
                  <option value="unlisted">Unlisted</option>
                  <option value="private">Private</option>
                </select>
              </div>
              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
                <button
                  onClick={() => { setShowEditVideoModal(false); setEditingVideoId(null); }}
                  style={{
                    padding: '8px 16px',
                    backgroundColor: 'transparent',
                    color: '#3ea6ff',
                    border: 'none',
                    borderRadius: 4,
                    cursor: 'pointer',
                  }}
                >Cancel</button>
                <button
                  onClick={() => { setShowEditVideoModal(false); setEditingVideoId(null); }}
                  style={{
                    padding: '8px 16px',
                    backgroundColor: '#3ea6ff',
                    color: '#0f0f0f',
                    border: 'none',
                    borderRadius: 4,
                    cursor: 'pointer',
                    fontWeight: 500,
                  }}
                >Save Changes</button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Toast Notifications */}
      <div style={{
        position: 'fixed',
        bottom: 24,
        left: '50%',
        transform: 'translateX(-50%)',
        display: 'flex',
        flexDirection: 'column',
        gap: 8,
        zIndex: 9999,
      }}>
        {toasts.map(toast => (
          <div
            key={toast.id}
            style={{
              padding: '12px 24px',
              backgroundColor: toast.type === 'success' ? '#2e7d32' : toast.type === 'error' ? '#d32f2f' : '#323232',
              color: '#fff',
              borderRadius: 4,
              boxShadow: '0 4px 12px rgba(0,0,0,0.4)',
              animation: 'fadeIn 0.2s ease',
              fontSize: 14,
              minWidth: 200,
              textAlign: 'center',
            }}
          >
            {toast.message}
          </div>
        ))}
      </div>

      {isSignedOut && (
        <div className="fixed inset-0 z-50 flex items-center justify-center" style={{ backgroundColor: "rgba(0,0,0,0.7)", backdropFilter: "blur(6px)" }}>
          <div className="rounded-lg shadow-2xl p-8 w-[360px] flex flex-col items-center" style={{ backgroundColor: "#282828" }}>
            <div className="text-2xl font-bold mb-6" style={{ color: "#FF0000" }}>MicroTube</div>
            <div className="w-20 h-20 rounded-full flex items-center justify-center text-white text-2xl font-bold mb-4" style={{ backgroundColor: "#FF0000" }}>
              {(selfChannel?.name || config?.selfUser?.name)?.charAt(0) || "U"}
            </div>
            <div className="text-lg font-semibold text-white mb-1">{selfChannel?.name || config?.selfUser?.name || "Creator"}</div>
            <div className="text-sm mb-6" style={{ color: "#aaa" }}>{selfChannel?.handle || (config?.selfUser?.username ? `@${config.selfUser.username}` : "@user")}</div>
            <input type="password" readOnly value="••••••••" className="w-full px-4 py-2 rounded mb-4 text-center" style={{ backgroundColor: "#3E3E3E", color: "#aaa", border: "none" }} />
            <button onClick={() => setIsSignedOut(false)} className="w-full py-2 text-white rounded font-semibold hover:opacity-90 transition-opacity" style={{ backgroundColor: "#FF0000" }}>
              Sign in
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

// Styles with video platform color scheme
const styles: Record<string, React.CSSProperties> = {
  container: {
    width: "100vw",
    height: "100vh",
    backgroundColor: "#0f0f0f",
    color: "#f1f1f1",
    fontFamily: '"Roboto", "Arial", sans-serif',
    overflow: "hidden",
    display: "flex",
    flexDirection: "column",
  },
  header: {
    height: "56px",
    backgroundColor: "#0f0f0f",
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    padding: "0 16px",
    position: "sticky",
    top: 0,
    zIndex: 2000,
  },
  headerLeft: {
    display: "flex",
    alignItems: "center",
    gap: "16px",
    flex: "0 0 auto",
  },
  iconButton: {
    background: "none",
    border: "none",
    color: "#f1f1f1",
    cursor: "pointer",
    padding: "8px",
    borderRadius: "50%",
    width: "40px",
    height: "40px",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    transition: "background-color 0.2s",
  } as React.CSSProperties & { ':hover'?: React.CSSProperties },
  logo: {
    display: "flex",
    alignItems: "center",
    cursor: "pointer",
    padding: "18px 14px 18px 16px",
  },
  logoText: {
    fontSize: "20px",
    fontWeight: 500,
    letterSpacing: "-0.5px",
    marginLeft: 4,
  },
  headerCenter: {
    display: "flex",
    alignItems: "center",
    gap: "0",
    flex: "1 1 auto",
    maxWidth: "728px",
    margin: "0 auto",
  },
  searchForm: {
    display: "flex",
    flex: "1",
    maxWidth: "640px",
    height: "40px",
  },
  searchContainer: {
    position: "relative",
    flex: "1",
  },
  searchInput: {
    width: "100%",
    height: "40px",
    backgroundColor: "#121212",
    border: "1px solid #303030",
    borderRadius: "40px 0 0 40px",
    borderRight: "none",
    padding: "0 16px 0 16px",
    color: "#f1f1f1",
    fontSize: "16px",
    outline: "none",
    boxSizing: "border-box",
  },
  clearButton: {
    position: "absolute",
    right: "8px",
    top: "50%",
    transform: "translateY(-50%)",
    background: "none",
    border: "none",
    color: "#aaa",
    cursor: "pointer",
    fontSize: "18px",
    padding: "4px 8px",
  },
  searchSuggestions: {
    position: "absolute",
    top: "100%",
    left: 0,
    right: 0,
    backgroundColor: "#212121",
    border: "1px solid #303030",
    borderTop: "none",
    borderRadius: "0 0 12px 12px",
    marginTop: 0,
    zIndex: 1000,
    maxHeight: "calc(100vh - 56px - 40px)",
    overflowY: "auto",
  },
  suggestion: {
    padding: "8px 16px",
    cursor: "pointer",
    display: "flex",
    alignItems: "center",
    fontSize: "16px",
  },
  searchButton: {
    height: "40px",
    backgroundColor: "#222222",
    border: "1px solid #303030",
    borderLeft: "none",
    borderRadius: "0 40px 40px 0",
    padding: "0 20px",
    color: "#f1f1f1",
    cursor: "pointer",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
  },
  voiceSearchButton: {
    background: "none",
    border: "none",
    borderRadius: "50%",
    width: "40px",
    height: "40px",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    cursor: "pointer",
    color: "#f1f1f1",
    marginLeft: "8px",
  },
  headerRight: {
    display: "flex",
    alignItems: "center",
    gap: "8px",
    flex: "0 0 auto",
  },
  signInButton: {
    backgroundColor: "transparent",
    border: "1px solid #3f3f3f",
    borderRadius: "40px",
    padding: "8px 16px",
    color: "#3ea6ff",
    cursor: "pointer",
    fontSize: "14px",
    fontWeight: 500,
    display: "flex",
    alignItems: "center",
    gap: "8px",
  },
  signInIcon: {
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
  },
  profileButton: {
    cursor: "pointer",
  },
  avatar: {
    width: "32px",
    height: "32px",
    borderRadius: "50%",
    backgroundColor: "#d91a1a",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    fontWeight: 500,
    fontSize: "14px",
  },
  settingsDropdown: {
    position: "absolute",
    top: "56px",
    right: "16px",
    backgroundColor: "#282828",
    border: "1px solid #3f3f3f",
    borderRadius: "12px",
    padding: "8px 0",
    minWidth: "300px",
    zIndex: 1000,
    boxShadow: "0 4px 32px rgba(0, 0, 0, 0.6)",
  },
  settingsItem: {
    padding: "10px 16px",
    cursor: "pointer",
    fontSize: "14px",
  },
  divider: {
    border: "none",
    borderTop: "1px solid #3f3f3f",
    margin: "8px 0",
  },
  mainContent: {
    display: "flex",
    flex: 1,
    overflow: "hidden",
    position: "relative",
  },
  sidebar: {
    backgroundColor: "#0f0f0f",
    height: "calc(100vh - 56px)",
    overflowY: "auto",
    overflowX: "hidden",
    transition: "width 0.2s ease",
    position: "fixed",
    top: "56px",
    left: 0,
    zIndex: 1000,
  },
  sidebarSection: {
    padding: "12px 0",
  },
  sidebarSectionTitle: {
    padding: "8px 24px",
    fontSize: "14px",
    fontWeight: 500,
    color: "#aaa",
    textTransform: "uppercase",
    letterSpacing: "0.5px",
  },
  sidebarItem: {
    display: "flex",
    alignItems: "center",
    gap: "24px",
    padding: "10px 24px",
    cursor: "pointer",
    background: "none",
    border: "none",
    color: "#f1f1f1",
    width: "100%",
    fontSize: "14px",
    fontWeight: 400,
    textAlign: "left",
    borderRadius: 0,
  },
  sidebarItemActive: {
    backgroundColor: "#272727",
    fontWeight: 500,
  },
  sidebarLabel: {
    flex: 1,
    whiteSpace: "nowrap",
    overflow: "hidden",
    textOverflow: "ellipsis",
  },
  sidebarDivider: {
    border: "none",
    borderTop: "1px solid #3f3f3f",
    margin: "12px 0",
  },
  content: {
    flex: 1,
    height: "calc(100vh - 56px)",
    overflowY: "auto",
    padding: "24px",
    transition: "margin-left 0.2s ease",
    backgroundColor: "#0f0f0f",
  },
  videoGrid: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fill, minmax(320px, 1fr))",
    gap: "16px",
    maxWidth: "1920px",
    margin: "0 auto",
  },
  videoCard: {
    cursor: "pointer",
  },
  thumbnailContainer: {
    position: "relative",
    width: "100%",
    paddingBottom: "56.25%",
    backgroundColor: "#000",
    borderRadius: "12px",
    overflow: "hidden",
  },
  thumbnail: {
    position: "absolute",
    top: 0,
    left: 0,
    width: "100%",
    height: "100%",
    objectFit: "cover",
  },
  videoDuration: {
    position: "absolute",
    bottom: "8px",
    right: "8px",
    backgroundColor: "rgba(0, 0, 0, 0.85)",
    padding: "3px 4px",
    borderRadius: "4px",
    fontSize: "12px",
    fontWeight: 500,
  },
  thumbnailOverlay: {
    position: "absolute",
    top: 0,
    left: 0,
    width: "100%",
    height: "100%",
    backgroundColor: "rgba(0, 0, 0, 0.3)",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    color: "#fff",
  },
  videoDetails: {
    display: "flex",
    gap: "12px",
    marginTop: "12px",
    position: "relative",
  },
  videoCardAvatar: {
    width: "36px",
    height: "36px",
    borderRadius: "50%",
    backgroundColor: "#d91a1a",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    fontWeight: 500,
    fontSize: "14px",
    flexShrink: 0,
  },
  videoCardInfo: {
    flex: 1,
    minWidth: 0,
  },
  videoCardTitle: {
    fontSize: "14px",
    fontWeight: 500,
    lineHeight: "1.4",
    margin: "0 0 4px 0",
    overflow: "hidden",
    textOverflow: "ellipsis",
    display: "-webkit-box",
    WebkitLineClamp: 2,
    WebkitBoxOrient: "vertical",
  },
  videoCardChannel: {
    fontSize: "12px",
    color: "#aaa",
    margin: "0 0 2px 0",
  },
  videoCardMeta: {
    fontSize: "12px",
    color: "#aaa",
    margin: 0,
  },
  videoCardMenu: {
    background: "none",
    border: "none",
    color: "#f1f1f1",
    cursor: "pointer",
    padding: "4px",
    borderRadius: "50%",
    width: "28px",
    height: "28px",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    flexShrink: 0,
  },
  videoPlayerContainer: {
    maxWidth: "1280px",
    margin: "0 auto",
  },
  theaterMode: {
    maxWidth: "100%",
  },
  videoElement: {
    width: "100%",
    aspectRatio: "16 / 9",
    backgroundColor: "#000",
    borderRadius: "12px",
    marginBottom: "12px",
    cursor: "pointer",
  } as React.CSSProperties,
  videoPlaceholder: {
    width: "100%",
    paddingBottom: "56.25%",
    backgroundColor: "#000",
    borderRadius: "12px",
    position: "relative",
    marginBottom: "12px",
  },
  videoPlaceholderOverlay: {
    position: "absolute",
    top: 0,
    left: 0,
    width: "100%",
    height: "100%",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    background: "linear-gradient(135deg, #1a1a1a 0%, #0a0a0a 100%)",
  },
  videoPlaceholderText: {
    color: "#fff",
    fontSize: "24px",
    fontWeight: 500,
    textAlign: "center",
  },
  playerControls: {
    backgroundColor: "rgba(15, 15, 15, 0.95)",
    padding: "8px 12px",
    borderRadius: "0 0 12px 12px",
  },
  progressBarContainer: {
    marginBottom: "8px",
  },
  progressBar: {
    width: "100%",
    height: "4px",
    appearance: "none",
    backgroundColor: "#3f3f3f",
    borderRadius: "2px",
    cursor: "pointer",
  },
  controlsRow: {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
  },
  controlsLeft: {
    display: "flex",
    alignItems: "center",
    gap: "4px",
  },
  controlsRight: {
    display: "flex",
    alignItems: "center",
    gap: "4px",
  },
  controlButton: {
    background: "none",
    border: "none",
    color: "#f1f1f1",
    cursor: "pointer",
    padding: "8px",
    borderRadius: "4px",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
  },
  volumeSlider: {
    width: "80px",
    height: "4px",
    appearance: "none",
    backgroundColor: "#3f3f3f",
    borderRadius: "2px",
    cursor: "pointer",
  },
  timeDisplay: {
    fontSize: "13px",
    color: "#f1f1f1",
    marginLeft: "8px",
    fontVariantNumeric: "tabular-nums",
  },
  videoInfo: {
    marginTop: "16px",
  },
  videoTitle: {
    fontSize: "20px",
    fontWeight: 500,
    margin: "0 0 12px 0",
    lineHeight: "1.4",
  },
  videoMeta: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "flex-start",
    flexWrap: "wrap",
    gap: "12px",
  },
  channelInfo: {
    display: "flex",
    alignItems: "center",
    gap: "12px",
  },
  channelAvatar: {
    width: "40px",
    height: "40px",
    borderRadius: "50%",
    backgroundColor: "#d91a1a",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    fontWeight: 500,
    fontSize: "16px",
  },
  channelName: {
    fontSize: "14px",
    fontWeight: 500,
  },
  subscriberCount: {
    fontSize: "12px",
    color: "#aaa",
  },
  subscribeButton: {
    backgroundColor: "#cc0000",
    border: "none",
    borderRadius: "40px",
    padding: "10px 16px",
    color: "#fff",
    cursor: "pointer",
    fontSize: "14px",
    fontWeight: 500,
    marginLeft: "12px",
  },
  subscribedButton: {
    backgroundColor: "#272727",
    color: "#aaa",
  },
  videoActions: {
    display: "flex",
    gap: "8px",
    flexWrap: "wrap",
  },
  actionButtonGroup: {
    display: "flex",
    alignItems: "center",
    backgroundColor: "#272727",
    borderRadius: "40px",
    overflow: "hidden",
  },
  actionButton: {
    backgroundColor: "#272727",
    border: "none",
    padding: "10px 16px",
    color: "#f1f1f1",
    cursor: "pointer",
    fontSize: "14px",
    fontWeight: 500,
    display: "flex",
    alignItems: "center",
    borderRadius: "40px",
  },
  actionButtonLeft: {
    borderRadius: "40px 0 0 40px",
  },
  actionButtonRight: {
    borderRadius: "0 40px 40px 0",
    paddingLeft: "12px",
    paddingRight: "12px",
  },
  actionButtonDivider: {
    width: "1px",
    height: "24px",
    backgroundColor: "#3f3f3f",
  },
  actionButtonActive: {
    color: "#3ea6ff",
  },
  descriptionBox: {
    backgroundColor: "#272727",
    borderRadius: "12px",
    padding: "12px",
    marginTop: "16px",
    fontSize: "14px",
    lineHeight: "1.6",
  },
  commentsSection: {
    marginTop: "24px",
  },
  commentInput: {
    display: "flex",
    gap: "12px",
    alignItems: "flex-start",
  },
  commentTextInput: {
    flex: 1,
    background: "none",
    border: "none",
    borderBottom: "1px solid #3f3f3f",
    color: "#f1f1f1",
    fontSize: "14px",
    padding: "8px 0",
    outline: "none",
  },
  videoSettingsMenu: {
    position: "absolute",
    bottom: "100%",
    right: "0",
    backgroundColor: "#282828",
    border: "1px solid #3f3f3f",
    borderRadius: "12px",
    padding: "8px 0",
    minWidth: "250px",
    marginBottom: "8px",
    zIndex: 1000,
    boxShadow: "0 4px 32px rgba(0, 0, 0, 0.6)",
  },
  videoSettingsItem: {
    padding: "10px 16px",
    cursor: "pointer",
    fontSize: "14px",
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
  },
  modalOverlay: {
    position: "fixed",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: "rgba(0, 0, 0, 0.8)",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    zIndex: 3000,
  },
  shareModal: {
    backgroundColor: "#282828",
    borderRadius: "12px",
    padding: "24px",
    minWidth: "500px",
    maxWidth: "90vw",
  },
  modalHeader: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: "16px",
  },
  modalClose: {
    background: "none",
    border: "none",
    color: "#f1f1f1",
    fontSize: "24px",
    cursor: "pointer",
    padding: "4px 8px",
  },
  modalBody: {
    display: "flex",
    gap: "8px",
  },
  shareInput: {
    flex: 1,
    backgroundColor: "#181818",
    border: "1px solid #3f3f3f",
    borderRadius: "4px",
    padding: "10px 12px",
    color: "#f1f1f1",
    fontSize: "14px",
  },
  copyButton: {
    backgroundColor: "#3ea6ff",
    border: "none",
    borderRadius: "4px",
    padding: "10px 16px",
    color: "#fff",
    fontSize: "14px",
    fontWeight: 500,
    cursor: "pointer",
  },
  footerLink: {
    background: "none",
    border: "none",
    cursor: "pointer",
    padding: 0,
    fontSize: 13,
    transition: "color 0.2s ease",
  },
};
