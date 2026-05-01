import { useState, useEffect, useMemo, useCallback, useRef } from "react";

import { useHashRoute } from "../hooks/useHashRoute";
import { useMicrogramData, type ApiGramPost, type ApiGramUser, type ApiGramMessage } from "../hooks/useMicrogramData";
import {
  Home,
  Search,
  PlusSquare,
  Heart,
  User,
  MessageCircle,
  Bookmark,
  MoreHorizontal,
  Send,
  X,
  Settings,
  Camera,
  Grid3X3,
  Film,
  Compass,
  Copy,
  Flag,
  UserMinus,
  ArrowLeft,
  Check,
  BookmarkCheck,
  Loader2,
} from "lucide-react";

// ============================================================================
// LOCAL TYPE DEFINITIONS
// ============================================================================

/**
 * MicroGramUser flattens the API user object (which has nested social data)
 * into a convenient flat shape for the component.
 */
interface MicroGramUser {
  id: string;
  isSelf?: boolean;
  name: string;
  username: string;
  email: string;
  avatarUrl: string;
  bio: string;
  jobTitle: string;
  location: string;
  interests: string[];
  // Social profile fields
  followers: number;
  following: number;
  postsCount: number;
  isVerified?: boolean;
  isPrivate?: boolean;
  website?: string;
  hasStory?: boolean;
  storyId?: string;
}

// Alias for Post type
type Post = ApiGramPost;

export const TASK_ID_MICROGRAM = "microgram";

/**
 * UI CONSTANTS
 */
const STORY_DURATION_MS = 5000;

type NavSection = "home" | "explore" | "create" | "activity" | "profile" | "direct" | "search";

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

const formatNumber = (num: number): string => {
  if (num >= 1000000) return `${(num / 1000000).toFixed(1)}M`;
  if (num >= 1000) return `${(num / 1000).toFixed(1)}K`;
  return num.toString();
};

/**
 * Compute a relative timestamp string based on order and session start time.
 * Higher order items are newer, lower order items are older.
 * Each order step = 10 minutes in simulated time.
 * maxOrder is the highest order seen so far — that item is the most recent.
 */
const computeRelativeTimestamp = (order: number, sessionStartTime: number, maxOrder: number): string => {
  const simulatedMinutesAgo = (maxOrder - order) * 10;
  const realElapsedMs = Date.now() - sessionStartTime;
  const realElapsedMinutes = Math.floor(realElapsedMs / 60000);

  const totalMinutesAgo = simulatedMinutesAgo + realElapsedMinutes;

  if (totalMinutesAgo < 1) return "Just now";
  if (totalMinutesAgo < 60) return `${totalMinutesAgo}m`;
  if (totalMinutesAgo < 1440) return `${Math.floor(totalMinutesAgo / 60)}h`;
  if (totalMinutesAgo < 10080) return `${Math.floor(totalMinutesAgo / 1440)}d`;
  return `${Math.floor(totalMinutesAgo / 10080)}w`;
};

const formatTimeSince = (arrivedAt: number): string => {
  const minutes = Math.floor((Date.now() - arrivedAt) / 60000);
  if (minutes < 1) return "Just now";
  if (minutes < 60) return `${minutes}m`;
  if (minutes < 1440) return `${Math.floor(minutes / 60)}h`;
  if (minutes < 10080) return `${Math.floor(minutes / 1440)}d`;
  return `${Math.floor(minutes / 10080)}w`;
};

const getInitials = (name: string): string =>
  name.split(" ").map(n => n[0]).join("").toUpperCase().slice(0, 2);

const getAvatarColor = (id: string): string => {
  const colors = ["#e11d48", "#db2777", "#c026d3", "#9333ea", "#6366f1", "#3b82f6", "#0ea5e9", "#14b8a6", "#22c55e", "#f97316"];
  const index = id.charCodeAt(id.length - 1) % colors.length;
  return colors[index];
};

// ============================================================================
// MAIN COMPONENT
// ============================================================================

