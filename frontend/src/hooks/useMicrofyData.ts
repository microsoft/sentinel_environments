import { useCallback, useEffect, useRef, useState, useMemo } from "react";
import type { ApiSelfUser } from "../types/selfUser";

// ---------------------------------------------------------------------------
// API response types
// ---------------------------------------------------------------------------

export interface ApiTrack {
  id: string;
  title: string;
  artistId: string;
  artistName: string;
  albumName: string;
  duration: string;
  durationSeconds: number;
  description: string;
  coverUrl: string;
  coverColor: string;
  coverInitials: string;
  genre: string;
  lyrics: string;
  playCount: number;
  isNewRelease: boolean;
  isLiked: boolean;
  userPlayCount: number;
  order: number;
}

export interface ApiPlaylist {
  id: string;
  name: string;
  description?: string;
  ownerId?: string;
  ownerName?: string;
  trackIds: string[];
  followerCount?: number;
  coverUrl?: string;
  coverColor?: string;
  coverInitials?: string;
  isPublic?: boolean;
  source?: "user";
  order?: number;
}

export interface ApiMood {
  id: string;
  name: string;
  description?: string;
  coverColor: string;
  order: number;
}

export interface ApiArtist {
  id: string;
  entityId: string;
  name: string;
  imageUrl: string;
  bannerUrl: string;
}

export interface ApiTaskConfig {
  environment: string;
  event_timeline_end: number;
  selfUser?: ApiSelfUser;
}

export function useMicrofyData() {
  const [tracks, setTracks] = useState<ApiTrack[]>([]);
  const [playlists, setPlaylists] = useState<ApiPlaylist[]>([]);
  const [moods, setMoods] = useState<ApiMood[]>([]);
  const [followedArtistIds, setFollowedArtistIds] = useState<string[]>([]);
  const [artists, setArtists] = useState<ApiArtist[]>([]);
  const [config, setConfig] = useState<ApiTaskConfig | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Local optimistic overrides for likes
  const [likeOverrides, setLikeOverrides] = useState<Map<string, boolean>>(new Map());

  const configLoaded = useRef(false);
  const moodsLoaded = useRef(false);
  const artistsLoaded = useRef(false);
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
          if (data.environment !== "microfy") {
            mismatch.current = true;
            setError(
              `Environment mismatch: server is running "${data.environment}" but this is the MicroFy UI.`
            );
            setIsLoading(false);
            return;
          }
          configLoaded.current = true;
          setConfig(data);
        })
        .catch(() => {});
    }

    // Fetch moods once
    if (!moodsLoaded.current) {
      fetch("/api/data/microfy-moods")
        .then((r) => {
          if (!r.ok) throw new Error(`Moods fetch failed: ${r.status}`);
          return r.json();
        })
        .then((data) => {
          moodsLoaded.current = true;
          setMoods(data.moods ?? []);
        })
        .catch(() => {});
    }

    // Fetch artists once
    if (!artistsLoaded.current) {
      fetch("/api/data/microfy-artists")
        .then((r) => {
          if (!r.ok) throw new Error(`Artists fetch failed: ${r.status}`);
          return r.json();
        })
        .then((data) => {
          artistsLoaded.current = true;
          setArtists(data.artists ?? []);
        })
        .catch(() => {});
    }

    // Poll dynamic data
    Promise.all([
      fetch("/api/data/microfy-tracks").then((r) => {
        if (!r.ok) throw new Error(`Tracks fetch failed: ${r.status}`);
        return r.json();
      }),
      fetch("/api/data/microfy-playlists").then((r) => {
        if (!r.ok) throw new Error(`Playlists fetch failed: ${r.status}`);
        return r.json();
      }),
      fetch("/api/data/microfy-followed-artists").then((r) => {
        if (!r.ok) throw new Error(`Followed artists fetch failed: ${r.status}`);
        return r.json();
      }),
    ])
      .then(([tracksData, playlistsData, followedData]) => {
        setTracks(tracksData.tracks ?? []);
        setPlaylists(playlistsData.playlists ?? []);
        setFollowedArtistIds(followedData.followed_artists ?? []);
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
  const tracksWithOverrides = useMemo<ApiTrack[]>(() => {
    return tracks.map((t) => {
      const isLiked = likeOverrides.has(t.id)
        ? (likeOverrides.get(t.id) as boolean)
        : t.isLiked;
      return { ...t, isLiked };
    });
  }, [tracks, likeOverrides]);

  // Mutation helpers
  const likeTrack = useCallback(
    async (trackId: string) => {
      const current =
        likeOverrides.get(trackId) ??
        tracks.find((t) => t.id === trackId)?.isLiked ??
        false;
      setLikeOverrides((prev) => new Map(prev).set(trackId, !current));
      await fetch(`/api/data/microfy-tracks/${trackId}/like`, { method: "POST" }).catch(
        () => {}
      );
    },
    [tracks, likeOverrides]
  );

  const playTrack = useCallback(async (trackId: string) => {
    await fetch(`/api/data/microfy-tracks/${trackId}/play`, { method: "POST" }).catch(
      () => {}
    );
  }, []);

  const followArtist = useCallback(async (artistId: string) => {
    await fetch(`/api/data/microfy-artists/${artistId}/follow`, {
      method: "POST",
    }).catch(() => {});
  }, []);

  const createPlaylist = useCallback(
    async (name: string, description: string = "") => {
      const res = await fetch("/api/data/microfy-playlists", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, description }),
      }).catch(() => null);
      if (!res) return null;
      return res.json();
    },
    []
  );

  const addToPlaylist = useCallback(
    async (playlistId: string, trackId: string) => {
      await fetch(`/api/data/microfy-playlists/${playlistId}/add`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ track_id: trackId }),
      }).catch(() => {});
    },
    []
  );

  return {
    tracks: tracksWithOverrides,
    playlists,
    moods,
    followedArtistIds,
    artists,
    config,
    isLoading,
    error,
    likeTrack,
    playTrack,
    followArtist,
    createPlaylist,
    addToPlaylist,
  };
}
