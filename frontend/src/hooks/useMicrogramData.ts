import { useCallback, useEffect, useRef, useState, useMemo } from "react";
import type { ApiSelfUser } from "../types/selfUser";

// ---------------------------------------------------------------------------
// API response types
// ---------------------------------------------------------------------------

export interface ApiGramPost {
  id: string;
  authorId: string;
  authorName?: string;
  authorAvatarUrl?: string;
  imageUrl: string;
  caption: string;
  location: string;
  likes: number;
  comments: { id: string; authorId: string; authorName?: string; authorAvatarUrl?: string; text: string; likes?: number }[];
  isTargetPost: boolean;
  taskType: string | null;
  order: number;
  isLiked: boolean;
  isSaved: boolean;
}

export interface ApiGramStory {
  id: string;
  authorId: string;
  authorName?: string;
  authorAvatarUrl?: string;
  mediaUrl: string;
  mediaType: string;
  order: number;
  isViewed: boolean;
}

export interface ApiGramMessage {
  id: string;
  participantIds: string[];
  participants?: { id: string; name: string; avatarUrl: string }[];
  lastMessage: string;
  unreadCount: number;
  messages: { id: string; senderId: string; senderName?: string; text: string; isRead?: boolean; order: number }[];
  order: number;
}

export interface ApiGramActivity {
  id: string;
  type: string;
  actorId: string;
  actorName?: string;
  actorAvatarUrl?: string;
  targetPostId: string | null;
  text: string | null;
  order: number;
}

export interface ApiTaskConfig {
  environment: string;
  event_timeline_end: number;
  selfUser?: ApiSelfUser;
}

export interface ApiGramUser {
  id: string;
  isSelf?: boolean;
  name: string;
  username: string;
  email?: string;
  avatarUrl: string;
  bio?: string;
  jobTitle?: string;
  location?: string;
  interests?: string[];
  microgram?: {
    followers?: number;
    following?: number;
    postsCount?: number;
    isVerified?: boolean;
    isPrivate?: boolean;
    website?: string;
    hasStory?: boolean;
    storyId?: string;
  };
}

