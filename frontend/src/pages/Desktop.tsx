import {
  useEffect,
  useMemo,
  useRef,
  useState,
  useCallback,
  ComponentType,
} from "react";
import { useNavigate } from "react-router-dom";
import { routes, RouteConfig } from "../router/routes";

// Authors data for the Authors window
interface Author {
  name: string;
  affiliation: string;
  photo: string;
  profileUrl: string;
}

const authorsData: Author[] = [
  {
    name: "Matheus Kunzler Maldaner",
    affiliation: "University of Florida",
    photo: "/author-photos/matheus.jpeg",
    profileUrl: "https://matheuskunzler.com",
  },
  {
    name: "Adam Fourney",
    affiliation: "Microsoft Research",
    photo: "/author-photos/adam.png",
    profileUrl: "https://www.adamfourney.com",
  },
  {
    name: "Amanda Swearngin",
    affiliation: "Microsoft Research",
    photo: "/author-photos/amanda.png",
    profileUrl: "https://amaswea.github.io",
  },
  {
    name: "Hussein Mozannar",
    affiliation: "Microsoft Research",
    photo: "/author-photos/hussein.png",
    profileUrl: "https://husseinmozannar.github.io",
  },
  {
    name: "Gagan Bansal",
    affiliation: "Microsoft Research",
    photo: "/author-photos/gagan.png",
    profileUrl: "https://homes.cs.washington.edu/~bansalg/",
  },
  {
    name: "Maya Murad",
    affiliation: "Microsoft Research",
    photo: "/author-photos/maya.png",
    profileUrl: "https://www.mayamurad.com",
  },
];

interface IconVariant {
  path: string;
  title: string;
  component: ComponentType;
}

interface DesktopIcon {
  id: string;
  title: string;
  baseTask: string;
  emoji: string;
  variants: IconVariant[];
}

const ICON_STORAGE_KEY = "xpDesktopIconPositions";
const INFO_ICON_ID = "sentinel-info";
const AUTHORS_ICON_ID = "authors";
const CITATION_ICON_ID = "citation";
const PAPER_ICON_ID = "paper";
const LEADERBOARD_ICON_ID = "leaderboard";
const RIGHT_SIDE_ICON_IDS: readonly string[] = [INFO_ICON_ID, CITATION_ICON_ID, PAPER_ICON_ID, LEADERBOARD_ICON_ID, AUTHORS_ICON_ID];

const ICON_HEIGHT_BASE = 88;
const ICON_WIDTH_BASE = 88;
const ICON_VERTICAL_GAP_BASE = 18;
const ICON_HORIZONTAL_GAP_BASE = 28;
const pixelIconPalette: Record<
  string,
  { background: string; accent: string; glyph: string }
> = {
  microchat: { background: "#464775", accent: "#b4c0ff", glyph: "💬" },
  microscholar: { background: "#0b5394", accent: "#b4c7e7", glyph: "🎓" },
  microlendar: { background: "#a61c3c", accent: "#ffe4e1", glyph: "📅" },
  micromail: { background: "#00578a", accent: "#9ad7ff", glyph: "✉" },
  "leaderboard": { background: "#dc2626", accent: "#fca5a5", glyph: "LB" },
};

type IconPositions = Record<string, { x: number; y: number }>;

const assetBase = `${import.meta.env.BASE_URL}desktop/`;
const wallpaperUrl = `${assetBase}xp-wallpaper.jpg`;

const iconAssetMap: Record<string, string> = {
  micromail: `${assetBase}micromail-icon.png`,
  microchat: `${assetBase}teams-icon.png`,
  microdin: `${assetBase}microdin-icon.png`,
  microfy: `${assetBase}microfy-icon.png`,
  microgram: `${assetBase}microgram-icon.png`,
  microhood: `${assetBase}microhood-icon.png`,
  microhub: `${assetBase}github-icon.png`,
  microlendar: `${assetBase}microlendar-icon.png`,
  microscholar: `${assetBase}microscholar-icon.png`,
  microtube: `${assetBase}microtube-icon.png`,
  authors: `${assetBase}authors-icon.png`,
  citation: `${assetBase}citations-icon.png`,
  paper: `${assetBase}pdf-icon.png`,
  leaderboard: `${assetBase}leaderboard-icon.png`,
};

