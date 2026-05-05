import { useCallback, useEffect, useRef, useState, useMemo } from "react";
import type { ApiSelfUser } from "../types/selfUser";

// ---------------------------------------------------------------------------
// API response types
// ---------------------------------------------------------------------------

export interface ApiTubeVideo {
  id: string;
  channel_id: string;
  title: string;
  description: string;
  views: number;
  likes: number;
  dislikes: number;
  comments: number;
  duration: string;
  thumbnailColor: string;
  thumbnailSrc: string;
  videoSrc: string;
  publishedAt: string;
  isLive: boolean;
  isShort: boolean;
  channelName: string;
  channelHandle: string;
  channelAvatarColor: string;
  channelAvatarSrc: string;
  channelIsVerified: boolean;
  channelSubscribers: number;
  category: string;
  task: string;
  order: number;
  // State
  isLiked: boolean;
  isDisliked: boolean;
  isSaved: boolean;
  isWatched: boolean;
}

export interface ApiTubeChannel {
  id: string;
  name: string;
  handle: string;
  subscribers: number;
  videos: number;
  description: string;
  avatarColor: string;
  avatarSrc: string;
  bannerSrc: string;
  isVerified: boolean;
  isSelf: boolean;
  // State
  isSubscribed: boolean;
}

export interface ApiTubeComment {
  id: string;
  video_id: string;
  user_id: string;
  content: string;
  likes: number;
  replies: number;
  userName: string;
  userAvatar: string;
}

export interface ApiTubeNotification {
  id: string;
  type: string;
  channel_id: string;
  video_id: string;
  message: string;
  isRead: boolean;
  channelName: string;
  channelAvatarSrc: string;
  isDismissed: boolean;
}

export interface ApiTubePlaylist {
  id: string;
  name: string;
  video_ids: string[];
}

export interface ApiTaskConfig {
  environment: string;
  event_timeline_end: number;
  selfUser?: ApiSelfUser;
}

