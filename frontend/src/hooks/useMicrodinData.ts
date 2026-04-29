import { useCallback, useEffect, useRef, useState, useMemo } from "react";
import type { ApiSelfUser } from "../types/selfUser";

// ---------------------------------------------------------------------------
// API response types
// ---------------------------------------------------------------------------

export interface ApiPost {
  id: string;
  authorId: string;
  authorName: string;
  authorTitle: string;
  authorAvatarUrl: string;
  content: string;
  imageUrl?: string;
  likes: number;
  comments: { id: string; authorId: string; authorName?: string; authorAvatarUrl?: string; text: string; likes: number }[];
  shares: number;
  isLiked: boolean;
  timestamp: string;
  order: number;
}

export interface ApiConnection {
  id: string;
  userId: string;
  name: string;
  title: string;
  avatarUrl: string;
  mutualConnections: number;
  status: "pending" | "accepted" | "ignored";
  order: number;
}

export interface ApiDinMessage {
  id: string;
  conversationId: string;
  senderId: string;
  senderName: string;
  content: string;
  isRead: boolean;
  timestamp: string;
  order: number;
}

export interface ApiDinConversation {
  id: string;
  participantIds: string[];
  participants?: { id: string; name: string; avatarUrl: string }[];
  unreadCount: number;
  lastMessage: string;
  messages: ApiDinMessage[];
  order: number;
}

export interface ApiNotification {
  id: string;
  type: string;
  actorId: string;
  actorName: string;
  actorAvatarUrl: string;
  content: string;
  targetPostId?: string;
  isRead: boolean;
  timestamp: string;
  order: number;
}

export interface ApiJob {
  id: string;
  title: string;
  companyId: string;
  location: string;
  type: string;
  description: string;
  requirements: string[];
  applicants: number;
  isApplied: boolean;
  order: number;
}

export interface ApiDinCompany {
  id: string;
  entityId: string;
  name: string;
  initials: string;
  description: string;
  avatarUrl: string;
  bannerUrl: string;
  industry: string;
  size: string;
  location: string;
  employees: number;
  followers: number;
}

export interface ApiTaskConfig {
  environment: string;
  event_timeline_end: number;
  selfUser?: ApiSelfUser;
}

export interface ApiDinUser {
  id: string;
  isSelf?: boolean;
  name: string;
  username?: string;
  email?: string;
  avatarUrl: string;
  bannerUrl?: string;
  bio?: string;
  jobTitle?: string;
  location?: string;
  interests?: string[];
  microdin?: { company?: string };
  microscholar?: { title?: string; affiliation?: string };
}

export interface ApiDinProfileStats {
  profileViewCount: number;
  pageVisitorCount: number;
  connectionsCount: number;
  initialConnectionIds: string[];
}

export interface ApiDinProfileSection {
  id: string;
  type: string;
  title: string;
  subtitle: string;
  content: string;
  timestamp: string;
}

