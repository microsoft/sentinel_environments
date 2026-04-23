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
import { useHashTab } from "../hooks/useHashTab";

import { useMicromailData } from "../hooks/useMicromailData";
import {
  Archive,
  ArrowDown,
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
  isPinned: boolean;
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
    pinEmail: apiPinEmail,
    sendEmail: apiSendEmail,
    deleteEmail: apiDeleteEmail,
  } = useMicromailData();

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
      recipients: api.recipients ?? [apiConfig?.selfUser?.email ?? "you@micromail.com"],
      cc: api.cc,
      subject: api.subject,
      preview: api.body?.replace(/\n/g, " ").slice(0, 140) ?? "",
      body: api.body,
      timestamp: api.timestamp,
      isRead: api.isRead,
      isFlagged: api.isFlagged,
      isPinned: api.isPinned,
      isExternal: api.isExternal,
      isCC: api.isCC,
      hasAttachment: api.hasAttachment,
      attachments: api.attachment ? [api.attachment] : [],
      mentionsMe: api.mentionsMe,
      importance: (api.importance || "normal") as ImportanceLevel,
    }));
  }, [apiEmails, apiConfig]);

  const [isSignedOut, setIsSignedOut] = useState(false);

  // UI state
  const [selectedFolder, setSelectedFolder] = useHashTab<FolderKey>(["inbox", "sent", "drafts", "archive", "junk", "deleted", "scheduled"] as const, "inbox");
  const [quickFilter, setQuickFilter] = useState<QuickFilter>("all");
  // Email pinned in a quick-filter view so it stays visible after being marked read/unflagged
  const [pinnedEmailId, setPinnedEmailId] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedEmailId, setSelectedEmailId] = useState<string | null>(null);
  const userClearedSelectionRef = useRef(false);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [isComposeOpen, setIsComposeOpen] = useState(false);
  const [editingDraftId, setEditingDraftId] = useState<string | null>(null);
  const [composeDraft, setComposeDraft] = useState({ to: "", cc: "", bcc: "", subject: "", body: "" });
  const [showCcBcc, setShowCcBcc] = useState(false);
  const [composeError, setComposeError] = useState<string | null>(null);
  const [isMobileNavOpen, setIsMobileNavOpen] = useState(false);
  const [toast, setToast] = useState<ToastState | null>(null);

  // Context menu state
  const [contextMenu, setContextMenu] = useState<{ x: number; y: number; emailId: string } | null>(null);


  // UI panel state
  const [showUserDropdown, setShowUserDropdown] = useState(false);
  const [previewingAttachment, setPreviewingAttachment] = useState<Attachment | null>(null);
  const [discardConfirmOpen, setDiscardConfirmOpen] = useState(false);

  const currentUser = apiConfig?.selfUser;
  const userInitials = useMemo(
    () => (currentUser?.name ? getInitials(currentUser.name) : ""),
    [currentUser?.name],
  );

  const searchFieldRef = useRef<HTMLInputElement>(null);
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
      working = working.filter((email) => !email.isRead || email.id === pinnedEmailId);
    } else if (quickFilter === "flagged") {
      working = working.filter((email) => email.isFlagged || email.id === pinnedEmailId);
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
      (a, b) => {
        // Pinned emails always come first
        if (a.isPinned && !b.isPinned) return -1;
        if (!a.isPinned && b.isPinned) return 1;
        return new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime();
      }
    );
  }, [emails, selectedFolder, quickFilter, searchQuery, pinnedEmailId]);

  const selectedEmail = useMemo(
    () => emails.find((email) => email.id === selectedEmailId) ?? null,
    [emails, selectedEmailId]
  );

  const selectedFolderLabel = useMemo(() => {
    const definition = FOLDER_DEFINITIONS.find((item) => item.key === selectedFolder);
    return definition?.label ?? "Inbox";
  }, [selectedFolder]);

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
    if (filteredEmails.length === 0) {
      setSelectedEmailId(null);
      return;
    }

    setSelectedEmailId((current) => {
      if (current && filteredEmails.some((email) => email.id === current)) {
        return current;
      }
      if (userClearedSelectionRef.current) {
        return null;
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
      setPinnedEmailId(null);
      setIsMobileNavOpen(false);
      setSearchQuery("");
    },
    [],
  );

  const handleSelectEmail = useCallback((emailId: string) => {
    const target = emails.find((e) => e.id === emailId);
    if (target && target.folder === "drafts") {
      setEditingDraftId(emailId);
      setComposeDraft({
        to: (target.recipients ?? []).join(", "),
        cc: (target.cc ?? []).join(", "),
        bcc: "",
        subject: target.subject ?? "",
        body: target.body ?? "",
      });
      setShowCcBcc(((target.cc ?? []).length > 0));
      setComposeError(null);
      setIsComposeOpen(true);
      return;
    }

    userClearedSelectionRef.current = false;
    setSelectedEmailId(emailId);

    // Pin the email so it stays visible in the current quick-filter view
    if (quickFilter !== "all") {
      setPinnedEmailId(emailId);
    }

    apiMarkRead(emailId);
  }, [apiMarkRead, emails, quickFilter]);

  const handleEmailKeyDown = (event: ReactKeyboardEvent<HTMLDivElement>, emailId: string) => {
    if (event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      handleSelectEmail(emailId);
    }
  };

  const handleToggleFlag = useCallback((emailId?: string) => {
    const targetId = emailId ?? selectedEmailId;
    if (!targetId) return;

    const targetEmail = emails.find((email) => email.id === targetId);
    apiFlagEmail(targetId);
    triggerToast(targetEmail?.isFlagged ? "Flag removed" : "Flagged for follow-up", "info");
  }, [apiFlagEmail, emails, selectedEmailId, triggerToast]);

  const handleMarkUnread = useCallback((emailId?: string) => {
    const targetId = emailId ?? selectedEmailId;
    if (!targetId) return;

    apiMarkUnread(targetId);
    triggerToast("Marked as unread", "info");
  }, [apiMarkUnread, selectedEmailId, triggerToast]);

  const handleMarkRead = useCallback((emailId?: string) => {
    const targetId = emailId ?? selectedEmailId;
    if (!targetId) return;

    apiMarkRead(targetId);
    triggerToast("Marked as read", "info");
  }, [apiMarkRead, selectedEmailId, triggerToast]);

  const handleArchiveEmail = useCallback((emailId?: string) => {
    const targetId = emailId ?? selectedEmailId;
    if (!targetId) return;

    apiMoveEmail(targetId, "archive");
    setSelectedEmailId((current) => (current === targetId ? null : current));
    triggerToast("Conversation archived", "info");
  }, [apiMoveEmail, selectedEmailId, triggerToast]);

  const handleDeleteEmail = useCallback((emailId?: string) => {
    const targetId = emailId ?? selectedEmailId;
    if (!targetId) return;

    const target = emails.find((e) => e.id === targetId);
    const currentFolder = target?.folder;
    if (currentFolder === "deleted" || currentFolder === "drafts") {
      apiDeleteEmail(targetId);
      setSelectedEmailId((current) => (current === targetId ? null : current));
      triggerToast(currentFolder === "drafts" ? "Draft deleted" : "Permanently deleted", "info");
    } else {
      apiMoveEmail(targetId, "deleted");
      setSelectedEmailId((current) => (current === targetId ? null : current));
      triggerToast("Moved to Deleted Items", "info");
    }
  }, [apiMoveEmail, apiDeleteEmail, emails, selectedEmailId, triggerToast]);

  const handleToggleRowSelection = useCallback((emailId: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(emailId)) {
        next.delete(emailId);
      } else {
        next.add(emailId);
      }
      return next;
    });
  }, []);

  const handleClearSelection = useCallback(() => {
    setSelectedIds(new Set());
  }, []);

  const handleBulkMarkRead = useCallback(() => {
    selectedIds.forEach((id) => apiMarkRead(id));
    triggerToast(`${selectedIds.size} marked as read`, "info");
    setSelectedIds(new Set());
  }, [apiMarkRead, selectedIds, triggerToast]);

  const handleBulkMarkUnread = useCallback(() => {
    selectedIds.forEach((id) => apiMarkUnread(id));
    triggerToast(`${selectedIds.size} marked as unread`, "info");
    setSelectedIds(new Set());
  }, [apiMarkUnread, selectedIds, triggerToast]);

  const handleBulkFlag = useCallback(() => {
    selectedIds.forEach((id) => apiFlagEmail(id));
    triggerToast(`${selectedIds.size} flag toggled`, "info");
    setSelectedIds(new Set());
  }, [apiFlagEmail, selectedIds, triggerToast]);

  const handleBulkArchive = useCallback(() => {
    const count = selectedIds.size;
    selectedIds.forEach((id) => apiMoveEmail(id, "archive"));
    setSelectedEmailId((current) => (current && selectedIds.has(current) ? null : current));
    triggerToast(`${count} archived`, "info");
    setSelectedIds(new Set());
  }, [apiMoveEmail, selectedIds, triggerToast]);

  const handleBulkDelete = useCallback(() => {
    const count = selectedIds.size;
    selectedIds.forEach((id) => {
      const target = emails.find((e) => e.id === id);
      const folder = target?.folder;
      if (folder === "deleted" || folder === "drafts") {
        apiDeleteEmail(id);
      } else {
        apiMoveEmail(id, "deleted");
      }
    });
    setSelectedEmailId((current) => (current && selectedIds.has(current) ? null : current));
    triggerToast(`${count} deleted`, "info");
    setSelectedIds(new Set());
  }, [apiDeleteEmail, apiMoveEmail, emails, selectedIds, triggerToast]);

  const handleSearchChange = (event: ChangeEvent<HTMLInputElement>) => {
    setSearchQuery(event.target.value);
  };

  const handleComposeOpen = useCallback(() => {
    setIsComposeOpen(true);
    setEditingDraftId(null);
    setComposeDraft({ to: "", cc: "", bcc: "", subject: "", body: "" });
    setComposeError(null);
    setIsMobileNavOpen(false);
  }, []);

  const handleCloseCompose = useCallback(() => {
    const hasContent = composeDraft.to.trim() || composeDraft.subject.trim() || composeDraft.body.trim();
    if (hasContent) {
      const toList = composeDraft.to.split(/[,;]/).map((s) => s.trim()).filter(Boolean);
      const ccList = composeDraft.cc.split(/[,;]/).map((s) => s.trim()).filter(Boolean);
      const bccList = composeDraft.bcc.split(/[,;]/).map((s) => s.trim()).filter(Boolean);
      const priorDraftId = editingDraftId;
      apiSendEmail(toList, ccList, bccList, composeDraft.subject, composeDraft.body, "drafts")
        .then(() => {
          if (priorDraftId) apiDeleteEmail(priorDraftId);
        })
        .catch(() => {});
      triggerToast("Draft saved", "info");
    } else if (editingDraftId) {
      apiDeleteEmail(editingDraftId);
    }
    setIsComposeOpen(false);
    setEditingDraftId(null);
    setComposeDraft({ to: "", cc: "", bcc: "", subject: "", body: "" });
    setShowCcBcc(false);
    setComposeError(null);
  }, [composeDraft, editingDraftId, apiSendEmail, apiDeleteEmail, triggerToast]);

  const handleComposeFieldChange =
    (field: "to" | "cc" | "bcc" | "subject" | "body") =>
    (event: ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
      const { value } = event.target;
      setComposeDraft((prev) => ({ ...prev, [field]: value }));
    };

  const handleSendMessage = useCallback(
    async (event: FormEvent<HTMLFormElement>) => {
      event.preventDefault();

      const trimmedTo = composeDraft.to.trim();

      if (!trimmedTo) {
        setComposeError("Please specify at least one recipient.");
        return;
      }

      const toList = trimmedTo.split(/[,;]/).map((s) => s.trim()).filter(Boolean);
      const ccList = composeDraft.cc.split(/[,;]/).map((s) => s.trim()).filter(Boolean);
      const bccList = composeDraft.bcc.split(/[,;]/).map((s) => s.trim()).filter(Boolean);

      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      const invalid = [...toList, ...ccList, ...bccList].find((addr) => !emailRegex.test(addr));
      if (invalid) {
        setComposeError(`"${invalid}" is not a valid email address.`);
        return;
      }

      try {
        await apiSendEmail(toList, ccList, bccList, composeDraft.subject, composeDraft.body);
        if (editingDraftId) {
          await apiDeleteEmail(editingDraftId);
        }
        setIsComposeOpen(false);
        setEditingDraftId(null);
        setComposeDraft({ to: "", cc: "", bcc: "", subject: "", body: "" });
        setShowCcBcc(false);
        setComposeError(null);
        triggerToast("Message sent", "success");
      } catch {
        triggerToast("Failed to send message", "error");
      }
    },
    [composeDraft, editingDraftId, triggerToast, apiSendEmail, apiDeleteEmail],
  );

  const handleSaveDraft = useCallback(async () => {
    if (!composeDraft.to.trim() && !composeDraft.subject.trim() && !composeDraft.body.trim()) {
      triggerToast("Nothing to save yet", "info");
      return;
    }

    const toList = composeDraft.to.split(/[,;]/).map((s) => s.trim()).filter(Boolean);
    const ccList = composeDraft.cc.split(/[,;]/).map((s) => s.trim()).filter(Boolean);
    const bccList = composeDraft.bcc.split(/[,;]/).map((s) => s.trim()).filter(Boolean);

    try {
      await apiSendEmail(toList, ccList, bccList, composeDraft.subject, composeDraft.body, "drafts");
      if (editingDraftId) {
        await apiDeleteEmail(editingDraftId);
      }
      setIsComposeOpen(false);
      setEditingDraftId(null);
      setComposeDraft({ to: "", cc: "", bcc: "", subject: "", body: "" });
      setShowCcBcc(false);
      setComposeError(null);
      triggerToast("Draft saved", "info");
    } catch {
      triggerToast("Failed to save draft", "error");
    }
  }, [composeDraft, editingDraftId, triggerToast, apiSendEmail, apiDeleteEmail]);

  // Discard draft handler — opens in-app confirmation modal when there's content
  const handleDiscardDraft = useCallback(() => {
    const hasContent = composeDraft.to.trim() || composeDraft.cc.trim() || composeDraft.bcc.trim() ||
                       composeDraft.subject.trim() || composeDraft.body.trim();
    if (hasContent) {
      setDiscardConfirmOpen(true);
      return;
    }
    if (editingDraftId) {
      apiDeleteEmail(editingDraftId);
    }
    setIsComposeOpen(false);
    setEditingDraftId(null);
    setComposeDraft({ to: "", cc: "", bcc: "", subject: "", body: "" });
    setShowCcBcc(false);
    setComposeError(null);
    triggerToast("Draft discarded", "info");
  }, [composeDraft, editingDraftId, apiDeleteEmail, triggerToast]);

  const handleConfirmDiscardDraft = useCallback(() => {
    if (editingDraftId) {
      apiDeleteEmail(editingDraftId);
    }
    setDiscardConfirmOpen(false);
    setIsComposeOpen(false);
    setEditingDraftId(null);
    setComposeDraft({ to: "", cc: "", bcc: "", subject: "", body: "" });
    setShowCcBcc(false);
    setComposeError(null);
    triggerToast("Draft discarded", "info");
  }, [editingDraftId, apiDeleteEmail, triggerToast]);

  // Reply handler - opens compose with pre-filled recipient and subject
  const handleReply = useCallback(() => {
    if (!selectedEmail) return;
    setEditingDraftId(null);
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
    setEditingDraftId(null);
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
    setEditingDraftId(null);
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
      case "pin": apiPinEmail(emailId); triggerToast("Pin updated", "info"); break;
    }
    setContextMenu(null);
  }, [apiMoveEmail, apiFlagEmail, apiMarkRead, apiMarkUnread, apiPinEmail, contextMenu, triggerToast]);

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
      <div className="flex h-full w-full flex-col bg-white">
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
      selectedEmail
        ? isDanger
          ? "text-slate-500 hover:bg-white hover:text-rose-500"
          : "text-slate-500 hover:bg-white hover:text-[#0b65d7]"
        : "cursor-not-allowed text-slate-300",
    );


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

        <div className="flex flex-1 flex-col lg:flex-row">
          <section
            className={classNames(
              "order-2 w-full flex-col bg-white lg:order-1 lg:flex lg:w-[430px] lg:border-r lg:border-slate-200",
              selectedEmailId ? "hidden lg:flex" : "flex",
            )}
          >
            <div className="border-b border-slate-200 px-4 py-3">
              <div className="flex items-center justify-between text-sm text-slate-500">
                <div className="flex items-center gap-2 font-semibold text-slate-700">
                  <span>{selectedFolderLabel}</span>
                </div>
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
                      onClick={() => { setQuickFilter(filter.key); setPinnedEmailId(null); }}
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

            {selectedIds.size > 0 ? (
              <div className="flex flex-wrap items-center gap-2 border-b border-[#0b65d7]/30 bg-[#e8f1fe] px-4 py-2 text-xs text-slate-700" data-testid="bulk-toolbar">
                <span className="text-xs font-semibold text-[#0b65d7]">{selectedIds.size} selected</span>
                <button
                  onClick={handleBulkMarkRead}
                  className="rounded-md border border-slate-200 bg-white p-1.5 text-slate-600 hover:border-[#0b65d7] hover:text-[#0b65d7]"
                  aria-label="Mark selected as read"
                  title="Mark as read"
                >
                  <MailOpen size={14} />
                </button>
                <button
                  onClick={handleBulkMarkUnread}
                  className="rounded-md border border-slate-200 bg-white p-1.5 text-slate-600 hover:border-[#0b65d7] hover:text-[#0b65d7]"
                  aria-label="Mark selected as unread"
                  title="Mark as unread"
                >
                  <Mail size={14} />
                </button>
                <button
                  onClick={handleBulkFlag}
                  className="rounded-md border border-slate-200 bg-white p-1.5 text-slate-600 hover:border-[#d97706] hover:text-[#d97706]"
                  aria-label="Flag selected"
                  title="Flag"
                >
                  <Flag size={14} />
                </button>
                <button
                  onClick={handleBulkArchive}
                  className="rounded-md border border-slate-200 bg-white p-1.5 text-slate-600 hover:border-[#0b65d7] hover:text-[#0b65d7]"
                  aria-label="Archive selected"
                  title="Archive"
                >
                  <Archive size={14} />
                </button>
                <button
                  onClick={handleBulkDelete}
                  className="rounded-md border border-rose-200 bg-white p-1.5 text-rose-600 hover:border-rose-400 hover:bg-rose-50"
                  aria-label="Delete selected"
                  title="Delete"
                >
                  <Trash2 size={14} />
                </button>
                <button
                  onClick={handleClearSelection}
                  className="ml-auto rounded-md px-2 py-1 text-xs font-medium text-slate-500 hover:bg-white hover:text-slate-700"
                  aria-label="Clear selection"
                >
                  Cancel
                </button>
              </div>
            ) : (
              <div className="flex items-center justify-between border-b border-slate-200 bg-slate-50 px-4 py-2 text-xs text-slate-500">
                <div className="flex items-center gap-3">
                  <button
                    onClick={() => handleToggleFlag()}
                    className={actionButtonClass()}
                    disabled={!selectedEmail}
                    aria-label="Toggle flag for selected conversation"
                  >
                    <Flag size={16} />
                  </button>
                  <button
                    onClick={() => {
                      if (selectedEmail?.isRead) {
                        handleMarkUnread();
                      } else {
                        handleMarkRead();
                      }
                    }}
                    className={actionButtonClass()}
                    disabled={!selectedEmail}
                    aria-label={selectedEmail?.isRead ? "Mark selected conversation as unread" : "Mark selected conversation as read"}
                  >
                    {selectedEmail?.isRead ? <Mail size={16} /> : <MailOpen size={16} />}
                  </button>
                  <button
                    onClick={() => handleArchiveEmail()}
                    className={actionButtonClass()}
                    disabled={!selectedEmail}
                    aria-label="Archive conversation"
                  >
                    <Archive size={16} />
                  </button>
                  <button
                    onClick={() => handleDeleteEmail()}
                    className={actionButtonClass(true)}
                    disabled={!selectedEmail}
                    aria-label="Delete conversation"
                  >
                    <Trash2 size={16} />
                  </button>

                </div>
                <span className="text-slate-500">{filteredEmails.length} items</span>
              </div>
            )}

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
                      <div className="flex flex-col items-center pt-2">
                        <input
                          type="checkbox"
                          checked={selectedIds.has(email.id)}
                          onClick={(event) => event.stopPropagation()}
                          onChange={(event) => {
                            event.stopPropagation();
                            handleToggleRowSelection(email.id);
                          }}
                          className="h-4 w-4 cursor-pointer rounded border-slate-300 text-[#0b65d7] focus:ring-[#0b65d7]"
                          aria-label={selectedIds.has(email.id) ? "Deselect email" : "Select email"}
                        />
                        {email.isFlagged && (
                          <Flag size={12} className="mt-2 text-[#d97706]" fill="#d97706" aria-label="Flagged" />
                        )}
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
                        <div className="flex items-center justify-between gap-2">
                          <div className="flex min-w-0 items-center gap-2">
                            <p
                              className={classNames(
                                "truncate text-sm",
                                email.isRead ? "text-slate-600" : "font-semibold text-slate-900",
                              )}
                            >
                              {email.sender.name}
                            </p>
                            {email.isExternal && (
                              <span className="inline-flex flex-shrink-0 items-center gap-1 rounded border border-amber-300 bg-amber-50 px-1.5 py-0.5 text-[10px] font-semibold text-amber-700">
                                <Globe size={10} />
                                External
                              </span>
                            )}
                          </div>
                          <div className="flex flex-shrink-0 items-center gap-1">
                            {email.isPinned && (
                              <MapPin size={14} className="text-[#0b65d7]" aria-label="Pinned" />
                            )}
                            {email.importance === "high" && (
                              <span
                                className="inline-flex h-4 w-4 items-center justify-center text-sm font-bold leading-none text-rose-600"
                                aria-label="High importance"
                              >
                                !
                              </span>
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
                        </div>

                        <p className="truncate text-xs text-slate-500">{email.preview?.replace(/@you\b/gi, `@${currentUser?.name ?? "You"}`)}</p>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </section>

          <section
            className={classNames(
              "order-3 flex-1 flex-col bg-white lg:order-2 lg:flex",
              selectedEmailId ? "flex" : "hidden lg:flex",
            )}
          >
            {selectedEmail ? (
              <div className="flex h-full flex-col">
                <div className="border-b border-slate-200 px-6 py-5">
                  <button
                    onClick={() => {
                      userClearedSelectionRef.current = true;
                      setSelectedEmailId(null);
                    }}
                    className="mb-3 inline-flex items-center gap-1 text-xs font-medium text-[#0b65d7] hover:underline lg:hidden"
                    aria-label="Back to email list"
                  >
                    <ChevronDown size={14} className="rotate-90" />
                    Back to list
                  </button>
                  <div className="flex flex-wrap items-start justify-between gap-4">
                    <div>
                      <h2 className="text-lg font-semibold text-slate-900">{selectedEmail.subject}</h2>
                      <div className="mt-2 flex flex-wrap items-center gap-2">
                        {selectedEmail.importance === "high" && (
                          <span className="inline-flex items-center gap-1 rounded-full bg-rose-50 px-2 py-0.5 text-xs font-medium text-rose-700">
                            <span className="inline-flex h-3 w-3 items-center justify-center text-xs font-bold leading-none text-rose-600" aria-hidden="true">!</span>
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
                          onClick={() => {
                            if (selectedEmail.isRead) {
                              handleMarkUnread();
                            } else {
                              handleMarkRead();
                            }
                          }}
                          className="rounded-md border border-slate-200 px-3 py-1 text-xs font-medium text-slate-600 hover:border-[#0b65d7] hover:text-[#0b65d7]"
                        >
                          {selectedEmail.isRead ? "Mark unread" : "Mark as read"}
                        </button>
                        <button
                          onClick={() => handleToggleFlag()}
                          className="rounded-md border border-slate-200 px-3 py-1 text-xs font-medium text-slate-600 hover:border-[#0b65d7] hover:text-[#0b65d7]"
                        >
                          {selectedEmail.isFlagged ? "Unflag" : "Flag"}
                        </button>
                        <button
                          onClick={() => handleArchiveEmail()}
                          className="rounded-md border border-slate-200 px-3 py-1 text-xs font-medium text-slate-600 hover:border-[#0b65d7] hover:text-[#0b65d7]"
                        >
                          Archive
                        </button>
                        <button
                          onClick={() => handleDeleteEmail()}
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
                    onClick={() => {
                      if (selectedEmail) {
                        apiPinEmail(selectedEmail.id);
                        triggerToast(selectedEmail.isPinned ? "Unpinned" : "Pinned to top", "info");
                      }
                    }}
                    className={classNames(
                      "rounded-md border px-3 py-1 text-xs font-medium transition",
                      selectedEmail?.isPinned
                        ? "border-[#0b65d7] bg-[#e8f1fe] text-[#0b65d7]"
                        : "border-slate-200 text-slate-600 hover:border-[#0b65d7] hover:text-[#0b65d7]",
                    )}
                  >
                    {selectedEmail?.isPinned ? "Unpin" : "Pin"}
                  </button>
                </div>

                <div className="flex-1 space-y-1 overflow-y-auto px-6 py-6 text-[15px] leading-relaxed text-slate-700">
                  {selectedEmail.body.split("\n").map((paragraph, index) => {
                    const resolved = paragraph.replace(/@you\b/gi, `@${currentUser?.name ?? "You"}`);
                    return (
                      <p key={`${selectedEmail.id}-paragraph-${index}`}>
                        {resolved.trim().length ? resolved : <span className="opacity-0">.</span>}
                      </p>
                    );
                  })}

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
      {/* Discard draft confirmation */}
      {discardConfirmOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4">
          <div className="w-full max-w-sm overflow-hidden rounded-2xl bg-white shadow-2xl">
            <div className="px-5 py-4 border-b">
              <h3 className="text-base font-semibold text-slate-900">Discard this draft?</h3>
              <p className="mt-1 text-sm text-slate-500">Your changes will not be saved.</p>
            </div>
            <div className="flex justify-end gap-2 px-5 py-4">
              <button
                onClick={() => setDiscardConfirmOpen(false)}
                className="rounded-full border border-slate-200 px-4 py-2 text-xs font-medium text-slate-600 hover:bg-slate-50"
              >
                Keep editing
              </button>
              <button
                onClick={handleConfirmDiscardDraft}
                className="rounded-full border border-rose-400 bg-rose-50 px-4 py-2 text-xs font-medium text-rose-600 hover:bg-rose-100"
              >
                Discard
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
                <h3 className="text-lg font-semibold text-slate-900">{editingDraftId ? "Edit draft" : "New message"}</h3>
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
              <div className="overflow-hidden rounded-lg border border-slate-200 bg-white focus-within:border-[#0b65d7] focus-within:ring-2 focus-within:ring-[#0b65d7]/20">
                <input
                  type="text"
                  value={composeDraft.subject}
                  onChange={handleComposeFieldChange("subject")}
                  placeholder="Add a subject"
                  className="w-full border-0 border-b border-slate-200 bg-transparent px-3 py-2 text-sm font-medium text-slate-800 placeholder:text-slate-400 focus:outline-none focus:ring-0"
                />
                <textarea
                  value={composeDraft.body}
                  onChange={handleComposeFieldChange("body")}
                  placeholder="Type your message..."
                  rows={10}
                  className="w-full resize-none border-0 bg-transparent px-3 py-3 text-sm text-slate-700 placeholder:text-slate-400 focus:outline-none focus:ring-0"
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
                    onClick={handleDiscardDraft}
                    className="rounded-full border border-slate-200 px-4 py-2 text-xs font-medium text-rose-600 hover:border-rose-400 hover:bg-rose-50"
                  >
                    Discard
                  </button>
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
            <button
              onClick={() => handleContextMenuAction("pin")}
              className="flex w-full items-center gap-2 px-3 py-2 text-sm text-slate-700 hover:bg-slate-100"
            >
              <MapPin size={14} className={email.isPinned ? "text-[#0b65d7]" : "text-slate-500"} />
              {email.isPinned ? "Unpin" : "Pin to top"}
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