export function useMicrotubeData() {
  const [rawVideos, setRawVideos] = useState<ApiTubeVideo[]>([]);
  const [channels, setChannels] = useState<ApiTubeChannel[]>([]);
  const [notifications, setNotifications] = useState<ApiTubeNotification[]>([]);
  const [playlists, setPlaylists] = useState<ApiTubePlaylist[]>([]);
  const [config, setConfig] = useState<ApiTaskConfig | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Optimistic overrides
  const [likeOverrides, setLikeOverrides] = useState<Map<string, boolean>>(new Map());
  const [dislikeOverrides, setDislikeOverrides] = useState<Map<string, boolean>>(new Map());
  const [saveOverrides, setSaveOverrides] = useState<Map<string, boolean>>(new Map());
  const [subscribeOverrides, setSubscribeOverrides] = useState<Map<string, boolean>>(new Map());

  const configLoaded = useRef(false);
  const mismatch = useRef(false);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

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
          if (data.environment !== "microtube") {
            mismatch.current = true;
            setError(
              `Environment mismatch: server is running "${data.environment}" but this is the MicroTube UI.`
            );
            setIsLoading(false);
            return;
          }
          configLoaded.current = true;
          setConfig(data);
        })
        .catch(() => {});
    }

    // Poll dynamic data
    Promise.all([
      fetch("/api/data/microtube-videos").then((r) => {
        if (!r.ok) throw new Error(`Videos fetch failed: ${r.status}`);
        return r.json();
      }),
      fetch("/api/data/microtube-channels").then((r) => {
        if (!r.ok) throw new Error(`Channels fetch failed: ${r.status}`);
        return r.json();
      }),
      fetch("/api/data/microtube-notifications").then((r) => {
        if (!r.ok) throw new Error(`Notifications fetch failed: ${r.status}`);
        return r.json();
      }),
      fetch("/api/data/microtube-playlists").then((r) => {
        if (!r.ok) throw new Error(`Playlists fetch failed: ${r.status}`);
        return r.json();
      }),
    ])
      .then(([videosData, channelsData, notifsData, playlistsData]) => {
        setRawVideos(videosData.videos ?? []);
        setChannels(channelsData.channels ?? []);
        setNotifications(notifsData.notifications ?? []);
        setPlaylists(playlistsData.playlists ?? []);
        setError(null);
        setIsLoading(false);
      })
      .catch((e) => {
        setError(String(e));
        setIsLoading(false);
      });
  }, []);

  useEffect(() => {
    fetchData();
    pollRef.current = setInterval(fetchData, 1000);
    return () => {
      if (pollRef.current) clearInterval(pollRef.current);
    };
  }, [fetchData]);

  // Apply optimistic overrides to videos
  const videos = useMemo<ApiTubeVideo[]>(() => {
    return rawVideos.map((v) => {
      const isLiked = likeOverrides.has(v.id)
        ? (likeOverrides.get(v.id) as boolean)
        : v.isLiked;
      const isDisliked = dislikeOverrides.has(v.id)
        ? (dislikeOverrides.get(v.id) as boolean)
        : v.isDisliked;
      const isSaved = saveOverrides.has(v.id)
        ? (saveOverrides.get(v.id) as boolean)
        : v.isSaved;
      return { ...v, isLiked, isDisliked, isSaved };
    });
  }, [rawVideos, likeOverrides, dislikeOverrides, saveOverrides]);

  // Apply subscribe overrides to channels (bump count optimistically)
  const channelsWithOverrides = useMemo<ApiTubeChannel[]>(() => {
    return channels.map((ch) => {
      if (!subscribeOverrides.has(ch.id)) return ch;
      const target = subscribeOverrides.get(ch.id) as boolean;
      if (target === ch.isSubscribed) return { ...ch, isSubscribed: target };
      const delta = target ? 1 : -1;
      return {
        ...ch,
        isSubscribed: target,
        subscribers: Math.max(0, ch.subscribers + delta),
      };
    });
  }, [channels, subscribeOverrides]);

  // Fetch comments on demand (not polled)
  const fetchComments = useCallback(async (videoId: string): Promise<ApiTubeComment[]> => {
    try {
      const r = await fetch(`/api/data/microtube-comments?video_id=${encodeURIComponent(videoId)}`);
      if (!r.ok) return [];
      const data = await r.json();
      return data.comments ?? [];
    } catch {
      return [];
    }
  }, []);

  // Mutations
  const likeVideo = useCallback(
    async (videoId: string) => {
      const current =
        likeOverrides.get(videoId) ??
        rawVideos.find((v) => v.id === videoId)?.isLiked ??
        false;
      setLikeOverrides((prev) => new Map(prev).set(videoId, !current));
      if (!current) {
        setDislikeOverrides((prev) => new Map(prev).set(videoId, false));
      }
      await fetch(`/api/data/microtube-videos/${videoId}/like`, { method: "POST" }).catch(() => {});
    },
    [rawVideos, likeOverrides]
  );

  const dislikeVideo = useCallback(
    async (videoId: string) => {
      const current =
        dislikeOverrides.get(videoId) ??
        rawVideos.find((v) => v.id === videoId)?.isDisliked ??
        false;
      setDislikeOverrides((prev) => new Map(prev).set(videoId, !current));
      if (!current) {
        setLikeOverrides((prev) => new Map(prev).set(videoId, false));
      }
      await fetch(`/api/data/microtube-videos/${videoId}/dislike`, { method: "POST" }).catch(() => {});
    },
    [rawVideos, dislikeOverrides]
  );

  const saveVideo = useCallback(
    async (videoId: string) => {
      const current =
        saveOverrides.get(videoId) ??
        rawVideos.find((v) => v.id === videoId)?.isSaved ??
        false;
      setSaveOverrides((prev) => new Map(prev).set(videoId, !current));
      await fetch(`/api/data/microtube-videos/${videoId}/save`, { method: "POST" }).catch(() => {});
    },
    [rawVideos, saveOverrides]
  );

  const watchVideo = useCallback(async (videoId: string) => {
    await fetch(`/api/data/microtube-videos/${videoId}/watch`, { method: "POST" }).catch(() => {});
  }, []);

  const subscribeChannel = useCallback(
    async (channelId: string) => {
      const current =
        subscribeOverrides.get(channelId) ??
        channels.find((ch) => ch.id === channelId)?.isSubscribed ??
        false;
      setSubscribeOverrides((prev) => new Map(prev).set(channelId, !current));
      await fetch(`/api/data/microtube-channels/${channelId}/subscribe`, {
        method: "POST",
      }).catch(() => {});
    },
    [channels, subscribeOverrides]
  );

  const postComment = useCallback(async (videoId: string, content: string) => {
    const res = await fetch("/api/data/microtube-comments", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ video_id: videoId, content }),
    }).catch(() => null);
    if (!res) return null;
    const data = await res.json();
    return data.comment ?? null;
  }, []);

  const dismissNotification = useCallback(async (notifId: string) => {
    await fetch(`/api/data/microtube-notifications/${notifId}/dismiss`, {
      method: "POST",
    }).catch(() => {});
  }, []);

  const markNotificationRead = useCallback(async (notifId: string) => {
    await fetch(`/api/data/microtube-notifications/${notifId}/read`, {
      method: "POST",
    }).catch(() => {});
  }, []);

  const createPlaylist = useCallback(async (name: string) => {
    const res = await fetch("/api/data/microtube-playlists", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name }),
    }).catch(() => null);
    if (!res) return null;
    const data = await res.json();
    const playlist = data.playlist ?? null;
    if (playlist) {
      setPlaylists((prev) =>
        prev.some((p) => p.id === playlist.id) ? prev : [...prev, playlist]
      );
    }
    return playlist;
  }, []);

  const addToPlaylist = useCallback(async (playlistId: string, videoId: string) => {
    setPlaylists((prev) =>
      prev.map((p) =>
        p.id === playlistId && !p.video_ids.includes(videoId)
          ? { ...p, video_ids: [...p.video_ids, videoId] }
          : p
      )
    );
    await fetch(`/api/data/microtube-playlists/${playlistId}/add`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ video_id: videoId }),
    }).catch(() => {});
  }, []);

  return {
    videos,
    channels: channelsWithOverrides,
    notifications,
    playlists,
    config,
    isLoading,
    error,
    fetchComments,
    likeVideo,
    dislikeVideo,
    saveVideo,
    watchVideo,
    subscribeChannel,
    postComment,
    dismissNotification,
    markNotificationRead,
    createPlaylist,
    addToPlaylist,
  };
}