export function useMicrodinData() {
  const [posts, setPosts] = useState<ApiPost[]>([]);
  const [connections, setConnections] = useState<ApiConnection[]>([]);
  const [conversations, setConversations] = useState<ApiDinConversation[]>([]);
  const [notifications, setNotifications] = useState<ApiNotification[]>([]);
  const [jobs, setJobs] = useState<ApiJob[]>([]);
  const [users, setUsers] = useState<ApiDinUser[]>([]);
  const [companies, setCompanies] = useState<ApiDinCompany[]>([]);
  const [profileStats, setProfileStats] = useState<ApiDinProfileStats | null>(null);
  const [profileSections, setProfileSections] = useState<ApiDinProfileSection[]>([]);
  const [config, setConfig] = useState<ApiTaskConfig | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Local overrides for optimistic UI
  const [likeOverrides, setLikeOverrides] = useState<Map<string, boolean>>(new Map());
  const [readOverrides, setReadOverrides] = useState<Map<string, boolean>>(new Map());

  const configLoaded = useRef(false);
  const usersLoaded = useRef(false);
  const companiesLoaded = useRef(false);
  const mismatch = useRef(false);

  const fetchData = useCallback(() => {
    if (mismatch.current) return;

    // Retry config until loaded
    if (!configLoaded.current) {
      fetch("/api/data/config")
        .then((r) => {
          if (!r.ok) throw new Error(`Config fetch failed: ${r.status}`);
          return r.json();
        })
        .then((data: ApiTaskConfig) => {
          if (data.environment !== "microdin") {
            mismatch.current = true;
            setError(
              `Environment mismatch: server is running "${data.environment}" but this is the MicroDin UI.`
            );
            setIsLoading(false);
            return;
          }
          configLoaded.current = true;
          setConfig(data);
        })
        .catch(() => {}); // Will retry on next poll
    }

    // Fetch network users once
    if (!usersLoaded.current) {
      fetch("/api/data/microdin-network")
        .then((r) => {
          if (!r.ok) throw new Error(`Network fetch failed: ${r.status}`);
          return r.json();
        })
        .then((data) => {
          usersLoaded.current = true;
          setUsers(data.users ?? []);
        })
        .catch(() => {});
    }

    // Fetch companies once
    if (!companiesLoaded.current) {
      fetch("/api/data/microdin-companies")
        .then((r) => {
          if (!r.ok) throw new Error(`Companies fetch failed: ${r.status}`);
          return r.json();
        })
        .then((data) => {
          companiesLoaded.current = true;
          setCompanies(data.companies ?? []);
        })
        .catch(() => {});
    }

    // Always poll all dynamic data
    Promise.all([
      fetch("/api/data/microdin-posts").then((r) => {
        if (!r.ok) throw new Error(`Posts fetch failed: ${r.status}`);
        return r.json();
      }),
      fetch("/api/data/microdin-connections").then((r) => {
        if (!r.ok) throw new Error(`Connections fetch failed: ${r.status}`);
        return r.json();
      }),
      fetch("/api/data/microdin-conversations").then((r) => {
        if (!r.ok) throw new Error(`Conversations fetch failed: ${r.status}`);
        return r.json();
      }),
      fetch("/api/data/microdin-notifications").then((r) => {
        if (!r.ok) throw new Error(`Notifications fetch failed: ${r.status}`);
        return r.json();
      }),
      fetch("/api/data/microdin-jobs").then((r) => {
        if (!r.ok) throw new Error(`Jobs fetch failed: ${r.status}`);
        return r.json();
      }),
      fetch("/api/data/microdin-profile-stats").then((r) => {
        if (!r.ok) throw new Error(`Profile stats fetch failed: ${r.status}`);
        return r.json();
      }),
      fetch("/api/data/microdin-profile-sections").then((r) => {
        if (!r.ok) throw new Error(`Profile sections fetch failed: ${r.status}`);
        return r.json();
      }),
    ])
      .then(([postsData, connectionsData, conversationsData, notificationsData, jobsData, statsData, sectionsData]) => {
        setPosts(postsData.posts ?? []);
        setConnections(connectionsData.connections ?? []);
        setConversations(conversationsData.conversations ?? []);
        setNotifications(notificationsData.notifications ?? []);
        setJobs(jobsData.jobs ?? []);
        setProfileStats(statsData ?? null);
        setProfileSections(sectionsData?.sections ?? []);
        setError(null);
        setIsLoading(false);
      })
      .catch((e) => {
        setError(String(e));
        setIsLoading(false);
      });
  }, []);

  // Poll every second
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    fetchData();
    pollRef.current = setInterval(fetchData, 1000);
    return () => {
      if (pollRef.current) clearInterval(pollRef.current);
    };
  }, [fetchData]);

  // Apply local overrides
  const postsWithOverrides = useMemo<ApiPost[]>(() => {
    return posts.map((p) => {
      const isLiked = likeOverrides.has(p.id)
        ? (likeOverrides.get(p.id) as boolean)
        : p.isLiked;
      return { ...p, isLiked };
    });
  }, [posts, likeOverrides]);

  const notificationsWithOverrides = useMemo<ApiNotification[]>(() => {
    return notifications.map((n) => {
      const isRead = readOverrides.has(n.id)
        ? (readOverrides.get(n.id) as boolean)
        : n.isRead;
      return { ...n, isRead };
    });
  }, [notifications, readOverrides]);

  // Mutation helpers
  const likePost = useCallback(async (postId: string) => {
    const current = likeOverrides.get(postId) ?? posts.find((p) => p.id === postId)?.isLiked ?? false;
    setLikeOverrides((prev) => new Map(prev).set(postId, !current));
    await fetch(`/api/data/microdin-posts/${postId}/like`, { method: "POST" }).catch(() => {});
  }, [posts, likeOverrides]);

  const acceptConnection = useCallback(async (connectionId: string) => {
    await fetch(`/api/data/microdin-connections/${connectionId}/accept`, { method: "POST" }).catch(() => {});
  }, []);

  const ignoreConnection = useCallback(async (connectionId: string) => {
    await fetch(`/api/data/microdin-connections/${connectionId}/ignore`, { method: "POST" }).catch(() => {});
  }, []);

  const readConversation = useCallback(async (conversationId: string) => {
    await fetch(`/api/data/microdin-conversations/${conversationId}/read`, { method: "POST" }).catch(() => {});
  }, []);

  const sendMessage = useCallback(async (conversationId: string, content: string) => {
    await fetch(`/api/data/microdin-conversations/${conversationId}/messages`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ content }),
    }).catch(() => {});
  }, []);

  const addProfileSection = useCallback(async (section: { type: string; title: string; subtitle?: string; content?: string }) => {
    const optimistic: ApiDinProfileSection = {
      id: `optimistic-${Date.now()}`,
      type: section.type,
      title: section.title,
      subtitle: section.subtitle ?? "",
      content: section.content ?? "",
      timestamp: new Date().toISOString(),
    };
    setProfileSections((prev) => [...prev, optimistic]);
    try {
      const r = await fetch(`/api/data/microdin-profile-sections`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(section),
      });
      if (!r.ok) return;
      const data = await r.json();
      if (data?.section) {
        setProfileSections((prev) => prev.map((s) => (s.id === optimistic.id ? data.section : s)));
      }
    } catch {
      // leave optimistic in place; next poll will reconcile
    }
  }, []);

  const createConversation = useCallback(async (userId: string): Promise<string | null> => {
    try {
      const r = await fetch(`/api/data/microdin-conversations`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId }),
      });
      if (!r.ok) return null;
      const data = await r.json();
      return data.conversationId as string;
    } catch {
      return null;
    }
  }, []);

  const postComment = useCallback(async (postId: string, text: string) => {
    await fetch(`/api/data/microdin-posts/${postId}/comments`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ text }),
    }).catch(() => {});
  }, []);

  const markNotificationRead = useCallback(async (notificationId: string) => {
    setReadOverrides((prev) => new Map(prev).set(notificationId, true));
    await fetch(`/api/data/microdin-notifications/${notificationId}/read`, { method: "POST" }).catch(() => {});
  }, []);

  const applyJob = useCallback(async (jobId: string) => {
    await fetch(`/api/data/microdin-jobs/${jobId}/apply`, { method: "POST" }).catch(() => {});
  }, []);

  return {
    posts: postsWithOverrides,
    connections,
    conversations,
    notifications: notificationsWithOverrides,
    jobs,
    users,
    companies,
    profileStats,
    profileSections,
    config,
    isLoading,
    error,
    likePost,
    acceptConnection,
    ignoreConnection,
    readConversation,
    sendMessage,
    createConversation,
    postComment,
    markNotificationRead,
    applyJob,
    addProfileSection,
  };
}