const Desktop = () => {
  const navigate = useNavigate();
  const desktopRef = useRef<HTMLDivElement | null>(null);
  const startMenuWrapperRef = useRef<HTMLDivElement | null>(null);
  const infoWindowRef = useRef<HTMLDivElement | null>(null);
  const [infoWindowOpen, setInfoWindowOpen] = useState(false);
  const [isInfoMaximized, setIsInfoMaximized] = useState(false);
  const [infoWindowPosition, setInfoWindowPosition] = useState<{ x: number; y: number } | null>(null);
  const [authorsWindowOpen, setAuthorsWindowOpen] = useState(false);
  const [isAuthorsMaximized, setIsAuthorsMaximized] = useState(false);
  const [authorsWindowPosition, setAuthorsWindowPosition] = useState<{ x: number; y: number } | null>(null);
  const [citationWindowOpen, setCitationWindowOpen] = useState(false);
  const [isCitationMaximized, setIsCitationMaximized] = useState(false);
  const [citationWindowPosition, setCitationWindowPosition] = useState<{ x: number; y: number } | null>(null);
  const [activeCitationFormat, setActiveCitationFormat] = useState<"bibtex" | "apa" | "mla" | "chicago">("bibtex");

  // Leaderboard state
  const [leaderboardWindowOpen, setLeaderboardWindowOpen] = useState(false);
  const [isLeaderboardMaximized, setIsLeaderboardMaximized] = useState(false);
  const [leaderboardWindowPosition, setLeaderboardWindowPosition] = useState<{ x: number; y: number } | null>(null);
  const [showHelpModal, setShowHelpModal] = useState(false);
  const [leaderboardFilter, setLeaderboardFilter] = useState<"all" | "duration" | "environment" | "criteria" | "activity">("all");
  const [iconPositions, setIconPositions] = useState<IconPositions>({});
  const [selectedIcon, setSelectedIcon] = useState<string | null>(null);
  const [selectedIcons, setSelectedIcons] = useState<Set<string>>(new Set());
  const [clockValue, setClockValue] = useState(() => new Date());
  const [startMenuOpen, setStartMenuOpen] = useState(false);

  // Window minimized states for taskbar
  const [infoWindowMinimized, setInfoWindowMinimized] = useState(false);
  const [authorsWindowMinimized, setAuthorsWindowMinimized] = useState(false);
  const [citationWindowMinimized, setCitationWindowMinimized] = useState(false);
  const [leaderboardWindowMinimized, setLeaderboardWindowMinimized] = useState(false);

  // Context menu state
  type ContextMenuItem = {
    label: string;
    icon?: string;
    onClick: () => void;
    disabled?: boolean;
    divider?: false;
  } | {
    divider: true;
    label?: never;
    icon?: never;
    onClick?: never;
    disabled?: never;
  };
  const [contextMenu, setContextMenu] = useState<{
    x: number;
    y: number;
    items: ContextMenuItem[];
  } | null>(null);

  // Icon renaming state
  const [renamingIconId, setRenamingIconId] = useState<string | null>(null);
  const [iconCustomNames, setIconCustomNames] = useState<Record<string, string>>(() => {
    const saved = localStorage.getItem('xpIconCustomNames');
    return saved ? JSON.parse(saved) : {};
  });

  // BSOD Easter Egg state
  const [showBSOD, setShowBSOD] = useState(false);

  // Screensaver state
  const [showScreensaver, setShowScreensaver] = useState(false);
  const lastActivityRef = useRef(Date.now());
  const SCREENSAVER_TIMEOUT = 60000; // 1 minute of inactivity

  // Selection rectangle state
  const [selectionRect, setSelectionRect] = useState<{ startX: number; startY: number; currentX: number; currentY: number } | null>(null);
  const isSelectingRef = useRef(false);


  const iconScale = 1.2;
  const iconHeight = ICON_HEIGHT_BASE * iconScale;
  const iconWidth = ICON_WIDTH_BASE * iconScale;
  const iconVerticalGap = ICON_VERTICAL_GAP_BASE * iconScale;
  const iconHorizontalGap = ICON_HORIZONTAL_GAP_BASE * iconScale;

  const iconButtonWidthClass = "w-28";
  const iconArtSizeClass = "w-20 h-20";
  const iconShellSizeClass = "w-20 h-20 rounded-lg";
  const iconGlyphTextClass = "text-white text-lg";
  const iconLabelTextClass = "text-sm";

  const visibleTaskRoutes = useMemo(() => {
    return routes.filter(
      (route) =>
        route.tags?.includes("sentinel") &&
        route.component !== null &&
        route.category === "environment"
    );
  }, []);

  // Window registry for taskbar
  const openWindows = useMemo(() => {
    const windows: {
      id: string;
      title: string;
      icon: string;
      isMinimized: boolean;
      restore: () => void;
      minimize: () => void;
      close: () => void;
    }[] = [];

    if (infoWindowOpen) {
      windows.push({
        id: 'info',
        title: 'Information',
        icon: 'info-icon.png',
        isMinimized: infoWindowMinimized,
        restore: () => setInfoWindowMinimized(false),
        minimize: () => setInfoWindowMinimized(true),
        close: () => { setInfoWindowOpen(false); setInfoWindowMinimized(false); }
      });
    }
    if (authorsWindowOpen) {
      windows.push({
        id: 'authors',
        title: 'Authors',
        icon: 'authors-icon.png',
        isMinimized: authorsWindowMinimized,
        restore: () => setAuthorsWindowMinimized(false),
        minimize: () => setAuthorsWindowMinimized(true),
        close: () => { setAuthorsWindowOpen(false); setAuthorsWindowMinimized(false); }
      });
    }
    if (citationWindowOpen) {
      windows.push({
        id: 'citation',
        title: 'Cite',
        icon: 'citations-icon.png',
        isMinimized: citationWindowMinimized,
        restore: () => setCitationWindowMinimized(false),
        minimize: () => setCitationWindowMinimized(true),
        close: () => { setCitationWindowOpen(false); setCitationWindowMinimized(false); }
      });
    }
    if (leaderboardWindowOpen) {
      windows.push({
        id: 'leaderboard',
        title: 'Leaderboard',
        icon: 'leaderboard-icon.png',
        isMinimized: leaderboardWindowMinimized,
        restore: () => setLeaderboardWindowMinimized(false),
        minimize: () => setLeaderboardWindowMinimized(true),
        close: () => { setLeaderboardWindowOpen(false); setLeaderboardWindowMinimized(false); }
      });
    }

    return windows;
  }, [
    infoWindowOpen, infoWindowMinimized,
    authorsWindowOpen, authorsWindowMinimized,
    citationWindowOpen, citationWindowMinimized,
    leaderboardWindowOpen, leaderboardWindowMinimized
  ]);

  // Icon renaming helpers
  const startRenaming = useCallback((iconId: string) => {
    setRenamingIconId(iconId);
  }, []);

  const finishRenaming = useCallback((iconId: string, newName: string) => {
    if (newName.trim()) {
      setIconCustomNames(prev => ({ ...prev, [iconId]: newName.trim() }));
    }
    setRenamingIconId(null);
  }, []);

  const getIconDisplayName = useCallback((icon: DesktopIcon) => {
    return iconCustomNames[icon.id] || icon.title;
  }, [iconCustomNames]);

  const desktopIcons: DesktopIcon[] = useMemo(() => {
    const infoIcon: DesktopIcon = {
      id: INFO_ICON_ID,
      title: "Sentinel Info",
      baseTask: INFO_ICON_ID,
      emoji: "ℹ️",
      variants: [],
    };

    const authorsIcon: DesktopIcon = {
      id: AUTHORS_ICON_ID,
      title: "Authors",
      baseTask: AUTHORS_ICON_ID,
      emoji: "👥",
      variants: [],
    };

    const citationIcon: DesktopIcon = {
      id: CITATION_ICON_ID,
      title: "Cite",
      baseTask: CITATION_ICON_ID,
      emoji: "📝",
      variants: [],
    };

    const paperIcon: DesktopIcon = {
      id: PAPER_ICON_ID,
      title: "Paper",
      baseTask: PAPER_ICON_ID,
      emoji: "📄",
      variants: [],
    };

    const leaderboardIcon: DesktopIcon = {
      id: LEADERBOARD_ICON_ID,
      title: "Leaderboard",
      baseTask: LEADERBOARD_ICON_ID,
      emoji: "🏆",
      variants: [],
    };

    const grouped = new Map<string, RouteConfig[]>();

    visibleTaskRoutes.forEach((task) => {
      const key = task.base_task || task.path;
      if (!grouped.has(key)) {
        grouped.set(key, []);
      }
      grouped.get(key)!.push(task);
    });

    const mappedIcons: DesktopIcon[] = [];

    Array.from(grouped.entries()).forEach(([baseTask, variants]) => {
      if (variants.length > 1) {
        variants.forEach((variant) => {
          mappedIcons.push({
            id: variant.id ?? variant.path,
            title: variant.title,
            baseTask: variant.base_task || variant.path,
            emoji: variant.icon,
            variants: [
              {
                path: variant.url
                  ? variant.url.replace("{base_url}", "")
                  : `/${variant.path}`,
                title: variant.title,
                component: variant.component! as ComponentType,
              },
            ],
          });
        });
        return;
      }

      const main = variants[0];
      const displayTitle = main.title;
      mappedIcons.push({
        id: baseTask,
        title: displayTitle,
        baseTask,
        emoji: main.icon,
        variants: variants.map((variant) => ({
          path: variant.url ? variant.url.replace("{base_url}", "") : `/${variant.path}`,
          title: variant.title,
          component: variant.component! as ComponentType,
        })),
      });
    });

    return [infoIcon, citationIcon, paperIcon, leaderboardIcon, ...mappedIcons, authorsIcon];
  }, [visibleTaskRoutes]);

  const getDefaultPosition = useCallback((index: number, iconId?: string) => {
    const vw = window.innerWidth;
    const vh = window.innerHeight;
    const rightX = Math.max(vw - iconWidth - 60, iconWidth + 60);
    const taskbarHeight = 70; // approximate taskbar height at bottom

    // Position right-side icons using same column-wrapping logic
    if (iconId && RIGHT_SIDE_ICON_IDS.includes(iconId)) {
      const rightIndex = RIGHT_SIDE_ICON_IDS.indexOf(iconId);
      const availableHeight = vh - 100 - taskbarHeight;
      const iconsPerCol = Math.max(1, Math.floor(availableHeight / (iconHeight + iconVerticalGap)));
      const col = Math.floor(rightIndex / iconsPerCol);
      const row = rightIndex % iconsPerCol;
      return {
        x: rightX - col * (iconWidth + iconHorizontalGap),
        y: 100 + row * (iconHeight + iconVerticalGap),
      };
    }

    // Calculate left-side index by excluding right-side icons
    const leftIcons = desktopIcons.filter(
      (icon) => !RIGHT_SIDE_ICON_IDS.includes(icon.id)
    );
    const leftIndex = leftIcons.findIndex((icon) => icon.id === iconId);
    const adjustedIndex = leftIndex !== -1 ? leftIndex : index;

    // Compute how many icons fit in a column based on viewport height
    const availableHeight = vh - 100 - taskbarHeight; // top offset 100 + taskbar
    const iconsPerColumn = Math.max(1, Math.floor(availableHeight / (iconHeight + iconVerticalGap)));
    const column = Math.floor(adjustedIndex / iconsPerColumn);
    const row = adjustedIndex % iconsPerColumn;
    return {
      x: 40 + column * (iconWidth + iconHorizontalGap),
      y: 100 + row * (iconHeight + iconVerticalGap),
    };
  }, [desktopIcons, iconHeight, iconHorizontalGap, iconVerticalGap, iconWidth]);

  useEffect(() => {
    const stored = localStorage.getItem(ICON_STORAGE_KEY);
    if (stored) {
      try {
        const parsed = JSON.parse(stored) as IconPositions;
        setIconPositions(parsed);
      } catch {
        // ignore malformed storage
      }
    }
  }, []);

  useEffect(() => {
    if (Object.keys(iconPositions).length) {
      localStorage.setItem(ICON_STORAGE_KEY, JSON.stringify(iconPositions));
    }
  }, [iconPositions]);

  useEffect(() => {
    const id = window.setInterval(() => {
      setClockValue(new Date());
    }, 1000 * 15);
    return () => window.clearInterval(id);
  }, []);

  useEffect(() => {
    if (!desktopIcons.length) return;
    setIconPositions((prev) => {
      const next = { ...prev };
      let changed = false;
      desktopIcons.forEach((icon, index) => {
        if (!next[icon.id]) {
          next[icon.id] = getDefaultPosition(index, icon.id);
          changed = true;
        }
      });
      return changed ? next : prev;
    });
  }, [desktopIcons, getDefaultPosition]);

  // Re-layout icon positions when the window is resized so icons don't overlap
  useEffect(() => {
    const handleResize = () => {
      if (!desktopIcons.length) return;

      setIconPositions(() => {
        const next: IconPositions = {};
        desktopIcons.forEach((icon, index) => {
          next[icon.id] = getDefaultPosition(index, icon.id);
        });
        return next;
      });
    };

    window.addEventListener("resize", handleResize);
    // Also re-layout once on mount in case positions were saved from a different screen size
    handleResize();
    return () => window.removeEventListener("resize", handleResize);
  }, [iconWidth, iconHeight, desktopIcons, getDefaultPosition]);

  // Persist icon custom names
  useEffect(() => {
    if (Object.keys(iconCustomNames).length) {
      localStorage.setItem('xpIconCustomNames', JSON.stringify(iconCustomNames));
    }
  }, [iconCustomNames]);

  // Close context menu on click outside
  useEffect(() => {
    if (!contextMenu) return;
    const handleClick = () => setContextMenu(null);
    window.addEventListener('click', handleClick);
    return () => window.removeEventListener('click', handleClick);
  }, [contextMenu]);

  // Keyboard shortcuts (F2 for rename, Escape to cancel, Ctrl+Alt+Delete for BSOD)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // BSOD Easter Egg: Ctrl+Alt+Delete
      if (e.ctrlKey && e.altKey && e.key === 'Delete') {
        e.preventDefault();
        setShowBSOD(true);
        return;
      }
      if (e.key === 'F2' && selectedIcon && !renamingIconId) {
        e.preventDefault();
        startRenaming(selectedIcon);
      }
      if (e.key === 'Escape') {
        if (showBSOD) {
          setShowBSOD(false);
        }
        if (showScreensaver) {
          setShowScreensaver(false);
        }
        if (renamingIconId) {
          setRenamingIconId(null);
        }
        if (contextMenu) {
          setContextMenu(null);
        }
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [selectedIcon, renamingIconId, startRenaming, contextMenu, showBSOD, showScreensaver]);

  // Screensaver idle detection
  useEffect(() => {
    const resetActivity = () => {
      lastActivityRef.current = Date.now();
      if (showScreensaver) {
        setShowScreensaver(false);
      }
    };

    const checkIdle = setInterval(() => {
      if (Date.now() - lastActivityRef.current > SCREENSAVER_TIMEOUT && !showScreensaver && !showBSOD) {
        setShowScreensaver(true);
      }
    }, 1000);

    window.addEventListener('mousemove', resetActivity);
    window.addEventListener('mousedown', resetActivity);
    window.addEventListener('keydown', resetActivity);

    return () => {
      clearInterval(checkIdle);
      window.removeEventListener('mousemove', resetActivity);
      window.removeEventListener('mousedown', resetActivity);
      window.removeEventListener('keydown', resetActivity);
    };
  }, [showScreensaver, showBSOD, SCREENSAVER_TIMEOUT]);

  const formatClock = useCallback(
    () =>
      clockValue.toLocaleTimeString([], {
        hour: "2-digit",
        minute: "2-digit",
      }),
    [clockValue]
  );

  const clampPosition = (
    x: number,
    y: number,
    bounds: DOMRect
  ): { x: number; y: number } => {
    const maxX = bounds.width - iconWidth - 16;
    const maxY = bounds.height - iconHeight - 70;
    return {
      x: Math.min(Math.max(16, x), maxX),
      y: Math.min(Math.max(16, y), maxY),
    };
  };

  // Check which icons are within the selection rectangle
  const getIconsInSelectionRect = useCallback((rect: { startX: number; startY: number; currentX: number; currentY: number }) => {
    const rectLeft = Math.min(rect.startX, rect.currentX);
    const rectRight = Math.max(rect.startX, rect.currentX);
    const rectTop = Math.min(rect.startY, rect.currentY);
    const rectBottom = Math.max(rect.startY, rect.currentY);

    const selected = new Set<string>();
    desktopIcons.forEach((icon) => {
      const pos = iconPositions[icon.id];
      if (!pos) return;

      // Icon bounds (approximate - icon is ~iconWidth x iconHeight)
      const iconLeft = pos.x;
      const iconRight = pos.x + iconWidth;
      const iconTop = pos.y;
      const iconBottom = pos.y + iconHeight;

      // Check if rectangles intersect
      if (rectLeft < iconRight && rectRight > iconLeft && rectTop < iconBottom && rectBottom > iconTop) {
        selected.add(icon.id);
      }
    });
    return selected;
  }, [desktopIcons, iconPositions, iconWidth, iconHeight]);

  const handleIconDoubleClick = (icon: DesktopIcon) => {
    if (icon.baseTask === INFO_ICON_ID) {
      setInfoWindowOpen(true);
      setInfoWindowPosition(null);
      setIsInfoMaximized(false);
      return;
    }

    if (icon.baseTask === AUTHORS_ICON_ID) {
      setAuthorsWindowOpen(true);
      setAuthorsWindowPosition(null);
      setIsAuthorsMaximized(false);
      return;
    }

    if (icon.baseTask === CITATION_ICON_ID) {
      setCitationWindowOpen(true);
      setCitationWindowPosition(null);
      setIsCitationMaximized(false);
      return;
    }

    if (icon.baseTask === PAPER_ICON_ID) {
      // TODO: Open paper PDF or link when available
      window.open("https://arxiv.org/", "_blank", "noopener,noreferrer");
      return;
    }

    if (icon.baseTask === LEADERBOARD_ICON_ID) {
      setLeaderboardWindowOpen(true);
      setLeaderboardWindowPosition(null);
      setIsLeaderboardMaximized(false);
      return;
    }

    navigate(icon.variants[0].path);
  };

  const startDrag = (
    event: React.MouseEvent<HTMLButtonElement, MouseEvent>,
    icon: DesktopIcon
  ) => {
    if (event.button !== 0) return;
    event.preventDefault();

    const bounds = desktopRef.current?.getBoundingClientRect();
    if (!bounds) return;

    // Check if we're dragging a multi-selected icon
    const isDraggingMultiple = selectedIcons.has(icon.id) && selectedIcons.size > 1;

    // Get all icons to drag (either just this one, or all selected)
    const iconsToDrag = isDraggingMultiple ? Array.from(selectedIcons) : [icon.id];

    // Store initial positions for all icons being dragged
    const initialPositions: Record<string, { x: number; y: number }> = {};
    iconsToDrag.forEach(iconId => {
      const iconIndex = desktopIcons.findIndex((item) => item.id === iconId);
      initialPositions[iconId] = iconPositions[iconId] || getDefaultPosition(iconIndex === -1 ? 0 : iconIndex, iconId);
    });

    // If not dragging multiple, set this as the single selected icon
    if (!isDraggingMultiple) {
      setSelectedIcon(icon.id);
      setSelectedIcons(new Set());
    }

    const startX = event.clientX;
    const startY = event.clientY;

    const handleMouseMove = (moveEvent: MouseEvent) => {
      const deltaX = moveEvent.clientX - startX;
      const deltaY = moveEvent.clientY - startY;

      setIconPositions((prev) => {
        const newPositions = { ...prev };
        iconsToDrag.forEach(iconId => {
          const initial = initialPositions[iconId];
          newPositions[iconId] = clampPosition(
            initial.x + deltaX,
            initial.y + deltaY,
            bounds
          );
        });
        return newPositions;
      });
    };

    const handleMouseUp = () => {
      window.removeEventListener("mousemove", handleMouseMove);
      window.removeEventListener("mouseup", handleMouseUp);
    };

    window.addEventListener("mousemove", handleMouseMove);
    window.addEventListener("mouseup", handleMouseUp);
  };

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        startMenuOpen &&
        startMenuWrapperRef.current &&
        !startMenuWrapperRef.current.contains(event.target as Node)
      ) {
        setStartMenuOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [startMenuOpen]);

  const resetIconLayout = () => {
    // Reset icon positions to defaults
    setIconPositions(() => {
      const defaults: IconPositions = {};
      desktopIcons.forEach((icon, index) => {
        defaults[icon.id] = getDefaultPosition(index, icon.id);
      });
      return defaults;
    });
    // Also reset custom icon names back to defaults
    setIconCustomNames({});
    localStorage.removeItem('xpIconCustomNames');
  };

  const closeInfoWindow = () => {
    setInfoWindowOpen(false);
    setIsInfoMaximized(false);
    setInfoWindowPosition(null);
  };

  useEffect(() => {
    if (
      infoWindowOpen &&
      !isInfoMaximized &&
      infoWindowPosition === null
    ) {
      const width = infoWindowRef.current?.offsetWidth || 520;
      const height = infoWindowRef.current?.offsetHeight || 360;
      setInfoWindowPosition(getCenteredWindowPosition(width, height));
    }
  }, [infoWindowOpen, isInfoMaximized, infoWindowPosition]);

  const infoWindowSizeClasses = isInfoMaximized
    ? "w-[92vw] max-w-[1000px] h-[80vh]"
    : "w-[520px]";
  const infoContentMaxHeight = isInfoMaximized
    ? "calc(80vh - 70px)"
    : "auto";
  const getCenteredWindowPosition = (width = 520, height = 360) => {
    const x = Math.max((window.innerWidth - width) / 2, 16);
    const y = Math.max((window.innerHeight - height) / 2, 32);
    return { x, y };
  };

  const paintSprite = (icon: DesktopIcon) => {
    const palette =
      pixelIconPalette[icon.baseTask] || {
        background: "#18407c",
        accent: "#5eb5f7",
        glyph: icon.title.slice(0, 2).toUpperCase(),
      };

    return {
      backgroundImage: `linear-gradient(135deg, ${palette.background} 0%, ${palette.accent} 100%)`,
      boxShadow:
        "inset -2px -2px 0 rgba(0,0,0,0.25), inset 2px 2px 0 rgba(255,255,255,0.35)",
    };
  };

  const renderIconArt = (icon: DesktopIcon) => {
    if (icon.baseTask === INFO_ICON_ID) {
      return (
        <img
          src={`${assetBase}info-icon.png`}
          alt="Sentinel Info"
          className={`${iconArtSizeClass} object-contain drop-shadow-[2px_2px_2px_rgba(0,0,0,0.35)] pointer-events-none select-none`}
          draggable={false}
        />
      );
    }

    const assetSrc = iconAssetMap[icon.baseTask];
    const shellClasses =
      `${iconShellSizeClass} border border-white/70 shadow-[2px_2px_4px_rgba(0,0,0,0.4)] flex items-center justify-center`;

    if (assetSrc) {
      return (
        <img
          src={assetSrc}
          alt={`${icon.title} icon`}
          className={`${iconArtSizeClass} object-contain drop-shadow-[2px_2px_2px_rgba(0,0,0,0.35)] pointer-events-none select-none`}
          draggable={false}
        />
      );
    }

    return (
      <div className={shellClasses} style={paintSprite(icon)}>
        <span className={`${iconGlyphTextClass} font-semibold drop-shadow-[1px_1px_0_rgba(0,0,0,0.8)]`}>
          {pixelIconPalette[icon.baseTask]?.glyph ||
            icon.title.slice(0, 2).toUpperCase()}
        </span>
      </div>
    );
  };

  return (
    <div
      ref={desktopRef}
      className="relative min-h-screen w-full overflow-hidden"
      style={{
        backgroundImage: `url(${wallpaperUrl})`,
        backgroundSize: "cover",
        backgroundPosition: "center",
        backgroundRepeat: "no-repeat",
        fontFamily: "Tahoma, 'Segoe UI', sans-serif",
      }}
      onContextMenu={(e) => {
        // Only show desktop context menu if clicking on the background
        if (e.target === e.currentTarget || (e.target as HTMLElement).closest('.z-10') === null) {
          e.preventDefault();
          setContextMenu({
            x: e.clientX,
            y: e.clientY,
            items: [
              { label: 'Refresh', icon: '🔄', onClick: () => window.location.reload() },
              { divider: true },
              { label: 'Reset Icon Layout', icon: '🗂️', onClick: resetIconLayout },
              { divider: true },
              { label: 'Properties', icon: '⚙️', onClick: () => setInfoWindowOpen(true) },
            ]
          });
        }
      }}
      onMouseDown={(e) => {
        // Start selection rectangle only on left click on desktop background (not on icons or windows)
        const target = e.target as HTMLElement;
        const isDesktopClick = e.button === 0 && (
          e.target === e.currentTarget ||
          target.closest('.relative.z-10.min-h-screen') === target.closest('.relative.z-10.min-h-screen') && !target.closest('button')
        );
        if (isDesktopClick && !target.closest('button') && !target.closest('.fixed')) {
          isSelectingRef.current = true;
          setSelectionRect({
            startX: e.clientX,
            startY: e.clientY,
            currentX: e.clientX,
            currentY: e.clientY,
          });
          setSelectedIcon(null);
          setSelectedIcons(new Set());
        }
      }}
      onMouseMove={(e) => {
        if (isSelectingRef.current && selectionRect) {
          const newRect = {
            ...selectionRect,
            currentX: e.clientX,
            currentY: e.clientY,
          };
          setSelectionRect(newRect);
          // Update selected icons based on rectangle
          setSelectedIcons(getIconsInSelectionRect(newRect));
        }
      }}
      onMouseUp={() => {
        if (isSelectingRef.current) {
          isSelectingRef.current = false;
          setSelectionRect(null);
          // Keep selectedIcons but clear the rectangle
        }
      }}
      onMouseLeave={() => {
        if (isSelectingRef.current) {
          isSelectingRef.current = false;
          setSelectionRect(null);
        }
      }}
    >
      <div className="absolute inset-0 bg-gradient-to-b from-transparent via-transparent to-[#020b29]/50 pointer-events-none" />

      <div className="relative z-10 min-h-screen pb-10">
        {desktopIcons.map((icon, index) => {
          const position =
            iconPositions[icon.id] || getDefaultPosition(index, icon.id);
          const isSelected = selectedIcon === icon.id || selectedIcons.has(icon.id);

          return (
            <button
              key={icon.id}
              className={`absolute flex flex-col items-center ${iconButtonWidthClass} focus:outline-none cursor-pointer select-none`}
              style={{
                left: position.x,
                top: position.y,
              }}
              onMouseDown={(event) => startDrag(event, icon)}
              onClick={() => {
                setSelectedIcon(icon.id);
                setSelectedIcons(new Set());
              }}
              onDoubleClick={() => handleIconDoubleClick(icon)}
              onContextMenu={(e) => {
                e.preventDefault();
                e.stopPropagation();
                setSelectedIcon(icon.id);
                setContextMenu({
                  x: e.clientX,
                  y: e.clientY,
                  items: [
                    { label: 'Open', onClick: () => handleIconDoubleClick(icon) },
                    { divider: true },
                    { label: 'Rename', onClick: () => startRenaming(icon.id) },
                  ]
                });
              }}
            >
              {renderIconArt(icon)}
              {renamingIconId === icon.id ? (
                <input
                  type="text"
                  autoFocus
                  defaultValue={getIconDisplayName(icon)}
                  onBlur={(e) => finishRenaming(icon.id, e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      finishRenaming(icon.id, e.currentTarget.value);
                    }
                    if (e.key === 'Escape') {
                      setRenamingIconId(null);
                    }
                  }}
                  onClick={(e) => e.stopPropagation()}
                  onMouseDown={(e) => e.stopPropagation()}
                  onDoubleClick={(e) => e.stopPropagation()}
                  className="mt-2 px-1 w-full text-center text-sm bg-white border border-[#0078d4] rounded outline-none text-black"
                />
              ) : (
                <span
                  className={`mt-2 px-2 text-center ${iconLabelTextClass} font-semibold leading-tight`}
                  style={{
                    color: isSelected ? "#fff" : "#f8f9ff",
                    textShadow:
                      "-1px 0 2px rgba(0,0,0,0.6), 0 1px 2px rgba(0,0,0,0.6)",
                    backgroundColor: isSelected ? "rgba(49,106,197,0.8)" : "transparent",
                    border: isSelected ? "1px dotted rgba(255,255,255,0.8)" : "none",
                  }}
                >
                  {getIconDisplayName(icon)}
                </span>
              )}
            </button>
          );
        })}
      </div>

      {/* XP Luna Taskbar */}
      <div className="absolute bottom-0 left-0 right-0 z-20">
        <div
          className="h-[30px] flex items-center"
          style={{
            background: 'linear-gradient(to bottom, #3168d5 0%, #4089e2 3%, #2f64c1 5%, #1941a5 95%, #0f2f7a 100%)',
            borderTop: '1px solid #5c9eff',
            boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.15)',
          }}
        >
          {/* Start Button */}
          <div className="relative" ref={startMenuWrapperRef}>
            <button
              onClick={() => setStartMenuOpen((prev) => !prev)}
              className="flex items-center gap-1.5 pl-2 pr-3 h-[30px] text-white font-bold text-sm italic tracking-wide"
              style={{
                background: startMenuOpen
                  ? 'linear-gradient(to bottom, #4ba544 0%, #3c9a3c 10%, #307443 50%, #286e30 100%)'
                  : 'linear-gradient(to bottom, #5cb85c 0%, #3c9a3c 3%, #388238 50%, #307443 100%)',
                borderRadius: '0 8px 8px 0',
                borderRight: '1px solid #2d6b2d',
                borderTop: '1px solid #6fc46f',
                borderBottom: '1px solid #1e4d1e',
                boxShadow: startMenuOpen
                  ? 'inset 0 1px 3px rgba(0,0,0,0.3)'
                  : 'inset 0 1px 0 rgba(255,255,255,0.3)',
                textShadow: '1px 1px 1px rgba(0,0,0,0.3)',
              }}
            >
              <svg className="w-4 h-4" viewBox="0 0 16 16" fill="none">
                <rect x="1" y="1" width="6" height="6" fill="#FF5F26" rx="1"/>
                <rect x="9" y="1" width="6" height="6" fill="#7FBA00" rx="1"/>
                <rect x="1" y="9" width="6" height="6" fill="#00A4EF" rx="1"/>
                <rect x="9" y="9" width="6" height="6" fill="#FFB900" rx="1"/>
              </svg>
              <span>start</span>
            </button>
            {startMenuOpen && (
              <div
                className="absolute bottom-[32px] left-0 overflow-hidden shadow-2xl"
                style={{
                  width: '380px',
                  borderRadius: '6px 6px 0 0',
                  border: '2px solid #1f3f7a',
                  borderBottom: '1px solid #1f3f7a',
                }}
              >
                {/* Header - Blue gradient */}
                <div
                  className="px-3 py-2 flex items-center gap-3"
                  style={{
                    background: 'linear-gradient(to bottom, #2f71cd 0%, #1c5ab8 50%, #1854af 100%)',
                    borderBottom: '1px solid #0a3c8a',
                  }}
                >
                  <span className="text-white font-bold text-lg" style={{ textShadow: '1px 1px 2px rgba(0,0,0,0.5)' }}>
                    Sentinel Environments
                  </span>
                </div>

                {/* Bottom bar */}
                <div
                  className="px-2 py-1.5 flex justify-end items-center gap-1"
                  style={{
                    background: 'linear-gradient(to bottom, #4178be 0%, #2e64a5 50%, #24569a 100%)',
                    borderTop: '1px solid #5c9eff',
                  }}
                >
                  <button
                    onClick={() => {
                      setStartMenuOpen(false);
                      if (confirm("Close the application?")) {
                        window.close();
                      }
                    }}
                    className="flex items-center gap-1.5 px-3 py-1 text-white text-xs font-medium rounded hover:bg-white/20 transition-colors"
                    style={{
                      background: 'linear-gradient(to bottom, #d66751 0%, #c74b33 50%, #b83d26 100%)',
                      border: '1px solid #8a2a18',
                      textShadow: '0 1px 1px rgba(0,0,0,0.3)',
                    }}
                  >
                    <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
                      <path d="M13 3h-2v10h2V3zm4.83 2.17l-1.42 1.42C17.99 7.86 19 9.81 19 12c0 3.87-3.13 7-7 7s-7-3.13-7-7c0-2.19 1.01-4.14 2.58-5.42L6.17 5.17C4.23 6.82 3 9.26 3 12c0 4.97 4.03 9 9 9s9-4.03 9-9c0-2.74-1.23-5.18-3.17-6.83z"/>
                    </svg>
                    Turn Off
                  </button>
                </div>
              </div>
            )}
          </div>
          {/* Quick Launch Separator */}
          <div className="mx-2 h-[22px] w-[2px] bg-gradient-to-r from-[#1a4199] to-[#4a8ae6]" />

          {/* Taskbar window buttons - icon only */}
          <div className="flex-1 flex items-center gap-0.5 px-1">
            {openWindows.map(win => (
              <button
                key={win.id}
                onClick={() => win.isMinimized ? win.restore() : win.minimize()}
                onContextMenu={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  setContextMenu({
                    x: e.clientX,
                    y: Math.min(e.clientY, window.innerHeight - 120),
                    items: [
                      { label: 'Restore', onClick: win.restore, disabled: !win.isMinimized },
                      { label: 'Minimize', onClick: win.minimize, disabled: win.isMinimized },
                      { divider: true },
                      { label: 'Close', onClick: win.close },
                    ]
                  });
                }}
                title={win.title}
                className="h-[24px] w-[24px] flex items-center justify-center transition-all"
                style={{
                  background: win.isMinimized
                    ? 'linear-gradient(to bottom, #2654a8 0%, #1e4590 50%, #163a7a 100%)'
                    : 'linear-gradient(to bottom, #3358b5 0%, #2a4ea5 50%, #163e95 100%)',
                  borderRadius: '2px',
                  border: '1px solid rgba(255,255,255,0.15)',
                  boxShadow: win.isMinimized
                    ? 'inset 0 1px 2px rgba(0,0,0,0.3)'
                    : 'inset 0 1px 0 rgba(255,255,255,0.2)',
                  opacity: win.isMinimized ? 0.7 : 1,
                }}
              >
                <img src={`${assetBase}${win.icon}`} alt={win.title} className="w-4 h-4" />
              </button>
            ))}
          </div>

          {/* System Tray Separator */}
          <div className="mx-1 h-[22px] w-[2px] bg-gradient-to-r from-[#1a4199] to-[#4a8ae6]" />

          {/* System Tray */}
          <div
            className="flex items-center gap-2 px-2 h-[24px] text-white text-xs"
            style={{
              background: 'linear-gradient(to bottom, #16adf0 0%, #1994dc 50%, #1580d9 100%)',
              borderRadius: '2px',
              border: '1px solid rgba(0,0,0,0.2)',
              boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.3)',
              textShadow: '0 1px 1px rgba(0,0,0,0.3)',
            }}
          >
            <span className="font-medium">EN</span>
            <span className="font-medium">{formatClock()}</span>
          </div>
        </div>
      </div>

      {infoWindowOpen && !infoWindowMinimized && (
        <div className="fixed inset-0 z-50">
          <div
            className="absolute inset-0 bg-[rgba(7,13,37,0.55)]"
            onClick={closeInfoWindow}
          />
          <div
            ref={infoWindowRef}
            className={`absolute ${infoWindowSizeClasses} bg-[#f5f2e9] border-2 border-[#0046ad] rounded-md shadow-2xl font-[Tahoma] text-sm flex flex-col`}
            style={
              isInfoMaximized
                ? { left: "50%", top: "50%", transform: "translate(-50%, -50%)" }
                : infoWindowPosition
                ? {
                    left: infoWindowPosition.x,
                    top: infoWindowPosition.y,
                  }
                : { left: "50%", top: "50%", transform: "translate(-50%, -50%)" }
            }
          >
            <div
              className={`bg-gradient-to-r from-[#0a5ad4] to-[#0f7df5] text-white flex items-center justify-between px-4 py-2 rounded-t select-none ${
                isInfoMaximized ? "" : "cursor-move"
              }`}
              onDoubleClick={() => setIsInfoMaximized((prev) => !prev)}
              onMouseDown={(event) => {
                if (isInfoMaximized) return;
                event.preventDefault();
                const initialPosition =
                  infoWindowPosition ||
                  getCenteredWindowPosition(
                    infoWindowRef.current?.offsetWidth,
                    infoWindowRef.current?.offsetHeight
                  );
                const startX = event.clientX;
                const startY = event.clientY;
                const handleMove = (moveEvent: MouseEvent) => {
                  const deltaX = moveEvent.clientX - startX;
                  const deltaY = moveEvent.clientY - startY;
                  const width = infoWindowRef.current?.offsetWidth || 520;
                  const height = infoWindowRef.current?.offsetHeight || 360;
                  const maxX = window.innerWidth - width - 8;
                  const maxY = window.innerHeight - height - 8;
                  setInfoWindowPosition({
                    x: Math.min(Math.max(8, initialPosition.x + deltaX), maxX),
                    y: Math.min(Math.max(24, initialPosition.y + deltaY), maxY),
                  });
                };
                const stopDrag = () => {
                  window.removeEventListener("mousemove", handleMove);
                  window.removeEventListener("mouseup", stopDrag);
                };
                window.addEventListener("mousemove", handleMove);
                window.addEventListener("mouseup", stopDrag);
              }}
            >
              <div className="flex items-center gap-2 font-semibold">
                <span>Information</span>
              </div>
              <div className="flex items-center gap-1 text-xs">
                <button
                  onClick={() => setInfoWindowMinimized(true)}
                  className="w-6 h-6 flex items-center justify-center bg-[#0d63de] border border-white/40 text-white font-bold"
                  aria-label="Minimize"
                >
                  _
                </button>
                <button
                  onClick={() => setIsInfoMaximized((prev) => !prev)}
                  className="w-6 h-6 flex items-center justify-center bg-[#0d63de] border border-white/40 text-white font-bold"
                  aria-label={isInfoMaximized ? "Restore" : "Maximize"}
                >
                  □
                </button>
                <button
                  onClick={closeInfoWindow}
                  className="w-6 h-6 flex items-center justify-center bg-[#cf1b1b] border border-white/40 text-white font-bold"
                  aria-label="Close"
                >
                  ×
                </button>
              </div>
            </div>
            <div
              className="flex gap-4 px-5 py-4 overflow-y-auto"
              style={{ maxHeight: infoContentMaxHeight }}
            >
              <img
                src={`${assetBase}info-icon.png`}
                alt="Info badge"
                className="w-12 h-12"
                draggable={false}
              />
              <div>
                <h2 className="text-lg font-semibold text-[#1b3e8b] mb-2">
                  Welcome to Sentinel Environments!
                </h2>
                <p className="mb-3 leading-relaxed text-[#3b3b3b]">
                  This benchmark evaluates AI agents on{" "}
                  <em>long-horizon monitoring tasks</em>. It provides{" "}
                  <strong>10 web-app replicas</strong> (Micro* environments),
                  each with <strong>20 task variants</strong> configurable to any duration.
                </p>
                <p className="mb-3 text-[#3b3b3b]">
                  Tasks are defined as scenario JSON files with timed events, a natural-language
                  prompt, and an <code>eval_sql</code> query. The eval harness discovers
                  scenarios and runs them against an agent subprocess.
                </p>
                <p className="mb-3 text-[#3b3b3b]">
                  All tasks are <strong>time-based</strong>--the condition becomes satisfiable
                  exactly at the specified duration. The harness evaluates
                  success via SQL when the agent completes.
                </p>
                <p className="text-[#6b6b6b] text-xs italic">
                  This work started during an Undergraduate Research Internship at
                  Microsoft Research with the AI Frontiers team.
                </p>
              </div>
            </div>
          </div>
        </div>
      )}
      {authorsWindowOpen && !authorsWindowMinimized && (
        <div className="fixed inset-0 z-50">
          <div
            className="absolute inset-0 bg-[rgba(7,13,37,0.55)]"
            onClick={() => {
              setAuthorsWindowOpen(false);
              setIsAuthorsMaximized(false);
              setAuthorsWindowPosition(null);
            }}
          />
          <div
            className={`absolute ${isAuthorsMaximized ? "w-[92vw] max-w-[1000px] h-[80vh]" : "w-[700px]"} bg-[#f5f2e9] border-2 border-[#0046ad] rounded-md shadow-2xl font-[Tahoma] text-sm flex flex-col`}
            style={
              isAuthorsMaximized
                ? { left: "50%", top: "50%", transform: "translate(-50%, -50%)" }
                : authorsWindowPosition
                ? { left: authorsWindowPosition.x, top: authorsWindowPosition.y }
                : { left: "50%", top: "50%", transform: "translate(-50%, -50%)" }
            }
          >
            <div
              className={`bg-gradient-to-r from-[#0a5ad4] to-[#0f7df5] text-white flex items-center justify-between px-4 py-2 rounded-t select-none ${
                isAuthorsMaximized ? "" : "cursor-move"
              }`}
              onDoubleClick={() => setIsAuthorsMaximized((prev) => !prev)}
              onMouseDown={(event) => {
                if (isAuthorsMaximized) return;
                event.preventDefault();
                const initialPosition = authorsWindowPosition || {
                  x: window.innerWidth / 2 - 350,
                  y: window.innerHeight / 2 - 250,
                };
                const startX = event.clientX;
                const startY = event.clientY;
                const handleMove = (moveEvent: MouseEvent) => {
                  const deltaX = moveEvent.clientX - startX;
                  const deltaY = moveEvent.clientY - startY;
                  const width = 700;
                  const height = 500;
                  const maxX = window.innerWidth - width - 8;
                  const maxY = window.innerHeight - height - 8;
                  setAuthorsWindowPosition({
                    x: Math.min(Math.max(8, initialPosition.x + deltaX), maxX),
                    y: Math.min(Math.max(24, initialPosition.y + deltaY), maxY),
                  });
                };
                const stopDrag = () => {
                  window.removeEventListener("mousemove", handleMove);
                  window.removeEventListener("mouseup", stopDrag);
                };
                window.addEventListener("mousemove", handleMove);
                window.addEventListener("mouseup", stopDrag);
              }}
            >
              <div className="flex items-center gap-2 font-semibold">
                <span>Authors</span>
              </div>
              <div className="flex items-center gap-1 text-xs">
                <button
                  onClick={() => setAuthorsWindowMinimized(true)}
                  className="w-6 h-6 flex items-center justify-center bg-[#0d63de] border border-white/40 text-white font-bold"
                  aria-label="Minimize"
                >
                  _
                </button>
                <button
                  onClick={() => setIsAuthorsMaximized((prev) => !prev)}
                  className="w-6 h-6 flex items-center justify-center bg-[#0d63de] border border-white/40 text-white font-bold"
                  aria-label={isAuthorsMaximized ? "Restore" : "Maximize"}
                >
                  □
                </button>
                <button
                  onClick={() => {
                    setAuthorsWindowOpen(false);
                    setIsAuthorsMaximized(false);
                    setAuthorsWindowPosition(null);
                  }}
                  className="w-6 h-6 flex items-center justify-center bg-[#cf1b1b] border border-white/40 text-white font-bold"
                  aria-label="Close"
                >
                  ×
                </button>
              </div>
            </div>
            <div className="flex flex-col gap-4 px-6 py-5 overflow-y-auto">
              <div className="grid grid-cols-3 gap-6">
                {authorsData.map((author) => (
                  <button
                    key={author.name}
                    onClick={() => window.open(author.profileUrl, "_blank", "noopener,noreferrer")}
                    className="flex flex-col items-center gap-3 p-4 rounded-lg hover:bg-[#e8e5dc] transition-colors cursor-pointer group"
                  >
                    <div className="w-24 h-24 rounded-full overflow-hidden border-2 border-[#0046ad]/30 group-hover:border-[#0046ad] transition-colors shadow-md">
                      <img
                        src={author.photo}
                        alt={author.name}
                        className="w-full h-full object-cover"
                        onError={(e) => {
                          const target = e.target as HTMLImageElement;
                          target.style.display = "none";
                          const parent = target.parentElement;
                          if (parent) {
                            parent.classList.add("bg-gradient-to-br", "from-[#0a5ad4]", "to-[#0f7df5]", "flex", "items-center", "justify-center");
                            const initials = author.name.split(" ").map(n => n[0]).join("");
                            const span = document.createElement("span");
                            span.className = "text-white text-2xl font-bold";
                            span.textContent = initials;
                            parent.appendChild(span);
                          }
                        }}
                      />
                    </div>
                    <div className="text-center">
                      <p className="font-semibold text-[#1b3e8b] group-hover:underline">
                        {author.name}
                      </p>
                      <p className="text-xs text-gray-600 mt-1">
                        {author.affiliation}
                      </p>
                    </div>
                  </button>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}
      {citationWindowOpen && !citationWindowMinimized && (
        <div className="fixed inset-0 z-50">
          <div
            className="absolute inset-0 bg-[rgba(7,13,37,0.55)]"
            onClick={() => {
              setCitationWindowOpen(false);
              setIsCitationMaximized(false);
              setCitationWindowPosition(null);
            }}
          />
          <div
            className={`absolute ${isCitationMaximized ? "w-[92vw] max-w-[1000px] h-[80vh]" : "w-[650px]"} bg-[#f5f2e9] border-2 border-[#0046ad] rounded-md shadow-2xl font-[Tahoma] text-sm flex flex-col`}
            style={
              isCitationMaximized
                ? { left: "50%", top: "50%", transform: "translate(-50%, -50%)" }
                : citationWindowPosition
                ? { left: citationWindowPosition.x, top: citationWindowPosition.y }
                : { left: "50%", top: "50%", transform: "translate(-50%, -50%)" }
            }
          >
            <div
              className={`bg-gradient-to-r from-[#0a5ad4] to-[#0f7df5] text-white flex items-center justify-between px-4 py-2 rounded-t select-none ${
                isCitationMaximized ? "" : "cursor-move"
              }`}
              onDoubleClick={() => setIsCitationMaximized((prev) => !prev)}
              onMouseDown={(event) => {
                if (isCitationMaximized) return;
                event.preventDefault();
                const initialPosition = citationWindowPosition || {
                  x: window.innerWidth / 2 - 325,
                  y: window.innerHeight / 2 - 200,
                };
                const startX = event.clientX;
                const startY = event.clientY;
                const handleMove = (moveEvent: MouseEvent) => {
                  const deltaX = moveEvent.clientX - startX;
                  const deltaY = moveEvent.clientY - startY;
                  const width = 650;
                  const height = 400;
                  const maxX = window.innerWidth - width - 8;
                  const maxY = window.innerHeight - height - 8;
                  setCitationWindowPosition({
                    x: Math.min(Math.max(8, initialPosition.x + deltaX), maxX),
                    y: Math.min(Math.max(24, initialPosition.y + deltaY), maxY),
                  });
                };
                const stopDrag = () => {
                  window.removeEventListener("mousemove", handleMove);
                  window.removeEventListener("mouseup", stopDrag);
                };
                window.addEventListener("mousemove", handleMove);
                window.addEventListener("mouseup", stopDrag);
              }}
            >
              <div className="flex items-center gap-2 font-semibold">
                <span>Cite Sentinel Environments</span>
              </div>
              <div className="flex items-center gap-1 text-xs">
                <button
                  onClick={() => setCitationWindowMinimized(true)}
                  className="w-6 h-6 flex items-center justify-center bg-[#0d63de] border border-white/40 text-white font-bold"
                  aria-label="Minimize"
                >
                  _
                </button>
                <button
                  onClick={() => setIsCitationMaximized((prev) => !prev)}
                  className="w-6 h-6 flex items-center justify-center bg-[#0d63de] border border-white/40 text-white font-bold"
                  aria-label={isCitationMaximized ? "Restore" : "Maximize"}
                >
                  □
                </button>
                <button
                  onClick={() => {
                    setCitationWindowOpen(false);
                    setIsCitationMaximized(false);
                    setCitationWindowPosition(null);
                  }}
                  className="w-6 h-6 flex items-center justify-center bg-[#cf1b1b] border border-white/40 text-white font-bold"
                  aria-label="Close"
                >
                  ×
                </button>
              </div>
            </div>
            <div className="flex flex-col gap-4 px-5 py-4 overflow-y-auto">
              <div className="flex gap-2 border-b border-gray-300 pb-2">
                {(["bibtex", "apa", "mla", "chicago"] as const).map((format) => (
                  <button
                    key={format}
                    onClick={() => setActiveCitationFormat(format)}
                    className={`px-3 py-1 rounded-t text-sm font-medium transition-colors ${
                      activeCitationFormat === format
                        ? "bg-[#0a5ad4] text-white"
                        : "bg-gray-200 text-gray-700 hover:bg-gray-300"
                    }`}
                  >
                    {format.toUpperCase()}
                  </button>
                ))}
              </div>
              <div className="bg-white border border-gray-300 rounded p-4 font-mono text-xs leading-relaxed">
                {activeCitationFormat === "bibtex" && (
                  <pre className="whitespace-pre-wrap">
{`@article{maldaner2026sentinelenvironments,
  title={Sentinel Environments: A Benchmark for Evaluating Agents on Long-Running Monitoring Tasks},
  author={Maldaner, Matheus Kunzler and Fourney, Adam and Swearngin, Amanda and Mozannar, Hussein and Bansal, Gagan and Murad, Maya},
  journal={arXiv preprint},
  year={2026}
}`}
                  </pre>
                )}
                {activeCitationFormat === "apa" && (
                  <p>
                    Maldaner, M. K., Fourney, A., Swearngin, A., Mozannar, H., Bansal, G., & Murad, M. (2026). Sentinel Environments: A Benchmark for Evaluating Agents on Long-Running Monitoring Tasks. <em>arXiv preprint</em>.
                  </p>
                )}
                {activeCitationFormat === "mla" && (
                  <p>
                    Maldaner, Matheus Kunzler, et al. "Sentinel Environments: A Benchmark for Evaluating Agents on Long-Running Monitoring Tasks." <em>arXiv preprint</em>, 2026.
                  </p>
                )}
                {activeCitationFormat === "chicago" && (
                  <p>
                    Maldaner, Matheus Kunzler, Adam Fourney, Amanda Swearngin, Hussein Mozannar, Gagan Bansal, and Maya Murad. "Sentinel Environments: A Benchmark for Evaluating Agents on Long-Running Monitoring Tasks." <em>arXiv preprint</em>, 2026.
                  </p>
                )}
              </div>
              <button
                onClick={() => {
                  const citations: Record<string, string> = {
                    bibtex: `@article{maldaner2026sentinelenvironments,
  title={Sentinel Environments: A Benchmark for Evaluating Agents on Long-Running Monitoring Tasks},
  author={Maldaner, Matheus Kunzler and Fourney, Adam and Swearngin, Amanda and Mozannar, Hussein and Bansal, Gagan and Murad, Maya},
  journal={arXiv preprint},
  year={2026}
}`,
                    apa: "Maldaner, M. K., Fourney, A., Swearngin, A., Mozannar, H., Bansal, G., & Murad, M. (2026). Sentinel Environments: A Benchmark for Evaluating Agents on Long-Running Monitoring Tasks. arXiv preprint.",
                    mla: 'Maldaner, Matheus Kunzler, et al. "Sentinel Environments: A Benchmark for Evaluating Agents on Long-Running Monitoring Tasks." arXiv preprint, 2026.',
                    chicago: 'Maldaner, Matheus Kunzler, Adam Fourney, Amanda Swearngin, Hussein Mozannar, Gagan Bansal, and Maya Murad. "Sentinel Environments: A Benchmark for Evaluating Agents on Long-Running Monitoring Tasks." arXiv preprint, 2026.',
                  };
                  navigator.clipboard.writeText(citations[activeCitationFormat]);
                }}
                className="self-end px-4 py-2 bg-[#0a5ad4] text-white rounded hover:bg-[#0848a8] transition-colors font-medium"
              >
                Copy to Clipboard
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Leaderboard Window */}
      {leaderboardWindowOpen && !leaderboardWindowMinimized && (
        <div className="fixed inset-0 z-50">
          <div
            className="absolute inset-0 bg-[rgba(7,13,37,0.55)]"
            onClick={() => {
              setLeaderboardWindowOpen(false);
              setIsLeaderboardMaximized(false);
              setLeaderboardWindowPosition(null);
            }}
          />
          <div
            className={`absolute ${isLeaderboardMaximized ? "w-[95vw] max-w-[1400px] h-[90vh]" : "w-[1000px] h-[650px]"} bg-[#f5f2e9] border-2 border-[#0046ad] rounded-md shadow-2xl font-[Tahoma] text-sm flex flex-col`}
            style={
              isLeaderboardMaximized
                ? { left: "50%", top: "50%", transform: "translate(-50%, -50%)" }
                : leaderboardWindowPosition
                ? { left: leaderboardWindowPosition.x, top: leaderboardWindowPosition.y }
                : { left: "50%", top: "50%", transform: "translate(-50%, -50%)" }
            }
          >
            {/* Title Bar */}
            <div
              className={`bg-gradient-to-r from-[#0a5ad4] to-[#0f7df5] text-white flex items-center justify-between px-4 py-2 rounded-t select-none ${
                isLeaderboardMaximized ? "" : "cursor-move"
              }`}
              onDoubleClick={() => setIsLeaderboardMaximized((prev) => !prev)}
              onMouseDown={(event) => {
                if (isLeaderboardMaximized) return;
                event.preventDefault();
                const initialPosition = leaderboardWindowPosition || {
                  x: window.innerWidth / 2 - 500,
                  y: window.innerHeight / 2 - 325,
                };
                const startX = event.clientX;
                const startY = event.clientY;
                const handleMove = (moveEvent: MouseEvent) => {
                  const deltaX = moveEvent.clientX - startX;
                  const deltaY = moveEvent.clientY - startY;
                  const width = 1000;
                  const height = 650;
                  const maxX = window.innerWidth - width - 8;
                  const maxY = window.innerHeight - height - 8;
                  setLeaderboardWindowPosition({
                    x: Math.min(Math.max(8, initialPosition.x + deltaX), maxX),
                    y: Math.min(Math.max(24, initialPosition.y + deltaY), maxY),
                  });
                };
                const stopDrag = () => {
                  window.removeEventListener("mousemove", handleMove);
                  window.removeEventListener("mouseup", stopDrag);
                };
                window.addEventListener("mousemove", handleMove);
                window.addEventListener("mouseup", stopDrag);
              }}
            >
              <div className="flex items-center gap-3 font-semibold">
                <span>Sentinel Environments Leaderboard</span>
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    setShowHelpModal(true);
                  }}
                  className="w-6 h-6 flex items-center justify-center bg-white/20 hover:bg-white/30 rounded-full text-white font-bold text-sm"
                  title="How to run and submit"
                >
                  ?
                </button>
              </div>
              <div className="flex items-center gap-1 text-xs">
                <button
                  onClick={() => setLeaderboardWindowMinimized(true)}
                  className="w-6 h-6 flex items-center justify-center bg-[#0d63de] border border-white/40 text-white font-bold"
                  aria-label="Minimize"
                >
                  _
                </button>
                <button
                  onClick={() => setIsLeaderboardMaximized((prev) => !prev)}
                  className="w-6 h-6 flex items-center justify-center bg-[#0d63de] border border-white/40 text-white font-bold"
                  aria-label={isLeaderboardMaximized ? "Restore" : "Maximize"}
                >
                  □
                </button>
                <button
                  onClick={() => {
                    setLeaderboardWindowOpen(false);
                    setIsLeaderboardMaximized(false);
                    setLeaderboardWindowPosition(null);
                  }}
                  className="w-6 h-6 flex items-center justify-center bg-[#cf1b1b] border border-white/40 text-white font-bold"
                  aria-label="Close"
                >
                  ×
                </button>
              </div>
            </div>

            {/* Content */}
            <div className="flex-1 overflow-hidden flex flex-col p-4">
              {/* Filter Tabs */}
              <div className="flex gap-2 mb-4 border-b border-gray-300 pb-2">
                {(["all", "duration", "environment", "criteria", "activity"] as const).map((filter) => (
                  <button
                    key={filter}
                    onClick={() => setLeaderboardFilter(filter)}
                    className={`px-3 py-1 rounded-t text-xs font-medium transition-colors capitalize ${
                      leaderboardFilter === filter
                        ? "bg-[#0a5ad4] text-white"
                        : "bg-gray-200 text-gray-700 hover:bg-gray-300"
                    }`}
                  >
                    {filter === "all" ? "Overall" : `By ${filter}`}
                  </button>
                ))}
              </div>

              {/* Empty State */}
              <div className="flex-1 flex flex-col items-center justify-center text-center px-8">
                {/* Trophy Illustration */}
                <div className="text-8xl mb-6 opacity-80">
                  <span role="img" aria-label="trophy">🏆</span>
                </div>

                <h2 className="text-2xl font-bold text-[#1b3e8b] mb-3">
                  No Submissions Yet
                </h2>

                <p className="text-gray-600 mb-6 max-w-md">
                  Be the first to benchmark your AI agent on Sentinel Environments!
                  Test your agent's ability to monitor, wait, and act on long-horizon tasks.
                </p>

                <div className="flex gap-3">
                  <button
                    onClick={() => setShowHelpModal(true)}
                    className="px-5 py-2 bg-[#0a5ad4] text-white rounded font-medium hover:bg-[#0848a8] transition-colors"
                  >
                    How to Participate
                  </button>
                </div>

                {/* What We'll Track */}
                <div className="mt-8 p-4 bg-blue-50 rounded-lg max-w-md">
                  <h3 className="text-sm font-semibold text-[#1b3e8b] mb-2">What We'll Track</h3>
                  <p className="text-xs text-gray-600">
                    Accuracy, Cost, Latency, and Number of Tool Calls
                  </p>
                </div>
              </div>

              {/* Footer */}
              <div className="mt-4 pt-3 border-t border-gray-300 flex items-center justify-between text-xs text-gray-500">
                <span>No submissions yet</span>
                <button
                  onClick={() => setShowHelpModal(true)}
                  className="px-3 py-1 bg-[#0a5ad4] text-white rounded hover:bg-[#0848a8] transition-colors"
                >
                  Submit Your Results
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Help Modal */}
      {showHelpModal && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center">
          <div
            className="absolute inset-0 bg-black/50"
            onClick={() => setShowHelpModal(false)}
          />
          <div className="relative bg-[#f5f2e9] border-2 border-[#0046ad] rounded-md shadow-2xl w-[700px] max-h-[80vh] overflow-hidden font-[Tahoma]">
            {/* Modal Title Bar */}
            <div className="bg-gradient-to-r from-[#0a5ad4] to-[#0f7df5] text-white flex items-center justify-between px-4 py-2">
              <span className="font-semibold">How to Run & Submit Results</span>
              <button
                onClick={() => setShowHelpModal(false)}
                className="w-6 h-6 flex items-center justify-center bg-[#cf1b1b] border border-white/40 text-white font-bold rounded-sm hover:bg-red-600"
              >
                ×
              </button>
            </div>

            {/* Modal Content */}
            <div className="p-6 overflow-y-auto max-h-[calc(80vh-50px)] text-sm">
              <div className="space-y-6">
                {/* Step 1 */}
                <div className="flex gap-4">
                  <div className="flex-shrink-0 w-8 h-8 bg-[#0a5ad4] text-white rounded-full flex items-center justify-center font-bold">1</div>
                  <div>
                    <h3 className="font-semibold text-[#1b3e8b] mb-1">Get Benchmark Tasks</h3>
                    <p className="text-gray-600 mb-2">
                      Download the benchmark task file from the Sentinel Environments repository.
                    </p>
                    <div className="bg-[#1e1e1e] text-[#4ec9b0] p-3 rounded font-mono text-xs">
                      {'{"task_id": "micromail-unread-absolute-passive-900", "url": "https://...", "description": "..."}'}
                    </div>
                  </div>
                </div>

                {/* Step 2 */}
                <div className="flex gap-4">
                  <div className="flex-shrink-0 w-8 h-8 bg-[#0a5ad4] text-white rounded-full flex items-center justify-center font-bold">2</div>
                  <div>
                    <h3 className="font-semibold text-[#1b3e8b] mb-1">Run Your Agent</h3>
                    <p className="text-gray-600 mb-2">
                      For each task in the JSONL file, navigate your agent to the URL and complete the monitoring task.
                      The harness evaluates success via SQL when the agent completes.
                    </p>
                    <div className="bg-yellow-50 border border-yellow-200 p-3 rounded text-xs">
                      <strong>Important:</strong> Tasks are time-based. The success condition becomes satisfiable exactly at the specified duration.
                      Your agent must wait and monitor until the condition is met.
                    </div>
                  </div>
                </div>

                {/* Step 3 */}
                <div className="flex gap-4">
                  <div className="flex-shrink-0 w-8 h-8 bg-[#0a5ad4] text-white rounded-full flex items-center justify-center font-bold">3</div>
                  <div>
                    <h3 className="font-semibold text-[#1b3e8b] mb-1">Collect Results</h3>
                    <p className="text-gray-600 mb-2">
                      For each task, record whether your agent succeeded along with metrics:
                    </p>
                    <ul className="list-disc list-inside text-gray-600 text-xs space-y-1 ml-2">
                      <li><strong>Success</strong> - Whether the task was completed successfully</li>
                      <li><strong>Latency</strong> - Time in seconds from task start to evaluation</li>
                      <li><strong>Tool Calls</strong> - Number of tool/action calls made by your agent</li>
                      <li><strong>Cost</strong> - Total API cost in USD for the task</li>
                    </ul>
                  </div>
                </div>

                {/* Step 4 */}
                <div className="flex gap-4">
                  <div className="flex-shrink-0 w-8 h-8 bg-[#0a5ad4] text-white rounded-full flex items-center justify-center font-bold">4</div>
                  <div>
                    <h3 className="font-semibold text-[#1b3e8b] mb-1">Submit Results</h3>
                    <p className="text-gray-600 mb-2">
                      Format your results as a JSON file and submit:
                    </p>
                    <div className="bg-[#1e1e1e] text-[#4ec9b0] p-3 rounded font-mono text-xs overflow-x-auto">
                      <pre>{`{
  "agent_name": "Your Agent Name",
  "organization": "Your Organization",
  "results": [
    {
      "task_id": "micromail-unread-absolute-passive-900",
      "success": true,
      "latency_s": 312,
      "tool_calls": 45,
      "cost_usd": 0.42
    },
    ...
  ]
}`}</pre>
                    </div>
                  </div>
                </div>

                {/* Metrics Explanation */}
                <div className="bg-blue-50 border border-blue-200 rounded p-4">
                  <h4 className="font-semibold text-[#1b3e8b] mb-2">Metrics We Track</h4>
                  <div className="grid grid-cols-2 gap-3 text-xs">
                    <div>
                      <strong>Accuracy</strong>
                      <p className="text-gray-600">% of tasks completed successfully</p>
                    </div>
                    <div>
                      <strong>Avg Latency</strong>
                      <p className="text-gray-600">Mean time to complete tasks successfully</p>
                    </div>
                    <div>
                      <strong>Avg Cost</strong>
                      <p className="text-gray-600">Mean API cost per task in USD</p>
                    </div>
                    <div>
                      <strong>Breakdowns</strong>
                      <p className="text-gray-600">Performance by duration, environment, criteria, activity</p>
                    </div>
                  </div>
                </div>

                {/* Submit CTA */}
                <div className="text-center pt-4 border-t border-gray-300">
                  <p className="text-gray-500 text-xs mb-3">
                    Ready to submit? Email your results to:
                  </p>
                  <a
                    href="mailto:sentinel-environments@example.com"
                    className="inline-block px-6 py-2 bg-[#0a5ad4] text-white rounded font-medium hover:bg-[#0848a8] transition-colors"
                  >
                    sentinel-environments@example.com
                  </a>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Context Menu */}
      {contextMenu && (
        <div
          className="fixed z-[100] min-w-[180px] bg-white border border-gray-400 shadow-lg py-1 rounded"
          style={{ left: contextMenu.x, top: contextMenu.y }}
          onClick={(e) => e.stopPropagation()}
        >
          {contextMenu.items.map((item, idx) =>
            item.divider ? (
              <div key={idx} className="border-t border-gray-300 my-1" />
            ) : (
              <button
                key={idx}
                onClick={() => { item.onClick(); setContextMenu(null); }}
                disabled={item.disabled}
                className="w-full px-4 py-1.5 text-left text-sm hover:bg-[#0078d4] hover:text-white disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
              >
                {item.icon && <span className="w-4 text-center">{item.icon}</span>}
                <span>{item.label}</span>
              </button>
            )
          )}
        </div>
      )}

      {/* Selection Rectangle */}
      {selectionRect && (
        <div
          className="fixed z-[5] pointer-events-none"
          style={{
            left: Math.min(selectionRect.startX, selectionRect.currentX),
            top: Math.min(selectionRect.startY, selectionRect.currentY),
            width: Math.abs(selectionRect.currentX - selectionRect.startX),
            height: Math.abs(selectionRect.currentY - selectionRect.startY),
            border: '1px dashed #316ac5',
            backgroundColor: 'rgba(49, 106, 197, 0.2)',
          }}
        />
      )}

      {/* Screensaver - Starfield */}
      {showScreensaver && (
        <div
          className="fixed inset-0 z-[200] bg-black cursor-none"
          onClick={() => setShowScreensaver(false)}
          onMouseMove={() => setShowScreensaver(false)}
        >
          <div className="absolute inset-0 overflow-hidden">
            {/* Animated stars */}
            {Array.from({ length: 100 }).map((_, i) => (
              <div
                key={i}
                className="absolute rounded-full bg-white"
                style={{
                  width: Math.random() * 3 + 1,
                  height: Math.random() * 3 + 1,
                  left: `${Math.random() * 100}%`,
                  top: `${Math.random() * 100}%`,
                  animation: `starMove ${Math.random() * 3 + 2}s linear infinite`,
                  animationDelay: `${Math.random() * 2}s`,
                  opacity: Math.random() * 0.8 + 0.2,
                }}
              />
            ))}
          </div>
          {/* Flying Windows logo */}
          <div
            className="absolute"
            style={{
              animation: 'flyingLogo 8s linear infinite',
            }}
          >
            <div className="grid grid-cols-2 gap-1 w-16 h-16">
              <div className="bg-gradient-to-br from-red-500 to-orange-600 rounded-tl-md" />
              <div className="bg-gradient-to-br from-green-500 to-green-600 rounded-tr-md" />
              <div className="bg-gradient-to-br from-blue-500 to-blue-600 rounded-bl-md" />
              <div className="bg-gradient-to-br from-yellow-400 to-yellow-500 rounded-br-md" />
            </div>
          </div>
          <style>{`
            @keyframes starMove {
              0% { transform: translateZ(0) scale(1); opacity: 0; }
              10% { opacity: 1; }
              90% { opacity: 1; }
              100% { transform: translateZ(200px) scale(2); opacity: 0; }
            }
            @keyframes flyingLogo {
              0% { left: -100px; top: 20%; }
              25% { left: 80%; top: 70%; }
              50% { left: 40%; top: 10%; }
              75% { left: 70%; top: 60%; }
              100% { left: -100px; top: 20%; }
            }
          `}</style>
          <div className="absolute bottom-8 left-1/2 transform -translate-x-1/2 text-white/50 text-sm">
            Move mouse or press any key to exit
          </div>
        </div>
      )}

      {/* BSOD Easter Egg */}
      {showBSOD && (
        <div
          className="fixed inset-0 z-[300] flex flex-col items-center justify-center select-none cursor-default"
          style={{ backgroundColor: '#0000aa' }}
          onClick={() => setShowBSOD(false)}
        >
          <div className="text-white font-mono text-sm max-w-2xl px-8">
            <div className="bg-gray-300 text-[#0000aa] px-2 inline-block mb-6">
              SentinelXP
            </div>

            <p className="mb-4">
              A problem has been detected and SentinelXP has been shut down to prevent damage to your computer.
            </p>

            <p className="mb-4">
              IRQL_NOT_LESS_OR_EQUAL
            </p>

            <p className="mb-4">
              If this is the first time you've seen this stop error screen, restart your computer. If this screen appears again, follow these steps:
            </p>

            <p className="mb-4">
              Check to make sure any new hardware or software is properly installed. If this is a new installation, ask your hardware or software manufacturer for any SentinelXP updates you might need.
            </p>

            <p className="mb-4">
              If problems continue, disable or remove any newly installed hardware or software. Disable BIOS memory options such as caching or shadowing. If you need to use Safe Mode to remove or disable components, restart your computer, press F8 to select Advanced Startup Options, and then select Safe Mode.
            </p>

            <p className="mb-6">
              Technical information:
            </p>

            <p className="mb-2">
              *** STOP: 0x0000000A (0x00000000, 0x00000002, 0x00000001, 0x804E3F2C)
            </p>

            <p className="mb-6">
              *** sentinel.sys - Address 804E3F2C base at 804E0000, DateStamp 3ee6c002
            </p>

            <p className="mt-8">
              Beginning dump of physical memory...
            </p>
            <p>
              Physical memory dump complete.
            </p>
            <p className="mt-4">
              Contact your system administrator or technical support group for further assistance.
            </p>

            <p className="mt-8 text-white/60 text-center">
              (Click anywhere or press Escape to dismiss)
            </p>
          </div>
        </div>
      )}
    </div>
  );
};

export default Desktop;
