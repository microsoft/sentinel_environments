import {
  useState,
  useEffect,
  useRef,
  useMemo,
  useCallback,
  type FormEvent,
} from "react";
import { useHashRoute } from "../hooks/useHashRoute";
import { useMicrochatData } from "../hooks/useMicrochatData";
import {
  Search,
  MoreHorizontal,
  ChevronDown,
  ChevronRight,
  ChevronLeft,
  Phone,
  Video,
  Users,
  Bell,
  Send,
  Paperclip,
  Smile,
  Mic,
  Calendar,
  MessageSquare,
  X,
  Edit2,
  Image,
  FileText,
  LogOut,
  Settings,
  Moon,
  Sun,
  Keyboard,
  Trash2,
  Reply,
  Bold,
  Italic,
  Code,
  Link,
  File,
  Hash,
  PhoneIncoming,
  PhoneOutgoing,
  PhoneMissed,
  Plus,
  Star,
  Play,
  Pause,
} from "lucide-react";

export const TASK_ID_MICROCHAT = "microchat";

// ============================================================================
// CONFIGURATION CONSTANTS
// These define the appearance and behavior of the MicroChat environment
// ============================================================================

/**
 * TEAMS COLOR PALETTE
 * Used for avatar backgrounds and UI accents
 */
const COLOR_PALETTE = [
  "#6264A7", // Purple (primary)
  "#464775", // Dark purple
  "#5B5FC7", // Light purple
  "#E74856", // Red
  "#0078D4", // Blue
  "#00B294", // Teal
  "#FF8C00", // Orange
  "#107C10", // Green
  "#5C2D91", // Deep purple
  "#008272", // Dark teal
] as const;

// Sample messages are now loaded from API: useMicrochatData()

// Workspaces are now loaded from API: useMicrochatData()

/**
 * UI STYLE CONSTANTS
 * Define common styling values used throughout the component
 */
const UI_STYLES = {
  // Header background
  headerBg: "#292929",
  // Sidebar background
  sidebarBg: "#292929",
  // Primary accent (purple)
  primaryAccent: "#5b5fc7",
  // Selected/active state
  activeBg: "#5b5fc7",
  // Hover state
  hoverBg: "#3d3d3d",
  // Selected chat background
  selectedChatBg: "#e8ebfa",
} as const;
void UI_STYLES; // Reserved for future use

/**
 * EMOJI CATEGORIES FOR PICKER
 */
const EMOJI_CATEGORIES = {
  recent: ["👍", "❤️", "😂", "😮", "😢", "😡"],
  smileys: ["😀", "😃", "😄", "😁", "😅", "😂", "🤣", "😊", "😇", "🙂", "😉", "😌", "😍", "🥰", "😘", "😗", "😙", "😚", "😋", "😛", "😜", "🤪", "😝", "🤑", "🤗", "🤭", "🤫", "🤔", "🤐", "🤨", "😐", "😑", "😶", "😏", "😒", "🙄", "😬", "🤥"],
  gestures: ["👍", "👎", "👌", "✌️", "🤞", "🤟", "🤘", "🤙", "👈", "👉", "👆", "👇", "☝️", "👋", "🤚", "🖐️", "✋", "🖖", "👏", "🙌", "👐", "🤲", "🤝", "🙏", "✍️", "💪", "🦵", "🦶"],
  objects: ["💼", "📁", "📂", "📅", "📆", "📇", "📈", "📉", "📊", "📋", "📌", "📍", "📎", "🖇️", "📏", "📐", "✂️", "🖊️", "🖋️", "✒️", "📝", "✏️", "🔍", "🔎", "💻", "🖥️", "🖨️", "⌨️", "🖱️", "💾"],
  symbols: ["❤️", "🧡", "💛", "💚", "💙", "💜", "🖤", "🤍", "🤎", "💔", "❣️", "💕", "💞", "💓", "💗", "💖", "💘", "💝", "✅", "❌", "⭐", "🌟", "💯", "🔥", "💥", "✨", "⚡", "🎉", "🎊"],
} as const;

const QUICK_REACTIONS = ["👍", "❤️", "😂", "😮", "😢", "😡"];

// Call history is now loaded from API: useMicrochatData()
// Calendar events are now managed via state: calendarEvents

/**
 * KEYBOARD SHORTCUTS
 */
const KEYBOARD_SHORTCUTS = [
  { key: "Ctrl + E", description: "Open search" },
  { key: "Ctrl + N", description: "Start new chat" },
  { key: "Ctrl + Shift + M", description: "Toggle mute" },
  { key: "Ctrl + Shift + O", description: "Toggle video" },
  { key: "Ctrl + Enter", description: "Send message" },
  { key: "Ctrl + B", description: "Bold text" },
  { key: "Ctrl + I", description: "Italic text" },
  { key: "Ctrl + K", description: "Insert link" },
  { key: "Escape", description: "Close dialog" },
  { key: "Up Arrow", description: "Edit last message" },
];

/**
 * TRANSLATIONS FOR UI
 */
type Language = "en" | "es" | "fr" | "de";

const TRANSLATIONS: Record<Language, Record<string, string>> = {
  en: {
    chat: "Chat",
    teams: "Teams",
    calendar: "Calendar",
    calls: "Calls",
    settings: "Settings",
    search: "Search",
    newChat: "New chat",
    unread: "Unread",
    chats: "Chats",
    meetingChats: "Meeting chats",
    favorites: "Favorites",
    today: "Today",
    newMeeting: "New meeting",
    recent: "Recent",
    speedDial: "Speed dial",
    general: "General",
    theme: "Theme",
    themeDesc: "Choose your preferred appearance",
    light: "Light",
    dark: "Dark",
    language: "Language",
    languageDesc: "Select your display language",
    notifications: "Notifications",
    desktopNotifications: "Desktop notifications",
    desktopNotificationsDesc: "Show notifications on your desktop",
    soundNotifications: "Sound notifications",
    soundNotificationsDesc: "Play a sound for new messages",
    emailNotifications: "Email notifications",
    emailNotificationsDesc: "Receive email digests for missed messages",
    privacy: "Privacy",
    readReceipts: "Read receipts",
    readReceiptsDesc: "Let others know when you've read their messages",
    onlineStatus: "Online status",
    onlineStatusDesc: "Show when you're online to others",
    cancel: "Cancel",
    saveChanges: "Save changes",
    typeNewMessage: "Type a new message",
    noEventsScheduled: "No events scheduled",
    signOut: "Sign out",
    settingsSaved: "Settings saved",
    day: "Day",
    week: "Week",
    month: "Month",
    schedule: "Schedule",
    title: "Title",
    addTitle: "Add a title",
    date: "Date",
    time: "Time",
    addAttendees: "Add attendees",
    enterNamesOrEmails: "Enter names or emails",
    meetingScheduled: "Meeting scheduled",
  },
  es: {
    chat: "Chat",
    teams: "Equipos",
    calendar: "Calendario",
    calls: "Llamadas",
    settings: "Configuración",
    search: "Buscar",
    newChat: "Nuevo chat",
    unread: "No leídos",
    chats: "Chats",
    meetingChats: "Chats de reunión",
    favorites: "Favoritos",
    today: "Hoy",
    newMeeting: "Nueva reunión",
    recent: "Reciente",
    speedDial: "Marcación rápida",
    general: "General",
    theme: "Tema",
    themeDesc: "Elige tu apariencia preferida",
    light: "Claro",
    dark: "Oscuro",
    language: "Idioma",
    languageDesc: "Selecciona tu idioma de visualización",
    notifications: "Notificaciones",
    desktopNotifications: "Notificaciones de escritorio",
    desktopNotificationsDesc: "Mostrar notificaciones en tu escritorio",
    soundNotifications: "Notificaciones de sonido",
    soundNotificationsDesc: "Reproducir un sonido para nuevos mensajes",
    emailNotifications: "Notificaciones por correo",
    emailNotificationsDesc: "Recibir resúmenes por correo de mensajes perdidos",
    privacy: "Privacidad",
    readReceipts: "Confirmaciones de lectura",
    readReceiptsDesc: "Permitir que otros sepan cuando has leído sus mensajes",
    onlineStatus: "Estado en línea",
    onlineStatusDesc: "Mostrar cuando estás en línea a otros",
    cancel: "Cancelar",
    saveChanges: "Guardar cambios",
    typeNewMessage: "Escribe un nuevo mensaje",
    noEventsScheduled: "No hay eventos programados",
    signOut: "Cerrar sesión",
    settingsSaved: "Configuración guardada",
    day: "Día",
    week: "Semana",
    month: "Mes",
    schedule: "Programar",
    title: "Título",
    addTitle: "Agregar un título",
    date: "Fecha",
    time: "Hora",
    addAttendees: "Agregar asistentes",
    enterNamesOrEmails: "Ingresa nombres o correos",
    meetingScheduled: "Reunión programada",
  },
  fr: {
    chat: "Discussion",
    teams: "Équipes",
    calendar: "Calendrier",
    calls: "Appels",
    settings: "Paramètres",
    search: "Rechercher",
    newChat: "Nouvelle discussion",
    unread: "Non lus",
    chats: "Discussions",
    meetingChats: "Discussions de réunion",
    favorites: "Favoris",
    today: "Aujourd'hui",
    newMeeting: "Nouvelle réunion",
    recent: "Récent",
    speedDial: "Composition rapide",
    general: "Général",
    theme: "Thème",
    themeDesc: "Choisissez votre apparence préférée",
    light: "Clair",
    dark: "Sombre",
    language: "Langue",
    languageDesc: "Sélectionnez votre langue d'affichage",
    notifications: "Notifications",
    desktopNotifications: "Notifications bureau",
    desktopNotificationsDesc: "Afficher les notifications sur votre bureau",
    soundNotifications: "Notifications sonores",
    soundNotificationsDesc: "Jouer un son pour les nouveaux messages",
    emailNotifications: "Notifications par e-mail",
    emailNotificationsDesc: "Recevoir des résumés par e-mail des messages manqués",
    privacy: "Confidentialité",
    readReceipts: "Accusés de lecture",
    readReceiptsDesc: "Permettre aux autres de savoir quand vous avez lu leurs messages",
    onlineStatus: "Statut en ligne",
    onlineStatusDesc: "Montrer quand vous êtes en ligne aux autres",
    cancel: "Annuler",
    saveChanges: "Enregistrer",
    typeNewMessage: "Tapez un nouveau message",
    noEventsScheduled: "Aucun événement prévu",
    signOut: "Se déconnecter",
    settingsSaved: "Paramètres enregistrés",
    day: "Jour",
    week: "Semaine",
    month: "Mois",
    schedule: "Planifier",
    title: "Titre",
    addTitle: "Ajouter un titre",
    date: "Date",
    time: "Heure",
    addAttendees: "Ajouter des participants",
    enterNamesOrEmails: "Entrer les noms ou e-mails",
    meetingScheduled: "Réunion planifiée",
  },
  de: {
    chat: "Chat",
    teams: "Teams",
    calendar: "Kalender",
    calls: "Anrufe",
    settings: "Einstellungen",
    search: "Suchen",
    newChat: "Neuer Chat",
    unread: "Ungelesen",
    chats: "Chats",
    meetingChats: "Besprechungschats",
    favorites: "Favoriten",
    today: "Heute",
    newMeeting: "Neue Besprechung",
    recent: "Kürzlich",
    speedDial: "Kurzwahl",
    general: "Allgemein",
    theme: "Design",
    themeDesc: "Wählen Sie Ihr bevorzugtes Erscheinungsbild",
    light: "Hell",
    dark: "Dunkel",
    language: "Sprache",
    languageDesc: "Wählen Sie Ihre Anzeigesprache",
    notifications: "Benachrichtigungen",
    desktopNotifications: "Desktop-Benachrichtigungen",
    desktopNotificationsDesc: "Benachrichtigungen auf Ihrem Desktop anzeigen",
    soundNotifications: "Tonbenachrichtigungen",
    soundNotificationsDesc: "Einen Ton für neue Nachrichten abspielen",
    emailNotifications: "E-Mail-Benachrichtigungen",
    emailNotificationsDesc: "E-Mail-Zusammenfassungen für verpasste Nachrichten erhalten",
    privacy: "Datenschutz",
    readReceipts: "Lesebestätigungen",
    readReceiptsDesc: "Anderen mitteilen, wenn Sie ihre Nachrichten gelesen haben",
    onlineStatus: "Online-Status",
    onlineStatusDesc: "Anderen zeigen, wenn Sie online sind",
    cancel: "Abbrechen",
    saveChanges: "Änderungen speichern",
    typeNewMessage: "Neue Nachricht eingeben",
    noEventsScheduled: "Keine Termine geplant",
    signOut: "Abmelden",
    settingsSaved: "Einstellungen gespeichert",
    day: "Tag",
    week: "Woche",
    month: "Monat",
    schedule: "Planen",
    title: "Titel",
    addTitle: "Titel hinzufügen",
    date: "Datum",
    time: "Uhrzeit",
    addAttendees: "Teilnehmer hinzufügen",
    enterNamesOrEmails: "Namen oder E-Mails eingeben",
    meetingScheduled: "Besprechung geplant",
  },
};

// ============================================================================
// TYPE DEFINITIONS
// ============================================================================

type ViewType = "chat" | "teams" | "calendar" | "calls";
type ChatFilter = "all" | "unread" | "meetings";

interface UserProfile {
  id: string;
  name: string;
  username: string;
  email: string;
  avatarUrl?: string;
  jobTitle: string;
  location?: string;
  bio?: string;
}

interface ChatMessage {
  id: string;
  senderId: string;
  content: string;
  timestamp: Date;
  isRead: boolean;
  isUrgent?: boolean;
  reactions?: { emoji: string; userIds: string[] }[];
  attachments?: { name: string; type: string; size: string; url?: string }[];
  replyTo?: string;
}

interface ChatConversation {
  id: string;
  type: "direct" | "group" | "meeting" | "channel";
  name: string;
  participants: string[];
  lastMessage?: ChatMessage;
  unreadCount: number;
  isPinned: boolean;
  isMuted: boolean;
  isOnline?: boolean;
  avatarColor?: string;
  avatarUrl?: string;
  teamId?: string;
}

interface Team {
  id: string;
  name: string;
  description?: string;
  avatarUrl?: string;
  avatarColor: string;
  avatarInitials: string;
  memberCount: number;
  memberIds: string[];
  channels: TeamChannel[];
  isOwner?: boolean;
}

interface TeamChannel {
  id: string;
  name: string;
  description?: string;
  unreadCount: number;
  isPinned: boolean;
}

interface ToastState {
  message: string;
  tone: "success" | "info" | "error";
}

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

const classNames = (...classes: Array<string | false | null | undefined>) =>
  classes.filter(Boolean).join(" ");

const getInitials = (name: string) =>
  name
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part.charAt(0).toUpperCase())
    .join("") || "U";


const pickColor = (seed: string) => {
  if (!seed) return COLOR_PALETTE[0];
  const code = seed.split("").reduce((acc, char) => acc + char.charCodeAt(0), 0);
  return COLOR_PALETTE[code % COLOR_PALETTE.length];
};

const formatTimestamp = (date: Date) => {
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

  if (diffDays === 0) {
    return date.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
  } else if (diffDays === 1) {
    return "Yesterday";
  } else if (diffDays < 7) {
    return date.toLocaleDateString([], { weekday: "short" });
  } else {
    return date.toLocaleDateString([], { month: "numeric", day: "numeric" });
  }
};

const formatMessageTime = (date: Date) => {
  return date.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
};

/**
 * Render text with markdown-style formatting: **bold**, _italic_, `code`, @mentions, and links
 */