export function useMicrogramData() {
  const [posts, setPosts] = useState<ApiGramPost[]>([]);
  const [stories, setStories] = useState<ApiGramStory[]>([]);
  const [rawMessages, setRawMessages] = useState<ApiGramMessage[]>([]);
  const [activity, setActivity] = useState<ApiGramActivity[]>([]);
  const [followedUserIds, setFollowedUserIds] = useState<string[]>([]);
  const [config, setConfig] = useState<ApiTaskConfig | null>(null);
  const [users, setUsers] = useState<Record<string, ApiGramUser>>({});
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Local optimistic overrides for likes/saves
  const [likeOverrides, setLikeOverrides] = useState<Map<string, boolean>>(new Map());
  const [saveOverrides, setSaveOverrides] = useState<Map<string, boolean>>(new Map());
  const [messageReadOverrides, setMessageReadOverrides] = useState<Map<string, boolean>>(new Map());
  const [followOverrides, setFollowOverrides] = useState<Map<string, boolean>>(new Map());

  const configLoaded = useRef(false);
  const usersLoaded = useRef(false);
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
          if (data.environment !== "microgram") {
            mismatch.current = true;
            setError(
              `Environment mismatch: server is running "${data.environment}" but this is the MicroGram UI.`
            );
            setIsLoading(false);
            return;
          }
          configLoaded.current = true;
          setConfig(data);
        })
        .catch(() => {});
    }

    // Fetch social users once
    if (!usersLoaded.current) {
      fetch("/api/data/microgram-users")
        .then((r) => {
          if (!r.ok) throw new Error(`Users fetch failed: ${r.status}`);
          return r.json();
        })
        .then((data) => {
          usersLoaded.current = true;
          const userMap: Record<string, ApiGramUser> = {};
          for (const u of data.users ?? []) {
            userMap[u.id] = u;
          }
          setUsers(userMap);
        })
        .catch(() => {});
    }

    // Poll dynamic data
    Promise.all([
      fetch("/api/data/microgram-posts").then((r) => {
        if (!r.ok) throw new Error(`Posts fetch failed: ${r.status}`);
        return r.json();
      }),
      fetch("/api/data/microgram-stories").then((r) => {
        if (!r.ok) throw new Error(`Stories fetch failed: ${r.status}`);
        return r.json();
      }),
      fetch("/api/data/microgram-messages").then((r) => {
        if (!r.ok) throw new Error(`Messages fetch failed: ${r.status}`);
        return r.json();
      }),
      fetch("/api/data/microgram-activity").then((r) => {
        if (!r.ok) throw new Error(`Activity fetch failed: ${r.status}`);
        return r.json();
      }),
      fetch("/api/data/microgram-followed-users").then((r) => {
        if (!r.ok) throw new Error(`Followed users fetch failed: ${r.status}`);
        return r.json();
      }),
    ])
      .then(([postsData, storiesData, messagesData, activityData, followedData]) => {
        setPosts(postsData.posts ?? []);
        setStories(storiesData.stories ?? []);
        setRawMessages(messagesData.messages ?? []);
        setActivity(activityData.activity ?? []);
        setFollowedUserIds(followedData.followed_users ?? []);
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
  const postsWithOverrides = useMemo<ApiGramPost[]>(() => {
    return posts.map((p) => {
      const isLiked = likeOverrides.has(p.id)
        ? (likeOverrides.get(p.id) as boolean)
        : p.isLiked;
      const isSaved = saveOverrides.has(p.id)
        ? (saveOverrides.get(p.id) as boolean)
        : p.isSaved;
      return { ...p, isLiked, isSaved };
    });
  }, [posts, likeOverrides, saveOverrides]);

  const followedUserIdsWithOverrides = useMemo<string[]>(() => {
    const set = new Set(followedUserIds);
    followOverrides.forEach((isFollowed, userId) => {
      if (isFollowed) set.add(userId);
      else set.delete(userId);
    });
    return Array.from(set);
  }, [followedUserIds, followOverrides]);

  const messages = useMemo<ApiGramMessage[]>(() => {
    return rawMessages.map((conversation) => {
      let unreadCount = 0;
      const mergedMessages = conversation.messages.map((message) => {
        const isRead = messageReadOverrides.has(message.id)
          ? (messageReadOverrides.get(message.id) as boolean)
          : Boolean(message.isRead);
        if (!isRead) {
          unreadCount += 1;
        }
        return { ...message, isRead };
      });

      return {
        ...conversation,
        messages: mergedMessages,
        unreadCount,
      };
    });
  }, [rawMessages, messageReadOverrides]);

  // Mutation helpers
  const likePost = useCallback(
    async (postId: string) => {
      const current =
        likeOverrides.get(postId) ??
        posts.find((p) => p.id === postId)?.isLiked ??
        false;
      setLikeOverrides((prev) => new Map(prev).set(postId, !current));
      await fetch(`/api/data/microgram-posts/${postId}/like`, { method: "POST" }).catch(
        () => {}
      );
    },
    [posts, likeOverrides]
  );

  const savePost = useCallback(
    async (postId: string) => {
      const current =
        saveOverrides.get(postId) ??
        posts.find((p) => p.id === postId)?.isSaved ??
        false;
      setSaveOverrides((prev) => new Map(prev).set(postId, !current));
      await fetch(`/api/data/microgram-posts/${postId}/save`, { method: "POST" }).catch(
        () => {}
      );
    },
    [posts, saveOverrides]
  );

  const commentOnPost = useCallback(async (postId: string, text: string) => {
    await fetch(`/api/data/microgram-posts/${postId}/comment`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ text }),
    }).catch(() => {});
  }, []);

  const viewStory = useCallback(async (storyId: string) => {
    await fetch(`/api/data/microgram-stories/${storyId}/view`, {
      method: "POST",
    }).catch(() => {});
  }, []);

  const followUser = useCallback(async (userId: string) => {
    const currentlyFollowed = followOverrides.has(userId)
      ? (followOverrides.get(userId) as boolean)
      : followedUserIds.includes(userId);
    setFollowOverrides((prev) => new Map(prev).set(userId, !currentlyFollowed));
    await fetch(`/api/data/microgram-users/${userId}/follow`, {
      method: "POST",
    }).catch(() => {});
  }, [followOverrides, followedUserIds]);

  const readConversation = useCallback(async (conversationId: string) => {
    const conversation = rawMessages.find((item) => item.id === conversationId);
    if (!conversation) return;

    const unreadMessageIds = conversation.messages
      .filter((message) => {
        const isRead = messageReadOverrides.has(message.id)
          ? (messageReadOverrides.get(message.id) as boolean)
          : Boolean(message.isRead);
        return !isRead;
      })
      .map((message) => message.id);

    if (unreadMessageIds.length > 0) {
      setMessageReadOverrides((prev) => {
        const next = new Map(prev);
        unreadMessageIds.forEach((messageId) => next.set(messageId, true));
        return next;
      });
    }

    await fetch(`/api/data/microgram-conversations/${conversationId}/read`, {
      method: "POST",
    }).catch(() => {});
  }, [rawMessages, messageReadOverrides]);

  return {
    posts: postsWithOverrides,
    stories,
    messages,
    activity,
    followedUserIds: followedUserIdsWithOverrides,
    users,
    config,
    isLoading,
    error,
    likePost,
    savePost,
    commentOnPost,
    viewStory,
    followUser,
    readConversation,
  };
}
