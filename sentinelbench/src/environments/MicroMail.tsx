import {
  useState,
  useEffect,
  useRef,
  useMemo,
  useCallback,
  type ChangeEvent,
  type FormEvent,
  type KeyboardEvent as ReactKeyboardEvent,
} from "react";

import { useMicromailData } from "../hooks/useMicromailData";
import {
  Archive,
  ArrowDown,
  ArrowUp,
  AtSign,
  ChevronDown,
  CircleDot,
  Clock,
  Flag,
  Globe,
  Inbox,
  Mail,
  MailOpen,
  MapPin,
  Menu,
  Paperclip,
  PenSquare,
  Search,
  Send,
  Star,
  Trash2,
  Users,
  X,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";

export const TASK_ID_MICROMAIL = "micromail";

// ============================================================================
// TYPE DEFINITIONS
// ============================================================================

type FolderKey = "inbox" | "sent" | "drafts" | "archive" | "junk" | "deleted" | "scheduled";
type QuickFilter = "all" | "unread" | "flagged" | "mentions";

interface SenderInfo {
  name: string;
  email: string;
  initials: string;
  color: string;
  avatarUrl?: string;
}

interface Attachment {
  id: string;
  name: string;
  size: string;
  url?: string;
}

interface MeetingDetails {
  date: string;
  time: string;
  location: string;
}

type ImportanceLevel = "high" | "normal" | "low";

interface Email {
  id: string;
  folder: FolderKey;
  sender: SenderInfo;
  recipients: string[];
  cc?: string[];
  subject: string;
  preview: string;
  body: string;
  timestamp: string;
  isRead: boolean;
  isFlagged: boolean;
  isExternal?: boolean;
  isCC?: boolean;
  hasAttachment?: boolean;
  attachments?: Attachment[];
  mentionsMe?: boolean;
  meetingDetails?: MeetingDetails;
  importance?: ImportanceLevel;
}

interface ToastState {
  message: string;
  tone: "success" | "info" | "error";
}

const FOLDER_DEFINITIONS: Array<{ 
  key: FolderKey;
  label: string;
  icon: LucideIcon;
  isFavorite?: boolean;
}> = [
  { key: "inbox", label: "Inbox", icon: Inbox, isFavorite: true },
  { key: "sent", label: "Sent Items", icon: Send, isFavorite: true },
  { key: "drafts", label: "Drafts", icon: PenSquare },
  { key: "archive", label: "Archive", icon: Archive, isFavorite: true },
  { key: "junk", label: "Junk Email", icon: MailOpen },
  { key: "deleted", label: "Deleted Items", icon: Trash2, isFavorite: true },
  { key: "scheduled", label: "Scheduled", icon: Users },
];

const QUICK_FILTERS: Array<{ key: QuickFilter; label: string; icon: LucideIcon; description: string }> = [
  { key: "all", label: "All", icon: MailOpen, description: "Show every conversation in this folder" },
  { key: "unread", label: "Unread", icon: Mail, description: "Only conversations that are still unread" },
  { key: "flagged", label: "Flagged", icon: Flag, description: "Items you've flagged for follow-up" },
  { key: "mentions", label: "Mentions", icon: AtSign, description: "Messages where you were mentioned" },
];

const FOLDER_KEYS: FolderKey[] = ["inbox", "sent", "drafts", "archive", "junk", "deleted", "scheduled"];

const colorPalette = ["#2563eb", "#7c3aed", "#f97316", "#16a34a", "#db2777", "#0ea5e9", "#f59e0b", "#4b5563"];

const classNames = (...classes: Array<string | false | null | undefined>) => classes.filter(Boolean).join(" ");

const getInitials = (name: string) =>
  name
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part.charAt(0).toUpperCase())
    .join("") || "U";

const pickColor = (seed: string) => {
  if (!seed) {
    return colorPalette[0];
  }

  const code = seed.toLowerCase().charCodeAt(0);
  return colorPalette[code % colorPalette.length];
};



const formatTimestamp = (timestamp: string) => {
  const date = new Date(timestamp);
  if (Number.isNaN(date.getTime())) {
    return "";
  }

  const now = new Date();
  const sameDay = date.toDateString() === now.toDateString();
  if (sameDay) {
    return date.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
  }

  const diffMs = Math.abs(now.getTime() - date.getTime());
  const withinWeek = diffMs <= 7 * 24 * 60 * 60 * 1000;
  if (withinWeek) {
    return date.toLocaleDateString([], { weekday: "short" });
  }

  return date.toLocaleDateString([], { month: "short", day: "numeric" });
};