const renderFormattedText = (text: string): React.ReactNode[] => {
  // Combined regex for [link](url), **bold**, _italic_, `code`, @mentions, and raw URLs
  // Order matters: markdown links must come before raw URLs to avoid conflicts
  // Mention matches @Name and optionally a trailing capitalized last name, so it
  // won't greedily swallow the next word (e.g. "@Chris can" -> bolds only "@Chris").
  const pattern = /(\[([^\]]+)\]\(([^)]+)\))|(\*\*[^*]+\*\*)|(_[^_]+_)|(`[^`]+`)|(@\w+(?:\s+[A-Z]\w+)?)|(https?:\/\/[^\s<>"']+)/g;
  const parts: React.ReactNode[] = [];
  let lastIndex = 0;
  let match: RegExpExecArray | null;
  let keyIndex = 0;

  while ((match = pattern.exec(text)) !== null) {
    // Add text before the match
    if (match.index > lastIndex) {
      parts.push(<span key={keyIndex++}>{text.slice(lastIndex, match.index)}</span>);
    }

    const matchedText = match[0];

    // Check for markdown link [text](url) - match[1] is full match, match[2] is text, match[3] is url
    if (match[1] && match[2] && match[3]) {
      const linkText = match[2];
      let linkUrl = match[3];
      // Ensure URL has protocol
      if (!linkUrl.startsWith('http://') && !linkUrl.startsWith('https://')) {
        linkUrl = 'https://' + linkUrl;
      }
      parts.push(
        <a
          key={keyIndex++}
          href={linkUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="text-[#5b5fc7] underline hover:text-[#4b4fb7]"
          onClick={(e) => e.stopPropagation()}
        >
          {linkText}
        </a>
      );
    } else if (matchedText.startsWith('**') && matchedText.endsWith('**')) {
      // Bold text
      parts.push(
        <strong key={keyIndex++} className="font-semibold">
          {matchedText.slice(2, -2)}
        </strong>
      );
    } else if (matchedText.startsWith('_') && matchedText.endsWith('_')) {
      // Italic text
      parts.push(
        <em key={keyIndex++} className="italic">
          {matchedText.slice(1, -1)}
        </em>
      );
    } else if (matchedText.startsWith('`') && matchedText.endsWith('`')) {
      // Inline code
      parts.push(
        <code key={keyIndex++} className="rounded bg-gray-200 px-1.5 py-0.5 font-mono text-sm text-gray-800">
          {matchedText.slice(1, -1)}
        </code>
      );
    } else if (matchedText.startsWith('@')) {
      // @mention
      parts.push(
        <span key={keyIndex++} className="text-[#5b5fc7] font-medium">
          {matchedText}
        </span>
      );
    } else if (matchedText.startsWith('http')) {
      // Raw URL - render as clickable link with shortened display text
      const displayUrl = matchedText.replace(/^https?:\/\//, '').slice(0, 40) + (matchedText.length > 50 ? '...' : '');
      parts.push(
        <a
          key={keyIndex++}
          href={matchedText}
          target="_blank"
          rel="noopener noreferrer"
          className="text-[#5b5fc7] underline hover:text-[#4b4fb7]"
          onClick={(e) => e.stopPropagation()}
        >
          {displayUrl}
        </a>
      );
    }

    lastIndex = match.index + matchedText.length;
  }

  // Add remaining text after last match
  if (lastIndex < text.length) {
    parts.push(<span key={keyIndex++}>{text.slice(lastIndex)}</span>);
  }

  return parts.length > 0 ? parts : [<span key={0}>{text}</span>];
};

// ============================================================================
// MAIN COMPONENT
// ============================================================================

const MicroChat = () => {
  // ---- API data hook ----
  const {
    messages: apiMessages,
    conversations: apiConversations,
    teams: apiTeams,
    calls: apiCalls,
    config: apiConfig,
    isLoading: apiLoading,
    error: apiError,
    markRead,
    reactToMessage,
    pinConversation: apiPinConversation,
  } = useMicrochatData();

  // Build a user map from resolved participants and members
  const allKnownUsers = useMemo(() => {
    const map = new Map<string, { id: string; name: string; avatarUrl: string; username?: string; jobTitle?: string }>();
    for (const conv of apiConversations) {
      for (const p of conv.participants ?? []) {
        if (!map.has(p.id)) map.set(p.id, p);
      }
    }
    for (const team of apiTeams) {
      for (const m of team.members ?? []) {
        if (!map.has(m.id)) map.set(m.id, m);
      }
    }
    return map;
  }, [apiConversations, apiTeams]);

  const selfUser = useMemo<UserProfile>(() => {
    const raw = apiConfig?.selfUser;
    const resolved = raw ? allKnownUsers.get(raw.id) : undefined;
    return {
      id: raw?.id ?? resolved?.id ?? "user000",
      name: raw?.name ?? resolved?.name ?? "You",
      username: raw?.username ?? resolved?.username ?? "",
      email: raw?.email ?? "",
      avatarUrl: raw?.avatarUrl ?? resolved?.avatarUrl ?? "",
      jobTitle: raw?.jobTitle ?? resolved?.jobTitle ?? "User",
    };
  }, [apiConfig?.selfUser, allKnownUsers]);

  // Transform API messages: flat list -> Record<conversationId, ChatMessage[]>
  const apiMessagesGrouped = useMemo(() => {
    const grouped: Record<string, ChatMessage[]> = {};
    for (const msg of apiMessages) {
      const chatMsg: ChatMessage = {
        id: msg.id,
        senderId: msg.senderId,
        content: msg.content,
        timestamp: new Date(msg.timestamp),
        isRead: msg.isRead,
        isUrgent: msg.isUrgent,
        reactions: msg.reactions,
        attachments: msg.attachments?.map((a) => ({ name: a.name, type: a.type, size: a.size || "", url: a.url })),
        replyTo: msg.replyToId || undefined,
      };
      if (!grouped[msg.conversationId]) grouped[msg.conversationId] = [];
      grouped[msg.conversationId].push(chatMsg);
    }
    for (const cid of Object.keys(grouped)) {
      grouped[cid].sort((a, b) => a.timestamp.getTime() - b.timestamp.getTime());
    }
    return grouped;
  }, [apiMessages]);

  // Local messages sent by user (not in API)
  const [localMessages, setLocalMessages] = useState<Record<string, ChatMessage[]>>({});

  // Combined messages view: API messages + locally-sent messages
  const messages = useMemo(() => {
    const combined: Record<string, ChatMessage[]> = {};
    for (const [cid, msgs] of Object.entries(apiMessagesGrouped)) {
      combined[cid] = [...msgs];
    }
    for (const [cid, msgs] of Object.entries(localMessages)) {
      if (!combined[cid]) combined[cid] = [];
      combined[cid].push(...msgs);
      combined[cid].sort((a, b) => a.timestamp.getTime() - b.timestamp.getTime());
    }
    return combined;
  }, [apiMessagesGrouped, localMessages]);

  // Transform API conversations -> ChatConversation[]
  const conversations = useMemo(() => {
    return apiConversations.map((c): ChatConversation => {
      const msgs = messages[c.id] || [];
      const lastMsg = msgs.length > 0 ? msgs[msgs.length - 1] : undefined;
      return {
        id: c.id,
        type: c.type,
        name: c.name,
        participants: c.participantIds,
        lastMessage: lastMsg,
        unreadCount: c.unreadCount,
        isPinned: c.isPinned,
        isMuted: c.isMuted,
        isOnline: false,
        avatarColor: c.avatarColor,
        avatarUrl: c.avatarUrl,
      };
    }).sort((a, b) => {
      if (a.isPinned && !b.isPinned) return -1;
      if (!a.isPinned && b.isPinned) return 1;
      const aTime = a.lastMessage?.timestamp.getTime() || 0;
      const bTime = b.lastMessage?.timestamp.getTime() || 0;
      return bTime - aTime;
    });
  }, [apiConversations, messages]);

  // Transform API teams -> Team[]
  const teams = useMemo(() => {
    return apiTeams.map((t): Team => ({
      id: t.id,
      name: t.name,
      description: t.description,
      avatarUrl: t.avatarUrl,
      avatarColor: t.avatarColor,
      avatarInitials: t.avatarInitials,
      memberCount: t.memberCount,
      memberIds: t.memberIds,
      channels: t.channels,
      isOwner: t.ownerId === selfUser.id,
    }));
  }, [apiTeams, selfUser.id]);

  // ---- UI state ----
  const [route, setRoute] = useHashRoute<ViewType>(["chat", "teams", "calendar", "calls"] as const, "chat");
  const currentView = route.view;
  const setCurrentView = useCallback((view: ViewType) => setRoute(view), [setRoute]);
  const selectedConversationId = currentView === "chat" ? route.id : null;
  const setSelectedConversationId = useCallback(
    (id: string | null) => setRoute("chat", id),
    [setRoute],
  );
  const teamsCompositeId = currentView === "teams" ? route.id : null;
  const selectedTeamId = teamsCompositeId ? teamsCompositeId.split(":")[0] || null : null;
  const [chatFilter, setChatFilter] = useState<ChatFilter>("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [isSignedOut, setIsSignedOut] = useState(false);

  const [messageInput, setMessageInput] = useState("");
  const [toast, setToast] = useState<ToastState | null>(null);
  const [favoritesExpanded, setFavoritesExpanded] = useState(true);
  const [chatsExpanded, setChatsExpanded] = useState(true);
  const [profileDropdownOpen, setProfileDropdownOpen] = useState(false);
  const [statusMenuOpen, setStatusMenuOpen] = useState(false);
  const [currentStatus, setCurrentStatus] = useState<"available" | "busy" | "dnd" | "away">("available");

  // New feature states
  const [editingMessageId, setEditingMessageId] = useState<string | null>(null);
  const [editingContent, setEditingContent] = useState("");
  const [replyingToMessageId, setReplyingToMessageId] = useState<string | null>(null);
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);
  const [emojiPickerForMessageId, setEmojiPickerForMessageId] = useState<string | null>(null);
  const [showMentionSuggestions, setShowMentionSuggestions] = useState(false);
  const [mentionQuery, setMentionQuery] = useState("");
  const [mentionCursorPosition, setMentionCursorPosition] = useState(0);
  const [showFormatToolbar, setShowFormatToolbar] = useState(false);
  const [showAttachmentMenu, setShowAttachmentMenu] = useState(false);
  const [attachments, setAttachments] = useState<{ name: string; type: string; size: string; url?: string }[]>([]);
  const [showSettingsModal, setShowSettingsModal] = useState(false);
  const [showKeyboardShortcuts, setShowKeyboardShortcuts] = useState(false);
  const [darkMode, setDarkMode] = useState(false);
  const [language, setLanguage] = useState<Language>("en");

  // Translation helper
  const t = useCallback((key: string) => TRANSLATIONS[language][key] || TRANSLATIONS.en[key] || key, [language]);
  const selectedChannelId = teamsCompositeId && teamsCompositeId.includes(":")
    ? teamsCompositeId.split(":")[1] || null
    : null;
  const setSelectedChannelId = useCallback(
    (id: string | null) => {
      const team = teamsCompositeId ? teamsCompositeId.split(":")[0] : null;
      if (!team) return;
      setRoute("teams", id ? `${team}:${id}` : team);
    },
    [setRoute, teamsCompositeId],
  );
  const [channelMessages, setChannelMessages] = useState<Record<string, { id: string; senderId: string; content: string; timestamp: number }[]>>({});
  const [showChannelMembers, setShowChannelMembers] = useState(false);
  const [showNewMeetingModal, setShowNewMeetingModal] = useState(false);
  const [calendarDate, setCalendarDate] = useState(new Date());
  const [calendarView, setCalendarView] = useState<"day" | "week" | "month">("day");
  const [calendarEvents, setCalendarEvents] = useState<{ id: string; title: string; time: string; duration: string; type: "meeting" | "personal"; attendees: number; date: Date }[]>([]);
  const [teamsExpanded, setTeamsExpanded] = useState(true);
  const [showAnnouncement, setShowAnnouncement] = useState(true);
  const [hoveredMessageId, setHoveredMessageId] = useState<string | null>(null);
  const [_threadExpandedIds, setThreadExpandedIds] = useState<Set<string>>(new Set());
  void _threadExpandedIds; // Reserved for thread UI implementation

  // Calling modal state
  const [callingModal, setCallingModal] = useState<{
    isOpen: boolean;
    callType: "video" | "audio";
    recipientName: string;
    avatarUrl?: string;
    avatarColor?: string;
    participantAvatars?: { id: string; avatarUrl?: string; name: string }[];
    status: "calling" | "not_answered";
  } | null>(null);

  // Conversation search state
  const [conversationSearchOpen, setConversationSearchOpen] = useState(false);
  const [conversationSearchQuery, setConversationSearchQuery] = useState("");

  // Voice recording state
  const [isRecording, setIsRecording] = useState(false);
  const [recordingDuration, setRecordingDuration] = useState(0);

  // Create channel modal state
  const [showCreateChannelModal, setShowCreateChannelModal] = useState(false);
  const [newChannelName, setNewChannelName] = useState("");

  // More options menu state
  const [showMoreOptionsMenu, setShowMoreOptionsMenu] = useState<string | null>(null); // stores ID of item with open menu

  // Voice message playback state
  const [playingVoiceMessageId, setPlayingVoiceMessageId] = useState<string | null>(null);

  const searchInputRef = useRef<HTMLInputElement>(null);
  const messageInputRef = useRef<HTMLInputElement>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const messagesContainerRef = useRef<HTMLDivElement>(null);
  const prevMessageCountRef = useRef(0);
  const prevConversationIdRef = useRef<string | null>(null);
  // Whether the user is currently pinned to the bottom of the message list.
  // We suppress auto-scroll when they have intentionally scrolled up.
  const isAtBottomRef = useRef(true);
  const toastTimeoutRef = useRef<number | null>(null);
  const profileDropdownRef = useRef<HTMLDivElement>(null);
  const voicePlaybackTimeoutRef = useRef<number | null>(null);

  // Keyboard shortcuts
  useEffect(() => {
    const handleShortcut = (event: KeyboardEvent) => {
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "e") {
        event.preventDefault();
        searchInputRef.current?.focus();
      }
    };
    window.addEventListener("keydown", handleShortcut);
    return () => window.removeEventListener("keydown", handleShortcut);
  }, []);

  // Close profile dropdown on click outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (profileDropdownRef.current && !profileDropdownRef.current.contains(event.target as Node)) {
        setProfileDropdownOpen(false);
        setStatusMenuOpen(false);
      }
    };
    if (profileDropdownOpen) {
      document.addEventListener("mousedown", handleClickOutside);
    }
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [profileDropdownOpen]);

  // Scroll to bottom only when the conversation changes, or when a new message
  // arrives AND the user was already pinned to the bottom. `messages` is a
  // Record keyed by conversation, so count the messages in the selected convo.
  const selectedMessageCount = selectedConversationId
    ? (messages[selectedConversationId]?.length ?? 0)
    : 0;
  useEffect(() => {
    const conversationChanged = prevConversationIdRef.current !== selectedConversationId;
    const hasNewMessages = selectedMessageCount > prevMessageCountRef.current;
    if (conversationChanged) {
      messagesEndRef.current?.scrollIntoView({ behavior: "auto" });
      isAtBottomRef.current = true;
    } else if (hasNewMessages && isAtBottomRef.current) {
      messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
    }
    prevMessageCountRef.current = selectedMessageCount;
    prevConversationIdRef.current = selectedConversationId;
  }, [selectedMessageCount, selectedConversationId]);

  // Track whether the user is pinned to the bottom of the message list so we
  // don't hijack scroll while they're reading earlier messages.
  const handleMessagesScroll = useCallback(() => {
    const el = messagesContainerRef.current;
    if (!el) return;
    const distanceFromBottom = el.scrollHeight - el.scrollTop - el.clientHeight;
    isAtBottomRef.current = distanceFromBottom <= 50;
  }, []);

  // Voice recording timer
  useEffect(() => {
    let interval: number | null = null;
    if (isRecording) {
      interval = window.setInterval(() => {
        setRecordingDuration((prev) => prev + 1);
      }, 1000);
    }
    return () => {
      if (interval) window.clearInterval(interval);
    };
  }, [isRecording]);

  // Toast helper
  const triggerToast = useCallback((message: string, tone: ToastState["tone"] = "info") => {
    if (toastTimeoutRef.current) window.clearTimeout(toastTimeoutRef.current);
    setToast({ message, tone });
    toastTimeoutRef.current = window.setTimeout(() => {
      setToast(null);
      toastTimeoutRef.current = null;
    }, 3200);
  }, []);

  // Start a call (shows calling modal, then "not answered" after delay)
  const startCall = useCallback((
    recipientName: string,
    callType: "video" | "audio",
    avatarUrl?: string,
    avatarColor?: string,
    participantAvatars?: { id: string; avatarUrl?: string; name: string }[],
  ) => {
    setCallingModal({
      isOpen: true,
      callType,
      recipientName,
      avatarUrl,
      avatarColor,
      participantAvatars,
      status: "calling",
    });

    // After 3-5 seconds, show "not answered"
    const delay = 3000 + Math.random() * 2000;
    setTimeout(() => {
      setCallingModal((prev) =>
        prev ? { ...prev, status: "not_answered" } : null
      );
      // Auto-close after showing "not answered" for 2 seconds
      setTimeout(() => {
        setCallingModal(null);
      }, 2000);
    }, delay);
  }, []);

  // Filter conversations
  const filteredConversations = useMemo(() => {
    let filtered = [...conversations];

    if (chatFilter === "unread") {
      filtered = filtered.filter((c) => c.unreadCount > 0);
    } else if (chatFilter === "meetings") {
      filtered = filtered.filter((c) => c.type === "meeting");
    }

    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase();
      filtered = filtered.filter(
        (c) =>
          c.name.toLowerCase().includes(query) ||
          c.lastMessage?.content.toLowerCase().includes(query)
      );
    }

    return filtered;
  }, [conversations, chatFilter, searchQuery]);

  const pinnedConversations = filteredConversations.filter((c) => c.isPinned);
  const regularConversations = filteredConversations.filter((c) => !c.isPinned);

  const selectedConversation = conversations.find((c) => c.id === selectedConversationId);
  const selectedMessages = selectedConversationId ? messages[selectedConversationId] || [] : [];

  // Get user info from resolved participant/member data
  const getUserById = useCallback(
    (userId: string): UserProfile | undefined => {
      const u = allKnownUsers.get(userId);
      if (!u) return undefined;
      return { id: u.id, name: u.name, username: u.username || "", email: "", avatarUrl: u.avatarUrl, jobTitle: u.jobTitle || "" };
    },
    [allKnownUsers]
  );

  // Handlers
  const handleSelectConversation = useCallback((conversationId: string) => {
    setSelectedConversationId(conversationId);
    // Mark all messages in this conversation as read via API
    const convMsgs = apiMessages.filter((m) => m.conversationId === conversationId && !m.isRead);
    for (const msg of convMsgs) {
      markRead(msg.id);
    }
  }, [apiMessages, markRead, setSelectedConversationId]);

  const handleSendMessage = useCallback(
    (e: FormEvent) => {
      e.preventDefault();
      if ((!messageInput.trim() && attachments.length === 0) || !selectedConversationId) return;

      const messageContent = messageInput.trim();
      const newMessage: ChatMessage = {
        id: `msg-${Date.now()}`,
        senderId: selfUser.id,
        content: messageContent,
        timestamp: new Date(),
        isRead: true,
        ...(attachments.length > 0 && { attachments: [...attachments] }),
      };

      setLocalMessages((prev) => ({
        ...prev,
        [selectedConversationId]: [...(prev[selectedConversationId] || []), newMessage],
      }));

      setMessageInput("");
      setReplyingToMessageId(null);
      setAttachments([]);

      // Simulate realistic auto-reply when message mentions someone
      const conversation = conversations.find(c => c.id === selectedConversationId);
      if (conversation) {
        const otherParticipants = conversation.participants.filter(p => p !== selfUser.id);
        const mentionMatch = messageContent.match(/@(\w+\s*\w*)/);

        if (mentionMatch && otherParticipants.length > 0 && Math.random() < 0.6) {
          const replierId = otherParticipants[Math.floor(Math.random() * otherParticipants.length)];

          setTimeout(() => {
            const replyMessage: ChatMessage = {
              id: `msg-${Date.now()}`,
              senderId: replierId,
              content: `Thanks for the heads up! I'll look into it.`,
              timestamp: new Date(),
              isRead: false,
            };

            setLocalMessages((prev) => ({
              ...prev,
              [selectedConversationId]: [...(prev[selectedConversationId] || []), replyMessage],
            }));
          }, 2000 + Math.random() * 3000);
        }
      }
    },
    [messageInput, selectedConversationId, selfUser.id, conversations, attachments]
  );

  // Message editing handler (local messages only)
  const handleEditMessage = useCallback((messageId: string, newContent: string) => {
    if (!selectedConversationId || !newContent.trim()) return;

    setLocalMessages((prev) => ({
      ...prev,
      [selectedConversationId]: (prev[selectedConversationId] || []).map((msg) =>
        msg.id === messageId ? { ...msg, content: newContent.trim() } : msg
      ),
    }));

    setEditingMessageId(null);
    setEditingContent("");
  }, [selectedConversationId]);

  // Message delete handler (local messages only)
  const handleDeleteMessage = useCallback((messageId: string) => {
    if (!selectedConversationId) return;

    setLocalMessages((prev) => ({
      ...prev,
      [selectedConversationId]: (prev[selectedConversationId] || []).filter((msg) => msg.id !== messageId),
    }));
  }, [selectedConversationId]);

  // Toggle conversation favorite (pinned) status via API
  const toggleFavorite = useCallback((conversationId: string) => {
    apiPinConversation(conversationId);
  }, [apiPinConversation]);

  // Format recording duration as mm:ss
  const formatRecordingTime = (seconds: number): string => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, "0")}`;
  };

  // Start voice recording
  const startRecording = useCallback(() => {
    setIsRecording(true);
    setRecordingDuration(0);
  }, []);

  // Cancel voice recording
  const cancelRecording = useCallback(() => {
    setIsRecording(false);
    setRecordingDuration(0);
  }, []);

  // Send voice message
  const sendVoiceMessage = useCallback(() => {
    if (!selectedConversationId || recordingDuration === 0) {
      cancelRecording();
      return;
    }

    const duration = formatRecordingTime(recordingDuration);
    const voiceMessage: ChatMessage = {
      id: `msg-${Date.now()}`,
      senderId: selfUser.id,
      content: `🎤 Voice message (${duration})`,
      timestamp: new Date(),
      isRead: true,
    };

    setLocalMessages((prev) => ({
      ...prev,
      [selectedConversationId]: [...(prev[selectedConversationId] || []), voiceMessage],
    }));

    setIsRecording(false);
    setRecordingDuration(0);
    triggerToast("Voice message sent", "success");
  }, [selectedConversationId, recordingDuration, selfUser.id, cancelRecording, triggerToast]);

  // Toggle voice message playback (simulated)
  const toggleVoicePlayback = useCallback((messageId: string, duration?: string) => {
    // Clear any existing timeout
    if (voicePlaybackTimeoutRef.current) {
      window.clearTimeout(voicePlaybackTimeoutRef.current);
      voicePlaybackTimeoutRef.current = null;
    }

    if (playingVoiceMessageId === messageId) {
      // Stop playback
      setPlayingVoiceMessageId(null);
    } else {
      // Start playback
      setPlayingVoiceMessageId(messageId);

      // Parse duration (e.g., "0:22" -> 22 seconds, "1:30" -> 90 seconds)
      let durationMs = 5000; // Default 5 seconds
      if (duration) {
        const parts = duration.split(":").map(Number);
        if (parts.length === 2) {
          durationMs = (parts[0] * 60 + parts[1]) * 1000;
        }
      }

      // Auto-stop after the duration
      voicePlaybackTimeoutRef.current = window.setTimeout(() => {
        setPlayingVoiceMessageId(null);
        voicePlaybackTimeoutRef.current = null;
      }, durationMs);
    }
  }, [playingVoiceMessageId]);

  // Create a new channel in the selected team (local-only, no API endpoint)
  const handleCreateChannel = useCallback(() => {
    if (!selectedTeamId || !newChannelName.trim()) return;

    const channelName = newChannelName.trim();
    setShowCreateChannelModal(false);
    setNewChannelName("");
    triggerToast(`Channel #${channelName} created`, "success");
  }, [selectedTeamId, newChannelName, triggerToast]);

  // Add reaction to message
  // Add reaction via API
  const handleAddReaction = useCallback((messageId: string, emoji: string) => {
    if (!selectedConversationId) return;
    reactToMessage(messageId, emoji);
    setEmojiPickerForMessageId(null);
  }, [selectedConversationId, reactToMessage]);

  // Handle @mention input
  const handleMessageInputChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    setMessageInput(value);

    // Check for @ mentions
    const cursorPos = e.target.selectionStart || 0;
    const textBeforeCursor = value.slice(0, cursorPos);
    const atMatch = textBeforeCursor.match(/@(\w*)$/);

    if (atMatch) {
      setMentionQuery(atMatch[1]);
      setMentionCursorPosition(cursorPos);
      setShowMentionSuggestions(true);
    } else {
      setShowMentionSuggestions(false);
      setMentionQuery("");
    }
  }, []);

  // Insert mention
  const handleInsertMention = useCallback((user: UserProfile) => {
    const beforeMention = messageInput.slice(0, mentionCursorPosition - mentionQuery.length - 1);
    const afterMention = messageInput.slice(mentionCursorPosition);
    const newValue = `${beforeMention}@${user.name} ${afterMention}`;
    setMessageInput(newValue);
    setShowMentionSuggestions(false);
    setMentionQuery("");
    messageInputRef.current?.focus();
  }, [messageInput, mentionCursorPosition, mentionQuery]);

  // Insert emoji into message
  const handleInsertEmoji = useCallback((emoji: string) => {
    setMessageInput((prev) => prev + emoji);
    setShowEmojiPicker(false);
    messageInputRef.current?.focus();
  }, []);

  // Apply text formatting
  const handleFormat = useCallback((format: "bold" | "italic" | "code" | "link") => {
    const input = messageInputRef.current;
    if (!input) return;

    const start = input.selectionStart || 0;
    const end = input.selectionEnd || 0;
    const selectedText = messageInput.slice(start, end);

    let formattedText = "";
    switch (format) {
      case "bold":
        formattedText = `**${selectedText || "text"}**`;
        break;
      case "italic":
        formattedText = `_${selectedText || "text"}_`;
        break;
      case "code":
        formattedText = `\`${selectedText || "code"}\``;
        break;
      case "link":
        formattedText = `[${selectedText || "link text"}](url)`;
        break;
    }

    const newValue = messageInput.slice(0, start) + formattedText + messageInput.slice(end);
    setMessageInput(newValue);
  }, [messageInput]);

  // Add attachment - simulates file picker with placeholder images
  const handleAddAttachment = useCallback((type: "file" | "image") => {
    // Generate a consistent placeholder image based on timestamp
    const timestamp = Date.now();
    const imageIndex = timestamp % 100;
    const newAttachment = {
      name: type === "image" ? `image_${timestamp}.png` : `document_${timestamp}.pdf`,
      type,
      size: type === "image" ? "2.4 MB" : "1.2 MB",
      // Use picsum for placeholder images
      url: type === "image" ? `https://picsum.photos/seed/${imageIndex}/240/160` : undefined,
    };
    setAttachments((prev) => [...prev, newAttachment]);
    setShowAttachmentMenu(false);
    triggerToast(type === "image" ? "Image attached" : "File attached", "success");
  }, [triggerToast]);

  // Remove attachment
  const handleRemoveAttachment = useCallback((index: number) => {
    setAttachments((prev) => prev.filter((_, i) => i !== index));
  }, []);

  // Toggle thread expansion (reserved for thread UI implementation)
  const _handleToggleThread = useCallback((messageId: string) => {
    setThreadExpandedIds((prev) => {
      const newSet = new Set(prev);
      if (newSet.has(messageId)) {
        newSet.delete(messageId);
      } else {
        newSet.add(messageId);
      }
      return newSet;
    });
  }, []);
  void _handleToggleThread;

  // Filter users for mention suggestions
  const mentionSuggestions = useMemo(() => {
    const userProfiles = Array.from(allKnownUsers.values()).map((u) => ({
      id: u.id, name: u.name, username: "", email: "",
      avatarUrl: u.avatarUrl, jobTitle: "",
    }));
    if (!mentionQuery) return userProfiles.slice(0, 5);
    return userProfiles
      .filter((u) => u.name.toLowerCase().includes(mentionQuery.toLowerCase()))
      .slice(0, 5);
  }, [mentionQuery, allKnownUsers]);


  // ============================================================================
  // RENDER HELPERS
  // ============================================================================

  // Left icon sidebar (narrow purple bar)
  const renderIconSidebar = () => (
    <div className="flex h-full w-[68px] flex-col items-center bg-[#292929] py-3">
      {/* Navigation Icons */}
      <nav className="flex flex-col items-center gap-1">
        <button
          onClick={() => setCurrentView("chat")}
          className={classNames(
            "relative flex h-12 w-12 flex-col items-center justify-center rounded-md text-xs transition",
            currentView === "chat"
              ? "bg-[#5b5fc7] text-white"
              : "text-gray-400 hover:bg-[#3d3d3d] hover:text-white"
          )}
          title={t("chat")}
        >
          <MessageSquare size={20} />
          <span className="mt-0.5 text-[10px]">{t("chat")}</span>
          {conversations.some((c) => c.unreadCount > 0) && (
            <span className="absolute right-1 top-1 h-2 w-2 rounded-full bg-red-500" />
          )}
        </button>

        <button
          onClick={() => setCurrentView("teams")}
          className={classNames(
            "flex h-12 w-12 flex-col items-center justify-center rounded-md text-xs transition",
            currentView === "teams"
              ? "bg-[#5b5fc7] text-white"
              : "text-gray-400 hover:bg-[#3d3d3d] hover:text-white"
          )}
          title={t("teams")}
        >
          <Users size={20} />
          <span className="mt-0.5 text-[10px]">{t("teams")}</span>
        </button>

        <button
          onClick={() => setCurrentView("calendar")}
          className={classNames(
            "flex h-12 w-12 flex-col items-center justify-center rounded-md text-xs transition",
            currentView === "calendar"
              ? "bg-[#5b5fc7] text-white"
              : "text-gray-400 hover:bg-[#3d3d3d] hover:text-white"
          )}
          title={t("calendar")}
        >
          <Calendar size={20} />
          <span className="mt-0.5 text-[10px]">{t("calendar")}</span>
        </button>

        <button
          onClick={() => setCurrentView("calls")}
          className={classNames(
            "flex h-12 w-12 flex-col items-center justify-center rounded-md text-xs transition",
            currentView === "calls"
              ? "bg-[#5b5fc7] text-white"
              : "text-gray-400 hover:bg-[#3d3d3d] hover:text-white"
          )}
          title={t("calls")}
        >
          <Phone size={20} />
          <span className="mt-0.5 text-[10px]">{t("calls")}</span>
        </button>

      </nav>

      <div className="flex-1" />
    </div>
  );

  // Chat sidebar (conversation list)
  const renderChatSidebar = () => (
    <div className={classNames(
      "flex h-full w-[300px] flex-col border-r",
      darkMode ? "border-gray-700 bg-[#2d2d2d]" : "border-gray-200 bg-white"
    )}>
      {/* Header */}
      <div className={classNames(
        "flex items-center justify-between border-b px-4 py-3",
        darkMode ? "border-gray-700" : "border-gray-100"
      )}>
        <h2 className={classNames("text-xl font-semibold", darkMode ? "text-white" : "text-gray-900")}>{t("chat")}</h2>
      </div>

      {/* Filter pills */}
      <div className={classNames("flex gap-2 border-b px-4 py-2", darkMode ? "border-gray-700" : "border-gray-100")}>
        <button
          onClick={() => setChatFilter("unread")}
          className={classNames(
            "rounded-full px-3 py-1 text-sm font-medium transition",
            chatFilter === "unread"
              ? darkMode ? "bg-[#464775] text-[#a5a7f3]" : "bg-[#e8ebfa] text-[#5b5fc7]"
              : darkMode ? "bg-[#3d3d3d] text-gray-300 hover:bg-[#4d4d4d]" : "bg-gray-100 text-gray-600 hover:bg-gray-200"
          )}
        >
          {t("unread")}
        </button>
        <button
          onClick={() => setChatFilter("all")}
          className={classNames(
            "rounded-full px-3 py-1 text-sm font-medium transition",
            chatFilter === "all"
              ? darkMode ? "bg-[#464775] text-[#a5a7f3]" : "bg-[#e8ebfa] text-[#5b5fc7]"
              : darkMode ? "bg-[#3d3d3d] text-gray-300 hover:bg-[#4d4d4d]" : "bg-gray-100 text-gray-600 hover:bg-gray-200"
          )}
        >
          {t("chats")}
        </button>
        <button
          onClick={() => setChatFilter("meetings")}
          className={classNames(
            "rounded-full px-3 py-1 text-sm font-medium transition",
            chatFilter === "meetings"
              ? darkMode ? "bg-[#464775] text-[#a5a7f3]" : "bg-[#e8ebfa] text-[#5b5fc7]"
              : darkMode ? "bg-[#3d3d3d] text-gray-300 hover:bg-[#4d4d4d]" : "bg-gray-100 text-gray-600 hover:bg-gray-200"
          )}
        >
          {t("meetingChats")}
        </button>
      </div>

      {/* Favorites section */}
      {pinnedConversations.length > 0 && (
        <div className={classNames("border-b", darkMode ? "border-gray-700" : "border-gray-100")}>
          <button
            onClick={() => setFavoritesExpanded(!favoritesExpanded)}
            className={classNames("flex w-full items-center gap-2 px-4 py-2 text-sm font-medium", darkMode ? "text-gray-200 hover:bg-[#3d3d3d]" : "text-gray-600 hover:bg-gray-50")}
          >
            {favoritesExpanded ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
            {t("favorites")}
          </button>
          {favoritesExpanded && (
            <div className="pb-2">
              {pinnedConversations.map((conversation) => (
                <ConversationRow
                  key={conversation.id}
                  conversation={conversation}
                  isSelected={selectedConversationId === conversation.id}
                  onClick={() => handleSelectConversation(conversation.id)}
                  onToggleFavorite={toggleFavorite}
                  lookupUser={getUserById}
                  darkMode={darkMode}
                />
              ))}
            </div>
          )}
        </div>
      )}

      {/* Chats section */}
      <div className={classNames("flex-1 overflow-y-auto", darkMode ? "dark-scrollbar" : "light-scrollbar")}>
        <button
          onClick={() => setChatsExpanded(!chatsExpanded)}
          className={classNames("flex w-full items-center gap-2 px-4 py-2 text-sm font-medium", darkMode ? "text-gray-200 hover:bg-[#3d3d3d]" : "text-gray-600 hover:bg-gray-50")}
        >
          {chatsExpanded ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
          {t("chats")}
        </button>
        {chatsExpanded && (
          <div>
            {regularConversations.map((conversation) => (
              <ConversationRow
                key={conversation.id}
                conversation={conversation}
                isSelected={selectedConversationId === conversation.id}
                onClick={() => handleSelectConversation(conversation.id)}
                onToggleFavorite={toggleFavorite}
                lookupUser={getUserById}
                darkMode={darkMode}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );

  // Teams sidebar
  const selectedTeam = teams.find((t) => t.id === selectedTeamId);
  const selectedChannel = selectedTeam?.channels.find((c) => c.id === selectedChannelId);

  const renderTeamsSidebar = () => (
    <div className={classNames("flex h-full flex-1 flex-col", darkMode ? "bg-[#1f1f1f]" : "bg-[#f5f5f5]")}>
      {/* Header */}
      <div className={classNames("flex items-center justify-between border-b px-6 py-4", darkMode ? "border-gray-700 bg-[#2d2d2d]" : "border-gray-200 bg-white")}>
        {selectedTeamId ? (
          <div className="flex items-center gap-3">
            <button
              onClick={() => setRoute("teams")}
              className={classNames("rounded-md p-1", darkMode ? "text-gray-400 hover:bg-[#3d3d3d]" : "text-gray-500 hover:bg-gray-100")}
            >
              <ChevronLeft size={20} />
            </button>
            <div className="flex items-center gap-3">
              {selectedTeam?.avatarUrl ? (
                <img
                  src={selectedTeam.avatarUrl}
                  alt={selectedTeam.name}
                  className="h-10 w-10 rounded-md object-cover"
                />
              ) : (
                <div
                  className="flex h-10 w-10 items-center justify-center rounded-md text-sm font-bold text-white"
                  style={{ backgroundColor: selectedTeam?.avatarColor }}
                >
                  {selectedTeam?.avatarInitials}
                </div>
              )}
              <div>
                <h2 className={classNames("text-lg font-semibold", darkMode ? "text-white" : "text-gray-900")}>{selectedTeam?.name}</h2>
                <p className={classNames("text-xs", darkMode ? "text-gray-400" : "text-gray-500")}>{selectedTeam?.memberCount} members</p>
              </div>
            </div>
          </div>
        ) : (
          <h2 className={classNames("text-xl font-semibold", darkMode ? "text-white" : "text-gray-900")}>Teams</h2>
        )}
      </div>

      {/* Team selected - show channels */}
      {selectedTeamId && selectedTeam ? (
        <div className="flex flex-1 overflow-hidden">
          {/* Channels sidebar */}
          <div className={classNames("w-64 border-r", darkMode ? "border-gray-700 bg-[#2d2d2d]" : "border-gray-200 bg-white")}>
            <div className="p-4">
              <div className="mb-2 flex items-center justify-between">
                <span className={classNames("text-xs font-semibold uppercase", darkMode ? "text-gray-400" : "text-gray-500")}>Channels</span>
                <button
                  onClick={() => setShowCreateChannelModal(true)}
                  className={classNames("rounded p-1", darkMode ? "text-gray-400 hover:bg-[#3d3d3d] hover:text-gray-300" : "text-gray-400 hover:bg-gray-100 hover:text-gray-600")}
                  title="Create channel"
                >
                  <Plus size={16} />
                </button>
              </div>
              {selectedTeam.channels.map((channel) => (
                <button
                  key={channel.id}
                  onClick={() => setSelectedChannelId(channel.id)}
                  className={classNames(
                    "flex w-full items-center gap-2 rounded-md px-3 py-2 text-sm transition",
                    selectedChannelId === channel.id
                      ? darkMode ? "bg-[#464775] text-[#a5a7f3] font-medium" : "bg-[#e8ebfa] text-[#5b5fc7] font-medium"
                      : darkMode ? "text-gray-300 hover:bg-[#3d3d3d]" : "text-gray-700 hover:bg-gray-50"
                  )}
                >
                  <Hash size={16} />
                  <span className="flex-1 truncate text-left">{channel.name}</span>
                  {channel.unreadCount > 0 && (
                    <span className="rounded-full bg-[#5b5fc7] px-2 py-0.5 text-xs font-medium text-white">
                      {channel.unreadCount}
                    </span>
                  )}
                </button>
              ))}
            </div>
          </div>

          {/* Channel content */}
          <div className={classNames("flex-1 flex flex-col", darkMode ? "bg-[#1f1f1f]" : "")}>
            {selectedChannel ? (
              <>
                {/* Channel header */}
                <div className={classNames("flex items-center justify-between border-b px-4 py-3", darkMode ? "border-gray-700 bg-[#2d2d2d]" : "border-gray-200 bg-white")}>
                  <div className="flex items-center gap-2">
                    <Hash size={20} className={darkMode ? "text-gray-400" : "text-gray-500"} />
                    <span className={classNames("font-medium", darkMode ? "text-white" : "text-gray-900")}>{selectedChannel.name}</span>
                  </div>
                  <div className="flex items-center gap-1">
                    <button
                      className={classNames(
                        "rounded-md p-2",
                        darkMode ? "text-gray-400 hover:bg-[#3d3d3d]" : "text-gray-500 hover:bg-gray-100"
                      )}
                      onClick={() => startCall(`${selectedTeam?.name} - ${selectedChannel.name}`, "video")}
                      title="Start video call"
                    >
                      <Video size={18} />
                    </button>
                    <button
                      className={classNames(
                        "rounded-md p-2",
                        showChannelMembers
                          ? darkMode ? "bg-[#3d3d3d] text-[#a5a7f3]" : "bg-gray-100 text-[#5b5fc7]"
                          : darkMode ? "text-gray-400 hover:bg-[#3d3d3d]" : "text-gray-500 hover:bg-gray-100"
                      )}
                      onClick={() => setShowChannelMembers(!showChannelMembers)}
                      title="Show members"
                    >
                      <Users size={18} />
                    </button>
                    <div className="relative">
                      <button
                        className={classNames(
                          "rounded-md p-2",
                          showMoreOptionsMenu === `channel-${selectedChannel.id}`
                            ? darkMode ? "bg-[#3d3d3d] text-[#a5a7f3]" : "bg-gray-100 text-[#5b5fc7]"
                            : darkMode ? "text-gray-400 hover:bg-[#3d3d3d]" : "text-gray-500 hover:bg-gray-100"
                        )}
                        title="More options"
                        onClick={() => setShowMoreOptionsMenu(showMoreOptionsMenu === `channel-${selectedChannel.id}` ? null : `channel-${selectedChannel.id}`)}
                      >
                        <MoreHorizontal size={18} />
                      </button>
                      {showMoreOptionsMenu === `channel-${selectedChannel.id}` && (
                        <div className={classNames(
                          "absolute right-0 top-full z-50 mt-1 min-w-[180px] rounded-lg border py-1 shadow-lg",
                          darkMode ? "border-gray-700 bg-[#2d2d2d]" : "border-gray-200 bg-white"
                        )}>
                          <button
                            onClick={() => { triggerToast("Channel pinned", "success"); setShowMoreOptionsMenu(null); }}
                            className={classNames(
                              "flex w-full items-center gap-2 px-3 py-2 text-sm",
                              darkMode ? "text-gray-200 hover:bg-[#3d3d3d]" : "text-gray-700 hover:bg-gray-50"
                            )}
                          >
                            <Star size={14} />
                            Pin channel
                          </button>
                          <button
                            onClick={() => { triggerToast("Notifications muted", "success"); setShowMoreOptionsMenu(null); }}
                            className={classNames(
                              "flex w-full items-center gap-2 px-3 py-2 text-sm",
                              darkMode ? "text-gray-200 hover:bg-[#3d3d3d]" : "text-gray-700 hover:bg-gray-50"
                            )}
                          >
                            <Bell size={14} />
                            Mute notifications
                          </button>
                        </div>
                      )}
                    </div>
                  </div>
                </div>

                {/* Channel content with optional members panel */}
                <div className="flex flex-1 overflow-hidden">
                  {/* Channel messages */}
                  <div className="flex-1 flex flex-col overflow-hidden">
                    <div className={classNames("flex-1 overflow-y-auto p-4", darkMode ? "dark-scrollbar" : "light-scrollbar")}>
                      <div className="mb-6 text-center">
                        <div className={classNames("mx-auto mb-3 flex h-16 w-16 items-center justify-center rounded-full", darkMode ? "bg-[#464775]" : "bg-[#e8ebfa]")}>
                          <Hash size={32} className={darkMode ? "text-[#a5a7f3]" : "text-[#5b5fc7]"} />
                        </div>
                        <h3 className={classNames("text-lg font-semibold", darkMode ? "text-white" : "text-gray-900")}>Welcome to #{selectedChannel.name}</h3>
                        <p className={classNames("text-sm", darkMode ? "text-gray-400" : "text-gray-500")}>{selectedChannel.description || "This is the beginning of the channel."}</p>
                      </div>

                      {/* Channel messages */}
                      <div className="space-y-4">
                        {(channelMessages[selectedChannel.id] || []).map((msg) => {
                          const sender = getUserById(msg.senderId) || selfUser;
                          const isSelf = msg.senderId === selfUser.id;
                          return (
                            <div key={msg.id} className="flex gap-3">
                              {sender.avatarUrl ? (
                                <img
                                  src={sender.avatarUrl}
                                  alt={sender.name}
                                  className="h-8 w-8 rounded-full object-cover"
                                />
                              ) : (
                                <div
                                  className="flex h-8 w-8 items-center justify-center rounded-full text-xs font-semibold text-white"
                                  style={{ backgroundColor: pickColor(sender.name) }}
                                >
                                  {getInitials(sender.name)}
                                </div>
                              )}
                              <div className="flex-1">
                                <div className={classNames("flex items-center gap-2 text-xs", darkMode ? "text-gray-400" : "text-gray-500")}>
                                  <span className={classNames("font-medium", darkMode ? "text-gray-200" : "text-gray-700")}>{isSelf ? "You" : sender.name}</span>
                                  <span>{new Date(msg.timestamp).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" })}</span>
                                </div>
                                <div className={classNames(
                                  "mt-1 rounded-lg px-3 py-2 text-sm",
                                  darkMode ? "bg-[#3d3d3d] text-gray-100" : "bg-gray-100 text-gray-800"
                                )}>
                                  {renderFormattedText(msg.content.replace(/@you\b/gi, `@${selfUser.name}`))}
                                </div>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>

                    {/* Channel message input */}
                    <div className={classNames("border-t p-4", darkMode ? "border-gray-700" : "border-gray-200")}>
                      <div className={classNames(
                        "flex items-center gap-2 rounded-lg border px-3 py-2",
                        darkMode ? "border-gray-600 bg-[#3d3d3d]" : "border-gray-300 bg-white"
                      )}>
                        <input
                          type="text"
                          placeholder={`Message #${selectedChannel.name}`}
                          className={classNames(
                            "flex-1 bg-transparent text-sm outline-none",
                            darkMode ? "text-gray-100 placeholder:text-gray-500" : "placeholder:text-gray-400"
                          )}
                          onKeyDown={(e) => {
                            if (e.key === "Enter" && (e.target as HTMLInputElement).value.trim()) {
                              const content = (e.target as HTMLInputElement).value.trim();
                              const newMessage = {
                                id: `ch-msg-${Date.now()}`,
                                senderId: selfUser.id,
                                content,
                                timestamp: Date.now(),
                              };
                              setChannelMessages((prev) => ({
                                ...prev,
                                [selectedChannel.id]: [...(prev[selectedChannel.id] || []), newMessage],
                              }));
                              (e.target as HTMLInputElement).value = "";
                            }
                          }}
                        />
                        <button className={classNames("rounded-md p-1.5", darkMode ? "text-gray-500 hover:text-[#a5a7f3]" : "text-gray-400 hover:text-[#5b5fc7]")}>
                          <Send size={18} />
                        </button>
                      </div>
                    </div>
                  </div>

                  {/* Members panel */}
                  {showChannelMembers && selectedTeam && (
                    <div className={classNames(
                      "w-64 border-l p-4 overflow-y-auto",
                      darkMode ? "border-gray-700 bg-[#2d2d2d]" : "border-gray-200 bg-white"
                    )}>
                      <h4 className={classNames("text-sm font-semibold mb-3", darkMode ? "text-gray-200" : "text-gray-700")}>Members ({selectedTeam.memberCount})</h4>
                      <div className="space-y-2">
                        {(selectedTeam.memberIds || []).slice(0, 10).map((memberId) => {
                          const member = getUserById(memberId);
                          if (!member) return null;
                          return (
                            <div key={memberId} className={classNames(
                              "flex items-center gap-2 rounded-md p-2",
                              darkMode ? "hover:bg-[#3d3d3d]" : "hover:bg-gray-50"
                            )}>
                              {member.avatarUrl ? (
                                <img src={member.avatarUrl} alt={member.name} className="h-8 w-8 rounded-full object-cover" />
                              ) : (
                                <div
                                  className="flex h-8 w-8 items-center justify-center rounded-full text-xs font-semibold text-white"
                                  style={{ backgroundColor: pickColor(member.name) }}
                                >
                                  {getInitials(member.name)}
                                </div>
                              )}
                              <div className="flex-1 min-w-0">
                                <p className={classNames("text-sm font-medium truncate", darkMode ? "text-gray-100" : "text-gray-900")}>{member.name}</p>
                                <p className={classNames("text-xs truncate", darkMode ? "text-gray-400" : "text-gray-500")}>{member.jobTitle || "Member"}</p>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  )}
                </div>
              </>
            ) : (
              <div className="flex flex-1 items-center justify-center">
                <div className="text-center">
                  <Hash size={48} className={classNames("mx-auto mb-4", darkMode ? "text-gray-500" : "text-gray-400")} />
                  <h3 className={classNames("text-lg font-medium", darkMode ? "text-gray-200" : "text-gray-700")}>Select a channel</h3>
                  <p className={classNames("text-sm", darkMode ? "text-gray-400" : "text-gray-500")}>Choose a channel to start chatting</p>
                </div>
              </div>
            )}
          </div>
        </div>
      ) : (
        <>
          {/* Announcement banner */}
          {showAnnouncement && (
            <div className={classNames("mx-4 mt-4 flex items-start gap-3 rounded-md p-3 shadow-sm", darkMode ? "bg-[#2d2d2d]" : "bg-white")}>
              <div className={classNames("flex h-6 w-6 items-center justify-center rounded-full", darkMode ? "bg-blue-900/50" : "bg-blue-100")}>
                <Bell size={14} className={darkMode ? "text-blue-400" : "text-blue-600"} />
              </div>
              <div className="flex-1">
                <p className={classNames("text-sm", darkMode ? "text-gray-300" : "text-gray-700")}>
                  <strong>Announcement</strong> As part of a recent update, some Teams you may have previously hidden are now visible again. If you'd prefer not to see them, you can easily hide them from your Teams view.
                </p>
              </div>
              <button
                className={classNames(darkMode ? "text-gray-500 hover:text-gray-300" : "text-gray-400 hover:text-gray-600")}
                onClick={() => setShowAnnouncement(false)}
              >
                <X size={16} />
              </button>
            </div>
          )}

          {/* Teams section */}
          <div className={classNames("flex-1 overflow-y-auto p-4", darkMode ? "dark-scrollbar" : "light-scrollbar")}>
            <button
              className={classNames("mb-3 flex items-center gap-2 rounded px-1 py-0.5 -ml-1 transition", darkMode ? "hover:bg-[#3d3d3d]" : "hover:bg-gray-100")}
              onClick={() => setTeamsExpanded(!teamsExpanded)}
            >
              {teamsExpanded ? (
                <ChevronDown size={16} className={darkMode ? "text-gray-400" : "text-gray-500"} />
              ) : (
                <ChevronRight size={16} className={darkMode ? "text-gray-400" : "text-gray-500"} />
              )}
              <span className={classNames("text-sm font-medium", darkMode ? "text-gray-300" : "text-gray-700")}>Teams</span>
            </button>

            {teamsExpanded && (
              <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5">
                {teams.map((team) => (
                  <TeamCard
                    key={team.id}
                    team={team}
                    darkMode={darkMode}
                    onClick={() => setRoute("teams", team.id)}
                  />
                ))}
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );

  // Chat detail panel
  const renderChatPanel = () => {
    if (!selectedConversation) {
      return (
        <div className={classNames(
          "flex h-full flex-1 flex-col items-center justify-center",
          darkMode ? "bg-[#1f1f1f]" : "bg-white"
        )}>
          <div className="text-center">
            <div className="mx-auto mb-4 flex h-32 w-32 items-center justify-center">
              <img
                src="data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 100 100'%3E%3Ccircle cx='50' cy='50' r='45' fill='%23f3f4f6'/%3E%3Cpath d='M30 40 Q50 60 70 40' stroke='%239ca3af' fill='none' stroke-width='3'/%3E%3Ccircle cx='35' cy='35' r='5' fill='%239ca3af'/%3E%3Ccircle cx='65' cy='35' r='5' fill='%239ca3af'/%3E%3C/svg%3E"
                alt="Chat illustration"
                className="h-24 w-24"
              />
            </div>
            <h3 className={classNames("text-xl font-semibold", darkMode ? "text-gray-100" : "text-gray-800")}>This is your space</h3>
            <p className={classNames("mt-2 max-w-sm text-sm", darkMode ? "text-gray-400" : "text-gray-500")}>
              This chat is just for you...with you. Use it for drafts, send files to yourself, or get to know chat features a little better.
            </p>
          </div>
        </div>
      );
    }

    return (
      <div className={classNames("flex h-full flex-1 flex-col", darkMode ? "bg-[#1f1f1f]" : "bg-white")}>
        {/* Chat header */}
        <div className={classNames(
          "flex items-center justify-between border-b px-4 py-3",
          darkMode ? "border-gray-700" : "border-gray-200"
        )}>
          <div className="flex items-center gap-3">
            {/* Avatar - 2x2 collage for group/meeting, single for direct */}
            {(() => {
              const isGroupOrMeeting = selectedConversation.type === "group" || selectedConversation.type === "meeting";
              const participantAvatars = isGroupOrMeeting && selectedConversation.participants
                ? selectedConversation.participants
                    .slice(0, 4)
                    .map((participantId) => {
                      const user = getUserById(participantId);
                      return user ? { id: user.id, avatarUrl: user.avatarUrl, name: user.name } : null;
                    })
                    .filter(Boolean) as { id: string; avatarUrl?: string; name: string }[]
                : [];

              if (isGroupOrMeeting && participantAvatars.length >= 2) {
                return (
                  <div className="grid grid-cols-2 gap-0.5 h-10 w-10 rounded-md overflow-hidden flex-shrink-0">
                    {participantAvatars.slice(0, 4).map((participant) => (
                      participant.avatarUrl ? (
                        <img
                          key={participant.id}
                          src={participant.avatarUrl}
                          alt={participant.name}
                          className="h-[19px] w-[19px] object-cover"
                        />
                      ) : (
                        <div
                          key={participant.id}
                          className="h-[19px] w-[19px] flex items-center justify-center text-[8px] font-semibold text-white"
                          style={{ backgroundColor: pickColor(participant.name) }}
                        >
                          {getInitials(participant.name)}
                        </div>
                      )
                    ))}
                    {participantAvatars.length < 4 && Array.from({ length: 4 - participantAvatars.length }).map((_, idx) => (
                      <div
                        key={`empty-${idx}`}
                        className="h-[19px] w-[19px]"
                        style={{ backgroundColor: selectedConversation.avatarColor || "#6264A7" }}
                      />
                    ))}
                  </div>
                );
              } else if (selectedConversation.avatarUrl) {
                return (
                  <img
                    src={selectedConversation.avatarUrl}
                    alt={selectedConversation.name}
                    className="h-10 w-10 rounded-full object-cover"
                  />
                );
              } else {
                return (
                  <div
                    className="flex h-10 w-10 items-center justify-center rounded-full text-sm font-semibold text-white"
                    style={{ backgroundColor: selectedConversation.avatarColor || "#6264A7" }}
                  >
                    {getInitials(selectedConversation.name)}
                  </div>
                );
              }
            })()}
            <div>
              <div className="flex items-center gap-2">
                <h3 className={classNames("font-semibold", darkMode ? "text-white" : "text-gray-900")}>{selectedConversation.name}</h3>
                {selectedConversation.isOnline && (
                  <span className="h-2.5 w-2.5 rounded-full bg-green-500" />
                )}
              </div>
              {selectedConversation.type === "direct" && (
                <div className={classNames("flex items-center gap-2 text-xs", darkMode ? "text-gray-400" : "text-gray-500")}>
                  <span>Chat</span>
                  <span>·</span>
                  <span>Shared</span>
                </div>
              )}
            </div>
          </div>
          <div className="flex items-center gap-1">
            {(() => {
              const isGroupOrMeeting = selectedConversation.type === "group" || selectedConversation.type === "meeting";
              const groupAvatars = isGroupOrMeeting
                ? (selectedConversation.participants || [])
                    .slice(0, 4)
                    .map((pid) => {
                      const u = getUserById(pid);
                      return u ? { id: u.id, avatarUrl: u.avatarUrl, name: u.name } : null;
                    })
                    .filter(Boolean) as { id: string; avatarUrl?: string; name: string }[]
                : undefined;
              return (
                <>
                  <button
                    className={classNames(
                      "rounded-md p-2",
                      darkMode ? "text-gray-400 hover:bg-[#3d3d3d]" : "text-gray-500 hover:bg-gray-100"
                    )}
                    onClick={() => startCall(selectedConversation.name, "video", selectedConversation.avatarUrl, selectedConversation.avatarColor, groupAvatars)}
                  >
                    <Video size={18} />
                  </button>
                  <button
                    className={classNames(
                      "rounded-md p-2",
                      darkMode ? "text-gray-400 hover:bg-[#3d3d3d]" : "text-gray-500 hover:bg-gray-100"
                    )}
                    onClick={() => startCall(selectedConversation.name, "audio", selectedConversation.avatarUrl, selectedConversation.avatarColor, groupAvatars)}
                  >
                    <Phone size={18} />
                  </button>
                </>
              );
            })()}
            <button
              className={classNames(
                "rounded-md p-2",
                conversationSearchOpen
                  ? darkMode ? "bg-[#3d3d3d] text-[#a5a7f3]" : "bg-gray-100 text-[#5b5fc7]"
                  : darkMode ? "text-gray-400 hover:bg-[#3d3d3d]" : "text-gray-500 hover:bg-gray-100"
              )}
              onClick={() => {
                setConversationSearchOpen(!conversationSearchOpen);
                if (conversationSearchOpen) setConversationSearchQuery("");
              }}
            >
              <Search size={18} />
            </button>
          </div>
        </div>

        {/* Conversation search bar */}
        {conversationSearchOpen && (
          <div className={classNames("border-b px-4 py-2", darkMode ? "border-gray-700" : "border-gray-200")}>
            <div className="relative">
              <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
              <input
                type="text"
                placeholder="Search in conversation..."
                value={conversationSearchQuery}
                onChange={(e) => setConversationSearchQuery(e.target.value)}
                autoFocus
                className={classNames(
                  "w-full rounded-md border py-2 pl-9 pr-3 text-sm focus:border-[#5b5fc7] focus:outline-none focus:ring-1 focus:ring-[#5b5fc7]",
                  darkMode ? "border-gray-600 bg-[#3d3d3d] text-gray-100 placeholder:text-gray-500" : "border-gray-300"
                )}
              />
              {conversationSearchQuery && (
                <button
                  onClick={() => setConversationSearchQuery("")}
                  className={classNames(
                    "absolute right-3 top-1/2 -translate-y-1/2",
                    darkMode ? "text-gray-500 hover:text-gray-300" : "text-gray-400 hover:text-gray-600"
                  )}
                >
                  <X size={16} />
                </button>
              )}
            </div>
            {conversationSearchQuery && (
              <p className={classNames("mt-1 text-xs", darkMode ? "text-gray-400" : "text-gray-500")}>
                {selectedMessages.filter((m) =>
                  m.content.toLowerCase().includes(conversationSearchQuery.toLowerCase())
                ).length} results found
              </p>
            )}
          </div>
        )}

        {/* Messages */}
        <div
          ref={messagesContainerRef}
          onScroll={handleMessagesScroll}
          className={classNames("flex-1 overflow-y-auto p-4", darkMode ? "dark-scrollbar" : "light-scrollbar")}
        >
          {selectedMessages.map((message, index) => {
            const sender = getUserById(message.senderId);
            const isSelf = message.senderId === selfUser.id;
            const showAvatar =
              index === 0 || selectedMessages[index - 1].senderId !== message.senderId;
            const isHovered = hoveredMessageId === message.id;
            const isEditing = editingMessageId === message.id;
            const replyToMessage = message.replyTo ? selectedMessages.find(m => m.id === message.replyTo) : null;

            // Check if message matches search query
            const searchMatch = conversationSearchQuery
              ? message.content.toLowerCase().includes(conversationSearchQuery.toLowerCase())
              : false;

            // If searching, dim non-matching messages
            const isSearching = conversationSearchOpen && conversationSearchQuery;

            return (
              <div
                key={message.id}
                className={classNames(
                  "mb-2 flex gap-3 group relative transition-opacity",
                  isSelf ? "justify-end" : "justify-start",
                  isSearching && !searchMatch && "opacity-30"
                )}
                onMouseEnter={() => setHoveredMessageId(message.id)}
                onMouseLeave={() => setHoveredMessageId(null)}
              >
                {!isSelf && showAvatar && (
                  sender?.avatarUrl ? (
                    <img
                      src={sender.avatarUrl}
                      alt={sender.name}
                      className="h-8 w-8 flex-shrink-0 rounded-full object-cover"
                    />
                  ) : (
                    <div
                      className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full text-xs font-semibold text-white"
                      style={{ backgroundColor: pickColor(sender?.name || "") }}
                    >
                      {getInitials(sender?.name || "U")}
                    </div>
                  )
                )}
                {!isSelf && !showAvatar && <div className="w-8" />}
                <div className={classNames("max-w-[70%]", isSelf ? "text-right" : "text-left")}>
                  {showAvatar && (
                    <div className={classNames("mb-1 flex items-center gap-2 text-xs", darkMode ? "text-gray-400" : "text-gray-500")}>
                      <span className={classNames("font-medium", darkMode ? "text-gray-200" : "text-gray-700")}>
                        {isSelf ? "You" : sender?.name || "Unknown"}
                      </span>
                      <span>{formatMessageTime(message.timestamp)}</span>
                    </div>
                  )}

                  {/* Reply reference */}
                  {replyToMessage && (
                    <div className={classNames(
                      "mb-1 flex items-center gap-1 text-xs border-l-2 pl-2",
                      darkMode ? "text-gray-400 border-gray-600" : "text-gray-500 border-gray-300"
                    )}>
                      <Reply size={12} />
                      <span className="truncate max-w-[200px]">{replyToMessage.content}</span>
                    </div>
                  )}

                  {/* Urgent indicator */}
                  {message.isUrgent && (
                    <div className="flex items-center gap-1 mb-1">
                      <span className="text-red-500 font-bold text-xs">!</span>
                      <span className="text-red-500 text-xs font-semibold uppercase">Urgent</span>
                    </div>
                  )}

                  {/* Message content or edit mode */}
                  {isEditing ? (
                    <div className="flex flex-col gap-2">
                      <input
                        type="text"
                        value={editingContent}
                        onChange={(e) => setEditingContent(e.target.value)}
                        className="rounded-lg border border-[#5b5fc7] px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#5b5fc7]"
                        autoFocus
                        onKeyDown={(e) => {
                          if (e.key === "Enter") {
                            handleEditMessage(message.id, editingContent);
                          } else if (e.key === "Escape") {
                            setEditingMessageId(null);
                            setEditingContent("");
                          }
                        }}
                      />
                      <div className="flex gap-2 text-xs">
                        <button
                          onClick={() => handleEditMessage(message.id, editingContent)}
                          className="text-[#5b5fc7] hover:underline"
                        >
                          Save
                        </button>
                        <button
                          onClick={() => { setEditingMessageId(null); setEditingContent(""); }}
                          className="text-gray-500 hover:underline"
                        >
                          Cancel
                        </button>
                      </div>
                    </div>
                  ) : message.content.startsWith("🎤 Voice message") ? (
                    /* Voice message player */
                    (() => {
                      const durationMatch = message.content.match(/\(([^)]+)\)/);
                      const duration = durationMatch?.[1] || "0:00";
                      const isPlaying = playingVoiceMessageId === message.id;
                      // Generate stable waveform heights based on message id
                      const waveformHeights = Array.from({ length: 20 }, (_, i) => {
                        const seed = message.id.charCodeAt(i % message.id.length) + i;
                        return ((seed * 7) % 16) + 4;
                      });
                      return (
                        <div
                          className={classNames(
                            "inline-flex items-center gap-3 rounded-lg px-3 py-2 text-sm",
                            isSelf
                              ? darkMode ? "bg-[#464775]" : "bg-[#e8ebfa]"
                              : darkMode ? "bg-[#3d3d3d]" : "bg-gray-100"
                          )}
                        >
                          <button
                            onClick={() => toggleVoicePlayback(message.id, duration)}
                            className={classNames(
                              "flex h-8 w-8 items-center justify-center rounded-full transition",
                              isPlaying
                                ? "bg-[#5b5fc7] text-white"
                                : "bg-[#5b5fc7]/20 text-[#5b5fc7] hover:bg-[#5b5fc7]/30"
                            )}
                          >
                            {isPlaying ? (
                              <Pause size={14} fill="currentColor" />
                            ) : (
                              <Play size={14} fill="currentColor" className="ml-0.5" />
                            )}
                          </button>
                          {/* Waveform visualization */}
                          <div className="flex items-center gap-0.5">
                            {waveformHeights.map((height, i) => (
                              <div
                                key={i}
                                className={classNames(
                                  "w-1 rounded-full transition-all",
                                  isPlaying ? "bg-[#5b5fc7] animate-pulse" : "bg-gray-400"
                                )}
                                style={{
                                  height: `${height}px`,
                                  animationDelay: isPlaying ? `${i * 50}ms` : "0ms"
                                }}
                              />
                            ))}
                          </div>
                          {/* Duration */}
                          <span className={classNames("text-xs min-w-[36px]", darkMode ? "text-gray-300" : "text-gray-500")}>
                            {duration}
                          </span>
                        </div>
                      );
                    })()
                  ) : (
                    <div
                      className={classNames(
                        "inline-block rounded-lg px-3 py-2 text-sm relative break-words whitespace-pre-wrap [overflow-wrap:break-word] [word-break:break-word]",
                        isSelf
                          ? darkMode ? "bg-[#464775] text-white" : "bg-[#e8ebfa] text-gray-800"
                          : darkMode ? "bg-[#3d3d3d] text-gray-100" : "bg-gray-100 text-gray-800",
                        searchMatch && "ring-2 ring-[#5b5fc7] ring-offset-1",
                        message.isUrgent && "border-l-3 border-red-500"
                      )}
                    >
                      {/* Render message with markdown formatting (**bold**, _italic_, @mentions) */}
                      {message.content && renderFormattedText(message.content.replace(/@you\b/gi, `@${selfUser.name}`))}
                    </div>
                  )}

                  {/* Attachments display */}
                  {message.attachments && message.attachments.length > 0 && (
                    <div className="mt-2 flex flex-wrap gap-2">
                      {message.attachments.map((attachment, attIndex) => (
                        <div
                          key={attIndex}
                          className={classNames(
                            "rounded-lg overflow-hidden",
                            attachment.type === "image" ? "max-w-[240px]" : darkMode ? "border border-gray-600 bg-[#3d3d3d] px-3 py-2" : "border border-gray-200 bg-gray-50 px-3 py-2"
                          )}
                        >
                          {attachment.type === "image" ? (
                            <div className="relative">
                              {attachment.url ? (
                                <img
                                  src={attachment.url}
                                  alt={attachment.name}
                                  className="w-[240px] h-[160px] object-cover"
                                  onError={(e) => {
                                    // Fallback to placeholder on error
                                    (e.target as HTMLImageElement).style.display = 'none';
                                    (e.target as HTMLImageElement).nextElementSibling?.classList.remove('hidden');
                                  }}
                                />
                              ) : null}
                              <div className={classNames("w-[240px] h-[160px] bg-gradient-to-br from-blue-100 to-purple-100 flex items-center justify-center", attachment.url ? "hidden" : "")}>
                                <Image size={48} className="text-gray-400" />
                              </div>
                              <div className="absolute bottom-0 left-0 right-0 bg-black/50 px-2 py-1 text-white text-xs">
                                {attachment.name}
                              </div>
                            </div>
                          ) : (
                            <div className="flex items-center gap-2">
                              <File size={16} className={darkMode ? "text-gray-400" : "text-gray-500"} />
                              <span className={classNames("text-sm", darkMode ? "text-gray-200" : "text-gray-700")}>{attachment.name}</span>
                              <span className={classNames("text-xs", darkMode ? "text-gray-500" : "text-gray-400")}>{attachment.size}</span>
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  )}

                  {/* Reactions display */}
                  {message.reactions && message.reactions.length > 0 && (
                    <div className="mt-1 flex flex-wrap gap-1">
                      {message.reactions.map((reaction, rIndex) => (
                        <button
                          key={rIndex}
                          onClick={() => handleAddReaction(message.id, reaction.emoji)}
                          className={classNames(
                            "inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-xs transition",
                            reaction.userIds.includes(selfUser.id)
                              ? darkMode ? "border-[#5b5fc7] bg-[#464775] text-[#a5a7f3]" : "border-[#5b5fc7] bg-[#e8ebfa] text-[#5b5fc7]"
                              : darkMode ? "border-gray-600 bg-[#3d3d3d] text-gray-200 hover:bg-[#4d4d4d]" : "border-gray-200 bg-white text-gray-600 hover:bg-gray-50"
                          )}
                        >
                          <span>{reaction.emoji}</span>
                          <span>{reaction.userIds.length}</span>
                        </button>
                      ))}
                    </div>
                  )}

                  {/* Hover action buttons */}
                  {isHovered && !isEditing && (
                    <div className={classNames(
                      "absolute -top-8 flex items-center gap-0.5 rounded-md border p-1 shadow-md z-10",
                      darkMode ? "border-gray-700 bg-[#2d2d2d]" : "border-gray-200 bg-white",
                      isSelf ? "right-0" : "left-8"
                    )}>
                      {QUICK_REACTIONS.slice(0, 4).map((emoji) => (
                        <button
                          key={emoji}
                          onClick={() => handleAddReaction(message.id, emoji)}
                          className={classNames("rounded p-1 text-sm", darkMode ? "hover:bg-[#3d3d3d]" : "hover:bg-gray-100")}
                          title={`React with ${emoji}`}
                        >
                          {emoji}
                        </button>
                      ))}
                      <button
                        onClick={() => setEmojiPickerForMessageId(message.id)}
                        className={classNames("rounded p-1", darkMode ? "hover:bg-[#3d3d3d] text-gray-400" : "hover:bg-gray-100 text-gray-500")}
                        title="More reactions"
                      >
                        <Smile size={16} />
                      </button>
                      <div className={classNames("w-px h-4 mx-1", darkMode ? "bg-gray-600" : "bg-gray-200")} />
                      <button
                        onClick={() => {
                          setReplyingToMessageId(message.id);
                          messageInputRef.current?.focus();
                        }}
                        className={classNames("rounded p-1", darkMode ? "hover:bg-[#3d3d3d] text-gray-400" : "hover:bg-gray-100 text-gray-500")}
                        title="Reply"
                      >
                        <Reply size={16} />
                      </button>
                      {isSelf && (
                        <>
                          <button
                            onClick={() => {
                              setEditingMessageId(message.id);
                              setEditingContent(message.content);
                            }}
                            className={classNames("rounded p-1", darkMode ? "hover:bg-[#3d3d3d] text-gray-400" : "hover:bg-gray-100 text-gray-500")}
                            title="Edit"
                          >
                            <Edit2 size={16} />
                          </button>
                          <button
                            onClick={() => {
                              if (window.confirm("Delete this message?")) {
                                handleDeleteMessage(message.id);
                              }
                            }}
                            className={classNames("rounded p-1 text-red-500", darkMode ? "hover:bg-[#3d3d3d]" : "hover:bg-gray-100")}
                            title="Delete"
                          >
                            <Trash2 size={16} />
                          </button>
                        </>
                      )}
                    </div>
                  )}

                  {/* Emoji picker for this message */}
                  {emojiPickerForMessageId === message.id && (
                    <div className={classNames(
                      "absolute top-full mt-1 z-20 rounded-lg border p-3 shadow-lg",
                      darkMode ? "border-gray-700 bg-[#2d2d2d]" : "border-gray-200 bg-white",
                      isSelf ? "right-0" : "left-8"
                    )}>
                      <div className="grid grid-cols-8 gap-1 max-h-48 overflow-y-auto">
                        {EMOJI_CATEGORIES.smileys.slice(0, 32).map((emoji) => (
                          <button
                            key={emoji}
                            onClick={() => handleAddReaction(message.id, emoji)}
                            className={classNames("rounded p-1 text-lg", darkMode ? "hover:bg-[#3d3d3d]" : "hover:bg-gray-100")}
                          >
                            {emoji}
                          </button>
                        ))}
                      </div>
                      <button
                        onClick={() => setEmojiPickerForMessageId(null)}
                        className={classNames("mt-2 w-full text-xs", darkMode ? "text-gray-400 hover:text-gray-200" : "text-gray-500 hover:text-gray-700")}
                      >
                        Close
                      </button>
                    </div>
                  )}
                </div>
              </div>
            );
          })}
          <div ref={messagesEndRef} />
        </div>

        {/* Message input */}
        <div className={classNames("border-t p-4", darkMode ? "border-gray-700" : "border-gray-200")}>
          {/* Reply indicator */}
          {replyingToMessageId && (
            <div className={classNames("mb-2 flex items-center justify-between rounded-md px-3 py-2 text-sm", darkMode ? "bg-[#3d3d3d]" : "bg-gray-50")}>
              <div className={classNames("flex items-center gap-2", darkMode ? "text-gray-300" : "text-gray-600")}>
                <Reply size={14} />
                <span>Replying to message</span>
              </div>
              <button
                onClick={() => setReplyingToMessageId(null)}
                className={classNames(darkMode ? "text-gray-500 hover:text-gray-300" : "text-gray-400 hover:text-gray-600")}
              >
                <X size={16} />
              </button>
            </div>
          )}

          {/* Attachments preview */}
          {attachments.length > 0 && (
            <div className="mb-2 flex flex-wrap gap-2">
              {attachments.map((attachment, index) => (
                <div
                  key={index}
                  className={classNames("flex items-center gap-2 rounded-md border px-3 py-2", darkMode ? "border-gray-600 bg-[#3d3d3d]" : "border-gray-200 bg-gray-50")}
                >
                  {attachment.type === "image" ? <Image size={16} className="text-blue-500" /> : <File size={16} className={darkMode ? "text-gray-400" : "text-gray-500"} />}
                  <span className={classNames("text-sm", darkMode ? "text-gray-200" : "text-gray-700")}>{attachment.name}</span>
                  <span className={classNames("text-xs", darkMode ? "text-gray-500" : "text-gray-400")}>{attachment.size}</span>
                  <button
                    onClick={() => handleRemoveAttachment(index)}
                    className="ml-1 text-gray-400 hover:text-red-500"
                  >
                    <X size={14} />
                  </button>
                </div>
              ))}
            </div>
          )}

          <form onSubmit={handleSendMessage} className="flex flex-col gap-2">
            {/* Format toolbar */}
            {showFormatToolbar && (
              <div className={classNames("flex items-center gap-1 rounded-md border p-1 mb-1", darkMode ? "border-gray-600 bg-[#3d3d3d]" : "border-gray-200 bg-white")}>
                <button
                  type="button"
                  onClick={() => handleFormat("bold")}
                  className={classNames("rounded p-1.5", darkMode ? "text-gray-300 hover:bg-gray-600" : "text-gray-600 hover:bg-gray-100")}
                  title="Bold (Ctrl+B)"
                >
                  <Bold size={16} />
                </button>
                <button
                  type="button"
                  onClick={() => handleFormat("italic")}
                  className={classNames("rounded p-1.5", darkMode ? "text-gray-300 hover:bg-gray-600" : "text-gray-600 hover:bg-gray-100")}
                  title="Italic (Ctrl+I)"
                >
                  <Italic size={16} />
                </button>
                <button
                  type="button"
                  onClick={() => handleFormat("code")}
                  className={classNames("rounded p-1.5", darkMode ? "text-gray-300 hover:bg-gray-600" : "text-gray-600 hover:bg-gray-100")}
                  title="Code"
                >
                  <Code size={16} />
                </button>
                <button
                  type="button"
                  onClick={() => handleFormat("link")}
                  className={classNames("rounded p-1.5", darkMode ? "text-gray-300 hover:bg-gray-600" : "text-gray-600 hover:bg-gray-100")}
                  title="Link (Ctrl+K)"
                >
                  <Link size={16} />
                </button>
              </div>
            )}

            <div className={classNames("relative flex items-center gap-2 rounded-lg border px-3 py-2 focus-within:border-[#5b5fc7] focus-within:ring-1 focus-within:ring-[#5b5fc7]", darkMode ? "border-gray-600 bg-[#3d3d3d]" : "border-gray-300 bg-white")}>
              <input
                ref={messageInputRef}
                type="text"
                value={messageInput}
                onChange={handleMessageInputChange}
                placeholder={t("typeNewMessage")}
                className={classNames("flex-1 bg-transparent text-sm outline-none", darkMode ? "text-gray-100 placeholder:text-gray-500" : "placeholder:text-gray-400")}
              />
              <button
                type="submit"
                disabled={!messageInput.trim() && attachments.length === 0}
                className={classNames(
                  "rounded-md p-1.5 transition",
                  messageInput.trim() || attachments.length > 0
                    ? "text-[#5b5fc7] hover:bg-[#e8ebfa]"
                    : "text-gray-300"
                )}
              >
                <Send size={18} />
              </button>

              {/* @Mention suggestions dropdown */}
              {showMentionSuggestions && mentionSuggestions.length > 0 && (
                <div className={classNames(
                  "absolute bottom-full left-0 mb-1 w-64 rounded-lg border py-1 shadow-lg z-20",
                  darkMode ? "border-gray-700 bg-[#2d2d2d]" : "border-gray-200 bg-white"
                )}>
                  <div className={classNames(
                    "px-3 py-1 text-xs border-b",
                    darkMode ? "text-gray-400 border-gray-700" : "text-gray-500 border-gray-100"
                  )}>
                    Suggestions
                  </div>
                  {mentionSuggestions.map((user) => (
                    <button
                      key={user.id}
                      type="button"
                      onClick={() => handleInsertMention(user)}
                      className={classNames(
                        "flex w-full items-center gap-3 px-3 py-2",
                        darkMode ? "hover:bg-[#3d3d3d]" : "hover:bg-gray-50"
                      )}
                    >
                      {user.avatarUrl ? (
                        <img src={user.avatarUrl} alt={user.name} className="h-8 w-8 rounded-full" />
                      ) : (
                        <div
                          className="flex h-8 w-8 items-center justify-center rounded-full text-xs font-semibold text-white"
                          style={{ backgroundColor: pickColor(user.name) }}
                        >
                          {getInitials(user.name)}
                        </div>
                      )}
                      <div className="text-left">
                        <div className={classNames("text-sm font-medium", darkMode ? "text-gray-100" : "text-gray-700")}>{user.name}</div>
                        <div className={classNames("text-xs", darkMode ? "text-gray-400" : "text-gray-500")}>{user.jobTitle}</div>
                      </div>
                    </button>
                  ))}
                </div>
              )}

              {/* Emoji picker popup */}
              {showEmojiPicker && (
                <div className={classNames(
                  "absolute bottom-full right-0 mb-1 w-80 rounded-lg border p-3 shadow-lg z-20",
                  darkMode ? "border-gray-700 bg-[#2d2d2d]" : "border-gray-200 bg-white"
                )}>
                  <div className="flex items-center justify-between mb-2">
                    <span className={classNames("text-sm font-medium", darkMode ? "text-gray-200" : "text-gray-700")}>Emojis</span>
                    <button
                      type="button"
                      onClick={() => setShowEmojiPicker(false)}
                      className={darkMode ? "text-gray-500 hover:text-gray-300" : "text-gray-400 hover:text-gray-600"}
                    >
                      <X size={16} />
                    </button>
                  </div>
                  <div className="mb-2">
                    <div className={classNames("text-xs mb-1", darkMode ? "text-gray-400" : "text-gray-500")}>Recently used</div>
                    <div className="flex gap-1">
                      {EMOJI_CATEGORIES.recent.map((emoji) => (
                        <button
                          key={emoji}
                          type="button"
                          onClick={() => handleInsertEmoji(emoji)}
                          className={classNames("rounded p-1.5 text-xl", darkMode ? "hover:bg-[#3d3d3d]" : "hover:bg-gray-100")}
                        >
                          {emoji}
                        </button>
                      ))}
                    </div>
                  </div>
                  <div className="mb-2">
                    <div className={classNames("text-xs mb-1", darkMode ? "text-gray-400" : "text-gray-500")}>Smileys & People</div>
                    <div className="grid grid-cols-8 gap-1 max-h-32 overflow-y-auto">
                      {EMOJI_CATEGORIES.smileys.map((emoji) => (
                        <button
                          key={emoji}
                          type="button"
                          onClick={() => handleInsertEmoji(emoji)}
                          className={classNames("rounded p-1 text-lg", darkMode ? "hover:bg-[#3d3d3d]" : "hover:bg-gray-100")}
                        >
                          {emoji}
                        </button>
                      ))}
                    </div>
                  </div>
                  <div>
                    <div className={classNames("text-xs mb-1", darkMode ? "text-gray-400" : "text-gray-500")}>Gestures</div>
                    <div className="grid grid-cols-8 gap-1 max-h-24 overflow-y-auto">
                      {EMOJI_CATEGORIES.gestures.map((emoji) => (
                        <button
                          key={emoji}
                          type="button"
                          onClick={() => handleInsertEmoji(emoji)}
                          className={classNames("rounded p-1 text-lg", darkMode ? "hover:bg-[#3d3d3d]" : "hover:bg-gray-100")}
                        >
                          {emoji}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>
              )}
            </div>

            <div className="flex items-center gap-1">
              <button
                type="button"
                className={classNames(
                  "rounded-md p-2",
                  showFormatToolbar
                    ? darkMode ? "bg-[#464775] text-[#a5a7f3]" : "bg-[#e8ebfa] text-[#5b5fc7]"
                    : darkMode ? "text-gray-400 hover:bg-[#3d3d3d]" : "text-gray-500 hover:bg-gray-100"
                )}
                onClick={() => setShowFormatToolbar(!showFormatToolbar)}
                title="Format text"
              >
                <span className="text-sm font-medium">A</span>
              </button>
              {/* Attach button with popup */}
              <div className="relative">
                <button
                  type="button"
                  className={classNames(
                    "rounded-md p-2",
                    showAttachmentMenu
                      ? darkMode ? "bg-[#464775] text-[#a5a7f3]" : "bg-[#e8ebfa] text-[#5b5fc7]"
                      : darkMode ? "text-gray-400 hover:bg-[#3d3d3d]" : "text-gray-500 hover:bg-gray-100"
                  )}
                  onClick={() => setShowAttachmentMenu(!showAttachmentMenu)}
                  title="Attach file"
                >
                  <Paperclip size={18} />
                </button>
                {/* Attachment menu popup */}
                {showAttachmentMenu && (
                  <div className={classNames(
                    "absolute bottom-full left-0 mb-2 rounded-lg border py-1 shadow-lg z-20 min-w-[200px]",
                    darkMode ? "border-gray-700 bg-[#2d2d2d]" : "border-gray-200 bg-white"
                  )}>
                    <button
                      type="button"
                      onClick={() => handleAddAttachment("file")}
                      className={classNames(
                        "flex w-full items-center gap-3 px-4 py-2 text-sm",
                        darkMode ? "text-gray-200 hover:bg-[#3d3d3d]" : "text-gray-700 hover:bg-gray-50"
                      )}
                    >
                      <FileText size={18} className="text-blue-500" />
                      Upload from computer
                    </button>
                    <button
                      type="button"
                      onClick={() => handleAddAttachment("image")}
                      className={classNames(
                        "flex w-full items-center gap-3 px-4 py-2 text-sm",
                        darkMode ? "text-gray-200 hover:bg-[#3d3d3d]" : "text-gray-700 hover:bg-gray-50"
                      )}
                    >
                      <Image size={18} className="text-green-500" />
                      Upload image
                    </button>
                  </div>
                )}
              </div>
              <button
                type="button"
                className={classNames(
                  "rounded-md p-2",
                  showEmojiPicker
                    ? darkMode ? "bg-[#464775] text-[#a5a7f3]" : "bg-[#e8ebfa] text-[#5b5fc7]"
                    : darkMode ? "text-gray-400 hover:bg-[#3d3d3d]" : "text-gray-500 hover:bg-gray-100"
                )}
                onClick={() => setShowEmojiPicker(!showEmojiPicker)}
                title="Add emoji"
              >
                <Smile size={18} />
              </button>
              <div className="flex-1" />
              {isRecording ? (
                <div className="flex items-center gap-2">
                  {/* Recording indicator */}
                  <div className={classNames("flex items-center gap-2 px-3 py-1 rounded-full", darkMode ? "bg-red-900/30" : "bg-red-50")}>
                    <span className="h-2 w-2 rounded-full bg-red-500 animate-pulse" />
                    <span className={classNames("text-sm font-medium", darkMode ? "text-red-400" : "text-red-600")}>
                      {formatRecordingTime(recordingDuration)}
                    </span>
                  </div>
                  {/* Cancel button */}
                  <button
                    type="button"
                    className={classNames(
                      "rounded-md p-2 hover:text-red-500",
                      darkMode ? "text-gray-400 hover:bg-[#3d3d3d]" : "text-gray-500 hover:bg-gray-100"
                    )}
                    onClick={cancelRecording}
                    title="Cancel recording"
                  >
                    <X size={18} />
                  </button>
                  {/* Send button */}
                  <button
                    type="button"
                    className="rounded-md p-2 bg-[#5b5fc7] text-white hover:bg-[#4a4eb5]"
                    onClick={sendVoiceMessage}
                    title="Send voice message"
                  >
                    <Send size={18} />
                  </button>
                </div>
              ) : (
                <button
                  type="button"
                  className={classNames(
                    "rounded-md p-2",
                    darkMode ? "text-gray-400 hover:bg-[#3d3d3d]" : "text-gray-500 hover:bg-gray-100"
                  )}
                  onClick={startRecording}
                  title="Record voice message"
                >
                  <Mic size={18} />
                </button>
              )}
            </div>
          </form>
        </div>
      </div>
    );
  };

  // ============================================================================
  // LOADING GATE
  // ============================================================================
  if (!apiConfig || apiLoading) {
    const isNetworkError = apiError && /failed to fetch|networkerror/i.test(apiError);
    const isNoSession = apiError && /409/.test(apiError);
    const isMismatch = apiError && /environment mismatch/i.test(apiError);
    return (
      <div className="flex items-center justify-center h-screen bg-white">
        <div className="text-center max-w-md px-6">
          <div className="text-4xl mb-3">💬</div>
          <h1 className="text-xl font-semibold mb-6 text-gray-900">MicroChat</h1>
          {!apiError ? (
            <>
              <div className="w-8 h-8 border-2 border-indigo-500 border-t-transparent rounded-full animate-spin mx-auto mb-4" />
              <p className="text-sm text-gray-500">Connecting to MicroChat...</p>
            </>
          ) : isNetworkError ? (
            <>
              <p className="font-medium mb-2 text-gray-900">Could not connect to the server</p>
              <p className="text-sm text-gray-500 mb-3">Make sure the API server is running on port 8000.</p>
              <p className="text-xs font-mono bg-gray-100 rounded px-3 py-2 text-gray-600 mt-2">uvicorn server.server:app --port 8000</p>
            </>
          ) : isNoSession ? (
            <>
              <p className="font-medium mb-2 text-gray-900">No scenario initialized</p>
              <p className="text-sm text-gray-500 mb-3">The server is running but no scenario has been loaded. Use the CLI harness or POST /init to start a scenario.</p>
              <p className="text-xs font-mono bg-gray-100 rounded px-3 py-2 text-gray-600 mt-2">python -m server.run_simulation &lt;scenario.json&gt;</p>
            </>
          ) : isMismatch ? (
            <>
              <p className="font-medium mb-2 text-gray-900">Wrong environment</p>
              <p className="text-sm text-gray-500 mb-3">{apiError}</p>
              <p className="text-sm text-gray-500">Navigate to the correct environment from the desktop, or re-init with a MicroChat scenario.</p>
            </>
          ) : (
            <>
              <p className="font-medium mb-2 text-gray-900">Connection Error</p>
              <p className="text-sm text-red-600">{apiError}</p>
            </>
          )}
        </div>
      </div>
    );
  }

  // ============================================================================
  // MAIN RENDER
  // ============================================================================

  return (
    <div className={classNames("flex h-screen flex-col transition-colors duration-200", darkMode ? "bg-[#1f1f1f]" : "bg-white")}>
      {/* Top header bar */}
      <header className="flex h-12 items-center justify-between border-b border-gray-200 bg-[#292929] px-4">
        <div className="flex items-center gap-4">
          {/* MicroChat logo */}
          <div className="flex items-center gap-2">
            <img src="desktop/teams-icon.png" alt="MicroChat" className="w-6 h-6 object-contain" />
          </div>

        </div>

        {/* Search bar */}
        <div className="flex-1 max-w-lg mx-4">
          <div className="relative">
            <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
            <input
              ref={searchInputRef}
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search (Ctrl+E)"
              className="w-full rounded-md border border-gray-600 bg-[#3d3d3d] py-1.5 pl-9 pr-4 text-sm text-white placeholder:text-gray-400 focus:border-[#5b5fc7] focus:outline-none"
            />
          </div>
        </div>

        {/* Right side */}
        <div className="flex items-center gap-3">
          {/* Organization */}
          <div className="flex items-center gap-2 text-sm text-gray-300">
            <span>The MicroCorporate</span>
          </div>

          {/* User avatar with profile dropdown */}
          <div className="relative" ref={profileDropdownRef}>
            <button
              onClick={() => setProfileDropdownOpen(!profileDropdownOpen)}
              className="relative h-8 w-8 rounded-full hover:ring-2 hover:ring-white/50"
              title="Profile and settings"
            >
              <img
                src={selfUser.avatarUrl}
                alt={selfUser.name}
                className="h-8 w-8 rounded-full object-cover"
              />
              {/* Status indicator */}
              <span className={classNames(
                "absolute -bottom-0.5 -right-0.5 h-3 w-3 rounded-full border-2 border-[#292929]",
                currentStatus === "available" && "bg-green-500",
                currentStatus === "busy" && "bg-red-500",
                currentStatus === "dnd" && "bg-red-600",
                currentStatus === "away" && "bg-yellow-500"
              )} />
            </button>

            {/* Profile dropdown */}
            {profileDropdownOpen && (
              <div className={classNames(
                "absolute right-0 top-10 w-72 rounded-lg border shadow-xl z-50",
                darkMode ? "border-gray-700 bg-[#2d2d2d]" : "border-gray-200 bg-white"
              )}>
                {/* Profile header */}
                <div className={classNames("p-4 border-b", darkMode ? "border-gray-700" : "border-gray-100")}>
                  <div className="flex items-center gap-3">
                    <div className="relative">
                      <img
                        src={selfUser.avatarUrl}
                        alt={selfUser.name}
                        className="h-12 w-12 rounded-full object-cover"
                      />
                      <span className={classNames(
                        "absolute -bottom-0.5 -right-0.5 h-3.5 w-3.5 rounded-full border-2",
                        darkMode ? "border-[#2d2d2d]" : "border-white",
                        currentStatus === "available" && "bg-green-500",
                        currentStatus === "busy" && "bg-red-500",
                        currentStatus === "dnd" && "bg-red-600",
                        currentStatus === "away" && "bg-yellow-500"
                      )} />
                    </div>
                    <div className="flex-1">
                      <div className={classNames("font-semibold", darkMode ? "text-white" : "text-gray-900")}>{selfUser.name}</div>
                      <div className={classNames("text-xs", darkMode ? "text-gray-400" : "text-gray-500")}>{selfUser.email}</div>
                    </div>
                  </div>

                  {/* Status selector */}
                  <div className="mt-3">
                    <button
                      onClick={() => setStatusMenuOpen(!statusMenuOpen)}
                      className={classNames(
                        "flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-sm",
                        darkMode ? "text-gray-200 hover:bg-[#3d3d3d]" : "text-gray-700 hover:bg-gray-100"
                      )}
                    >
                      <span className={classNames(
                        "h-2.5 w-2.5 rounded-full",
                        currentStatus === "available" && "bg-green-500",
                        currentStatus === "busy" && "bg-red-500",
                        currentStatus === "dnd" && "bg-red-600",
                        currentStatus === "away" && "bg-yellow-500"
                      )} />
                      <span className="flex-1 text-left">
                        {currentStatus === "available" && "Available"}
                        {currentStatus === "busy" && "Busy"}
                        {currentStatus === "dnd" && "Do not disturb"}
                        {currentStatus === "away" && "Away"}
                      </span>
                      <ChevronDown size={14} className={classNames("transition", statusMenuOpen && "rotate-180")} />
                    </button>

                    {statusMenuOpen && (
                      <div className={classNames(
                        "mt-1 rounded-md border py-1 shadow-sm",
                        darkMode ? "border-gray-700 bg-[#2d2d2d]" : "border-gray-200 bg-white"
                      )}>
                        <button
                          onClick={() => { setCurrentStatus("available"); setStatusMenuOpen(false); }}
                          className={classNames(
                            "flex w-full items-center gap-2 px-3 py-1.5 text-sm",
                            darkMode ? "text-gray-200 hover:bg-[#3d3d3d]" : "hover:bg-gray-100"
                          )}
                        >
                          <span className="h-2.5 w-2.5 rounded-full bg-green-500" />
                          Available
                        </button>
                        <button
                          onClick={() => { setCurrentStatus("busy"); setStatusMenuOpen(false); }}
                          className={classNames(
                            "flex w-full items-center gap-2 px-3 py-1.5 text-sm",
                            darkMode ? "text-gray-200 hover:bg-[#3d3d3d]" : "hover:bg-gray-100"
                          )}
                        >
                          <span className="h-2.5 w-2.5 rounded-full bg-red-500" />
                          Busy
                        </button>
                        <button
                          onClick={() => { setCurrentStatus("dnd"); setStatusMenuOpen(false); }}
                          className={classNames(
                            "flex w-full items-center gap-2 px-3 py-1.5 text-sm",
                            darkMode ? "text-gray-200 hover:bg-[#3d3d3d]" : "hover:bg-gray-100"
                          )}
                        >
                          <span className="h-2.5 w-2.5 rounded-full bg-red-600" />
                          Do not disturb
                        </button>
                        <button
                          onClick={() => { setCurrentStatus("away"); setStatusMenuOpen(false); }}
                          className={classNames(
                            "flex w-full items-center gap-2 px-3 py-1.5 text-sm",
                            darkMode ? "text-gray-200 hover:bg-[#3d3d3d]" : "hover:bg-gray-100"
                          )}
                        >
                          <span className="h-2.5 w-2.5 rounded-full bg-yellow-500" />
                          Away
                        </button>
                      </div>
                    )}
                  </div>

                </div>

                {/* Menu items */}
                <div className="py-1">
                  <button
                    onClick={() => { setShowSettingsModal(true); setProfileDropdownOpen(false); }}
                    className={classNames(
                      "flex w-full items-center gap-3 px-4 py-2 text-sm",
                      darkMode ? "text-gray-200 hover:bg-[#3d3d3d]" : "text-gray-700 hover:bg-gray-100"
                    )}
                  >
                    <Settings size={16} className={darkMode ? "text-gray-400" : "text-gray-500"} />
                    Settings
                  </button>
                  <button
                    onClick={() => { setShowKeyboardShortcuts(true); setProfileDropdownOpen(false); }}
                    className={classNames(
                      "flex w-full items-center gap-3 px-4 py-2 text-sm",
                      darkMode ? "text-gray-200 hover:bg-[#3d3d3d]" : "text-gray-700 hover:bg-gray-100"
                    )}
                  >
                    <Keyboard size={16} className={darkMode ? "text-gray-400" : "text-gray-500"} />
                    Keyboard shortcuts
                  </button>
                  <button
                    onClick={() => { setDarkMode(!darkMode); setProfileDropdownOpen(false); }}
                    className={classNames(
                      "flex w-full items-center gap-3 px-4 py-2 text-sm",
                      darkMode ? "text-gray-200 hover:bg-[#3d3d3d]" : "text-gray-700 hover:bg-gray-100"
                    )}
                  >
                    {darkMode ? <Sun size={16} className="text-gray-400" /> : <Moon size={16} className="text-gray-500" />}
                    {darkMode ? "Light mode" : "Dark mode"}
                  </button>
                </div>

                {/* Sign out */}
                <div className={classNames("border-t py-1", darkMode ? "border-gray-700" : "border-gray-100")}>
                  <button
                    onClick={() => { setProfileDropdownOpen(false); setIsSignedOut(true); }}
                    className={classNames(
                      "flex w-full items-center gap-3 px-4 py-2 text-sm",
                      darkMode ? "text-gray-200 hover:bg-[#3d3d3d]" : "text-gray-700 hover:bg-gray-100"
                    )}
                  >
                    <LogOut size={16} className={darkMode ? "text-gray-400" : "text-gray-500"} />
                    Sign out
                  </button>
                </div>
              </div>
            )}
          </div>

        </div>
      </header>

      {/* Main content */}
      <div className="flex flex-1 overflow-hidden">
        {/* Left icon sidebar */}
        {renderIconSidebar()}

        {/* Content area based on view */}
        {currentView === "chat" && (
          <>
            {renderChatSidebar()}
            {renderChatPanel()}
          </>
        )}

        {currentView === "teams" && renderTeamsSidebar()}

        {currentView === "calendar" && (
          <div className={classNames("flex h-full flex-1 flex-col", darkMode ? "bg-[#1f1f1f]" : "bg-[#f5f5f5]")}>
            {/* Calendar Header */}
            <div className={classNames("flex items-center justify-between border-b px-6 py-4", darkMode ? "border-gray-700 bg-[#2d2d2d]" : "border-gray-200 bg-white")}>
              <div className="flex items-center gap-4">
                <h2 className={classNames("text-xl font-semibold", darkMode ? "text-white" : "text-gray-900")}>{t("calendar")}</h2>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => {
                      const newDate = new Date(calendarDate);
                      if (calendarView === "day") newDate.setDate(newDate.getDate() - 1);
                      else if (calendarView === "week") newDate.setDate(newDate.getDate() - 7);
                      else newDate.setMonth(newDate.getMonth() - 1);
                      setCalendarDate(newDate);
                    }}
                    className={classNames("rounded-md p-1", darkMode ? "text-gray-300 hover:bg-[#3d3d3d]" : "hover:bg-gray-100")}
                  >
                    <ChevronLeft size={20} />
                  </button>
                  <span className={classNames("text-sm font-medium min-w-[200px] text-center", darkMode ? "text-gray-300" : "text-gray-700")}>
                    {calendarView === "day" && calendarDate.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' })}
                    {calendarView === "week" && (() => {
                      const startOfWeek = new Date(calendarDate);
                      startOfWeek.setDate(startOfWeek.getDate() - startOfWeek.getDay());
                      const endOfWeek = new Date(startOfWeek);
                      endOfWeek.setDate(endOfWeek.getDate() + 6);
                      return `${startOfWeek.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })} - ${endOfWeek.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}`;
                    })()}
                    {calendarView === "month" && calendarDate.toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}
                  </span>
                  <button
                    onClick={() => {
                      const newDate = new Date(calendarDate);
                      if (calendarView === "day") newDate.setDate(newDate.getDate() + 1);
                      else if (calendarView === "week") newDate.setDate(newDate.getDate() + 7);
                      else newDate.setMonth(newDate.getMonth() + 1);
                      setCalendarDate(newDate);
                    }}
                    className={classNames("rounded-md p-1", darkMode ? "text-gray-300 hover:bg-[#3d3d3d]" : "hover:bg-gray-100")}
                  >
                    <ChevronRight size={20} />
                  </button>
                </div>
              </div>
              <div className="flex items-center gap-2">
                {/* View switcher */}
                <div className={classNames("flex rounded-md border", darkMode ? "border-gray-600" : "border-gray-300")}>
                  <button
                    onClick={() => setCalendarView("day")}
                    className={classNames(
                      "px-3 py-1.5 text-sm font-medium rounded-l-md transition",
                      calendarView === "day"
                        ? "bg-[#5b5fc7] text-white"
                        : darkMode ? "text-gray-300 hover:bg-[#3d3d3d]" : "text-gray-700 hover:bg-gray-100"
                    )}
                  >
                    {t("day")}
                  </button>
                  <button
                    onClick={() => setCalendarView("week")}
                    className={classNames(
                      "px-3 py-1.5 text-sm font-medium border-x transition",
                      darkMode ? "border-gray-600" : "border-gray-300",
                      calendarView === "week"
                        ? "bg-[#5b5fc7] text-white"
                        : darkMode ? "text-gray-300 hover:bg-[#3d3d3d]" : "text-gray-700 hover:bg-gray-100"
                    )}
                  >
                    {t("week")}
                  </button>
                  <button
                    onClick={() => setCalendarView("month")}
                    className={classNames(
                      "px-3 py-1.5 text-sm font-medium rounded-r-md transition",
                      calendarView === "month"
                        ? "bg-[#5b5fc7] text-white"
                        : darkMode ? "text-gray-300 hover:bg-[#3d3d3d]" : "text-gray-700 hover:bg-gray-100"
                    )}
                  >
                    {t("month")}
                  </button>
                </div>
                <button
                  onClick={() => setCalendarDate(new Date())}
                  className={classNames("rounded-md px-3 py-1.5 text-sm font-medium", darkMode ? "text-[#a5a7f3] hover:bg-[#3d3d3d]" : "text-[#5b5fc7] hover:bg-[#e8ebfa]")}
                >
                  {t("today")}
                </button>
                <button
                  onClick={() => setShowNewMeetingModal(true)}
                  className="flex items-center gap-2 rounded-md bg-[#5b5fc7] px-3 py-1.5 text-sm font-medium text-white hover:bg-[#4a4eb5]"
                >
                  <Plus size={16} />
                  {t("newMeeting")}
                </button>
              </div>
            </div>

            {/* Calendar Grid */}
            <div className="flex flex-1 overflow-hidden">
              {/* Day/Week View with time column */}
              {(calendarView === "day" || calendarView === "week") && (
                <>
                  {/* Time column */}
                  <div className={classNames("w-20 flex-shrink-0 border-r", darkMode ? "border-gray-700 bg-[#2d2d2d]" : "border-gray-200 bg-white")}>
                    {calendarView === "week" && <div className="h-8 border-b" style={{ borderColor: darkMode ? '#374151' : '#e5e7eb' }} />}
                    {Array.from({ length: 12 }, (_, i) => i + 8).map((hour) => (
                      <div key={hour} className={classNames("h-16 border-b px-2 py-1 text-right text-xs", darkMode ? "border-gray-700 text-gray-400" : "border-gray-100 text-gray-500")}>
                        {hour > 12 ? `${hour - 12} PM` : hour === 12 ? '12 PM' : `${hour} AM`}
                      </div>
                    ))}
                  </div>

                  {/* Events column(s) */}
                  <div className={classNames("flex-1 overflow-y-auto", darkMode ? "bg-[#2d2d2d] dark-scrollbar" : "bg-white light-scrollbar")}>
                    {calendarView === "day" ? (
                      <div className="relative">
                        {/* Hour grid lines */}
                        <div className="pointer-events-none">
                          {Array.from({ length: 12 }, (_, i) => (
                            <div key={i} className={classNames("h-16 border-b", darkMode ? "border-gray-700" : "border-gray-100")} />
                          ))}
                        </div>

                        {/* Events overlay */}
                        <div className="absolute inset-0 p-1 pointer-events-none">
                          {(() => {
                            const selectedDate = new Date(calendarDate);
                            selectedDate.setHours(0, 0, 0, 0);
                            const eventsForDay = calendarEvents.filter(event => {
                              const eventDate = new Date(event.date);
                              eventDate.setHours(0, 0, 0, 0);
                              return eventDate.getTime() === selectedDate.getTime();
                            });

                            if (eventsForDay.length === 0) {
                              return (
                                <div className="flex h-full items-center justify-center pointer-events-auto">
                                  <div className={classNames("text-center", darkMode ? "text-gray-400" : "text-gray-500")}>
                                    <Calendar size={48} className="mx-auto mb-2 opacity-50" />
                                    <p className="text-sm">{t("noEventsScheduled")}</p>
                                  </div>
                                </div>
                              );
                            }

                            return eventsForDay.map((event) => {
                              const timeParts = event.time.split(':');
                              let startHour = parseInt(timeParts[0]);
                              if (event.time.toLowerCase().includes('pm') && startHour !== 12) startHour += 12;
                              if (event.time.toLowerCase().includes('am') && startHour === 12) startHour = 0;
                              const topOffset = (startHour - 8) * 64;
                              const height = event.duration.includes('2h') ? 128 : event.duration.includes('1h') ? 64 : 32;

                              return (
                                <div
                                  key={event.id}
                                  className={classNames(
                                    "absolute left-2 right-2 rounded-md p-2 cursor-pointer transition hover:opacity-90 hover:shadow-md pointer-events-auto",
                                    event.type === "meeting" ? "bg-[#e8ebfa] border-l-4 border-[#5b5fc7]" : "bg-green-50 border-l-4 border-green-500"
                                  )}
                                  style={{ top: `${topOffset}px`, height: `${height - 4}px`, zIndex: 20 }}
                                  onClick={() => triggerToast(`Opening: ${event.title}`, "info")}
                                >
                                  <div className="text-sm font-medium text-gray-800">{event.title}</div>
                                  <div className="text-xs text-gray-500">{event.time} · {event.duration}</div>
                                  {event.attendees > 0 && (
                                    <div className="mt-1 flex items-center gap-1 text-xs text-gray-500">
                                      <Users size={12} />
                                      {event.attendees} attendees
                                    </div>
                                  )}
                                </div>
                              );
                            });
                          })()}
                        </div>
                      </div>
                    ) : (
                      /* Week View */
                      <div className="flex">
                        {Array.from({ length: 7 }, (_, dayIndex) => {
                          const startOfWeek = new Date(calendarDate);
                          startOfWeek.setDate(startOfWeek.getDate() - startOfWeek.getDay() + dayIndex);
                          const dayEvents = calendarEvents.filter(event => {
                            const eventDate = new Date(event.date);
                            eventDate.setHours(0, 0, 0, 0);
                            const dayDate = new Date(startOfWeek);
                            dayDate.setHours(0, 0, 0, 0);
                            return eventDate.getTime() === dayDate.getTime();
                          });
                          const isToday = startOfWeek.toDateString() === new Date().toDateString();
                          return (
                            <div key={dayIndex} className={classNames("flex-1 border-r relative", darkMode ? "border-gray-700" : "border-gray-200")}>
                              <div className={classNames("h-8 border-b text-center text-xs font-medium py-1 sticky top-0 z-10", darkMode ? "border-gray-700 bg-[#2d2d2d] text-gray-300" : "border-gray-200 bg-white text-gray-700", isToday && "bg-[#e8ebfa]")}>
                                {startOfWeek.toLocaleDateString('en-US', { weekday: 'short' })} {startOfWeek.getDate()}
                              </div>
                              <div className="relative">
                                {Array.from({ length: 12 }, (_, i) => (
                                  <div key={i} className={classNames("h-16 border-b", darkMode ? "border-gray-700" : "border-gray-100")} />
                                ))}
                                {dayEvents.map((event) => {
                                  const timeParts = event.time.split(':');
                                  let startHour = parseInt(timeParts[0]);
                                  if (event.time.toLowerCase().includes('pm') && startHour !== 12) startHour += 12;
                                  const topOffset = (startHour - 8) * 64 + 32;
                                  const height = event.duration.includes('2h') ? 128 : event.duration.includes('1h') ? 64 : 32;
                                  return (
                                    <div
                                      key={event.id}
                                      className="absolute left-1 right-1 rounded p-1 cursor-pointer bg-[#e8ebfa] border-l-2 border-[#5b5fc7] text-xs"
                                      style={{ top: `${topOffset}px`, height: `${height - 4}px`, zIndex: 20 }}
                                      onClick={() => triggerToast(`Opening: ${event.title}`, "info")}
                                    >
                                      <div className="font-medium text-gray-800 truncate">{event.title}</div>
                                    </div>
                                  );
                                })}
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>
                </>
              )}

              {/* Month View */}
              {calendarView === "month" && (
                <div className={classNames("flex-1 overflow-y-auto p-4", darkMode ? "bg-[#2d2d2d] dark-scrollbar" : "bg-white light-scrollbar")}>
                  <div className="grid grid-cols-7 gap-px bg-gray-200 rounded-lg overflow-hidden">
                    {/* Header row */}
                    {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map(day => (
                      <div key={day} className={classNames("p-2 text-center text-sm font-medium", darkMode ? "bg-[#3d3d3d] text-gray-300" : "bg-gray-50 text-gray-700")}>
                        {day}
                      </div>
                    ))}
                    {/* Days grid */}
                    {(() => {
                      const firstDay = new Date(calendarDate.getFullYear(), calendarDate.getMonth(), 1);
                      const lastDay = new Date(calendarDate.getFullYear(), calendarDate.getMonth() + 1, 0);
                      const startPadding = firstDay.getDay();
                      const totalDays = lastDay.getDate();
                      const days = [];

                      for (let i = 0; i < startPadding; i++) {
                        days.push(<div key={`pad-${i}`} className={classNames("p-2 min-h-[80px]", darkMode ? "bg-[#1f1f1f]" : "bg-gray-50")} />);
                      }

                      for (let day = 1; day <= totalDays; day++) {
                        const date = new Date(calendarDate.getFullYear(), calendarDate.getMonth(), day);
                        const isToday = date.toDateString() === new Date().toDateString();
                        const dayEvents = calendarEvents.filter(event => {
                          const eventDate = new Date(event.date);
                          return eventDate.toDateString() === date.toDateString();
                        });

                        days.push(
                          <div key={day} className={classNames("p-2 min-h-[80px]", darkMode ? "bg-[#2d2d2d]" : "bg-white")}>
                            <div className={classNames("text-sm mb-1", isToday ? "text-[#5b5fc7] font-bold" : darkMode ? "text-gray-300" : "text-gray-700")}>
                              {day}
                            </div>
                            {dayEvents.slice(0, 2).map(event => (
                              <div
                                key={event.id}
                                className="text-xs p-1 mb-1 rounded bg-[#e8ebfa] text-[#5b5fc7] truncate cursor-pointer"
                                onClick={() => triggerToast(`Opening: ${event.title}`, "info")}
                              >
                                {event.title}
                              </div>
                            ))}
                            {dayEvents.length > 2 && (
                              <div className="text-xs text-gray-500">+{dayEvents.length - 2} more</div>
                            )}
                          </div>
                        );
                      }

                      return days;
                    })()}
                  </div>
                </div>
              )}
            </div>

            {/* New Meeting Modal */}
            {showNewMeetingModal && (
              <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
                <div className="w-full max-w-md rounded-lg bg-white p-6 shadow-xl">
                  <div className="flex items-center justify-between mb-4">
                    <h3 className="text-lg font-semibold text-gray-900">{t("newMeeting")}</h3>
                    <button onClick={() => setShowNewMeetingModal(false)} className="text-gray-400 hover:text-gray-600">
                      <X size={20} />
                    </button>
                  </div>
                  <form onSubmit={(e) => {
                    e.preventDefault();
                    const form = e.target as HTMLFormElement;
                    const titleInput = form.querySelector('input[name="title"]') as HTMLInputElement;
                    const dateInput = form.querySelector('input[name="date"]') as HTMLInputElement;
                    const timeInput = form.querySelector('input[name="time"]') as HTMLInputElement;

                    if (titleInput.value && dateInput.value && timeInput.value) {
                      const [hours, minutes] = timeInput.value.split(':');
                      const hour = parseInt(hours);
                      const formattedTime = `${hour > 12 ? hour - 12 : hour}:${minutes} ${hour >= 12 ? 'PM' : 'AM'}`;

                      const newEvent = {
                        id: `event-${Date.now()}`,
                        title: titleInput.value,
                        time: formattedTime,
                        duration: "1h",
                        type: "meeting" as const,
                        attendees: 0,
                        date: new Date(dateInput.value + 'T' + timeInput.value),
                      };
                      setCalendarEvents(prev => [...prev, newEvent]);
                      setShowNewMeetingModal(false);
                      triggerToast(t("meetingScheduled"), "success");
                    }
                  }}>
                    <div className="space-y-4">
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">{t("title")}</label>
                        <input name="title" type="text" placeholder={t("addTitle")} required className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-[#5b5fc7] focus:outline-none focus:ring-1 focus:ring-[#5b5fc7]" />
                      </div>
                      <div className="flex gap-4">
                        <div className="flex-1">
                          <label className="block text-sm font-medium text-gray-700 mb-1">{t("date")}</label>
                          <input name="date" type="date" required defaultValue={calendarDate.toISOString().split('T')[0]} className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-[#5b5fc7] focus:outline-none focus:ring-1 focus:ring-[#5b5fc7]" />
                        </div>
                        <div className="flex-1">
                          <label className="block text-sm font-medium text-gray-700 mb-1">{t("time")}</label>
                          <input name="time" type="time" required defaultValue="09:00" className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-[#5b5fc7] focus:outline-none focus:ring-1 focus:ring-[#5b5fc7]" />
                        </div>
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">{t("addAttendees")}</label>
                        <input type="text" placeholder={t("enterNamesOrEmails")} className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-[#5b5fc7] focus:outline-none focus:ring-1 focus:ring-[#5b5fc7]" />
                      </div>
                    </div>
                    <div className="mt-6 flex justify-end gap-2">
                      <button type="button" onClick={() => setShowNewMeetingModal(false)} className="rounded-md px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-100">
                        {t("cancel")}
                      </button>
                      <button
                        type="submit"
                        className="rounded-md bg-[#5b5fc7] px-4 py-2 text-sm font-medium text-white hover:bg-[#4a4eb5]"
                      >
                        {t("schedule")}
                      </button>
                    </div>
                  </form>
                </div>
              </div>
            )}
          </div>
        )}

        {currentView === "calls" && (
          <div className={classNames("flex h-full flex-1 flex-col", darkMode ? "bg-[#1f1f1f]" : "bg-[#f5f5f5]")}>
            {/* Calls Header */}
            <div className={classNames("flex items-center justify-between border-b px-6 py-4", darkMode ? "border-gray-700 bg-[#2d2d2d]" : "border-gray-200 bg-white")}>
              <h2 className={classNames("text-xl font-semibold", darkMode ? "text-white" : "text-gray-900")}>{t("calls")}</h2>
            </div>

            {/* Call History */}
            <div className={classNames("flex-1 overflow-y-auto p-4", darkMode ? "dark-scrollbar" : "light-scrollbar")}>
              <div className="mb-4">
                <h3 className={classNames("text-sm font-medium mb-3", darkMode ? "text-gray-300" : "text-gray-700")}>{t("recent")}</h3>
                <div className="space-y-2">
                  {apiCalls.map((call) => {
                    const callUser = call.userId ? getUserById(call.userId) : null;
                    return (
                    <div
                      key={call.id}
                      className={classNames("flex items-center justify-between rounded-lg p-4 shadow-sm cursor-pointer", darkMode ? "bg-[#2d2d2d] hover:bg-[#3d3d3d]" : "bg-white hover:bg-gray-50")}
                      onClick={() => startCall(call.name, "audio", callUser?.avatarUrl, pickColor(call.name))}
                    >
                      <div className="flex items-center gap-4">
                        <div className="relative">
                          {callUser?.avatarUrl ? (
                            <img
                              src={callUser.avatarUrl}
                              alt={call.name}
                              className="h-12 w-12 rounded-full object-cover"
                            />
                          ) : (
                            <div
                              className="flex h-12 w-12 items-center justify-center rounded-full text-sm font-semibold text-white"
                              style={{ backgroundColor: pickColor(call.name) }}
                            >
                              {getInitials(call.name)}
                            </div>
                          )}
                          {call.type === "group" && (
                            <div className={classNames("absolute -bottom-1 -right-1 rounded-full p-0.5", darkMode ? "bg-[#2d2d2d]" : "bg-white")}>
                              <Users size={14} className={darkMode ? "text-gray-400" : "text-gray-500"} />
                            </div>
                          )}
                        </div>
                        <div>
                          <div className="flex items-center gap-2">
                            <span className={classNames("font-medium", call.missed ? "text-red-500" : darkMode ? "text-white" : "text-gray-900")}>
                              {call.name}
                            </span>
                            {call.missed && <span className="text-xs text-red-500">Missed</span>}
                          </div>
                          <div className={classNames("flex items-center gap-2 text-sm", darkMode ? "text-gray-400" : "text-gray-500")}>
                            {call.type === "incoming" && <PhoneIncoming size={14} />}
                            {call.type === "outgoing" && <PhoneOutgoing size={14} />}
                            {call.type === "group" && <Users size={14} />}
                            {call.missed && <PhoneMissed size={14} className="text-red-500" />}
                            <span>{call.time}</span>
                            {call.duration && <span>· {call.duration}</span>}
                          </div>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <button
                          onClick={(e) => { e.stopPropagation(); startCall(call.name, "video", callUser?.avatarUrl, pickColor(call.name)); }}
                          className={classNames("rounded-full p-2", darkMode ? "text-gray-400 hover:bg-[#4d4d4d]" : "text-gray-500 hover:bg-gray-100")}
                        >
                          <Video size={20} />
                        </button>
                        <button
                          onClick={(e) => { e.stopPropagation(); startCall(call.name, "audio", callUser?.avatarUrl, pickColor(call.name)); }}
                          className={classNames("rounded-full p-2", darkMode ? "text-gray-400 hover:bg-[#4d4d4d]" : "text-gray-500 hover:bg-gray-100")}
                        >
                          <Phone size={20} />
                        </button>
                      </div>
                    </div>
                  );
                  })}
                </div>
              </div>

              {/* Speed Dial */}
              <div>
                <h3 className={classNames("text-sm font-medium mb-3", darkMode ? "text-gray-300" : "text-gray-700")}>{t("speedDial")}</h3>
                <div className="grid grid-cols-4 gap-3">
                  {Array.from(allKnownUsers.values()).slice(0, 8).map((user) => (
                    <button
                      key={user.id}
                      onClick={() => startCall(user.name, "audio", user.avatarUrl, pickColor(user.name))}
                      className={classNames("flex flex-col items-center gap-2 rounded-lg p-4 shadow-sm", darkMode ? "bg-[#2d2d2d] hover:bg-[#3d3d3d]" : "bg-white hover:bg-gray-50")}
                    >
                      {user.avatarUrl ? (
                        <img src={user.avatarUrl} alt={user.name} className="h-12 w-12 rounded-full" />
                      ) : (
                        <div
                          className="flex h-12 w-12 items-center justify-center rounded-full text-sm font-semibold text-white"
                          style={{ backgroundColor: pickColor(user.name) }}
                        >
                          {getInitials(user.name)}
                        </div>
                      )}
                      <span className={classNames("text-xs font-medium text-center truncate w-full", darkMode ? "text-gray-300" : "text-gray-700")}>{user.name}</span>
                    </button>
                  ))}
                </div>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Settings Modal */}
      {showSettingsModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <div className={classNames(
            "w-full max-w-2xl rounded-lg shadow-xl max-h-[80vh] flex flex-col",
            darkMode ? "bg-[#2d2d2d]" : "bg-white"
          )}>
            <div className={classNames(
              "flex items-center justify-between border-b px-6 py-4 flex-shrink-0",
              darkMode ? "border-gray-700" : "border-gray-200"
            )}>
              <h2 className={classNames("text-lg font-semibold", darkMode ? "text-white" : "text-gray-900")}>{t("settings")}</h2>
              <button onClick={() => setShowSettingsModal(false)} className={darkMode ? "text-gray-400 hover:text-gray-200" : "text-gray-400 hover:text-gray-600"}>
                <X size={20} />
              </button>
            </div>
            <div className="flex-1 min-h-0 overflow-y-auto p-6">
              <div className="space-y-6">
                {/* General settings */}
                <div>
                  <h3 className={classNames("text-sm font-medium mb-4", darkMode ? "text-white" : "text-gray-900")}>{t("general")}</h3>
                  <div className="space-y-4">
                    <div className="flex items-center justify-between">
                      <div>
                        <div className={classNames("text-sm font-medium", darkMode ? "text-gray-200" : "text-gray-700")}>{t("theme")}</div>
                        <div className={classNames("text-xs", darkMode ? "text-gray-400" : "text-gray-500")}>{t("themeDesc")}</div>
                      </div>
                      <select
                        value={darkMode ? "dark" : "light"}
                        onChange={(e) => setDarkMode(e.target.value === "dark")}
                        className={classNames(
                          "rounded-md border px-3 py-1.5 text-sm focus:border-[#5b5fc7] focus:outline-none",
                          darkMode ? "border-gray-600 bg-[#3d3d3d] text-gray-100" : "border-gray-300"
                        )}
                      >
                        <option value="light">{t("light")}</option>
                        <option value="dark">{t("dark")}</option>
                      </select>
                    </div>
                    <div className="flex items-center justify-between">
                      <div>
                        <div className={classNames("text-sm font-medium", darkMode ? "text-gray-200" : "text-gray-700")}>{t("language")}</div>
                        <div className={classNames("text-xs", darkMode ? "text-gray-400" : "text-gray-500")}>{t("languageDesc")}</div>
                      </div>
                      <select
                        value={language}
                        onChange={(e) => setLanguage(e.target.value as Language)}
                        className={classNames(
                          "rounded-md border px-3 py-1.5 text-sm focus:border-[#5b5fc7] focus:outline-none",
                          darkMode ? "border-gray-600 bg-[#3d3d3d] text-gray-100" : "border-gray-300"
                        )}
                      >
                        <option value="en">English</option>
                        <option value="es">Español</option>
                        <option value="fr">Français</option>
                        <option value="de">Deutsch</option>
                      </select>
                    </div>
                  </div>
                </div>

                {/* Notifications settings */}
                <div className={classNames("border-t pt-6", darkMode ? "border-gray-700" : "border-gray-200")}>
                  <h3 className={classNames("text-sm font-medium mb-4", darkMode ? "text-white" : "text-gray-900")}>{t("notifications")}</h3>
                  <div className="space-y-4">
                    <label className="flex items-center justify-between cursor-pointer">
                      <div>
                        <div className={classNames("text-sm font-medium", darkMode ? "text-gray-200" : "text-gray-700")}>{t("desktopNotifications")}</div>
                        <div className={classNames("text-xs", darkMode ? "text-gray-400" : "text-gray-500")}>{t("desktopNotificationsDesc")}</div>
                      </div>
                      <input type="checkbox" defaultChecked className="h-4 w-4 rounded border-gray-300 text-[#5b5fc7] focus:ring-[#5b5fc7]" />
                    </label>
                    <label className="flex items-center justify-between cursor-pointer">
                      <div>
                        <div className={classNames("text-sm font-medium", darkMode ? "text-gray-200" : "text-gray-700")}>{t("soundNotifications")}</div>
                        <div className={classNames("text-xs", darkMode ? "text-gray-400" : "text-gray-500")}>{t("soundNotificationsDesc")}</div>
                      </div>
                      <input type="checkbox" defaultChecked className="h-4 w-4 rounded border-gray-300 text-[#5b5fc7] focus:ring-[#5b5fc7]" />
                    </label>
                    <label className="flex items-center justify-between cursor-pointer">
                      <div>
                        <div className={classNames("text-sm font-medium", darkMode ? "text-gray-200" : "text-gray-700")}>{t("emailNotifications")}</div>
                        <div className={classNames("text-xs", darkMode ? "text-gray-400" : "text-gray-500")}>{t("emailNotificationsDesc")}</div>
                      </div>
                      <input type="checkbox" className="h-4 w-4 rounded border-gray-300 text-[#5b5fc7] focus:ring-[#5b5fc7]" />
                    </label>
                  </div>
                </div>

                {/* Privacy settings */}
                <div className={classNames("border-t pt-6", darkMode ? "border-gray-700" : "border-gray-200")}>
                  <h3 className={classNames("text-sm font-medium mb-4", darkMode ? "text-white" : "text-gray-900")}>{t("privacy")}</h3>
                  <div className="space-y-4">
                    <label className="flex items-center justify-between cursor-pointer">
                      <div>
                        <div className={classNames("text-sm font-medium", darkMode ? "text-gray-200" : "text-gray-700")}>{t("readReceipts")}</div>
                        <div className={classNames("text-xs", darkMode ? "text-gray-400" : "text-gray-500")}>{t("readReceiptsDesc")}</div>
                      </div>
                      <input type="checkbox" defaultChecked className="h-4 w-4 rounded border-gray-300 text-[#5b5fc7] focus:ring-[#5b5fc7]" />
                    </label>
                    <label className="flex items-center justify-between cursor-pointer">
                      <div>
                        <div className={classNames("text-sm font-medium", darkMode ? "text-gray-200" : "text-gray-700")}>{t("onlineStatus")}</div>
                        <div className={classNames("text-xs", darkMode ? "text-gray-400" : "text-gray-500")}>{t("onlineStatusDesc")}</div>
                      </div>
                      <input type="checkbox" defaultChecked className="h-4 w-4 rounded border-gray-300 text-[#5b5fc7] focus:ring-[#5b5fc7]" />
                    </label>
                  </div>
                </div>
              </div>
            </div>
            <div className={classNames(
              "flex justify-end gap-2 border-t px-6 py-4 flex-shrink-0",
              darkMode ? "border-gray-700" : "border-gray-200"
            )}>
              <button
                onClick={() => setShowSettingsModal(false)}
                className={classNames(
                  "rounded-md px-4 py-2 text-sm font-medium",
                  darkMode ? "text-gray-200 hover:bg-[#3d3d3d]" : "text-gray-700 hover:bg-gray-100"
                )}
              >
                {t("cancel")}
              </button>
              <button
                onClick={() => { setShowSettingsModal(false); triggerToast(t("settingsSaved"), "success"); }}
                className="rounded-md bg-[#5b5fc7] px-4 py-2 text-sm font-medium text-white hover:bg-[#4a4eb5]"
              >
                {t("saveChanges")}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Keyboard Shortcuts Modal */}
      {showKeyboardShortcuts && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <div className="w-full max-w-md rounded-lg bg-white shadow-xl">
            <div className="flex items-center justify-between border-b border-gray-200 px-6 py-4">
              <h2 className="text-lg font-semibold text-gray-900">Keyboard shortcuts</h2>
              <button onClick={() => setShowKeyboardShortcuts(false)} className="text-gray-400 hover:text-gray-600">
                <X size={20} />
              </button>
            </div>
            <div className="p-6 max-h-96 overflow-y-auto">
              <div className="space-y-3">
                {KEYBOARD_SHORTCUTS.map((shortcut, index) => (
                  <div key={index} className="flex items-center justify-between py-2">
                    <span className="text-sm text-gray-700">{shortcut.description}</span>
                    <kbd className="rounded-md border border-gray-200 bg-gray-50 px-2 py-1 text-xs font-mono text-gray-600">
                      {shortcut.key}
                    </kbd>
                  </div>
                ))}
              </div>
            </div>
            <div className="flex justify-end border-t border-gray-200 px-6 py-4">
              <button
                onClick={() => setShowKeyboardShortcuts(false)}
                className="rounded-md bg-[#5b5fc7] px-4 py-2 text-sm font-medium text-white hover:bg-[#4a4eb5]"
              >
                Got it
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Toast */}
      {toast && (
        <div
          role="status"
          className={classNames(
            "fixed bottom-6 right-6 z-30 max-w-sm rounded-xl px-4 py-3 text-sm shadow-lg",
            toast.tone === "success"
              ? "border border-emerald-200 bg-emerald-50 text-emerald-700"
              : toast.tone === "error"
              ? "border border-rose-200 bg-rose-50 text-rose-700"
              : "bg-slate-900/90 text-white"
          )}
        >
          {toast.message}
        </div>
      )}

      {/* Calling Modal */}
      {callingModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70">
          <div className={classNames("w-full max-w-sm rounded-xl p-8 text-center shadow-2xl", darkMode ? "bg-[#2d2d2d]" : "bg-white")}>
            {/* Avatar — composite for groups, image for direct users, initials as fallback */}
            {callingModal.participantAvatars && callingModal.participantAvatars.length >= 2 ? (
              <div className="mx-auto mb-4 grid h-24 w-24 grid-cols-2 gap-0.5 overflow-hidden rounded-xl">
                {callingModal.participantAvatars.slice(0, 4).map((p) => (
                  p.avatarUrl ? (
                    <img
                      key={p.id}
                      src={p.avatarUrl}
                      alt={p.name}
                      className="h-full w-full object-cover"
                    />
                  ) : (
                    <div
                      key={p.id}
                      className="flex h-full w-full items-center justify-center text-sm font-semibold text-white"
                      style={{ backgroundColor: pickColor(p.name) }}
                    >
                      {getInitials(p.name)}
                    </div>
                  )
                ))}
                {callingModal.participantAvatars.length < 4 && Array.from({ length: 4 - callingModal.participantAvatars.length }).map((_, idx) => (
                  <div
                    key={`empty-${idx}`}
                    className="h-full w-full"
                    style={{ backgroundColor: callingModal.avatarColor || "#6264A7" }}
                  />
                ))}
              </div>
            ) : callingModal.avatarUrl ? (
              <img
                src={callingModal.avatarUrl}
                alt={callingModal.recipientName}
                className="mx-auto mb-4 h-24 w-24 rounded-full object-cover"
              />
            ) : (
              <div
                className="mx-auto mb-4 flex h-24 w-24 items-center justify-center rounded-full text-3xl font-bold text-white"
                style={{ backgroundColor: callingModal.avatarColor || pickColor(callingModal.recipientName) }}
              >
                {getInitials(callingModal.recipientName)}
              </div>
            )}

            {/* Name and status */}
            <h2 className={classNames("mb-2 text-xl font-semibold", darkMode ? "text-white" : "text-gray-900")}>
              {callingModal.recipientName}
            </h2>

            {callingModal.status === "calling" ? (
              <>
                <p className={classNames("mb-6", darkMode ? "text-gray-400" : "text-gray-500")}>
                  {callingModal.callType === "video" ? "Video calling..." : "Calling..."}
                </p>
                {/* Animated dots */}
                <div className="flex justify-center gap-1 mb-6">
                  <div className="h-2 w-2 animate-bounce rounded-full bg-[#5b5fc7]" style={{ animationDelay: "0ms" }} />
                  <div className="h-2 w-2 animate-bounce rounded-full bg-[#5b5fc7]" style={{ animationDelay: "150ms" }} />
                  <div className="h-2 w-2 animate-bounce rounded-full bg-[#5b5fc7]" style={{ animationDelay: "300ms" }} />
                </div>
              </>
            ) : (
              <>
                <p className="mb-6 text-red-500 font-medium">
                  {callingModal.recipientName} didn&apos;t answer
                </p>
                <div className="mb-6 flex justify-center">
                  <PhoneMissed size={32} className="text-red-500" />
                </div>
              </>
            )}

            {/* Actions */}
            <div className="flex justify-center gap-4">
              <button
                onClick={() => setCallingModal(null)}
                className="flex items-center gap-2 rounded-full bg-red-500 px-6 py-3 text-white hover:bg-red-600 transition"
              >
                <Phone size={20} className="rotate-[135deg]" />
                <span>End</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Create Channel Modal */}
      {showCreateChannelModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <div className="w-full max-w-md rounded-lg bg-white p-6 shadow-xl">
            <h2 className="mb-4 text-lg font-semibold text-gray-900">Create a channel</h2>
            <p className="mb-4 text-sm text-gray-500">
              Channels are where your team communicates. They&apos;re best when organized around a topic.
            </p>
            <div className="mb-4">
              <label className="mb-1 block text-sm font-medium text-gray-700">
                Channel name
              </label>
              <div className="flex items-center gap-2 rounded-md border border-gray-300 px-3 py-2 focus-within:border-[#5b5fc7] focus-within:ring-1 focus-within:ring-[#5b5fc7]">
                <Hash size={16} className="text-gray-400" />
                <input
                  type="text"
                  value={newChannelName}
                  onChange={(e) => setNewChannelName(e.target.value)}
                  placeholder="e.g. project-updates"
                  className="flex-1 border-none outline-none text-sm"
                  autoFocus
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && newChannelName.trim()) {
                      handleCreateChannel();
                    }
                  }}
                />
              </div>
            </div>
            <div className="flex justify-end gap-3">
              <button
                onClick={() => {
                  setShowCreateChannelModal(false);
                  setNewChannelName("");
                }}
                className="rounded-md px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-100"
              >
                Cancel
              </button>
              <button
                onClick={handleCreateChannel}
                disabled={!newChannelName.trim()}
                className="rounded-md bg-[#5b5fc7] px-4 py-2 text-sm font-medium text-white hover:bg-[#4a4eb5] disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Create
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Lock screen overlay */}
      {isSignedOut && (
        <div className="fixed inset-0 z-50 flex items-center justify-center" style={{ backgroundColor: "rgba(0,0,0,0.5)", backdropFilter: "blur(6px)" }}>
          <div className="bg-white rounded-lg shadow-2xl p-8 w-[360px] flex flex-col items-center">
            <div className="text-2xl font-bold mb-6" style={{ color: "#6264A7" }}>MicroChat</div>
            <div className="w-20 h-20 rounded-full flex items-center justify-center text-white text-2xl font-bold mb-4" style={{ backgroundColor: "#6264A7" }}>
              {selfUser?.name?.split(" ").map((n: string) => n[0]).join("") || "U"}
            </div>
            <div className="text-lg font-semibold text-gray-900 mb-1">{selfUser?.name || "User"}</div>
            <div className="text-sm text-gray-500 mb-6">{selfUser?.email || "user@microchat.com"}</div>
            <input type="password" readOnly value="••••••••" className="w-full px-4 py-2 border border-gray-300 rounded mb-4 text-center text-gray-400 bg-gray-50" />
            <button onClick={() => setIsSignedOut(false)} className="w-full py-2 text-white rounded font-semibold hover:opacity-90 transition-opacity" style={{ backgroundColor: "#6264A7" }}>
              Sign in
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

// ============================================================================
// SUB-COMPONENTS
// ============================================================================

interface ConversationRowProps {
  conversation: ChatConversation;
  isSelected: boolean;
  onClick: () => void;
  onToggleFavorite: (conversationId: string) => void;
  lookupUser?: (id: string) => { id: string; avatarUrl?: string; name: string } | undefined;
  darkMode?: boolean;
}

const ConversationRow = ({ conversation, isSelected, onClick, onToggleFavorite, lookupUser, darkMode = false }: ConversationRowProps) => {
  const isUnread = conversation.unreadCount > 0;
  const isGroupOrMeeting = conversation.type === "group" || conversation.type === "meeting";

  // Get participant avatars for group/meeting chats (up to 4)
  const participantAvatars = useMemo(() => {
    if (!isGroupOrMeeting) return [];
    return conversation.participants
      .slice(0, 4)
      .map(pid => {
        const user = lookupUser ? lookupUser(pid) : undefined;
        return user ? { id: pid, avatarUrl: user.avatarUrl, name: user.name } : null;
      })
      .filter(Boolean) as { id: string; avatarUrl?: string; name: string }[];
  }, [conversation.participants, isGroupOrMeeting, lookupUser]);

  return (
    <button
      onClick={onClick}
      className={classNames(
        "flex w-full items-center gap-3 px-4 py-2.5 text-left transition group",
        isSelected
          ? darkMode ? "bg-[#464775]" : "bg-[#e8ebfa]"
          : darkMode ? "hover:bg-[#3d3d3d]" : "hover:bg-gray-50"
      )}
    >
      {/* Avatar - 2x2 collage for group/meeting, single for direct */}
      <div className="relative flex-shrink-0">
        {isGroupOrMeeting && participantAvatars.length >= 2 ? (
          <div className="grid grid-cols-2 gap-0.5 h-10 w-10 rounded-md overflow-hidden">
            {participantAvatars.slice(0, 4).map((participant) => (
              participant.avatarUrl ? (
                <img
                  key={participant.id}
                  src={participant.avatarUrl}
                  alt={participant.name}
                  className="h-[19px] w-[19px] object-cover"
                />
              ) : (
                <div
                  key={participant.id}
                  className="h-[19px] w-[19px] flex items-center justify-center text-[8px] font-semibold text-white"
                  style={{ backgroundColor: pickColor(participant.name) }}
                >
                  {getInitials(participant.name)}
                </div>
              )
            ))}
            {/* Fill empty slots if less than 4 participants */}
            {participantAvatars.length < 4 && Array.from({ length: 4 - participantAvatars.length }).map((_, idx) => (
              <div
                key={`empty-${idx}`}
                className="h-[19px] w-[19px]"
                style={{ backgroundColor: conversation.avatarColor || "#6264A7" }}
              />
            ))}
          </div>
        ) : conversation.avatarUrl ? (
          <img
            src={conversation.avatarUrl}
            alt={conversation.name}
            className="h-10 w-10 rounded-full object-cover"
          />
        ) : (
          <div
            className="flex h-10 w-10 items-center justify-center rounded-full text-sm font-semibold text-white"
            style={{ backgroundColor: conversation.avatarColor || "#6264A7" }}
          >
            {getInitials(conversation.name)}
          </div>
        )}
        {conversation.isOnline && (
          <span className="absolute bottom-0 right-0 h-3 w-3 rounded-full border-2 border-white bg-green-500" />
        )}
      </div>

      {/* Content */}
      <div className="min-w-0 flex-1">
        <div className="flex items-center justify-between">
          <span
            className={classNames(
              "truncate text-sm",
              isUnread
                ? darkMode ? "font-semibold text-white" : "font-semibold text-gray-900"
                : darkMode ? "text-gray-200" : "text-gray-700"
            )}
          >
            {conversation.name}
            {conversation.type === "group" && (
              <span className={darkMode ? "text-gray-400" : "text-gray-500"}>(External)</span>
            )}
          </span>
          <div className="flex items-center gap-1 flex-shrink-0">
            <button
              onClick={(e) => {
                e.stopPropagation();
                onToggleFavorite(conversation.id);
              }}
              className={classNames(
                "p-0.5 rounded opacity-0 group-hover:opacity-100 transition-opacity",
                conversation.isPinned
                  ? "opacity-100 text-yellow-500"
                  : darkMode ? "text-gray-500 hover:text-yellow-500" : "text-gray-400 hover:text-yellow-500"
              )}
              title={conversation.isPinned ? "Remove from favorites" : "Add to favorites"}
            >
              <Star size={14} fill={conversation.isPinned ? "currentColor" : "none"} />
            </button>
            <span className={classNames("text-xs", darkMode ? "text-gray-400" : "text-gray-500")}>
              {conversation.lastMessage && formatTimestamp(conversation.lastMessage.timestamp)}
            </span>
          </div>
        </div>
        <div className="flex items-center gap-1">
          <p
            className={classNames(
              "truncate text-xs",
              isUnread
                ? darkMode ? "font-medium text-gray-200" : "font-medium text-gray-700"
                : darkMode ? "text-gray-400" : "text-gray-500"
            )}
          >
            {conversation.lastMessage?.senderId === "user000" && "You: "}
            {conversation.lastMessage?.content || "No messages yet"}
          </p>
          {conversation.type === "meeting" && (
            <span className={classNames("flex-shrink-0", darkMode ? "text-gray-500" : "text-gray-400")}>
              <Video size={12} />
            </span>
          )}
        </div>
      </div>

      {/* Unread badge */}
      {isUnread && (
        <span className="flex h-5 min-w-[20px] items-center justify-center rounded-full bg-[#5b5fc7] px-1.5 text-xs font-medium text-white">
          {conversation.unreadCount}
        </span>
      )}
    </button>
  );
};

interface TeamCardProps {
  team: Team;
  onClick: () => void;
  darkMode?: boolean;
}

const TeamCard = ({ team, onClick, darkMode = false }: TeamCardProps) => (
  <button
    onClick={onClick}
    className={classNames(
      "group flex flex-col overflow-hidden rounded-lg border shadow-sm transition hover:shadow-md",
      darkMode ? "border-gray-700 bg-[#2d2d2d]" : "border-gray-200 bg-white"
    )}
  >
    {/* Avatar area */}
    {team.avatarUrl ? (
      <div className="h-24 w-full">
        <img
          src={team.avatarUrl}
          alt={team.name}
          className="h-full w-full object-cover"
        />
      </div>
    ) : (
      <div
        className="flex h-24 items-center justify-center"
        style={{ backgroundColor: team.avatarColor }}
      >
        {team.avatarInitials ? (
          <span className="text-2xl font-bold text-white">{team.avatarInitials}</span>
        ) : (
          <Users size={32} className="text-white/80" />
        )}
      </div>
    )}

    {/* Info */}
    <div className={classNames("flex items-center justify-between p-3", darkMode ? "bg-[#2d2d2d]" : "")}>
      <span className={classNames("truncate text-sm font-medium", darkMode ? "text-gray-200" : "text-gray-800")}>{team.name}</span>
      <div className="relative">
        <button
          className={classNames("rounded p-1 text-gray-400 opacity-0 transition group-hover:opacity-100 peer", darkMode ? "hover:bg-[#3d3d3d]" : "hover:bg-gray-100")}
          onClick={(e) => {
            e.stopPropagation();
            const menu = e.currentTarget.nextElementSibling;
            if (menu) {
              menu.classList.toggle('hidden');
            }
          }}
        >
          <MoreHorizontal size={16} />
        </button>
        <div className={classNames("hidden absolute right-0 top-full z-50 mt-1 min-w-[160px] rounded-lg border py-1 shadow-lg", darkMode ? "border-gray-600 bg-[#2d2d2d]" : "border-gray-200 bg-white")}>
          <button
            onClick={(e) => {
              e.stopPropagation();
              e.currentTarget.parentElement?.classList.add('hidden');
            }}
            className={classNames("flex w-full items-center gap-2 px-3 py-2 text-sm", darkMode ? "text-gray-200 hover:bg-[#3d3d3d]" : "text-gray-700 hover:bg-gray-50")}
          >
            <Star size={14} />
            Add to favorites
          </button>
          <button
            onClick={(e) => {
              e.stopPropagation();
              e.currentTarget.parentElement?.classList.add('hidden');
            }}
            className={classNames("flex w-full items-center gap-2 px-3 py-2 text-sm", darkMode ? "text-gray-200 hover:bg-[#3d3d3d]" : "text-gray-700 hover:bg-gray-50")}
          >
            <Bell size={14} />
            Mute notifications
          </button>
          <button
            onClick={(e) => {
              e.stopPropagation();
              e.currentTarget.parentElement?.classList.add('hidden');
            }}
            className={classNames("flex w-full items-center gap-2 px-3 py-2 text-sm", darkMode ? "text-gray-200 hover:bg-[#3d3d3d]" : "text-gray-700 hover:bg-gray-50")}
          >
            <Settings size={14} />
            Team settings
          </button>
          <div className={classNames("my-1 border-t", darkMode ? "border-gray-600" : "border-gray-200")} />
          <button
            onClick={(e) => {
              e.stopPropagation();
              e.currentTarget.parentElement?.classList.add('hidden');
            }}
            className={classNames("flex w-full items-center gap-2 px-3 py-2 text-sm text-red-500", darkMode ? "hover:bg-[#3d3d3d]" : "hover:bg-gray-50")}
          >
            <LogOut size={14} />
            Leave team
          </button>
        </div>
      </div>
    </div>
  </button>
);

export default MicroChat;