const MicroGram = () => {
  // ---------------------------------------------------------------------------
  // API Hook
  // ---------------------------------------------------------------------------
  const {
    posts,
    stories,
    messages: apiMessages,
    activity,
    followedUserIds,
    users,
    config,
    isLoading,
    error: apiError,
    likePost,
    savePost,
    commentOnPost,
    viewStory: apiViewStory,
    followUser,
    readConversation: apiReadConversation,
  } = useMicrogramData();

  // ---------------------------------------------------------------------------
  // Derived user helpers
  // ---------------------------------------------------------------------------

  /** Convert a raw API user object into MicroGramUser shape */
  const toMicroGramUser = useCallback((u: ApiGramUser): MicroGramUser => {
    const social = u.microgram || {};
    return {
      id: u.id,
      isSelf: u.isSelf,
      name: u.name,
      username: u.username,
      email: u.email ?? "",
      avatarUrl: u.avatarUrl,
      bio: u.bio || "",
      jobTitle: u.jobTitle || "",
      location: u.location || "",
      interests: u.interests || [],
      followers: social.followers ?? 0,
      following: social.following ?? 0,
      postsCount: social.postsCount ?? 0,
      isVerified: social.isVerified,
      isPrivate: social.isPrivate,
      website: social.website,
      hasStory: social.hasStory,
      storyId: social.storyId,
    };
  }, []);

  const getUserById = useCallback((id: string): MicroGramUser | undefined => {
    const raw = users[id];
    if (!raw) return undefined;
    return toMicroGramUser(raw);
  }, [users, toMicroGramUser]);

  const selfUser = useMemo(() => {
    const selfId = config?.selfUser?.id;
    const resolved = (selfId ? users[selfId] : undefined) ?? Object.values(users).find((u) => u.isSelf);
    return resolved ? toMicroGramUser(resolved) : undefined;
  }, [config?.selfUser?.id, users, toMicroGramUser]);

  const MICROGRAM_USERS = useMemo(() =>
    Object.values(users)
      .filter(u => u.microgram)
      .map(u => toMicroGramUser(u)),
    [users, toMicroGramUser]
  );

  const getPostsByAuthor = useCallback((authorId: string): Post[] =>
    posts.filter(p => p.authorId === authorId),
    [posts]
  );

  /**
   * Get image URL for a post or story.
   */
  const getImageUrl = useCallback((id: string): string => {
    const post = posts.find(p => p.id === id);
    if (post?.imageUrl) return post.imageUrl;
    const story = stories.find(s => s.id === id);
    if (story?.mediaUrl) return story.mediaUrl;
    return '';
  }, [posts, stories]);

  const getPlaceholderImageUrl = getImageUrl;

  // Explore tiles derived from non-target posts
  const EXPLORE_TILES = useMemo(() =>
    posts
      .filter(p => !p.isTargetPost)
      .map((post, idx) => ({
        id: `explore-${idx}`,
        postId: post.id,
        imageUrl: post.imageUrl,
        isVideo: false,
        isCarousel: false,
      })),
    [posts]
  );

  // ---------------------------------------------------------------------------
  // Session start time (for relative timestamps)
  // ---------------------------------------------------------------------------
  const [startTime] = useState(Date.now());

  // ---------------------------------------------------------------------------
  // UI State Variables (all local)
  // ---------------------------------------------------------------------------

  // Sign-out lock screen
  const [isSignedOut, setIsSignedOut] = useState(false);

  // Navigation
  const [route, setRoute] = useHashRoute<NavSection>(["home", "explore", "create", "activity", "profile", "direct", "search"] as const, "home");
  const navSection = route.view;
  const selectedProfile = navSection === "profile" ? route.id : null;
  const [selectedPost, setSelectedPost] = useState<string | null>(null);
  const [selectedDM, setSelectedDM] = useState<string | null>(null);
  const [currentStoryIndex, setCurrentStoryIndex] = useState<number | null>(null);

  // Additional UI state
  const [showProfileMenu, setShowProfileMenu] = useState(false);
  const [showPostModal, setShowPostModal] = useState(false);
  const [commentText, setCommentText] = useState("");
  const [searchQuery, setSearchQuery] = useState("");

  // Feed pagination
  const [visiblePostsCount, setVisiblePostsCount] = useState(10);
  const [isLoadingMorePosts, setIsLoadingMorePosts] = useState(false);

  // Share functionality
  const [sharePostId, setSharePostId] = useState<string | null>(null);
  const [shareRecipientId, setShareRecipientId] = useState<string | null>(null);
  const [shareNote, setShareNote] = useState("");
  const [shareSent, setShareSent] = useState(false);

  // Edit profile
  const [showEditProfile, setShowEditProfile] = useState(false);
  const [profileEditDraft, setProfileEditDraft] = useState({ displayName: "", bio: "" });
  const [profileDisplayName, setProfileDisplayName] = useState(selfUser?.name || "");
  const [profileBio, setProfileBio] = useState(selfUser?.bio || "");

  // Followers/Following modals
  const [showFollowersModal, setShowFollowersModal] = useState(false);
  const [showFollowingModal, setShowFollowingModal] = useState(false);
  const [followersModalUserId, setFollowersModalUserId] = useState<string | null>(null);

  // Post options menu
  const [showPostOptions, setShowPostOptions] = useState(false);
  const [postOptionsPostId, setPostOptionsPostId] = useState<string | null>(null);

  // New DM modal
  const [showNewDMModal, setShowNewDMModal] = useState(false);

  // Locally-started conversations (created via the "New message" modal)
  const [localConversations, setLocalConversations] = useState<ApiGramMessage[]>([]);

  // Profile tabs
  const [profileTab, setProfileTab] = useState<"posts" | "reels" | "saved">("posts");

  // Activity notification badge
  const baselineActivityCountRef = useRef<number | null>(null);
  const [lastSeenActivityCount, setLastSeenActivityCount] = useState<number | null>(null);

  // DM conversation messages (user replies - local only)
  const [dmReplies, setDmReplies] = useState<Record<string, { id: string; text: string; fromSelf: boolean; sharedPostId?: string; timestamp: number }[]>>({});
  const [dmDraft, setDmDraft] = useState("");
  // Comment reply state
  const [replyToComment, setReplyToComment] = useState<{ id: string; authorUsername: string } | null>(null);

  // Local user comments for immediate display (also sent to API)
  const [userComments, setUserComments] = useState<{ postId: string; text: string; id: string; replyToId?: string; replyToUsername?: string }[]>([]);

  // Toast notifications
  const [toast, setToast] = useState<{ message: string; type: "info" | "success" | "error" } | null>(null);

  const storyTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);


  // Update profile display name / bio if selfUser loads after initial render
  useEffect(() => {
    if (selfUser && !profileDisplayName) {
      setProfileDisplayName(selfUser.name);
    }
    if (selfUser && !profileBio) {
      setProfileBio(selfUser.bio);
    }
  }, [selfUser, profileDisplayName, profileBio]);

  // ---------------------------------------------------------------------------
  // Story auto-advance
  // ---------------------------------------------------------------------------
  const activeStories = useMemo(() =>
    stories.slice().sort((a, b) => {
      const aViewed = a.isViewed ? 1 : 0;
      const bViewed = b.isViewed ? 1 : 0;
      if (aViewed !== bViewed) return aViewed - bViewed;
      return (b.order || 0) - (a.order || 0);
    }),
    [stories]
  );

  useEffect(() => {
    if (currentStoryIndex === null) return;

    storyTimerRef.current = setTimeout(() => {
      if (currentStoryIndex < activeStories.length - 1) {
        const nextIndex = currentStoryIndex + 1;
        setCurrentStoryIndex(nextIndex);
        const nextStory = activeStories[nextIndex];
        if (nextStory && !nextStory.isViewed) {
          apiViewStory(nextStory.id);
        }
      } else {
        setCurrentStoryIndex(null);
      }
    }, STORY_DURATION_MS);

    return () => {
      if (storyTimerRef.current) clearTimeout(storyTimerRef.current);
    };
  }, [currentStoryIndex, activeStories, apiViewStory]);


  // ---------------------------------------------------------------------------
  // Handlers
  // ---------------------------------------------------------------------------

  const handleLikePost = useCallback((postId: string) => {
    likePost(postId);
  }, [likePost]);

  const handleSavePost = useCallback((postId: string) => {
    savePost(postId);
  }, [savePost]);

  const handleFollow = useCallback((userId: string) => {
    followUser(userId);
  }, [followUser]);

  const handleViewStory = useCallback((storyIndex: number) => {
    const story = activeStories[storyIndex];
    if (story && !story.isViewed) {
      apiViewStory(story.id);
    }
    setCurrentStoryIndex(storyIndex);
  }, [activeStories, apiViewStory]);

  const handleAddComment = useCallback((postId: string) => {
    if (!commentText.trim()) return;
    const newComment: { id: string; postId: string; text: string; replyToId?: string; replyToUsername?: string } = {
      id: `comment-${Date.now()}`,
      postId,
      text: commentText.trim(),
    };
    if (replyToComment) {
      newComment.replyToId = replyToComment.id;
      newComment.replyToUsername = replyToComment.authorUsername;
    }
    // Update local state for immediate display
    setUserComments(prev => [...prev, newComment]);
    // Send to API
    commentOnPost(postId, commentText.trim());
    setCommentText("");
    setReplyToComment(null);
  }, [commentText, replyToComment, commentOnPost]);

  const navigateToProfile = useCallback((userId: string) => {
    setRoute("profile", userId);
    setProfileTab("posts");
  }, [setRoute]);

  const openPostModal = useCallback((postId: string) => {
    setSelectedPost(postId);
    setShowPostModal(true);
  }, []);

  // Toast helper
  const showToast = useCallback((message: string, type: "info" | "success" | "error" = "info") => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 3000);
  }, []);

  // Share handlers
  const handleShareOpen = useCallback((postId: string) => {
    setSharePostId(postId);
    setShareRecipientId(apiMessages[0]?.id || null);
    setShareNote("");
    setShareSent(false);
  }, [apiMessages]);

  const handleShareClose = useCallback(() => {
    setSharePostId(null);
    setShareRecipientId(null);
    setShareNote("");
    setShareSent(false);
  }, []);

  const handleShareSend = useCallback(() => {
    if (!shareRecipientId || !sharePostId) return;
    setShareSent(true);

    const now = Date.now();
    setDmReplies(prev => ({
      ...prev,
      [shareRecipientId]: [
        ...(prev[shareRecipientId] || []),
        {
          id: `share-${now}`,
          text: shareNote,
          fromSelf: true,
          sharedPostId: sharePostId,
          timestamp: now,
        },
      ],
    }));

    setTimeout(() => {
      handleShareClose();
      showToast("Message sent!", "success");
    }, 800);
  }, [shareRecipientId, sharePostId, shareNote, handleShareClose, showToast]);

  // Post options handlers
  const handlePostOptionsOpen = useCallback((postId: string) => {
    setPostOptionsPostId(postId);
    setShowPostOptions(true);
  }, []);

  const handlePostOptionsClose = useCallback(() => {
    setShowPostOptions(false);
    setPostOptionsPostId(null);
  }, []);

  const handleCopyLink = useCallback(() => {
    navigator.clipboard.writeText(`https://microgram.app/p/${postOptionsPostId}`);
    showToast("Link copied to clipboard", "success");
    handlePostOptionsClose();
  }, [postOptionsPostId, showToast, handlePostOptionsClose]);

  const handleReportPost = useCallback(() => {
    showToast("Thanks for letting us know. We'll review this post.", "info");
    handlePostOptionsClose();
  }, [showToast, handlePostOptionsClose]);

  const handleUnfollowFromPost = useCallback(() => {
    if (postOptionsPostId) {
      const post = posts.find(p => p.id === postOptionsPostId);
      if (post) {
        followUser(post.authorId);
        showToast(`Unfollowed @${getUserById(post.authorId)?.username}`, "info");
      }
    }
    handlePostOptionsClose();
  }, [postOptionsPostId, posts, followUser, getUserById, showToast, handlePostOptionsClose]);

  const handleEditProfileOpen = useCallback(() => {
    setProfileEditDraft({
      displayName: profileDisplayName || selfUser?.name || "",
      bio: profileBio || selfUser?.bio || "",
    });
    setShowEditProfile(true);
  }, [profileDisplayName, profileBio, selfUser]);

  const handleEditProfileSave = useCallback(() => {
    setProfileDisplayName(profileEditDraft.displayName);
    setProfileBio(profileEditDraft.bio);
    setShowEditProfile(false);
    showToast("Profile updated", "success");
  }, [profileEditDraft, showToast]);

  const handleFollowersOpen = useCallback((userId: string) => {
    setFollowersModalUserId(userId);
    setShowFollowersModal(true);
  }, []);

  const handleFollowingOpen = useCallback((userId: string) => {
    setFollowersModalUserId(userId);
    setShowFollowingModal(true);
  }, []);

  const handleSendDM = useCallback(() => {
    if (!selectedDM || !dmDraft.trim()) return;
    const now = Date.now();
    setDmReplies(prev => ({
      ...prev,
      [selectedDM]: [
        ...(prev[selectedDM] || []),
        {
          id: `dm-${now}`,
          text: dmDraft.trim(),
          fromSelf: true,
          timestamp: now,
        },
      ],
    }));
    setDmDraft("");
  }, [selectedDM, dmDraft]);

  const handleOpenDM = useCallback((dmId: string) => {
    setSelectedDM(dmId);
    apiReadConversation(dmId);
  }, [apiReadConversation]);

  const handleStartConversation = useCallback((userId: string) => {
    const selfId = config?.selfUser?.id || "user000";
    const existing = [...apiMessages, ...localConversations].find(dm =>
      dm.participantIds.includes(userId) && dm.participantIds.includes(selfId)
    );
    if (existing) {
      setSelectedDM(existing.id);
      return;
    }
    const target = users[userId];
    const newConversation: ApiGramMessage = {
      id: `local-dm-${userId}-${Date.now()}`,
      participantIds: [selfId, userId],
      participants: target ? [{ id: userId, name: target.name, avatarUrl: target.avatarUrl }] : [],
      lastMessage: "",
      unreadCount: 0,
      messages: [],
      order: Number.MAX_SAFE_INTEGER,
    };
    setLocalConversations(prev => [...prev, newConversation]);
    setSelectedDM(newConversation.id);
  }, [apiMessages, localConversations, users, config?.selfUser?.id]);

  // ---------------------------------------------------------------------------
  // Derived Values
  // ---------------------------------------------------------------------------

  const feedPosts = useMemo(() =>
    posts.slice().sort((a, b) => b.order - a.order),
    [posts]
  );

  const maxOrder = useMemo(() => {
    let max = 0;
    for (const p of posts) max = Math.max(max, p.order);
    for (const s of stories) max = Math.max(max, s.order);
    for (const a of activity) max = Math.max(max, a.order);
    return max;
  }, [posts, stories, activity]);

  // Capture baseline activity count on first load
  useEffect(() => {
    if (activity.length > 0 && baselineActivityCountRef.current === null) {
      baselineActivityCountRef.current = activity.length;
      setLastSeenActivityCount(activity.length);
    }
  }, [activity]);

  const hasNewActivity = lastSeenActivityCount !== null && activity.length > lastSeenActivityCount;

  // Merge server-backed conversations with locally-started ones for display.
  const allConversations = useMemo<ApiGramMessage[]>(
    () => [...apiMessages, ...localConversations],
    [apiMessages, localConversations]
  );

  const searchResults = useMemo(() => {
    if (!searchQuery.trim()) return [];
    const query = searchQuery.toLowerCase();
    return MICROGRAM_USERS.filter(u =>
      u.username.toLowerCase().includes(query) ||
      u.name.toLowerCase().includes(query)
    );
  }, [searchQuery, MICROGRAM_USERS]);

  // ---------------------------------------------------------------------------
  // Loading state
  // ---------------------------------------------------------------------------

  if (!config || isLoading) {
    const isNetworkError = apiError && /failed to fetch|networkerror/i.test(apiError);
    const isNoSession = apiError && /409/.test(apiError);
    const isMismatch = apiError && /environment mismatch/i.test(apiError);
    return (
      <div className="flex items-center justify-center h-screen bg-gray-50">
        <div className="text-center max-w-md px-6">
          <div className="text-4xl mb-3">📸</div>
          <h1 className="text-xl font-semibold mb-6 text-gray-900">MicroGram</h1>
          {!apiError ? (
            <>
              <div className="w-8 h-8 border-2 border-pink-500 border-t-transparent rounded-full animate-spin mx-auto mb-4" />
              <p className="text-sm text-gray-500">Connecting to MicroGram...</p>
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
              <p className="text-sm text-gray-500">Navigate to the correct environment from the desktop, or re-init with a MicroGram scenario.</p>
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

  // ---------------------------------------------------------------------------
  // Render Components
  // ---------------------------------------------------------------------------

  const renderAvatar = (user: MicroGramUser | undefined, size: "sm" | "md" | "lg" = "md", hasStory = false, isViewed = false) => {
    const sizeClasses = {
      sm: "w-8 h-8",
      md: "w-10 h-10",
      lg: "w-14 h-14",
    };
    const ringClasses = hasStory
      ? isViewed
        ? "ring-2 ring-gray-300"
        : "ring-2 ring-gradient-to-tr from-yellow-400 via-pink-500 to-purple-600"
      : "";

    if (!user) return null;

    return (
      <div className={`${sizeClasses[size]} rounded-full ${ringClasses} p-0.5 bg-gradient-to-tr ${hasStory && !isViewed ? 'from-yellow-400 via-pink-500 to-purple-600' : 'from-transparent to-transparent'}`}>
        <div className={`${sizeClasses[size]} rounded-full bg-white p-0.5`}>
          <img
            src={user.avatarUrl}
            alt={user.name}
            className={`${sizeClasses[size]} rounded-full object-cover`}
          />
        </div>
      </div>
    );
  };

  const renderStoryBar = () => (
    <div className="bg-white border-b border-gray-200 px-4 py-3 overflow-x-auto">
      <div className="flex gap-4">
        {activeStories.map((story, idx) => {
          const user = getUserById(story.authorId);
          const isViewed = story.isViewed;
          return (
            <button
              key={story.id}
              onClick={() => handleViewStory(idx)}
              className="flex flex-col items-center gap-1 flex-shrink-0"
            >
              {renderAvatar(user, "lg", true, isViewed)}
              <span className="text-xs text-gray-600 w-16 truncate text-center">
                {user?.isSelf ? "Your story" : user?.username}
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );

  const renderPost = (post: Post) => {
    const author = getUserById(post.authorId);
    const isLiked = post.isLiked;
    const isSaved = post.isSaved;

    return (
      <article key={post.id} className="bg-white border border-gray-200 mb-4">
        {/* Header */}
        <div className="flex items-center justify-between p-3">
          <button
            onClick={() => navigateToProfile(post.authorId)}
            className="flex items-center gap-3"
          >
            {renderAvatar(author, "md")}
            <div className="text-left">
              <p className="font-semibold text-sm">{author?.username}</p>
              {post.location && <p className="text-xs text-gray-500">{post.location}</p>}
            </div>
          </button>
          <button
            onClick={() => handlePostOptionsOpen(post.id)}
            className="p-2 hover:bg-gray-100 rounded-full"
          >
            <MoreHorizontal size={20} />
          </button>
        </div>

        {/* Image */}
        <div
          className="aspect-square bg-gray-100 flex items-center justify-center cursor-pointer overflow-hidden"
          onDoubleClick={() => handleLikePost(post.id)}
          onClick={() => openPostModal(post.id)}
        >
          <img
            src={getPlaceholderImageUrl(post.id)}
            alt={post.caption?.slice(0, 50) || "Post image"}
            className="w-full h-full object-cover"
            loading="lazy"
          />
        </div>

        {/* Actions */}
        <div className="p-3">
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-4">
              <button onClick={() => handleLikePost(post.id)}>
                <Heart
                  size={24}
                  className={isLiked ? "fill-red-500 text-red-500" : "text-gray-700"}
                />
              </button>
              <button onClick={() => openPostModal(post.id)}>
                <MessageCircle size={24} className="text-gray-700" />
              </button>
              <button onClick={() => handleShareOpen(post.id)}>
                <Send size={24} className="text-gray-700" />
              </button>
            </div>
            <button onClick={() => handleSavePost(post.id)}>
              <Bookmark
                size={24}
                className={isSaved ? "fill-gray-900 text-gray-900" : "text-gray-700"}
              />
            </button>
          </div>

          <p className="font-semibold text-sm mb-1">
            {formatNumber(post.likes + (isLiked ? 1 : 0))} likes
          </p>
          <p className="text-sm">
            <span className="font-semibold">{author?.username}</span>{" "}
            {post.caption}
          </p>
          {post.comments.length > 0 && (
            <button
              onClick={() => openPostModal(post.id)}
              className="text-gray-500 text-sm mt-1"
            >
              View all {post.comments.length} comments
            </button>
          )}
          <p className="text-xs text-gray-400 mt-1 uppercase">{computeRelativeTimestamp(post.order, startTime, maxOrder)}</p>
        </div>
      </article>
    );
  };

  const handleLoadMorePosts = () => {
    setIsLoadingMorePosts(true);
    setTimeout(() => {
      setVisiblePostsCount(prev => prev + 10);
      setIsLoadingMorePosts(false);
    }, 1000);
  };

  const renderFeed = () => {
    const visiblePosts = feedPosts.slice(0, visiblePostsCount);
    const hasMorePosts = visiblePostsCount < feedPosts.length;

    return (
      <div className="max-w-2xl mx-auto">
        {renderStoryBar()}
        <div className="p-0">
          {visiblePosts.map(post => renderPost(post))}
        </div>
        {/* Load more section */}
        {hasMorePosts && (
          <div className="flex justify-center py-8">
            {isLoadingMorePosts ? (
              <Loader2 className="w-8 h-8 text-gray-400 animate-spin" />
            ) : (
              <button
                onClick={handleLoadMorePosts}
                className="text-blue-500 font-semibold text-sm hover:text-blue-600"
              >
                Load more posts
              </button>
            )}
          </div>
        )}
        {/* End of feed indicator */}
        {!hasMorePosts && feedPosts.length > 0 && (
          <div className="flex flex-col items-center py-8 text-gray-400">
            <Check className="w-12 h-12 mb-2 p-2 border-2 border-gray-300 rounded-full" />
            <p className="text-sm">You're all caught up</p>
          </div>
        )}
      </div>
    );
  };

  const renderExplore = () => (
    <div className="max-w-4xl mx-auto p-4">
      <div className="mb-4">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" size={20} />
          <input
            type="text"
            placeholder="Search"
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            className="w-full pl-10 pr-4 py-2 bg-gray-100 rounded-lg focus:outline-none focus:ring-2 focus:ring-gray-300"
          />
        </div>
      </div>
      <div className="grid grid-cols-3 gap-1">
        {EXPLORE_TILES
          .filter(tile => {
            if (!searchQuery.trim()) return true;
            const post = posts.find(p => p.id === tile.postId);
            if (!post) return false;
            const query = searchQuery.toLowerCase();
            return (
              post.caption?.toLowerCase().includes(query) ||
              post.location?.toLowerCase().includes(query) ||
              getUserById(post.authorId)?.username?.toLowerCase().includes(query)
            );
          })
          .map(tile => (
          <button
            key={tile.id}
            onClick={() => openPostModal(tile.postId)}
            className="aspect-square bg-gray-200 hover:opacity-80 transition-opacity overflow-hidden"
          >
            <img
              src={getPlaceholderImageUrl(tile.postId)}
              alt="Explore tile"
              className="w-full h-full object-cover"
              loading="lazy"
            />
          </button>
        ))}
      </div>
    </div>
  );

  const renderActivity = () => (
    <div className="max-w-lg mx-auto p-4">
      <h2 className="font-semibold text-xl mb-4">Activity</h2>
      <div className="space-y-4">
        {activity.slice().sort((a, b) => b.order - a.order).map(entry => {
          const actor = getUserById(entry.actorId);
          return (
            <div key={entry.id} className="flex items-center gap-3">
              <button onClick={() => navigateToProfile(entry.actorId)}>
                {renderAvatar(actor, "md")}
              </button>
              <div className="flex-1">
                <p className="text-sm">
                  <span className="font-semibold">{actor?.username}</span>{" "}
                  {entry.type === "like" && "liked your photo."}
                  {entry.type === "follow" && "started following you."}
                  {entry.type === "comment" && `commented: "${entry.text}"`}
                  {entry.type === "mention" && entry.text}
                  <span className="text-gray-500 ml-1">{entry._arrivedAt ? formatTimeSince(entry._arrivedAt) : computeRelativeTimestamp(entry.order, startTime, maxOrder)}</span>
                </p>
              </div>
              {entry.type === "follow" && !followedUserIds.includes(entry.actorId) && (
                <button
                  onClick={() => handleFollow(entry.actorId)}
                  className="px-4 py-1.5 bg-blue-500 text-white rounded-lg text-sm font-semibold"
                >
                  Follow
                </button>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );

  const renderProfile = (userId: string | null) => {
    const user = userId ? getUserById(userId) : selfUser;
    if (!user) return null;

    const userPosts = getPostsByAuthor(user.id);
    const userSavedPosts = posts.filter(p => p.isSaved);
    const isFollowing = followedUserIds.includes(user.id);
    const isSelf = user.isSelf;
    const displayName = isSelf && profileDisplayName ? profileDisplayName : user.name;
    const displayBio = isSelf && profileBio ? profileBio : user.bio;

    return (
      <div className="max-w-4xl mx-auto p-4">
        {/* Profile Header */}
        <div className="flex items-start gap-8 mb-8">
          <div className="flex-shrink-0">
            <img
              src={user.avatarUrl}
              alt={displayName}
              className="w-20 h-20 md:w-36 md:h-36 rounded-full object-cover"
            />
          </div>
          <div className="flex-1">
            <div className="flex items-center gap-4 mb-4">
              <h1 className="text-xl font-light">{user.username}</h1>
              {isSelf ? (
                <button
                  onClick={handleEditProfileOpen}
                  className="px-4 py-1.5 border border-gray-300 rounded-lg text-sm font-semibold hover:bg-gray-50"
                >
                  Edit profile
                </button>
              ) : (
                <button
                  onClick={() => handleFollow(user.id)}
                  className={`px-6 py-1.5 rounded-lg text-sm font-semibold ${
                    isFollowing
                      ? "border border-gray-300 bg-white hover:bg-gray-50"
                      : "bg-blue-500 text-white hover:bg-blue-600"
                  }`}
                >
                  {isFollowing ? "Following" : "Follow"}
                </button>
              )}
              {isSelf && (
                <button onClick={() => setShowProfileMenu(!showProfileMenu)} className="p-2 hover:bg-gray-100 rounded-full">
                  <Settings size={24} />
                </button>
              )}
            </div>
            <div className="flex gap-8 mb-4">
              <span><strong>{userPosts.length || user.postsCount}</strong> posts</span>
              <button onClick={() => handleFollowersOpen(user.id)} className="hover:underline">
                <strong>{formatNumber(user.followers)}</strong> followers
              </button>
              <button onClick={() => handleFollowingOpen(user.id)} className="hover:underline">
                <strong>{user.following + (isSelf ? followedUserIds.length : 0)}</strong> following
              </button>
            </div>
            <div>
              <p className="font-semibold">{displayName}</p>
              <p className="text-sm text-gray-600">{displayBio}</p>
              {user.website && (
                <a href="#" className="text-sm text-blue-900 font-semibold">{user.website}</a>
              )}
            </div>
          </div>
        </div>

        {/* Tabs */}
        <div className="border-t border-gray-200">
          <div className="flex justify-center gap-12">
            <button
              onClick={() => setProfileTab("posts")}
              className={`flex items-center gap-1 py-4 border-t-2 ${profileTab === "posts" ? "border-gray-900" : "border-transparent text-gray-400"}`}
            >
              <Grid3X3 size={12} />
              <span className="text-xs font-semibold uppercase">Posts</span>
            </button>
            <button
              onClick={() => setProfileTab("reels")}
              className={`flex items-center gap-1 py-4 border-t-2 ${profileTab === "reels" ? "border-gray-900" : "border-transparent text-gray-400"}`}
            >
              <Film size={12} />
              <span className="text-xs font-semibold uppercase">Reels</span>
            </button>
            {isSelf && (
              <button
                onClick={() => setProfileTab("saved")}
                className={`flex items-center gap-1 py-4 border-t-2 ${profileTab === "saved" ? "border-gray-900" : "border-transparent text-gray-400"}`}
              >
                <Bookmark size={12} />
                <span className="text-xs font-semibold uppercase">Saved</span>
              </button>
            )}
          </div>
        </div>

        {/* Posts Grid */}
        {profileTab === "posts" && (
          <div className="grid grid-cols-3 gap-1">
            {userPosts.length > 0 ? userPosts.map(post => (
              <button
                key={post.id}
                onClick={() => openPostModal(post.id)}
                className="aspect-square bg-gray-200 hover:opacity-80 transition-opacity overflow-hidden"
              >
                <img
                  src={getPlaceholderImageUrl(post.id)}
                  alt="Post"
                  className="w-full h-full object-cover"
                  loading="lazy"
                />
              </button>
            )) : (
              <div className="col-span-3 py-16 text-center text-gray-500">
                <Camera size={48} className="mx-auto mb-4 text-gray-300" />
                <p className="font-semibold">No Posts Yet</p>
              </div>
            )}
          </div>
        )}

        {/* Reels (placeholder) */}
        {profileTab === "reels" && (
          <div className="py-16 text-center text-gray-500">
            <Film size={48} className="mx-auto mb-4 text-gray-300" />
            <p className="font-semibold">No Reels Yet</p>
            <p className="text-sm mt-1">When reels are shared, they'll appear here.</p>
          </div>
        )}

        {/* Saved */}
        {profileTab === "saved" && isSelf && (
          <div className="grid grid-cols-3 gap-1">
            {userSavedPosts.length > 0 ? userSavedPosts.map(post => (
              <button
                key={post.id}
                onClick={() => openPostModal(post.id)}
                className="aspect-square bg-gray-200 hover:opacity-80 transition-opacity overflow-hidden relative"
              >
                <img
                  src={getPlaceholderImageUrl(post.id)}
                  alt="Saved post"
                  className="w-full h-full object-cover"
                  loading="lazy"
                />
                <BookmarkCheck size={16} className="absolute top-2 right-2 text-white drop-shadow" />
              </button>
            )) : (
              <div className="col-span-3 py-16 text-center text-gray-500">
                <Bookmark size={48} className="mx-auto mb-4 text-gray-300" />
                <p className="font-semibold">No Saved Posts</p>
                <p className="text-sm mt-1">Save photos and videos that you want to see again.</p>
              </div>
            )}
          </div>
        )}

        {/* Profile Menu */}
        {showProfileMenu && isSelf && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50" onClick={() => setShowProfileMenu(false)}>
            <div className="bg-white rounded-xl w-80 overflow-hidden" onClick={e => e.stopPropagation()}>
              <button onClick={() => { setShowProfileMenu(false); setProfileTab("saved"); }} className="w-full py-3 border-b hover:bg-gray-50 text-sm flex items-center justify-center gap-2">
                <Bookmark size={16} /> Saved
              </button>
              <button
                onClick={() => setIsSignedOut(true)}
                className="w-full py-3 border-b hover:bg-gray-50 text-sm text-red-500 font-semibold"
              >
                Log out
              </button>
              <button
                onClick={() => setShowProfileMenu(false)}
                className="w-full py-3 hover:bg-gray-50 text-sm"
              >
                Cancel
              </button>
            </div>
          </div>
        )}
      </div>
    );
  };

  const renderDirect = () => {
    // If a DM is selected, show the conversation view
    if (selectedDM) {
      const dm = allConversations.find(d => d.id === selectedDM);
      if (!dm) return null;

      const otherUserId = dm.participantIds.find(id => id !== "user000");
      const otherUser = otherUserId ? getUserById(otherUserId) : undefined;
      const userReplies = dmReplies[selectedDM] || [];

      return (
        <div className="max-w-lg mx-auto h-[calc(100vh-120px)] flex flex-col">
          {/* Header */}
          <div className="p-4 border-b flex items-center gap-3">
            <button onClick={() => setSelectedDM(null)} className="p-1 hover:bg-gray-100 rounded-full">
              <ArrowLeft size={24} />
            </button>
            <button onClick={() => otherUserId && navigateToProfile(otherUserId)} className="flex items-center gap-3">
              {renderAvatar(otherUser, "md")}
              <div className="text-left">
                <p className="font-semibold text-sm">{otherUser?.name}</p>
                <p className="text-xs text-gray-500">{otherUser?.username}</p>
              </div>
            </button>
          </div>

          {/* Messages */}
          <div className="flex-1 overflow-y-auto p-4 space-y-4">
            {dm.messages.map(msg => {
              const isFromSelf = msg.senderId === "user000";
              return (
                <div key={msg.id} className={`flex ${isFromSelf ? "justify-end" : "justify-start"}`}>
                  <div className={`max-w-[70%] px-4 py-2 rounded-2xl ${isFromSelf ? "bg-blue-500 text-white" : "bg-gray-200 text-gray-900"}`}>
                    <p className="text-sm">{msg.text}</p>
                  </div>
                </div>
              );
            })}
            {/* User replies */}
            {userReplies.map(reply => {
              // Check if this is a shared post
              if (reply.sharedPostId) {
                const sharedPost = posts.find(p => p.id === reply.sharedPostId);
                const postAuthor = sharedPost ? getUserById(sharedPost.authorId) : undefined;

                return (
                  <div key={reply.id} className={`flex ${reply.fromSelf ? "justify-end" : "justify-start"}`}>
                    <div className="max-w-[70%]">
                      {/* Optional message above the post card */}
                      {reply.text && (
                        <div className={`px-4 py-2 rounded-2xl mb-1 ${reply.fromSelf ? "bg-blue-500 text-white" : "bg-gray-200 text-gray-900"}`}>
                          <p className="text-sm">{reply.text}</p>
                        </div>
                      )}
                      {/* Shared post card */}
                      <button
                        onClick={() => sharedPost && openPostModal(sharedPost.id)}
                        className="w-full bg-white border border-gray-200 rounded-2xl overflow-hidden text-left hover:bg-gray-50 transition-colors"
                      >
                        {/* Post image preview */}
                        <div className="aspect-square bg-gradient-to-br from-gray-100 to-gray-200 overflow-hidden">
                          <img
                            src={sharedPost ? getPlaceholderImageUrl(sharedPost.id) : ''}
                            alt="Shared post"
                            className="w-full h-full object-cover"
                            loading="lazy"
                          />
                        </div>
                        {/* Post info footer */}
                        <div className="p-3 border-t border-gray-100">
                          <div className="flex items-center gap-2">
                            {postAuthor && (
                              <div
                                className="w-6 h-6 rounded-full flex items-center justify-center text-white text-xs font-semibold"
                                style={{ backgroundColor: getAvatarColor(postAuthor.id) }}
                              >
                                {getInitials(postAuthor.name)}
                              </div>
                            )}
                            <span className="text-sm font-semibold text-gray-900">{postAuthor?.username}</span>
                          </div>
                          {sharedPost?.caption && (
                            <p className="text-xs text-gray-500 mt-1 line-clamp-1">{sharedPost.caption}</p>
                          )}
                        </div>
                      </button>
                    </div>
                  </div>
                );
              }

              // Regular text message
              return (
                <div key={reply.id} className={`flex ${reply.fromSelf ? "justify-end" : "justify-start"}`}>
                  <div className={`max-w-[70%] px-4 py-2 rounded-2xl ${reply.fromSelf ? "bg-blue-500 text-white" : "bg-gray-200 text-gray-900"}`}>
                    <p className="text-sm">{reply.text}</p>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Input */}
          <div className="p-4 border-t">
            <div className="flex items-center gap-2">
              <input
                type="text"
                value={dmDraft}
                onChange={e => setDmDraft(e.target.value)}
                onKeyDown={e => e.key === "Enter" && handleSendDM()}
                placeholder="Message..."
                className="flex-1 px-4 py-2 border border-gray-300 rounded-full focus:outline-none focus:border-gray-400"
              />
              <button
                onClick={handleSendDM}
                disabled={!dmDraft.trim()}
                className="text-blue-500 font-semibold disabled:opacity-50"
              >
                Send
              </button>
            </div>
          </div>
        </div>
      );
    }

    // DM list view
    return (
      <div className="max-w-lg mx-auto">
        <div className="p-4 border-b flex items-center justify-between">
          <h2 className="font-semibold text-xl">Messages</h2>
          <button onClick={() => setShowNewDMModal(true)} className="p-1 hover:bg-gray-100 rounded-full">
            <PlusSquare size={24} />
          </button>
        </div>
        <div className="divide-y">
          {/* Sort DMs by most recent activity (user messages first, then original order) */}
          {[...allConversations].sort((a, b) => {
            const aReplies = dmReplies[a.id] || [];
            const bReplies = dmReplies[b.id] || [];
            const aLastTimestamp = aReplies.length > 0 ? aReplies[aReplies.length - 1].timestamp : 0;
            const bLastTimestamp = bReplies.length > 0 ? bReplies[bReplies.length - 1].timestamp : 0;
            return bLastTimestamp - aLastTimestamp; // Most recent first
          }).map(dm => {
            const otherUserId = dm.participantIds.find(id => id !== "user000");
            const otherUser = otherUserId ? getUserById(otherUserId) : undefined;
            const userReplies = dmReplies[dm.id] || [];
            const lastReply = userReplies[userReplies.length - 1];
            const displayMessage = lastReply
              ? (lastReply.sharedPostId ? "Sent a post" : lastReply.text)
              : dm.lastMessage;

            return (
              <button
                key={dm.id}
                onClick={() => handleOpenDM(dm.id)}
                className="w-full p-4 flex items-center gap-3 hover:bg-gray-50"
              >
                {renderAvatar(otherUser, "md")}
                <div className="flex-1 text-left">
                  <p className="font-semibold text-sm">{otherUser?.username}</p>
                  <p className="text-sm text-gray-500 truncate">{displayMessage}</p>
                </div>
                {dm.unreadCount > 0 && (
                  <span className="w-5 h-5 bg-blue-500 text-white text-xs rounded-full flex items-center justify-center">
                    {dm.unreadCount}
                  </span>
                )}
              </button>
            );
          })}
        </div>
      </div>
    );
  };

  const renderStoryViewer = () => {
    if (currentStoryIndex === null) return null;
    const story = activeStories[currentStoryIndex];
    const author = getUserById(story?.authorId || "");

    // Get all stories for the current author
    const currentAuthorId = story?.authorId;
    const authorStories = activeStories.filter(s => s.authorId === currentAuthorId);
    const storyIndexInAuthor = authorStories.findIndex(s => s.id === story?.id);

    const goToPrevStory = () => {
      if (storyIndexInAuthor > 0) {
        const prevStory = authorStories[storyIndexInAuthor - 1];
        const globalIndex = activeStories.findIndex(s => s.id === prevStory.id);
        setCurrentStoryIndex(globalIndex);
      } else if (currentStoryIndex > 0) {
        setCurrentStoryIndex(currentStoryIndex - 1);
      } else {
        setCurrentStoryIndex(null);
      }
    };

    const goToNextStory = () => {
      if (storyIndexInAuthor < authorStories.length - 1) {
        const nextStory = authorStories[storyIndexInAuthor + 1];
        const globalIndex = activeStories.findIndex(s => s.id === nextStory.id);
        setCurrentStoryIndex(globalIndex);
        if (!nextStory.isViewed) {
          apiViewStory(nextStory.id);
        }
      } else if (currentStoryIndex < activeStories.length - 1) {
        const nextIndex = currentStoryIndex + 1;
        setCurrentStoryIndex(nextIndex);
        const nextStory = activeStories[nextIndex];
        if (nextStory && !nextStory.isViewed) {
          apiViewStory(nextStory.id);
        }
      } else {
        setCurrentStoryIndex(null);
      }
    };

    return (
      <div className="fixed inset-0 bg-black z-50 flex items-center justify-center">
        <button
          onClick={() => setCurrentStoryIndex(null)}
          className="absolute top-4 right-4 text-white z-10"
        >
          <X size={24} />
        </button>

        <div className="relative w-full max-w-md aspect-[9/16] bg-gray-900 flex items-center justify-center">
          {/* Click zones for navigation */}
          <button
            onClick={goToPrevStory}
            className="absolute left-0 top-0 w-1/3 h-full z-10"
            aria-label="Previous story"
          />
          <button
            onClick={goToNextStory}
            className="absolute right-0 top-0 w-2/3 h-full z-10"
            aria-label="Next story"
          />

          {/* Progress bars - only for current author's stories */}
          <div className="absolute top-2 left-2 right-2 flex gap-1 z-20">
            {authorStories.map((_, idx) => (
              <div key={idx} className="flex-1 h-0.5 bg-gray-600 rounded-full overflow-hidden">
                <div
                  className={`h-full bg-white ${idx < storyIndexInAuthor ? 'w-full' : idx === storyIndexInAuthor ? 'animate-progress' : 'w-0'}`}
                  style={idx === storyIndexInAuthor ? { animation: `progress ${STORY_DURATION_MS}ms linear` } : undefined}
                />
              </div>
            ))}
          </div>

          {/* Author info */}
          <div className="absolute top-6 left-4 flex items-center gap-2 z-20">
            {renderAvatar(author, "sm")}
            <span className="text-white font-semibold text-sm">{author?.username}</span>
            <span className="text-gray-300 text-xs">{story ? computeRelativeTimestamp(story.order, startTime, maxOrder) : ''}</span>
          </div>

          {/* Story content */}
          <img
            src={story ? getPlaceholderImageUrl(story.id) : ''}
            alt="Story"
            className="w-full h-full object-cover"
          />
        </div>
      </div>
    );
  };

  const renderPostModal = () => {
    if (!showPostModal || !selectedPost) return null;
    const post = posts.find(p => p.id === selectedPost);
    if (!post) return null;

    const author = getUserById(post.authorId);
    const isLiked = post.isLiked;
    const isSaved = post.isSaved;
    const postUserComments = userComments.filter(c => c.postId === post.id);

    const handleBackdropClick = (e: React.MouseEvent) => {
      if (e.target === e.currentTarget) {
        setShowPostModal(false);
        setSelectedPost(null);
      }
    };

    return (
      <div
        className="fixed inset-0 bg-black bg-opacity-75 flex items-center justify-center z-50 p-4"
        onClick={handleBackdropClick}
      >
        <button
          onClick={() => { setShowPostModal(false); setSelectedPost(null); }}
          className="absolute top-4 right-4 text-white z-10"
        >
          <X size={24} />
        </button>

        <div className="bg-white rounded-lg overflow-hidden max-w-4xl w-full max-h-[90vh] flex" onClick={e => e.stopPropagation()}>
          {/* Image */}
          <div className="flex-1 bg-gray-100 flex items-center justify-center min-h-[400px] overflow-hidden">
            <img
              src={getPlaceholderImageUrl(post.id)}
              alt={post.caption?.slice(0, 50) || "Post image"}
              className="w-full h-full object-cover"
            />
          </div>

          {/* Details */}
          <div className="w-80 flex flex-col">
            {/* Header */}
            <div className="p-4 border-b flex items-center gap-3">
              {renderAvatar(author, "md")}
              <div>
                <p className="font-semibold text-sm">{author?.username}</p>
                {post.location && <p className="text-xs text-gray-500">{post.location}</p>}
              </div>
            </div>

            {/* Comments */}
            <div className="flex-1 overflow-y-auto p-4 space-y-4">
              <div className="flex gap-3">
                {renderAvatar(author, "sm")}
                <div>
                  <p className="text-sm">
                    <span className="font-semibold">{author?.username}</span>{" "}
                    {post.caption}
                  </p>
                  <p className="text-xs text-gray-400 mt-1">{computeRelativeTimestamp(post.order, startTime, maxOrder)}</p>
                </div>
              </div>
              {post.comments.map((comment, commentIndex) => {
                const commenter = getUserById(comment.authorId);
                const commentOrder = post.order + commentIndex + 1;
                return (
                  <div key={comment.id} className="flex gap-3">
                    {renderAvatar(commenter, "sm")}
                    <div className="flex-1">
                      <p className="text-sm">
                        <span className="font-semibold">{commenter?.username}</span>{" "}
                        {comment.text}
                      </p>
                      <div className="flex items-center gap-3 mt-1">
                        <p className="text-xs text-gray-400">{computeRelativeTimestamp(commentOrder, startTime, maxOrder)}</p>
                        <button
                          onClick={() => setReplyToComment({ id: comment.id, authorUsername: commenter?.username || "" })}
                          className="text-xs text-gray-500 font-semibold hover:text-gray-700"
                        >
                          Reply
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })}
              {/* User's comments */}
              {postUserComments.map((comment) => (
                <div key={comment.id} className="flex gap-3">
                  {renderAvatar(selfUser, "sm")}
                  <div>
                    <p className="text-sm">
                      <span className="font-semibold">{selfUser?.username}</span>{" "}
                      {comment.replyToUsername && (
                        <span className="text-blue-500">@{comment.replyToUsername} </span>
                      )}
                      {comment.text}
                    </p>
                    <p className="text-xs text-gray-400 mt-1">Just now</p>
                  </div>
                </div>
              ))}
            </div>

            {/* Actions */}
            <div className="border-t p-4">
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-4">
                  <button onClick={() => handleLikePost(post.id)}>
                    <Heart size={24} className={isLiked ? "fill-red-500 text-red-500" : ""} />
                  </button>
                  <button><MessageCircle size={24} /></button>
                  <button onClick={() => handleShareOpen(post.id)}>
                    <Send size={24} />
                  </button>
                </div>
                <button onClick={() => handleSavePost(post.id)}>
                  <Bookmark size={24} className={isSaved ? "fill-gray-900" : ""} />
                </button>
              </div>
              <p className="font-semibold text-sm mb-2">
                {formatNumber(post.likes + (isLiked ? 1 : 0))} likes
              </p>
              {/* Reply indicator */}
              {replyToComment && (
                <div className="flex items-center gap-2 mb-2 text-xs text-gray-500 bg-gray-50 px-2 py-1 rounded">
                  <span>Replying to <span className="font-semibold">@{replyToComment.authorUsername}</span></span>
                  <button
                    onClick={() => setReplyToComment(null)}
                    className="ml-auto text-gray-400 hover:text-gray-600"
                  >
                    <X size={14} />
                  </button>
                </div>
              )}
              <div className="flex items-center gap-2">
                <input
                  type="text"
                  placeholder={replyToComment ? `Reply to @${replyToComment.authorUsername}...` : "Add a comment..."}
                  value={commentText}
                  onChange={e => setCommentText(e.target.value)}
                  onKeyDown={e => { if (e.key === "Enter" && commentText.trim()) handleAddComment(post.id); }}
                  className="flex-1 text-sm outline-none"
                />
                <button
                  onClick={() => handleAddComment(post.id)}
                  disabled={!commentText.trim()}
                  className="text-blue-500 font-semibold text-sm disabled:opacity-50"
                >
                  Post
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  };

  // ---------------------------------------------------------------------------
  // Main Render
  // ---------------------------------------------------------------------------

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="fixed left-0 right-0 bg-white border-b border-gray-200 z-40 top-0">
        <div className="max-w-5xl mx-auto px-4 h-14 flex items-center justify-between">
          <button
            onClick={() => { setRoute("home"); }}
            className="flex items-center gap-2 hover:opacity-70 transition-opacity"
          >
            <img src="desktop/microgram-icon.png" alt="MicroGram" className="w-7 h-7 object-contain" />
            <h1 className="text-xl font-semibold italic">MicroGram</h1>
          </button>
          <nav className="flex items-center gap-6">
            <button onClick={() => { setRoute("home"); }}>
              <Home size={24} className={navSection === "home" ? "fill-gray-900" : ""} />
            </button>
            <button onClick={() => setRoute("search")}>
              <Search size={24} className={navSection === "search" ? "fill-gray-900" : ""} />
            </button>
            <button onClick={() => setRoute("explore")}>
              <Compass size={24} className={navSection === "explore" ? "fill-gray-900" : ""} />
            </button>
            <button onClick={() => setRoute("direct")}>
              <Send size={24} className={navSection === "direct" ? "fill-gray-900" : ""} />
            </button>
            <button onClick={() => { setRoute("activity"); setLastSeenActivityCount(activity.length); }} className="relative">
              <Heart size={24} className={navSection === "activity" ? "fill-gray-900" : ""} />
              {hasNewActivity && navSection !== "activity" && (
                <span className="absolute -top-1 -right-1 w-2.5 h-2.5 bg-red-500 rounded-full" />
              )}
            </button>
            <button onClick={() => { setRoute("profile"); }}>
              <User size={24} className={navSection === "profile" ? "fill-gray-900" : ""} />
            </button>
          </nav>
        </div>
      </header>


      {/* Main Content */}
      <main style={{ paddingTop: '56px' }}>
        {navSection === "home" && renderFeed()}
        {navSection === "explore" && renderExplore()}
        {navSection === "search" && (
          <div className="max-w-lg mx-auto p-4">
            <div className="relative mb-4">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" size={20} />
              <input
                type="text"
                placeholder="Search"
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                className="w-full pl-10 pr-4 py-2 bg-gray-100 rounded-lg focus:outline-none"
                autoFocus
              />
            </div>
            {searchResults.length > 0 && (
              <div className="divide-y">
                {searchResults.map(user => (
                  <button
                    key={user.id}
                    onClick={() => navigateToProfile(user.id)}
                    className="w-full p-3 flex items-center gap-3 hover:bg-gray-50"
                  >
                    {renderAvatar(user, "md")}
                    <div className="text-left">
                      <p className="font-semibold text-sm">{user.username}</p>
                      <p className="text-sm text-gray-500">{user.name}</p>
                    </div>
                  </button>
                ))}
              </div>
            )}
          </div>
        )}
        {navSection === "activity" && renderActivity()}
        {navSection === "direct" && renderDirect()}
        {navSection === "profile" && renderProfile(selectedProfile)}
      </main>

      {/* Modals */}
      {renderStoryViewer()}
      {renderPostModal()}

      {/* Share Sheet */}
      {sharePostId && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50" onClick={handleShareClose}>
          <div className="bg-white rounded-xl w-96 max-h-[80vh] overflow-hidden" onClick={e => e.stopPropagation()}>
            <div className="p-4 border-b flex items-center justify-between">
              <h2 className="font-semibold">Share</h2>
              <button onClick={handleShareClose}><X size={20} /></button>
            </div>
            <div className="p-4">
              <p className="text-sm text-gray-500 mb-3">Send to</p>
              <div className="space-y-2 max-h-60 overflow-y-auto">
                {apiMessages.map(dm => {
                  const otherUserId = dm.participantIds.find(id => id !== "user000");
                  const otherUser = otherUserId ? getUserById(otherUserId) : undefined;
                  const isSelected = shareRecipientId === dm.id;
                  return (
                    <button
                      key={dm.id}
                      onClick={() => setShareRecipientId(dm.id)}
                      className={`w-full p-3 flex items-center gap-3 rounded-lg ${isSelected ? "bg-blue-50 border border-blue-200" : "hover:bg-gray-50"}`}
                    >
                      {renderAvatar(otherUser, "md")}
                      <span className="flex-1 text-left font-medium text-sm">{otherUser?.username}</span>
                      {isSelected && <Check size={20} className="text-blue-500" />}
                    </button>
                  );
                })}
              </div>
            </div>
            <div className="p-4 border-t">
              <input
                type="text"
                value={shareNote}
                onChange={e => setShareNote(e.target.value)}
                placeholder="Write a message..."
                className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm mb-3"
              />
              <button
                onClick={handleShareSend}
                disabled={!shareRecipientId}
                className="w-full py-2 bg-blue-500 text-white rounded-lg font-semibold disabled:opacity-50"
              >
                {shareSent ? "Sent!" : "Send"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Post Options Menu */}
      {showPostOptions && postOptionsPostId && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50" onClick={handlePostOptionsClose}>
          <div className="bg-white rounded-xl w-80 overflow-hidden" onClick={e => e.stopPropagation()}>
            <button onClick={handleReportPost} className="w-full py-3 border-b hover:bg-gray-50 text-sm flex items-center justify-center gap-2 text-red-500 font-semibold">
              <Flag size={16} /> Report
            </button>
            <button onClick={handleUnfollowFromPost} className="w-full py-3 border-b hover:bg-gray-50 text-sm flex items-center justify-center gap-2 text-red-500 font-semibold">
              <UserMinus size={16} /> Unfollow
            </button>
            <button onClick={handleCopyLink} className="w-full py-3 border-b hover:bg-gray-50 text-sm flex items-center justify-center gap-2">
              <Copy size={16} /> Copy link
            </button>
            <button onClick={() => { handleShareOpen(postOptionsPostId); handlePostOptionsClose(); }} className="w-full py-3 border-b hover:bg-gray-50 text-sm flex items-center justify-center gap-2">
              <Send size={16} /> Share to...
            </button>
            <button onClick={handlePostOptionsClose} className="w-full py-3 hover:bg-gray-50 text-sm">
              Cancel
            </button>
          </div>
        </div>
      )}

      {/* Edit Profile Modal */}
      {showEditProfile && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50" onClick={() => setShowEditProfile(false)}>
          <div className="bg-white rounded-xl w-96 overflow-hidden" onClick={e => e.stopPropagation()}>
            <div className="p-4 border-b flex items-center justify-between">
              <h2 className="font-semibold">Edit profile</h2>
              <button onClick={() => setShowEditProfile(false)}><X size={20} /></button>
            </div>
            <div className="p-4 space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Name</label>
                <input
                  type="text"
                  value={profileEditDraft.displayName}
                  onChange={e => setProfileEditDraft(prev => ({ ...prev, displayName: e.target.value }))}
                  className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Bio</label>
                <textarea
                  value={profileEditDraft.bio}
                  onChange={e => setProfileEditDraft(prev => ({ ...prev, bio: e.target.value }))}
                  rows={3}
                  className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm resize-none"
                />
              </div>
            </div>
            <div className="p-4 border-t flex gap-3">
              <button onClick={() => setShowEditProfile(false)} className="flex-1 py-2 border border-gray-300 rounded-lg text-sm font-semibold">
                Cancel
              </button>
              <button onClick={handleEditProfileSave} className="flex-1 py-2 bg-blue-500 text-white rounded-lg text-sm font-semibold">
                Save
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Followers Modal */}
      {showFollowersModal && followersModalUserId && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50" onClick={() => setShowFollowersModal(false)}>
          <div className="bg-white rounded-xl w-96 max-h-[80vh] overflow-hidden" onClick={e => e.stopPropagation()}>
            <div className="p-4 border-b flex items-center justify-between">
              <h2 className="font-semibold">Followers</h2>
              <button onClick={() => setShowFollowersModal(false)}><X size={20} /></button>
            </div>
            <div className="max-h-80 overflow-y-auto divide-y">
              {MICROGRAM_USERS.filter(u => !u.isSelf && u.id !== followersModalUserId).slice(0, 10).map(user => {
                const isFollowing = followedUserIds.includes(user.id);
                return (
                  <div key={user.id} className="p-3 flex items-center gap-3">
                    <button onClick={() => { setShowFollowersModal(false); navigateToProfile(user.id); }}>
                      {renderAvatar(user, "md")}
                    </button>
                    <div className="flex-1">
                      <button onClick={() => { setShowFollowersModal(false); navigateToProfile(user.id); }} className="font-semibold text-sm hover:underline">
                        {user.username}
                      </button>
                      <p className="text-xs text-gray-500">{user.name}</p>
                    </div>
                    <button
                      onClick={() => handleFollow(user.id)}
                      className={`px-4 py-1.5 rounded-lg text-xs font-semibold ${isFollowing ? "border border-gray-300" : "bg-blue-500 text-white"}`}
                    >
                      {isFollowing ? "Following" : "Follow"}
                    </button>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {/* Following Modal */}
      {showFollowingModal && followersModalUserId && (() => {
        const filteredFollowing = followedUserIds.filter(userId => userId !== followersModalUserId);
        return (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50" onClick={() => setShowFollowingModal(false)}>
            <div className="bg-white rounded-xl w-96 max-h-[80vh] overflow-hidden" onClick={e => e.stopPropagation()}>
              <div className="p-4 border-b flex items-center justify-between">
                <h2 className="font-semibold">Following</h2>
                <button onClick={() => setShowFollowingModal(false)}><X size={20} /></button>
              </div>
              <div className="max-h-80 overflow-y-auto divide-y">
                {filteredFollowing.length > 0 ? filteredFollowing.map(userId => {
                  const user = getUserById(userId);
                  if (!user) return null;
                  return (
                    <div key={user.id} className="p-3 flex items-center gap-3">
                      <button onClick={() => { setShowFollowingModal(false); navigateToProfile(user.id); }}>
                        {renderAvatar(user, "md")}
                      </button>
                      <div className="flex-1">
                        <button onClick={() => { setShowFollowingModal(false); navigateToProfile(user.id); }} className="font-semibold text-sm hover:underline">
                          {user.username}
                        </button>
                        <p className="text-xs text-gray-500">{user.name}</p>
                      </div>
                      <button
                        onClick={() => handleFollow(user.id)}
                        className="px-4 py-1.5 rounded-lg text-xs font-semibold border border-gray-300"
                      >
                        Following
                      </button>
                    </div>
                  );
                }) : (
                  <div className="p-8 text-center text-gray-500">
                    <p className="text-sm">Not following anyone yet</p>
                  </div>
                )}
              </div>
            </div>
          </div>
        );
      })()}

      {/* New DM Modal */}
      {showNewDMModal && (() => {
        const selfId = config?.selfUser?.id || "user000";
        const existingDMUserIds = allConversations.flatMap(dm => dm.participantIds).filter(id => id !== selfId);
        const usersWithoutDMs = MICROGRAM_USERS.filter(u => !u.isSelf && !existingDMUserIds.includes(u.id));

        return (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50" onClick={() => setShowNewDMModal(false)}>
            <div className="bg-white rounded-xl w-96 max-h-[80vh] overflow-hidden" onClick={e => e.stopPropagation()}>
              <div className="p-4 border-b flex items-center justify-between">
                <h2 className="font-semibold">New message</h2>
                <button onClick={() => setShowNewDMModal(false)}><X size={20} /></button>
              </div>
              <div className="max-h-80 overflow-y-auto divide-y">
                {usersWithoutDMs.length > 0 ? usersWithoutDMs.map(user => (
                  <button
                    key={user.id}
                    onClick={() => {
                      if (!followedUserIds.includes(user.id)) {
                        showToast("Start a conversation by following " + user.username + " first", "info");
                        return;
                      }
                      setShowNewDMModal(false);
                      handleStartConversation(user.id);
                    }}
                    className="w-full p-3 flex items-center gap-3 hover:bg-gray-50"
                  >
                    {renderAvatar(user, "md")}
                    <div className="flex-1 text-left">
                      <p className="font-semibold text-sm">{user.username}</p>
                      <p className="text-xs text-gray-500">{user.name}</p>
                    </div>
                  </button>
                )) : (
                  <div className="p-8 text-center text-gray-500">
                    <p className="text-sm">No new users to message</p>
                  </div>
                )}
              </div>
            </div>
          </div>
        );
      })()}


      {/* Toast Notification */}
      {toast && (
        <div className={`fixed bottom-4 left-1/2 transform -translate-x-1/2 px-6 py-3 rounded-lg shadow-lg z-50 ${
          toast.type === "success" ? "bg-green-600 text-white" :
          toast.type === "error" ? "bg-red-600 text-white" :
          "bg-gray-800 text-white"
        }`}>
          {toast.message}
        </div>
      )}

      {/* Lock Screen */}
      {isSignedOut && (
        <div className="fixed inset-0 z-50 flex items-center justify-center" style={{ backgroundColor: "rgba(0,0,0,0.5)", backdropFilter: "blur(6px)" }}>
          <div className="bg-white rounded-lg shadow-2xl p-8 w-[360px] flex flex-col items-center">
            <div className="text-2xl font-bold mb-6" style={{ background: "linear-gradient(45deg, #f09433, #e6683c, #dc2743, #cc2366, #bc1888)", WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent" }}>MicroGram</div>
            <div className="w-20 h-20 rounded-full flex items-center justify-center text-white text-2xl font-bold mb-4" style={{ background: "linear-gradient(45deg, #f09433, #e6683c, #dc2743, #cc2366, #bc1888)" }}>
              {selfUser?.name?.split(" ").map((n: string) => n[0]).join("") || "U"}
            </div>
            <div className="text-lg font-semibold text-gray-900 mb-1">{selfUser?.name || "User"}</div>
            <div className="text-sm text-gray-500 mb-6">@{selfUser?.username || "user"}</div>
            <input type="password" readOnly value="••••••••" className="w-full px-4 py-2 border border-gray-300 rounded mb-4 text-center text-gray-400 bg-gray-50" />
            <button onClick={() => setIsSignedOut(false)} className="w-full py-2 text-white rounded-lg font-semibold hover:opacity-90 transition-opacity" style={{ background: "linear-gradient(45deg, #f09433, #e6683c, #dc2743, #cc2366, #bc1888)" }}>
              Sign in
            </button>
          </div>
        </div>
      )}

    </div>
  );
};

export default MicroGram;
