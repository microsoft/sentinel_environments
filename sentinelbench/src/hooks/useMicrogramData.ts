import { useCallback, useEffect, useRef, useState, useMemo } from "react";

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
  duration: number;
  selfUser?: any;
}

export function useMicrogramData() {
  const [posts, setPosts] = useState<ApiGramPost[]>([]);
  const [stories, setStories] = useState<ApiGramStory[]>([]);
  const [messages, setMessages] = useState<ApiGramMessage[]>([]);
  const [activity, setActivity] = useState<ApiGramActivity[]>([]);
  const [followedUserIds, setFollowedUserIds] = useState<string[]>([]);
  const [config, setConfig] = useState<ApiTaskConfig | null>(null);
  const [users, setUsers] = useState<Record<string, any>>({});
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Local optimistic overrides for likes/saves
  const [likeOverrides, setLikeOverrides] = useState<Map<string, boolean>>(new Map());
  const [saveOverrides, setSaveOverrides] = useState<Map<string, boolean>>(new Map());

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
          const userMap: Record<string, any> = {};
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
        setMessages(messagesData.messages ?? []);
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
    await fetch(`/api/data/microgram-users/${userId}/follow`, {
      method: "POST",
    }).catch(() => {});
  }, []);

  const performAction = useCallback(async (action: string) => {
    const res = await fetch(`/api/data/actions/${action}`, {
      method: "POST",
    }).catch(() => null);
    if (!res) return { success: false };
    // Clear optimistic overrides after bulk action
    setLikeOverrides(new Map());
    setSaveOverrides(new Map());
    return res.json();
  }, []);

  return {
    posts: postsWithOverrides,
    stories,
    messages,
    activity,
    followedUserIds,
    users,
    config,
    isLoading,
    error,
    likePost,
    savePost,
    commentOnPost,
    viewStory,
    followUser,
    performAction,
  };
}