const Micromail = () => {
  const {
    emails: apiEmails,
    config: apiConfig,
    isLoading,
    error,
    markRead: apiMarkRead,
    markUnread: apiMarkUnread,
    flagEmail: apiFlagEmail,
    moveEmail: apiMoveEmail,
    performAction: apiPerformAction,
  } = useMicromailData();

  const micromailDuration = apiConfig?.duration ?? 300;

  // Transform API emails to the richer Email shape the UI expects
  const emails = useMemo<Email[]>(() => {
    return apiEmails.map((api) => ({
      id: api.id,
      folder: (api.folder || "inbox") as FolderKey,
      sender: {
        name: api.sender.name,
        email: api.sender.email,
        avatarUrl: api.sender.avatarUrl || undefined,
        initials: getInitials(api.sender.name),
        color: pickColor(api.sender.name),
      },
      recipients: api.recipients ?? ["you@micromail.com"],
      cc: api.cc,
      subject: api.subject,
      preview: api.body?.replace(/\n/g, " ").slice(0, 140) ?? "",
      body: api.body,
      timestamp: api.timestamp,
      isRead: api.isRead,
      isFlagged: api.isFlagged,
      isExternal: api.isExternal,
      isCC: api.isCC,
      hasAttachment: api.hasAttachment,
      attachments: api.attachment ? [api.attachment] : [],
      mentionsMe: api.mentionsMe,
      importance: (api.importance || "normal") as ImportanceLevel,
    }));
  }, [apiEmails]);

  const [isSignedOut, setIsSignedOut] = useState(false);

  // UI state
  const [selectedFolder, setSelectedFolder] = useState<FolderKey>("inbox");
  const [quickFilter, setQuickFilter] = useState<QuickFilter>("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedEmailId, setSelectedEmailId] = useState<string | null>(null);
  const [selectedEmailIds, setSelectedEmailIds] = useState<string[]>([]);
  const [isComposeOpen, setIsComposeOpen] = useState(false);
  const [composeDraft, setComposeDraft] = useState({ to: "", cc: "", bcc: "", subject: "", body: "" });
  const [showCcBcc, setShowCcBcc] = useState(false);
  const [composeError, setComposeError] = useState<string | null>(null);
  const [isMobileNavOpen, setIsMobileNavOpen] = useState(false);
  const [toast, setToast] = useState<ToastState | null>(null);

  // Context menu state
  const [contextMenu, setContextMenu] = useState<{ x: number; y: number; emailId: string } | null>(null);


  // UI panel state
  const [showUserDropdown, setShowUserDropdown] = useState(false);
  const [showAttachmentPreviewPanel, setShowAttachmentPreviewPanel] = useState(false);
  const [previewingAttachment, setPreviewingAttachment] = useState<Attachment | null>(null);

  // Hardcoded current user (matches self user in data)
  const currentUser = { name: "Chris Taylor", email: "ctaylor@mymicromail.com", avatarUrl: "images/avatars/user000.webp", isSelf: true };
  const userInitials = "CT";

  const searchFieldRef = useRef<HTMLInputElement>(null);
  const bulkCheckboxRef = useRef<HTMLInputElement>(null);
  const toastTimeoutRef = useRef<number | null>(null);

  useEffect(() => {
    const handleShortcut = (event: KeyboardEvent) => {
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "e") {
        event.preventDefault();
        searchFieldRef.current?.focus();
      }
    };

    window.addEventListener("keydown", handleShortcut);
    return () => window.removeEventListener("keydown", handleShortcut);
  }, []);

  // Close dropdowns when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      const target = event.target as HTMLElement;
      // Check if click is outside dropdown areas
      if (!target.closest('.relative')) {
        setShowUserDropdown(false);
      }
    };

    document.addEventListener('click', handleClickOutside);
    return () => document.removeEventListener('click', handleClickOutside);
  }, []);

  const folderCounts = useMemo(() => {
    const result: Record<FolderKey, { total: number; unread: number; flagged: number; mentions: number }> =
      FOLDER_KEYS.reduce(
        (acc, key) => {
          acc[key] = { total: 0, unread: 0, flagged: 0, mentions: 0 };
          return acc;
        },
        {} as Record<FolderKey, { total: number; unread: number; flagged: number; mentions: number }>
      );

    emails.forEach((email) => {
      const bucket = result[email.folder];
      bucket.total += 1;
      if (!email.isRead) {
        bucket.unread += 1;
      }
      if (email.isFlagged) {
        bucket.flagged += 1;
      }
      if (email.mentionsMe) {
        bucket.mentions += 1;
      }
    });

    return result;
  }, [emails]);

  const filteredEmails = useMemo(() => {
    let working = emails.filter((email) => email.folder === selectedFolder);

    if (quickFilter === "unread") {
      working = working.filter((email) => !email.isRead);
    } else if (quickFilter === "flagged") {
      working = working.filter((email) => email.isFlagged);
    } else if (quickFilter === "mentions") {
      working = working.filter((email) => email.mentionsMe);
    }

    if (searchQuery.trim()) {
      const query = searchQuery.trim().toLowerCase();
      working = working.filter((email) => {
        const haystacks = [
          email.subject,
          email.preview,
          email.body,
          email.sender.name,
          email.sender.email,
          ...email.recipients,
          ...(email.cc ?? []),
        ];

        return haystacks.some((value) => value.toLowerCase().includes(query));
      });
    }

    return [...working].sort(
      (a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
    );
  }, [emails, selectedFolder, quickFilter, searchQuery]);

  const selectedEmail = useMemo(
    () => emails.find((email) => email.id === selectedEmailId) ?? null,
    [emails, selectedEmailId]
  );

  const selectedFolderLabel = useMemo(() => {
    const definition = FOLDER_DEFINITIONS.find((item) => item.key === selectedFolder);
    return definition?.label ?? "Inbox";
  }, [selectedFolder]);

  const filteredCount = filteredEmails.length;
  const selectedCount = selectedEmailIds.length;
  const isAllSelected = filteredCount > 0 && selectedCount === filteredCount;
  const activeSelectionCount = selectedCount > 0 ? selectedCount : selectedEmailId ? 1 : 0;

  const triggerToast = useCallback((message: string, tone: ToastState["tone"] = "info") => {
    if (toastTimeoutRef.current) {
      window.clearTimeout(toastTimeoutRef.current);
    }

    setToast({ message, tone });
    toastTimeoutRef.current = window.setTimeout(() => {
      setToast(null);
      toastTimeoutRef.current = null;
    }, 3200);
  }, []);

  useEffect(() => {
    if (!bulkCheckboxRef.current) {
      return;
    }
    bulkCheckboxRef.current.indeterminate = selectedCount > 0 && selectedCount < filteredCount;
  }, [filteredCount, selectedCount]);

  useEffect(() => {
    setSelectedEmailIds((prev) => {
      if (prev.length === 0) {
        return prev;
      }

      const allowed = prev.filter((id) => filteredEmails.some((email) => email.id === id));
      return allowed.length === prev.length ? prev : allowed;
    });
  }, [filteredEmails]);

  useEffect(() => {
    if (filteredEmails.length === 0) {
      setSelectedEmailId(null);
      return;
    }

    setSelectedEmailId((current) => {
      if (current && filteredEmails.some((email) => email.id === current)) {
        return current;
      }
      return filteredEmails[0]?.id ?? null;
    });
  }, [filteredEmails]);

  useEffect(
    () => () => {
      if (toastTimeoutRef.current) {
        window.clearTimeout(toastTimeoutRef.current);
      }
    },
    [],
  );

  const handleFolderChange = useCallback(
    (folder: FolderKey) => {
      setSelectedFolder(folder);
      setQuickFilter("all");
      setSelectedEmailIds([]);
      setIsMobileNavOpen(false);
      setSearchQuery("");
    },
    [],
  );

  const handleSelectEmail = useCallback((emailId: string) => {
    setSelectedEmailId(emailId);
    setSelectedEmailIds([]);

    apiMarkRead(emailId);
  }, [apiMarkRead]);

  const handleEmailKeyDown = (event: ReactKeyboardEvent<HTMLDivElement>, emailId: string) => {
    if (event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      handleSelectEmail(emailId);
    }
  };

  const handleToggleEmailSelection = useCallback((emailId: string) => {
    setSelectedEmailIds((prev) =>
      prev.includes(emailId) ? prev.filter((id) => id !== emailId) : [...prev, emailId],
    );
  }, []);

  const handleToggleSelectAll = useCallback(() => {
    if (filteredEmails.length === 0) return;
    setSelectedEmailIds((prev) =>
      prev.length === filteredEmails.length ? [] : filteredEmails.map((email) => email.id),
    );
  }, [filteredEmails]);

  const handleToggleFlagSelection = useCallback(() => {
    const targets = selectedEmailIds.length > 0 ? selectedEmailIds : selectedEmailId ? [selectedEmailId] : [];
    if (!targets.length) return;

    targets.forEach((id) => apiFlagEmail(id));
    triggerToast(targets.length > 1 ? "Updated flags" : "Updated flag", "info");
  }, [apiFlagEmail, selectedEmailIds, selectedEmailId, triggerToast]);

  const handleMarkUnread = useCallback(() => {
    const targets = selectedEmailIds.length > 0 ? selectedEmailIds : selectedEmailId ? [selectedEmailId] : [];
    if (!targets.length) return;

    targets.forEach((id) => apiMarkUnread(id));
    triggerToast(targets.length > 1 ? "Marked conversations as unread" : "Marked as unread", "info");
  }, [apiMarkUnread, selectedEmailIds, selectedEmailId, triggerToast]);

  const handleArchiveSelection = useCallback(() => {
    const targets = selectedEmailIds.length > 0 ? selectedEmailIds : selectedEmailId ? [selectedEmailId] : [];
    if (!targets.length) return;

    targets.forEach((id) => apiMoveEmail(id, "archive"));
    setSelectedEmailIds([]);
    setSelectedEmailId((current) => (current && targets.includes(current) ? null : current));
    triggerToast(targets.length > 1 ? "Conversations archived" : "Conversation archived", "info");
  }, [apiMoveEmail, selectedEmailIds, selectedEmailId, triggerToast]);

  const handleDeleteSelection = useCallback(() => {
    const targets = selectedEmailIds.length > 0 ? selectedEmailIds : selectedEmailId ? [selectedEmailId] : [];
    if (!targets.length) return;

    targets.forEach((id) => apiMoveEmail(id, "deleted"));
    setSelectedEmailIds([]);
    setSelectedEmailId((current) => (current && targets.includes(current) ? null : current));
    triggerToast(targets.length > 1 ? "Moved conversations to Deleted Items" : "Moved to Deleted Items", "info");
  }, [apiMoveEmail, selectedEmailIds, selectedEmailId, triggerToast]);

  const handleRowFlagToggle = useCallback((emailId: string) => {
    apiFlagEmail(emailId);
  }, [apiFlagEmail]);
  
  // ==========================================================================
  // TASK ACTION HANDLERS
  // These handlers perform the required actions for active task variants
  // ==========================================================================

  /** Task #1 Action: Mark all emails as read */
  const handleMarkAllAsRead = useCallback(() => {
    apiPerformAction("mark_all_read");
    triggerToast("All emails marked as read", "info");
  }, [apiPerformAction, triggerToast]);

  /** Task #2 Action: Clear the junk folder */
  const handleClearJunkFolder = useCallback(() => {
    apiPerformAction("clear_junk");
    triggerToast("Junk folder cleared", "info");
  }, [apiPerformAction, triggerToast]);

  /** Task #3 Action: Open attachment preview */
  const handleOpenAttachmentPreview = useCallback(() => {
    setShowAttachmentPreviewPanel(true);
    apiPerformAction("open_attachment");
    triggerToast("Opening attachment preview", "info");
  }, [apiPerformAction, triggerToast]);

  const handleSearchChange = (event: ChangeEvent<HTMLInputElement>) => {
    setSearchQuery(event.target.value);
  };

  const handleComposeOpen = useCallback(() => {
    setIsComposeOpen(true);
    setComposeDraft({ to: "", cc: "", bcc: "", subject: "", body: "" });
    setComposeError(null);
    setIsMobileNavOpen(false);
  }, []);

  const handleCloseCompose = useCallback(() => {
    setIsComposeOpen(false);
    setComposeError(null);
  }, []);

  const handleComposeFieldChange =
    (field: "to" | "cc" | "bcc" | "subject" | "body") =>
    (event: ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
      const { value } = event.target;
      setComposeDraft((prev) => ({ ...prev, [field]: value }));
    };

  const handleSendMessage = useCallback(
    (event: FormEvent<HTMLFormElement>) => {
      event.preventDefault();

      const trimmedTo = composeDraft.to.trim();
      const trimmedSubject = composeDraft.subject.trim();

      if (!trimmedTo) {
        setComposeError("Please specify at least one recipient.");
        return;
      }

      // @ts-expect-error incomplete feature — email built but not yet pushed to state
      const _newEmail: Email = {
        id: `sent-${Date.now()}`,
        folder: "sent",
        sender: {
          name: currentUser?.name ?? "",
          email: currentUser?.email ?? "",
          initials: userInitials,
          color: "#2563eb",
        },
        recipients: trimmedTo
          .split(/[,;]+/)
          .map((entry) => entry.trim())
          .filter(Boolean),
        cc: [],
        subject: trimmedSubject || "(no subject)",
        preview: composeDraft.body.trim().slice(0, 140) || "Sent a blank message",
        body: composeDraft.body || "",
        timestamp: new Date().toISOString(),
        isRead: true,
        isFlagged: false,
        hasAttachment: false,
        mentionsMe: false,
      };

      setSelectedEmailIds([]);
      setIsComposeOpen(false);
      setComposeDraft({ to: "", cc: "", bcc: "", subject: "", body: "" });
      setShowCcBcc(false);
      setComposeError(null);
      triggerToast("Message sent", "success");
    },
    [composeDraft, triggerToast, currentUser, userInitials],
  );

  const handleSaveDraft = useCallback(() => {
    if (!composeDraft.to.trim() && !composeDraft.subject.trim() && !composeDraft.body.trim()) {
      triggerToast("Nothing to save yet", "info");
      return;
    }

    // @ts-expect-error incomplete feature — draft built but not yet saved to state
    const _draft: Email = {
      id: `draft-${Date.now()}`,
      folder: "drafts",
      sender: {
        name: currentUser?.name ?? "",
        email: currentUser?.email ?? "",
        initials: userInitials,
        color: "#2563eb",
      },
      recipients: composeDraft.to
        .split(/[,;]+/)
        .map((entry) => entry.trim())
        .filter(Boolean),
      subject: composeDraft.subject || "(draft)",
      preview: composeDraft.body.trim().slice(0, 140) || "Draft saved",
      body: composeDraft.body || "",
      timestamp: new Date().toISOString(),
      isRead: true,
      isFlagged: true,
      hasAttachment: false,
      mentionsMe: false,
    };

    setSelectedEmailIds([]);
    setIsComposeOpen(false);
    setComposeDraft({ to: "", cc: "", bcc: "", subject: "", body: "" });
    setShowCcBcc(false);
    setComposeError(null);
    triggerToast("Draft saved", "info");
  }, [composeDraft, triggerToast, currentUser, userInitials]);

  // Discard draft handler
  const handleDiscardDraft = useCallback(() => {
    const hasContent = composeDraft.to.trim() || composeDraft.cc.trim() || composeDraft.bcc.trim() ||
                       composeDraft.subject.trim() || composeDraft.body.trim();
    if (hasContent) {
      if (!window.confirm("Discard this draft?")) {
        return;
      }
    }
    setIsComposeOpen(false);
    setComposeDraft({ to: "", cc: "", bcc: "", subject: "", body: "" });
    setShowCcBcc(false);
    setComposeError(null);
    triggerToast("Draft discarded", "info");
  }, [composeDraft, triggerToast]);

  // Reply handler - opens compose with pre-filled recipient and subject
  const handleReply = useCallback(() => {
    if (!selectedEmail) return;
    setComposeDraft({
      to: selectedEmail.sender.email,
      cc: "",
      bcc: "",
      subject: selectedEmail.subject.startsWith("Re:") ? selectedEmail.subject : `Re: ${selectedEmail.subject}`,
      body: `\n\n---\nOn ${formatTimestamp(selectedEmail.timestamp)}, ${selectedEmail.sender.name} wrote:\n> ${selectedEmail.body.split('\n').join('\n> ')}`,
    });
    setShowCcBcc(false);
    setIsComposeOpen(true);
  }, [selectedEmail]);

  // Reply All handler - includes CC recipients
  const handleReplyAll = useCallback(() => {
    if (!selectedEmail) return;
    const ccRecipients = selectedEmail.cc?.filter(email => email !== currentUser?.email).join(", ") || "";
    setComposeDraft({
      to: selectedEmail.sender.email,
      cc: ccRecipients,
      bcc: "",
      subject: selectedEmail.subject.startsWith("Re:") ? selectedEmail.subject : `Re: ${selectedEmail.subject}`,
      body: `\n\n---\nOn ${formatTimestamp(selectedEmail.timestamp)}, ${selectedEmail.sender.name} wrote:\n> ${selectedEmail.body.split('\n').join('\n> ')}`,
    });
    setShowCcBcc(ccRecipients.length > 0);
    setIsComposeOpen(true);
  }, [selectedEmail, currentUser]);

  // Forward handler - opens compose with forwarded content
  const handleForward = useCallback(() => {
    if (!selectedEmail) return;
    setComposeDraft({
      to: "",
      cc: "",
      bcc: "",
      subject: selectedEmail.subject.startsWith("Fwd:") ? selectedEmail.subject : `Fwd: ${selectedEmail.subject}`,
      body: `\n\n---\nForwarded message:\nFrom: ${selectedEmail.sender.name} <${selectedEmail.sender.email}>\nDate: ${formatTimestamp(selectedEmail.timestamp)}\nSubject: ${selectedEmail.subject}\n\n${selectedEmail.body}`,
    });
    setShowCcBcc(false);
    setIsComposeOpen(true);
  }, [selectedEmail]);

  // Context menu handler
  const handleContextMenu = useCallback((e: React.MouseEvent, emailId: string) => {
    e.preventDefault();
    setContextMenu({ x: e.clientX, y: e.clientY, emailId });
  }, []);

  // Close context menu when clicking elsewhere
  useEffect(() => {
    const handleClickOutside = () => {
      setContextMenu(null);
    };
    if (contextMenu) {
      document.addEventListener("click", handleClickOutside);
      return () => document.removeEventListener("click", handleClickOutside);
    }
  }, [contextMenu]);

  // Context menu action handlers
  const handleContextMenuAction = useCallback((action: string) => {
    if (!contextMenu) return;
    const emailId = contextMenu.emailId;

    switch (action) {
      case "delete": apiMoveEmail(emailId, "deleted"); triggerToast("Moved to Deleted Items", "info"); break;
      case "archive": apiMoveEmail(emailId, "archive"); triggerToast("Archived", "info"); break;
      case "flag": apiFlagEmail(emailId); triggerToast("Flag updated", "info"); break;
      case "markRead": apiMarkRead(emailId); triggerToast("Marked as read", "info"); break;
      case "markUnread": apiMarkUnread(emailId); triggerToast("Marked as unread", "info"); break;
      case "moveToJunk": apiMoveEmail(emailId, "junk"); triggerToast("Moved to Junk", "info"); break;
      case "moveToInbox": apiMoveEmail(emailId, "inbox"); triggerToast("Moved to Inbox", "info"); break;
    }
    setContextMenu(null);
  }, [apiMoveEmail, apiFlagEmail, apiMarkRead, apiMarkUnread, contextMenu, triggerToast]);

  const isLocalhost = window.location.hostname === "localhost";
  const [adminConsoleEnabled, setAdminConsoleEnabledState] = useState(() => {
    const stored = localStorage.getItem("adminConsoleEnabled");
    return stored === "true";
  });

  useEffect(() => {
    const handleAdminToggle = (e: CustomEvent) => {
      setAdminConsoleEnabledState(e.detail.enabled);
    };

    const handleStorageChange = (e: StorageEvent) => {
      if (e.key === "adminConsoleEnabled") {
        setAdminConsoleEnabledState(e.newValue === "true");
      }
    };

    const syncWithStorage = () => {
      const currentValue = localStorage.getItem("adminConsoleEnabled") === "true";
      setAdminConsoleEnabledState(currentValue);
    };

    window.addEventListener("adminConsoleToggle", handleAdminToggle as EventListener);
    window.addEventListener("storage", handleStorageChange);
    window.addEventListener("focus", syncWithStorage);

    return () => {
      window.removeEventListener("adminConsoleToggle", handleAdminToggle as EventListener);
      window.removeEventListener("storage", handleStorageChange);
      window.removeEventListener("focus", syncWithStorage);
    };
  }, []);

  const handleResetTask = () => {
    if (window.confirm("Are you sure you want to reset this task?")) {
      window.location.reload();
    }
  };

  const renderSidebar = (isOverlay = false) => {
    const favoriteFolders = FOLDER_DEFINITIONS.filter((item) => item.isFavorite);
    const allFolders = FOLDER_DEFINITIONS;

    const FolderLink = ({ folder, isFavorite }: { folder: (typeof FOLDER_DEFINITIONS)[0], isFavorite?: boolean }) => {
      const Icon = folder.icon;
      const counts = folderCounts[folder.key];
      const badge = folder.key === 'inbox' ? counts?.unread : counts?.total;

      return (
        <button
          key={folder.key}
          onClick={() => handleFolderChange(folder.key)}
          className={classNames(
            "flex w-full items-center gap-3 rounded-md px-3 py-2 text-sm transition",
            selectedFolder === folder.key
              ? "bg-[#e8f1fe] text-[#0b65d7] shadow-inner"
              : "text-slate-600 hover:bg-slate-100 hover:text-slate-800",
          )}
        >
          {isFavorite && <Star size={16} className="text-yellow-500" />}
          {!isFavorite && <Icon
            size={18}
            className={classNames(
              "transition",
              selectedFolder === folder.key ? "text-[#0b65d7]" : "text-slate-400",
            )}
          />}
          <span className="flex-1 text-left">{folder.label}</span>
          {!!badge && (
            <span
              className={classNames(
                "rounded-full px-2 py-0.5 text-xs font-semibold",
                selectedFolder === folder.key
                  ? "bg-white text-[#0b65d7]"
                  : "bg-slate-100 text-slate-600",
              )}
            >
              {badge}
            </span>
          )}
        </button>
      )
    }

    return (
      <div className="flex h-full flex-col bg-white">
        <div className="flex items-center justify-between px-4 pt-5 pb-3">
          <button
            onClick={handleComposeOpen}
            className="inline-flex items-center gap-2 rounded-lg bg-[#0067b8] px-4 py-2 text-sm font-semibold text-white shadow-md hover:bg-[#005a9e]"
          >
            <PenSquare size={16} />
            New mail
          </button>
          {isOverlay && (
            <button
              onClick={() => setIsMobileNavOpen(false)}
              className="rounded-lg p-2 text-slate-500 hover:bg-slate-100"
              aria-label="Close navigation"
            >
              <X size={16} />
            </button>
          )}
        </div>

        <nav className="flex-1 overflow-y-auto pb-6">
          <div className="mt-4">
            <p className="px-4 pb-2 text-sm font-semibold text-slate-800">Favorites</p>
            <div className="mt-1 space-y-1 px-2">
              {favoriteFolders.map((folder) => (
                <FolderLink folder={folder} key={`fav-${folder.key}`} isFavorite />
              ))}
            </div>
          </div>

          <div className="mt-8">
            <p className="px-4 pb-2 text-sm font-semibold text-slate-800">{currentUser?.email}</p>
            <div className="mt-1 space-y-1 px-2">
            {allFolders.map((folder) => (
                <FolderLink folder={folder} key={folder.key} />
              ))}
            </div>
          </div>
        </nav>
      </div>
    );
  };

  const actionButtonClass = (isDanger = false) =>
    classNames(
      "rounded-md p-2 transition",
      activeSelectionCount
        ? isDanger
          ? "text-slate-500 hover:bg-white hover:text-rose-500"
          : "text-slate-500 hover:bg-white hover:text-[#0b65d7]"
        : "cursor-not-allowed text-slate-300",
    );

  const handleHeaderAction = (message: string) => () => triggerToast(message, "info");


  // ---------------------------------------------------------------------------
  // Loading Gate
  // ---------------------------------------------------------------------------
  if (!apiConfig || isLoading) {
    const isNetworkError = error && /failed to fetch|networkerror/i.test(error);
    const isNoSession = error && /409/.test(error);
    const isMismatch = error && /environment mismatch/i.test(error);
    return (
      <div className="flex items-center justify-center h-screen bg-[#eef1f6]">
        <div className="text-center max-w-md px-6">
          <div className="text-4xl mb-3">📧</div>
          <h1 className="text-xl font-semibold mb-6 text-gray-900">MicroMail</h1>
          {!error ? (
            <>
              <div className="w-8 h-8 border-2 border-blue-500 border-t-transparent rounded-full animate-spin mx-auto mb-4" />
              <p className="text-sm text-gray-500">Connecting to MicroMail...</p>
            </>
          ) : isNetworkError ? (
            <>
              <p className="font-medium mb-2 text-gray-900">Could not connect to the server</p>
              <p className="text-sm text-gray-500 mb-3">Make sure the API server is running on port 8000.</p>
              <p className="text-xs font-mono bg-gray-100 rounded px-3 py-2 text-gray-600 mt-2">uvicorn sentinel_api.server:app --port 8000</p>
            </>
          ) : isNoSession ? (
            <>
              <p className="font-medium mb-2 text-gray-900">No scenario initialized</p>
              <p className="text-sm text-gray-500 mb-3">The server is running but no scenario has been loaded. Use the CLI harness or POST /init to start a scenario.</p>
              <p className="text-xs font-mono bg-gray-100 rounded px-3 py-2 text-gray-600 mt-2">python -m sentinel_api.run_simulation &lt;scenario.json&gt;</p>
            </>
          ) : isMismatch ? (
            <>
              <p className="font-medium mb-2 text-gray-900">Wrong environment</p>
              <p className="text-sm text-gray-500 mb-3">{error}</p>
              <p className="text-sm text-gray-500">Navigate to the correct environment from the desktop, or re-init with a MicroMail scenario.</p>
            </>
          ) : (
            <>
              <p className="font-medium mb-2 text-gray-900">Connection Error</p>
              <p className="text-sm text-red-600">{error}</p>
            </>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#eef1f6]">
      {(isLocalhost || adminConsoleEnabled) && (
        <div className="bg-gradient-to-r from-yellow-50 to-amber-50 border border-yellow-200/50 rounded-xl p-4 mb-6 shadow-sm backdrop-blur-sm max-w-6xl mx-auto mt-6">
          <div className="flex items-center justify-between text-sm">
            <div className="text-yellow-800 font-medium">
              <strong>Dev Tools:</strong> Duration: {micromailDuration}s
            </div>
            <button
              onClick={handleResetTask}
              className="px-3 py-1.5 bg-gradient-to-r from-red-500 to-red-600 text-white text-xs rounded-lg hover:from-red-600 hover:to-red-700 transition-all duration-200 shadow-sm"
            >
              Reset Task
            </button>
          </div>
        </div>
      )}

      <header className="flex items-center gap-4 bg-[#0b65d7] px-6 py-3 text-white shadow">
        <button
          className="rounded-md p-2 hover:bg-white/10 lg:hidden"
          onClick={() => setIsMobileNavOpen(true)}
          aria-label="Open navigation"
        >
          <Menu size={20} />
        </button>
        <div className="flex items-center gap-3">
          <img src="desktop/micromail-icon.png" alt="MicroMail" className="w-10 h-10 object-contain" />
          <div>
            <p className="text-xs uppercase tracking-widest text-white/70">Micromail</p>
            <p className="text-base font-semibold">Email Workspace</p>
          </div>
        </div>
        <div className="relative ml-6 flex-1 max-w-xl">
          <Search size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-white/70" />
          <input
            ref={searchFieldRef}
            value={searchQuery}
            onChange={handleSearchChange}
            onKeyDown={(event) => {
              if (event.key === "Escape") {
                setSearchQuery("");
              }
            }}
            placeholder="Search mail and people"
            className="w-full rounded-full border border-white/30 bg-white/15 py-2 pl-10 pr-4 text-sm text-white placeholder:text-white/80 focus:border-white focus:bg-white/20 focus:outline-none"
          />
        </div>
        <div className="hidden items-center gap-3 md:flex ml-auto">
          <div className="relative">
            <button
              className="flex items-center gap-2 rounded-full bg-white/15 px-3 py-1 hover:bg-white/25 transition"
              onClick={() => {
                setShowUserDropdown(!showUserDropdown);
              }}
            >
              {currentUser?.avatarUrl ? (
                <img
                  src={currentUser.avatarUrl}
                  alt={currentUser.name}
                  className="h-8 w-8 rounded-full object-cover"
                />
              ) : (
                <div className="flex h-8 w-8 items-center justify-center rounded-full bg-white text-sm font-semibold text-[#0b65d7]">
                  {userInitials}
                </div>
              )}
              <div className="flex flex-col">
                <span className="text-xs font-semibold leading-tight">{currentUser?.name}</span>
                <span className="text-[11px] text-white/70">{currentUser?.email}</span>
              </div>
              <ChevronDown size={16} className={classNames("text-white/80 transition", showUserDropdown && "rotate-180")} />
            </button>
            {showUserDropdown && (
              <div className="absolute right-0 top-full mt-2 w-64 rounded-lg bg-white shadow-xl border border-slate-200 z-50">
                <div className="p-4 border-b border-slate-100">
                  <div className="flex items-center gap-3">
                    {currentUser?.avatarUrl ? (
                      <img
                        src={currentUser.avatarUrl}
                        alt={currentUser.name}
                        className="h-10 w-10 rounded-full object-cover"
                      />
                    ) : (
                      <div className="flex h-10 w-10 items-center justify-center rounded-full bg-[#0b65d7] text-white font-semibold">
                        {userInitials}
                      </div>
                    )}
                    <div>
                      <p className="font-semibold text-slate-800">{currentUser?.name}</p>
                      <p className="text-xs text-slate-500">{currentUser?.email}</p>
                    </div>
                  </div>
                </div>
                <div className="p-2">
                  <button
                    className="w-full px-3 py-2 text-left text-sm text-rose-600 hover:bg-rose-50 rounded"
                    onClick={() => setIsSignedOut(true)}
                  >
                    Sign out
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      </header>

      {isMobileNavOpen && (
        <div
          className="fixed inset-0 z-40 bg-black/40 lg:hidden"
          onClick={() => setIsMobileNavOpen(false)}
          aria-hidden="true"
        >
          <div
            className="absolute left-0 top-0 h-full w-[280px] bg-white shadow-2xl"
            onClick={(event) => event.stopPropagation()}
          >
            {renderSidebar(true)}
          </div>
        </div>
      )}

      <div className="flex h-[calc(100vh-72px)] flex-col lg:flex-row">
        <aside className="hidden w-72 flex-shrink-0 border-r border-slate-200 lg:flex">{renderSidebar()}</aside>

        <div className="flex flex-1 flex-col xl:flex-row">
          <section className="order-2 flex w-full flex-col bg-white shadow-sm xl:order-1 xl:w-[430px] xl:border-r xl:border-slate-200">
            <div className="border-b border-slate-200 px-4 py-3">
              <div className="flex items-center justify-between text-sm text-slate-500">
                <div className="flex items-center gap-2 font-semibold text-slate-700">
                  <span>{selectedFolderLabel}</span>
                </div>
                {selectedFolder === "junk" && (
                  <button
                    onClick={handleClearJunkFolder}
                    className="inline-flex items-center gap-1 rounded-full border border-rose-200 bg-rose-50 px-3 py-1 text-xs font-medium text-rose-600 hover:border-rose-400 hover:bg-rose-100"
                    aria-label="Empty junk folder"
                  >
                    <Trash2 size={14} />
                    Empty folder
                  </button>
                )}
              </div>

              <div className="mt-3 flex flex-wrap gap-2">
                {QUICK_FILTERS.map((filter) => {
                  const Icon = filter.icon;
                  const isActive = quickFilter === filter.key;
                  const badge =
                    filter.key === "unread"
                      ? folderCounts[selectedFolder]?.unread
                      : filter.key === "flagged"
                        ? folderCounts[selectedFolder]?.flagged
                        : filter.key === "mentions"
                          ? folderCounts[selectedFolder]?.mentions
                          : undefined;

                  return (
                    <button
                      key={filter.key}
                      onClick={() => setQuickFilter(filter.key)}
                      className={classNames(
                        "inline-flex items-center gap-2 rounded-full border px-3 py-1.5 text-xs font-medium transition",
                        isActive
                          ? "border-[#0b65d7] bg-[#e8f1fe] text-[#0b65d7]"
                          : "border-slate-200 text-slate-600 hover:border-slate-300 hover:text-slate-700",
                      )}
                      title={filter.description}
                    >
                      <Icon size={14} />
                      {filter.label}
                      {!!badge && (
                        <span className="rounded-full bg-white px-2 py-0.5 text-[10px] font-semibold text-[#0b65d7]">
                          {badge}
                        </span>
                      )}
                    </button>
                  );
                })}
              </div>
            </div>

            <div className="flex items-center justify-between border-b border-slate-200 bg-slate-50 px-4 py-2 text-xs text-slate-500">
              <div className="flex items-center gap-3">
                <input
                  ref={bulkCheckboxRef}
                  type="checkbox"
                  checked={isAllSelected}
                  onChange={handleToggleSelectAll}
                  className="h-4 w-4 rounded border-slate-300"
                  aria-label="Select all conversations"
                />
                <button
                  onClick={handleToggleFlagSelection}
                  className={actionButtonClass()}
                  disabled={!activeSelectionCount}
                  aria-label="Toggle flag"
                >
                  <Flag size={16} />
                </button>
                <button
                  onClick={handleMarkUnread}
                  className={actionButtonClass()}
                  disabled={!activeSelectionCount}
                  aria-label="Mark unread"
                >
                  <Mail size={16} />
                </button>
                <button
                  onClick={handleArchiveSelection}
                  className={actionButtonClass()}
                  disabled={!activeSelectionCount}
                  aria-label="Archive conversation"
                >
                  <Archive size={16} />
                </button>
                <button
                  onClick={handleDeleteSelection}
                  className={actionButtonClass(true)}
                  disabled={!activeSelectionCount}
                  aria-label="Delete conversation"
                >
                  <Trash2 size={16} />
                </button>
                
                <button
                  onClick={handleMarkAllAsRead}
                  className="rounded-md p-2 text-slate-500 transition hover:bg-white hover:text-[#0b65d7]"
                  aria-label="Mark all as read"
                >
                  <MailOpen size={16} />
                </button>

                <button
                  onClick={handleOpenAttachmentPreview}
                  className="rounded-md p-2 text-slate-500 transition hover:bg-white hover:text-[#0b65d7]"
                  aria-label="Preview attachments"
                >
                  <Paperclip size={16} />
                </button>
              </div>
              <span className="text-slate-500">{filteredEmails.length} items</span>
            </div>

            <div role="list" className="flex-1 overflow-y-auto">
              {filteredEmails.length === 0 ? (
                <div className="flex h-full flex-col items-center justify-center gap-2 px-4 text-center text-sm text-slate-500">
                  <MailOpen size={36} className="text-slate-300" />
                  <p>No conversations match your filters.</p>
                  <p className="text-xs text-slate-400">Try adjusting the folder, focus view, or quick filters.</p>
                </div>
              ) : (
                filteredEmails.map((email) => {
                  const isSelectedRow = selectedEmailId === email.id;
                  const isChecked = selectedEmailIds.includes(email.id);

                  return (
                    <div
                      key={email.id}
                      role="listitem"
                      tabIndex={0}
                      onClick={() => handleSelectEmail(email.id)}
                      onKeyDown={(event) => handleEmailKeyDown(event, email.id)}
                      onContextMenu={(e) => handleContextMenu(e, email.id)}
                      className={classNames(
                        "flex cursor-pointer items-start gap-3 border-b border-slate-100 px-4 py-3 transition hover:bg-[#f4f6fb]",
                        isSelectedRow ? "bg-[#e8f1fe] border-l-4 border-[#0b65d7]" : "border-l-4 border-transparent",
                      )}
                      aria-selected={isSelectedRow}
                    >
                      <div className="flex flex-col items-center pt-1">
                        <input
                          type="checkbox"
                          checked={isChecked}
                          onChange={(event) => {
                            event.stopPropagation();
                            handleToggleEmailSelection(email.id);
                          }}
                          className="h-4 w-4 rounded border-slate-300"
                          onClick={(event) => event.stopPropagation()}
                          aria-label="Select conversation"
                        />
                        <button
                          onClick={(event) => {
                            event.stopPropagation();
                            handleRowFlagToggle(email.id);
                          }}
                          className={classNames(
                            "mt-2 rounded-full p-1 transition",
                            email.isFlagged ? "text-[#d97706]" : "text-slate-400 hover:text-[#d97706]",
                          )}
                          aria-label={email.isFlagged ? "Remove flag" : "Flag for follow-up"}
                        >
                          <Flag size={14} fill={email.isFlagged ? "#d97706" : "transparent"} />
                        </button>
                      </div>

                      {/* Sender Avatar */}
                      <div className="flex-shrink-0 pt-1">
                        {email.sender.avatarUrl ? (
                          <img
                            src={email.sender.avatarUrl}
                            alt={email.sender.name}
                            className="h-10 w-10 rounded-full object-cover"
                          />
                        ) : (
                          <div
                            className="flex h-10 w-10 items-center justify-center rounded-full text-sm font-semibold text-white"
                            style={{ backgroundColor: email.sender.color }}
                          >
                            {email.sender.initials}
                          </div>
                        )}
                      </div>

                      <div className="flex min-w-0 flex-1 flex-col gap-1">
                        <div className="flex items-center justify-between">
                          <p
                            className={classNames(
                              "truncate text-sm",
                              email.isRead ? "text-slate-600" : "font-semibold text-slate-900",
                            )}
                          >
                            {email.sender.name}
                          </p>
                          <div className="flex items-center gap-1">
                            {email.importance === "high" && (
                              <ArrowUp size={14} className="text-rose-500" aria-label="High importance" />
                            )}
                            {email.importance === "low" && (
                              <ArrowDown size={14} className="text-blue-500" aria-label="Low importance" />
                            )}
                            <span className="text-xs text-slate-500">{formatTimestamp(email.timestamp)}</span>
                          </div>
                        </div>

                        <div className="flex flex-wrap items-center gap-2">
                          <p
                            className={classNames(
                              "truncate text-sm",
                              email.isRead ? "text-slate-700" : "font-semibold text-slate-900",
                            )}
                          >
                            {email.subject}
                          </p>
                          {email.isExternal && (
                            <span className="inline-flex items-center gap-1 rounded border border-amber-300 bg-amber-50 px-1.5 py-0.5 text-[10px] font-semibold text-amber-700">
                              <Globe size={10} />
                              External
                            </span>
                          )}
                          {email.hasAttachment && <Paperclip size={14} className="text-slate-400" />}
                          {email.mentionsMe && (
                            <span className="inline-flex items-center gap-1 rounded-full bg-[#e8f1fe] px-2 py-0.5 text-[10px] font-semibold text-[#0b65d7]">
                              <AtSign size={12} />
                              Mention
                            </span>
                          )}
                        </div>

                        <p className="truncate text-xs text-slate-500">{email.preview}</p>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </section>

          <section className="order-3 flex flex-1 flex-col bg-white xl:order-2">
            {selectedEmail ? (
              <div className="flex h-full flex-col">
                <div className="border-b border-slate-200 px-6 py-5">
                  <div className="flex flex-wrap items-start justify-between gap-4">
                    <div>
                      <h2 className="text-lg font-semibold text-slate-900">{selectedEmail.subject}</h2>
                      <div className="mt-2 flex flex-wrap items-center gap-2">
                        {selectedEmail.mentionsMe && (
                          <span className="inline-flex items-center gap-1 rounded-full bg-[#e8f1fe] px-2 py-0.5 text-xs font-medium text-[#0b65d7]">
                            <AtSign size={12} />
                            You were mentioned
                          </span>
                        )}
                        {selectedEmail.importance === "high" && (
                          <span className="inline-flex items-center gap-1 rounded-full bg-rose-50 px-2 py-0.5 text-xs font-medium text-rose-700">
                            <ArrowUp size={12} />
                            High importance
                          </span>
                        )}
                        {selectedEmail.importance === "low" && (
                          <span className="inline-flex items-center gap-1 rounded-full bg-blue-50 px-2 py-0.5 text-xs font-medium text-blue-700">
                            <ArrowDown size={12} />
                            Low importance
                          </span>
                        )}
                      </div>
                    </div>
                    <div className="flex items-center gap-2 text-xs text-slate-500">
                      <span>{new Date(selectedEmail.timestamp).toLocaleString([], { dateStyle: "medium", timeStyle: "short" })}</span>
                      <div className="flex items-center gap-1">
                        <button
                          onClick={handleMarkUnread}
                          className="rounded-md border border-slate-200 px-3 py-1 text-xs font-medium text-slate-600 hover:border-[#0b65d7] hover:text-[#0b65d7]"
                        >
                          Mark unread
                        </button>
                        <button
                          onClick={handleToggleFlagSelection}
                          className="rounded-md border border-slate-200 px-3 py-1 text-xs font-medium text-slate-600 hover:border-[#0b65d7] hover:text-[#0b65d7]"
                        >
                          {selectedEmail.isFlagged ? "Unflag" : "Flag"}
                        </button>
                        <button
                          onClick={handleArchiveSelection}
                          className="rounded-md border border-slate-200 px-3 py-1 text-xs font-medium text-slate-600 hover:border-[#0b65d7] hover:text-[#0b65d7]"
                        >
                          Archive
                        </button>
                        <button
                          onClick={handleDeleteSelection}
                          className="rounded-md border border-slate-200 px-3 py-1 text-xs font-medium text-slate-600 hover:border-rose-400 hover:text-rose-500"
                        >
                          Delete
                        </button>
                      </div>
                    </div>
                  </div>
                </div>

                <div className="flex items-start justify-between gap-4 border-b border-slate-200 px-6 py-4">
                  <div className="flex items-start gap-3">
                    {selectedEmail.sender.avatarUrl ? (
                      <img
                        src={selectedEmail.sender.avatarUrl}
                        alt={selectedEmail.sender.name}
                        className="h-12 w-12 rounded-full object-cover"
                      />
                    ) : (
                      <div
                        className="flex h-12 w-12 items-center justify-center rounded-full text-sm font-semibold text-white"
                        style={{ backgroundColor: selectedEmail.sender.color }}
                      >
                        {selectedEmail.sender.initials}
                      </div>
                    )}
                    <div className="space-y-1 text-sm text-slate-600">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="font-medium text-slate-900">{selectedEmail.sender.name}</span>
                        {selectedEmail.isExternal && (
                          <span className="inline-flex items-center gap-1 rounded border border-amber-300 bg-amber-50 px-1.5 py-0.5 text-[10px] font-semibold text-amber-700">
                            <Globe size={10} />
                            External
                          </span>
                        )}
                        <span className="text-xs text-slate-400">&lt;{selectedEmail.sender.email || "unknown"}&gt;</span>
                      </div>
                      <div>
                        <span className="font-semibold text-slate-600">To:</span>{" "}
                        <span>{selectedEmail.recipients.join(", ") || "undisclosed recipients"}</span>
                      </div>
                      {selectedEmail.cc && selectedEmail.cc.length > 0 && (
                        <div>
                          <span className="font-semibold text-slate-600">Cc:</span>{" "}
                          <span>{selectedEmail.cc.join(", ")}</span>
                        </div>
                      )}
                    </div>
                  </div>
                  <button
                    onClick={handleHeaderAction("Message pinned for later")}
                    className="rounded-md border border-slate-200 px-3 py-1 text-xs font-medium text-slate-600 hover:border-[#0b65d7] hover:text-[#0b65d7]"
                  >
                    Pin
                  </button>
                </div>

                <div className="flex-1 space-y-4 overflow-y-auto px-6 py-6 text-[15px] leading-relaxed text-slate-700">
                  {selectedEmail.body.split("\n").map((paragraph, index) => (
                    <p key={`${selectedEmail.id}-paragraph-${index}`}>
                      {paragraph.trim().length ? paragraph : <span className="opacity-0">.</span>}
                    </p>
                  ))}

                  {selectedEmail.meetingDetails && (
                    <div className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-700">
                      <p className="text-xs font-semibold uppercase text-slate-500">Meeting details</p>
                      <div className="mt-2 space-y-1">
                        {selectedEmail.meetingDetails.date && (
                          <div className="flex items-center gap-2">
                            <CircleDot size={14} className="text-[#0b65d7]" />
                            <span>{selectedEmail.meetingDetails.date}</span>
                          </div>
                        )}
                        {selectedEmail.meetingDetails.time && (
                          <div className="flex items-center gap-2">
                            <Clock size={14} className="text-[#0b65d7]" />
                            <span>{selectedEmail.meetingDetails.time}</span>
                          </div>
                        )}
                        {selectedEmail.meetingDetails.location && (
                          <div className="flex items-center gap-2">
                            <MapPin size={14} className="text-[#0b65d7]" />
                            <span>{selectedEmail.meetingDetails.location}</span>
                          </div>
                        )}
                      </div>
                    </div>
                  )}

                  {selectedEmail.attachments && selectedEmail.attachments.length > 0 && (
                    <div className="rounded-xl border border-dashed border-slate-200 bg-white px-4 py-3">
                      <p className="text-xs font-semibold uppercase text-slate-500">Attachments</p>
                      <div className="mt-3 space-y-2">
                        {selectedEmail.attachments.map((attachment) => (
                          <button
                            key={attachment.id}
                            onClick={() => setPreviewingAttachment(attachment)}
                            className="flex w-full items-center justify-between rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-600 hover:bg-slate-50 hover:border-[#0b65d7] transition cursor-pointer"
                          >
                            <div className="flex items-center gap-2">
                              <Paperclip size={16} className="text-[#0b65d7]" />
                              <span>{attachment.name}</span>
                            </div>
                            <span className="text-xs text-slate-400">{attachment.size}</span>
                          </button>
                        ))}
                      </div>
                    </div>
                  )}
                </div>

                <div className="border-t border-slate-200 bg-white px-6 py-3">
                  <div className="flex flex-wrap gap-2">
                    <button
                      onClick={handleReply}
                      className="rounded-full bg-[#0b65d7] px-4 py-2 text-sm font-medium text-white shadow hover:bg-[#0a4cab]"
                    >
                      Reply
                    </button>
                    <button
                      onClick={handleReplyAll}
                      className="rounded-full border border-slate-200 px-4 py-2 text-sm font-medium text-slate-600 hover:border-[#0b65d7] hover:text-[#0b65d7]"
                    >
                      Reply all
                    </button>
                    <button
                      onClick={handleForward}
                      className="rounded-full border border-slate-200 px-4 py-2 text-sm font-medium text-slate-600 hover:border-[#0b65d7] hover:text-[#0b65d7]"
                    >
                      Forward
                    </button>
                  </div>
                </div>
              </div>
            ) : (
              <div className="flex h-full flex-col items-center justify-center gap-3 text-center text-slate-500">
                <MailOpen size={48} className="text-slate-300" />
                <p className="text-base font-medium">You're all caught up</p>
                <p className="max-w-xs text-sm text-slate-400">
                  Select a conversation on the left to read it here. New messages will appear in the Focused inbox first.
                </p>
              </div>
            )}
          </section>
        </div>
      </div>

      {/* Attachment Preview Panel */}
      {showAttachmentPreviewPanel && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4">
          <div className="w-full max-w-xl overflow-hidden rounded-2xl bg-white shadow-2xl">
            <div className="flex items-center justify-between border-b px-5 py-4">
              <div className="flex items-center gap-3">
                <Paperclip className="text-[#0b65d7]" size={20} />
                <h3 className="text-lg font-semibold text-slate-900">Attachments</h3>
              </div>
              <button
                onClick={() => setShowAttachmentPreviewPanel(false)}
                className="rounded-lg p-2 text-slate-400 hover:bg-slate-100 hover:text-slate-600"
                aria-label="Close attachment preview"
              >
                <X size={18} />
              </button>
            </div>
            <div className="p-5">
              {emails.filter(e => e.hasAttachment).length > 0 ? (
                <div className="space-y-3">
                  <p className="text-sm text-slate-600 mb-4">
                    Found {emails.filter(e => e.hasAttachment).length} emails with attachments
                  </p>
                  {emails.filter(e => e.hasAttachment).slice(0, 5).map((email) => (
                    <div key={email.id} className="flex items-center gap-3 p-3 bg-slate-50 rounded-lg">
                      <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-[#e8f1fe]">
                        <Paperclip size={18} className="text-[#0b65d7]" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-slate-800 truncate">{email.subject}</p>
                        <p className="text-xs text-slate-500">From: {email.sender.name}</p>
                      </div>
                      <button className="px-3 py-1 text-xs font-medium text-[#0b65d7] bg-white border border-slate-200 rounded hover:bg-slate-50">
                        Preview
                      </button>
                    </div>
                  ))}
                  {emails.filter(e => e.hasAttachment).length > 5 && (
                    <p className="text-xs text-slate-500 text-center">
                      And {emails.filter(e => e.hasAttachment).length - 5} more...
                    </p>
                  )}
                </div>
              ) : (
                <div className="py-8 text-center">
                  <Paperclip size={32} className="mx-auto mb-3 text-slate-300" />
                  <p className="text-slate-600">No attachments found</p>
                  <p className="text-sm text-slate-400 mt-1">Emails with attachments will appear here</p>
                </div>
              )}
            </div>
            <div className="flex justify-end gap-2 border-t px-5 py-4">
              <button
                onClick={() => setShowAttachmentPreviewPanel(false)}
                className="rounded-full border border-slate-200 px-4 py-2 text-xs font-medium text-slate-600 hover:bg-slate-50"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Single Attachment File Preview Modal */}
      {previewingAttachment && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 px-4">
          <div className="w-full max-w-4xl overflow-hidden rounded-2xl bg-white shadow-2xl">
            <div className="flex items-center justify-between border-b px-5 py-4 bg-slate-50">
              <div className="flex items-center gap-3">
                <Paperclip className="text-[#0b65d7]" size={20} />
                <div>
                  <h3 className="text-lg font-semibold text-slate-900">{previewingAttachment.name}</h3>
                  <p className="text-xs text-slate-500">{previewingAttachment.size}</p>
                </div>
              </div>
              <button
                onClick={() => setPreviewingAttachment(null)}
                className="rounded-lg p-2 text-slate-400 hover:bg-slate-200 hover:text-slate-600"
                aria-label="Close attachment preview"
              >
                <X size={18} />
              </button>
            </div>
            <div className="p-6 bg-slate-100 max-h-[70vh] overflow-auto">
              {previewingAttachment.url ? (
                <img
                  src={previewingAttachment.url}
                  alt={previewingAttachment.name}
                  className="w-full h-auto rounded-lg shadow-lg border border-slate-200"
                  onError={(e) => {
                    const target = e.target as HTMLImageElement;
                    target.style.display = 'none';
                    target.nextElementSibling?.classList.remove('hidden');
                  }}
                />
              ) : null}
              <div className={previewingAttachment.url ? "hidden" : "flex flex-col items-center justify-center py-16 text-slate-500"}>
                <Paperclip size={48} className="text-slate-300 mb-4" />
                <p className="text-sm">Preview not available</p>
                <p className="text-xs text-slate-400 mt-1">{previewingAttachment.name}</p>
              </div>
            </div>
            <div className="flex justify-end gap-2 border-t px-5 py-4 bg-white">
              <button
                onClick={() => setPreviewingAttachment(null)}
                className="rounded-full border border-slate-200 px-4 py-2 text-sm font-medium text-slate-600 hover:bg-slate-50"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {isComposeOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4">
          <div className="w-full max-w-2xl overflow-hidden rounded-2xl bg-white shadow-2xl">
            <div className="flex items-center justify-between border-b px-5 py-4">
              <div>
                <h3 className="text-lg font-semibold text-slate-900">New message</h3>
                <p className="text-xs text-slate-500">Message will be sent from {currentUser?.email}</p>
              </div>
              <button
                onClick={handleCloseCompose}
                className="rounded-lg p-2 text-slate-400 hover:bg-slate-100 hover:text-slate-600"
                aria-label="Close compose dialog"
              >
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handleSendMessage} className="space-y-4 px-5 py-5">
              <div>
                <div className="flex items-center justify-between">
                  <label className="text-xs font-semibold uppercase tracking-wide text-slate-500">To</label>
                  {!showCcBcc && (
                    <button
                      type="button"
                      onClick={() => setShowCcBcc(true)}
                      className="text-xs text-[#0b65d7] hover:underline"
                    >
                      Cc & Bcc
                    </button>
                  )}
                </div>
                <input
                  type="text"
                  value={composeDraft.to}
                  onChange={handleComposeFieldChange("to")}
                  placeholder="name@example.com"
                  className="mt-1 w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700 focus:border-[#0b65d7] focus:ring-2 focus:ring-[#0b65d7]/20 focus:outline-none"
                />
              </div>
              {showCcBcc && (
                <>
                  <div>
                    <label className="text-xs font-semibold uppercase tracking-wide text-slate-500">Cc</label>
                    <input
                      type="text"
                      value={composeDraft.cc}
                      onChange={handleComposeFieldChange("cc")}
                      placeholder="Add Cc recipients"
                      className="mt-1 w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700 focus:border-[#0b65d7] focus:ring-2 focus:ring-[#0b65d7]/20 focus:outline-none"
                    />
                  </div>
                  <div>
                    <label className="text-xs font-semibold uppercase tracking-wide text-slate-500">Bcc</label>
                    <input
                      type="text"
                      value={composeDraft.bcc}
                      onChange={handleComposeFieldChange("bcc")}
                      placeholder="Add Bcc recipients"
                      className="mt-1 w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700 focus:border-[#0b65d7] focus:ring-2 focus:ring-[#0b65d7]/20 focus:outline-none"
                    />
                  </div>
                </>
              )}
              <div>
                <label className="text-xs font-semibold uppercase tracking-wide text-slate-500">Subject</label>
                <input
                  type="text"
                  value={composeDraft.subject}
                  onChange={handleComposeFieldChange("subject")}
                  placeholder="Add a subject"
                  className="mt-1 w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700 focus:border-[#0b65d7] focus:ring-2 focus:ring-[#0b65d7]/20 focus:outline-none"
                />
              </div>
              <div>
                <label className="text-xs font-semibold uppercase tracking-wide text-slate-500">Message</label>
                <textarea
                  value={composeDraft.body}
                  onChange={handleComposeFieldChange("body")}
                  placeholder="Type your message..."
                  rows={8}
                  className="mt-1 w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700 focus:border-[#0b65d7] focus:ring-2 focus:ring-[#0b65d7]/20 focus:outline-none"
                />
              </div>

              {composeError && (
                <div className="rounded-md border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700">
                  {composeError}
                </div>
              )}

              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <button
                    type="submit"
                    className="inline-flex items-center gap-2 rounded-full bg-[#0b65d7] px-5 py-2 text-sm font-semibold text-white shadow hover:bg-[#0a4cab]"
                  >
                    <Send size={16} />
                    Send
                  </button>
                  <button
                    type="button"
                    onClick={handleSaveDraft}
                    className="rounded-full border border-slate-200 px-4 py-2 text-xs font-medium text-slate-600 hover:border-[#0b65d7] hover:text-[#0b65d7]"
                  >
                    Save draft
                  </button>
                  <button
                    type="button"
                    onClick={handleHeaderAction("Attach from OneDrive")}
                    className="rounded-full border border-slate-200 px-4 py-2 text-xs font-medium text-slate-600 hover:border-[#0b65d7] hover:text-[#0b65d7]"
                  >
                    Attach
                  </button>
                  <button
                    type="button"
                    onClick={handleDiscardDraft}
                    className="rounded-full border border-slate-200 px-4 py-2 text-xs font-medium text-rose-600 hover:border-rose-400 hover:bg-rose-50"
                  >
                    Discard
                  </button>
                </div>
                <div className="flex items-center gap-3 text-xs text-slate-400">
                  <span>Formatting</span>
                  <span>Insert</span>
                  <span>More</span>
                </div>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Context Menu */}
      {contextMenu && (() => {
        const email = emails.find(e => e.id === contextMenu.emailId);
        if (!email) return null;
        return (
          <div
            className="fixed z-50 min-w-[180px] rounded-lg border border-slate-200 bg-white py-1 shadow-xl"
            style={{ top: contextMenu.y, left: contextMenu.x }}
          >
            <button
              onClick={() => handleContextMenuAction("delete")}
              className="flex w-full items-center gap-2 px-3 py-2 text-sm text-slate-700 hover:bg-slate-100"
            >
              <Trash2 size={14} className="text-slate-500" />
              Delete
            </button>
            <button
              onClick={() => handleContextMenuAction("archive")}
              className="flex w-full items-center gap-2 px-3 py-2 text-sm text-slate-700 hover:bg-slate-100"
            >
              <Archive size={14} className="text-slate-500" />
              Archive
            </button>
            <button
              onClick={() => handleContextMenuAction("flag")}
              className="flex w-full items-center gap-2 px-3 py-2 text-sm text-slate-700 hover:bg-slate-100"
            >
              <Flag size={14} className={email.isFlagged ? "text-rose-500" : "text-slate-500"} />
              {email.isFlagged ? "Unflag" : "Flag"}
            </button>
            <div className="my-1 border-t border-slate-100" />
            {email.isRead ? (
              <button
                onClick={() => handleContextMenuAction("markUnread")}
                className="flex w-full items-center gap-2 px-3 py-2 text-sm text-slate-700 hover:bg-slate-100"
              >
                <Mail size={14} className="text-slate-500" />
                Mark as unread
              </button>
            ) : (
              <button
                onClick={() => handleContextMenuAction("markRead")}
                className="flex w-full items-center gap-2 px-3 py-2 text-sm text-slate-700 hover:bg-slate-100"
              >
                <MailOpen size={14} className="text-slate-500" />
                Mark as read
              </button>
            )}
            <div className="my-1 border-t border-slate-100" />
            {email.folder !== "junk" ? (
              <button
                onClick={() => handleContextMenuAction("moveToJunk")}
                className="flex w-full items-center gap-2 px-3 py-2 text-sm text-slate-700 hover:bg-slate-100"
              >
                <Trash2 size={14} className="text-orange-500" />
                Move to Junk
              </button>
            ) : (
              <button
                onClick={() => handleContextMenuAction("moveToInbox")}
                className="flex w-full items-center gap-2 px-3 py-2 text-sm text-slate-700 hover:bg-slate-100"
              >
                <Inbox size={14} className="text-slate-500" />
                Move to Inbox
              </button>
            )}
          </div>
        );
      })()}

      {toast && (
        <div
          role="status"
          className={classNames(
            "fixed bottom-6 right-6 z-30 max-w-sm rounded-xl px-4 py-3 text-sm shadow-lg",
            toast.tone === "success"
              ? "border border-emerald-200 bg-emerald-50 text-emerald-700"
              : toast.tone === "error"
                ? "border border-rose-200 bg-rose-50 text-rose-700"
                : "bg-slate-900/90 text-white",
          )}
        >
          {toast.message}
        </div>
      )}

      {isSignedOut && (
        <div className="fixed inset-0 z-50 flex items-center justify-center" style={{ backgroundColor: "rgba(0,0,0,0.5)", backdropFilter: "blur(6px)" }}>
          <div className="bg-white rounded-lg shadow-2xl p-8 w-[360px] flex flex-col items-center">
            <div className="text-2xl font-bold text-blue-600 mb-6">MicroMail</div>
            <div className="w-20 h-20 rounded-full bg-blue-600 flex items-center justify-center text-white text-2xl font-bold mb-4">
              {userInitials}
            </div>
            <div className="text-lg font-semibold text-gray-900 mb-1">{currentUser?.name || "User"}</div>
            <div className="text-sm text-gray-500 mb-6">{currentUser?.email || "user@micromail.com"}</div>
            <input type="password" readOnly value="••••••••" className="w-full px-4 py-2 border border-gray-300 rounded mb-4 text-center text-gray-400 bg-gray-50" />
            <button onClick={() => setIsSignedOut(false)} className="w-full py-2 bg-blue-600 text-white rounded font-semibold hover:bg-blue-700 transition-colors">
              Sign in
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default Micromail;
