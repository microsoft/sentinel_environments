import { useState, useEffect, useRef, useCallback, useMemo } from "react";
import { useMicrofyData } from "../hooks/useMicrofyData";
import type { ApiTrack, ApiPlaylist } from "../hooks/useMicrofyData";
import { useHashRoute } from "../hooks/useHashRoute";

type ViewType = "home" | "artist" | "playlist";
const VIEWS: readonly ViewType[] = ["home", "artist", "playlist"] as const;
interface HistoryEntry { view: ViewType; id: string | null }
import {
  Monitor,
  Laptop,
  Smartphone,
  Music,
  Mic2,
  Sparkles,
} from "lucide-react";

export const TASK_ID_MICROFY = "microfy";

// ============================================================================
// TASK CONFIGURATION (from API)
// ============================================================================

// Generate placeholder images using data URIs with solid colors
const generatePlaceholderImage = (color: string, text: string) => {
  // Create a simple SVG placeholder
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="300" height="300">
    <rect width="300" height="300" fill="${color}"/>
    <text x="50%" y="50%" font-family="Arial" font-size="20" fill="white" text-anchor="middle" dominant-baseline="middle">${text}</text>
  </svg>`;
  return `data:image/svg+xml;base64,${btoa(svg)}`;
};

// ============================================================================
// INTERNAL COMPONENT INTERFACES
// ============================================================================

interface Song {
  id: string;
  title: string;
  artist: string;
  artistId: string;
  duration: string;
  description: string;
  coverUrl: string;
  tag: string;
  audioUrl: string;
  lyrics: string;
  isLiked: boolean;
}

interface Artist {
  id: string;
  name: string;
  imageUrl: string;
  bannerUrl: string;
}

interface Mood {
  id: string;
  name: string;
  imageUrl: string;
}

// ============================================================================
// TRANSFORM API DATA TO INTERNAL FORMATS
// ============================================================================

// Get tag based on track properties
const getTrackTag = (track: ApiTrack): string => {
  if (track.isNewRelease) return "NEW";
  if (track.playCount && track.playCount > 2000000) return "HITS";
  if (track.playCount && track.playCount > 500000) return "Top 10";
  return "";
};

// Transform API track to internal Song format
const apiTrackToSong = (track: ApiTrack): Song => ({
  id: track.id,
  title: track.title,
  artist: track.artistName,
  artistId: track.artistId,
  duration: track.duration,
  description: track.description || `A ${track.genre || 'music'} track`,
  coverUrl: `/${track.coverUrl}`,
  tag: getTrackTag(track),
  audioUrl: `/audio/microfy/${track.id}.mp3`,
  lyrics: track.lyrics || "",
  isLiked: track.isLiked,
});

// Artists derived from API inside component (see useMemo below)

const shuffle = <T,>(items: readonly T[]): T[] => {
  const copy = [...items];
  for (let i = copy.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
};

const formatTime = (seconds: number) => {
  if (!Number.isFinite(seconds) || seconds < 0) return "00:00";
  const minutes = Math.floor(seconds / 60);
  const remainingSeconds = Math.floor(seconds % 60);
  return `${minutes.toString().padStart(2, "0")}:${remainingSeconds.toString().padStart(2, "0")}`;
};

// Color palette for placeholders (moods still use placeholders until images are generated)
const moodColors = ['#ff6b9d', '#c44569', '#f8b500', '#ee5a6f', '#4bcffa', '#0fb9b1', '#ffa801', '#4d77ff'];

const MicroFy = () => {
  // ============================================================================
  // API DATA (always-API mode)
  // ============================================================================
  const {
    tracks: apiTracks,
    playlists: apiPlaylists,
    moods: apiMoods,
    followedArtistIds,
    artists: apiArtists,
    likeTrack: apiLikeTrack,
    playTrack: apiPlayTrack,
    followArtist: apiFollowArtist,
    createPlaylist: apiCreatePlaylist,
    addToPlaylist: apiAddToPlaylist,
    config,
    isLoading,
    error,
  } = useMicrofyData();


  // Lock screen state
  const [isSignedOut, setIsSignedOut] = useState(false);

  // Transform API tracks to internal Song format
  const songs = useMemo<Song[]>(
    () => apiTracks.map(apiTrackToSong),
    [apiTracks]
  );

  const artists = useMemo<Artist[]>(
    () => apiArtists.map((a) => ({
      id: a.id,
      name: a.name,
      imageUrl: `/${a.imageUrl}`,
      bannerUrl: `/${a.bannerUrl}`,
    })),
    [apiArtists]
  );

  const moods = useMemo<Mood[]>(
    () =>
      apiMoods.map((mood) => ({
        id: mood.id,
        name: mood.name,
        imageUrl: generatePlaceholderImage(mood.coverColor || moodColors[0], mood.name),
      })),
    [apiMoods]
  );

  const songOrderRef = useRef<Song[]>([]);
  const songOrderIdsRef = useRef<Set<string>>(new Set());
  const songOrder = useMemo<Song[]>(() => {
    const newSongs = songs.filter(s => !songOrderIdsRef.current.has(s.id));
    if (songOrderRef.current.length === 0) {
      songOrderRef.current = shuffle(songs);
    } else if (newSongs.length > 0) {
      songOrderRef.current = [...newSongs, ...songOrderRef.current];
    }
    songOrderIdsRef.current = new Set(songOrderRef.current.map(s => s.id));
    // Update song data (e.g. isLiked) while preserving order
    const songMap = new Map(songs.map(s => [s.id, s]));
    songOrderRef.current = songOrderRef.current
      .map(s => songMap.get(s.id) ?? s)
      .filter(s => songMap.has(s.id));
    return songOrderRef.current;
  }, [songs]);

  // Derive favoriteSongs from API track states
  const favoriteSongs = useMemo<string[]>(
    () => apiTracks.filter(t => t.isLiked).map(t => t.id),
    [apiTracks]
  );

  // API playlists (catalog + user-created)
  const catalogPlaylists = useMemo<ApiPlaylist[]>(
    () => apiPlaylists.filter(p => !p.source),
    [apiPlaylists]
  );
  const userPlaylists = useMemo<ApiPlaylist[]>(
    () => apiPlaylists.filter(p => p.source === "user"),
    [apiPlaylists]
  );

  const selfUser = config?.selfUser;

  // State management
  const [selectedSongId, setSelectedSongId] = useState<string | null>(null);
  const [recentlyPlayed, setRecentlyPlayed] = useState<string[]>([]);
  const [playbarVisible, setPlaybarVisible] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [lyricsExpanded, setLyricsExpanded] = useState(false);
  const [isLoggedIn, setIsLoggedIn] = useState(true);
  const [displayName, setDisplayName] = useState(selfUser?.name ?? "");
  const [, setIsMenuOpen] = useState(false);
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [audioDuration, setAudioDuration] = useState(0);
  const [pendingAutoplay, setPendingAutoplay] = useState(false);

  // Modal states
  const [showLoginModal, setShowLoginModal] = useState(false);
  const [showSignupModal, setShowSignupModal] = useState(false);
  const [showPremiumModal, setShowPremiumModal] = useState(false);
  const [showSupportModal, setShowSupportModal] = useState(false);
  const [showDownloadModal, setShowDownloadModal] = useState(false);
  const [showInstallModal, setShowInstallModal] = useState(false);
  const [showCreatePlaylistModal, setShowCreatePlaylistModal] = useState(false);
  const [showUserDropdown, setShowUserDropdown] = useState(false);
  const [showSettingsModal, setShowSettingsModal] = useState(false);
  const [showEditProfileModal, setShowEditProfileModal] = useState(false);
  const [showSongMenuModal, setShowSongMenuModal] = useState(false);
  const [selectedMenuSongId, setSelectedMenuSongId] = useState<string | null>(null);

  // Additional functionality states
  const [selectedMood, setSelectedMood] = useState<string | null>(null);
  const [email, setEmail] = useState(selfUser?.email ?? "");

  // URL-driven navigation. Refresh, browser Back/Forward, and shareable
  // links (#artist/{id}, #playlist/{id}) all flow through `route`.
  const [route, setRoute] = useHashRoute<ViewType>(VIEWS, "home");
  const currentView = route.view;
  const selectedArtistId = currentView === "artist" ? route.id : null;
  const selectedPlaylistId = currentView === "playlist" ? route.id : null;

  // In-app ‹/› chrome stack. Source of truth for the current view is `route`;
  // this stack only powers the disabled-state and target lookup of the chrome
  // back/forward buttons. Reset whenever the route changes from outside the
  // app (refresh, browser Back, shareable URL paste).
  const [navigationHistory, setNavigationHistory] = useState<HistoryEntry[]>(
    () => [{ view: route.view, id: route.id }]
  );
  const [historyIndex, setHistoryIndex] = useState(0);
  const internalNavRef = useRef(false);

  // Playback settings
  const [volume, setVolume] = useState(70);
  const [isShuffle, setIsShuffle] = useState(false);
  const [repeatMode, setRepeatMode] = useState<'off' | 'all' | 'one'>('off');
  const [showQueue, setShowQueue] = useState(false);
  const [showDeviceModal, setShowDeviceModal] = useState(false);
  const [queue, setQueue] = useState<string[]>([]);

  // Settings checkboxes
  const [settingCrossfade, setSettingCrossfade] = useState(false);
  const [settingGapless, setSettingGapless] = useState(true);
  const [settingAutoplay, setSettingAutoplay] = useState(true);
  const [settingPrivateSession, setSettingPrivateSession] = useState(false);
  const [settingListeningActivity, setSettingListeningActivity] = useState(true);

  const accountHandle = selfUser?.username ?? "";

  const ownedPlaylistsCount = useMemo(
    () => apiPlaylists.filter((playlist) => playlist.ownerId === selfUser?.id).length,
    [apiPlaylists, selfUser?.id]
  );

  const derivedTopGenres = useMemo(() => {
    const counts = new Map<string, number>();
    for (const track of apiTracks) {
      if (!track.isLiked) continue;
      counts.set(track.genre, (counts.get(track.genre) ?? 0) + 1);
    }
    return [...counts.entries()]
      .sort((a, b) => b[1] - a[1])
      .slice(0, 4)
      .map(([genre]) => genre);
  }, [apiTracks]);

  // Profile stats: prefer backend selfUser.microfy.* values; fall back to derived from live state
  const profileStats = useMemo(() => {
    const backend = selfUser?.microfy;
    return {
      isPremium: backend?.isPremium ?? false,
      followers: backend?.followers ?? 0,
      following: backend?.following ?? followedArtistIds.length,
      playlistCount: backend?.playlistCount ?? ownedPlaylistsCount,
      likedTracksCount: backend?.likedTracksCount ?? favoriteSongs.length,
      topGenres: backend?.topGenres && backend.topGenres.length > 0 ? backend.topGenres : derivedTopGenres,
      joinedDate: backend?.joinedDate ?? "",
    };
  }, [selfUser?.microfy, followedArtistIds.length, ownedPlaylistsCount, favoriteSongs.length, derivedTopGenres]);

  // Active device
  const [activeDevice, setActiveDevice] = useState<string>('this-computer');

  // Toast notifications
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const toastTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const showToast = useCallback((message: string) => {
    if (toastTimerRef.current) clearTimeout(toastTimerRef.current);
    setToastMessage(message);
    toastTimerRef.current = setTimeout(() => setToastMessage(null), 3000);
  }, []);

  // Audio element ref for actual playback
  const audioRef = useRef<HTMLAudioElement>(null);

  const trendingRef = useRef<HTMLDivElement>(null);
  const artistsRef = useRef<HTMLDivElement>(null);
  const moodsRef = useRef<HTMLDivElement>(null);

  const [arrowVisibility, setArrowVisibility] = useState({
    songs: { left: false, right: false },
    artists: { left: false, right: false },
    moods: { left: false, right: false },
  });

  const selectedSong = useMemo(
    () => (selectedSongId === null ? null : songOrder.find((song) => song.id === selectedSongId) ?? null),
    [selectedSongId, songOrder]
  );

  const filteredSongs = useMemo(() => {
    if (!searchQuery.trim()) return songOrder;
    const query = searchQuery.trim().toLowerCase();
    return songOrder.filter(
      (song) =>
        song.title.toLowerCase().includes(query) || song.artist.toLowerCase().includes(query)
    );
  }, [searchQuery, songOrder]);

  const recentSongs = useMemo(
    () =>
      recentlyPlayed
        .map((id) => songOrder.find((song) => song.id === id) ?? null)
        .filter((song): song is Song => Boolean(song)),
    [recentlyPlayed, songOrder]
  );

  const matchedArtists = useMemo(() => {
    if (!selectedSong) return artists.slice(0, 3);
    const songArtists = selectedSong.artist
      .split(",")
      .map((name) => name.trim().toLowerCase())
      .filter(Boolean);
    if (!songArtists.length) return artists.slice(0, 3);

    const matches = artists.filter((artist) =>
      songArtists.some(
        (songArtist) =>
          artist.name.toLowerCase().includes(songArtist) ||
          songArtist.includes(artist.name.toLowerCase())
      )
    );

    return matches.length ? matches : artists.slice(0, 3);
  }, [artists, selectedSong]);

  const selectedArtist = useMemo(
    () => (selectedArtistId === null ? null : artists.find((artist) => artist.id === selectedArtistId) ?? null),
    [selectedArtistId, artists]
  );

  const artistSongs = useMemo(() => {
    if (!selectedArtist) return [];
    return songs.filter((song) =>
      song.artist.toLowerCase().includes(selectedArtist.name.toLowerCase())
    );
  }, [selectedArtist, songs]);

  const updateArrowVisibility = useCallback(() => {
    const calculate = (el: HTMLDivElement | null) => {
      if (!el) return { left: false, right: false };
      const left = el.scrollLeft > 0;
      const right = el.scrollLeft + el.clientWidth < el.scrollWidth - 5;
      return { left, right };
    };

    setArrowVisibility({
      songs: calculate(trendingRef.current),
      artists: calculate(artistsRef.current),
      moods: calculate(moodsRef.current),
    });
  }, []);

  const addToRecentlyPlayed = useCallback((songId: string) => {
    setRecentlyPlayed((prev) => {
      const updated = [...prev, songId];
      if (updated.length > 15) return updated.slice(updated.length - 15);
      return updated;
    });
  }, []);

  const stopPlayback = useCallback(() => {
    setIsPlaying(false);
    setCurrentTime(0);
  }, []);

  const triggerSongChange = useCallback((songId: string, shouldAutoplay: boolean) => {
    setSelectedSongId(songId);
    setLyricsExpanded(false);
    setPendingAutoplay(shouldAutoplay);
    setIsPlaying(false);
    setCurrentTime(0);
  }, []);

  const handleSelectSong = useCallback(
    (song: Song, shouldPlay: boolean = false) => {
      if (shouldPlay) {
        triggerSongChange(song.id, true);
        addToRecentlyPlayed(song.id);
        // Record play in API
        apiPlayTrack(song.id);
      } else {
        // View song details without interrupting current playback
        setSelectedSongId(song.id);
        setLyricsExpanded(false);
      }
    },
    [addToRecentlyPlayed, triggerSongChange, apiPlayTrack]
  );

  const handleNext = useCallback(() => {
    if (!songOrder.length) return;
    const wasPlaying = isPlaying;
    const currentIndex = selectedSongId
      ? songOrder.findIndex((song) => song.id === selectedSongId)
      : -1;
    const nextIndex = currentIndex >= 0 ? (currentIndex + 1) % songOrder.length : 0;
    const nextSong = songOrder[nextIndex];
    triggerSongChange(nextSong.id, wasPlaying);
    addToRecentlyPlayed(nextSong.id);
  }, [addToRecentlyPlayed, isPlaying, selectedSongId, songOrder, triggerSongChange]);

  const handlePrevious = useCallback(() => {
    if (!songOrder.length || selectedSongId === null) return;
    const wasPlaying = isPlaying;
    const currentIndex = songOrder.findIndex((song) => song.id === selectedSongId);
    if (currentIndex === -1) return;
    const prevIndex = (currentIndex - 1 + songOrder.length) % songOrder.length;
    const prevSong = songOrder[prevIndex];
    triggerSongChange(prevSong.id, wasPlaying);
    addToRecentlyPlayed(prevSong.id);
  }, [addToRecentlyPlayed, isPlaying, selectedSongId, songOrder, triggerSongChange]);

  const handleTogglePlay = useCallback(() => {
    if (!selectedSongId) return;

    if (isPlaying) {
      setIsPlaying(false);
    } else {
      setIsPlaying(true);
      setPlaybarVisible(true);
    }
  }, [selectedSongId, isPlaying]);

  const handleSeek = useCallback((event: React.MouseEvent<HTMLDivElement>) => {
    if (!selectedSongId || audioDuration <= 0) return;
    const rect = event.currentTarget.getBoundingClientRect();
    const offsetX = event.clientX - rect.left;
    const ratio = Math.min(Math.max(offsetX / rect.width, 0), 1);
    const newTime = ratio * audioDuration;
    setCurrentTime(newTime);
    // Update actual audio element position
    if (audioRef.current) {
      audioRef.current.currentTime = newTime;
    }
  }, [selectedSongId, audioDuration]);

  const handleSearchChange = useCallback((event: React.ChangeEvent<HTMLInputElement>) => {
    setSearchQuery(event.target.value);
  }, []);

  // Navigation helpers — single entry point that updates both the URL
  // (so refresh/browser-Back/share work) and the in-app ‹/› chrome stack.
  const navigateTo = useCallback((view: ViewType, id: string | null = null) => {
    if (view !== "playlist") {
      setSelectedSongId(null);
    }
    internalNavRef.current = true;
    setRoute(view, id);
    setNavigationHistory(prev => {
      const truncated = prev.slice(0, historyIndex + 1);
      return [...truncated, { view, id }];
    });
    setHistoryIndex(prev => prev + 1);
  }, [setRoute, historyIndex]);

  const handleNavigateBack = useCallback(() => {
    if (historyIndex > 0) {
      const target = navigationHistory[historyIndex - 1];
      internalNavRef.current = true;
      setRoute(target.view, target.id);
      setHistoryIndex(historyIndex - 1);
      if (target.view !== "playlist") {
        setSelectedSongId(null);
      }
    }
  }, [historyIndex, navigationHistory, setRoute]);

  const handleNavigateForward = useCallback(() => {
    if (historyIndex < navigationHistory.length - 1) {
      const target = navigationHistory[historyIndex + 1];
      internalNavRef.current = true;
      setRoute(target.view, target.id);
      setHistoryIndex(historyIndex + 1);
      if (target.view !== "playlist") {
        setSelectedSongId(null);
      }
    }
  }, [historyIndex, navigationHistory, setRoute]);

  // External URL changes (refresh, browser Back/Forward, paste) rebase the
  // in-app stack at the new route. The internal ref short-circuits this for
  // navigations we initiated ourselves.
  useEffect(() => {
    if (internalNavRef.current) {
      internalNavRef.current = false;
      return;
    }
    setNavigationHistory([{ view: route.view, id: route.id }]);
    setHistoryIndex(0);
  }, [route.view, route.id]);

  const handleSelectPlaylist = useCallback((playlistId: string) => {
    navigateTo('playlist', playlistId);
  }, [navigateTo]);

  const handleToggleFollow = useCallback((artistId: string) => {
    apiFollowArtist(artistId);
  }, [apiFollowArtist]);


  const handleRemoveFromQueue = useCallback((index: number) => {
    setQueue(prev => prev.filter((_, i) => i !== index));
  }, []);

  const handleLogin = useCallback((username: string) => {
    setIsLoggedIn(true);
    setDisplayName(username);
    setShowLoginModal(false);
    setShowSignupModal(false);
    setIsMenuOpen(false);
  }, []);

  const handleToggleFavorite = useCallback((songId: string) => {
    apiLikeTrack(songId);
  }, [apiLikeTrack]);

  const handleCreatePlaylist = useCallback((name: string, description: string) => {
    apiCreatePlaylist(name, description);
  }, [apiCreatePlaylist]);

  const handleAddToPlaylist = useCallback((playlistId: string, songId: string) => {
    apiAddToPlaylist(playlistId, songId);
  }, [apiAddToPlaylist]);

  const handleSelectMood = useCallback((moodId: string) => {
    setSelectedMood(moodId);
  }, []);

  const handleUpdateProfile = useCallback((newName: string, newEmail: string) => {
    setDisplayName(newName);
    setEmail(newEmail);
  }, []);

  const handleHome = useCallback(() => {
    navigateTo("home", null);
    setLyricsExpanded(false);
    setPendingAutoplay(false);
    setPlaybarVisible(false);
    stopPlayback();
  }, [navigateTo, stopPlayback]);

  const handleSelectArtist = useCallback((artistId: string) => {
    navigateTo("artist", artistId);
    setLyricsExpanded(false);
    setPendingAutoplay(false);
    stopPlayback();
  }, [navigateTo, stopPlayback]);

  const scrollContainer = useCallback(
    (ref: React.RefObject<HTMLDivElement>, direction: "left" | "right") => {
      const element = ref.current;
      if (!element) return;
      const amount = direction === "left" ? -element.clientWidth : element.clientWidth;
      element.scrollBy({ left: amount, behavior: "smooth" });
      window.requestAnimationFrame(() => updateArrowVisibility());
    },
    [updateArrowVisibility]
  );

  // State is now managed server-side -- no local persistence needed

  // Audio management - Use actual audio element for playback
  useEffect(() => {
    const audio = audioRef.current;
    if (!selectedSong || !audio) {
      setIsPlaying(false);
      setCurrentTime(0);
      setAudioDuration(0);
      setPendingAutoplay(false);
      return;
    }

    // Set the audio source
    audio.src = selectedSong.audioUrl;
    audio.load();

    const handleLoadedMetadata = () => {
      setAudioDuration(audio.duration);
      setCurrentTime(0);
      if (pendingAutoplay) {
        audio.play().catch(() => {
          // Autoplay might be blocked by browser
          setIsPlaying(false);
        });
        setIsPlaying(true);
        setPlaybarVisible(true);
        setPendingAutoplay(false);
      }
    };

    const handleTimeUpdate = () => {
      setCurrentTime(audio.currentTime);
    };

    const handleEnded = () => {
      setIsPlaying(false);
      handleNext();
    };

    audio.addEventListener('loadedmetadata', handleLoadedMetadata);
    audio.addEventListener('timeupdate', handleTimeUpdate);
    audio.addEventListener('ended', handleEnded);

    return () => {
      audio.removeEventListener('loadedmetadata', handleLoadedMetadata);
      audio.removeEventListener('timeupdate', handleTimeUpdate);
      audio.removeEventListener('ended', handleEnded);
    };
  }, [pendingAutoplay, selectedSong, handleNext]);

  // Control audio playback based on isPlaying state
  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;

    if (isPlaying) {
      audio.play().catch(() => {
        setIsPlaying(false);
      });
    } else {
      audio.pause();
    }
  }, [isPlaying]);

  // Update audio volume
  useEffect(() => {
    const audio = audioRef.current;
    if (audio) {
      audio.volume = volume / 100;
    }
  }, [volume]);

  // Content generation is now handled server-side via events

  // Arrow visibility
  useEffect(() => {
    updateArrowVisibility();
  }, [filteredSongs.length, matchedArtists.length, moods.length, selectedSong, updateArrowVisibility]);

  useEffect(() => {
    const songContainer = trendingRef.current;
    const artistContainer = artistsRef.current;
    const moodContainer = moodsRef.current;
    const handleScroll = () => {
      updateArrowVisibility();
    };
    songContainer?.addEventListener("scroll", handleScroll);
    artistContainer?.addEventListener("scroll", handleScroll);
    moodContainer?.addEventListener("scroll", handleScroll);
    window.addEventListener("resize", handleScroll);

    return () => {
      songContainer?.removeEventListener("scroll", handleScroll);
      artistContainer?.removeEventListener("scroll", handleScroll);
      moodContainer?.removeEventListener("scroll", handleScroll);
      window.removeEventListener("resize", handleScroll);
    };
  }, [updateArrowVisibility]);

  const progressPercent = audioDuration > 0 ? Math.min((currentTime / audioDuration) * 100, 100) : 0;

  const renderSongCards = (songList: Song[]) => (
    <>
      {songList.map((song) => {
        const isCurrentSong = selectedSongId === song.id && isPlaying;
        return (
          <div
            key={song.id}
            className="flex-shrink-0 w-[180px] bg-[#181818] rounded-lg overflow-hidden cursor-pointer transition-all duration-300 hover:bg-[#282828] group p-3"
            onClick={() => handleSelectSong(song, false)}
          >
            <div className="relative mb-4">
              <img src={song.coverUrl} alt={song.title} className="w-full aspect-square object-cover rounded-md shadow-lg" />
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  handleSelectSong(song, true);
                }}
                className="absolute bottom-2 right-2 w-12 h-12 bg-[#1DB954] rounded-full flex items-center justify-center opacity-0 translate-y-2 group-hover:opacity-100 group-hover:translate-y-0 transition-all shadow-xl hover:scale-105 hover:bg-[#1ed760]"
              >
                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="24" height="24" fill="black">
                  <polygon points="6,4 20,12 6,20" />
                </svg>
              </button>
            </div>
            <h4 className={`font-bold text-base mb-1 truncate ${isCurrentSong ? 'text-[#1DB954]' : 'text-white'}`}>{song.title}</h4>
            <p className="text-[#b3b3b3] text-sm truncate">
              {song.artist}
            </p>
          </div>
        );
      })}
    </>
  );

  // ---------------------------------------------------------------------------
  // Loading Gate
  // ---------------------------------------------------------------------------
  if (!config || isLoading) {
    const isNetworkError = error && /failed to fetch|networkerror/i.test(error);
    const isNoSession = error && /409/.test(error);
    const isMismatch = error && /environment mismatch/i.test(error);
    return (
      <div className="flex items-center justify-center h-screen bg-black">
        <div className="text-center max-w-md px-6">
          <div className="text-4xl mb-3">🎧</div>
          <h1 className="text-xl font-semibold mb-6 text-white">MicroFy</h1>
          {!error ? (
            <>
              <div className="w-8 h-8 border-2 border-[#1DB954] border-t-transparent rounded-full animate-spin mx-auto mb-4" />
              <p className="text-sm text-gray-400">Connecting to MicroFy...</p>
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
              <p className="text-sm text-gray-400">Navigate to the correct environment from the desktop, or re-init with a MicroFy scenario.</p>
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
    <div className="microfy-root min-h-screen bg-black text-white font-sans">
      {/* Hidden audio element for actual playback */}
      <audio ref={audioRef} preload="metadata" />

      {/* Main Layout -- sidebar + main in a padded flex container */}
      <div className="flex gap-2 p-2" style={{ height: playbarVisible ? 'calc(100vh - 72px)' : '100vh' }}>
        {/* Sidebar */}
        <aside className="hidden md:flex flex-col gap-2 w-[280px] shrink-0">
          {/* Top panel: Home + Search */}
          <div className="bg-[#121212] rounded-lg px-5 py-4">
            <div className="flex flex-col gap-4">
              <div className="flex items-center gap-3 mb-2">
                <img src="desktop/microfy-icon.png" alt="MicroFy" className="w-8 h-8 object-contain" />
                <span className="text-white font-bold text-lg">MicroFy</span>
              </div>
              <button onClick={handleHome} className="flex items-center gap-5 text-[#b3b3b3] hover:text-white transition">
                <svg width="24" height="24" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M12 3L2 12h3v8h6v-6h2v6h6v-8h3L12 3z" />
                </svg>
                <span className="font-bold">Home</span>
              </button>
              <div className="flex items-center gap-3 bg-transparent">
                <svg width="24" height="24" viewBox="0 0 24 24" fill="#b3b3b3">
                  <path d="M15.5 14h-.79l-.28-.27A6.471 6.471 0 0016 9.5 6.5 6.5 0 109.5 16c1.61 0 3.09-.59 4.23-1.57l.27.28v.79l5 4.99L20.49 19l-4.99-5zm-6 0C7.01 14 5 11.99 5 9.5S7.01 5 9.5 5 14 7.01 14 9.5 11.99 14 9.5 14z" />
                </svg>
                <input
                  type="text"
                  placeholder="What do you want to play?"
                  className="bg-transparent outline-none flex-1 text-white text-sm placeholder-[#b3b3b3]"
                  value={searchQuery}
                  onChange={handleSearchChange}
                />
              </div>
            </div>
          </div>

          {/* Library panel */}
          <div className="bg-[#121212] rounded-lg flex-1 overflow-y-auto px-3 py-4">
            <div className="flex items-center justify-between mb-4 px-2">
              <h3 className="text-[#b3b3b3] text-sm font-bold uppercase tracking-wider">Your Library</h3>
              <button
                onClick={() => setShowCreatePlaylistModal(true)}
                className="text-[#b3b3b3] hover:text-white transition"
                title="Create playlist"
              >
                <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M19 13h-6v6h-2v-6H5v-2h6V5h2v6h6v2z" />
                </svg>
              </button>
            </div>

            {/* Liked Songs Section */}
            {favoriteSongs.length > 0 && (
              <div
                className={`flex items-center gap-3 p-2 hover:bg-[#282828] rounded transition cursor-pointer ${selectedPlaylistId === 'liked' ? 'bg-[#282828]' : ''}`}
                onClick={() => handleSelectPlaylist('liked')}
              >
                <div className="w-12 h-12 bg-gradient-to-br from-purple-700 to-blue-300 rounded flex items-center justify-center">
                  <svg className="w-6 h-6 text-white" fill="currentColor" viewBox="0 0 24 24">
                    <path d="M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z" />
                  </svg>
                </div>
                <div className="flex-1 min-w-0">
                  <h4 className="text-white text-sm font-semibold truncate">Liked Songs</h4>
                  <p className="text-[#b3b3b3] text-xs">Playlist • {favoriteSongs.length} songs</p>
                </div>
              </div>
            )}

            {/* Catalog Playlists (filtered by owner) */}
            {catalogPlaylists.filter(p => p.ownerId === selfUser?.id).length > 0 && (
              <div className="space-y-2">
                {catalogPlaylists.filter(p => p.ownerId === selfUser?.id).map((playlist) => (
                  <div
                    key={playlist.id}
                    className={`flex items-center gap-3 p-2 hover:bg-[#282828] rounded transition cursor-pointer ${selectedPlaylistId === `public-${playlist.id}` ? 'bg-[#282828]' : ''}`}
                    onClick={() => handleSelectPlaylist(`public-${playlist.id}`)}
                  >
                    <img
                      src={playlist.coverUrl ? `/${playlist.coverUrl}` : ''}
                      alt={playlist.name}
                      className="w-12 h-12 rounded object-cover"
                    />
                    <div className="flex-1 min-w-0">
                      <h4 className="text-white text-sm font-semibold truncate">{playlist.name}</h4>
                      <p className="text-[#b3b3b3] text-xs">Playlist • {playlist.trackIds.length} songs</p>
                    </div>
                  </div>
                ))}
              </div>
            )}

            {/* User-Created Playlists */}
            {userPlaylists.length > 0 && (
              <div className="space-y-2">
                {userPlaylists.map((playlist) => (
                  <div
                    key={playlist.id}
                    className={`flex items-center gap-3 p-2 hover:bg-[#282828] rounded transition cursor-pointer ${selectedPlaylistId === playlist.id ? 'bg-[#282828]' : ''}`}
                    onClick={() => handleSelectPlaylist(playlist.id)}
                  >
                    <div className="w-12 h-12 bg-gradient-to-br from-[#169c46] to-[#1DB954] rounded flex items-center justify-center">
                      <Music className="w-6 h-6 text-white" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <h4 className="text-white text-sm font-semibold truncate">{playlist.name}</h4>
                      <p className="text-[#b3b3b3] text-xs">Playlist • {playlist.trackIds.length} songs</p>
                    </div>
                  </div>
                ))}
              </div>
            )}

            {/* Empty state - only show if no playlists at all */}
            {userPlaylists.length === 0 && catalogPlaylists.length === 0 && (
              <div className="bg-[#242424] rounded-lg p-4">
                <h4 className="text-white font-semibold mb-2">Create your first playlist</h4>
                <p className="text-[#b3b3b3] text-sm mb-4">It's easy, we'll help you</p>
                <button
                  onClick={() => setShowCreatePlaylistModal(true)}
                  className="bg-white text-black px-4 py-2 rounded-full text-sm font-semibold hover:scale-105 transition"
                >
                  Create playlist
                </button>
              </div>
            )}

            {/* Recently Played */}
            {recentSongs.length > 0 && (
              <div className="bg-[#242424] rounded-lg p-4">
                <h3 className="text-white font-semibold mb-4">Recently Played</h3>
                <div className="flex flex-col gap-3 max-h-64 overflow-y-auto">
                  {recentSongs.map((song) => (
                    <div
                      key={song.id}
                      className="flex items-center gap-3 cursor-pointer hover:bg-[#3e3e3e] p-2 rounded transition"
                      onClick={() => handleSelectSong(song, false)}
                    >
                      <img src={song.coverUrl} alt={song.title} className="w-12 h-12 rounded" />
                      <div className="flex-1 min-w-0">
                        <h4 className="text-white text-sm font-semibold truncate">{song.title}</h4>
                        <p className="text-[#b3b3b3] text-xs truncate">{song.artist}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </aside>

        {/* Main area */}
        <main className="flex-1 bg-[#121212] rounded-lg overflow-y-auto">
          {/* Top bar -- back/forward, search (mobile), user avatar */}
          <div className="sticky top-0 z-10 flex items-center justify-between px-6 py-4 bg-[#121212]/95 backdrop-blur-sm">
            <div className="flex items-center gap-4">
              {/* Back/Forward Navigation */}
              <div className="hidden md:flex items-center gap-2">
                <button
                  onClick={handleNavigateBack}
                  disabled={historyIndex === 0}
                  className={`w-8 h-8 rounded-full flex items-center justify-center transition ${historyIndex === 0 ? 'bg-[#000000b3] text-[#535353] cursor-not-allowed' : 'bg-[#000000b3] text-white hover:bg-[#000000e6]'}`}
                  title="Go back"
                >
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
                    <path d="M15.41 7.41L14 6l-6 6 6 6 1.41-1.41L10.83 12z" />
                  </svg>
                </button>
                <button
                  onClick={handleNavigateForward}
                  disabled={historyIndex >= navigationHistory.length - 1}
                  className={`w-8 h-8 rounded-full flex items-center justify-center transition ${historyIndex >= navigationHistory.length - 1 ? 'bg-[#000000b3] text-[#535353] cursor-not-allowed' : 'bg-[#000000b3] text-white hover:bg-[#000000e6]'}`}
                  title="Go forward"
                >
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
                    <path d="M8.59 16.59L10 18l6-6-6-6-1.41 1.41L13.17 12z" />
                  </svg>
                </button>
              </div>
              {/* Mobile search */}
              <div className="md:hidden flex items-center gap-2 bg-[#242424] rounded-full px-4 py-2 flex-1 max-w-[300px]">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="#b3b3b3">
                  <path d="M15.5 14h-.79l-.28-.27A6.471 6.471 0 0016 9.5 6.5 6.5 0 109.5 16c1.61 0 3.09-.59 4.23-1.57l.27.28v.79l5 4.99L20.49 19l-4.99-5zm-6 0C7.01 14 5 11.99 5 9.5S7.01 5 9.5 5 14 7.01 14 9.5 11.99 14 9.5 14z" />
                </svg>
                <input
                  type="text"
                  placeholder="Search"
                  className="bg-transparent outline-none flex-1 text-white text-sm"
                  value={searchQuery}
                  onChange={handleSearchChange}
                />
              </div>
            </div>

            <div className="flex items-center gap-3">
              {!isLoggedIn ? (
                <>
                  <button
                    onClick={() => setShowSignupModal(true)}
                    className="text-[#b3b3b3] hover:text-white transition text-sm font-bold"
                  >
                    Sign up
                  </button>
                  <button
                    onClick={() => setShowLoginModal(true)}
                    className="bg-white text-black px-8 py-2 rounded-full font-bold text-sm hover:scale-105 transition"
                  >
                    Log in
                  </button>
                </>
              ) : (
                <div className="relative">
                  <button
                    className="w-8 h-8 rounded-full overflow-hidden hover:opacity-80 transition flex items-center justify-center"
                    onClick={() => setShowUserDropdown(!showUserDropdown)}
                    title={displayName}
                  >
                    {selfUser?.avatarUrl ? (
                      <img
                        src={selfUser.avatarUrl}
                        alt={displayName}
                        className="w-8 h-8 rounded-full object-cover"
                      />
                    ) : (
                      <div className="w-8 h-8 bg-[#535353] rounded-full flex items-center justify-center text-white text-sm font-bold">
                        {displayName.charAt(0).toUpperCase()}
                      </div>
                    )}
                  </button>
                  {showUserDropdown && (
                    <div className="absolute right-0 top-full mt-2 bg-[#282828] rounded shadow-lg py-1 z-50 w-52">
                      <div className="px-3 py-2 border-b border-[#3e3e3e]">
                        <div className="text-white font-semibold text-sm">{displayName}</div>
                        <div className="text-[#b3b3b3] text-xs">@{accountHandle}</div>
                      </div>
                      <button
                        onClick={() => { setShowEditProfileModal(true); setShowUserDropdown(false); }}
                        className="w-full px-3 py-2 text-left hover:bg-[#3e3e3e] transition text-sm text-[#b3b3b3] hover:text-white"
                      >
                        Profile
                      </button>
                      <button
                        onClick={() => { setShowSettingsModal(true); setShowUserDropdown(false); }}
                        className="w-full px-3 py-2 text-left hover:bg-[#3e3e3e] transition text-sm text-[#b3b3b3] hover:text-white"
                      >
                        Settings
                      </button>
                      <button
                        onClick={() => { setShowPremiumModal(true); setShowUserDropdown(false); }}
                        className="w-full px-3 py-2 text-left hover:bg-[#3e3e3e] transition text-sm text-[#b3b3b3] hover:text-white"
                      >
                        Upgrade to Premium
                      </button>
                      <button
                        onClick={() => { setShowSupportModal(true); setShowUserDropdown(false); }}
                        className="w-full px-3 py-2 text-left hover:bg-[#3e3e3e] transition text-sm text-[#b3b3b3] hover:text-white"
                      >
                        Support
                      </button>
                      <button
                        onClick={() => { setShowDownloadModal(true); setShowUserDropdown(false); }}
                        className="w-full px-3 py-2 text-left hover:bg-[#3e3e3e] transition text-sm text-[#b3b3b3] hover:text-white"
                      >
                        Download
                      </button>
                      <div className="border-t border-[#3e3e3e] my-1"></div>
                      <button
                        onClick={() => setIsSignedOut(true)}
                        className="w-full px-3 py-2 text-left hover:bg-[#3e3e3e] transition text-sm text-[#b3b3b3] hover:text-white"
                      >
                        Log out
                      </button>
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>

          <div className="px-6 pb-6">
          {/* Lock screen overlay */}
          {isSignedOut && (
            <div className="fixed inset-0 z-50 flex items-center justify-center" style={{ backgroundColor: "rgba(0,0,0,0.7)", backdropFilter: "blur(6px)" }}>
              <div className="rounded-lg shadow-2xl p-8 w-[360px] flex flex-col items-center" style={{ backgroundColor: "#282828" }}>
                <div className="text-2xl font-bold mb-6" style={{ color: "#1DB954" }}>MicroFy</div>
                {selfUser?.avatarUrl ? (
                  <img
                    src={selfUser.avatarUrl}
                    alt={selfUser?.name ?? "User"}
                    className="w-20 h-20 rounded-full object-cover mb-4"
                  />
                ) : (
                  <div className="w-20 h-20 rounded-full flex items-center justify-center text-white text-2xl font-bold mb-4" style={{ backgroundColor: "#1DB954" }}>
                    {selfUser?.name?.split(" ").map((n: string) => n[0]).join("") || "U"}
                  </div>
                )}
                <div className="text-lg font-semibold text-white mb-1">{selfUser?.name || "User"}</div>
                <div className="text-sm mb-6" style={{ color: "#b3b3b3" }}>{selfUser?.email || "user@microfy.com"}</div>
                <input type="password" readOnly value="••••••••" className="w-full px-4 py-2 rounded mb-4 text-center" style={{ backgroundColor: "#3E3E3E", color: "#b3b3b3", border: "none" }} />
                <button onClick={() => setIsSignedOut(false)} className="w-full py-2 text-black rounded-full font-semibold hover:opacity-90 transition-opacity" style={{ backgroundColor: "#1DB954" }}>
                  Sign in
                </button>
              </div>
            </div>
          )}

          {/* Playlist Detail View */}
          {selectedPlaylistId ? (
            <div className="min-h-[calc(100vh-12rem)]">
              {/* Playlist Header */}
              <div className="bg-gradient-to-b from-purple-900 to-[#121212] p-8 rounded-lg mb-8">
                <div className="flex items-end gap-6">
                  {selectedPlaylistId === 'liked' ? (
                    <div className="w-48 h-48 bg-gradient-to-br from-purple-700 to-blue-400 rounded-lg shadow-2xl flex items-center justify-center">
                      <svg className="w-20 h-20 text-white" fill="currentColor" viewBox="0 0 24 24">
                        <path d="M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z" />
                      </svg>
                    </div>
                  ) : selectedPlaylistId.startsWith('public-') ? (
                    <img
                      src={(() => { const pl = catalogPlaylists.find(p => `public-${p.id}` === selectedPlaylistId); return pl?.coverUrl ? `/${pl.coverUrl}` : ''; })()}
                      alt="Playlist cover"
                      className="w-48 h-48 rounded-lg shadow-2xl object-cover"
                    />
                  ) : (
                    <div className="w-48 h-48 bg-gradient-to-br from-[#169c46] to-[#1DB954] rounded-lg shadow-2xl flex items-center justify-center">
                      <Music className="w-20 h-20 text-white" />
                    </div>
                  )}
                  <div className="flex-1">
                    <span className="text-white text-xs uppercase font-bold">Playlist</span>
                    <h1 className="text-5xl md:text-7xl font-bold text-white mb-4">
                      {selectedPlaylistId === 'liked' ? 'Liked Songs' :
                       selectedPlaylistId.startsWith('public-') ?
                         catalogPlaylists.find(p => `public-${p.id}` === selectedPlaylistId)?.name || 'Playlist' :
                         userPlaylists.find(p => p.id === selectedPlaylistId)?.name || 'Playlist'}
                    </h1>
                    <p className="text-[#b3b3b3] text-sm">
                      <span className="font-semibold text-white">{displayName}</span> •{' '}
                      {selectedPlaylistId === 'liked' ? favoriteSongs.length :
                       selectedPlaylistId.startsWith('public-') ?
                         catalogPlaylists.find(p => `public-${p.id}` === selectedPlaylistId)?.trackIds.length || 0 :
                         userPlaylists.find(p => p.id === selectedPlaylistId)?.trackIds.length || 0} songs
                    </p>
                  </div>
                </div>
              </div>

              {/* Playlist Controls */}
              <div className="flex items-center gap-6 mb-8">
                <button
                  onClick={() => {
                    let firstSong: Song | undefined;
                    if (selectedPlaylistId === 'liked') {
                      if (favoriteSongs.length > 0) {
                        firstSong = songs.find(s => s.id === favoriteSongs[0]);
                      }
                    } else if (selectedPlaylistId.startsWith('user-playlist-')) {
                      const userPlaylist = userPlaylists.find(p => p.id === selectedPlaylistId);
                      if (userPlaylist && userPlaylist.trackIds.length > 0) {
                        firstSong = songs.find(s => s.id === userPlaylist.trackIds[0]);
                      }
                    } else if (selectedPlaylistId.startsWith('public-')) {
                      const publicPlaylist = catalogPlaylists.find(p => `public-${p.id}` === selectedPlaylistId);
                      if (publicPlaylist && publicPlaylist.trackIds.length > 0) {
                        firstSong = songs.find(s => s.id === publicPlaylist.trackIds[0]);
                      }
                    }
                    if (firstSong) handleSelectSong(firstSong, true);
                  }}
                  className="w-14 h-14 bg-[#1DB954] rounded-full flex items-center justify-center hover:scale-105 hover:bg-[#1ed760] transition shadow-lg"
                >
                  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="28" height="28" fill="black">
                    <polygon points="6,4 20,12 6,20" />
                  </svg>
                </button>
                <button
                  onClick={() => setIsShuffle(!isShuffle)}
                  className={`transition ${isShuffle ? 'text-[#1DB954]' : 'text-[#b3b3b3] hover:text-white'}`}
                  title={isShuffle ? 'Disable shuffle' : 'Enable shuffle'}
                >
                  <svg width="32" height="32" fill="currentColor" viewBox="0 0 24 24">
                    <path d="M10.59 9.17L5.41 4 4 5.41l5.17 5.17 1.42-1.41zM14.5 4l2.04 2.04L4 18.59 5.41 20 17.96 7.46 20 9.5V4h-5.5zm.33 9.41l-1.41 1.41 3.13 3.13L14.5 20H20v-5.5l-2.04 2.04-3.13-3.13z" />
                  </svg>
                </button>
              </div>

              {/* Track List */}
              <div className="bg-[#181818] rounded-lg">
                {/* Header */}
                <div className="grid grid-cols-[16px_4fr_2fr_1fr] gap-4 px-4 py-2 border-b border-[#282828] text-[#b3b3b3] text-xs uppercase">
                  <span>#</span>
                  <span>Title</span>
                  <span>Album</span>
                  <span className="text-right">Duration</span>
                </div>
                {/* Tracks */}
                <div>
                  {(() => {
                    // Get the appropriate songs based on playlist type
                    let playlistSongs: Song[] = [];
                    if (selectedPlaylistId === 'liked') {
                      playlistSongs = favoriteSongs
                        .map(songId => songs.find(s => s.id === songId))
                        .filter((s): s is Song => Boolean(s));
                    } else if (selectedPlaylistId.startsWith('user-playlist-')) {
                      const userPlaylist = userPlaylists.find(p => p.id === selectedPlaylistId);
                      playlistSongs = (userPlaylist?.trackIds || [])
                        .map(songId => songs.find(s => s.id === songId))
                        .filter((s): s is Song => Boolean(s));
                    } else if (selectedPlaylistId.startsWith('public-')) {
                      // For public playlists, use trackIds from catalog
                      const publicPlaylist = catalogPlaylists.find(p => `public-${p.id}` === selectedPlaylistId);
                      if (publicPlaylist) {
                        playlistSongs = publicPlaylist.trackIds
                          .map(trackId => songs.find(s => s.id === trackId))
                          .filter((s): s is Song => Boolean(s));
                      }
                    }
                    return playlistSongs;
                  })().map((song, index) => (
                    <div
                      key={song.id}
                      className="grid grid-cols-[16px_4fr_2fr_1fr] gap-4 px-4 py-2 hover:bg-[#282828] rounded cursor-pointer group"
                      onClick={() => handleSelectSong(song, true)}
                    >
                      <span className="text-[#b3b3b3] flex items-center">
                        <span className="group-hover:hidden">{index + 1}</span>
                        <svg className="hidden group-hover:block w-4 h-4" fill="white" viewBox="0 0 24 24">
                          <polygon points="6,4 20,12 6,20" />
                        </svg>
                      </span>
                      <div className="flex items-center gap-3 min-w-0">
                        <img src={song.coverUrl} alt={song.title} className="w-10 h-10 rounded" />
                        <div className="min-w-0">
                          <p className="text-white truncate">{song.title}</p>
                          <p className="text-[#b3b3b3] text-sm truncate">{song.artist}</p>
                        </div>
                      </div>
                      <span className="text-[#b3b3b3] flex items-center truncate">{song.title}</span>
                      <span className="text-[#b3b3b3] flex items-center justify-end">{song.id === selectedSongId && audioDuration > 0 ? formatTime(audioDuration) : song.duration}</span>
                    </div>
                  ))}
                  {(() => {
                    // Check if playlist is empty
                    if (selectedPlaylistId === 'liked') return favoriteSongs.length === 0;
                    if (selectedPlaylistId.startsWith('user-playlist-')) {
                      return (userPlaylists.find(p => p.id === selectedPlaylistId)?.trackIds.length || 0) === 0;
                    }
                    if (selectedPlaylistId.startsWith('public-')) {
                      const publicPlaylist = catalogPlaylists.find(p => `public-${p.id}` === selectedPlaylistId);
                      return !publicPlaylist || publicPlaylist.trackIds.length === 0;
                    }
                    return true;
                  })() && (
                    <div className="text-center py-12 text-[#b3b3b3]">
                      <Music className="w-16 h-16 mx-auto mb-4 opacity-50" />
                      <p>No songs in this playlist yet</p>
                      <p className="text-sm mt-2">Add songs by clicking the ••• menu on any track</p>
                    </div>
                  )}
                </div>
              </div>
            </div>
          ) : !selectedSong && !selectedArtist ? (
            <>
              {/* Trending Songs */}
              <section className="mb-12">
                <h2 className="text-white text-2xl font-bold mb-2">Trending Songs</h2>
                <div className="relative">
                  {arrowVisibility.songs.left && (
                    <button
                      onClick={() => scrollContainer(trendingRef, "left")}
                      className="absolute left-0 top-1/2 -translate-y-1/2 z-10 w-10 h-10 bg-black bg-opacity-80 rounded-full flex items-center justify-center hover:bg-opacity-100 transition"
                    >
                      <svg width="24" height="24" viewBox="0 0 24 24" fill="white">
                        <path d="M15.41 7.41L14 6l-6 6 6 6 1.41-1.41L10.83 12z" />
                      </svg>
                    </button>
                  )}
                  {arrowVisibility.songs.right && (
                    <button
                      onClick={() => scrollContainer(trendingRef, "right")}
                      className="absolute right-0 top-1/2 -translate-y-1/2 z-10 w-10 h-10 bg-black bg-opacity-80 rounded-full flex items-center justify-center hover:bg-opacity-100 transition"
                    >
                      <svg width="24" height="24" viewBox="0 0 24 24" fill="white">
                        <path d="M10 6L8.59 7.41 13.17 12l-4.58 4.59L10 18l6-6z" />
                      </svg>
                    </button>
                  )}
                  <div
                    ref={trendingRef}
                    className="flex gap-4 overflow-x-auto scrollbar-hide scroll-smooth"
                    style={{ scrollbarWidth: "none", msOverflowStyle: "none" }}
                  >
                    {renderSongCards(filteredSongs)}
                  </div>
                </div>
              </section>

              {/* Top Artists */}
              <section className="mb-12">
                <h2 className="text-white text-2xl font-bold mb-2 flex items-center gap-2"><Mic2 className="w-6 h-6" /> Top Artists</h2>
                <div className="relative">
                  {arrowVisibility.artists.left && (
                    <button
                      onClick={() => scrollContainer(artistsRef, "left")}
                      className="absolute left-0 top-1/2 -translate-y-1/2 z-10 w-10 h-10 bg-black bg-opacity-80 rounded-full flex items-center justify-center hover:bg-opacity-100 transition"
                    >
                      <svg width="24" height="24" viewBox="0 0 24 24" fill="white">
                        <path d="M15.41 7.41L14 6l-6 6 6 6 1.41-1.41L10.83 12z" />
                      </svg>
                    </button>
                  )}
                  {arrowVisibility.artists.right && (
                    <button
                      onClick={() => scrollContainer(artistsRef, "right")}
                      className="absolute right-0 top-1/2 -translate-y-1/2 z-10 w-10 h-10 bg-black bg-opacity-80 rounded-full flex items-center justify-center hover:bg-opacity-100 transition"
                    >
                      <svg width="24" height="24" viewBox="0 0 24 24" fill="white">
                        <path d="M10 6L8.59 7.41 13.17 12l-4.58 4.59L10 18l6-6z" />
                      </svg>
                    </button>
                  )}
                  <div
                    ref={artistsRef}
                    className="flex gap-4 overflow-x-auto scrollbar-hide scroll-smooth"
                    style={{ scrollbarWidth: "none", msOverflowStyle: "none" }}
                  >
                    {artists.map((artist) => (
                      <div
                        key={artist.id}
                        onClick={() => handleSelectArtist(artist.id)}
                        className="flex-shrink-0 w-[180px] bg-[#181818] rounded-lg overflow-hidden cursor-pointer transition-all duration-300 hover:bg-[#282828] group p-3"
                      >
                        <div className="relative mb-4">
                          <img src={artist.imageUrl} alt={artist.name} className="w-full aspect-square object-cover rounded-full shadow-lg" />
                          <div className="absolute bottom-2 right-2 w-12 h-12 bg-[#1DB954] rounded-full flex items-center justify-center opacity-0 translate-y-2 group-hover:opacity-100 group-hover:translate-y-0 transition-all shadow-xl hover:scale-105 hover:bg-[#1ed760]">
                            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="24" height="24" fill="black">
                              <polygon points="6,4 20,12 6,20" />
                            </svg>
                          </div>
                        </div>
                        <div className="text-center">
                          <h4 className="text-white font-bold text-base">{artist.name}</h4>
                          <p className="text-[#b3b3b3] text-sm">Artist</p>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </section>

              {/* Moods */}
              <section className="mb-12">
                <h2 className="text-white text-2xl font-bold mb-2 flex items-center gap-2"><Sparkles className="w-6 h-6" /> Pick a Mood, Play a Vibe</h2>
                <div className="relative">
                  {arrowVisibility.moods.left && (
                    <button
                      onClick={() => scrollContainer(moodsRef, "left")}
                      className="absolute left-0 top-1/2 -translate-y-1/2 z-10 w-10 h-10 bg-black bg-opacity-80 rounded-full flex items-center justify-center hover:bg-opacity-100 transition"
                    >
                      <svg width="24" height="24" viewBox="0 0 24 24" fill="white">
                        <path d="M15.41 7.41L14 6l-6 6 6 6 1.41-1.41L10.83 12z" />
                      </svg>
                    </button>
                  )}
                  {arrowVisibility.moods.right && (
                    <button
                      onClick={() => scrollContainer(moodsRef, "right")}
                      className="absolute right-0 top-1/2 -translate-y-1/2 z-10 w-10 h-10 bg-black bg-opacity-80 rounded-full flex items-center justify-center hover:bg-opacity-100 transition"
                    >
                      <svg width="24" height="24" viewBox="0 0 24 24" fill="white">
                        <path d="M10 6L8.59 7.41 13.17 12l-4.58 4.59L10 18l6-6z" />
                      </svg>
                    </button>
                  )}
                  <div
                    ref={moodsRef}
                    className="flex gap-4 overflow-x-auto scrollbar-hide scroll-smooth"
                    style={{ scrollbarWidth: "none", msOverflowStyle: "none" }}
                  >
                    {moods.map((mood) => (
                      <div
                        key={mood.id}
                        onClick={() => handleSelectMood(mood.id)}
                        className={`flex-shrink-0 w-[180px] rounded-lg cursor-pointer transition-all duration-300 hover:bg-[#282828] group p-3 ${
                          selectedMood === mood.id ? 'bg-[#282828] ring-2 ring-[#1DB954]' : 'bg-[#181818]'
                        }`}
                      >
                        <div className="relative mb-4">
                          <img src={mood.imageUrl} alt={mood.name} className="w-full aspect-square object-cover rounded-md shadow-lg" />
                          <div className="absolute bottom-2 right-2 w-12 h-12 bg-[#1DB954] rounded-full flex items-center justify-center opacity-0 translate-y-2 group-hover:opacity-100 group-hover:translate-y-0 transition-all shadow-xl hover:scale-105 hover:bg-[#1ed760]">
                            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="24" height="24" fill="black">
                              <polygon points="6,4 20,12 6,20" />
                            </svg>
                          </div>
                        </div>
                        <div className="text-center">
                          <h4 className="text-white font-bold text-base">{mood.name}</h4>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </section>

              {/* Footer */}
              <footer className="border-t border-[#282828] pt-12 pb-24">
                <div className="grid grid-cols-2 md:grid-cols-4 gap-8 mb-8">
                  <div>
                    <h4 className="text-white font-bold mb-4">Company</h4>
                    <ul className="space-y-2">
                      <li><button onClick={() => showToast('About page coming soon')} className="text-[#b3b3b3] hover:text-white transition text-sm">About</button></li>
                      <li><button onClick={() => showToast('Jobs page coming soon')} className="text-[#b3b3b3] hover:text-white transition text-sm">Jobs</button></li>
                      <li><button onClick={() => showToast('For the Record coming soon')} className="text-[#b3b3b3] hover:text-white transition text-sm">For the Record</button></li>
                    </ul>
                  </div>
                  <div>
                    <h4 className="text-white font-bold mb-4">Communities</h4>
                    <ul className="space-y-2">
                      <li><button onClick={() => showToast('For Artists page coming soon')} className="text-[#b3b3b3] hover:text-white transition text-sm">For Artists</button></li>
                      <li><button onClick={() => showToast('Developers portal coming soon')} className="text-[#b3b3b3] hover:text-white transition text-sm">Developers</button></li>
                      <li><button onClick={() => showToast('Advertising page coming soon')} className="text-[#b3b3b3] hover:text-white transition text-sm">Advertising</button></li>
                      <li><button onClick={() => showToast('Investors page coming soon')} className="text-[#b3b3b3] hover:text-white transition text-sm">Investors</button></li>
                      <li><button onClick={() => showToast('Vendors page coming soon')} className="text-[#b3b3b3] hover:text-white transition text-sm">Vendors</button></li>
                    </ul>
                  </div>
                  <div>
                    <h4 className="text-white font-bold mb-4">Useful links</h4>
                    <ul className="space-y-2">
                      <li><button onClick={() => setShowSupportModal(true)} className="text-[#b3b3b3] hover:text-white transition text-sm">Support</button></li>
                      <li><button onClick={() => setShowDownloadModal(true)} className="text-[#b3b3b3] hover:text-white transition text-sm">Free Mobile App</button></li>
                    </ul>
                  </div>
                  <div>
                    <h4 className="text-white font-bold mb-4">MicroFy Plans</h4>
                    <ul className="space-y-2">
                      <li><button onClick={() => setShowPremiumModal(true)} className="text-[#b3b3b3] hover:text-white transition text-sm">Premium Individual</button></li>
                      <li><button onClick={() => setShowPremiumModal(true)} className="text-[#b3b3b3] hover:text-white transition text-sm">Premium Duo</button></li>
                      <li><button onClick={() => setShowPremiumModal(true)} className="text-[#b3b3b3] hover:text-white transition text-sm">Premium Family</button></li>
                      <li><button onClick={() => setShowPremiumModal(true)} className="text-[#b3b3b3] hover:text-white transition text-sm">Premium Student</button></li>
                      <li><button onClick={() => showToast('MicroFy Free -- you\'re already on it!')} className="text-[#b3b3b3] hover:text-white transition text-sm">MicroFy Free</button></li>
                    </ul>
                  </div>
                </div>
                <div className="flex justify-between items-center pt-8 border-t border-[#282828]">
                  <p className="text-[#b3b3b3] text-sm">&copy; 2025 MicroFy</p>
                </div>
              </footer>
            </>
          ) : selectedSong ? (
            /* Song Detail View */
            <div>
              <div className="flex flex-col md:flex-row gap-8 mb-8 bg-gradient-to-b from-[#535353] to-[#121212] p-8 rounded-lg">
                <img src={selectedSong.coverUrl} alt={selectedSong.title} className="w-64 h-64 rounded-lg shadow-2xl" />
                <div className="flex flex-col justify-end">
                  <p className="text-sm font-semibold mb-2">SONG</p>
                  <h1 className="text-5xl md:text-7xl font-bold mb-4">{selectedSong.title}</h1>
                  <p className="text-sm text-[#b3b3b3]">
                    <span className="font-semibold">{selectedSong.artist}</span> • {selectedSong.title} • 2024 • {audioDuration > 0 ? formatTime(audioDuration) : selectedSong.duration} • 179,981
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-4 mb-8">
                <button
                  onClick={handleTogglePlay}
                  className="w-14 h-14 bg-[#1DB954] rounded-full flex items-center justify-center hover:scale-105 transition"
                >
                  {isPlaying ? (
                    <svg xmlns="http://www.w3.org/2000/svg" width="30" height="30" fill="black" viewBox="0 0 24 24">
                      <rect x="6" y="4" width="4" height="16" />
                      <rect x="14" y="4" width="4" height="16" />
                    </svg>
                  ) : (
                    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="30" height="30" fill="black">
                      <polygon points="6,4 20,12 6,20" />
                    </svg>
                  )}
                </button>
                <button
                  onClick={() => handleToggleFavorite(selectedSong.id)}
                  className={`w-10 h-10 rounded-full flex items-center justify-center hover:scale-105 transition ${
                    favoriteSongs.includes(selectedSong.id)
                      ? 'bg-[#1DB954] text-black'
                      : 'border-2 border-[#b3b3b3] hover:border-white'
                  }`}
                >
                  {favoriteSongs.includes(selectedSong.id) ? (
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
                      <path d="M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z"/>
                    </svg>
                  ) : (
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <path d="M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z"/>
                    </svg>
                  )}
                </button>
                <button
                  onClick={() => {
                    setSelectedMenuSongId(selectedSong.id);
                    setShowSongMenuModal(true);
                  }}
                  className="w-10 h-10 hover:bg-[#282828] rounded-full flex items-center justify-center transition"
                >
                  <span className="text-2xl">⋯</span>
                </button>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-8 mb-12">
                <div>
                  <h2 className="text-2xl font-bold mb-4">Lyrics</h2>
                  <pre
                    className={`text-[#b3b3b3] whitespace-pre-wrap font-sans ${
                      lyricsExpanded ? "" : "max-h-40 overflow-hidden"
                    }`}
                  >
                    {selectedSong.lyrics || "Lyrics not available"}
                  </pre>
                  <button
                    onClick={() => setLyricsExpanded((prev) => !prev)}
                    className="text-[#1DB954] font-semibold mt-4 hover:underline"
                  >
                    {lyricsExpanded ? "Show Less" : "Show More"}
                  </button>
                </div>

                <div>
                  <h2 className="text-2xl font-bold mb-4">Artists</h2>
                  <div className="space-y-4">
                    {matchedArtists.map((artist) => (
                      <div
                        key={artist.id}
                        onClick={() => handleSelectArtist(artist.id)}
                        className="flex items-center gap-4 p-4 bg-[#181818] rounded-lg hover:bg-[#282828] transition cursor-pointer"
                      >
                        <img src={artist.imageUrl} alt={artist.name} className="w-16 h-16 rounded-full" />
                        <div>
                          <h4 className="text-white font-semibold">{artist.name}</h4>
                          <p className="text-[#b3b3b3] text-sm">Artist</p>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>

              {/* More sections below */}
              <section className="mb-12">
                <h2 className="text-white text-2xl font-bold mb-6 flex items-center gap-2"><Mic2 className="w-6 h-6" /> Top Artists</h2>
                <div className="relative">
                  {arrowVisibility.artists.left && (
                    <button
                      onClick={() => scrollContainer(artistsRef, "left")}
                      className="absolute left-0 top-1/2 -translate-y-1/2 z-10 w-10 h-10 bg-black bg-opacity-80 rounded-full flex items-center justify-center hover:bg-opacity-100 transition"
                    >
                      <svg width="24" height="24" viewBox="0 0 24 24" fill="white">
                        <path d="M15.41 7.41L14 6l-6 6 6 6 1.41-1.41L10.83 12z" />
                      </svg>
                    </button>
                  )}
                  {arrowVisibility.artists.right && (
                    <button
                      onClick={() => scrollContainer(artistsRef, "right")}
                      className="absolute right-0 top-1/2 -translate-y-1/2 z-10 w-10 h-10 bg-black bg-opacity-80 rounded-full flex items-center justify-center hover:bg-opacity-100 transition"
                    >
                      <svg width="24" height="24" viewBox="0 0 24 24" fill="white">
                        <path d="M10 6L8.59 7.41 13.17 12l-4.58 4.59L10 18l6-6z" />
                      </svg>
                    </button>
                  )}
                  <div
                    ref={artistsRef}
                    className="flex gap-4 overflow-x-auto scrollbar-hide scroll-smooth"
                    style={{ scrollbarWidth: "none", msOverflowStyle: "none" }}
                  >
                    {artists.map((artist) => (
                      <div
                        key={artist.id}
                        onClick={() => handleSelectArtist(artist.id)}
                        className="flex-shrink-0 w-[180px] bg-[#181818] rounded-lg overflow-hidden cursor-pointer transition-all duration-300 hover:bg-[#282828] group"
                      >
                        <div className="relative">
                          <img src={artist.imageUrl} alt={artist.name} className="w-full h-[180px] object-cover rounded-full p-4" />
                        </div>
                        <div className="p-4 text-center">
                          <h4 className="text-white font-semibold text-sm">{artist.name}</h4>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </section>

              <section className="mb-12">
                <h2 className="text-white text-2xl font-bold mb-6">Trending Songs</h2>
                <div className="relative">
                  <div
                    ref={trendingRef}
                    className="flex gap-4 overflow-x-auto scrollbar-hide scroll-smooth"
                    style={{ scrollbarWidth: "none", msOverflowStyle: "none" }}
                  >
                    {renderSongCards(songOrder)}
                  </div>
                </div>
              </section>

              <section className="mb-12">
                <h2 className="text-white text-2xl font-bold mb-6 flex items-center gap-2"><Sparkles className="w-6 h-6" /> Pick a Mood, Play a Vibe</h2>
                <div className="relative">
                  <div
                    ref={moodsRef}
                    className="flex gap-4 overflow-x-auto scrollbar-hide scroll-smooth"
                    style={{ scrollbarWidth: "none", msOverflowStyle: "none" }}
                  >
                    {moods.map((mood) => (
                      <div
                        key={mood.id}
                        className="flex-shrink-0 w-[180px] bg-[#181818] rounded-lg overflow-hidden cursor-pointer transition-all duration-300 hover:bg-[#282828]"
                      >
                        <img src={mood.imageUrl} alt={mood.name} className="w-full h-[180px] object-cover" />
                        <div className="p-4 text-center">
                          <h4 className="text-white font-semibold text-sm">{mood.name}</h4>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </section>

            </div>
          ) : selectedArtist ? (
            /* Artist Profile View */
            <div>
              <div className="flex flex-col md:flex-row gap-8 mb-8 bg-gradient-to-b from-[#1e3a8a] to-[#121212] p-8 rounded-lg">
                <img src={selectedArtist.imageUrl} alt={selectedArtist.name} className="w-64 h-64 rounded-full shadow-2xl" />
                <div className="flex flex-col justify-end">
                  <p className="text-sm font-semibold mb-2">ARTIST</p>
                  <h1 className="text-5xl md:text-7xl font-bold mb-4">{selectedArtist.name}</h1>
                  <p className="text-sm text-[#b3b3b3]">
                    {artistSongs.length} songs • {Math.floor(Math.random() * 500000 + 50000).toLocaleString()} monthly listeners
                  </p>
                </div>
              </div>

              <div className="mb-8 flex items-center gap-6">
                <button
                  onClick={() => {
                    if (artistSongs.length > 0) {
                      handleSelectSong(artistSongs[0], true);
                    }
                  }}
                  className="w-14 h-14 bg-[#1DB954] rounded-full flex items-center justify-center hover:scale-105 transition"
                >
                  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="30" height="30" fill="black">
                    <polygon points="6,4 20,12 6,20" />
                  </svg>
                </button>
                {/* Follow Button */}
                <button
                  onClick={() => handleToggleFollow(selectedArtist.id)}
                  className={`px-6 py-2 rounded-full font-bold text-sm transition ${
                    followedArtistIds.includes(selectedArtist.id)
                      ? 'bg-transparent border-2 border-white text-white hover:border-[#b3b3b3]'
                      : 'bg-transparent border border-[#b3b3b3] text-white hover:border-white hover:scale-105'
                  }`}
                >
                  {followedArtistIds.includes(selectedArtist.id) ? 'Following' : 'Follow'}
                </button>
                {/* More Options */}
                <button
                  onClick={() => showToast('Artist options coming soon')}
                  className="text-[#b3b3b3] hover:text-white transition"
                >
                  <svg width="28" height="28" fill="currentColor" viewBox="0 0 24 24">
                    <circle cx="5" cy="12" r="2" />
                    <circle cx="12" cy="12" r="2" />
                    <circle cx="19" cy="12" r="2" />
                  </svg>
                </button>
              </div>

              {/* Popular Tracks */}
              <section className="mb-12">
                <h2 className="text-white text-2xl font-bold mb-6">Popular</h2>
                <div className="space-y-2">
                  {artistSongs.slice(0, 10).map((song, index) => (
                    <div
                      key={song.id}
                      className="flex items-center gap-4 p-3 hover:bg-[#282828] rounded-lg cursor-pointer group transition"
                      onClick={() => handleSelectSong(song, false)}
                    >
                      <span className="text-[#b3b3b3] text-sm w-8">{index + 1}</span>
                      <img src={song.coverUrl} alt={song.title} className="w-12 h-12 rounded" />
                      <div className="flex-1 min-w-0">
                        <h4 className="text-white font-semibold truncate">{song.title}</h4>
                        <p className="text-[#b3b3b3] text-sm truncate">{song.artist}</p>
                      </div>
                      <span className="text-[#b3b3b3] text-sm">{song.id === selectedSongId && audioDuration > 0 ? formatTime(audioDuration) : song.duration}</span>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          handleSelectSong(song, true);
                        }}
                        className="opacity-0 group-hover:opacity-100 w-10 h-10 flex items-center justify-center hover:scale-110 transition"
                      >
                        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="20" height="20" fill="white">
                          <polygon points="6,4 20,12 6,20" />
                        </svg>
                      </button>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          handleToggleFavorite(song.id);
                        }}
                        className="opacity-0 group-hover:opacity-100"
                      >
                        {favoriteSongs.includes(song.id) ? (
                          <svg width="20" height="20" viewBox="0 0 24 24" fill="#1db954">
                            <path d="M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z"/>
                          </svg>
                        ) : (
                          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2">
                            <path d="M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z"/>
                          </svg>
                        )}
                      </button>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          setSelectedMenuSongId(song.id);
                          setShowSongMenuModal(true);
                        }}
                        className="opacity-0 group-hover:opacity-100 text-[#b3b3b3] hover:text-white"
                      >
                        <span className="text-2xl">⋯</span>
                      </button>
                    </div>
                  ))}
                </div>
              </section>

              {/* Discography */}
              <section className="mb-12">
                <h2 className="text-white text-2xl font-bold mb-6">Discography</h2>
                <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-4">
                  {artistSongs.map((song) => {
                    const isCurrentSong = selectedSongId === song.id && isPlaying;
                    return (
                      <div
                        key={song.id}
                        className="bg-[#181818] rounded-lg cursor-pointer transition-all duration-300 hover:bg-[#282828] group p-3"
                        onClick={() => handleSelectSong(song, false)}
                      >
                        <div className="relative mb-3">
                          <img src={song.coverUrl} alt={song.title} className="w-full aspect-square object-cover rounded-md shadow-lg" />
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              handleSelectSong(song, true);
                            }}
                            className="absolute bottom-2 right-2 w-12 h-12 bg-[#1DB954] rounded-full flex items-center justify-center opacity-0 translate-y-2 group-hover:opacity-100 group-hover:translate-y-0 transition-all shadow-xl hover:scale-105 hover:bg-[#1ed760]"
                          >
                            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="24" height="24" fill="black">
                              <polygon points="6,4 20,12 6,20" />
                            </svg>
                          </button>
                        </div>
                        <h4 className={`font-bold text-base mb-1 truncate ${isCurrentSong ? 'text-[#1DB954]' : 'text-white'}`}>{song.title}</h4>
                        <p className="text-[#b3b3b3] text-sm">{song.id === selectedSongId && audioDuration > 0 ? formatTime(audioDuration) : song.duration}</p>
                      </div>
                    );
                  })}
                </div>
              </section>

              {/* About */}
              <section className="mb-12">
                <h2 className="text-white text-2xl font-bold mb-6">About</h2>
                <div className="bg-[#181818] rounded-lg p-6">
                  <div className="flex items-start gap-6">
                    <img src={selectedArtist.imageUrl} alt={selectedArtist.name} className="w-48 h-48 rounded-lg" />
                    <div>
                      <p className="text-white mb-4">
                        {selectedArtist.name} is a renowned artist known for their unique style and captivating performances.
                        With {artistSongs.length} tracks in their discography, they continue to inspire millions of fans worldwide.
                      </p>
                      <div className="space-y-2">
                        <div className="flex items-center gap-2">
                          <span className="text-[#b3b3b3] text-sm">Monthly Listeners:</span>
                          <span className="text-white font-semibold">{Math.floor(Math.random() * 500000 + 50000).toLocaleString()}</span>
                        </div>
                        <div className="flex items-center gap-2">
                          <span className="text-[#b3b3b3] text-sm">Followers:</span>
                          <span className="text-white font-semibold">{Math.floor(Math.random() * 1000000 + 100000).toLocaleString()}</span>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </section>

              {/* Related Artists */}
              <section className="mb-12">
                <h2 className="text-white text-2xl font-bold mb-6">Fans also like</h2>
                <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-4">
                  {artists
                    .filter(a => a.id !== selectedArtist.id)
                    .slice(0, 6)
                    .map((relatedArtist) => (
                      <div
                        key={relatedArtist.id}
                        className="bg-[#181818] p-4 rounded-lg hover:bg-[#282828] transition cursor-pointer group"
                        onClick={() => handleSelectArtist(relatedArtist.id)}
                      >
                        <div className="relative mb-4">
                          <img
                            src={relatedArtist.imageUrl}
                            alt={relatedArtist.name}
                            className="w-full aspect-square rounded-full object-cover shadow-lg"
                          />
                          <button
                            className="absolute bottom-2 right-2 w-12 h-12 bg-[#1DB954] rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 translate-y-2 group-hover:translate-y-0 transition-all shadow-xl hover:scale-105"
                            onClick={(e) => {
                              e.stopPropagation();
                              const relatedArtistSongs = songs.filter(s =>
                                s.artist.toLowerCase().includes(relatedArtist.name.toLowerCase())
                              );
                              if (relatedArtistSongs.length > 0) {
                                handleSelectSong(relatedArtistSongs[0], true);
                              }
                            }}
                          >
                            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="24" height="24" fill="black">
                              <polygon points="6,4 20,12 6,20" />
                            </svg>
                          </button>
                        </div>
                        <h4 className="text-white font-semibold text-sm truncate">{relatedArtist.name}</h4>
                        <p className="text-[#b3b3b3] text-xs">Artist</p>
                      </div>
                    ))}
                </div>
              </section>
            </div>
          ) : null}
          </div>{/* close px-6 pb-6 */}
        </main>
      </div>

      {/* Playbar */}
      {playbarVisible && (
        <div className="fixed bottom-0 left-0 right-0 bg-black px-4 py-2 z-50" style={{ height: '72px' }}>
          <div className="flex items-center justify-between h-full">
            {/* Left: Track Info */}
            <div className="flex items-center gap-3 w-[30%] min-w-0">
              {selectedSong && (
                <>
                  <img src={selectedSong.coverUrl} alt={selectedSong.title} className="w-14 h-14 rounded hidden md:block" />
                  <div className="min-w-0 flex-1">
                    <h3 className={`text-sm font-normal truncate ${isPlaying ? 'text-[#1DB954]' : 'text-white'}`}>{selectedSong.title}</h3>
                    <p className="text-[#b3b3b3] text-[11px] truncate">{selectedSong.artist}</p>
                  </div>
                  {/* Like Button */}
                  <button
                    onClick={() => handleToggleFavorite(selectedSong.id)}
                    className={`hidden md:block transition ${favoriteSongs.includes(selectedSong.id) ? 'text-[#1DB954]' : 'text-[#b3b3b3] hover:text-white'}`}
                    title={favoriteSongs.includes(selectedSong.id) ? 'Remove from Liked Songs' : 'Save to Liked Songs'}
                  >
                    {favoriteSongs.includes(selectedSong.id) ? (
                      <svg width="16" height="16" fill="currentColor" viewBox="0 0 24 24">
                        <path d="M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z" />
                      </svg>
                    ) : (
                      <svg width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                        <path d="M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z" />
                      </svg>
                    )}
                  </button>
                </>
              )}
            </div>

            {/* Center: Playback Controls + Progress */}
            <div className="flex flex-col items-center w-[40%] max-w-[722px]">
              <div className="flex items-center gap-4 mb-1">
                {/* Shuffle */}
                <button
                  onClick={() => setIsShuffle(!isShuffle)}
                  className={`hidden md:block transition ${isShuffle ? 'text-[#1DB954]' : 'text-[#b3b3b3] hover:text-white'}`}
                  title={isShuffle ? 'Disable shuffle' : 'Enable shuffle'}
                >
                  <svg width="16" height="16" fill="currentColor" viewBox="0 0 24 24">
                    <path d="M10.59 9.17L5.41 4 4 5.41l5.17 5.17 1.42-1.41zM14.5 4l2.04 2.04L4 18.59 5.41 20 17.96 7.46 20 9.5V4h-5.5zm.33 9.41l-1.41 1.41 3.13 3.13L14.5 20H20v-5.5l-2.04 2.04-3.13-3.13z" />
                  </svg>
                </button>
                {/* Previous */}
                <button onClick={handlePrevious} className="text-[#b3b3b3] hover:text-white transition">
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
                    <path d="M6 6h2v12H6zm3.5 6l8.5 6V6z" />
                  </svg>
                </button>
                {/* Play/Pause */}
                <button
                  onClick={handleTogglePlay}
                  className="w-8 h-8 bg-white rounded-full flex items-center justify-center hover:scale-105 transition"
                >
                  {isPlaying ? (
                    <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="black" viewBox="0 0 24 24">
                      <rect x="6" y="4" width="4" height="16" />
                      <rect x="14" y="4" width="4" height="16" />
                    </svg>
                  ) : (
                    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="16" height="16" fill="black">
                      <polygon points="6,4 20,12 6,20" />
                    </svg>
                  )}
                </button>
                {/* Next */}
                <button onClick={handleNext} className="text-[#b3b3b3] hover:text-white transition">
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
                    <path d="M16 18h2V6h-2zM6 18l8.5-6L6 6z" />
                  </svg>
                </button>
                {/* Repeat */}
                <button
                  onClick={() => setRepeatMode(repeatMode === 'off' ? 'all' : repeatMode === 'all' ? 'one' : 'off')}
                  className={`hidden md:block transition ${repeatMode !== 'off' ? 'text-[#1DB954]' : 'text-[#b3b3b3] hover:text-white'}`}
                  title={repeatMode === 'off' ? 'Enable repeat' : repeatMode === 'all' ? 'Enable repeat one' : 'Disable repeat'}
                >
                  {repeatMode === 'one' ? (
                    <svg width="16" height="16" fill="currentColor" viewBox="0 0 24 24">
                      <path d="M7 7h10v3l4-4-4-4v3H5v6h2V7zm10 10H7v-3l-4 4 4 4v-3h12v-6h-2v4zm-4-2V9h-1l-2 1v1h1.5v4H13z" />
                    </svg>
                  ) : (
                    <svg width="16" height="16" fill="currentColor" viewBox="0 0 24 24">
                      <path d="M7 7h10v3l4-4-4-4v3H5v6h2V7zm10 10H7v-3l-4 4 4 4v-3h12v-6h-2v4z" />
                    </svg>
                  )}
                </button>
              </div>
              {/* Progress bar + time */}
              <div className="flex items-center gap-2 w-full">
                <span className="text-[#b3b3b3] text-[11px] min-w-[40px] text-right">{formatTime(currentTime)}</span>
                <div className="flex-1 cursor-pointer group" onClick={handleSeek}>
                  <div className="h-1 bg-[#4d4d4d] rounded-full relative">
                    <div
                      className="h-1 bg-white rounded-full absolute top-0 left-0 group-hover:bg-[#1DB954] transition"
                      style={{ width: `${progressPercent}%` }}
                    />
                    <div
                      className="w-3 h-3 bg-white rounded-full absolute top-1/2 -translate-y-1/2 opacity-0 group-hover:opacity-100 transition shadow-lg"
                      style={{ left: `${progressPercent}%` }}
                    />
                  </div>
                </div>
                <span className="text-[#b3b3b3] text-[11px] min-w-[40px]">{formatTime(audioDuration)}</span>
              </div>
            </div>

            {/* Right: Volume, Queue, Device */}
            <div className="flex items-center gap-3 w-[30%] justify-end">
              {/* Queue Button */}
              <button
                onClick={() => setShowQueue(!showQueue)}
                className={`hidden md:block transition ${showQueue ? 'text-[#1DB954]' : 'text-[#b3b3b3] hover:text-white'}`}
                title="Queue"
              >
                <svg width="20" height="20" fill="currentColor" viewBox="0 0 24 24">
                  <path d="M15 6H3v2h12V6zm0 4H3v2h12v-2zM3 16h8v-2H3v2zM17 6v8.18c-.31-.11-.65-.18-1-.18-1.66 0-3 1.34-3 3s1.34 3 3 3 3-1.34 3-3V8h3V6h-5z" />
                </svg>
              </button>
              {/* Connect Device Button */}
              <button
                onClick={() => setShowDeviceModal(true)}
                className="hidden md:block text-[#b3b3b3] hover:text-white transition"
                title="Connect to a device"
              >
                <svg width="20" height="20" fill="currentColor" viewBox="0 0 24 24">
                  <path d="M21 3H3c-1.1 0-2 .9-2 2v12c0 1.1.9 2 2 2h5v2h8v-2h5c1.1 0 1.99-.9 1.99-2L23 5c0-1.1-.9-2-2-2zm0 14H3V5h18v12z" />
                </svg>
              </button>
              {/* Volume Control */}
              <div className="hidden md:flex items-center gap-2">
                <button
                  onClick={() => setVolume(volume === 0 ? 70 : 0)}
                  className="text-[#b3b3b3] hover:text-white transition"
                  title={volume === 0 ? 'Unmute' : 'Mute'}
                >
                  {volume === 0 ? (
                    <svg width="20" height="20" fill="currentColor" viewBox="0 0 24 24">
                      <path d="M16.5 12c0-1.77-1.02-3.29-2.5-4.03v2.21l2.45 2.45c.03-.2.05-.41.05-.63zm2.5 0c0 .94-.2 1.82-.54 2.64l1.51 1.51C20.63 14.91 21 13.5 21 12c0-4.28-2.99-7.86-7-8.77v2.06c2.89.86 5 3.54 5 6.71zM4.27 3L3 4.27 7.73 9H3v6h4l5 5v-6.73l4.25 4.25c-.67.52-1.42.93-2.25 1.18v2.06c1.38-.31 2.63-.95 3.69-1.81L19.73 21 21 19.73l-9-9L4.27 3zM12 4L9.91 6.09 12 8.18V4z" />
                    </svg>
                  ) : volume < 50 ? (
                    <svg width="20" height="20" fill="currentColor" viewBox="0 0 24 24">
                      <path d="M18.5 12c0-1.77-1.02-3.29-2.5-4.03v8.05c1.48-.73 2.5-2.25 2.5-4.02zM5 9v6h4l5 5V4L9 9H5z" />
                    </svg>
                  ) : (
                    <svg width="20" height="20" fill="currentColor" viewBox="0 0 24 24">
                      <path d="M3 9v6h4l5 5V4L7 9H3zm13.5 3c0-1.77-1.02-3.29-2.5-4.03v8.05c1.48-.73 2.5-2.25 2.5-4.02zM14 3.23v2.06c2.89.86 5 3.54 5 6.71s-2.11 5.85-5 6.71v2.06c4.01-.91 7-4.49 7-8.77s-2.99-7.86-7-8.77z" />
                    </svg>
                  )}
                </button>
                <input
                  type="range"
                  min="0"
                  max="100"
                  value={volume}
                  onChange={(e) => setVolume(parseInt(e.target.value))}
                  className="w-24 h-1 bg-[#4d4d4d] rounded-full appearance-none cursor-pointer [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-3 [&::-webkit-slider-thumb]:h-3 [&::-webkit-slider-thumb]:bg-white [&::-webkit-slider-thumb]:rounded-full hover:[&::-webkit-slider-thumb]:bg-[#1DB954]"
                  title={`Volume: ${volume}%`}
                />
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Queue Modal */}
      {showQueue && (
        <div className="fixed right-4 bottom-24 w-80 bg-[#282828] rounded-lg shadow-xl z-50 max-h-96 overflow-hidden">
          <div className="p-4 border-b border-[#3e3e3e]">
            <h3 className="text-white font-bold">Queue</h3>
          </div>
          <div className="p-2 max-h-72 overflow-y-auto">
            {selectedSong && (
              <div className="mb-4">
                <p className="text-[#b3b3b3] text-xs px-2 mb-2">Now Playing</p>
                <div className="flex items-center gap-3 p-2 bg-[#3e3e3e] rounded">
                  <img src={selectedSong.coverUrl} alt={selectedSong.title} className="w-10 h-10 rounded" />
                  <div className="flex-1 min-w-0">
                    <p className="text-white text-sm truncate">{selectedSong.title}</p>
                    <p className="text-[#b3b3b3] text-xs truncate">{selectedSong.artist}</p>
                  </div>
                </div>
              </div>
            )}
            {queue.length > 0 ? (
              <div>
                <p className="text-[#b3b3b3] text-xs px-2 mb-2">Next Up</p>
                {queue.map((songId, index) => {
                  const queueSong = songs.find(s => s.id === songId);
                  return queueSong ? (
                    <div key={index} className="flex items-center gap-3 p-2 hover:bg-[#3e3e3e] rounded group">
                      <img src={queueSong.coverUrl} alt={queueSong.title} className="w-10 h-10 rounded" />
                      <div className="flex-1 min-w-0">
                        <p className="text-white text-sm truncate">{queueSong.title}</p>
                        <p className="text-[#b3b3b3] text-xs truncate">{queueSong.artist}</p>
                      </div>
                      <button
                        onClick={() => handleRemoveFromQueue(index)}
                        className="opacity-0 group-hover:opacity-100 text-[#b3b3b3] hover:text-white transition"
                      >
                        <svg width="16" height="16" fill="currentColor" viewBox="0 0 24 24">
                          <path d="M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z" />
                        </svg>
                      </button>
                    </div>
                  ) : null;
                })}
              </div>
            ) : (
              <p className="text-[#b3b3b3] text-sm text-center py-4">Queue is empty</p>
            )}
          </div>
        </div>
      )}

      {/* Device Connect Modal */}
      {showDeviceModal && (
        <div
          className="fixed inset-0 bg-black bg-opacity-75 flex items-center justify-center z-50 p-4"
          onClick={() => setShowDeviceModal(false)}
        >
          <div
            className="bg-[#282828] rounded-lg p-6 max-w-sm w-full"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-white text-xl font-bold">Connect to a device</h2>
              <button onClick={() => setShowDeviceModal(false)} className="text-[#b3b3b3] hover:text-white">
                <svg width="24" height="24" fill="currentColor" viewBox="0 0 24 24">
                  <path d="M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z" />
                </svg>
              </button>
            </div>
            <div className="space-y-3">
              <div
                onClick={() => { setActiveDevice('this-computer'); showToast('Playing on This Computer'); }}
                className={`flex items-center gap-4 p-3 rounded-lg cursor-pointer ${activeDevice === 'this-computer' ? 'bg-[#3e3e3e] hover:bg-[#4a4a4a]' : 'hover:bg-[#3e3e3e]'}`}
              >
                <Monitor className={`w-8 h-8 ${activeDevice === 'this-computer' ? 'text-[#1DB954]' : 'text-[#b3b3b3]'}`} />
                <div>
                  <p className="text-white font-semibold">This Computer</p>
                  {activeDevice === 'this-computer' && <p className="text-[#1DB954] text-xs">Currently playing</p>}
                </div>
              </div>
              <div
                onClick={() => { setActiveDevice('macbook'); showToast('Connecting to MacBook Pro...'); }}
                className={`flex items-center gap-4 p-3 rounded-lg cursor-pointer ${activeDevice === 'macbook' ? 'bg-[#3e3e3e] hover:bg-[#4a4a4a]' : 'hover:bg-[#3e3e3e]'}`}
              >
                <Laptop className={`w-8 h-8 ${activeDevice === 'macbook' ? 'text-[#1DB954]' : 'text-[#b3b3b3]'}`} />
                <div>
                  <p className="text-white">MacBook Pro</p>
                  {activeDevice === 'macbook' ? <p className="text-[#1DB954] text-xs">Currently playing</p> : <p className="text-[#b3b3b3] text-xs">MicroFy Connect</p>}
                </div>
              </div>
              <div
                onClick={() => { setActiveDevice('iphone'); showToast('Connecting to iPhone...'); }}
                className={`flex items-center gap-4 p-3 rounded-lg cursor-pointer ${activeDevice === 'iphone' ? 'bg-[#3e3e3e] hover:bg-[#4a4a4a]' : 'hover:bg-[#3e3e3e]'}`}
              >
                <Smartphone className={`w-8 h-8 ${activeDevice === 'iphone' ? 'text-[#1DB954]' : 'text-[#b3b3b3]'}`} />
                <div>
                  <p className="text-white">iPhone</p>
                  {activeDevice === 'iphone' ? <p className="text-[#1DB954] text-xs">Currently playing</p> : <p className="text-[#b3b3b3] text-xs">MicroFy Connect</p>}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Login Modal */}
      {showLoginModal && (
        <div
          className="fixed inset-0 bg-black bg-opacity-75 flex items-center justify-center z-50 p-4"
          onClick={() => setShowLoginModal(false)}
        >
          <div
            className="bg-[#282828] rounded-lg p-8 max-w-md w-full"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-white text-2xl font-bold">Log in to MicroFy</h2>
              <button
                onClick={() => setShowLoginModal(false)}
                className="text-[#b3b3b3] hover:text-white"
              >
                <svg width="24" height="24" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z" />
                </svg>
              </button>
            </div>
            <form
              onSubmit={(e) => {
                e.preventDefault();
                const formData = new FormData(e.currentTarget);
                const username = formData.get('username') as string;
                if (username) handleLogin(username);
              }}
            >
              <div className="mb-4">
                <label className="text-white text-sm font-semibold mb-2 block">Username or Email</label>
                <input
                  type="text"
                  name="username"
                  className="w-full bg-[#121212] text-white px-4 py-3 rounded border border-[#727272] outline-none focus:border-white transition"
                  placeholder="Enter your username or email"
                  required
                />
              </div>
              <div className="mb-6">
                <label className="text-white text-sm font-semibold mb-2 block">Password</label>
                <input
                  type="password"
                  name="password"
                  className="w-full bg-[#121212] text-white px-4 py-3 rounded border border-[#727272] outline-none focus:border-white transition"
                  placeholder="Enter your password"
                  required
                />
              </div>
              <button
                type="submit"
                className="w-full bg-[#1DB954] text-black font-bold py-3 rounded-full hover:scale-105 transition"
              >
                Log In
              </button>
              <div className="mt-6 text-center">
                <button
                  type="button"
                  onClick={() => {
                    setShowLoginModal(false);
                    setShowSignupModal(true);
                  }}
                  className="text-[#1DB954] hover:underline text-sm"
                >
                  Don't have an account? Sign up
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Signup Modal */}
      {showSignupModal && (
        <div
          className="fixed inset-0 bg-black bg-opacity-75 flex items-center justify-center z-50 p-4"
          onClick={() => setShowSignupModal(false)}
        >
          <div
            className="bg-[#282828] rounded-lg p-8 max-w-md w-full"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-white text-2xl font-bold">Sign up for MicroFy</h2>
              <button
                onClick={() => setShowSignupModal(false)}
                className="text-[#b3b3b3] hover:text-white"
              >
                <svg width="24" height="24" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z" />
                </svg>
              </button>
            </div>
            <form
              onSubmit={(e) => {
                e.preventDefault();
                const formData = new FormData(e.currentTarget);
                const username = formData.get('username') as string;
                if (username) handleLogin(username);
              }}
            >
              <div className="mb-4">
                <label className="text-white text-sm font-semibold mb-2 block">Email</label>
                <input
                  type="email"
                  name="email"
                  className="w-full bg-[#121212] text-white px-4 py-3 rounded border border-[#727272] outline-none focus:border-white transition"
                  placeholder="Enter your email"
                  required
                />
              </div>
              <div className="mb-4">
                <label className="text-white text-sm font-semibold mb-2 block">Username</label>
                <input
                  type="text"
                  name="username"
                  className="w-full bg-[#121212] text-white px-4 py-3 rounded border border-[#727272] outline-none focus:border-white transition"
                  placeholder="Choose a username"
                  required
                />
              </div>
              <div className="mb-6">
                <label className="text-white text-sm font-semibold mb-2 block">Password</label>
                <input
                  type="password"
                  name="password"
                  className="w-full bg-[#121212] text-white px-4 py-3 rounded border border-[#727272] outline-none focus:border-white transition"
                  placeholder="Create a password"
                  required
                />
              </div>
              <button
                type="submit"
                className="w-full bg-[#1DB954] text-black font-bold py-3 rounded-full hover:scale-105 transition"
              >
                Sign Up
              </button>
              <div className="mt-6 text-center">
                <button
                  type="button"
                  onClick={() => {
                    setShowSignupModal(false);
                    setShowLoginModal(true);
                  }}
                  className="text-[#1DB954] hover:underline text-sm"
                >
                  Already have an account? Log in
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Premium Modal */}
      {showPremiumModal && (
        <div
          className="fixed inset-0 bg-black bg-opacity-75 flex items-center justify-center z-50 p-4"
          onClick={() => setShowPremiumModal(false)}
        >
          <div
            className="bg-[#282828] rounded-lg p-8 max-w-4xl w-full max-h-[90vh] overflow-y-auto"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-white text-3xl font-bold">Premium Plans</h2>
              <button
                onClick={() => setShowPremiumModal(false)}
                className="text-[#b3b3b3] hover:text-white"
              >
                <svg width="24" height="24" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z" />
                </svg>
              </button>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <div className="bg-gradient-to-br from-blue-500 to-purple-600 rounded-lg p-6">
                <h3 className="text-white text-xl font-bold mb-2">Individual</h3>
                <p className="text-white text-3xl font-bold mb-4">$9.99<span className="text-sm font-normal">/month</span></p>
                <ul className="text-white space-y-2 mb-6">
                  <li className="flex items-start gap-2">
                    <span className="text-[#1DB954]">✓</span>
                    <span>Ad-free music listening</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="text-[#1DB954]">✓</span>
                    <span>Download to listen offline</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="text-[#1DB954]">✓</span>
                    <span>Play songs in any order</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="text-[#1DB954]">✓</span>
                    <span>High audio quality</span>
                  </li>
                </ul>
                <button onClick={() => { showToast('Premium Individual is coming soon to your region'); setShowPremiumModal(false); }} className="w-full bg-white text-black font-bold py-3 rounded-full hover:scale-105 transition">
                  Get Premium
                </button>
              </div>
              <div className="bg-gradient-to-br from-pink-500 to-red-600 rounded-lg p-6">
                <h3 className="text-white text-xl font-bold mb-2">Duo</h3>
                <p className="text-white text-3xl font-bold mb-4">$12.99<span className="text-sm font-normal">/month</span></p>
                <ul className="text-white space-y-2 mb-6">
                  <li className="flex items-start gap-2">
                    <span className="text-[#1DB954]">✓</span>
                    <span>2 Premium accounts</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="text-[#1DB954]">✓</span>
                    <span>For couples under one roof</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="text-[#1DB954]">✓</span>
                    <span>Duo Mix playlist</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="text-[#1DB954]">✓</span>
                    <span>All Premium features</span>
                  </li>
                </ul>
                <button onClick={() => { showToast('Premium Duo is coming soon to your region'); setShowPremiumModal(false); }} className="w-full bg-white text-black font-bold py-3 rounded-full hover:scale-105 transition">
                  Get Premium Duo
                </button>
              </div>
              <div className="bg-gradient-to-br from-[#1DB954] to-[#0d7a3e] rounded-lg p-6">
                <h3 className="text-white text-xl font-bold mb-2">Family</h3>
                <p className="text-white text-3xl font-bold mb-4">$15.99<span className="text-sm font-normal">/month</span></p>
                <ul className="text-white space-y-2 mb-6">
                  <li className="flex items-start gap-2">
                    <span className="text-[#1DB954]">✓</span>
                    <span>Up to 6 Premium accounts</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="text-[#1DB954]">✓</span>
                    <span>For family under one roof</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="text-[#1DB954]">✓</span>
                    <span>Family Mix playlist</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="text-[#1DB954]">✓</span>
                    <span>Block explicit music</span>
                  </li>
                </ul>
                <button onClick={() => { showToast('Premium Family is coming soon to your region'); setShowPremiumModal(false); }} className="w-full bg-white text-black font-bold py-3 rounded-full hover:scale-105 transition">
                  Get Premium Family
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Support Modal */}
      {showSupportModal && (
        <div
          className="fixed inset-0 bg-black bg-opacity-75 flex items-center justify-center z-50 p-4"
          onClick={() => setShowSupportModal(false)}
        >
          <div
            className="bg-[#282828] rounded-lg p-8 max-w-2xl w-full max-h-[90vh] overflow-y-auto"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-white text-3xl font-bold">Help & Support</h2>
              <button
                onClick={() => setShowSupportModal(false)}
                className="text-[#b3b3b3] hover:text-white"
              >
                <svg width="24" height="24" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z" />
                </svg>
              </button>
            </div>
            <div className="space-y-6">
              <div className="bg-[#282828] rounded-lg p-6">
                <h3 className="text-white text-xl font-bold mb-2">Account Issues</h3>
                <p className="text-[#b3b3b3] mb-4">Having trouble accessing your account? We can help you reset your password or recover your username.</p>
                <button onClick={() => { showToast('Support ticket submitted -- we\'ll get back to you shortly'); setShowSupportModal(false); }} className="bg-[#1DB954] text-black px-6 py-2 rounded-full font-semibold hover:scale-105 transition">
                  Get Help
                </button>
              </div>
              <div className="bg-[#282828] rounded-lg p-6">
                <h3 className="text-white text-xl font-bold mb-2">Payment & Subscriptions</h3>
                <p className="text-[#b3b3b3] mb-4">Questions about billing, subscriptions, or payment methods? Our team is here to assist.</p>
                <button onClick={() => { showToast('Support ticket submitted -- we\'ll get back to you shortly'); setShowSupportModal(false); }} className="bg-[#1DB954] text-black px-6 py-2 rounded-full font-semibold hover:scale-105 transition">
                  Contact Support
                </button>
              </div>
              <div className="bg-[#282828] rounded-lg p-6">
                <h3 className="text-white text-xl font-bold mb-2">Technical Problems</h3>
                <p className="text-[#b3b3b3] mb-4">Experiencing playback issues, app crashes, or other technical difficulties?</p>
                <button onClick={() => { showToast('Running diagnostics -- please wait'); setShowSupportModal(false); }} className="bg-[#1DB954] text-black px-6 py-2 rounded-full font-semibold hover:scale-105 transition">
                  Troubleshoot
                </button>
              </div>
              <div className="bg-[#282828] rounded-lg p-6">
                <h3 className="text-white text-xl font-bold mb-2">FAQs</h3>
                <div className="space-y-3 text-[#b3b3b3]">
                  <details className="cursor-pointer">
                    <summary className="font-semibold text-white hover:text-[#1DB954]">How do I download songs?</summary>
                    <p className="mt-2">Premium users can download songs by clicking the download arrow on albums and playlists.</p>
                  </details>
                  <details className="cursor-pointer">
                    <summary className="font-semibold text-white hover:text-[#1DB954]">Can I cancel my subscription?</summary>
                    <p className="mt-2">Yes, you can cancel anytime from your account settings. Your Premium access continues until the end of the billing period.</p>
                  </details>
                  <details className="cursor-pointer">
                    <summary className="font-semibold text-white hover:text-[#1DB954]">What's included with Premium?</summary>
                    <p className="mt-2">Premium includes ad-free listening, offline downloads, unlimited skips, and high-quality streaming.</p>
                  </details>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Download Modal */}
      {showDownloadModal && (
        <div
          className="fixed inset-0 bg-black bg-opacity-75 flex items-center justify-center z-50 p-4"
          onClick={() => setShowDownloadModal(false)}
        >
          <div
            className="bg-[#282828] rounded-lg p-8 max-w-2xl w-full"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-white text-3xl font-bold">Download MicroFy</h2>
              <button
                onClick={() => setShowDownloadModal(false)}
                className="text-[#b3b3b3] hover:text-white"
              >
                <svg width="24" height="24" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z" />
                </svg>
              </button>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div onClick={() => { showToast('Starting download for Windows...'); setShowDownloadModal(false); }} className="bg-[#282828] rounded-lg p-6 text-center hover:bg-[#3e3e3e] transition cursor-pointer">
                <div className="mb-4 flex justify-center"><Monitor className="w-16 h-16 text-white" /></div>
                <h3 className="text-white text-xl font-bold mb-2">Windows</h3>
                <p className="text-[#b3b3b3] mb-4">Download for Windows 10/11</p>
                <span className="inline-block bg-[#1DB954] text-black px-6 py-2 rounded-full font-semibold">Download</span>
              </div>
              <div onClick={() => { showToast('Starting download for macOS...'); setShowDownloadModal(false); }} className="bg-[#282828] rounded-lg p-6 text-center hover:bg-[#3e3e3e] transition cursor-pointer">
                <div className="mb-4 flex justify-center"><Laptop className="w-16 h-16 text-white" /></div>
                <h3 className="text-white text-xl font-bold mb-2">macOS</h3>
                <p className="text-[#b3b3b3] mb-4">Download for Mac</p>
                <span className="inline-block bg-[#1DB954] text-black px-6 py-2 rounded-full font-semibold">Download</span>
              </div>
              <div onClick={() => { showToast('Redirecting to App Store...'); setShowDownloadModal(false); }} className="bg-[#282828] rounded-lg p-6 text-center hover:bg-[#3e3e3e] transition cursor-pointer">
                <div className="mb-4 flex justify-center"><Smartphone className="w-16 h-16 text-white" /></div>
                <h3 className="text-white text-xl font-bold mb-2">iOS</h3>
                <p className="text-[#b3b3b3] mb-4">Download for iOS</p>
                <span className="inline-block bg-[#1DB954] text-black px-6 py-2 rounded-full font-semibold">Download</span>
              </div>
              <div onClick={() => { showToast('Redirecting to App Store...'); setShowDownloadModal(false); }} className="bg-[#282828] rounded-lg p-6 text-center hover:bg-[#3e3e3e] transition cursor-pointer">
                <div className="mb-4 flex justify-center"><Smartphone className="w-16 h-16 text-white" /></div>
                <h3 className="text-white text-xl font-bold mb-2">Android</h3>
                <p className="text-[#b3b3b3] mb-4">Download for Android</p>
                <span className="inline-block bg-[#1DB954] text-black px-6 py-2 rounded-full font-semibold">Download</span>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Install App Modal */}
      {showInstallModal && (
        <div
          className="fixed inset-0 bg-black bg-opacity-75 flex items-center justify-center z-50 p-4"
          onClick={() => setShowInstallModal(false)}
        >
          <div
            className="bg-[#282828] rounded-lg p-8 max-w-lg w-full"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-white text-3xl font-bold">Install MicroFy</h2>
              <button
                onClick={() => setShowInstallModal(false)}
                className="text-[#b3b3b3] hover:text-white"
              >
                <svg width="24" height="24" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z" />
                </svg>
              </button>
            </div>
            <div className="text-center">
              <div className="mb-6 flex justify-center"><Music className="w-20 h-20 text-[#1DB954]" /></div>
              <h3 className="text-white text-2xl font-bold mb-4">Install MicroFy as an App</h3>
              <p className="text-[#b3b3b3] mb-6">
                Get quick access to MicroFy by installing it on your device. Enjoy a native app experience with faster loading and offline capabilities.
              </p>
              <div className="space-y-4">
                <div className="bg-[#282828] rounded-lg p-4 text-left">
                  <h4 className="text-white font-semibold mb-2">Step 1: Open Browser Menu</h4>
                  <p className="text-[#b3b3b3] text-sm">Click on the three dots or menu icon in your browser</p>
                </div>
                <div className="bg-[#282828] rounded-lg p-4 text-left">
                  <h4 className="text-white font-semibold mb-2">Step 2: Select Install App</h4>
                  <p className="text-[#b3b3b3] text-sm">Look for "Install MicroFy" or "Add to Home Screen"</p>
                </div>
                <div className="bg-[#282828] rounded-lg p-4 text-left">
                  <h4 className="text-white font-semibold mb-2">Step 3: Confirm Installation</h4>
                  <p className="text-[#b3b3b3] text-sm">Click Install and enjoy MicroFy as an app!</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Create Playlist Modal */}
      {showCreatePlaylistModal && (
        <div
          className="fixed inset-0 bg-black bg-opacity-75 flex items-center justify-center z-50 p-4"
          onClick={() => setShowCreatePlaylistModal(false)}
        >
          <div
            className="bg-[#282828] rounded-lg p-8 max-w-md w-full"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-white text-2xl font-bold">Create Playlist</h2>
              <button
                onClick={() => setShowCreatePlaylistModal(false)}
                className="text-[#b3b3b3] hover:text-white"
              >
                <svg width="24" height="24" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z" />
                </svg>
              </button>
            </div>
            <form
              onSubmit={(e) => {
                e.preventDefault();
                const formData = new FormData(e.currentTarget);
                const name = formData.get('playlistName') as string;
                const description = formData.get('description') as string || '';
                handleCreatePlaylist(name, description);
                setShowCreatePlaylistModal(false);
              }}
            >
              <div className="mb-6">
                <label className="text-white text-sm font-semibold mb-2 block">Playlist Name</label>
                <input
                  type="text"
                  name="playlistName"
                  className="w-full bg-[#121212] text-white px-4 py-3 rounded border border-[#727272] outline-none focus:border-white transition"
                  placeholder="My Awesome Playlist"
                  required
                  autoFocus
                />
              </div>
              <div className="mb-6">
                <label className="text-white text-sm font-semibold mb-2 block">Description (Optional)</label>
                <textarea
                  name="description"
                  rows={3}
                  className="w-full bg-[#121212] text-white px-4 py-3 rounded border border-[#727272] outline-none focus:border-white transition resize-none"
                  placeholder="Add a description..."
                />
              </div>
              <div className="flex gap-4">
                <button
                  type="button"
                  onClick={() => setShowCreatePlaylistModal(false)}
                  className="flex-1 bg-transparent border border-[#b3b3b3] text-white font-bold py-3 rounded-full hover:border-white transition"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="flex-1 bg-[#1DB954] text-black font-bold py-3 rounded-full hover:scale-105 transition"
                >
                  Create
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Settings Modal */}
      {showSettingsModal && (
        <div
          className="fixed inset-0 bg-black bg-opacity-75 flex items-center justify-center z-50 p-4"
          onClick={() => setShowSettingsModal(false)}
        >
          <div
            className="bg-[#282828] rounded-lg p-8 max-w-2xl w-full max-h-[90vh] overflow-y-auto"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-white text-3xl font-bold">Settings</h2>
              <button
                onClick={() => setShowSettingsModal(false)}
                className="text-[#b3b3b3] hover:text-white"
              >
                <svg width="24" height="24" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z" />
                </svg>
              </button>
            </div>
            <div className="space-y-6">
              {/* Profile Overview */}
              <div className="bg-[#282828] rounded-lg p-6">
                <div className="flex items-center gap-4 mb-6">
                  {selfUser?.avatarUrl ? (
                    <img
                      src={selfUser.avatarUrl}
                      alt={displayName}
                      className="w-20 h-20 rounded-full object-cover"
                    />
                  ) : (
                    <div className="w-20 h-20 rounded-full bg-gradient-to-br from-[#1DB954] to-[#169c46] flex items-center justify-center text-white text-2xl font-bold">
                      {displayName.charAt(0).toUpperCase()}
                    </div>
                  )}
                  <div>
                    <h3 className="text-white text-xl font-bold">{displayName}</h3>
                    <p className="text-[#b3b3b3]">@{accountHandle}</p>
                    {profileStats.isPremium && (
                      <span className="inline-block mt-1 px-2 py-0.5 bg-[#1DB954] text-black text-xs font-bold rounded">PREMIUM</span>
                    )}
                  </div>
                </div>
                <div className="grid grid-cols-4 gap-4 mb-4">
                  <div className="text-center">
                    <div className="text-white text-xl font-bold">{profileStats.followers}</div>
                    <div className="text-[#b3b3b3] text-sm">Followers</div>
                  </div>
                  <div className="text-center">
                    <div className="text-white text-xl font-bold">{profileStats.following}</div>
                    <div className="text-[#b3b3b3] text-sm">Following</div>
                  </div>
                  <div className="text-center">
                    <div className="text-white text-xl font-bold">{profileStats.playlistCount}</div>
                    <div className="text-[#b3b3b3] text-sm">Playlists</div>
                  </div>
                  <div className="text-center">
                    <div className="text-white text-xl font-bold">{profileStats.likedTracksCount}</div>
                    <div className="text-[#b3b3b3] text-sm">Liked</div>
                  </div>
                </div>
                {profileStats.topGenres.length > 0 && (
                  <div className="mb-4">
                    <div className="text-[#b3b3b3] text-sm mb-2">Top Genres</div>
                    <div className="flex flex-wrap gap-2">
                      {profileStats.topGenres.map((genre: string, idx: number) => (
                        <span key={idx} className="px-3 py-1 bg-[#3e3e3e] text-white text-sm rounded-full">{genre}</span>
                      ))}
                    </div>
                  </div>
                )}
                {profileStats.joinedDate && (
                  <div className="text-[#b3b3b3] text-sm">Member since {profileStats.joinedDate}</div>
                )}
              </div>

              <div className="bg-[#282828] rounded-lg p-6">
                <h3 className="text-white text-xl font-bold mb-4">Account</h3>
                <div className="space-y-3">
                  <div className="flex justify-between items-center">
                    <span className="text-white">Username</span>
                    <span className="text-[#b3b3b3]">{accountHandle}</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-white">Email</span>
                    <span className="text-[#b3b3b3]">{email}</span>
                  </div>
                  <button
                    onClick={() => {
                      setShowSettingsModal(false);
                      setShowEditProfileModal(true);
                    }}
                    className="w-full bg-[#3e3e3e] text-white py-2 rounded-md hover:bg-[#4e4e4e] transition"
                  >
                    Edit Profile
                  </button>
                </div>
              </div>
              <div className="bg-[#282828] rounded-lg p-6">
                <h3 className="text-white text-xl font-bold mb-4">Playback</h3>
                <div className="space-y-4">
                  <div className="flex items-center justify-between cursor-pointer" onClick={() => setSettingCrossfade(!settingCrossfade)}>
                    <span className="text-white text-sm">Crossfade songs</span>
                    <div className={`w-10 h-6 rounded-full relative transition-colors ${settingCrossfade ? 'bg-[#1DB954]' : 'bg-[#727272]'}`}>
                      <div className={`absolute top-1 w-4 h-4 bg-white rounded-full transition-transform ${settingCrossfade ? 'translate-x-5' : 'translate-x-1'}`} />
                    </div>
                  </div>
                  <div className="flex items-center justify-between cursor-pointer" onClick={() => setSettingGapless(!settingGapless)}>
                    <span className="text-white text-sm">Gapless playback</span>
                    <div className={`w-10 h-6 rounded-full relative transition-colors ${settingGapless ? 'bg-[#1DB954]' : 'bg-[#727272]'}`}>
                      <div className={`absolute top-1 w-4 h-4 bg-white rounded-full transition-transform ${settingGapless ? 'translate-x-5' : 'translate-x-1'}`} />
                    </div>
                  </div>
                  <div className="flex items-center justify-between cursor-pointer" onClick={() => setSettingAutoplay(!settingAutoplay)}>
                    <span className="text-white text-sm">Autoplay similar songs</span>
                    <div className={`w-10 h-6 rounded-full relative transition-colors ${settingAutoplay ? 'bg-[#1DB954]' : 'bg-[#727272]'}`}>
                      <div className={`absolute top-1 w-4 h-4 bg-white rounded-full transition-transform ${settingAutoplay ? 'translate-x-5' : 'translate-x-1'}`} />
                    </div>
                  </div>
                </div>
              </div>
              <div className="bg-[#282828] rounded-lg p-6">
                <h3 className="text-white text-xl font-bold mb-4">Privacy</h3>
                <div className="space-y-4">
                  <div className="flex items-center justify-between cursor-pointer" onClick={() => setSettingPrivateSession(!settingPrivateSession)}>
                    <span className="text-white text-sm">Private session</span>
                    <div className={`w-10 h-6 rounded-full relative transition-colors ${settingPrivateSession ? 'bg-[#1DB954]' : 'bg-[#727272]'}`}>
                      <div className={`absolute top-1 w-4 h-4 bg-white rounded-full transition-transform ${settingPrivateSession ? 'translate-x-5' : 'translate-x-1'}`} />
                    </div>
                  </div>
                  <div className="flex items-center justify-between cursor-pointer" onClick={() => setSettingListeningActivity(!settingListeningActivity)}>
                    <span className="text-white text-sm">Show my listening activity</span>
                    <div className={`w-10 h-6 rounded-full relative transition-colors ${settingListeningActivity ? 'bg-[#1DB954]' : 'bg-[#727272]'}`}>
                      <div className={`absolute top-1 w-4 h-4 bg-white rounded-full transition-transform ${settingListeningActivity ? 'translate-x-5' : 'translate-x-1'}`} />
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Edit Profile Modal */}
      {showEditProfileModal && (
        <div
          className="fixed inset-0 bg-black bg-opacity-75 flex items-center justify-center z-50 p-4"
          onClick={() => setShowEditProfileModal(false)}
        >
          <div
            className="bg-[#282828] rounded-lg p-8 max-w-md w-full"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-white text-2xl font-bold">Edit Profile</h2>
              <button
                onClick={() => setShowEditProfileModal(false)}
                className="text-[#b3b3b3] hover:text-white"
              >
                <svg width="24" height="24" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z" />
                </svg>
              </button>
            </div>
            <form
              onSubmit={(e) => {
                e.preventDefault();
                const formData = new FormData(e.currentTarget);
                const newName = formData.get('username') as string;
                const newEmail = formData.get('email') as string;
                handleUpdateProfile(newName, newEmail);
                setShowEditProfileModal(false);
              }}
            >
              <div className="mb-4">
                <label className="text-white text-sm font-semibold mb-2 block">Username</label>
                <input
                  type="text"
                  name="username"
                  defaultValue={displayName}
                  className="w-full bg-[#121212] text-white px-4 py-3 rounded border border-[#727272] outline-none focus:border-white transition"
                  placeholder="Enter your username"
                  required
                />
              </div>
              <div className="mb-6">
                <label className="text-white text-sm font-semibold mb-2 block">Email</label>
                <input
                  type="email"
                  name="email"
                  defaultValue={email}
                  className="w-full bg-[#121212] text-white px-4 py-3 rounded border border-[#727272] outline-none focus:border-white transition"
                  placeholder="Enter your email"
                  required
                />
              </div>
              <div className="flex gap-4">
                <button
                  type="button"
                  onClick={() => setShowEditProfileModal(false)}
                  className="flex-1 bg-transparent border border-[#b3b3b3] text-white font-bold py-3 rounded-full hover:border-white transition"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="flex-1 bg-[#1DB954] text-black font-bold py-3 rounded-full hover:scale-105 transition"
                >
                  Save Changes
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Song Menu Modal */}
      {showSongMenuModal && selectedMenuSongId !== null && (
        <div
          className="fixed inset-0 bg-black bg-opacity-75 flex items-center justify-center z-50 p-4"
          onClick={() => setShowSongMenuModal(false)}
        >
          <div
            className="bg-[#121212] rounded-lg p-6 max-w-sm w-full"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-white text-xl font-bold">Song Options</h2>
              <button
                onClick={() => setShowSongMenuModal(false)}
                className="text-[#b3b3b3] hover:text-white"
              >
                <svg width="24" height="24" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z" />
                </svg>
              </button>
            </div>
            <div className="space-y-2">
              <button
                onClick={() => {
                  handleToggleFavorite(selectedMenuSongId);
                  setShowSongMenuModal(false);
                }}
                className="w-full px-4 py-3 text-left hover:bg-[#282828] rounded transition text-white"
              >
                {favoriteSongs.includes(selectedMenuSongId) ? 'Remove from Liked Songs' : 'Add to Liked Songs'}
              </button>
              {userPlaylists.length > 0 && (
                <div className="border-t border-[#282828] pt-2">
                  <p className="text-[#b3b3b3] text-sm px-4 py-2">Add to Playlist</p>
                  {userPlaylists.map((playlist) => (
                    <button
                      key={playlist.id}
                      onClick={() => {
                        handleAddToPlaylist(playlist.id, selectedMenuSongId);
                        setShowSongMenuModal(false);
                      }}
                      className="w-full px-4 py-3 text-left hover:bg-[#282828] rounded transition text-white"
                    >
                      {playlist.name}
                    </button>
                  ))}
                </div>
              )}
              <button
                onClick={() => {
                  const song = songs.find(s => s.id === selectedMenuSongId);
                  if (song) {
                    navigator.clipboard.writeText(`https://microfy.com/track/${song.id}`).then(() => {
                      showToast('Link copied to clipboard');
                    }).catch(() => {
                      showToast('Link copied to clipboard');
                    });
                  }
                  setShowSongMenuModal(false);
                }}
                className="w-full px-4 py-3 text-left hover:bg-[#282828] rounded transition text-white"
              >
                Share Song
              </button>
              <button
                onClick={() => {
                  const song = songs.find(s => s.id === selectedMenuSongId);
                  if (song) {
                    const artistMatch = artists.find(a =>
                      song.artist.toLowerCase().includes(a.name.toLowerCase())
                    );
                    if (artistMatch) {
                      handleSelectArtist(artistMatch.id);
                    }
                  }
                  setShowSongMenuModal(false);
                }}
                className="w-full px-4 py-3 text-left hover:bg-[#282828] rounded transition text-white"
              >
                View Artist
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Toast Notification */}
      {toastMessage && (
        <div className="fixed bottom-24 left-1/2 -translate-x-1/2 z-[60] animate-fade-in">
          <div className="bg-[#2e77d0] text-white px-6 py-3 rounded-lg shadow-lg text-sm font-medium">
            {toastMessage}
          </div>
        </div>
      )}
    </div>
  );
};

export default MicroFy;
