import { useState, useMemo } from "react";

import { useMicrodinData } from "../hooks/useMicrodinData";
import type { ApiDinCompany, ApiDinUser } from "../hooks/useMicrodinData";

export const TASK_ID_MICRODIN = "microdin";


// ============================================================================
// STATIC DATA CONSTANTS
// Color mappings, background images, and other static data
// ============================================================================

/** Company color mapping for experience entries */
const COMPANY_COLORS: Record<string, string> = {
  // AI/ML
  'NexusAI': 'bg-purple-500',
  'NeuralPath AI': 'bg-violet-500',
  // Cybersecurity
  'CyberFort': 'bg-slate-700',
  'CyberVault Security': 'bg-gray-700',
  'CyberShield Security': 'bg-stone-600',
  // Data
  'DataWorks': 'bg-indigo-600',
  // Cloud
  'CloudNine': 'bg-cyan-500',
  'Aura Cloud Services': 'bg-purple-600',
  // Healthcare
  'HealthTech.io': 'bg-emerald-500',
  'MediCore Health': 'bg-red-400',
  'MindWell Health': 'bg-purple-400',
  // Gaming
  'ByteCraft Studios': 'bg-orange-500',
  // Automotive
  'Voltaic Motors': 'bg-red-600',
  // Semiconductors
  'ChipForge Industries': 'bg-green-600',
  // FinTech
  'FinWise': 'bg-amber-500',
  'FinTech Solutions': 'bg-green-500',
  'InsurTech Solutions': 'bg-teal-500',
  // EdTech
  'EduLearn': 'bg-amber-600',
  'EduVance Learning': 'bg-blue-500',
  // Fashion
  'FashionAI': 'bg-pink-500',
  // Media
  'MediaWorks': 'bg-red-500',
  // Biotech
  'BioSynth': 'bg-emerald-600',
  'GenoMix Biotech': 'bg-emerald-500',
  // Robotics
  'Robotix': 'bg-indigo-500',
  'RoboTech Industries': 'bg-gray-600',
  // Food
  'FoodChain Analytics': 'bg-lime-500',
  'FoodTech Labs': 'bg-lime-600',
  // Legal
  'LegalEase': 'bg-blue-800',
  // Real Estate
  'PropTech Hub': 'bg-violet-600',
  // Sustainability/Green
  'GreenTech Solutions': 'bg-green-500',
  'EcoVenture': 'bg-green-600',
  'CleanWater Tech': 'bg-sky-500',
  // Retail
  'RetailMax': 'bg-red-500',
  // Supply Chain
  'LogisticsPro': 'bg-blue-600',
  'LogiSync': 'bg-blue-500',
  // Aerospace
  'Galaxy Space Tech': 'bg-indigo-600',
  'AeroLink Aviation': 'bg-sky-600',
  // Construction
  'ConstrucTech': 'bg-orange-600',
  // AR/VR
  'CrystalVision AR': 'bg-fuchsia-500',
  // Smart Cities
  'SmartCity.io': 'bg-indigo-500',
  // Energy
  'GridWise Energy': 'bg-yellow-500',
  // Mining
  'MineTech': 'bg-stone-500',
  // Ocean
  'OceanTech Marine': 'bg-blue-500',
  // Quantum
  'Quantum Labs': 'bg-indigo-600',
  'QuantumLeap Labs': 'bg-cyan-600',
  // Big Tech
  'MicroSystems Corp': 'bg-blue-600',
  'Pear Technologies': 'bg-gray-600',
  'Alphavine Inc': 'bg-blue-500',
  // General Tech
  'Innovate Ltd': 'bg-indigo-500',
  'TechCorp': 'bg-blue-500',
  'SociaLink': 'bg-pink-500',
  // TheMicroCorporate (Self's company)
  'TheMicroCorporate': 'bg-gray-800',
  'default': 'bg-gray-500',
};

/** School color mapping for education entries */
const SCHOOL_COLORS: Record<string, string> = {
  'Stanford': 'bg-red-700',
  'MIT': 'bg-red-600',
  'Harvard': 'bg-red-800',
  'Berkeley': 'bg-blue-600',
  'CMU': 'bg-red-600',
  'Caltech': 'bg-orange-600',
  'Princeton': 'bg-orange-500',
  'Yale': 'bg-blue-800',
  'Columbia': 'bg-blue-700',
  'default': 'bg-gray-600',
};

/** Gradient backgrounds for cards */
const CARD_GRADIENTS = [
  'from-blue-400 via-blue-500 to-indigo-600',
  'from-purple-400 via-purple-500 to-pink-600',
  'from-green-400 via-teal-500 to-cyan-600',
  'from-orange-400 via-red-500 to-pink-600',
  'from-indigo-400 via-purple-500 to-blue-600',
  'from-cyan-400 via-blue-500 to-indigo-600',
  'from-rose-400 via-pink-500 to-purple-600',
  'from-amber-400 via-orange-500 to-red-600',
] as const;

// Suppress unused variable warning
void COMPANY_COLORS;

// ============================================================================
// TYPE DEFINITIONS
// ============================================================================


interface Comment {
  id: string;
  author: string;
  avatar: string;
  avatarUrl: string;
  content: string;
  timestamp: string;
  likes: number;
}

interface Post {
  id: string;
  author: string;
  title: string;
  company: string;
  content: string;
  timestamp: string;
  likes: number;
  comments: Comment[];
  imageUrl?: string;
  avatar: string;
  avatarUrl?: string;
  isTargetPost: boolean;
  isLiked?: boolean;
}

interface Message {
  id: string;
  sender: string;
  content: string;
  timestamp: string;
  isOwn: boolean;
}

interface Contact {
  id: string;
  name: string;
  avatar: string;
  avatarUrl: string;
  status: 'online' | 'offline';
  lastMessage: string;
  unread: number;
  messages: Message[];
}

interface Notification {
  id: string;
  type: 'like' | 'comment' | 'connection' | 'message';
  actor: string;
  avatar: string;
  avatarUrl: string;
  content: string;
  timestamp: string;
  read: boolean;
}

// Extended interfaces for complete profiles
interface Person {
  id: string;
  name: string;
  username?: string;
  email?: string;
  title: string;
  company: string;
  location: string;
  avatar: string;
  avatarUrl: string;
  bannerUrl: string;
  connections: number;
  about: string;
  experience: Array<{
    role: string;
    company: string;
    duration: string;
    location: string;
    description: string;
    companyInitial: string;
    companyColor: string;
  }>;
  education: Array<{
    degree: string;
    school: string;
    years: string;
    initial: string;
    color: string;
  }>;
  skills: string[];
}

interface Company {
  id: string;
  name: string;
  desc: string;
  initial: string;
  color: string;
  industry: string;
  size: string;
  location: string;
  about: string;
  employees: number;
  followers: number;
  logoUrl?: string;
  bannerUrl?: string;
}

interface JobListing {
  id: string;
  title: string;
  company: string;
  location: string;
  type: string;
  posted: string;
  applicants: number;
  description: string;
  requirements: string[];
  companyId: string;
}

// Connection invitation interface for UI
interface ConnectionInvitation {
  id: string;
  userId: string;
  name: string;
  title: string;
  avatarUrl: string;
  mutualConnections: number;
  status: "pending" | "connected" | "ignored";
}

// ============================================================================
// USER PROFILE TO PERSON CONVERTER
// ============================================================================

// Convert user to Person format
const convertUserToPerson = (user: ApiDinUser, index: number): Person => {
  // Generate pseudo-random but consistent connections count based on user ID
  const connectionCount = ((user.id.charCodeAt(4) || 0) * 17 + index * 23) % 400 + 50;

  // Create experience entries from user data
  const experience: Person['experience'] = [];
  const userCompany = user.microdin?.company || 'TheMicroCorporate';
  const userCompanyColor = COMPANY_COLORS[userCompany] || COMPANY_COLORS['default'];
  if (user.jobTitle) {
    experience.push({
      role: user.jobTitle,
      company: userCompany,
      duration: '2022 – Present',
      location: user.location ?? "",
      description: `Working as ${user.jobTitle} focusing on ${user.interests?.slice(0, 2).join(' and ') || 'technology'}.`,
      companyInitial: userCompany.charAt(0),
      companyColor: userCompanyColor,
    });
  }

  // Create education entries
  const education: Person['education'] = [];
  if (user.microscholar) {
    education.push({
      degree: user.microscholar.title || 'Researcher',
      school: user.microscholar.affiliation || 'University',
      years: '2018 – 2022',
      initial: (user.microscholar.affiliation || 'U').charAt(0),
      color: SCHOOL_COLORS[user.microscholar.affiliation?.split(' ')[0] || 'default'] || SCHOOL_COLORS['default'],
    });
  } else {
    education.push({
      degree: 'Bachelor of Science',
      school: 'University',
      years: '2015 – 2019',
      initial: 'U',
      color: 'bg-blue-600',
    });
  }

  return {
    id: user.id,
    name: user.name,
    username: user.username,
    email: user.email,
    title: user.jobTitle || 'Professional',
    company: userCompany,
    location: user.location ?? "",
    avatar: '👤',
    avatarUrl: user.avatarUrl ?? "",
    bannerUrl: user.bannerUrl ?? "",
    connections: connectionCount,
    about: user.bio || `${user.name} is a professional based in ${user.location}.`,
    experience,
    education,
    skills: user.interests?.slice(0, 6) || ['Communication', 'Problem Solving', 'Teamwork'],
  };
};

// Convert ApiDinCompany to UI Company format
const convertApiCompanyToCompany = (c: ApiDinCompany): Company => ({
  id: c.id,
  name: c.name,
  desc: `${c.industry} • ${c.size}`,
  initial: c.initials.charAt(0) || c.name.charAt(0),
  color: MICRODIN_COMPANY_GRADIENTS[c.id] || 'from-gray-400 to-gray-600',
  industry: c.industry,
  size: c.size,
  location: c.location,
  about: c.description,
  employees: c.employees,
  followers: c.followers,
  logoUrl: c.avatarUrl || undefined,
  bannerUrl: c.bannerUrl || undefined,
});

// Gradient color mapping for MicroDin companies (TailwindCSS classes)
const MICRODIN_COMPANY_GRADIENTS: Record<string, string> = {
  'company-nexus': 'from-purple-400 to-blue-500',
  'company-techcorp': 'from-blue-400 to-cyan-500',
  'company-socialink': 'from-pink-400 to-purple-500',
  'company-innovate': 'from-purple-400 to-indigo-500',
  'company-dataworks': 'from-indigo-400 to-blue-600',
  'company-cloudnine': 'from-cyan-400 to-blue-500',
  'company-greentech': 'from-green-400 to-emerald-500',
  'company-finwise': 'from-amber-400 to-orange-500',
  'company-themicrocorporate': 'from-gray-700 to-gray-900',
};



const MicroDin = () => {
  // API data hook
  const {
    posts: apiPosts,
    connections: apiConnections,
    conversations: apiConversations,
    notifications: apiNotifications,
    jobs: apiJobs,
    users: apiUsers,
    companies: apiCompanies,
    config,
    isLoading,
    error,
    likePost: apiLikePost,
    acceptConnection,
    ignoreConnection,
    readConversation,
    markNotificationRead,
    applyJob: apiApplyJob,
  } = useMicrodinData();


  // Sign-out lock screen state
  const [isSignedOut, setIsSignedOut] = useState(false);

  // Local UI state for posts the user creates in the composer
  const [localPosts, setLocalPosts] = useState<Post[]>([]);
  const [followedCompanies, setFollowedCompanies] = useState<string[]>([]);

  // UI State (not persisted)
  const [commentModalOpen, setCommentModalOpen] = useState(false);
  const [shareModalOpen, setShareModalOpen] = useState(false);
  const [selectedPostId, setSelectedPostId] = useState<string | null>(null);
  const [commentText, setCommentText] = useState("");
  const [openChats, setOpenChats] = useState<string[]>([]);
  const [profileDropdownOpen, setProfileDropdownOpen] = useState(false);
  const [notificationsDropdownOpen, setNotificationsDropdownOpen] = useState(false);
  const [postComposerOpen, setPostComposerOpen] = useState(false);
  const [messagingPanelOpen, setMessagingPanelOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [showSearchResults, setShowSearchResults] = useState(false);
  const [newPostContent, setNewPostContent] = useState('');
  const [postVisibility, setPostVisibility] = useState<'anyone' | 'connections' | 'group'>('anyone');
  const [visibilityDropdownOpen, setVisibilityDropdownOpen] = useState(false);
  const [activeChat, setActiveChat] = useState<string | null>(null);
  const [messageInputs, setMessageInputs] = useState<{[key: string]: string}>({});
  const [mainChatInput, setMainChatInput] = useState('');
  const [currentView, setCurrentView] = useState<'feed' | 'my-network' | 'jobs' | 'profile' | 'messaging'>('feed');
  const [pageNotificationsOpen, setPageNotificationsOpen] = useState(false);
  const [pageVisitorsOpen, setPageVisitorsOpen] = useState(false);
  const [profileViewersOpen, setProfileViewersOpen] = useState(false);
  const [feedInfoTooltipOpen, setFeedInfoTooltipOpen] = useState(false);
  const [reactionsModalOpen, setReactionsModalOpen] = useState(false);
  const [selectedReactionPost, setSelectedReactionPost] = useState<string | null>(null);

  // Additional modals and UI state
  const [addSectionModalOpen, setAddSectionModalOpen] = useState(false);
  const [openToModalOpen, setOpenToModalOpen] = useState(false);
  const [contactInfoModalOpen, setContactInfoModalOpen] = useState(false);
  const [messagingFilter, setMessagingFilter] = useState<'focused' | 'unread' | 'connections'>('focused');
  const [newMessageComposerOpen, setNewMessageComposerOpen] = useState(false);
  const [savedItemsOpen, setSavedItemsOpen] = useState(false);
  const [groupsOpen, setGroupsOpen] = useState(false);
  const [newslettersOpen, setNewslettersOpen] = useState(false);
  const [eventsOpen, setEventsOpen] = useState(false);
  const [connectedUserIds, setConnectedUserIds] = useState<Set<string>>(new Set());
  const [ignoredInvitationIds, setIgnoredInvitationIds] = useState<Set<string>>(new Set());
  const [messagingSearchQuery, setMessagingSearchQuery] = useState('');
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);
  const [showPostOptions, setShowPostOptions] = useState(false);
  const [postOptionsPostId, setPostOptionsPostId] = useState<string | null>(null);
  const [savedPosts, setSavedPosts] = useState<string[]>([]);
  const [hiddenPosts, setHiddenPosts] = useState<string[]>([]);

  // Profile and company navigation state
  const [viewedPersonId, setViewedPersonId] = useState<string>('self'); // Default to current user
  const [viewedCompanyId, setViewedCompanyId] = useState<string | null>(null);
  const [currentViewSubPage, setCurrentViewSubPage] = useState<'company' | 'job-detail' | 'connections' | null>(null);
  const [selectedJobId, setSelectedJobId] = useState<string | null>(null);
  const [expandedJobId, setExpandedJobId] = useState<string | null>(null);
  const [appliedJobs, setAppliedJobs] = useState<string[]>([]);
  const [manageJobsModalOpen, setManageJobsModalOpen] = useState(false);
  const [postJobModalOpen, setPostJobModalOpen] = useState(false);
  const [settingsModalOpen, setSettingsModalOpen] = useState(false);
  const [helpModalOpen, setHelpModalOpen] = useState(false);
  const [eventInterestModalOpen, setEventInterestModalOpen] = useState(false);
  // Settings sub-modals
  const [accountPreferencesOpen, setAccountPreferencesOpen] = useState(false);
  const [signInSecurityOpen, setSignInSecurityOpen] = useState(false);
  const [notificationsSettingsOpen, setNotificationsSettingsOpen] = useState(false);
  const [visibilitySettingsOpen, setVisibilitySettingsOpen] = useState(false);
  const [dataPrivacyOpen, setDataPrivacyOpen] = useState(false);
  // Help sub-modals
  const [helpArticleOpen, setHelpArticleOpen] = useState<string | null>(null);
  // Add to profile sub-modals
  const [addSectionType, setAddSectionType] = useState<string | null>(null);
  // Open to sub-modals
  const [openToType, setOpenToType] = useState<string | null>(null);
  const [selectedEvent, setSelectedEvent] = useState<{title: string; date: string; attendees: number} | null>(null);
  const [followedGroups, setFollowedGroups] = useState<string[]>([]);
  const [postedJobs, setPostedJobs] = useState<Array<{title: string; company: string; location: string; type: string}>>([]);
  const [manageJobsTab, setManageJobsTab] = useState<'applied' | 'saved' | 'posted'>('applied');
  const [savedJobs, setSavedJobs] = useState<string[]>([]);
  const [showAllJobListings, setShowAllJobListings] = useState(false);
  const [showAllInvitationsModal, setShowAllInvitationsModal] = useState(false);
  const [showAllEventsModal, setShowAllEventsModal] = useState(false);
  const [showAllGroupsModal, setShowAllGroupsModal] = useState(false);
  const [networkSectionView, setNetworkSectionView] = useState<'connections' | 'followers' | 'groups' | 'events' | 'pages' | 'newsletters' | null>(null);

  // Derive shared data from API
  const userMap = useMemo(() => {
    const m = new Map<string, ApiDinUser>();
    for (const u of apiUsers) m.set(u.id, u);
    return m;
  }, [apiUsers]);

  const selfUser = config?.selfUser as ApiDinUser | undefined;

  const allPeople = useMemo<Person[]>(
    () => apiUsers.filter(u => !u.isSelf).map((u, i) => convertUserToPerson(u, i)),
    [apiUsers]
  );

  const selfPerson = useMemo<Person | null>(
    () => selfUser ? convertUserToPerson(selfUser, 0) : null,
    [selfUser]
  );

  const allCompanies = useMemo<Company[]>(
    () => apiCompanies.map(convertApiCompanyToCompany),
    [apiCompanies]
  );

  const companyMap = useMemo(() => {
    const m = new Map<string, ApiDinCompany>();
    for (const c of apiCompanies) m.set(c.id, c);
    return m;
  }, [apiCompanies]);

  const selfAvatarUrl = selfUser?.avatarUrl ?? "";

  // Map API data to component types
  const posts = useMemo<Post[]>(() => {
    const mapped = apiPosts.map(p => {
      const user = userMap.get(p.authorId);
      return {
        id: p.id,
        author: p.authorName,
        title: p.authorTitle,
        company: user?.microdin?.company || '',
        content: p.content,
        timestamp: p.timestamp,
        likes: p.likes,
        comments: p.comments.map(c => ({
            id: c.id,
            author: c.authorName || 'Unknown',
            avatar: '👤',
            avatarUrl: c.authorAvatarUrl || '',
            content: c.text,
            timestamp: '',
            likes: c.likes,
        })),
        imageUrl: p.imageUrl,
        avatar: '👤',
        avatarUrl: p.authorAvatarUrl,
        isTargetPost: false,
        isLiked: p.isLiked,
      };
    });
    return [...localPosts, ...mapped];
  }, [apiPosts, localPosts, userMap]);

  const allPosts = posts;

  const connectionInvitations = useMemo<ConnectionInvitation[]>(() => {
    return apiConnections.map(c => ({
      id: c.id,
      userId: c.userId,
      name: c.name,
      title: c.title,
      avatarUrl: c.avatarUrl,
      mutualConnections: c.mutualConnections,
      status: c.status === "accepted" ? "connected" as const : c.status === "ignored" ? "ignored" as const : "pending" as const,
    }));
  }, [apiConnections]);

  const contacts = useMemo<Contact[]>(() => {
    return apiConversations.map(conv => {
      const otherParticipant = (conv.participants ?? []).find(p => p.id !== selfUser?.id) || (conv.participants ?? [])[0];
      return {
        id: conv.id,
        name: otherParticipant?.name || 'Unknown',
        avatar: '👤',
        avatarUrl: otherParticipant?.avatarUrl || '',
        status: 'online' as const,
        lastMessage: conv.lastMessage,
        unread: conv.unreadCount,
        messages: conv.messages.map(m => ({
          id: m.id,
          sender: m.senderName,
          content: m.content,
          timestamp: m.timestamp,
          isOwn: m.senderId === selfUser?.id,
        })),
      };
    });
  }, [apiConversations, selfUser]);

  const notifications = useMemo<Notification[]>(() => {
    return apiNotifications.map(n => ({
      id: n.id,
      type: n.type as Notification['type'],
      actor: n.actorName,
      avatar: '👤',
      avatarUrl: n.actorAvatarUrl,
      content: n.content,
      timestamp: n.timestamp,
      read: n.isRead,
    }));
  }, [apiNotifications]);

  const allJobListings = useMemo<JobListing[]>(() => {
    return apiJobs.map(j => ({
      id: j.id,
      title: j.title,
      company: companyMap.get(j.companyId)?.name || j.companyId,
      location: j.location,
      type: j.type,
      posted: 'Recently',
      applicants: j.applicants,
      description: j.description,
      requirements: j.requirements,
      companyId: j.companyId,
    }));
  }, [apiJobs, companyMap]);

  // Use self person when viewing own profile, otherwise find in allPeople
  const viewedPerson = viewedPersonId === 'self'
    ? (selfPerson || allPeople[0])
    : (allPeople.find(p => p.id === viewedPersonId) || allPeople[0]);
  const viewedCompany = viewedCompanyId ? allCompanies.find(c => c.id === viewedCompanyId) : null;
  const selectedJob = selectedJobId ? allJobListings.find(j => j.id === selectedJobId) : null;

  const handleLike = (postId: string) => {
    apiLikePost(postId);
  };

  const handleComment = (postId: string) => {
    setSelectedPostId(postId);
    setCommentModalOpen(true);
  };

  const handleSubmitComment = () => {
    if (!commentText.trim() || !selectedPostId) return;
    setCommentText("");
    setCommentModalOpen(false);
    setSelectedPostId(null);
  };

  const handleShare = () => {
    setShareModalOpen(true);
  };

  const handleFollowToggle = (company: string) => {
    setFollowedCompanies(prev => {
      if (prev.includes(company)) {
        return prev.filter(c => c !== company);
      } else {
        return [...prev, company];
      }
    });
  };

  const handleCloseChat = (contactId: string) => {
    setOpenChats(prev => prev.filter(id => id !== contactId));
    if (activeChat === contactId) {
      setActiveChat(null);
    }
  };

  const handleSendMessage = (contactId: string) => {
    const message = messageInputs[contactId];
    if (!message?.trim()) return;
    readConversation(contactId);
    setMessageInputs(prev => ({ ...prev, [contactId]: '' }));
  };

  const handleSendMainChatMessage = () => {
    if (!mainChatInput.trim() || !activeChat) return;
    readConversation(activeChat);
    setMainChatInput('');
  };

  const handleCreatePost = () => {
    if (!newPostContent.trim()) return;

    const newPost: Post = {
      id: `user-post-${Date.now()}`,
      author: selfUser?.name || "You",
      title: selfUser?.jobTitle || "Professional",
      company: selfUser?.microdin?.company || "TheMicroCorporate",
      content: newPostContent,
      timestamp: "Just now",
      likes: 0,
      comments: [],
      avatar: "👨‍💼",
      avatarUrl: selfAvatarUrl,
      isTargetPost: false,
      isLiked: false
    };

    setLocalPosts(prev => [newPost, ...prev]);
    setNewPostContent('');
    setPostComposerOpen(false);
  };

  const markNotificationAsRead = (notifId: string) => {
    markNotificationRead(notifId);
  };

  // Navigation helper functions
  const handleViewProfile = (personId: string) => {
    setViewedPersonId(personId);
    setCurrentView('profile');
    setCurrentViewSubPage(null);
    setProfileDropdownOpen(false);
    setShowSearchResults(false);
  };

  const handleViewCompany = (companyId: string) => {
    setViewedCompanyId(companyId);
    setCurrentViewSubPage('company');
    setProfileDropdownOpen(false);
    setShowSearchResults(false);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleMessagePerson = (personName: string) => {
    // Find existing contact or use first contact as fallback
    const existingContact = contacts.find(c => c.name === personName);
    if (existingContact) {
      setActiveChat(existingContact.id);
    } else if (contacts.length > 0) {
      setActiveChat(contacts[0].id);
    }
    setCurrentView('messaging');
  };

  const handleViewJobDetail = (jobId: string) => {
    setSelectedJobId(jobId);
    setCurrentView('jobs');
    setCurrentViewSubPage('job-detail');
  };

  const handleApplyJob = (jobId: string) => {
    apiApplyJob(jobId);
    if (!appliedJobs.includes(jobId)) {
      setAppliedJobs(prev => [...prev, jobId]);
    }
  };

  const handleViewConnections = () => {
    setCurrentViewSubPage('connections');
  };

  const handleConnect = (personId: string) => {
    setConnectedUserIds(prev => new Set(prev).add(personId));
  };

  const isConnected = (personId: string): boolean => {
    return connectedUserIds.has(personId);
  };

  const handleAcceptInvitation = (invitationId: string, userId: string) => {
    acceptConnection(invitationId);
    setConnectedUserIds(prev => new Set(prev).add(userId));
    setIgnoredInvitationIds(prev => new Set(prev).add(invitationId));
  };

  const handleIgnoreInvitation = (invitationId: string) => {
    ignoreConnection(invitationId);
    setIgnoredInvitationIds(prev => new Set(prev).add(invitationId));
  };

  const handleAddEmoji = (emoji: string) => {
    if (activeChat) {
      setMainChatInput(prev => prev + emoji);
    }
    setShowEmojiPicker(false);
  };

  // Post options menu handlers
  const handlePostOptionsOpen = (postId: string) => {
    setPostOptionsPostId(postId);
    setShowPostOptions(true);
  };

  const handlePostOptionsClose = () => {
    setShowPostOptions(false);
    setPostOptionsPostId(null);
  };

  const handleSavePost = (postId: string) => {
    setSavedPosts(prev =>
      prev.includes(postId) ? prev.filter(id => id !== postId) : [...prev, postId]
    );
    handlePostOptionsClose();
  };

  const handleHidePost = (postId: string) => {
    setHiddenPosts(prev => [...prev, postId]);
    handlePostOptionsClose();
  };

  const handleCopyPostLink = () => {
    if (postOptionsPostId) {
      navigator.clipboard.writeText(`https://microdin.app/posts/${postOptionsPostId}`);
    }
    handlePostOptionsClose();
  };

  const handleReportPost = () => {
    // Just close the menu - in a real app this would open a report flow
    handlePostOptionsClose();
  };

  const handleBackFromSubPage = () => {
    setCurrentViewSubPage(null);
    setSelectedJobId(null);
    setViewedCompanyId(null);
  };



  const unreadNotificationsCount = notifications.filter(n => !n.read).length;

  // ---------------------------------------------------------------------------
  // Loading Gate
  // ---------------------------------------------------------------------------
  if (!config || isLoading) {
    const isNetworkError = error && /failed to fetch|networkerror/i.test(error);
    const isNoSession = error && /409/.test(error);
    const isMismatch = error && /environment mismatch/i.test(error);
    return (
      <div className="flex items-center justify-center h-screen bg-gray-50">
        <div className="text-center max-w-md px-6">
          <div className="text-4xl mb-3">💼</div>
          <h1 className="text-xl font-semibold mb-6 text-gray-900">MicroDin</h1>
          {!error ? (
            <>
              <div className="w-8 h-8 border-2 border-blue-600 border-t-transparent rounded-full animate-spin mx-auto mb-4" />
              <p className="text-sm text-gray-500">Connecting to MicroDin...</p>
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
              <p className="text-sm text-gray-500">Navigate to the correct environment from the desktop, or re-init with a MicroDin scenario.</p>
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
    <div className="min-h-screen bg-gray-50">
      {/* MicroDin Header */}
      <header className="bg-white border-b border-gray-200 sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-4 py-2">
          <div className="flex items-center justify-between">
            {/* Logo and Search */}
            <div className="flex items-center space-x-2">
              <div
                className="w-9 h-9 rounded flex items-center justify-center cursor-pointer hover:opacity-80 transition-opacity"
                onClick={() => {
                  setCurrentView('feed');
                  setCurrentViewSubPage(null);
                }}
              >
                <img
                  src="desktop/microdin-icon.png"
                  alt="MicroDin"
                  className="w-full h-full object-contain"
                />
              </div>
              <div className="relative">
                <svg className="absolute left-3 top-2.5 h-4 w-4 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                </svg>
                <input
                  type="text"
                  placeholder="Search"
                  value={searchQuery}
                  onChange={(e) => {
                    setSearchQuery(e.target.value);
                    setShowSearchResults(e.target.value.length > 0);
                  }}
                  onFocus={() => searchQuery && setShowSearchResults(true)}
                  className="w-60 pl-10 pr-3 py-1.5 text-sm bg-gray-100 border-0 rounded-sm focus:outline-none focus:bg-white focus:shadow-sm"
                />

                {/* Search Results Dropdown */}
                {showSearchResults && searchQuery && (
                  <div className="absolute top-full left-0 right-0 mt-1 bg-white border border-gray-200 rounded-lg shadow-xl z-50 max-h-96 overflow-y-auto">
                    <div className="p-2">
                      <div className="text-xs text-gray-500 px-3 py-2 font-semibold">People</div>
                      {allPeople.filter(p =>
                        p.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
                        p.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
                        p.company.toLowerCase().includes(searchQuery.toLowerCase())
                      ).slice(0, 5).map((person) => (
                        <button
                          key={person.id}
                          onClick={() => handleViewProfile(person.id)}
                          className="w-full flex items-center space-x-3 px-3 py-2 hover:bg-gray-100 rounded transition-colors"
                        >
                          <div className="w-10 h-10 rounded-full overflow-hidden bg-white">
                            <img
                              src={person.avatarUrl}
                              alt={person.name}
                              className="w-full h-full object-cover"
                            />
                          </div>
                          <div className="text-left">
                            <div className="text-sm font-semibold">{person.name}</div>
                            <div className="text-xs text-gray-600">{person.title} at {person.company}</div>
                          </div>
                        </button>
                      ))}

                      <div className="text-xs text-gray-500 px-3 py-2 font-semibold mt-2">Companies</div>
                      {allCompanies.filter(c =>
                        c.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
                        c.desc.toLowerCase().includes(searchQuery.toLowerCase())
                      ).slice(0, 5).map((company) => (
                        <button
                          key={company.id}
                          onClick={() => handleViewCompany(company.id)}
                          className="w-full flex items-center space-x-3 px-3 py-2 hover:bg-gray-100 rounded transition-colors"
                        >
                          {company.logoUrl ? (
                            <img
                              src={company.logoUrl}
                              alt={company.name}
                              className="w-10 h-10 rounded object-cover"
                            />
                          ) : (
                            <div className={`w-10 h-10 bg-gradient-to-br ${company.color} rounded flex items-center justify-center`}>
                              <span className="text-white font-bold">{company.initial}</span>
                            </div>
                          )}
                          <div className="text-left">
                            <div className="text-sm font-semibold">{company.name}</div>
                            <div className="text-xs text-gray-600">{company.desc}</div>
                          </div>
                        </button>
                      ))}

                      <div className="text-xs text-gray-500 px-3 py-2 font-semibold mt-2">Jobs</div>
                      {allJobListings.filter(j =>
                        j.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
                        j.company.toLowerCase().includes(searchQuery.toLowerCase())
                      ).slice(0, 3).map((job) => (
                        <button
                          key={job.id}
                          onClick={() => {
                            handleViewJobDetail(job.id);
                            setSearchQuery('');
                          }}
                          className="w-full flex items-center space-x-3 px-3 py-2 hover:bg-gray-100 rounded transition-colors"
                        >
                          <svg className="w-10 h-10 text-gray-400" fill="currentColor" viewBox="0 0 20 20">
                            <path fillRule="evenodd" d="M6 6V5a3 3 0 013-3h2a3 3 0 013 3v1h2a2 2 0 012 2v3.57A22.952 22.952 0 0110 13a22.95 22.95 0 01-8-1.43V8a2 2 0 012-2h2zm2-1a1 1 0 011-1h2a1 1 0 011 1v1H8V5zm1 5a1 1 0 011-1h.01a1 1 0 110 2H10a1 1 0 01-1-1z" clipRule="evenodd" />
                          </svg>
                          <div className="text-left flex-1">
                            <div className="text-sm font-semibold">{job.title}</div>
                            <div className="text-xs text-gray-600">{job.company} • {job.location}</div>
                          </div>
                        </button>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* Navigation */}
            <nav className="flex items-center space-x-8">
              <button
                onClick={() => { setCurrentView('feed'); setCurrentViewSubPage(null); }}
                className={`flex flex-col items-center text-xs group relative pb-3 ${
                  currentView === 'feed' ? 'text-gray-700' : 'text-gray-600 hover:text-gray-900'
                }`}
              >
                <svg className="w-6 h-6 mb-0.5" fill="currentColor" viewBox="0 0 20 20">
                  <path d="M10.707 2.293a1 1 0 00-1.414 0l-7 7a1 1 0 001.414 1.414L4 10.414V17a1 1 0 001 1h2a1 1 0 001-1v-2a1 1 0 011-1h2a1 1 0 011 1v2a1 1 0 001 1h2a1 1 0 001-1v-6.586l.293.293a1 1 0 001.414-1.414l-7-7z" />
                </svg>
                <span className="font-normal">Home</span>
                {currentView === 'feed' && (
                  <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-gray-900"></div>
                )}
              </button>
              <button
                onClick={() => { setCurrentView('my-network'); setCurrentViewSubPage(null); }}
                className={`flex flex-col items-center text-xs group relative pb-3 ${
                  currentView === 'my-network' ? 'text-gray-700' : 'text-gray-600 hover:text-gray-900'
                }`}
              >
                <svg className="w-6 h-6 mb-0.5" fill="currentColor" viewBox="0 0 20 20">
                  <path d="M9 6a3 3 0 11-6 0 3 3 0 016 0zM17 6a3 3 0 11-6 0 3 3 0 016 0zM12.93 17c.046-.327.07-.66.07-1a6.97 6.97 0 00-1.5-4.33A5 5 0 0119 16v1h-6.07zM6 11a5 5 0 015 5v1H1v-1a5 5 0 015-5z" />
                </svg>
                <span className="font-normal">My Network</span>
                {currentView === 'my-network' && (
                  <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-gray-900"></div>
                )}
              </button>
              <button
                onClick={() => { setCurrentView('jobs'); setCurrentViewSubPage(null); }}
                className={`flex flex-col items-center text-xs group relative pb-3 ${
                  currentView === 'jobs' ? 'text-gray-700' : 'text-gray-600 hover:text-gray-900'
                }`}
              >
                <svg className="w-6 h-6 mb-0.5" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M6 6V5a3 3 0 013-3h2a3 3 0 013 3v1h2a2 2 0 012 2v3.57A22.952 22.952 0 0110 13a22.95 22.95 0 01-8-1.43V8a2 2 0 012-2h2zm2-1a1 1 0 011-1h2a1 1 0 011 1v1H8V5zm1 5a1 1 0 011-1h.01a1 1 0 110 2H10a1 1 0 01-1-1z" clipRule="evenodd" />
                  <path d="M2 13.692V16a2 2 0 002 2h12a2 2 0 002-2v-2.308A24.974 24.974 0 0110 15c-2.796 0-5.487-.46-8-1.308z" />
                </svg>
                <span className="font-normal">Jobs</span>
                {currentView === 'jobs' && (
                  <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-gray-900"></div>
                )}
              </button>
              <button
                onClick={() => { setCurrentView('messaging'); setCurrentViewSubPage(null); }}
                className={`flex flex-col items-center text-xs group relative pb-3 ${
                  currentView === 'messaging' ? 'text-gray-700' : 'text-gray-600 hover:text-gray-900'
                }`}
              >
                <div className="relative">
                  <svg className="w-6 h-6 mb-0.5" fill="currentColor" viewBox="0 0 20 20">
                    <path d="M2 5a2 2 0 012-2h7a2 2 0 012 2v4a2 2 0 01-2 2H9l-3 3v-3H4a2 2 0 01-2-2V5z" />
                    <path d="M15 7v2a4 4 0 01-4 4H9.828l-1.766 1.767c.28.149.599.233.938.233h2l3 3v-3h2a2 2 0 002-2V9a2 2 0 00-2-2h-1z" />
                  </svg>
                  {contacts.reduce((sum, c) => sum + c.unread, 0) > 0 && (
                    <span className="absolute -top-1 -right-1 bg-red-500 text-white text-xs rounded-full w-4 h-4 flex items-center justify-center font-bold text-[10px]">
                      {contacts.reduce((sum, c) => sum + c.unread, 0)}
                    </span>
                  )}
                </div>
                <span className="font-normal">Messaging</span>
                {currentView === 'messaging' && (
                  <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-gray-900"></div>
                )}
              </button>
              <div className="relative">
                <button
                  onClick={() => setNotificationsDropdownOpen(!notificationsDropdownOpen)}
                  className="flex flex-col items-center text-xs text-gray-600 hover:text-gray-900 group pb-3"
                >
                  <div className="relative">
                    <svg className="w-6 h-6 mb-0.5" fill="currentColor" viewBox="0 0 20 20">
                      <path d="M10 2a6 6 0 00-6 6v3.586l-.707.707A1 1 0 004 14h12a1 1 0 00.707-1.707L16 11.586V8a6 6 0 00-6-6zM10 18a3 3 0 01-3-3h6a3 3 0 01-3 3z" />
                    </svg>
                    {unreadNotificationsCount > 0 && (
                      <span className="absolute -top-1 -right-1 bg-red-500 text-white text-xs rounded-full w-4 h-4 flex items-center justify-center font-bold text-[10px]">
                        {unreadNotificationsCount}
                      </span>
                    )}
                  </div>
                  <span className="font-normal">Notifications</span>
                </button>

                {/* Notifications Dropdown */}
                {notificationsDropdownOpen && (
                  <div className="absolute right-0 mt-2 w-96 bg-white border border-gray-300 rounded-lg shadow-xl z-50">
                    <div className="p-4 border-b border-gray-200">
                      <h3 className="font-semibold text-lg">Notifications</h3>
                    </div>
                    <div className="max-h-96 overflow-y-auto">
                      {notifications.map((notif) => (
                        <div
                          key={notif.id}
                          onClick={() => {
                            markNotificationAsRead(notif.id);
                            setNotificationsDropdownOpen(false);
                            // Navigate based on notification type
                            if (notif.type === 'like' || notif.type === 'comment') {
                              setCurrentView('feed');
                              setCurrentViewSubPage(null);
                            } else if (notif.type === 'connection') {
                              setCurrentView('my-network');
                              setCurrentViewSubPage(null);
                            } else if (notif.type === 'message') {
                              setCurrentView('messaging');
                              setCurrentViewSubPage(null);
                            } else if (notif.type === 'job') {
                              setCurrentView('jobs');
                              setCurrentViewSubPage(null);
                            }
                          }}
                          className={`p-4 border-b border-gray-100 hover:bg-gray-50 cursor-pointer ${!notif.read ? 'bg-blue-50' : ''}`}
                        >
                          <div className="flex items-start space-x-3">
                            <div className="w-10 h-10 rounded-full overflow-hidden flex-shrink-0 bg-white">
                              <img
                                src={notif.avatarUrl}
                                alt={notif.actor}
                                className="w-full h-full object-cover"
                              />
                            </div>
                            <div className="flex-1 min-w-0">
                              <p className="text-sm">
                                <span className="font-semibold">{notif.actor}</span>{' '}
                                <span className="text-gray-700">{notif.content}</span>
                              </p>
                              <p className="text-xs text-gray-500 mt-1">{notif.timestamp}</p>
                            </div>
                            {!notif.read && (
                              <div className="w-2 h-2 bg-blue-600 rounded-full"></div>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
              <div className="relative">
                <button
                  onClick={() => setProfileDropdownOpen(!profileDropdownOpen)}
                  className="flex flex-col items-center text-xs text-gray-600 hover:text-gray-900 cursor-pointer group pb-3"
                >
                  <div className="w-6 h-6 rounded-full overflow-hidden mb-0.5">
                    <img
                      src={selfAvatarUrl}
                      alt="Profile"
                      className="w-full h-full object-cover"
                    />
                  </div>
                  <span className="font-normal">Me</span>
                </button>

                {/* Profile Dropdown */}
                {profileDropdownOpen && (
                  <div className="absolute right-0 mt-2 w-72 bg-white border border-gray-300 rounded-lg shadow-xl z-50">
                    <div className="p-4 border-b border-gray-200">
                      <div className="flex items-center space-x-3">
                        <div className="w-16 h-16 rounded-full overflow-hidden bg-gradient-to-br from-blue-400 to-blue-600 flex items-center justify-center">
                          <img
                            src={selfAvatarUrl}
                            alt="Profile"
                            className="w-full h-full object-cover"
                          />
                        </div>
                        <div>
                          <h3 className="font-semibold text-sm">{selfUser?.name}</h3>
                          <p className="text-xs text-gray-600">{selfUser?.jobTitle}</p>
                        </div>
                      </div>
                      <button
                        onClick={() => { setProfileDropdownOpen(false); handleViewProfile('self'); }}
                        className="w-full mt-3 px-4 py-2 border border-blue-600 text-blue-600 rounded-full text-sm font-semibold hover:bg-blue-50 transition-colors"
                      >
                        View Profile
                      </button>
                    </div>
                    <div className="py-2">
                      <button
                        onClick={() => { setProfileDropdownOpen(false); setSettingsModalOpen(true); }}
                        className="flex items-center w-full px-4 py-3 text-sm text-gray-700 hover:bg-gray-50"
                      >
                        <svg className="w-5 h-5 mr-3 text-gray-600" fill="currentColor" viewBox="0 0 20 20">
                          <path fillRule="evenodd" d="M11.49 3.17c-.38-1.56-2.6-1.56-2.98 0a1.532 1.532 0 01-2.286.948c-1.372-.836-2.942.734-2.106 2.106.54.886.061 2.042-.947 2.287-1.561.379-1.561 2.6 0 2.978a1.532 1.532 0 01.947 2.287c-.836 1.372.734 2.942 2.106 2.106a1.532 1.532 0 012.287.947c.379 1.561 2.6 1.561 2.978 0a1.533 1.533 0 012.287-.947c1.372.836 2.942-.734 2.106-2.106a1.533 1.533 0 01.947-2.287c1.561-.379 1.561-2.6 0-2.978a1.532 1.532 0 01-.947-2.287c.836-1.372-.734-2.942-2.106-2.106a1.532 1.532 0 01-2.287-.947zM10 13a3 3 0 100-6 3 3 0 000 6z" clipRule="evenodd" />
                        </svg>
                        Settings & Privacy
                      </button>
                      <button
                        onClick={() => { setProfileDropdownOpen(false); setHelpModalOpen(true); }}
                        className="flex items-center w-full px-4 py-3 text-sm text-gray-700 hover:bg-gray-50"
                      >
                        <svg className="w-5 h-5 mr-3 text-gray-600" fill="currentColor" viewBox="0 0 20 20">
                          <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd" />
                        </svg>
                        Help
                      </button>
                      <button
                        onClick={() => { setProfileDropdownOpen(false); setIsSignedOut(true); }}
                        className="flex items-center w-full px-4 py-3 text-sm text-gray-700 hover:bg-gray-50"
                      >
                        <svg className="w-5 h-5 mr-3 text-gray-600" fill="currentColor" viewBox="0 0 20 20">
                          <path fillRule="evenodd" d="M3 3a1 1 0 00-1 1v12a1 1 0 102 0V4a1 1 0 00-1-1zm10.293 9.293a1 1 0 001.414 1.414l3-3a1 1 0 000-1.414l-3-3a1 1 0 10-1.414 1.414L14.586 9H7a1 1 0 100 2h7.586l-1.293 1.293z" clipRule="evenodd" />
                        </svg>
                        Sign Out
                      </button>
                    </div>
                  </div>
                )}
              </div>
            </nav>
          </div>
        </div>
      </header>

      {/* Click outside handlers - z-40 to be below dropdowns (z-50) but above content */}
      {(profileDropdownOpen || notificationsDropdownOpen || showSearchResults) && (
        <div
          className="fixed inset-0 z-40"
          onClick={() => {
            setProfileDropdownOpen(false);
            setNotificationsDropdownOpen(false);
            setShowSearchResults(false);
          }}
        />
      )}

      {/* Main Content */}
      {currentView === 'feed' && !currentViewSubPage && (
      <div className="max-w-7xl mx-auto py-6 px-4 flex space-x-6">
        {/* Left Sidebar */}
        <div className="w-56 flex-shrink-0 space-y-2">
          {/* Profile Card */}
          <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
            {/* Profile cover/banner */}
            <div className="h-12 relative overflow-hidden">
              <div className="absolute inset-0 bg-gradient-to-r from-red-500 via-green-400 to-blue-500 opacity-80"></div>
              {selfUser?.bannerUrl && (
                <img
                  src={selfUser.bannerUrl}
                  alt="Profile banner"
                  className="absolute inset-0 w-full h-full object-cover"
                />
              )}
            </div>
            <div className="px-3 pb-3 -mt-7 relative z-10">
              <div className="w-14 h-14 rounded-full border-2 border-white overflow-hidden mb-2 cursor-pointer bg-white shadow-sm" onClick={() => handleViewProfile('self')}>
                <img
                  src={selfAvatarUrl}
                  alt="Profile"
                  className="w-full h-full object-cover"
                />
              </div>
              <h3 className="font-semibold text-sm hover:underline cursor-pointer" onClick={() => handleViewProfile('self')}>{selfUser?.name}</h3>
              <p className="text-xs text-gray-600 mb-3">{selfUser?.jobTitle}</p>
            </div>
            <div
              className="border-t border-gray-200 px-3 py-2 hover:bg-gray-50 cursor-pointer"
              onClick={() => setProfileViewersOpen(true)}
            >
              <div className="flex items-center justify-between text-xs">
                <span className="text-gray-700">Profile viewers</span>
                <span className="text-blue-600 font-semibold">52</span>
              </div>
            </div>
          </div>

          {/* Company Card */}
          {(() => {
            const userCompany = allCompanies.find(c => c.id === 'company-themicrocorporate') || allCompanies[0];
            return userCompany ? (
              <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
                {/* Company cover image */}
                <div className="h-12 relative overflow-hidden">
                  <div className={`absolute inset-0 bg-gradient-to-r ${userCompany.color} opacity-70`}></div>
                  {userCompany.bannerUrl && (
                    <img
                      src={userCompany.bannerUrl}
                      alt={`${userCompany.name} banner`}
                      className="absolute inset-0 w-full h-full object-cover"
                    />
                  )}
                </div>
                <div className="px-3 pb-3 -mt-5 relative z-10">
                  {userCompany.logoUrl ? (
                    <img
                      src={userCompany.logoUrl}
                      alt={userCompany.name}
                      onClick={() => handleViewCompany(userCompany.id)}
                      className="w-10 h-10 rounded border-2 border-white mb-2 cursor-pointer hover:opacity-80 transition-opacity shadow-sm object-cover"
                    />
                  ) : (
                    <div
                      className={`w-10 h-10 bg-gradient-to-br ${userCompany.color} rounded flex items-center justify-center flex-shrink-0 border-2 border-white mb-2 cursor-pointer hover:opacity-80 transition-opacity shadow-sm`}
                      onClick={() => handleViewCompany(userCompany.id)}
                    >
                      <span className="text-white text-lg font-bold">{userCompany.initial}</span>
                    </div>
                  )}
                  <h4
                    className="font-semibold text-sm hover:underline cursor-pointer hover:text-blue-600"
                    onClick={() => handleViewCompany(userCompany.id)}
                  >
                    {userCompany.name}
                  </h4>
                </div>
                <div className="px-3 pb-3">
                  <div className="space-y-1.5 text-xs text-gray-600">
                    <div
                      className="flex justify-between hover:underline cursor-pointer"
                      onClick={() => setPageNotificationsOpen(true)}
                    >
                      <span>Page notifications</span>
                      <span className="font-semibold text-gray-900">134</span>
                    </div>
                    <div
                      className="flex justify-between hover:underline cursor-pointer"
                      onClick={() => setPageVisitorsOpen(true)}
                    >
                      <span>Page visitors</span>
                      <span className="font-semibold text-gray-900">276</span>
                    </div>
                  </div>
                </div>
              </div>
            ) : null;
          })()}

          {/* Quick Links */}
          <div className="bg-white rounded-lg border border-gray-200 py-1">
            <button onClick={() => setSavedItemsOpen(true)} className="w-full flex items-center space-x-2 px-3 py-2 text-xs text-gray-700 hover:bg-gray-50 transition-colors">
              <svg className="w-4 h-4 text-gray-600" fill="currentColor" viewBox="0 0 20 20">
                <path d="M5 4a2 2 0 012-2h6a2 2 0 012 2v14l-5-2.5L5 18V4z" />
              </svg>
              <span className="font-medium">Saved items</span>
            </button>
            <button onClick={() => setGroupsOpen(true)} className="w-full flex items-center space-x-2 px-3 py-2 text-xs text-gray-700 hover:bg-gray-50 transition-colors">
              <svg className="w-4 h-4 text-gray-600" fill="currentColor" viewBox="0 0 20 20">
                <path d="M13 6a3 3 0 11-6 0 3 3 0 016 0zM18 8a2 2 0 11-4 0 2 2 0 014 0zM14 15a4 4 0 00-8 0v3h8v-3zM6 8a2 2 0 11-4 0 2 2 0 014 0zM16 18v-3a5.972 5.972 0 00-.75-2.906A3.005 3.005 0 0119 15v3h-3zM4.75 12.094A5.973 5.973 0 004 15v3H1v-3a3 3 0 013.75-2.906z" />
              </svg>
              <span className="font-medium">Groups</span>
            </button>
            <button onClick={() => setNewslettersOpen(true)} className="w-full flex items-center space-x-2 px-3 py-2 text-xs text-gray-700 hover:bg-gray-50 transition-colors">
              <svg className="w-4 h-4 text-gray-600" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M2 5a2 2 0 012-2h8a2 2 0 012 2v10a2 2 0 002 2H4a2 2 0 01-2-2V5zm3 1h6v4H5V6zm6 6H5v2h6v-2z" clipRule="evenodd" />
                <path d="M15 7h1a2 2 0 012 2v5.5a1.5 1.5 0 01-3 0V7z" />
              </svg>
              <span className="font-medium">Newsletters</span>
            </button>
            <button onClick={() => setEventsOpen(true)} className="w-full flex items-center space-x-2 px-3 py-2 text-xs text-gray-700 hover:bg-gray-50 transition-colors">
              <svg className="w-4 h-4 text-gray-600" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M6 2a1 1 0 00-1 1v1H4a2 2 0 00-2 2v10a2 2 0 002 2h12a2 2 0 002-2V6a2 2 0 00-2-2h-1V3a1 1 0 10-2 0v1H7V3a1 1 0 00-1-1zm0 5a1 1 0 000 2h8a1 1 0 100-2H6z" clipRule="evenodd" />
              </svg>
              <span className="font-medium">Events</span>
            </button>
          </div>
        </div>

        {/* Main Feed */}
        <div className="flex-1 space-y-4">
          {/* Post Composer */}
          <div className="bg-white rounded-lg border border-gray-200 p-3">
            <div className="flex items-center space-x-3 mb-3">
              <div className="w-12 h-12 rounded-full overflow-hidden flex-shrink-0 bg-white">
                <img
                  src={selfAvatarUrl}
                  alt="Profile"
                  className="w-full h-full object-cover"
                />
              </div>
              <button
                onClick={() => setPostComposerOpen(true)}
                className="flex-1 px-4 py-3 border border-gray-400 rounded-full text-sm text-left text-gray-600 hover:bg-gray-100 cursor-pointer transition-colors"
              >
                Start a post
              </button>
            </div>
          </div>

          {/* Posts */}
          {posts.filter(post => !hiddenPosts.includes(post.id)).map((post) => (
            <div key={post.id} className="bg-white rounded-lg border border-gray-200 overflow-hidden">
              {/* Post Header */}
              <div className="p-3 flex items-start space-x-2">
                <div
                  className="w-12 h-12 rounded-full overflow-hidden flex-shrink-0 cursor-pointer bg-white"
                  onClick={() => {
                    const person = allPeople.find(p => p.name === post.author);
                    if (person) handleViewProfile(person.id);
                  }}
                >
                  <img
                    src={post.avatarUrl}
                    alt={post.author}
                    className="w-full h-full object-cover"
                  />
                </div>
                <div className="flex-1 min-w-0">
                  <h3
                    className="font-semibold text-sm hover:text-blue-600 cursor-pointer hover:underline"
                    onClick={() => {
                      const person = allPeople.find(p => p.name === post.author);
                      if (person) handleViewProfile(person.id);
                    }}
                  >
                    {post.author}
                  </h3>
                  <p className="text-xs text-gray-600">
                    {post.title} at{' '}
                    <span
                      className="hover:text-blue-600 hover:underline cursor-pointer font-medium"
                      onClick={(e) => {
                        e.stopPropagation();
                        const company = allCompanies.find(c =>
                          c.name.toLowerCase().includes(post.company.toLowerCase()) ||
                          post.company.toLowerCase().includes(c.name.toLowerCase())
                        );
                        if (company) handleViewCompany(company.id);
                      }}
                    >
                      {post.company}
                    </span>
                  </p>
                  <div className="flex items-center space-x-1 text-xs text-gray-500 mt-0.5">
                    <span>{post.timestamp}</span>
                    <span>•</span>
                    <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM4.332 8.027a6.012 6.012 0 011.912-2.706C6.512 5.73 6.974 6 7.5 6A1.5 1.5 0 019 7.5V8a2 2 0 004 0 2 2 0 011.523-1.943A5.977 5.977 0 0116 10c0 .34-.028.675-.083 1H15a2 2 0 00-2 2v2.197A5.973 5.973 0 0110 16v-2a2 2 0 00-2-2 2 2 0 01-2-2 2 2 0 00-1.668-1.973z" clipRule="evenodd" /></svg>
                  </div>
                </div>
                <button
                  onClick={() => handlePostOptionsOpen(post.id)}
                  className="text-gray-500 hover:text-gray-700 p-1 hover:bg-gray-100 rounded-full transition-colors"
                >
                  <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
                    <path d="M10 6a2 2 0 110-4 2 2 0 010 4zM10 12a2 2 0 110-4 2 2 0 010 4zM10 18a2 2 0 110-4 2 2 0 010 4z" />
                  </svg>
                </button>
              </div>

              {/* Post Content */}
              <div className="px-3 pb-2">
                <p className="text-sm text-gray-800">{post.content}</p>
              </div>

              {/* Post Image */}
              {post.imageUrl && (
                <div className="w-full">
                  <img
                    src={post.imageUrl}
                    alt={post.content}
                    className="w-full h-auto object-cover"
                  />
                </div>
              )}

              {/* Engagement Stats */}
              <div className="px-3 py-2 flex items-center justify-between text-xs text-gray-600">
                <div
                  className="flex items-center space-x-1 cursor-pointer hover:text-blue-600 hover:underline"
                  onClick={() => {
                    setSelectedReactionPost(post.id);
                    setReactionsModalOpen(true);
                  }}
                >
                  <div className="flex -space-x-1">
                    <div className="w-4 h-4 bg-blue-500 rounded-full flex items-center justify-center border border-white">
                      <svg className="w-2.5 h-2.5 text-white" fill="currentColor" viewBox="0 0 20 20">
                        <path d="M2 10.5a1.5 1.5 0 113 0v6a1.5 1.5 0 01-3 0v-6zM6 10.333v5.43a2 2 0 001.106 1.79l.05.025A4 4 0 008.943 18h5.416a2 2 0 001.962-1.608l1.2-6A2 2 0 0015.56 8H12V4a2 2 0 00-2-2 1 1 0 00-1 1v.667a4 4 0 01-.8 2.4L6.8 7.933a4 4 0 00-.8 2.4z" />
                      </svg>
                    </div>
                    <div className="w-4 h-4 bg-red-500 rounded-full flex items-center justify-center border border-white">
                      <svg className="w-2.5 h-2.5 text-white" fill="currentColor" viewBox="0 0 20 20">
                        <path fillRule="evenodd" d="M3.172 5.172a4 4 0 015.656 0L10 6.343l1.172-1.171a4 4 0 115.656 5.656L10 17.657l-6.828-6.829a4 4 0 010-5.656z" clipRule="evenodd" />
                      </svg>
                    </div>
                  </div>
                  <span className="ml-1">{post.likes}</span>
                </div>
                <button className="hover:text-blue-600 hover:underline">{post.comments.length} comments</button>
              </div>

              {/* Action Buttons */}
              <div className="px-1 py-1 border-t border-gray-200 flex items-center">
                <button
                  onClick={() => handleLike(post.id)}
                  className={`flex-1 flex items-center justify-center space-x-1.5 text-sm py-2 rounded hover:bg-gray-100 transition-colors font-medium ${
                    post.isLiked ? 'text-blue-600' : 'text-gray-600'
                  }`}
                >
                  <svg className="w-5 h-5" fill={post.isLiked ? "currentColor" : "none"} stroke="currentColor" viewBox="0 0 24 24" strokeWidth={post.isLiked ? 0 : 1.5}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M14 10h4.764a2 2 0 011.789 2.894l-3.5 7A2 2 0 0115.263 21h-4.017c-.163 0-.326-.02-.485-.06L7 20m7-10V5a2 2 0 00-2-2h-.095c-.5 0-.905.405-.905.905 0 .714-.211 1.412-.608 2.006L7 11v9m7-10h-2M7 20H5a2 2 0 01-2-2v-6a2 2 0 012-2h2.5" />
                  </svg>
                  <span>{post.isLiked ? 'Liked' : 'Like'}</span>
                </button>
                <button
                  onClick={() => handleComment(post.id)}
                  className="flex-1 flex items-center justify-center space-x-1.5 text-sm text-gray-600 py-2 rounded hover:bg-gray-100 transition-colors font-medium"
                >
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.5}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
                  </svg>
                  <span>Comment</span>
                </button>
                <button
                  onClick={handleShare}
                  className="flex-1 flex items-center justify-center space-x-1.5 text-sm text-gray-600 py-2 rounded hover:bg-gray-100 transition-colors font-medium"
                >
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.5}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M8.684 13.342C8.886 12.938 9 12.482 9 12c0-.482-.114-.938-.316-1.342m0 2.684a3 3 0 110-2.684m0 2.684l6.632 3.316m-6.632-6l6.632-3.316m0 0a3 3 0 105.367-2.684 3 3 0 00-5.367 2.684zm0 9.316a3 3 0 105.368 2.684 3 3 0 00-5.368-2.684z" />
                  </svg>
                  <span>Send</span>
                </button>
              </div>

              {/* Comments Section */}
              {post.comments.length > 0 && (
                <div className="border-t border-gray-200 px-4 py-3 bg-gray-50">
                  {post.comments.map((comment) => (
                    <div key={comment.id} className="flex items-start space-x-3 mb-3 last:mb-0">
                      <div className="w-8 h-8 rounded-full overflow-hidden flex-shrink-0 bg-white">
                        <img
                          src={comment.avatarUrl}
                          alt={comment.author}
                          className="w-full h-full object-cover"
                        />
                      </div>
                      <div className="flex-1 bg-white rounded-lg p-3">
                        <p className="text-xs font-semibold">{comment.author}</p>
                        <p className="text-sm text-gray-800 mt-1">{comment.content}</p>
                        <div className="flex items-center space-x-4 mt-2 text-xs text-gray-500">
                          <button className="hover:text-blue-600">Like</button>
                          <span>{comment.timestamp}</span>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          ))}

          {/* Loading Indicator */}
          {isLoading && posts.length === 0 && (
            <div className="text-center py-8 text-gray-500">
              <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
              <p className="mt-2 text-sm">Loading posts...</p>
            </div>
          )}
        </div>

        {/* Right Sidebar */}
        <div className="w-72 flex-shrink-0 space-y-2">
          {/* Add to Feed */}
          <div className="bg-white rounded-lg border border-gray-200 p-3">
            <div className="flex items-center justify-between mb-3">
              <h3 className="font-semibold text-sm">Add to your feed</h3>
              <div className="relative">
                <button
                  onClick={() => setFeedInfoTooltipOpen(!feedInfoTooltipOpen)}
                  className="p-1 rounded-full hover:bg-gray-100 transition-colors"
                  title="Learn more"
                >
                  <svg className="w-4 h-4 text-gray-400 hover:text-gray-600" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd" />
                  </svg>
                </button>
                {feedInfoTooltipOpen && (
                  <div className="absolute right-0 top-8 w-64 bg-white border border-gray-200 rounded-lg shadow-lg p-4 z-50">
                    <div className="flex items-start justify-between mb-2">
                      <h4 className="font-semibold text-sm">About these recommendations</h4>
                      <button onClick={() => setFeedInfoTooltipOpen(false)} className="text-gray-400 hover:text-gray-600">
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                        </svg>
                      </button>
                    </div>
                    <p className="text-xs text-gray-600">
                      These suggestions are based on your profile, connections, and activity on MicroDin. Follow companies to see their updates in your feed.
                    </p>
                  </div>
                )}
              </div>
            </div>
            <div className="space-y-3">
              {allCompanies.slice(0, 3).map((company) => (
                <div key={company.id} className="flex items-start space-x-2">
                  {company.logoUrl ? (
                    <img
                      src={company.logoUrl}
                      alt={company.name}
                      onClick={() => handleViewCompany(company.id)}
                      className="w-11 h-11 rounded-full flex-shrink-0 cursor-pointer hover:opacity-80 transition-opacity object-cover"
                    />
                  ) : (
                    <div
                      className={`w-11 h-11 rounded-full bg-gradient-to-br ${company.color} flex items-center justify-center flex-shrink-0 cursor-pointer hover:opacity-80 transition-opacity`}
                      onClick={() => handleViewCompany(company.id)}
                    >
                      <span className="text-white font-bold text-xs">{company.initial}</span>
                    </div>
                  )}
                  <div className="flex-1 min-w-0">
                    <h4
                      className="font-semibold text-sm hover:text-blue-600 cursor-pointer hover:underline"
                      onClick={() => handleViewCompany(company.id)}
                    >
                      {company.name}
                    </h4>
                    <p className="text-xs text-gray-600 mb-1.5">Company • {company.industry}</p>
                    <button
                      onClick={() => handleFollowToggle(company.name)}
                      className={`px-3 py-1 border-2 rounded-full text-xs font-semibold transition-colors ${
                        followedCompanies.includes(company.name)
                          ? 'border-gray-500 text-gray-700 hover:bg-gray-50'
                          : 'border-gray-500 text-gray-700 hover:border-gray-700 hover:bg-gray-50'
                      }`}
                    >
                      {followedCompanies.includes(company.name) ? 'Following' : '+ Follow'}
                    </button>
                  </div>
                </div>
              ))}
            </div>
            <button className="mt-3 text-sm text-gray-600 hover:bg-gray-100 w-full text-left px-2 py-1 rounded font-medium flex items-center">
              View all recommendations
              <svg className="w-3 h-3 ml-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
              </svg>
            </button>
          </div>
        </div>
      </div>
      )}

      {/* My Network View */}
      {currentView === 'my-network' && currentViewSubPage !== 'company' && (
        <div className="max-w-7xl mx-auto py-6 px-4 flex space-x-6">
          {/* Left Sidebar - Manage my network */}
          <div className="w-64 flex-shrink-0">
            <div className="bg-white rounded-lg border border-gray-200 p-4">
              <h2 className="font-semibold text-lg mb-4">Manage my network</h2>
              <div className="space-y-3">
                <button
                  onClick={() => setNetworkSectionView(networkSectionView === 'connections' ? null : 'connections')}
                  className={`w-full flex items-center justify-between text-sm p-2 rounded transition-colors ${networkSectionView === 'connections' ? 'bg-blue-50 text-blue-600' : 'text-gray-700 hover:text-blue-600 hover:bg-gray-50'}`}
                >
                  <div className="flex items-center space-x-2">
                    <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                      <path d="M9 6a3 3 0 11-6 0 3 3 0 016 0zM17 6a3 3 0 11-6 0 3 3 0 016 0zM12.93 17c.046-.327.07-.66.07-1a6.97 6.97 0 00-1.5-4.33A5 5 0 0119 16v1h-6.07zM6 11a5 5 0 015 5v1H1v-1a5 5 0 015-5z" />
                    </svg>
                    <span>Connections</span>
                  </div>
                  <span className="text-gray-600">{62 + connectedUserIds.size}</span>
                </button>
                <button
                  onClick={() => setNetworkSectionView(networkSectionView === 'followers' ? null : 'followers')}
                  className={`w-full flex items-center justify-between text-sm p-2 rounded transition-colors ${networkSectionView === 'followers' ? 'bg-blue-50 text-blue-600' : 'text-gray-700 hover:text-blue-600 hover:bg-gray-50'}`}
                >
                  <div className="flex items-center space-x-2">
                    <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                      <path d="M13 6a3 3 0 11-6 0 3 3 0 016 0zM18 8a2 2 0 11-4 0 2 2 0 014 0zM14 15a4 4 0 00-8 0v3h8v-3zM6 8a2 2 0 11-4 0 2 2 0 014 0zM16 18v-3a5.972 5.972 0 00-.75-2.906A3.005 3.005 0 0119 15v3h-3zM4.75 12.094A5.973 5.973 0 004 15v3H1v-3a3 3 0 013.75-2.906z" />
                    </svg>
                    <span>Following & followers</span>
                  </div>
                </button>
                <button
                  onClick={() => setNetworkSectionView(networkSectionView === 'groups' ? null : 'groups')}
                  className={`w-full flex items-center justify-between text-sm p-2 rounded transition-colors ${networkSectionView === 'groups' ? 'bg-blue-50 text-blue-600' : 'text-gray-700 hover:text-blue-600 hover:bg-gray-50'}`}
                >
                  <div className="flex items-center space-x-2">
                    <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                      <path d="M13 6a3 3 0 11-6 0 3 3 0 016 0zM18 8a2 2 0 11-4 0 2 2 0 014 0zM14 15a4 4 0 00-8 0v3h8v-3zM6 8a2 2 0 11-4 0 2 2 0 014 0zM16 18v-3a5.972 5.972 0 00-.75-2.906A3.005 3.005 0 0119 15v3h-3zM4.75 12.094A5.973 5.973 0 004 15v3H1v-3a3 3 0 013.75-2.906z" />
                    </svg>
                    <span>Groups</span>
                  </div>
                  <span className="text-gray-600">{allCompanies.slice(0, 8).length + followedGroups.length}</span>
                </button>
                <button
                  onClick={() => setNetworkSectionView(networkSectionView === 'events' ? null : 'events')}
                  className={`w-full flex items-center justify-between text-sm p-2 rounded transition-colors ${networkSectionView === 'events' ? 'bg-blue-50 text-blue-600' : 'text-gray-700 hover:text-blue-600 hover:bg-gray-50'}`}
                >
                  <div className="flex items-center space-x-2">
                    <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                      <path fillRule="evenodd" d="M6 2a1 1 0 00-1 1v1H4a2 2 0 00-2 2v10a2 2 0 002 2h12a2 2 0 002-2V6a2 2 0 00-2-2h-1V3a1 1 0 10-2 0v1H7V3a1 1 0 00-1-1zm0 5a1 1 0 000 2h8a1 1 0 100-2H6z" clipRule="evenodd" />
                    </svg>
                    <span>Events</span>
                  </div>
                  <span className="text-gray-600">6</span>
                </button>
                <button
                  onClick={() => setNetworkSectionView(networkSectionView === 'pages' ? null : 'pages')}
                  className={`w-full flex items-center justify-between text-sm p-2 rounded transition-colors ${networkSectionView === 'pages' ? 'bg-blue-50 text-blue-600' : 'text-gray-700 hover:text-blue-600 hover:bg-gray-50'}`}
                >
                  <div className="flex items-center space-x-2">
                    <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                      <path d="M2 6a2 2 0 012-2h5l2 2h5a2 2 0 012 2v6a2 2 0 01-2 2H4a2 2 0 01-2-2V6z" />
                    </svg>
                    <span>Pages</span>
                  </div>
                  <span className="text-gray-600">{followedCompanies.length + 8}</span>
                </button>
                <button
                  onClick={() => setNetworkSectionView(networkSectionView === 'newsletters' ? null : 'newsletters')}
                  className={`w-full flex items-center justify-between text-sm p-2 rounded transition-colors ${networkSectionView === 'newsletters' ? 'bg-blue-50 text-blue-600' : 'text-gray-700 hover:text-blue-600 hover:bg-gray-50'}`}
                >
                  <div className="flex items-center space-x-2">
                    <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                      <path fillRule="evenodd" d="M2 5a2 2 0 012-2h8a2 2 0 012 2v10a2 2 0 002 2H4a2 2 0 01-2-2V5zm3 1h6v4H5V6zm6 6H5v2h6v-2z" clipRule="evenodd" />
                      <path d="M15 7h1a2 2 0 012 2v5.5a1.5 1.5 0 01-3 0V7z" />
                    </svg>
                    <span>Newsletter</span>
                  </div>
                  <span className="text-gray-600">6</span>
                </button>
              </div>
            </div>
          </div>

          {/* Main Content */}
          <div className="flex-1 space-y-4">
            {/* Network Section Content - shows when a sidebar item is selected */}
            {networkSectionView === 'connections' && (
              <div className="bg-white rounded-lg border border-gray-200 p-4">
                <div className="flex items-center justify-between mb-4">
                  <h2 className="font-semibold text-lg">Connections ({62 + connectedUserIds.size})</h2>
                  <button onClick={() => setNetworkSectionView(null)} className="text-sm text-gray-600 hover:text-blue-600 font-medium">Close</button>
                </div>
                <div className="grid grid-cols-3 gap-4">
                  {allPeople.slice(0, 12).map((person) => (
                    <div key={person.id} className="flex items-center space-x-3 p-3 border border-gray-200 rounded-lg hover:bg-gray-50">
                      {person.avatarUrl ? (
                        <img src={person.avatarUrl} alt={person.name} className="w-12 h-12 rounded-full object-cover" />
                      ) : (
                        <div className="w-12 h-12 rounded-full bg-gradient-to-br from-blue-400 to-blue-600 flex items-center justify-center">
                          <span className="text-2xl">{person.avatar}</span>
                        </div>
                      )}
                      <div className="flex-1 min-w-0">
                        <h4 className="font-semibold text-sm truncate hover:text-blue-600 cursor-pointer" onClick={() => handleViewProfile(person.id)}>{person.name}</h4>
                        <p className="text-xs text-gray-600 truncate">{person.title}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {networkSectionView === 'followers' && (
              <div className="bg-white rounded-lg border border-gray-200 p-4">
                <div className="flex items-center justify-between mb-4">
                  <h2 className="font-semibold text-lg">Following & followers</h2>
                  <button onClick={() => setNetworkSectionView(null)} className="text-sm text-gray-600 hover:text-blue-600 font-medium">Close</button>
                </div>
                <div className="space-y-4">
                  <div>
                    <h3 className="font-medium text-sm text-gray-700 mb-3">Following ({followedCompanies.length})</h3>
                    {followedCompanies.length > 0 ? (
                      <div className="grid grid-cols-3 gap-3">
                        {followedCompanies.map((name) => (
                          <div key={name} className="p-3 border border-gray-200 rounded-lg text-sm">{name}</div>
                        ))}
                      </div>
                    ) : (
                      <p className="text-sm text-gray-500">Not following any companies yet</p>
                    )}
                  </div>
                </div>
              </div>
            )}

            {networkSectionView === 'groups' && (
              <div className="bg-white rounded-lg border border-gray-200 p-4">
                <div className="flex items-center justify-between mb-4">
                  <h2 className="font-semibold text-lg">Groups ({allCompanies.slice(0, 8).length + followedGroups.length})</h2>
                  <button onClick={() => setNetworkSectionView(null)} className="text-sm text-gray-600 hover:text-blue-600 font-medium">Close</button>
                </div>
                <div className="grid grid-cols-3 gap-4">
                  {allCompanies.slice(0, 8).map((company) => {
                    const groupId = `${company.industry}-group`;
                    const isFollowing = followedGroups.includes(groupId);
                    return (
                      <div key={company.id} className="border border-gray-200 rounded-lg overflow-hidden hover:shadow-md transition-shadow">
                        <div className={`h-16 bg-gradient-to-br ${company.color}`}></div>
                        <div className="p-3">
                          <h3 className="font-semibold text-sm mb-1">{company.industry} Group</h3>
                          <p className="text-xs text-gray-600 mb-2">{company.followers.toLocaleString()} members</p>
                          <button
                            onClick={() => {
                              if (isFollowing) {
                                setFollowedGroups(followedGroups.filter(g => g !== groupId));
                              } else {
                                setFollowedGroups([...followedGroups, groupId]);
                              }
                            }}
                            className={`w-full py-1 text-xs font-semibold rounded-full ${
                              isFollowing
                                ? 'bg-green-100 text-green-700 border border-green-300'
                                : 'bg-blue-600 text-white hover:bg-blue-700'
                            }`}
                          >
                            {isFollowing ? 'Joined' : 'Join'}
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {networkSectionView === 'events' && (
              <div className="bg-white rounded-lg border border-gray-200 p-4">
                <div className="flex items-center justify-between mb-4">
                  <h2 className="font-semibold text-lg">Your Events (6)</h2>
                  <button onClick={() => setNetworkSectionView(null)} className="text-sm text-gray-600 hover:text-blue-600 font-medium">Close</button>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  {[
                    { title: 'Tech Conference 2024', date: '15 Jul 2024' },
                    { title: 'Marketing Summit 2024', date: '20 Aug 2024' },
                    { title: 'Startup Pitch Night', date: '05 Sep 2024' },
                    { title: 'AI & Robotics Expo', date: '10 Oct 2024' },
                    { title: 'Healthcare Innovation Forum', date: '12 Nov 2024' },
                    { title: 'Sustainable Energy Symposium', date: '01 Dec 2024' }
                  ].map((event) => (
                    <div key={event.title} className="p-4 border border-gray-200 rounded-lg hover:bg-gray-50">
                      <h4 className="font-semibold text-sm">{event.title}</h4>
                      <p className="text-xs text-gray-600 mt-1">{event.date}</p>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {networkSectionView === 'pages' && (
              <div className="bg-white rounded-lg border border-gray-200 p-4">
                <div className="flex items-center justify-between mb-4">
                  <h2 className="font-semibold text-lg">Pages ({followedCompanies.length + 8})</h2>
                  <button onClick={() => setNetworkSectionView(null)} className="text-sm text-gray-600 hover:text-blue-600 font-medium">Close</button>
                </div>
                <div className="grid grid-cols-3 gap-4">
                  {allCompanies.slice(0, 9).map((company) => (
                    <div key={company.id} className="flex items-center space-x-3 p-3 border border-gray-200 rounded-lg hover:bg-gray-50 cursor-pointer" onClick={() => handleViewCompany(company.id)}>
                      {company.logoUrl ? (
                        <img
                          src={company.logoUrl}
                          alt={company.name}
                          className="w-10 h-10 rounded flex-shrink-0 object-cover"
                        />
                      ) : (
                        <div className={`w-10 h-10 bg-gradient-to-br ${company.color} rounded flex items-center justify-center flex-shrink-0`}>
                          <span className="text-white font-bold">{company.initial}</span>
                        </div>
                      )}
                      <div className="flex-1 min-w-0">
                        <h4 className="font-semibold text-sm truncate">{company.name}</h4>
                        <p className="text-xs text-gray-600">{company.followers.toLocaleString()} followers</p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {networkSectionView === 'newsletters' && (
              <div className="bg-white rounded-lg border border-gray-200 p-4">
                <div className="flex items-center justify-between mb-4">
                  <h2 className="font-semibold text-lg">Newsletters (6)</h2>
                  <button onClick={() => setNetworkSectionView(null)} className="text-sm text-gray-600 hover:text-blue-600 font-medium">Close</button>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  {[
                    { title: 'Tech Insider Weekly', author: 'TechCrunch', subscribers: '125K' },
                    { title: 'AI Frontiers', author: 'MIT Tech Review', subscribers: '89K' },
                    { title: 'Startup Digest', author: 'Y Combinator', subscribers: '256K' },
                    { title: 'Finance Forward', author: 'Bloomberg', subscribers: '312K' },
                    { title: 'Career Growth Tips', author: 'Harvard BR', subscribers: '178K' },
                    { title: 'Design Weekly', author: 'IDEO', subscribers: '67K' }
                  ].map((newsletter) => (
                    <div key={newsletter.title} className="p-4 border border-gray-200 rounded-lg hover:bg-gray-50">
                      <h4 className="font-semibold text-sm">{newsletter.title}</h4>
                      <p className="text-xs text-gray-600 mt-1">By {newsletter.author}</p>
                      <p className="text-xs text-gray-500 mt-1">{newsletter.subscribers} subscribers</p>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Default content - shows when no sidebar item is selected */}
            {!networkSectionView && (
              <>
            {/* Invitations - Using JSONL connections data */}
            <div className="bg-white rounded-lg border border-gray-200 p-4">
              <div className="flex items-center justify-between mb-4">
                <h2 className="font-semibold text-lg">Invitations ({connectionInvitations.filter(c => c.status === "pending" && !ignoredInvitationIds.has(c.id)).length})</h2>
                <button onClick={() => setShowAllInvitationsModal(true)} className="text-sm text-gray-600 hover:text-blue-600 font-medium">Show all</button>
              </div>
              <div className="space-y-3">
                {connectionInvitations
                  .filter(conn => conn.status === "pending" && !ignoredInvitationIds.has(conn.id))
                  .slice(0, 3)
                  .map((invitation) => (
                    <div key={invitation.id} className="flex items-start space-x-3 p-3 hover:bg-gray-50 rounded">
                      <div className="w-16 h-16 rounded-full overflow-hidden flex-shrink-0 bg-white">
                        <img
                          src={invitation.avatarUrl}
                          alt={invitation.name}
                          className="w-full h-full object-cover"
                        />
                      </div>
                      <div className="flex-1">
                        <h3
                          className="font-semibold text-base hover:text-blue-600 cursor-pointer hover:underline"
                          onClick={() => {
                            const person = allPeople.find(p => p.name === invitation.name);
                            if (person) handleViewProfile(person.id);
                          }}
                        >
                          {invitation.name}
                        </h3>
                        <p className="text-sm text-gray-600 mb-1">{invitation.title}</p>
                        <p className="text-xs text-gray-500 mb-2">{invitation.mutualConnections} mutual connections</p>
                        <div className="flex space-x-2">
                          <button
                            onClick={() => handleIgnoreInvitation(invitation.id)}
                            className="px-5 py-1.5 border border-gray-700 text-gray-700 rounded-full text-sm font-semibold hover:bg-gray-50 hover:border-gray-900 transition-colors"
                          >
                            Ignore
                          </button>
                          <button
                            onClick={() => handleAcceptInvitation(invitation.id, invitation.userId)}
                            className="px-5 py-1.5 bg-blue-600 text-white rounded-full text-sm font-semibold hover:bg-blue-700 transition-colors"
                          >
                            Accept
                          </button>
                        </div>
                      </div>
                    </div>
                  ))}
              </div>
            </div>

            {/* Based on your recent activity */}
            <div className="bg-white rounded-lg border border-gray-200 p-4">
              <h2 className="font-semibold text-lg mb-4">Based on your recent activity</h2>
              <div className="grid grid-cols-4 gap-4">
                {(() => {
                  // Get user IDs from pending invitations to filter them out
                  const pendingInviterIds = new Set(
                    connectionInvitations
                      .filter(c => c.status === "pending")
                      .map(c => c.userId)
                  );
                  // Filter out people who have pending invitations and already connected
                  return allPeople
                    .filter(p => !pendingInviterIds.has(p.id) && !connectedUserIds.has(p.id))
                    .slice(0, 8)
                    .map((person, idx) => ({
                      id: person.id,
                      name: person.name,
                      title: person.title,
                      avatarUrl: person.avatarUrl,
                      gradient: CARD_GRADIENTS[idx % CARD_GRADIENTS.length]
                    }));
                })().map((person) => (
                  <div key={person.name} className="border border-gray-200 rounded-lg overflow-hidden hover:shadow-md transition-shadow">
                    <div className={`relative h-20 bg-gradient-to-r ${person.gradient}`}>
                      <div className="absolute -bottom-8 left-1/2 transform -translate-x-1/2">
                        <div className="w-16 h-16 rounded-full border-2 border-white overflow-hidden bg-white">
                          <img
                            src={person.avatarUrl}
                            alt={person.name}
                            className="w-full h-full object-cover"
                          />
                        </div>
                      </div>
                    </div>
                    <div className="pt-10 px-3 pb-3 text-center">
                      <h3
                        className="font-semibold text-sm hover:text-blue-600 cursor-pointer hover:underline mb-1"
                        onClick={() => handleViewProfile(person.id)}
                      >
                        {person.name}
                      </h3>
                      <p className="text-xs text-gray-600 line-clamp-2 mb-3 h-8">{person.title}</p>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          handleConnect(person.id);
                        }}
                        className="w-full py-1.5 border-2 border-blue-600 text-blue-600 rounded-full text-xs font-semibold hover:bg-blue-50 flex items-center justify-center"
                      >
                        <svg className="w-3 h-3 mr-1" fill="currentColor" viewBox="0 0 20 20">
                          <path d="M8 9a3 3 0 100-6 3 3 0 000 6zM8 11a6 6 0 016 6H2a6 6 0 016-6zM16 7a1 1 0 10-2 0v1h-1a1 1 0 100 2h1v1a1 1 0 102 0v-1h1a1 1 0 100-2h-1V7z" />
                        </svg>
                        Connect
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Online events for you */}
            <div className="bg-white rounded-lg border border-gray-200 p-4">
              <div className="flex items-center justify-between mb-4">
                <h2 className="font-semibold text-lg">Online events for you</h2>
                <button onClick={() => setShowAllEventsModal(true)} className="text-sm text-gray-600 hover:text-blue-600">Show all</button>
              </div>
              <div className="grid grid-cols-3 gap-4">
                {[
                  { title: 'Tech Conference 2024', date: '15 Jul 2024', attendees: 350, gradient: CARD_GRADIENTS[0] },
                  { title: 'Marketing Summit 2024', date: '20 Aug 2024', attendees: 250, gradient: CARD_GRADIENTS[1] },
                  { title: 'Startup Pitch Night', date: '05 Sep 2024', attendees: 200, gradient: CARD_GRADIENTS[2] },
                  { title: 'AI & Robotics Expo', date: '10 Oct 2024', attendees: 500, gradient: CARD_GRADIENTS[3] },
                  { title: 'Healthcare Innovation Forum', date: '12 Nov 2024', attendees: 400, gradient: CARD_GRADIENTS[4] },
                  { title: 'Sustainable Energy Symposium', date: '01 Dec 2024', attendees: 300, gradient: CARD_GRADIENTS[5] }
                ].map((event) => (
                  <div key={event.title} className="border border-gray-200 rounded-lg overflow-hidden hover:shadow-md transition-shadow">
                    <div className={`w-full h-32 bg-gradient-to-r ${event.gradient}`} />
                    <div className="p-3">
                      <h3 className="font-semibold text-sm mb-1">{event.title}</h3>
                      <p className="text-xs text-gray-600 mb-1">{event.date}</p>
                      <div className="flex items-center text-xs text-gray-600 mb-3">
                        <svg className="w-3 h-3 mr-1" fill="currentColor" viewBox="0 0 20 20">
                          <path d="M9 6a3 3 0 11-6 0 3 3 0 016 0zM17 6a3 3 0 11-6 0 3 3 0 016 0zM12.93 17c.046-.327.07-.66.07-1a6.97 6.97 0 00-1.5-4.33A5 5 0 0119 16v1h-6.07zM6 11a5 5 0 015 5v1H1v-1a5 5 0 015-5z" />
                        </svg>
                        <span>{event.attendees} attendees</span>
                      </div>
                      <button
                        onClick={() => {
                          setSelectedEvent({ title: event.title, date: event.date, attendees: event.attendees });
                          setEventInterestModalOpen(true);
                        }}
                        className="w-full py-1.5 border-2 border-blue-600 text-blue-600 rounded-full text-xs font-semibold hover:bg-blue-50"
                      >
                        View
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Groups you might be interested in */}
            <div className="bg-white rounded-lg border border-gray-200 p-4">
              <div className="flex items-center justify-between mb-4">
                <h2 className="font-semibold text-lg">Groups you might be interested in</h2>
                <button onClick={() => setShowAllGroupsModal(true)} className="text-sm text-gray-600 hover:text-blue-600">Show all</button>
              </div>
              <div className="grid grid-cols-4 gap-4">
                {allCompanies.slice(0, 8).map((company, idx) => {
                  return (
                  <div key={company.id} className="border border-gray-200 rounded-lg overflow-hidden hover:shadow-md transition-shadow">
                    <div className={`w-full h-24 bg-gradient-to-r ${CARD_GRADIENTS[idx % CARD_GRADIENTS.length]}`} />
                    <div className="p-3">
                      <h3 className="font-semibold text-sm mb-1">{company.industry} Group</h3>
                      <p className="text-xs text-gray-600 mb-3">{company.followers.toLocaleString()} followers</p>
                      <button
                        onClick={() => {
                          const groupId = `${company.industry}-group`;
                          if (followedGroups.includes(groupId)) {
                            setFollowedGroups(followedGroups.filter(g => g !== groupId));
                          } else {
                            setFollowedGroups([...followedGroups, groupId]);
                          }
                        }}
                        className={`w-full py-1.5 border-2 rounded-full text-xs font-semibold flex items-center justify-center ${
                          followedGroups.includes(`${company.industry}-group`)
                            ? 'border-green-600 text-green-600 bg-green-50'
                            : 'border-gray-500 text-gray-700 hover:border-gray-700 hover:bg-gray-50'
                        }`}
                      >
                        {followedGroups.includes(`${company.industry}-group`) ? (
                          <>
                            <svg className="w-3 h-3 mr-1" fill="currentColor" viewBox="0 0 20 20">
                              <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                            </svg>
                            Following
                          </>
                        ) : (
                          <>
                            <svg className="w-3 h-3 mr-1" fill="currentColor" viewBox="0 0 20 20">
                              <path fillRule="evenodd" d="M10 5a1 1 0 011 1v3h3a1 1 0 110 2h-3v3a1 1 0 11-2 0v-3H6a1 1 0 110-2h3V6a1 1 0 011-1z" clipRule="evenodd" />
                            </svg>
                            Follow
                          </>
                        )}
                      </button>
                    </div>
                  </div>
                  );
                })}
              </div>
            </div>
              </>
            )}
          </div>
        </div>
      )}

      {/* Profile View */}
      {currentView === 'profile' && !currentViewSubPage && (
        <div className="max-w-5xl mx-auto py-6 px-4">
          {/* Profile Header Card */}
          <div className="bg-white rounded-lg border border-gray-200 overflow-hidden mb-4">
            {/* Cover Photo */}
            <div className="h-48 bg-gradient-to-r from-purple-500 via-pink-500 to-orange-500 relative">
              {viewedPerson.bannerUrl && (
                <img
                  src={viewedPerson.bannerUrl}
                  alt="Profile banner"
                  className="w-full h-full object-cover absolute inset-0"
                />
              )}
            </div>

            {/* Profile Info */}
            <div className="px-6 pb-6 -mt-16">
              <div className="flex justify-between">
                {viewedPerson.avatarUrl ? (
                  <div className="w-36 h-36 rounded-full border-4 border-white overflow-hidden bg-white relative z-10">
                    <img
                      src={viewedPerson.avatarUrl}
                      alt={viewedPerson.name}
                      className="w-full h-full object-cover"
                    />
                  </div>
                ) : (
                  <div className="w-36 h-36 rounded-full border-4 border-white bg-gradient-to-br from-blue-400 to-blue-600 flex items-center justify-center relative z-10">
                    <span className="text-6xl">{viewedPerson.avatar}</span>
                  </div>
                )}
                <div className="mt-20 flex space-x-2">
                  {viewedPersonId === 'self' ? (
                    <>
                      <button
                        onClick={() => setAddSectionModalOpen(true)}
                        className="px-6 py-2 border-2 border-blue-600 text-blue-600 rounded-full text-sm font-semibold hover:bg-blue-50 transition-colors"
                      >
                        Add section
                      </button>
                      <button
                        onClick={() => setOpenToModalOpen(true)}
                        className="px-6 py-2 bg-blue-600 text-white rounded-full text-sm font-semibold hover:bg-blue-700 transition-colors"
                      >
                        Open to
                      </button>
                    </>
                  ) : (
                    <>
                      {isConnected(viewedPersonId) ? (
                        <button className="px-6 py-2 border-2 border-gray-300 text-gray-700 rounded-full text-sm font-semibold flex items-center space-x-1">
                          <svg className="w-4 h-4 text-green-600" fill="currentColor" viewBox="0 0 20 20">
                            <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                          </svg>
                          <span>Connected</span>
                        </button>
                      ) : (
                        <button
                          onClick={() => handleConnect(viewedPersonId)}
                          className="px-6 py-2 bg-blue-600 text-white rounded-full text-sm font-semibold hover:bg-blue-700 transition-colors"
                        >
                          Connect
                        </button>
                      )}
                      <button
                        onClick={() => handleMessagePerson(viewedPerson.name)}
                        className="px-6 py-2 border-2 border-gray-300 text-gray-700 rounded-full text-sm font-semibold hover:bg-gray-50 transition-colors"
                      >
                        Message
                      </button>
                    </>
                  )}
                </div>
              </div>

              <div className="mt-4">
                <h1 className="text-2xl font-bold">{viewedPerson.name}</h1>
                <p className="text-lg text-gray-700 mt-1">{viewedPerson.title}, {viewedPerson.company}</p>
                <p className="text-sm text-gray-600 mt-2">{viewedPerson.location}</p>
                <div className="mt-4 flex items-center space-x-4 text-sm">
                  <button
                    onClick={handleViewConnections}
                    className="text-blue-600 hover:underline font-semibold"
                  >
                    {viewedPerson.connections} connections
                  </button>
                  <button onClick={() => setContactInfoModalOpen(true)} className="text-blue-600 hover:underline font-semibold">Contact info</button>
                </div>
              </div>
            </div>
          </div>

          {/* About Section */}
          <div className="bg-white rounded-lg border border-gray-200 p-6 mb-4">
            <h2 className="text-xl font-semibold mb-4">About</h2>
            <p className="text-sm text-gray-700 leading-relaxed whitespace-pre-line">
              {viewedPerson.about}
            </p>
          </div>

          {/* Experience Section */}
          <div className="bg-white rounded-lg border border-gray-200 p-6 mb-4">
            <h2 className="text-xl font-semibold mb-4">Experience</h2>

            <div className="space-y-6">
              {viewedPerson.experience.map((exp, idx) => (
                <div key={idx} className="flex items-start space-x-3">
                  <div className={`w-12 h-12 ${exp.companyColor} rounded flex items-center justify-center flex-shrink-0 cursor-pointer hover:opacity-80 transition-opacity`}
                    onClick={() => {
                      const company = allCompanies.find(c => c.name === exp.company || c.name.includes(exp.company));
                      if (company) handleViewCompany(company.id);
                    }}
                  >
                    <span className="text-white font-bold text-xl">{exp.companyInitial}</span>
                  </div>
                  <div className="flex-1">
                    <h3 className="font-semibold">{exp.role}</h3>
                    <p className="text-sm text-gray-700 hover:underline cursor-pointer"
                      onClick={() => {
                        const company = allCompanies.find(c => c.name === exp.company || c.name.includes(exp.company));
                        if (company) handleViewCompany(company.id);
                      }}
                    >{exp.company}</p>
                    <p className="text-xs text-gray-500 mt-1">{exp.duration}</p>
                    <p className="text-xs text-gray-500">{exp.location}</p>
                    {exp.description && (
                      <p className="text-sm text-gray-700 mt-2">{exp.description}</p>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Education Section */}
          <div className="bg-white rounded-lg border border-gray-200 p-6 mb-4">
            <h2 className="text-xl font-semibold mb-4">Education</h2>

            <div className="space-y-6">
              {viewedPerson.education.map((edu, idx) => (
                <div key={idx} className="flex items-start space-x-3">
                  <div className={`w-12 h-12 ${edu.color} rounded flex items-center justify-center flex-shrink-0`}>
                    <span className="text-white font-bold">{edu.initial}</span>
                  </div>
                  <div className="flex-1">
                    <h3 className="font-semibold">{edu.degree}</h3>
                    <p className="text-sm text-gray-700">{edu.school}</p>
                    <p className="text-xs text-gray-500 mt-1">{edu.years}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Skills Section */}
          <div className="bg-white rounded-lg border border-gray-200 p-6">
            <h2 className="text-xl font-semibold mb-4">Skills</h2>
            <div className="flex flex-wrap gap-2">
              {viewedPerson.skills.map((skill) => (
                <span key={skill} className="px-3 py-1.5 bg-gray-100 text-gray-800 rounded-full text-sm">
                  {skill}
                </span>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Connections List View */}
      {currentView === 'profile' && currentViewSubPage === 'connections' && (
        <div className="max-w-5xl mx-auto py-6 px-4">
          <div className="bg-white rounded-lg border border-gray-200 p-6">
            <button
              onClick={handleBackFromSubPage}
              className="flex items-center text-gray-600 hover:text-gray-900 mb-4"
            >
              <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
              </svg>
              Back to Profile
            </button>
            <h1 className="text-2xl font-bold mb-6">{viewedPerson.name}'s Connections</h1>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {allPeople.filter(p => p.id !== viewedPersonId).slice(0, 10).map((person) => (
                <div key={person.id} className="flex items-start space-x-3 p-4 border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors">
                  <div className="w-16 h-16 rounded-full overflow-hidden bg-white cursor-pointer" onClick={() => handleViewProfile(person.id)}>
                    <img
                      src={person.avatarUrl}
                      alt={person.name}
                      className="w-full h-full object-cover"
                    />
                  </div>
                  <div className="flex-1 min-w-0">
                    <h3
                      className="font-semibold hover:text-blue-600 cursor-pointer hover:underline"
                      onClick={() => handleViewProfile(person.id)}
                    >
                      {person.name}
                    </h3>
                    <p className="text-sm text-gray-600">{person.title} at {person.company}</p>
                    <p className="text-xs text-gray-500">{person.connections} connections</p>
                    <button
                      onClick={() => handleMessagePerson(person.name)}
                      className="mt-2 px-4 py-1.5 border border-gray-300 text-gray-700 rounded-full text-sm font-semibold hover:bg-gray-100 transition-colors"
                    >
                      Message
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Company Profile View */}
      {currentViewSubPage === 'company' && viewedCompany && (
        <div className="max-w-5xl mx-auto py-6 px-4">
          <div className="bg-white rounded-lg border border-gray-200 overflow-hidden mb-4">
            <button
              onClick={handleBackFromSubPage}
              className="flex items-center text-gray-600 hover:text-gray-900 p-4"
            >
              <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
              </svg>
              Back
            </button>
            {/* Company Cover */}
            <div className={`h-48 bg-gradient-to-r ${viewedCompany.color} relative overflow-hidden`}>
              {viewedCompany.bannerUrl && (
                <img
                  src={viewedCompany.bannerUrl}
                  alt={`${viewedCompany.name} banner`}
                  className="absolute inset-0 w-full h-full object-cover"
                />
              )}
            </div>

            {/* Company Info */}
            <div className="px-6 pb-6 -mt-16">
              <div className="flex justify-between items-end">
                {viewedCompany.logoUrl ? (
                  <img
                    src={viewedCompany.logoUrl}
                    alt={viewedCompany.name}
                    className="w-36 h-36 rounded-lg border-4 border-white object-cover flex-shrink-0"
                  />
                ) : (
                  <div className={`w-36 h-36 bg-gradient-to-br ${viewedCompany.color} rounded-lg border-4 border-white flex items-center justify-center flex-shrink-0`}>
                    <span className="text-white font-bold text-5xl">{viewedCompany.initial}</span>
                  </div>
                )}
                <div className="flex space-x-2 mb-2">
                  <button
                    onClick={() => setFollowedCompanies(prev =>
                      prev.includes(viewedCompany.name)
                        ? prev.filter(c => c !== viewedCompany.name)
                        : [...prev, viewedCompany.name]
                    )}
                    className={`px-6 py-2 rounded-full text-sm font-semibold transition-colors ${
                      followedCompanies.includes(viewedCompany.name)
                        ? 'bg-gray-200 text-gray-700 hover:bg-gray-300'
                        : 'bg-blue-600 text-white hover:bg-blue-700'
                    }`}
                  >
                    {followedCompanies.includes(viewedCompany.name) ? 'Following' : 'Follow'}
                  </button>
                </div>
              </div>

              <div className="mt-4">
                <h1 className="text-3xl font-bold">{viewedCompany.name}</h1>
                <p className="text-lg text-gray-700 mt-1">{viewedCompany.desc}</p>
                <div className="mt-4 flex items-center space-x-6 text-sm text-gray-600">
                  <span>{viewedCompany.industry}</span>
                  <span>•</span>
                  <span>{viewedCompany.size}</span>
                  <span>•</span>
                  <span>{viewedCompany.location}</span>
                </div>
                <div className="mt-4 text-sm">
                  <span className="text-gray-700 font-semibold">{viewedCompany.followers.toLocaleString()}</span>
                  <span className="text-gray-600"> followers</span>
                  <span className="mx-3 text-gray-400">•</span>
                  <span className="text-gray-700 font-semibold">{viewedCompany.employees.toLocaleString()}</span>
                  <span className="text-gray-600"> employees</span>
                </div>
              </div>
            </div>
          </div>

          {/* About Section */}
          <div className="bg-white rounded-lg border border-gray-200 p-6 mb-4">
            <h2 className="text-xl font-semibold mb-4">About</h2>
            <p className="text-sm text-gray-700 leading-relaxed">{viewedCompany.about}</p>
          </div>

          {/* Jobs at Company */}
          <div className="bg-white rounded-lg border border-gray-200 p-6">
            <h2 className="text-xl font-semibold mb-4">Jobs at {viewedCompany.name}</h2>
            <div className="space-y-4">
              {allJobListings.filter(j => j.companyId === viewedCompany.id).map((job) => (
                <div
                  key={job.id}
                  className="p-4 border border-gray-200 rounded-lg hover:bg-gray-50 cursor-pointer transition-colors"
                  onClick={() => handleViewJobDetail(job.id)}
                >
                  <h3 className="font-semibold text-lg text-blue-600 hover:underline">{job.title}</h3>
                  <p className="text-sm text-gray-600 mt-1">{job.location} • {job.type}</p>
                  <p className="text-xs text-gray-500 mt-1">Posted {job.posted} • {job.applicants} applicants</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Messaging/Chat Indicators at bottom right */}
      <div className="fixed bottom-0 right-6 flex items-end space-x-3 z-20">
        {/* Open chat windows */}
        {openChats.slice(0, 3).map((contactId) => {
          const contact = contacts.find(c => c.id === contactId);
          if (!contact) return null;

          return (
            <div key={contactId} className="bg-white border border-gray-300 rounded-t-lg shadow-lg w-80">
              <div className="flex items-center justify-between px-4 py-3 bg-white border-b border-gray-200 rounded-t-lg">
                <div
                  className="flex items-center space-x-2 cursor-pointer hover:bg-gray-100 px-2 py-1 rounded transition-colors flex-1"
                  onClick={() => {
                    const person = allPeople.find(p => p.name === contact.name);
                    if (person) handleViewProfile(person.id);
                  }}
                >
                  <div className="w-8 h-8 rounded-full bg-gradient-to-br from-blue-400 to-purple-500 flex items-center justify-center relative">
                    <span className="text-lg">{contact.avatar}</span>
                    {contact.status === 'online' && (
                      <div className="absolute bottom-0 right-0 w-3 h-3 bg-green-500 border-2 border-white rounded-full"></div>
                    )}
                  </div>
                  <span className="text-sm font-semibold hover:text-blue-600 hover:underline">{contact.name}</span>
                </div>
                <button onClick={() => handleCloseChat(contactId)} className="hover:opacity-70">
                  <svg className="w-4 h-4 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>

              {/* Messages */}
              <div className="h-80 overflow-y-auto p-4 space-y-3 bg-gray-50">
                {contact.messages.map((message) => (
                  <div key={message.id} className={`flex ${message.isOwn ? 'justify-end' : 'justify-start'}`}>
                    <div className={`max-w-xs px-4 py-2 rounded-lg ${
                      message.isOwn
                        ? 'bg-blue-600 text-white'
                        : 'bg-white border border-gray-200 text-gray-800'
                    }`}>
                      <p className="text-sm">{message.content}</p>
                      <p className={`text-xs mt-1 ${message.isOwn ? 'text-blue-100' : 'text-gray-500'}`}>
                        {message.timestamp}
                      </p>
                    </div>
                  </div>
                ))}
              </div>

              {/* Message input */}
              <div className="border-t border-gray-200 p-3 bg-white rounded-b-lg">
                <div className="flex items-center space-x-2">
                  <input
                    type="text"
                    placeholder="Write a message..."
                    value={messageInputs[contactId] || ''}
                    onChange={(e) => setMessageInputs(prev => ({ ...prev, [contactId]: e.target.value }))}
                    onKeyPress={(e) => {
                      if (e.key === 'Enter') {
                        handleSendMessage(contactId);
                      }
                    }}
                    className="flex-1 px-3 py-2 border border-gray-300 rounded-full text-sm focus:outline-none focus:ring-1 focus:ring-blue-600"
                  />
                  <button
                    onClick={() => handleSendMessage(contactId)}
                    className="p-2 bg-blue-600 text-white rounded-full hover:bg-blue-700 transition-colors"
                  >
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
                    </svg>
                  </button>
                </div>
              </div>
            </div>
          );
        })}

        {/* Messaging Panel Toggle */}
        <div
          className="bg-blue-600 text-white rounded-t-lg px-4 py-3 shadow-lg cursor-pointer hover:bg-blue-700 transition-colors"
          onClick={() => setMessagingPanelOpen(!messagingPanelOpen)}
        >
          <div className="flex items-center space-x-2">
            <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
              <path d="M2 5a2 2 0 012-2h7a2 2 0 012 2v4a2 2 0 01-2 2H9l-3 3v-3H4a2 2 0 01-2-2V5z" />
              <path d="M15 7v2a4 4 0 01-4 4H9.828l-1.766 1.767c.28.149.599.233.938.233h2l3 3v-3h2a2 2 0 002-2V9a2 2 0 00-2-2h-1z" />
            </svg>
            <span className="font-semibold text-sm">Messaging</span>
            {contacts.reduce((sum, c) => sum + c.unread, 0) > 0 && (
              <span className="bg-red-500 text-white text-xs rounded-full w-5 h-5 flex items-center justify-center font-bold">
                {contacts.reduce((sum, c) => sum + c.unread, 0)}
              </span>
            )}
            <svg className={`w-4 h-4 transition-transform ${messagingPanelOpen ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 15l7-7 7 7" />
            </svg>
          </div>
        </div>
      </div>

      {/* Messaging Panel */}
      {messagingPanelOpen && (
        <div className="fixed bottom-16 right-6 w-80 bg-white border border-gray-300 rounded-lg shadow-xl z-20 max-h-96">
          <div className="p-4 border-b border-gray-200">
            <h3 className="font-semibold">Messages</h3>
          </div>
          <div className="max-h-80 overflow-y-auto">
            {contacts.map((contact) => (
              <div
                key={contact.id}
                onClick={() => {
                  setActiveChat(contact.id);
                  setCurrentView('messaging');
                  setCurrentViewSubPage(null);
                  setMessagingPanelOpen(false);
                  // Mark messages as read
                  readConversation(contact.id);
                }}
                className="p-4 border-b border-gray-100 hover:bg-gray-50 cursor-pointer"
              >
                <div className="flex items-center space-x-3">
                  <div className="relative">
                    <div className="w-10 h-10 rounded-full overflow-hidden bg-white">
                      <img
                        src={contact.avatarUrl}
                        alt={contact.name}
                        className="w-full h-full object-cover"
                      />
                    </div>
                    {contact.status === 'online' && (
                      <div className="absolute bottom-0 right-0 w-3 h-3 bg-green-500 border-2 border-white rounded-full"></div>
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between">
                      <p className="text-sm font-semibold truncate">{contact.name}</p>
                      {contact.unread > 0 && (
                        <span className="bg-blue-600 text-white text-xs rounded-full w-5 h-5 flex items-center justify-center font-bold">
                          {contact.unread}
                        </span>
                      )}
                    </div>
                    <p className="text-xs text-gray-600 truncate">{contact.lastMessage}</p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Jobs View */}
      {currentView === 'jobs' && currentViewSubPage !== 'company' && (
        <div className="max-w-7xl mx-auto py-6 px-4 flex space-x-6">
          {/* Left Sidebar */}
          <div className="w-64 flex-shrink-0 space-y-4">
            {/* Profile Card */}
            <div className="bg-white rounded-lg border border-gray-200 p-4">
              <h3 className="font-semibold text-base mb-1">{selfUser?.name}</h3>
              <p className="text-sm text-gray-600 mb-3">{selfUser?.jobTitle}</p>
            </div>

            {/* Manage Jobs */}
            <div className="bg-white rounded-lg border border-gray-200 p-4">
              <button
                onClick={() => setManageJobsModalOpen(true)}
                className="flex items-center space-x-2 text-gray-600 hover:text-gray-900 cursor-pointer w-full"
              >
                <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
                  <path d="M3 3a1 1 0 000 2h11a1 1 0 100-2H3zM3 7a1 1 0 000 2h5a1 1 0 000-2H3zM3 11a1 1 0 100 2h4a1 1 0 100-2H3zM13 16a1 1 0 102 0v-5.586l1.293 1.293a1 1 0 001.414-1.414l-3-3a1 1 0 00-1.414 0l-3 3a1 1 0 101.414 1.414L13 10.414V16z" />
                </svg>
                <span className="text-sm font-medium">Manage jobs</span>
              </button>
            </div>

            {/* Post a free job */}
            <div className="bg-white rounded-lg border border-gray-200 p-4">
              <button
                onClick={() => setPostJobModalOpen(true)}
                className="flex items-center space-x-2 text-blue-600 hover:bg-gray-50 cursor-pointer p-2 rounded w-full"
              >
                <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M10 3a1 1 0 011 1v5h5a1 1 0 110 2h-5v5a1 1 0 11-2 0v-5H4a1 1 0 110-2h5V4a1 1 0 011-1z" clipRule="evenodd" />
                </svg>
                <span className="text-sm font-semibold">Post a free job</span>
              </button>
            </div>
          </div>

          {/* Main Content */}
          <div className="flex-1 space-y-4">
            {/* Header */}
            <div className="bg-white rounded-lg border border-gray-200 p-6">
              <h2 className="text-xl font-semibold mb-2">Top job picks for you</h2>
              <p className="text-sm text-gray-600 mb-4">10 jobs available</p>

              {/* Search Bar */}
              <div className="relative">
                <svg className="absolute left-4 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-400" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M8 4a4 4 0 100 8 4 4 0 000-8zM2 8a6 6 0 1110.89 3.476l4.817 4.817a1 1 0 01-1.414 1.414l-4.816-4.816A6 6 0 012 8z" clipRule="evenodd" />
                </svg>
                <input
                  type="text"
                  placeholder="Search jobs by title, company, location, or skills..."
                  className="w-full pl-12 pr-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
            </div>

            {/* Job Listings */}
            {!currentViewSubPage && (
              <div className="space-y-2">
                {(showAllJobListings ? allJobListings : allJobListings.slice(0, 5)).map((job) => {
                  const company = allCompanies.find(c => c.id === job.companyId);
                  const isExpanded = expandedJobId === job.id;
                  const isSaved = savedJobs.includes(job.id);
                  // Generate a fallback initial from company name
                  const companyInitial = company?.initial || job.company.charAt(0).toUpperCase();
                  const companyColor = company?.color || 'from-gray-500 to-gray-600';
                  return (
                    <div
                      key={job.id}
                      className="bg-white rounded-lg border border-gray-200 overflow-hidden hover:shadow-md transition-shadow"
                    >
                      <div
                        className="p-4 cursor-pointer"
                        onClick={() => handleViewJobDetail(job.id)}
                      >
                        <div className="flex items-start justify-between">
                          <div className="flex items-start space-x-3 flex-1">
                            {company?.logoUrl ? (
                              <img
                                src={company.logoUrl}
                                alt={company.name}
                                className="w-12 h-12 rounded flex-shrink-0 object-cover"
                              />
                            ) : (
                              <div className={`w-12 h-12 bg-gradient-to-br ${companyColor} rounded flex items-center justify-center flex-shrink-0`}>
                                <span className="text-white font-bold text-lg">{companyInitial}</span>
                              </div>
                            )}
                            <div className="flex-1">
                              <h3 className="font-semibold text-base hover:text-blue-600">{job.title}</h3>
                              <p
                                className="text-sm text-gray-700 mt-1 hover:underline cursor-pointer inline"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  if (company) handleViewCompany(company.id);
                                }}
                              >
                                {job.company}
                              </p>
                              <span className="text-sm text-gray-700"> • {job.location} • {job.type}</span>
                              <p className="text-xs text-gray-500 mt-2">Posted {job.posted} • {job.applicants} applicants</p>
                              {appliedJobs.includes(job.id) && (
                                <div className="mt-2 inline-flex items-center px-2 py-1 bg-green-100 text-green-800 text-xs rounded-full">
                                  <svg className="w-3 h-3 mr-1" fill="currentColor" viewBox="0 0 20 20">
                                    <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                                  </svg>
                                  Applied
                                </div>
                              )}
                            </div>
                          </div>
                          <div className="flex items-center space-x-1">
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                if (isSaved) {
                                  setSavedJobs(savedJobs.filter(id => id !== job.id));
                                } else {
                                  setSavedJobs([...savedJobs, job.id]);
                                }
                              }}
                              className={`p-2 rounded-full transition-colors ${isSaved ? 'text-blue-600 bg-blue-50' : 'text-gray-400 hover:text-gray-600 hover:bg-gray-100'}`}
                              title={isSaved ? 'Unsave job' : 'Save job'}
                            >
                              <svg className="w-5 h-5" fill={isSaved ? 'currentColor' : 'none'} stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 5a2 2 0 012-2h10a2 2 0 012 2v16l-7-3.5L5 21V5z" />
                              </svg>
                            </button>
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                setExpandedJobId(isExpanded ? null : job.id);
                              }}
                              className={`text-gray-400 hover:text-gray-600 p-1 transition-transform ${isExpanded ? 'rotate-180' : ''}`}
                            >
                              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                              </svg>
                            </button>
                          </div>
                        </div>
                      </div>

                      {/* Expanded Job Details */}
                      {isExpanded && (
                        <div className="px-4 pb-4 border-t border-gray-100 bg-gray-50">
                          <div className="pt-4 space-y-4">
                            <div>
                              <h4 className="font-semibold text-sm mb-2">About the job</h4>
                              <p className="text-sm text-gray-700">{job.description}</p>
                            </div>
                            <div>
                              <h4 className="font-semibold text-sm mb-2">Requirements</h4>
                              <ul className="space-y-1">
                                {job.requirements.slice(0, 4).map((req, idx) => (
                                  <li key={idx} className="flex items-start text-sm text-gray-700">
                                    <svg className="w-4 h-4 text-green-600 mr-2 flex-shrink-0 mt-0.5" fill="currentColor" viewBox="0 0 20 20">
                                      <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                                    </svg>
                                    {req}
                                  </li>
                                ))}
                              </ul>
                            </div>
                            <div className="flex items-center space-x-3 pt-2">
                              {appliedJobs.includes(job.id) ? (
                                <div className="flex items-center px-4 py-2 bg-green-100 text-green-800 rounded-full font-semibold text-sm">
                                  <svg className="w-4 h-4 mr-1" fill="currentColor" viewBox="0 0 20 20">
                                    <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                                  </svg>
                                  Applied
                                </div>
                              ) : (
                                <button
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    handleApplyJob(job.id);
                                  }}
                                  className="px-4 py-2 bg-blue-600 text-white rounded-full font-semibold text-sm hover:bg-blue-700 transition-colors"
                                >
                                  Apply
                                </button>
                              )}
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleViewJobDetail(job.id);
                                }}
                                className="px-4 py-2 border-2 border-gray-300 text-gray-700 rounded-full font-semibold text-sm hover:bg-gray-100 transition-colors"
                              >
                                View full details
                              </button>
                            </div>
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })}

                {/* Show More / Show Less Button */}
                {allJobListings.length > 5 && (
                  <button
                    onClick={() => setShowAllJobListings(!showAllJobListings)}
                    className="w-full mt-3 py-3 text-center text-gray-600 hover:text-gray-900 hover:bg-gray-50 rounded-lg border border-gray-200 font-medium text-sm transition-colors flex items-center justify-center space-x-2"
                  >
                    <span>{showAllJobListings ? 'Show fewer jobs' : `Show all ${allJobListings.length} jobs`}</span>
                    <svg
                      className={`w-4 h-4 transition-transform ${showAllJobListings ? 'rotate-180' : ''}`}
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                    </svg>
                  </button>
                )}
              </div>
            )}

            {/* Job Detail View */}
            {currentViewSubPage === 'job-detail' && selectedJob && (
              <div className="bg-white rounded-lg border border-gray-200 p-6">
                <button
                  onClick={handleBackFromSubPage}
                  className="flex items-center text-gray-600 hover:text-gray-900 mb-4"
                >
                  <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                  </svg>
                  Back to Jobs
                </button>

                <div className="flex items-start space-x-4 mb-6">
                  {(() => {
                    const jobCompany = allCompanies.find(c => c.id === selectedJob.companyId);
                    const jobCompanyInitial = jobCompany?.initial || selectedJob.company.charAt(0).toUpperCase();
                    const jobCompanyColor = jobCompany?.color || 'from-gray-500 to-gray-600';
                    return jobCompany?.logoUrl ? (
                      <img
                        src={jobCompany.logoUrl}
                        alt={jobCompany.name}
                        className="w-16 h-16 rounded-lg flex-shrink-0 cursor-pointer hover:opacity-80 transition-opacity object-cover"
                        onClick={() => handleViewCompany(selectedJob.companyId)}
                      />
                    ) : (
                      <div
                        className={`w-16 h-16 bg-gradient-to-br ${jobCompanyColor} rounded-lg flex items-center justify-center flex-shrink-0 cursor-pointer hover:opacity-80 transition-opacity`}
                        onClick={() => jobCompany && handleViewCompany(selectedJob.companyId)}
                      >
                        <span className="text-white font-bold text-2xl">{jobCompanyInitial}</span>
                      </div>
                    );
                  })()}
                  <div className="flex-1">
                    <h1 className="text-2xl font-bold">{selectedJob.title}</h1>
                    <p
                      className="text-lg text-gray-700 mt-1 hover:underline cursor-pointer inline-block"
                      onClick={() => handleViewCompany(selectedJob.companyId)}
                    >
                      {selectedJob.company}
                    </p>
                    <p className="text-sm text-gray-600 mt-1">{selectedJob.location} • {selectedJob.type}</p>
                    <p className="text-xs text-gray-500 mt-2">Posted {selectedJob.posted} • {selectedJob.applicants} applicants</p>
                  </div>
                </div>

                <div className="flex items-center space-x-3 mb-6">
                  {appliedJobs.includes(selectedJob.id) ? (
                    <div className="flex items-center px-6 py-2 bg-green-100 text-green-800 rounded-full font-semibold">
                      <svg className="w-5 h-5 mr-2" fill="currentColor" viewBox="0 0 20 20">
                        <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                      </svg>
                      Applied
                    </div>
                  ) : (
                    <button
                      onClick={() => handleApplyJob(selectedJob.id)}
                      className="px-6 py-2 bg-blue-600 text-white rounded-full font-semibold hover:bg-blue-700 transition-colors"
                    >
                      Apply
                    </button>
                  )}
                  <button className="px-6 py-2 border-2 border-gray-300 text-gray-700 rounded-full font-semibold hover:bg-gray-50 transition-colors">
                    Save
                  </button>
                </div>

                <div className="space-y-6">
                  <div>
                    <h2 className="text-lg font-semibold mb-2">About the job</h2>
                    <p className="text-gray-700 leading-relaxed">{selectedJob.description}</p>
                  </div>

                  <div>
                    <h2 className="text-lg font-semibold mb-2">Requirements</h2>
                    <ul className="space-y-2">
                      {selectedJob.requirements.map((req, idx) => (
                        <li key={idx} className="flex items-start">
                          <svg className="w-5 h-5 text-green-600 mr-2 flex-shrink-0 mt-0.5" fill="currentColor" viewBox="0 0 20 20">
                            <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                          </svg>
                          <span className="text-gray-700">{req}</span>
                        </li>
                      ))}
                    </ul>
                  </div>

                  <div>
                    <h2 className="text-lg font-semibold mb-2">About the company</h2>
                    {(() => {
                      const jobCompanyInfo = allCompanies.find(c => c.id === selectedJob.companyId);
                      return jobCompanyInfo ? (
                        <div>
                          <div className="flex items-start space-x-3 mb-4">
                            {jobCompanyInfo.logoUrl ? (
                              <img
                                src={jobCompanyInfo.logoUrl}
                                alt={jobCompanyInfo.name}
                                className="w-12 h-12 rounded object-cover cursor-pointer hover:opacity-80"
                                onClick={() => handleViewCompany(selectedJob.companyId)}
                              />
                            ) : (
                              <div
                                className={`w-12 h-12 bg-gradient-to-br ${jobCompanyInfo.color} rounded flex items-center justify-center cursor-pointer hover:opacity-80`}
                                onClick={() => handleViewCompany(selectedJob.companyId)}
                              >
                                <span className="text-white font-bold text-lg">{jobCompanyInfo.initial}</span>
                              </div>
                            )}
                            <div>
                              <h3 className="font-semibold text-sm hover:text-blue-600 cursor-pointer" onClick={() => handleViewCompany(selectedJob.companyId)}>{jobCompanyInfo.name}</h3>
                              <p className="text-xs text-gray-600">{jobCompanyInfo.industry} • {jobCompanyInfo.followers.toLocaleString()} followers</p>
                            </div>
                          </div>
                          <p className="text-gray-700 mb-3 text-sm">{jobCompanyInfo.about}</p>
                          <button
                            onClick={() => handleViewCompany(selectedJob.companyId)}
                            className="text-blue-600 hover:underline font-semibold text-sm"
                          >
                            View company page →
                          </button>
                        </div>
                      ) : (
                        <p className="text-gray-500 text-sm">Company information not available</p>
                      );
                    })()}
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Messaging View */}
      {currentView === 'messaging' && !currentViewSubPage && (
        <div className="max-w-7xl mx-auto py-6 px-4">
          <div className="bg-white rounded-lg border border-gray-200 overflow-hidden" style={{ height: 'calc(100vh - 150px)' }}>
            <div className="flex h-full">
              {/* Left Side - Conversations List */}
              <div className="w-96 border-r border-gray-200 flex flex-col">
                {/* Header */}
                <div className="p-4 border-b border-gray-200">
                  <div className="flex items-center justify-between mb-4">
                    <h2 className="text-xl font-semibold">Messaging</h2>
                    <button
                      onClick={() => setNewMessageComposerOpen(true)}
                      className="text-gray-600 hover:text-gray-900"
                      title="New message"
                    >
                      <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
                        <path d="M13.586 3.586a2 2 0 112.828 2.828l-.793.793-2.828-2.828.793-.793zM11.379 5.793L3 14.172V17h2.828l8.38-8.379-2.83-2.828z" />
                      </svg>
                    </button>
                  </div>

                  {/* Search */}
                  <div className="relative">
                    <svg className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" fill="currentColor" viewBox="0 0 20 20">
                      <path fillRule="evenodd" d="M8 4a4 4 0 100 8 4 4 0 000-8zM2 8a6 6 0 1110.89 3.476l4.817 4.817a1 1 0 01-1.414 1.414l-4.816-4.816A6 6 0 012 8z" clipRule="evenodd" />
                    </svg>
                    <input
                      type="text"
                      placeholder="Search messages"
                      value={messagingSearchQuery}
                      onChange={(e) => setMessagingSearchQuery(e.target.value)}
                      className="w-full pl-10 pr-3 py-2 border border-gray-300 rounded text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  </div>
                </div>

                {/* Filter Tabs */}
                <div className="flex items-center space-x-2 px-4 py-3 border-b border-gray-200">
                  <button
                    onClick={() => setMessagingFilter('focused')}
                    className={`px-4 py-1.5 rounded-full text-sm font-medium ${messagingFilter === 'focused' ? 'bg-green-600 text-white' : 'text-gray-600 hover:bg-gray-100'}`}
                  >
                    Focused
                  </button>
                  <button
                    onClick={() => setMessagingFilter('unread')}
                    className={`px-4 py-1.5 rounded-full text-sm font-medium ${messagingFilter === 'unread' ? 'bg-green-600 text-white' : 'text-gray-600 hover:bg-gray-100'}`}
                  >
                    Unread
                  </button>
                  <button
                    onClick={() => setMessagingFilter('connections')}
                    className={`px-4 py-1.5 rounded-full text-sm font-medium ${messagingFilter === 'connections' ? 'bg-green-600 text-white' : 'text-gray-600 hover:bg-gray-100'}`}
                  >
                    Connections
                  </button>
                </div>

                {/* Conversations */}
                <div className="flex-1 overflow-y-auto">
                  {contacts
                    .filter((contact) => {
                      // Search filter
                      if (messagingSearchQuery.trim()) {
                        const query = messagingSearchQuery.toLowerCase();
                        if (!contact.name.toLowerCase().includes(query) &&
                            !contact.lastMessage.toLowerCase().includes(query)) {
                          return false;
                        }
                      }
                      // Tab filter
                      if (messagingFilter === 'unread' && contact.unread === 0) {
                        return false;
                      }
                      if (messagingFilter === 'connections') {
                        // For connections filter, show contacts who are connected
                        const person = allPeople.find(p => p.name === contact.name);
                        if (!person || !isConnected(person.id)) {
                          return false;
                        }
                      }
                      return true;
                    })
                    .map((contact) => (
                    <div
                      key={contact.id}
                      className={`p-4 border-b border-gray-200 cursor-pointer hover:bg-gray-50 ${activeChat === contact.id ? 'bg-blue-50' : ''}`}
                      onClick={() => {
                        setActiveChat(contact.id);
                        // Mark messages as read when selecting a conversation
                        readConversation(contact.id);
                      }}
                    >
                      <div className="flex items-start space-x-3">
                        <div
                          className="relative cursor-pointer"
                          onClick={(e) => {
                            e.stopPropagation();
                            const person = allPeople.find(p => p.name === contact.name);
                            if (person) handleViewProfile(person.id);
                          }}
                        >
                          <div className="w-12 h-12 rounded-full overflow-hidden flex-shrink-0 bg-white hover:opacity-80 transition-opacity">
                            <img
                              src={contact.avatarUrl}
                              alt={contact.name}
                              className="w-full h-full object-cover"
                            />
                          </div>
                          {contact.status === 'online' && (
                            <div className="absolute bottom-0 right-0 w-3 h-3 bg-green-500 rounded-full border-2 border-white"></div>
                          )}
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center justify-between mb-1">
                            <h3
                              className={`text-sm hover:text-blue-600 cursor-pointer hover:underline ${contact.unread > 0 ? 'font-bold' : 'font-semibold'}`}
                              onClick={(e) => {
                                e.stopPropagation();
                                const person = allPeople.find(p => p.name === contact.name);
                                if (person) handleViewProfile(person.id);
                              }}
                            >
                              {contact.name}
                            </h3>
                            <div className="flex items-center space-x-2">
                              {contact.unread > 0 && (
                                <span className="w-5 h-5 bg-blue-600 text-white text-xs rounded-full flex items-center justify-center font-bold">
                                  {contact.unread > 9 ? '9+' : contact.unread}
                                </span>
                              )}
                              <span className="text-xs text-gray-500">5s</span>
                            </div>
                          </div>
                          <p className={`text-sm truncate ${contact.unread > 0 ? 'text-gray-900 font-medium' : 'text-gray-600'}`}>{contact.lastMessage}</p>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Right Side - Active Conversation */}
              <div className="flex-1 flex flex-col">
                {activeChat ? (
                  <>
                    {/* Conversation Header */}
                    <div className="p-4 border-b border-gray-200 flex items-center justify-between">
                      <div className="flex items-center space-x-3 cursor-pointer hover:bg-gray-50 p-2 rounded-lg transition-colors"
                        onClick={() => {
                          const contact = contacts.find(c => c.id === activeChat);
                          if (contact) {
                            const person = allPeople.find(p => p.name === contact.name);
                            if (person) handleViewProfile(person.id);
                          }
                        }}
                      >
                        <div className="w-10 h-10 rounded-full overflow-hidden bg-white">
                          <img
                            src={contacts.find(c => c.id === activeChat)?.avatarUrl ?? ""}
                            alt={contacts.find(c => c.id === activeChat)?.name}
                            className="w-full h-full object-cover"
                          />
                        </div>
                        <div>
                          <h3 className="font-semibold text-sm hover:text-blue-600 hover:underline">{contacts.find(c => c.id === activeChat)?.name}</h3>
                          <p className="text-xs text-gray-600">
                            {(() => {
                              const contact = contacts.find(c => c.id === activeChat);
                              const person = contact ? allPeople.find(p => p.name === contact.name) : null;
                              return person ? `${person.title} at ${person.company}` : 'Professional';
                            })()}
                          </p>
                        </div>
                      </div>
                    </div>

                    {/* Messages */}
                    <div className="flex-1 overflow-y-auto p-4 space-y-4">
                      {contacts.find(c => c.id === activeChat)?.messages.map((message) => (
                        <div key={message.id} className={`flex ${message.isOwn ? 'justify-end' : 'justify-start'}`}>
                          <div className={`max-w-md ${message.isOwn ? 'bg-blue-600 text-white' : 'bg-gray-100 text-gray-900'} rounded-lg px-4 py-2`}>
                            <p className="text-sm">{message.content}</p>
                            <p className={`text-xs mt-1 ${message.isOwn ? 'text-blue-100' : 'text-gray-500'}`}>{message.timestamp}</p>
                          </div>
                        </div>
                      ))}
                    </div>

                    {/* Message Input */}
                    <div className="p-4 border-t border-gray-200">
                      <div className="flex items-center space-x-2 relative">
                        <div className="relative">
                          <button
                            onClick={() => setShowEmojiPicker(!showEmojiPicker)}
                            className="text-gray-600 hover:text-gray-900"
                          >
                            <svg className="w-6 h-6" fill="currentColor" viewBox="0 0 20 20">
                              <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM7 9a1 1 0 100-2 1 1 0 000 2zm7-1a1 1 0 11-2 0 1 1 0 012 0zm-.464 5.535a1 1 0 10-1.415-1.414 3 3 0 01-4.242 0 1 1 0 00-1.415 1.414 5 5 0 007.072 0z" clipRule="evenodd" />
                            </svg>
                          </button>
                          {showEmojiPicker && (
                            <div className="absolute bottom-10 left-0 bg-white border border-gray-200 rounded-lg shadow-lg p-3 z-50">
                              <div className="grid grid-cols-6 gap-2">
                                {['😀', '😂', '😊', '❤️', '👍', '🎉', '🔥', '💯', '👏', '🙌', '😍', '🤔', '😎', '🙏', '💪', '✨', '🚀', '💡'].map((emoji) => (
                                  <button
                                    key={emoji}
                                    onClick={() => handleAddEmoji(emoji)}
                                    className="text-xl hover:bg-gray-100 p-1 rounded"
                                  >
                                    {emoji}
                                  </button>
                                ))}
                              </div>
                            </div>
                          )}
                        </div>
                        <input
                          type="text"
                          placeholder="Write a message..."
                          value={mainChatInput}
                          onChange={(e) => setMainChatInput(e.target.value)}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter' && !e.shiftKey) {
                              e.preventDefault();
                              handleSendMainChatMessage();
                            }
                          }}
                          className="flex-1 px-4 py-2 border border-gray-300 rounded-full focus:outline-none focus:ring-2 focus:ring-blue-500"
                        />
                        <button
                          onClick={handleSendMainChatMessage}
                          disabled={!mainChatInput.trim()}
                          className={`p-2 rounded-full transition-colors ${mainChatInput.trim() ? 'bg-blue-600 text-white hover:bg-blue-700' : 'bg-gray-200 text-gray-400 cursor-not-allowed'}`}
                        >
                          <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
                            <path d="M10.894 2.553a1 1 0 00-1.788 0l-7 14a1 1 0 001.169 1.409l5-1.429A1 1 0 009 15.571V11a1 1 0 112 0v4.571a1 1 0 00.725.962l5 1.428a1 1 0 001.17-1.408l-7-14z" />
                          </svg>
                        </button>
                      </div>
                    </div>
                  </>
                ) : (
                  <div className="flex-1 flex items-center justify-center text-gray-500">
                    <div className="text-center">
                      <svg className="w-16 h-16 mx-auto mb-4 text-gray-300" fill="currentColor" viewBox="0 0 20 20">
                        <path fillRule="evenodd" d="M18 10c0 3.866-3.582 7-8 7a8.841 8.841 0 01-4.083-.98L2 17l1.338-3.123C2.493 12.767 2 11.434 2 10c0-3.866 3.582-7 8-7s8 3.134 8 7zM7 9H5v2h2V9zm8 0h-2v2h2V9zM9 9h2v2H9V9z" clipRule="evenodd" />
                      </svg>
                      <p className="text-sm">Select a message to start chatting</p>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Post Composer Modal */}
      {postComposerOpen && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50" onClick={() => { setPostComposerOpen(false); setVisibilityDropdownOpen(false); }}>
          <div className="bg-white rounded-lg max-w-2xl w-full mx-4" onClick={(e) => e.stopPropagation()}>
            {/* Header */}
            <div className="flex items-center justify-between p-4 border-b border-gray-200">
              <h3 className="text-lg font-semibold">Create a post</h3>
              <button onClick={() => { setPostComposerOpen(false); setVisibilityDropdownOpen(false); }} className="text-gray-400 hover:text-gray-600 p-1 hover:bg-gray-100 rounded-full">
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            {/* User info with visibility selector */}
            <div className="p-4">
              <div className="flex items-start space-x-3 mb-4">
                <div className="w-12 h-12 rounded-full overflow-hidden bg-gradient-to-br from-blue-400 to-blue-600 flex items-center justify-center flex-shrink-0">
                  <img
                    src={selfAvatarUrl}
                    alt="Profile"
                    className="w-full h-full object-cover"
                  />
                </div>
                <div>
                  <p className="font-semibold text-sm">{selfUser?.name}</p>
                  {/* Visibility selector */}
                  <div className="relative mt-1">
                    <button
                      onClick={() => setVisibilityDropdownOpen(!visibilityDropdownOpen)}
                      className="flex items-center space-x-1 px-2 py-1 text-xs font-semibold text-gray-700 border border-gray-400 rounded-full hover:bg-gray-50"
                    >
                      {postVisibility === 'anyone' && (
                        <>
                          <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20">
                            <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM4.332 8.027a6.012 6.012 0 011.912-2.706C6.512 5.73 6.974 6 7.5 6A1.5 1.5 0 019 7.5V8a2 2 0 004 0 2 2 0 011.523-1.943A5.977 5.977 0 0116 10c0 .34-.028.675-.083 1H15a2 2 0 00-2 2v2.197A5.973 5.973 0 0110 16v-2a2 2 0 00-2-2 2 2 0 01-2-2 2 2 0 00-1.668-1.973z" clipRule="evenodd" />
                          </svg>
                          <span>Anyone</span>
                        </>
                      )}
                      {postVisibility === 'connections' && (
                        <>
                          <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20">
                            <path d="M9 6a3 3 0 11-6 0 3 3 0 016 0zM17 6a3 3 0 11-6 0 3 3 0 016 0zM12.93 17c.046-.327.07-.66.07-1a6.97 6.97 0 00-1.5-4.33A5 5 0 0119 16v1h-6.07zM6 11a5 5 0 015 5v1H1v-1a5 5 0 015-5z" />
                          </svg>
                          <span>Connections only</span>
                        </>
                      )}
                      {postVisibility === 'group' && (
                        <>
                          <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20">
                            <path d="M13 6a3 3 0 11-6 0 3 3 0 016 0zM18 8a2 2 0 11-4 0 2 2 0 014 0zM14 15a4 4 0 00-8 0v3h8v-3zM6 8a2 2 0 11-4 0 2 2 0 014 0zM16 18v-3a5.972 5.972 0 00-.75-2.906A3.005 3.005 0 0119 15v3h-3zM4.75 12.094A5.973 5.973 0 004 15v3H1v-3a3 3 0 013.75-2.906z" />
                          </svg>
                          <span>Group</span>
                        </>
                      )}
                      <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                      </svg>
                    </button>
                    {visibilityDropdownOpen && (
                      <div className="absolute left-0 mt-1 w-48 bg-white rounded-lg shadow-lg border border-gray-200 py-1 z-50">
                        <button
                          onClick={() => { setPostVisibility('anyone'); setVisibilityDropdownOpen(false); }}
                          className={`w-full px-4 py-2 text-left text-sm flex items-center space-x-2 hover:bg-gray-100 ${postVisibility === 'anyone' ? 'bg-blue-50' : ''}`}
                        >
                          <svg className="w-4 h-4 text-gray-600" fill="currentColor" viewBox="0 0 20 20">
                            <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM4.332 8.027a6.012 6.012 0 011.912-2.706C6.512 5.73 6.974 6 7.5 6A1.5 1.5 0 019 7.5V8a2 2 0 004 0 2 2 0 011.523-1.943A5.977 5.977 0 0116 10c0 .34-.028.675-.083 1H15a2 2 0 00-2 2v2.197A5.973 5.973 0 0110 16v-2a2 2 0 00-2-2 2 2 0 01-2-2 2 2 0 00-1.668-1.973z" clipRule="evenodd" />
                          </svg>
                          <span>Anyone</span>
                        </button>
                        <button
                          onClick={() => { setPostVisibility('connections'); setVisibilityDropdownOpen(false); }}
                          className={`w-full px-4 py-2 text-left text-sm flex items-center space-x-2 hover:bg-gray-100 ${postVisibility === 'connections' ? 'bg-blue-50' : ''}`}
                        >
                          <svg className="w-4 h-4 text-gray-600" fill="currentColor" viewBox="0 0 20 20">
                            <path d="M9 6a3 3 0 11-6 0 3 3 0 016 0zM17 6a3 3 0 11-6 0 3 3 0 016 0zM12.93 17c.046-.327.07-.66.07-1a6.97 6.97 0 00-1.5-4.33A5 5 0 0119 16v1h-6.07zM6 11a5 5 0 015 5v1H1v-1a5 5 0 015-5z" />
                          </svg>
                          <span>Connections only</span>
                        </button>
                        <button
                          onClick={() => { setPostVisibility('group'); setVisibilityDropdownOpen(false); }}
                          className={`w-full px-4 py-2 text-left text-sm flex items-center space-x-2 hover:bg-gray-100 ${postVisibility === 'group' ? 'bg-blue-50' : ''}`}
                        >
                          <svg className="w-4 h-4 text-gray-600" fill="currentColor" viewBox="0 0 20 20">
                            <path d="M13 6a3 3 0 11-6 0 3 3 0 016 0zM18 8a2 2 0 11-4 0 2 2 0 014 0zM14 15a4 4 0 00-8 0v3h8v-3zM6 8a2 2 0 11-4 0 2 2 0 014 0zM16 18v-3a5.972 5.972 0 00-.75-2.906A3.005 3.005 0 0119 15v3h-3zM4.75 12.094A5.973 5.973 0 004 15v3H1v-3a3 3 0 013.75-2.906z" />
                          </svg>
                          <span>Group</span>
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              </div>

              {/* Post content textarea */}
              <textarea
                value={newPostContent}
                onChange={(e) => setNewPostContent(e.target.value)}
                placeholder="What do you want to talk about?"
                className="w-full border-0 p-0 text-sm focus:outline-none focus:ring-0 resize-none min-h-[120px]"
                rows={6}
                autoFocus
              />

              {/* Hashtag suggestions */}
              <div className="flex flex-wrap gap-2 mt-3 pb-3 border-b border-gray-200">
                <span className="text-xs text-gray-500">Add hashtags:</span>
                {['#AI', '#Technology', '#Career', '#Leadership', '#Innovation', '#Networking'].map((hashtag) => (
                  <button
                    key={hashtag}
                    onClick={() => setNewPostContent(prev => prev + (prev.endsWith(' ') || prev === '' ? '' : ' ') + hashtag + ' ')}
                    className="px-2 py-0.5 text-xs text-blue-600 bg-blue-50 rounded-full hover:bg-blue-100 transition-colors"
                  >
                    {hashtag}
                  </button>
                ))}
              </div>
            </div>

            {/* Footer with action buttons */}
            <div className="flex items-center justify-end space-x-3 px-4 py-3 bg-gray-50 rounded-b-lg">
              <button
                onClick={() => { setPostComposerOpen(false); setVisibilityDropdownOpen(false); }}
                className="px-4 py-2 text-sm font-semibold text-gray-700 hover:bg-gray-200 rounded-full transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleCreatePost}
                disabled={!newPostContent.trim()}
                className={`px-5 py-2 text-sm font-semibold text-white rounded-full transition-colors ${
                  newPostContent.trim()
                    ? 'bg-blue-600 hover:bg-blue-700'
                    : 'bg-gray-300 cursor-not-allowed'
                }`}
              >
                Post
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Comment Modal */}
      {commentModalOpen && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50" onClick={() => setCommentModalOpen(false)}>
          <div className="bg-white rounded-lg p-6 max-w-md w-full mx-4" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold">Add a comment</h3>
              <button onClick={() => setCommentModalOpen(false)} className="text-gray-400 hover:text-gray-600">
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
            <textarea
              value={commentText}
              onChange={(e) => setCommentText(e.target.value)}
              onKeyDown={(e) => {
                if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
                  e.preventDefault();
                  handleSubmitComment();
                }
              }}
              placeholder="What are your thoughts? (Ctrl/Cmd+Enter to post)"
              className="w-full border border-gray-300 rounded-lg p-3 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              rows={4}
              autoFocus
            />
            <div className="flex items-center justify-end space-x-3 mt-4">
              <button
                onClick={() => setCommentModalOpen(false)}
                className="px-4 py-2 text-sm font-semibold text-gray-700 hover:bg-gray-100 rounded transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleSubmitComment}
                disabled={!commentText.trim()}
                className={`px-4 py-2 text-sm font-semibold text-white rounded transition-colors ${
                  commentText.trim()
                    ? 'bg-blue-600 hover:bg-blue-700'
                    : 'bg-gray-300 cursor-not-allowed'
                }`}
              >
                Post
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Share Modal */}
      {shareModalOpen && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50" onClick={() => setShareModalOpen(false)}>
          <div className="bg-white rounded-lg p-6 max-w-md w-full mx-4" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold">Share</h3>
              <button onClick={() => setShareModalOpen(false)} className="text-gray-400 hover:text-gray-600">
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
            <div className="space-y-3">
              <button className="w-full flex items-center space-x-3 p-3 hover:bg-gray-50 rounded transition-colors">
                <svg className="w-6 h-6 text-blue-600" fill="currentColor" viewBox="0 0 20 20">
                  <path d="M15 8a3 3 0 10-2.977-2.63l-4.94 2.47a3 3 0 100 4.319l4.94 2.47a3 3 0 10.895-1.789l-4.94-2.47a3.027 3.027 0 000-.74l4.94-2.47C13.456 7.68 14.19 8 15 8z" />
                </svg>
                <span className="font-semibold">Share via Link</span>
              </button>
              <button className="w-full flex items-center space-x-3 p-3 hover:bg-gray-50 rounded transition-colors">
                <svg className="w-6 h-6 text-green-600" fill="currentColor" viewBox="0 0 20 20">
                  <path d="M2.003 5.884L10 9.882l7.997-3.998A2 2 0 0016 4H4a2 2 0 00-1.997 1.884z" />
                  <path d="M18 8.118l-8 4-8-4V14a2 2 0 002 2h12a2 2 0 002-2V8.118z" />
                </svg>
                <span className="font-semibold">Share via Email</span>
              </button>
            </div>
            <button
              onClick={() => setShareModalOpen(false)}
              className="w-full mt-4 px-4 py-2 text-sm font-semibold text-gray-700 hover:bg-gray-100 rounded transition-colors"
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {/* Page Notifications Modal */}
      {pageNotificationsOpen && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50" onClick={() => setPageNotificationsOpen(false)}>
          <div className="bg-white rounded-lg p-6 max-w-2xl w-full mx-4 max-h-[80vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold">Page Notifications</h3>
              <button onClick={() => setPageNotificationsOpen(false)} className="text-gray-400 hover:text-gray-600">
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
            <div className="space-y-3">
              {allPeople.slice(8, 12).map((person, idx) => {
                const actions = ['liked your page', 'followed your page', 'shared your post', 'commented on your page'];
                const times = ['2h ago', '5h ago', '1d ago', '2d ago'];
                return { name: person.name, action: actions[idx % actions.length], time: times[idx % times.length], avatarUrl: person.avatarUrl };
              }).map((notif, idx) => (
                <div key={idx} className="flex items-start space-x-3 p-3 hover:bg-gray-50 rounded transition-colors">
                  <div className="w-12 h-12 rounded-full overflow-hidden flex-shrink-0 bg-white">
                    <img
                      src={notif.avatarUrl}
                      alt={notif.name}
                      className="w-full h-full object-cover"
                    />
                  </div>
                  <div className="flex-1">
                    <p className="text-sm">
                      <span className="font-semibold">{notif.name}</span> {notif.action}
                    </p>
                    <p className="text-xs text-gray-500 mt-0.5">{notif.time}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Page Visitors Modal */}
      {pageVisitorsOpen && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50" onClick={() => setPageVisitorsOpen(false)}>
          <div className="bg-white rounded-lg p-6 max-w-2xl w-full mx-4 max-h-[80vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold">Page Visitors - Last 7 Days</h3>
              <button onClick={() => setPageVisitorsOpen(false)} className="text-gray-400 hover:text-gray-600">
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
            <div className="mb-6">
              <div className="flex items-center justify-between mb-2">
                <span className="text-2xl font-bold">276</span>
                <span className="text-sm text-green-600 flex items-center">
                  <svg className="w-4 h-4 mr-1" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M12 7a1 1 0 110-2h5a1 1 0 011 1v5a1 1 0 11-2 0V8.414l-4.293 4.293a1 1 0 01-1.414 0L8 10.414l-4.293 4.293a1 1 0 01-1.414-1.414l5-5a1 1 0 011.414 0L11 10.586 14.586 7H12z" clipRule="evenodd" />
                  </svg>
                  +12% vs last week
                </span>
              </div>
              <div className="h-32 bg-gradient-to-r from-blue-100 to-blue-50 rounded-lg flex items-end justify-around p-4">
                {[45, 52, 38, 61, 55, 48, 67].map((height, idx) => (
                  <div key={idx} className="flex-1 mx-1">
                    <div
                      className="bg-blue-500 rounded-t hover:bg-blue-600 transition-colors cursor-pointer"
                      style={{ height: `${height}%` }}
                      title={`${Math.floor(276 / 7)} visitors`}
                    />
                  </div>
                ))}
              </div>
              <div className="flex justify-between text-xs text-gray-500 mt-2">
                <span>Mon</span>
                <span>Tue</span>
                <span>Wed</span>
                <span>Thu</span>
                <span>Fri</span>
                <span>Sat</span>
                <span>Sun</span>
              </div>
            </div>
            <div>
              <h4 className="font-semibold mb-3">Recent Visitors</h4>
              <div className="space-y-2">
                {allPeople.slice(12, 16).map((person) => (
                  { name: person.name, title: person.title, avatarUrl: person.avatarUrl }
                )).map((visitor) => (
                  <div key={visitor.name} className="flex items-center space-x-3 p-2 hover:bg-gray-50 rounded transition-colors">
                    <div className="w-10 h-10 rounded-full overflow-hidden flex-shrink-0 bg-white">
                      <img
                        src={visitor.avatarUrl}
                        alt={visitor.name}
                        className="w-full h-full object-cover"
                      />
                    </div>
                    <div className="flex-1">
                      <p className="text-sm font-semibold">{visitor.name}</p>
                      <p className="text-xs text-gray-600">{visitor.title}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Profile Viewers Modal */}
      {profileViewersOpen && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50" onClick={() => setProfileViewersOpen(false)}>
          <div className="bg-white rounded-lg p-6 max-w-2xl w-full mx-4 max-h-[80vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold">Who viewed your profile</h3>
              <button onClick={() => setProfileViewersOpen(false)} className="text-gray-400 hover:text-gray-600">
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
            <div className="mb-6">
              <div className="flex items-center justify-between mb-2">
                <span className="text-2xl font-bold">52</span>
                <span className="text-sm text-green-600 flex items-center">
                  <svg className="w-4 h-4 mr-1" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M12 7a1 1 0 110-2h5a1 1 0 011 1v5a1 1 0 11-2 0V8.414l-4.293 4.293a1 1 0 01-1.414 0L8 10.414l-4.293 4.293a1 1 0 01-1.414-1.414l5-5a1 1 0 011.414 0L11 10.586 14.586 7H12z" clipRule="evenodd" />
                  </svg>
                  +8% vs last week
                </span>
              </div>
              <p className="text-sm text-gray-600 mb-4">Profile views in the last 90 days</p>
            </div>
            <div>
              <h4 className="font-semibold mb-3">Recent Viewers</h4>
              <div className="space-y-3">
                {allPeople.slice(0, 8).map((person) => (
                  <div
                    key={person.id}
                    className="flex items-center space-x-3 p-3 hover:bg-gray-50 rounded-lg cursor-pointer transition-colors"
                    onClick={() => {
                      setProfileViewersOpen(false);
                      handleViewProfile(person.id);
                    }}
                  >
                    <div className="w-12 h-12 rounded-full overflow-hidden flex-shrink-0 bg-white">
                      <img
                        src={person.avatarUrl}
                        alt={person.name}
                        className="w-full h-full object-cover"
                      />
                    </div>
                    <div className="flex-1">
                      <p className="text-sm font-semibold hover:text-blue-600">{person.name}</p>
                      <p className="text-xs text-gray-600">{person.title} at {person.company}</p>
                      <p className="text-xs text-gray-500 mt-1">Viewed 2 days ago</p>
                    </div>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        handleConnect(person.id);
                      }}
                      className={`px-4 py-1.5 rounded-full text-sm font-semibold transition-colors ${
                        isConnected(person.id)
                          ? 'bg-gray-100 text-gray-600'
                          : 'border-2 border-blue-600 text-blue-600 hover:bg-blue-50'
                      }`}
                    >
                      {isConnected(person.id) ? 'Connected' : 'Connect'}
                    </button>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Manage Jobs Modal */}
      {manageJobsModalOpen && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50" onClick={() => setManageJobsModalOpen(false)}>
          <div className="bg-white rounded-lg p-6 max-w-2xl w-full mx-4 max-h-[80vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-6">
              <h3 className="text-xl font-semibold">Manage your jobs</h3>
              <button onClick={() => setManageJobsModalOpen(false)} className="text-gray-400 hover:text-gray-600">
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            {/* Tabs */}
            <div className="flex space-x-6 border-b border-gray-200 mb-6">
              <button
                onClick={() => setManageJobsTab('applied')}
                className={`pb-3 text-sm ${manageJobsTab === 'applied' ? 'border-b-2 border-blue-600 text-blue-600 font-semibold' : 'text-gray-600 hover:text-gray-900'}`}
              >
                Applied ({appliedJobs.length})
              </button>
              <button
                onClick={() => setManageJobsTab('saved')}
                className={`pb-3 text-sm ${manageJobsTab === 'saved' ? 'border-b-2 border-blue-600 text-blue-600 font-semibold' : 'text-gray-600 hover:text-gray-900'}`}
              >
                Saved ({savedJobs.length})
              </button>
              <button
                onClick={() => setManageJobsTab('posted')}
                className={`pb-3 text-sm ${manageJobsTab === 'posted' ? 'border-b-2 border-blue-600 text-blue-600 font-semibold' : 'text-gray-600 hover:text-gray-900'}`}
              >
                Posted ({postedJobs.length})
              </button>
            </div>

            {/* Applied Jobs Tab */}
            {manageJobsTab === 'applied' && (
              appliedJobs.length > 0 ? (
                <div className="space-y-4">
                  {appliedJobs.map((jobId) => {
                    const job = allJobListings.find(j => j.id === jobId);
                    if (!job) return null;
                    const company = allCompanies.find(c => c.id === job.companyId);
                    return (
                      <div key={jobId} className="flex items-start space-x-4 p-4 border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors">
                        {company?.logoUrl ? (
                          <img
                            src={company.logoUrl}
                            alt={company.name}
                            className="w-14 h-14 rounded flex-shrink-0 object-cover"
                          />
                        ) : company ? (
                          <div className={`w-14 h-14 bg-gradient-to-br ${company.color} rounded flex items-center justify-center flex-shrink-0`}>
                            <span className="text-white font-bold text-xl">{company.initial}</span>
                          </div>
                        ) : null}
                        <div className="flex-1">
                          <h4 className="font-semibold text-base">{job.title}</h4>
                          <p className="text-sm text-gray-700">{job.company} • {job.location}</p>
                          <p className="text-xs text-gray-500 mt-1">Applied • {job.posted}</p>
                          <div className="mt-2 flex items-center space-x-2">
                            <span className="inline-flex items-center px-2 py-1 bg-green-100 text-green-800 text-xs rounded-full">
                              <svg className="w-3 h-3 mr-1" fill="currentColor" viewBox="0 0 20 20">
                                <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                              </svg>
                              Application submitted
                            </span>
                          </div>
                        </div>
                        <button
                          onClick={() => {
                            setManageJobsModalOpen(false);
                            handleViewJobDetail(jobId);
                          }}
                          className="text-blue-600 hover:text-blue-700 text-sm font-semibold"
                        >
                          View
                        </button>
                      </div>
                    );
                  })}
                </div>
              ) : (
                <div className="text-center py-12">
                  <svg className="w-16 h-16 text-gray-300 mx-auto mb-4" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M6 6V5a3 3 0 013-3h2a3 3 0 013 3v1h2a2 2 0 012 2v3.57A22.952 22.952 0 0110 13a22.95 22.95 0 01-8-1.43V8a2 2 0 012-2h2zm2-1a1 1 0 011-1h2a1 1 0 011 1v1H8V5zm1 5a1 1 0 011-1h.01a1 1 0 110 2H10a1 1 0 01-1-1z" clipRule="evenodd" />
                    <path d="M2 13.692V16a2 2 0 002 2h12a2 2 0 002-2v-2.308A24.974 24.974 0 0110 15c-2.796 0-5.487-.46-8-1.308z" />
                  </svg>
                  <p className="text-gray-600 font-medium">No applied jobs yet</p>
                  <p className="text-sm text-gray-500 mt-1">Start exploring jobs and apply to track them here</p>
                  <button
                    onClick={() => {
                      setManageJobsModalOpen(false);
                      setCurrentView('jobs');
                    }}
                    className="mt-4 px-6 py-2 bg-blue-600 text-white rounded-full font-semibold text-sm hover:bg-blue-700 transition-colors"
                  >
                    Browse jobs
                  </button>
                </div>
              )
            )}

            {/* Saved Jobs Tab */}
            {manageJobsTab === 'saved' && (
              savedJobs.length > 0 ? (
                <div className="space-y-4">
                  {savedJobs.map((jobId) => {
                    const job = allJobListings.find(j => j.id === jobId);
                    if (!job) return null;
                    const company = allCompanies.find(c => c.id === job.companyId);
                    return (
                      <div key={jobId} className="flex items-start space-x-4 p-4 border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors">
                        {company?.logoUrl ? (
                          <img
                            src={company.logoUrl}
                            alt={company.name}
                            className="w-14 h-14 rounded flex-shrink-0 object-cover"
                          />
                        ) : company ? (
                          <div className={`w-14 h-14 bg-gradient-to-br ${company.color} rounded flex items-center justify-center flex-shrink-0`}>
                            <span className="text-white font-bold text-xl">{company.initial}</span>
                          </div>
                        ) : null}
                        <div className="flex-1">
                          <h4 className="font-semibold text-base">{job.title}</h4>
                          <p className="text-sm text-gray-700">{job.company} • {job.location}</p>
                          <p className="text-xs text-gray-500 mt-1">Saved • {job.posted}</p>
                        </div>
                        <div className="flex items-center space-x-2">
                          <button
                            onClick={() => setSavedJobs(savedJobs.filter(id => id !== jobId))}
                            className="text-gray-400 hover:text-red-500 text-sm"
                            title="Remove from saved"
                          >
                            <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
                              <path fillRule="evenodd" d="M3.172 5.172a4 4 0 015.656 0L10 6.343l1.172-1.171a4 4 0 115.656 5.656L10 17.657l-6.828-6.829a4 4 0 010-5.656z" clipRule="evenodd" />
                            </svg>
                          </button>
                          <button
                            onClick={() => {
                              setManageJobsModalOpen(false);
                              handleViewJobDetail(jobId);
                            }}
                            className="text-blue-600 hover:text-blue-700 text-sm font-semibold"
                          >
                            View
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              ) : (
                <div className="text-center py-12">
                  <svg className="w-16 h-16 text-gray-300 mx-auto mb-4" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M3.172 5.172a4 4 0 015.656 0L10 6.343l1.172-1.171a4 4 0 115.656 5.656L10 17.657l-6.828-6.829a4 4 0 010-5.656z" clipRule="evenodd" />
                  </svg>
                  <p className="text-gray-600 font-medium">No saved jobs yet</p>
                  <p className="text-sm text-gray-500 mt-1">Save jobs to view them later</p>
                  <button
                    onClick={() => {
                      setManageJobsModalOpen(false);
                      setCurrentView('jobs');
                    }}
                    className="mt-4 px-6 py-2 bg-blue-600 text-white rounded-full font-semibold text-sm hover:bg-blue-700 transition-colors"
                  >
                    Browse jobs
                  </button>
                </div>
              )
            )}

            {/* Posted Jobs Tab */}
            {manageJobsTab === 'posted' && (
              postedJobs.length > 0 ? (
                <div className="space-y-4">
                  {postedJobs.map((job, idx) => (
                    <div key={idx} className="flex items-start space-x-4 p-4 border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors">
                      <div className="w-14 h-14 bg-gradient-to-br from-blue-400 to-blue-600 rounded flex items-center justify-center flex-shrink-0">
                        <span className="text-white font-bold text-xl">{job.company.charAt(0)}</span>
                      </div>
                      <div className="flex-1">
                        <h4 className="font-semibold text-base">{job.title}</h4>
                        <p className="text-sm text-gray-700">{job.company} • {job.location}</p>
                        <p className="text-xs text-gray-500 mt-1">{job.type} • Posted recently</p>
                        <div className="mt-2 flex items-center space-x-2">
                          <span className="inline-flex items-center px-2 py-1 bg-blue-100 text-blue-800 text-xs rounded-full">
                            Active
                          </span>
                        </div>
                      </div>
                      <button
                        onClick={() => setPostedJobs(postedJobs.filter((_, i) => i !== idx))}
                        className="text-red-500 hover:text-red-700 text-sm font-semibold"
                      >
                        Remove
                      </button>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-center py-12">
                  <svg className="w-16 h-16 text-gray-300 mx-auto mb-4" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M6 2a2 2 0 00-2 2v12a2 2 0 002 2h8a2 2 0 002-2V7.414A2 2 0 0015.414 6L12 2.586A2 2 0 0010.586 2H6zm5 6a1 1 0 10-2 0v2H7a1 1 0 100 2h2v2a1 1 0 102 0v-2h2a1 1 0 100-2h-2V8z" clipRule="evenodd" />
                  </svg>
                  <p className="text-gray-600 font-medium">No posted jobs yet</p>
                  <p className="text-sm text-gray-500 mt-1">Post a job to find candidates</p>
                  <button
                    onClick={() => {
                      setManageJobsModalOpen(false);
                      setPostJobModalOpen(true);
                    }}
                    className="mt-4 px-6 py-2 bg-blue-600 text-white rounded-full font-semibold text-sm hover:bg-blue-700 transition-colors"
                  >
                    Post a job
                  </button>
                </div>
              )
            )}
          </div>
        </div>
      )}

      {/* Post a Job Modal */}
      {postJobModalOpen && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50" onClick={() => setPostJobModalOpen(false)}>
          <div className="bg-white rounded-lg p-6 max-w-2xl w-full mx-4 max-h-[90vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-6">
              <h3 className="text-xl font-semibold">Post a free job</h3>
              <button onClick={() => setPostJobModalOpen(false)} className="text-gray-400 hover:text-gray-600">
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            <form onSubmit={(e) => {
              e.preventDefault();
              const formData = new FormData(e.currentTarget);
              const newJob = {
                title: formData.get('title') as string,
                company: formData.get('company') as string,
                location: formData.get('location') as string,
                type: formData.get('jobType') as string
              };
              if (newJob.title && newJob.company && newJob.location) {
                setPostedJobs([...postedJobs, newJob]);
              }
              setPostJobModalOpen(false);
            }} className="space-y-6">
              <div>
                <label className="block text-sm font-semibold mb-2">Job title *</label>
                <input
                  type="text"
                  name="title"
                  placeholder="e.g. Senior Software Engineer"
                  className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  required
                />
              </div>

              <div>
                <label className="block text-sm font-semibold mb-2">Company *</label>
                <input
                  type="text"
                  name="company"
                  placeholder="Company name"
                  defaultValue="NexusAI"
                  className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  required
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-semibold mb-2">Workplace type *</label>
                  <select name="workplaceType" className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500">
                    <option>On-site</option>
                    <option>Remote</option>
                    <option>Hybrid</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-semibold mb-2">Job type *</label>
                  <select name="jobType" className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500">
                    <option>Full-time</option>
                    <option>Part-time</option>
                    <option>Contract</option>
                    <option>Internship</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-sm font-semibold mb-2">Location *</label>
                <input
                  type="text"
                  name="location"
                  placeholder="e.g. San Francisco, CA"
                  className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  required
                />
              </div>

              <div>
                <label className="block text-sm font-semibold mb-2">Description *</label>
                <textarea
                  name="description"
                  placeholder="Describe the role, responsibilities, and qualifications..."
                  rows={5}
                  className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
                  required
                />
              </div>

              <div className="flex items-center justify-end space-x-3 pt-4 border-t border-gray-200">
                <button
                  type="button"
                  onClick={() => setPostJobModalOpen(false)}
                  className="px-6 py-2 border-2 border-gray-300 text-gray-700 rounded-full font-semibold hover:bg-gray-50 transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-6 py-2 bg-blue-600 text-white rounded-full font-semibold hover:bg-blue-700 transition-colors"
                >
                  Post job
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Reactions Modal */}
      {reactionsModalOpen && selectedReactionPost && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50" onClick={() => setReactionsModalOpen(false)}>
          <div className="bg-white rounded-lg p-6 max-w-lg w-full mx-4 max-h-[70vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold">Reactions</h3>
              <button onClick={() => setReactionsModalOpen(false)} className="text-gray-400 hover:text-gray-600">
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
            <div className="flex items-center space-x-4 mb-4 border-b">
              <button className="pb-3 border-b-2 border-blue-600 font-semibold text-blue-600 text-sm">
                All {allPosts.find(p => p.id === selectedReactionPost)?.likes || 0}
              </button>
              <button className="pb-3 text-gray-600 hover:text-blue-600 text-sm flex items-center space-x-1">
                <div className="w-5 h-5 bg-blue-500 rounded-full flex items-center justify-center">
                  <svg className="w-3 h-3 text-white" fill="currentColor" viewBox="0 0 20 20">
                    <path d="M2 10.5a1.5 1.5 0 113 0v6a1.5 1.5 0 01-3 0v-6zM6 10.333v5.43a2 2 0 001.106 1.79l.05.025A4 4 0 008.943 18h5.416a2 2 0 001.962-1.608l1.2-6A2 2 0 0015.56 8H12V4a2 2 0 00-2-2 1 1 0 00-1 1v.667a4 4 0 01-.8 2.4L6.8 7.933a4 4 0 00-.8 2.4z" />
                  </svg>
                </div>
                <span>{Math.floor((allPosts.find(p => p.id === selectedReactionPost)?.likes || 0) * 0.7)}</span>
              </button>
              <button className="pb-3 text-gray-600 hover:text-blue-600 text-sm flex items-center space-x-1">
                <div className="w-5 h-5 bg-red-500 rounded-full flex items-center justify-center">
                  <svg className="w-3 h-3 text-white" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M3.172 5.172a4 4 0 015.656 0L10 6.343l1.172-1.171a4 4 0 115.656 5.656L10 17.657l-6.828-6.829a4 4 0 010-5.656z" clipRule="evenodd" />
                  </svg>
                </div>
                <span>{Math.floor((allPosts.find(p => p.id === selectedReactionPost)?.likes || 0) * 0.3)}</span>
              </button>
            </div>
            <div className="space-y-3">
              {allPeople.slice(16, 21).map((person, idx) => {
                const reactions: Array<'like' | 'love'> = ['like', 'like', 'love', 'like', 'love'];
                return { name: person.name, title: person.title, avatarUrl: person.avatarUrl, reaction: reactions[idx % reactions.length] };
              }).map((person) => (
                <div key={person.name} className="flex items-center justify-between p-2 hover:bg-gray-50 rounded transition-colors">
                  <div className="flex items-center space-x-3">
                    <div className="relative">
                      <div className="w-10 h-10 rounded-full overflow-hidden flex-shrink-0 bg-white">
                        <img
                          src={person.avatarUrl}
                          alt={person.name}
                          className="w-full h-full object-cover"
                        />
                      </div>
                      <div className={`absolute -bottom-1 -right-1 w-5 h-5 ${person.reaction === 'like' ? 'bg-blue-500' : 'bg-red-500'} rounded-full flex items-center justify-center border-2 border-white`}>
                        {person.reaction === 'like' ? (
                          <svg className="w-3 h-3 text-white" fill="currentColor" viewBox="0 0 20 20">
                            <path d="M2 10.5a1.5 1.5 0 113 0v6a1.5 1.5 0 01-3 0v-6zM6 10.333v5.43a2 2 0 001.106 1.79l.05.025A4 4 0 008.943 18h5.416a2 2 0 001.962-1.608l1.2-6A2 2 0 0015.56 8H12V4a2 2 0 00-2-2 1 1 0 00-1 1v.667a4 4 0 01-.8 2.4L6.8 7.933a4 4 0 00-.8 2.4z" />
                          </svg>
                        ) : (
                          <svg className="w-3 h-3 text-white" fill="currentColor" viewBox="0 0 20 20">
                            <path fillRule="evenodd" d="M3.172 5.172a4 4 0 015.656 0L10 6.343l1.172-1.171a4 4 0 115.656 5.656L10 17.657l-6.828-6.829a4 4 0 010-5.656z" clipRule="evenodd" />
                          </svg>
                        )}
                      </div>
                    </div>
                    <div>
                      <p className="text-sm font-semibold hover:text-blue-600 cursor-pointer hover:underline">{person.name}</p>
                      <p className="text-xs text-gray-600">{person.title}</p>
                    </div>
                  </div>
                  <button className="px-4 py-1.5 border-2 border-blue-600 text-blue-600 rounded-full text-xs font-semibold hover:bg-blue-50 transition-colors">
                    Connect
                  </button>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Add Section Modal */}
      {addSectionModalOpen && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50" onClick={() => setAddSectionModalOpen(false)}>
          <div className="bg-white rounded-lg p-6 max-w-md w-full mx-4" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold">Add to profile</h3>
              <button onClick={() => setAddSectionModalOpen(false)} className="text-gray-400 hover:text-gray-600">
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
            <div className="space-y-2">
              {['About', 'Education', 'Experience', 'Skills', 'Licenses & certifications', 'Publications', 'Courses', 'Projects', 'Languages'].map((section) => (
                <button
                  key={section}
                  onClick={() => { setAddSectionModalOpen(false); setAddSectionType(section); }}
                  className="w-full text-left px-4 py-3 hover:bg-gray-50 rounded-lg transition-colors text-sm"
                >
                  {section}
                </button>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Open To Modal */}
      {openToModalOpen && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50" onClick={() => setOpenToModalOpen(false)}>
          <div className="bg-white rounded-lg p-6 max-w-md w-full mx-4" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold">What are you open to?</h3>
              <button onClick={() => setOpenToModalOpen(false)} className="text-gray-400 hover:text-gray-600">
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
            <div className="space-y-3">
              {[
                { title: 'Finding a new job', desc: "Show recruiters and others that you're open to work", type: 'job' },
                { title: 'Hiring', desc: "Share that you're hiring and attract qualified candidates", type: 'hiring' },
                { title: 'Providing services', desc: "Showcase services you offer to potential clients", type: 'services' }
              ].map((option) => (
                <button
                  key={option.title}
                  onClick={() => { setOpenToModalOpen(false); setOpenToType(option.type); }}
                  className="w-full text-left p-4 border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors"
                >
                  <p className="font-semibold text-sm">{option.title}</p>
                  <p className="text-xs text-gray-600 mt-1">{option.desc}</p>
                </button>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Contact Info Modal */}
      {contactInfoModalOpen && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50" onClick={() => setContactInfoModalOpen(false)}>
          <div className="bg-white rounded-lg p-6 max-w-md w-full mx-4" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold">{viewedPerson.name}</h3>
              <button onClick={() => setContactInfoModalOpen(false)} className="text-gray-400 hover:text-gray-600">
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
            <div className="space-y-4">
              <div className="flex items-start space-x-3">
                <svg className="w-5 h-5 text-gray-500 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                </svg>
                <div>
                  <p className="text-sm font-semibold">Email</p>
                  <a href="#" className="text-sm text-blue-600 hover:underline">{viewedPerson.email ?? ""}</a>
                </div>
              </div>
              <div className="flex items-start space-x-3">
                <svg className="w-5 h-5 text-gray-500 mt-0.5" fill="currentColor" viewBox="0 0 24 24">
                  <path d="M19 0h-14c-2.761 0-5 2.239-5 5v14c0 2.761 2.239 5 5 5h14c2.762 0 5-2.239 5-5v-14c0-2.761-2.238-5-5-5zm-11 19h-3v-11h3v11zm-1.5-12.268c-.966 0-1.75-.79-1.75-1.764s.784-1.764 1.75-1.764 1.75.79 1.75 1.764-.783 1.764-1.75 1.764zm13.5 12.268h-3v-5.604c0-3.368-4-3.113-4 0v5.604h-3v-11h3v1.765c1.396-2.586 7-2.777 7 2.476v6.759z"/>
                </svg>
                <div>
                  <p className="text-sm font-semibold">MicroDin</p>
                  <a href="#" className="text-sm text-blue-600 hover:underline">microdin.com/in/{viewedPerson.username ?? viewedPerson.id}</a>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* New Message Composer Modal */}
      {newMessageComposerOpen && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50" onClick={() => setNewMessageComposerOpen(false)}>
          <div className="bg-white rounded-lg p-6 max-w-lg w-full mx-4" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold">New message</h3>
              <button onClick={() => setNewMessageComposerOpen(false)} className="text-gray-400 hover:text-gray-600">
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
            <div className="space-y-4">
              <input type="text" placeholder="Type a name" className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500" />
              <div className="max-h-60 overflow-y-auto">
                {allPeople.slice(0, 5).map((person) => (
                  <button
                    key={person.id}
                    onClick={() => { handleMessagePerson(person.name); setNewMessageComposerOpen(false); }}
                    className="w-full flex items-center space-x-3 p-3 hover:bg-gray-50 rounded-lg transition-colors"
                  >
                    <img src={person.avatarUrl} alt={person.name} className="w-10 h-10 rounded-full object-cover" />
                    <div className="text-left">
                      <p className="text-sm font-semibold">{person.name}</p>
                      <p className="text-xs text-gray-600">{person.title}</p>
                    </div>
                  </button>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Saved Items Modal */}
      {savedItemsOpen && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50" onClick={() => setSavedItemsOpen(false)}>
          <div className="bg-white rounded-lg p-6 max-w-lg w-full mx-4" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold">Saved items</h3>
              <button onClick={() => setSavedItemsOpen(false)} className="text-gray-400 hover:text-gray-600">
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
            <p className="text-gray-600 text-sm">You haven't saved any items yet. Save posts, jobs, and articles to view them later.</p>
          </div>
        </div>
      )}

      {/* Groups Modal */}
      {groupsOpen && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50" onClick={() => setGroupsOpen(false)}>
          <div className="bg-white rounded-lg p-6 max-w-lg w-full mx-4" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold">Your Groups</h3>
              <button onClick={() => setGroupsOpen(false)} className="text-gray-400 hover:text-gray-600">
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
            <div className="space-y-3">
              {allCompanies.slice(0, 3).map((company) => (
                <div key={company.id} className="flex items-center space-x-3 p-3 hover:bg-gray-50 rounded-lg cursor-pointer" onClick={() => handleViewCompany(company.id)}>
                  {company.logoUrl ? (
                    <img
                      src={company.logoUrl}
                      alt={company.name}
                      className="w-12 h-12 rounded-lg object-cover"
                    />
                  ) : (
                    <div className={`w-12 h-12 rounded-lg bg-gradient-to-br ${company.color} flex items-center justify-center text-white font-bold text-lg`}>
                      {company.initial}
                    </div>
                  )}
                  <div>
                    <p className="text-sm font-semibold">{company.name}</p>
                    <p className="text-xs text-gray-600">{company.followers.toLocaleString()} members</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Newsletters Modal */}
      {newslettersOpen && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50" onClick={() => setNewslettersOpen(false)}>
          <div className="bg-white rounded-lg p-6 max-w-lg w-full mx-4" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold">Your Newsletters</h3>
              <button onClick={() => setNewslettersOpen(false)} className="text-gray-400 hover:text-gray-600">
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
            <p className="text-gray-600 text-sm">You're not subscribed to any newsletters yet. Discover newsletters from industry leaders and experts.</p>
          </div>
        </div>
      )}

      {/* Events Modal */}
      {eventsOpen && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50" onClick={() => setEventsOpen(false)}>
          <div className="bg-white rounded-lg p-6 max-w-lg w-full mx-4" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold">Your Events</h3>
              <button onClick={() => setEventsOpen(false)} className="text-gray-400 hover:text-gray-600">
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
            <p className="text-gray-600 text-sm">No upcoming events. Browse events to find networking opportunities and industry gatherings.</p>
          </div>
        </div>
      )}

      {/* Post Options Menu */}
      {showPostOptions && postOptionsPostId && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50" onClick={handlePostOptionsClose}>
          <div className="bg-white rounded-xl w-80 overflow-hidden shadow-xl" onClick={(e) => e.stopPropagation()}>
            <button
              onClick={() => handleSavePost(postOptionsPostId)}
              className="w-full py-3 border-b border-gray-200 hover:bg-gray-50 text-sm flex items-center justify-center space-x-2"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 5a2 2 0 012-2h10a2 2 0 012 2v16l-7-3.5L5 21V5z" />
              </svg>
              <span>{savedPosts.includes(postOptionsPostId) ? 'Unsave' : 'Save'}</span>
            </button>
            <button
              onClick={() => handleHidePost(postOptionsPostId)}
              className="w-full py-3 border-b border-gray-200 hover:bg-gray-50 text-sm flex items-center justify-center space-x-2"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l3.59 3.59m0 0A9.953 9.953 0 0112 5c4.478 0 8.268 2.943 9.543 7a10.025 10.025 0 01-4.132 5.411m0 0L21 21" />
              </svg>
              <span>Hide post</span>
            </button>
            <button
              onClick={handleCopyPostLink}
              className="w-full py-3 border-b border-gray-200 hover:bg-gray-50 text-sm flex items-center justify-center space-x-2"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 5H6a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2v-1M8 5a2 2 0 002 2h2a2 2 0 002-2M8 5a2 2 0 012-2h2a2 2 0 012 2m0 0h2a2 2 0 012 2v3m2 4H10m0 0l3-3m-3 3l3 3" />
              </svg>
              <span>Copy link to post</span>
            </button>
            <button
              onClick={handleReportPost}
              className="w-full py-3 border-b border-gray-200 hover:bg-gray-50 text-sm flex items-center justify-center space-x-2 text-red-600"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 21v-4m0 0V5a2 2 0 012-2h6.5l1 1H21l-3 6 3 6h-8.5l-1-1H5a2 2 0 00-2 2zm9-13.5V9" />
              </svg>
              <span>Report post</span>
            </button>
            <button
              onClick={handlePostOptionsClose}
              className="w-full py-3 hover:bg-gray-50 text-sm font-medium"
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {/* Settings Modal */}
      {settingsModalOpen && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50" onClick={() => setSettingsModalOpen(false)}>
          <div className="bg-white rounded-lg p-6 max-w-lg w-full mx-4" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-6">
              <h3 className="text-xl font-semibold">Settings & Privacy</h3>
              <button onClick={() => setSettingsModalOpen(false)} className="text-gray-400 hover:text-gray-600">
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
            <div className="space-y-4">
              <div onClick={() => { setSettingsModalOpen(false); setAccountPreferencesOpen(true); }} className="flex items-center justify-between p-3 hover:bg-gray-50 rounded-lg cursor-pointer">
                <div className="flex items-center space-x-3">
                  <svg className="w-5 h-5 text-gray-600" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M10 9a3 3 0 100-6 3 3 0 000 6zm-7 9a7 7 0 1114 0H3z" clipRule="evenodd" />
                  </svg>
                  <span className="text-sm">Account preferences</span>
                </div>
                <svg className="w-5 h-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                </svg>
              </div>
              <div onClick={() => { setSettingsModalOpen(false); setSignInSecurityOpen(true); }} className="flex items-center justify-between p-3 hover:bg-gray-50 rounded-lg cursor-pointer">
                <div className="flex items-center space-x-3">
                  <svg className="w-5 h-5 text-gray-600" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M5 9V7a5 5 0 0110 0v2a2 2 0 012 2v5a2 2 0 01-2 2H5a2 2 0 01-2-2v-5a2 2 0 012-2zm8-2v2H7V7a3 3 0 016 0z" clipRule="evenodd" />
                  </svg>
                  <span className="text-sm">Sign in & security</span>
                </div>
                <svg className="w-5 h-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                </svg>
              </div>
              <div onClick={() => { setSettingsModalOpen(false); setNotificationsSettingsOpen(true); }} className="flex items-center justify-between p-3 hover:bg-gray-50 rounded-lg cursor-pointer">
                <div className="flex items-center space-x-3">
                  <svg className="w-5 h-5 text-gray-600" fill="currentColor" viewBox="0 0 20 20">
                    <path d="M10 2a6 6 0 00-6 6v3.586l-.707.707A1 1 0 004 14h12a1 1 0 00.707-1.707L16 11.586V8a6 6 0 00-6-6zM10 18a3 3 0 01-3-3h6a3 3 0 01-3 3z" />
                  </svg>
                  <span className="text-sm">Notifications</span>
                </div>
                <svg className="w-5 h-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                </svg>
              </div>
              <div onClick={() => { setSettingsModalOpen(false); setVisibilitySettingsOpen(true); }} className="flex items-center justify-between p-3 hover:bg-gray-50 rounded-lg cursor-pointer">
                <div className="flex items-center space-x-3">
                  <svg className="w-5 h-5 text-gray-600" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M3.707 2.293a1 1 0 00-1.414 1.414l14 14a1 1 0 001.414-1.414l-1.473-1.473A10.014 10.014 0 0019.542 10C18.268 5.943 14.478 3 10 3a9.958 9.958 0 00-4.512 1.074l-1.78-1.781zm4.261 4.26l1.514 1.515a2.003 2.003 0 012.45 2.45l1.514 1.514a4 4 0 00-5.478-5.478z" clipRule="evenodd" />
                    <path d="M12.454 16.697L9.75 13.992a4 4 0 01-3.742-3.741L2.335 6.578A9.98 9.98 0 00.458 10c1.274 4.057 5.065 7 9.542 7 .847 0 1.669-.105 2.454-.303z" />
                  </svg>
                  <span className="text-sm">Visibility</span>
                </div>
                <svg className="w-5 h-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                </svg>
              </div>
              <div onClick={() => { setSettingsModalOpen(false); setDataPrivacyOpen(true); }} className="flex items-center justify-between p-3 hover:bg-gray-50 rounded-lg cursor-pointer">
                <div className="flex items-center space-x-3">
                  <svg className="w-5 h-5 text-gray-600" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-6-3a2 2 0 11-4 0 2 2 0 014 0zm-2 4a5 5 0 00-4.546 2.916A5.986 5.986 0 0010 16a5.986 5.986 0 004.546-2.084A5 5 0 0010 11z" clipRule="evenodd" />
                  </svg>
                  <span className="text-sm">Data privacy</span>
                </div>
                <svg className="w-5 h-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                </svg>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Help Modal */}
      {helpModalOpen && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50" onClick={() => setHelpModalOpen(false)}>
          <div className="bg-white rounded-lg p-6 max-w-lg w-full mx-4" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-6">
              <h3 className="text-xl font-semibold">Help Center</h3>
              <button onClick={() => setHelpModalOpen(false)} className="text-gray-400 hover:text-gray-600">
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
            <div className="space-y-4">
              <div className="relative mb-4">
                <svg className="absolute left-3 top-3 h-5 w-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                </svg>
                <input
                  type="text"
                  placeholder="Search help articles..."
                  className="w-full pl-10 pr-4 py-2.5 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
              <div className="space-y-2">
                <h4 className="font-semibold text-sm text-gray-700">Popular topics</h4>
                <button onClick={() => { setHelpModalOpen(false); setHelpArticleOpen('profile'); }} className="w-full text-left p-3 hover:bg-gray-50 rounded-lg text-sm text-blue-600">
                  How to update my profile
                </button>
                <button onClick={() => { setHelpModalOpen(false); setHelpArticleOpen('connections'); }} className="w-full text-left p-3 hover:bg-gray-50 rounded-lg text-sm text-blue-600">
                  Managing my connections
                </button>
                <button onClick={() => { setHelpModalOpen(false); setHelpArticleOpen('jobs'); }} className="w-full text-left p-3 hover:bg-gray-50 rounded-lg text-sm text-blue-600">
                  Job search tips
                </button>
                <button onClick={() => { setHelpModalOpen(false); setHelpArticleOpen('privacy'); }} className="w-full text-left p-3 hover:bg-gray-50 rounded-lg text-sm text-blue-600">
                  Privacy and security
                </button>
              </div>
              <div className="pt-4 border-t border-gray-200">
                <p className="text-sm text-gray-600">Need more help? <span onClick={() => { setHelpModalOpen(false); setHelpArticleOpen('support'); }} className="text-blue-600 cursor-pointer hover:underline">Contact support</span></p>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Event Interest Modal */}
      {eventInterestModalOpen && selectedEvent && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50" onClick={() => setEventInterestModalOpen(false)}>
          <div className="bg-white rounded-lg p-6 max-w-md w-full mx-4" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold">Event Details</h3>
              <button onClick={() => setEventInterestModalOpen(false)} className="text-gray-400 hover:text-gray-600">
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
            <div className="mb-6">
              <h4 className="font-semibold text-xl mb-2">{selectedEvent.title}</h4>
              <p className="text-sm text-gray-600 mb-1">{selectedEvent.date}</p>
              <p className="text-sm text-gray-600">{selectedEvent.attendees} attendees</p>
            </div>
            <div className="space-y-3">
              <button
                onClick={() => {
                  setEventInterestModalOpen(false);
                  // Could add to a list of interested events
                }}
                className="w-full py-3 bg-blue-600 text-white rounded-full font-semibold hover:bg-blue-700 transition-colors"
              >
                I'm interested
              </button>
              <button
                onClick={() => setEventInterestModalOpen(false)}
                className="w-full py-3 border-2 border-gray-300 text-gray-700 rounded-full font-semibold hover:bg-gray-50 transition-colors"
              >
                Maybe later
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Show All Invitations Modal */}
      {showAllInvitationsModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50" onClick={() => setShowAllInvitationsModal(false)}>
          <div className="bg-white rounded-lg p-6 max-w-2xl w-full mx-4 max-h-[80vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-6">
              <h3 className="text-xl font-semibold">All Invitations ({connectionInvitations.filter(c => c.status === "pending" && !ignoredInvitationIds.has(c.id)).length})</h3>
              <button onClick={() => setShowAllInvitationsModal(false)} className="text-gray-400 hover:text-gray-600">
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
            <div className="space-y-3">
              {connectionInvitations
                .filter(conn => conn.status === "pending" && !ignoredInvitationIds.has(conn.id))
                .map((invitation) => (
                  <div key={invitation.id} className="flex items-start space-x-3 p-3 hover:bg-gray-50 rounded border border-gray-200">
                    <div className="w-16 h-16 rounded-full overflow-hidden flex-shrink-0 bg-white">
                      <img src={invitation.avatarUrl} alt={invitation.name} className="w-full h-full object-cover" />
                    </div>
                    <div className="flex-1">
                      <h3 className="font-semibold text-base hover:text-blue-600 cursor-pointer hover:underline"
                        onClick={() => {
                          const person = allPeople.find(p => p.name === invitation.name);
                          if (person) { setShowAllInvitationsModal(false); handleViewProfile(person.id); }
                        }}
                      >
                        {invitation.name}
                      </h3>
                      <p className="text-sm text-gray-600 mb-1">{invitation.title}</p>
                      <p className="text-xs text-gray-500 mb-2">{invitation.mutualConnections} mutual connections</p>
                      <div className="flex space-x-2">
                        <button
                          onClick={() => handleIgnoreInvitation(invitation.id)}
                          className="px-4 py-1.5 border-2 border-gray-300 text-gray-700 rounded-full text-sm font-semibold hover:bg-gray-50"
                        >
                          Ignore
                        </button>
                        <button
                          onClick={() => handleAcceptInvitation(invitation.id, invitation.userId)}
                          className="px-4 py-1.5 bg-blue-600 text-white rounded-full text-sm font-semibold hover:bg-blue-700"
                        >
                          Accept
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
              {connectionInvitations.filter(conn => conn.status === "pending" && !ignoredInvitationIds.has(conn.id)).length === 0 && (
                <p className="text-center text-gray-500 py-8">No pending invitations</p>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Show All Events Modal */}
      {showAllEventsModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50" onClick={() => setShowAllEventsModal(false)}>
          <div className="bg-white rounded-lg p-6 max-w-4xl w-full mx-4 max-h-[80vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-6">
              <h3 className="text-xl font-semibold">All Events</h3>
              <button onClick={() => setShowAllEventsModal(false)} className="text-gray-400 hover:text-gray-600">
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
            <div className="grid grid-cols-3 gap-4">
              {[
                { title: 'Tech Conference 2024', date: '15 Jul 2024', attendees: 350, gradient: CARD_GRADIENTS[0] },
                { title: 'Marketing Summit 2024', date: '20 Aug 2024', attendees: 250, gradient: CARD_GRADIENTS[1] },
                { title: 'Startup Pitch Night', date: '05 Sep 2024', attendees: 200, gradient: CARD_GRADIENTS[2] },
                { title: 'AI & Robotics Expo', date: '10 Oct 2024', attendees: 500, gradient: CARD_GRADIENTS[3] },
                { title: 'Healthcare Innovation Forum', date: '12 Nov 2024', attendees: 400, gradient: CARD_GRADIENTS[4] },
                { title: 'Sustainable Energy Symposium', date: '01 Dec 2024', attendees: 300, gradient: CARD_GRADIENTS[5] },
                { title: 'FinTech Innovation Summit', date: '15 Jan 2025', attendees: 450, gradient: CARD_GRADIENTS[6] },
                { title: 'Cloud Computing Conference', date: '20 Feb 2025', attendees: 380, gradient: CARD_GRADIENTS[7] },
                { title: 'Cybersecurity Workshop', date: '10 Mar 2025', attendees: 220, gradient: CARD_GRADIENTS[0] }
              ].map((event) => (
                <div key={event.title} className="border border-gray-200 rounded-lg overflow-hidden hover:shadow-md transition-shadow">
                  <div className={`w-full h-32 bg-gradient-to-r ${event.gradient}`} />
                  <div className="p-3">
                    <h3 className="font-semibold text-sm mb-1">{event.title}</h3>
                    <p className="text-xs text-gray-600 mb-1">{event.date}</p>
                    <div className="flex items-center text-xs text-gray-600 mb-3">
                      <svg className="w-3 h-3 mr-1" fill="currentColor" viewBox="0 0 20 20">
                        <path d="M9 6a3 3 0 11-6 0 3 3 0 016 0zM17 6a3 3 0 11-6 0 3 3 0 016 0zM12.93 17c.046-.327.07-.66.07-1a6.97 6.97 0 00-1.5-4.33A5 5 0 0119 16v1h-6.07zM6 11a5 5 0 015 5v1H1v-1a5 5 0 015-5z" />
                      </svg>
                      <span>{event.attendees} attendees</span>
                    </div>
                    <button
                      onClick={() => {
                        setShowAllEventsModal(false);
                        setSelectedEvent({ title: event.title, date: event.date, attendees: event.attendees });
                        setEventInterestModalOpen(true);
                      }}
                      className="w-full py-1.5 border-2 border-blue-600 text-blue-600 rounded-full text-xs font-semibold hover:bg-blue-50"
                    >
                      View
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Show All Groups Modal */}
      {showAllGroupsModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50" onClick={() => setShowAllGroupsModal(false)}>
          <div className="bg-white rounded-lg p-6 max-w-4xl w-full mx-4 max-h-[80vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-6">
              <h3 className="text-xl font-semibold">Groups you might be interested in</h3>
              <button onClick={() => setShowAllGroupsModal(false)} className="text-gray-400 hover:text-gray-600">
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
            <div className="grid grid-cols-4 gap-4">
              {allCompanies.map((company, idx) => (
                <div key={company.id} className="border border-gray-200 rounded-lg overflow-hidden hover:shadow-md transition-shadow">
                  <div className={`w-full h-24 bg-gradient-to-r ${CARD_GRADIENTS[idx % CARD_GRADIENTS.length]}`} />
                  <div className="p-3">
                    <h3 className="font-semibold text-sm mb-1">{company.industry} Group</h3>
                    <p className="text-xs text-gray-600 mb-3">{company.followers.toLocaleString()} followers</p>
                    <button
                      onClick={() => {
                        const groupId = `${company.industry}-group`;
                        if (followedGroups.includes(groupId)) {
                          setFollowedGroups(followedGroups.filter(g => g !== groupId));
                        } else {
                          setFollowedGroups([...followedGroups, groupId]);
                        }
                      }}
                      className={`w-full py-1.5 border-2 rounded-full text-xs font-semibold flex items-center justify-center ${
                        followedGroups.includes(`${company.industry}-group`)
                          ? 'border-green-600 text-green-600 bg-green-50'
                          : 'border-gray-500 text-gray-700 hover:border-gray-700 hover:bg-gray-50'
                      }`}
                    >
                      {followedGroups.includes(`${company.industry}-group`) ? (
                        <>
                          <svg className="w-3 h-3 mr-1" fill="currentColor" viewBox="0 0 20 20">
                            <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                          </svg>
                          Following
                        </>
                      ) : (
                        <>
                          <svg className="w-3 h-3 mr-1" fill="currentColor" viewBox="0 0 20 20">
                            <path fillRule="evenodd" d="M10 5a1 1 0 011 1v3h3a1 1 0 110 2h-3v3a1 1 0 11-2 0v-3H6a1 1 0 110-2h3V6a1 1 0 011-1z" clipRule="evenodd" />
                          </svg>
                          Follow
                        </>
                      )}
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Account Preferences Modal */}
      {accountPreferencesOpen && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50" onClick={() => setAccountPreferencesOpen(false)}>
          <div className="bg-white rounded-lg p-6 max-w-lg w-full mx-4 max-h-[80vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-6">
              <div className="flex items-center space-x-3">
                <button onClick={() => { setAccountPreferencesOpen(false); setSettingsModalOpen(true); }} className="text-gray-400 hover:text-gray-600">
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                  </svg>
                </button>
                <h3 className="text-xl font-semibold">Account preferences</h3>
              </div>
              <button onClick={() => setAccountPreferencesOpen(false)} className="text-gray-400 hover:text-gray-600">
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
            <div className="space-y-4">
              <div className="p-4 border border-gray-200 rounded-lg">
                <h4 className="font-semibold text-sm mb-2">Profile information</h4>
                <p className="text-xs text-gray-600 mb-3">Control how others see your profile</p>
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-sm">Name, location, and industry</span>
                    <button className="text-blue-600 text-sm hover:underline">Edit</button>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-sm">Personal demographic information</span>
                    <button className="text-blue-600 text-sm hover:underline">Edit</button>
                  </div>
                </div>
              </div>
              <div className="p-4 border border-gray-200 rounded-lg">
                <h4 className="font-semibold text-sm mb-2">Display preferences</h4>
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-sm">Dark mode</span>
                    <div className="relative">
                      <input type="checkbox" className="sr-only" />
                      <div className="w-10 h-6 bg-gray-200 rounded-full shadow-inner"></div>
                      <div className="dot absolute left-1 top-1 bg-white w-4 h-4 rounded-full shadow transition"></div>
                    </div>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-sm">Language</span>
                    <span className="text-sm text-gray-600">English</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Sign In & Security Modal */}
      {signInSecurityOpen && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50" onClick={() => setSignInSecurityOpen(false)}>
          <div className="bg-white rounded-lg p-6 max-w-lg w-full mx-4 max-h-[80vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-6">
              <div className="flex items-center space-x-3">
                <button onClick={() => { setSignInSecurityOpen(false); setSettingsModalOpen(true); }} className="text-gray-400 hover:text-gray-600">
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                  </svg>
                </button>
                <h3 className="text-xl font-semibold">Sign in & security</h3>
              </div>
              <button onClick={() => setSignInSecurityOpen(false)} className="text-gray-400 hover:text-gray-600">
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
            <div className="space-y-4">
              <div className="p-4 border border-gray-200 rounded-lg">
                <h4 className="font-semibold text-sm mb-2">Email addresses</h4>
                <p className="text-xs text-gray-600 mb-3">Add or remove email addresses on your account</p>
                <div className="flex items-center justify-between">
                  <span className="text-sm">{selfUser?.email}</span>
                  <span className="text-xs text-green-600 font-medium">Primary</span>
                </div>
              </div>
              <div className="p-4 border border-gray-200 rounded-lg">
                <h4 className="font-semibold text-sm mb-2">Phone numbers</h4>
                <p className="text-xs text-gray-600 mb-3">Add a phone number in case you get locked out</p>
                <button className="text-blue-600 text-sm hover:underline">Add phone number</button>
              </div>
              <div className="p-4 border border-gray-200 rounded-lg">
                <h4 className="font-semibold text-sm mb-2">Change password</h4>
                <p className="text-xs text-gray-600 mb-3">Choose a strong, unique password</p>
                <button className="text-blue-600 text-sm hover:underline">Change password</button>
              </div>
              <div className="p-4 border border-gray-200 rounded-lg">
                <h4 className="font-semibold text-sm mb-2">Two-step verification</h4>
                <p className="text-xs text-gray-600 mb-3">Add an extra layer of security to your account</p>
                <div className="flex items-center justify-between">
                  <span className="text-sm text-gray-600">Status: Off</span>
                  <button className="text-blue-600 text-sm hover:underline">Turn on</button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Notifications Settings Modal */}
      {notificationsSettingsOpen && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50" onClick={() => setNotificationsSettingsOpen(false)}>
          <div className="bg-white rounded-lg p-6 max-w-lg w-full mx-4 max-h-[80vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-6">
              <div className="flex items-center space-x-3">
                <button onClick={() => { setNotificationsSettingsOpen(false); setSettingsModalOpen(true); }} className="text-gray-400 hover:text-gray-600">
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                  </svg>
                </button>
                <h3 className="text-xl font-semibold">Notifications</h3>
              </div>
              <button onClick={() => setNotificationsSettingsOpen(false)} className="text-gray-400 hover:text-gray-600">
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
            <div className="space-y-4">
              {[
                { title: 'Messages', desc: 'Get notified when you receive messages' },
                { title: 'Connection requests', desc: 'Get notified of new connection requests' },
                { title: 'Job alerts', desc: 'Get notified about jobs you might be interested in' },
                { title: 'News and updates', desc: 'Stay informed about news in your industry' },
                { title: 'Profile views', desc: 'Get notified when someone views your profile' }
              ].map((item) => (
                <div key={item.title} className="flex items-center justify-between p-3 border border-gray-200 rounded-lg">
                  <div>
                    <h4 className="font-semibold text-sm">{item.title}</h4>
                    <p className="text-xs text-gray-600">{item.desc}</p>
                  </div>
                  <div className="relative">
                    <input type="checkbox" defaultChecked className="sr-only peer" />
                    <div className="w-10 h-6 bg-blue-600 peer-checked:bg-blue-600 rounded-full shadow-inner"></div>
                    <div className="dot absolute right-1 top-1 bg-white w-4 h-4 rounded-full shadow transition"></div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Visibility Settings Modal */}
      {visibilitySettingsOpen && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50" onClick={() => setVisibilitySettingsOpen(false)}>
          <div className="bg-white rounded-lg p-6 max-w-lg w-full mx-4 max-h-[80vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-6">
              <div className="flex items-center space-x-3">
                <button onClick={() => { setVisibilitySettingsOpen(false); setSettingsModalOpen(true); }} className="text-gray-400 hover:text-gray-600">
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                  </svg>
                </button>
                <h3 className="text-xl font-semibold">Visibility</h3>
              </div>
              <button onClick={() => setVisibilitySettingsOpen(false)} className="text-gray-400 hover:text-gray-600">
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
            <div className="space-y-4">
              <div className="p-4 border border-gray-200 rounded-lg">
                <h4 className="font-semibold text-sm mb-2">Profile viewing options</h4>
                <p className="text-xs text-gray-600 mb-3">Choose what others see when you view their profile</p>
                <select className="w-full p-2 border border-gray-300 rounded-lg text-sm">
                  <option>Your name and headline</option>
                  <option>Private profile characteristics</option>
                  <option>Private mode</option>
                </select>
              </div>
              <div className="p-4 border border-gray-200 rounded-lg">
                <h4 className="font-semibold text-sm mb-2">Connections visibility</h4>
                <p className="text-xs text-gray-600 mb-3">Who can see your connections</p>
                <select className="w-full p-2 border border-gray-300 rounded-lg text-sm">
                  <option>Your connections</option>
                  <option>Only you</option>
                </select>
              </div>
              <div className="p-4 border border-gray-200 rounded-lg">
                <h4 className="font-semibold text-sm mb-2">Active status</h4>
                <div className="flex items-center justify-between">
                  <p className="text-xs text-gray-600">Show when you're active on MicroDin</p>
                  <div className="relative">
                    <input type="checkbox" defaultChecked className="sr-only" />
                    <div className="w-10 h-6 bg-blue-600 rounded-full shadow-inner"></div>
                    <div className="dot absolute right-1 top-1 bg-white w-4 h-4 rounded-full shadow transition"></div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Data Privacy Modal */}
      {dataPrivacyOpen && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50" onClick={() => setDataPrivacyOpen(false)}>
          <div className="bg-white rounded-lg p-6 max-w-lg w-full mx-4 max-h-[80vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-6">
              <div className="flex items-center space-x-3">
                <button onClick={() => { setDataPrivacyOpen(false); setSettingsModalOpen(true); }} className="text-gray-400 hover:text-gray-600">
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                  </svg>
                </button>
                <h3 className="text-xl font-semibold">Data privacy</h3>
              </div>
              <button onClick={() => setDataPrivacyOpen(false)} className="text-gray-400 hover:text-gray-600">
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
            <div className="space-y-4">
              <div className="p-4 border border-gray-200 rounded-lg">
                <h4 className="font-semibold text-sm mb-2">How MicroDin uses your data</h4>
                <p className="text-xs text-gray-600 mb-3">Manage how your data is used for personalization and advertising</p>
                <button className="text-blue-600 text-sm hover:underline">Manage preferences</button>
              </div>
              <div className="p-4 border border-gray-200 rounded-lg">
                <h4 className="font-semibold text-sm mb-2">Get a copy of your data</h4>
                <p className="text-xs text-gray-600 mb-3">Download an archive of your account data</p>
                <button className="text-blue-600 text-sm hover:underline">Request archive</button>
              </div>
              <div className="p-4 border border-gray-200 rounded-lg">
                <h4 className="font-semibold text-sm mb-2">Delete account</h4>
                <p className="text-xs text-gray-600 mb-3">Permanently delete your MicroDin account and data</p>
                <button className="text-red-600 text-sm hover:underline">Close account</button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Help Article Modal */}
      {helpArticleOpen && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50" onClick={() => setHelpArticleOpen(null)}>
          <div className="bg-white rounded-lg p-6 max-w-lg w-full mx-4 max-h-[80vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-6">
              <div className="flex items-center space-x-3">
                <button onClick={() => { setHelpArticleOpen(null); setHelpModalOpen(true); }} className="text-gray-400 hover:text-gray-600">
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                  </svg>
                </button>
                <h3 className="text-xl font-semibold">
                  {helpArticleOpen === 'profile' && 'How to update my profile'}
                  {helpArticleOpen === 'connections' && 'Managing my connections'}
                  {helpArticleOpen === 'jobs' && 'Job search tips'}
                  {helpArticleOpen === 'privacy' && 'Privacy and security'}
                  {helpArticleOpen === 'support' && 'Contact Support'}
                </h3>
              </div>
              <button onClick={() => setHelpArticleOpen(null)} className="text-gray-400 hover:text-gray-600">
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
            <div className="prose prose-sm">
              {helpArticleOpen === 'profile' && (
                <div className="space-y-4">
                  <p className="text-gray-700">Your MicroDin profile is your professional identity. Here's how to make it stand out:</p>
                  <ul className="list-disc pl-5 space-y-2 text-sm text-gray-600">
                    <li>Add a professional photo - profiles with photos get 21x more views</li>
                    <li>Write a compelling headline that showcases your expertise</li>
                    <li>Complete your About section with your career story</li>
                    <li>Add your work experience and education</li>
                    <li>Get endorsements for your skills from colleagues</li>
                  </ul>
                </div>
              )}
              {helpArticleOpen === 'connections' && (
                <div className="space-y-4">
                  <p className="text-gray-700">Building your network is essential for career growth:</p>
                  <ul className="list-disc pl-5 space-y-2 text-sm text-gray-600">
                    <li>Connect with colleagues, classmates, and industry peers</li>
                    <li>Personalize connection requests with a note</li>
                    <li>Engage with your connections' posts and updates</li>
                    <li>Remove or block connections from the My Network page</li>
                    <li>Manage who can see your connections in privacy settings</li>
                  </ul>
                </div>
              )}
              {helpArticleOpen === 'jobs' && (
                <div className="space-y-4">
                  <p className="text-gray-700">Tips to improve your job search on MicroDin:</p>
                  <ul className="list-disc pl-5 space-y-2 text-sm text-gray-600">
                    <li>Set up job alerts for positions you're interested in</li>
                    <li>Use the "Open to Work" feature to let recruiters know</li>
                    <li>Apply early - positions filled 10x faster on MicroDin</li>
                    <li>Follow companies you want to work for</li>
                    <li>Build relationships with recruiters in your industry</li>
                  </ul>
                </div>
              )}
              {helpArticleOpen === 'privacy' && (
                <div className="space-y-4">
                  <p className="text-gray-700">Keep your account secure with these tips:</p>
                  <ul className="list-disc pl-5 space-y-2 text-sm text-gray-600">
                    <li>Enable two-step verification for extra security</li>
                    <li>Use a unique, strong password</li>
                    <li>Review your privacy settings regularly</li>
                    <li>Be cautious of suspicious messages or requests</li>
                    <li>Control who can see your activity and connections</li>
                  </ul>
                </div>
              )}
              {helpArticleOpen === 'support' && (
                <div className="space-y-4">
                  <p className="text-gray-700">Need additional help? We're here for you.</p>
                  <div className="p-4 bg-gray-50 rounded-lg">
                    <p className="text-sm text-gray-600 mb-4">For urgent issues, you can reach our support team:</p>
                    <div className="space-y-2">
                      <p className="text-sm"><strong>Email:</strong> support@microdin.com</p>
                      <p className="text-sm"><strong>Response time:</strong> 24-48 hours</p>
                    </div>
                  </div>
                  <button className="w-full py-2 bg-blue-600 text-white rounded-full text-sm font-semibold hover:bg-blue-700 transition-colors">
                    Submit a support ticket
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Add Section Type Modal */}
      {addSectionType && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50" onClick={() => setAddSectionType(null)}>
          <div className="bg-white rounded-lg p-6 max-w-lg w-full mx-4 max-h-[80vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-6">
              <h3 className="text-xl font-semibold">Add {addSectionType}</h3>
              <button onClick={() => setAddSectionType(null)} className="text-gray-400 hover:text-gray-600">
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
            <div className="space-y-4">
              {addSectionType === 'About' && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Summary</label>
                  <textarea
                    className="w-full p-3 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:outline-none"
                    rows={6}
                    placeholder="Tell your professional story..."
                  />
                </div>
              )}
              {addSectionType === 'Education' && (
                <>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">School *</label>
                    <input type="text" className="w-full p-3 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:outline-none" placeholder="Ex: Stanford University" />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">Degree</label>
                    <input type="text" className="w-full p-3 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:outline-none" placeholder="Ex: Bachelor's" />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">Field of study</label>
                    <input type="text" className="w-full p-3 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:outline-none" placeholder="Ex: Computer Science" />
                  </div>
                </>
              )}
              {addSectionType === 'Experience' && (
                <>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">Title *</label>
                    <input type="text" className="w-full p-3 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:outline-none" placeholder="Ex: Software Engineer" />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">Company *</label>
                    <input type="text" className="w-full p-3 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:outline-none" placeholder="Ex: Google" />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">Location</label>
                    <input type="text" className="w-full p-3 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:outline-none" placeholder="Ex: San Francisco, CA" />
                  </div>
                </>
              )}
              {addSectionType === 'Skills' && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Skill *</label>
                  <input type="text" className="w-full p-3 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:outline-none" placeholder="Ex: JavaScript" />
                  <p className="text-xs text-gray-500 mt-2">Add skills to showcase your expertise</p>
                </div>
              )}
              {(addSectionType === 'Licenses & certifications' || addSectionType === 'Publications' || addSectionType === 'Courses' || addSectionType === 'Projects' || addSectionType === 'Languages') && (
                <>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">Name *</label>
                    <input type="text" className="w-full p-3 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:outline-none" placeholder={`Enter ${addSectionType.toLowerCase()} name`} />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">Description</label>
                    <textarea
                      className="w-full p-3 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:outline-none"
                      rows={3}
                      placeholder="Add details..."
                    />
                  </div>
                </>
              )}
              <div className="flex space-x-3 pt-4">
                <button
                  onClick={() => setAddSectionType(null)}
                  className="flex-1 py-2 border border-gray-300 rounded-full text-sm font-semibold text-gray-700 hover:bg-gray-50 transition-colors"
                >
                  Cancel
                </button>
                <button
                  onClick={() => setAddSectionType(null)}
                  className="flex-1 py-2 bg-blue-600 text-white rounded-full text-sm font-semibold hover:bg-blue-700 transition-colors"
                >
                  Save
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Open To Type Modal */}
      {openToType && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50" onClick={() => setOpenToType(null)}>
          <div className="bg-white rounded-lg p-6 max-w-lg w-full mx-4 max-h-[80vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-6">
              <h3 className="text-xl font-semibold">
                {openToType === 'job' && 'Open to work'}
                {openToType === 'hiring' && 'Hiring'}
                {openToType === 'services' && 'Providing services'}
              </h3>
              <button onClick={() => setOpenToType(null)} className="text-gray-400 hover:text-gray-600">
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
            <div className="space-y-4">
              {openToType === 'job' && (
                <>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">Job titles *</label>
                    <input type="text" className="w-full p-3 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:outline-none" placeholder="Add job titles you're interested in" />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">Location types</label>
                    <div className="space-y-2">
                      {['On-site', 'Hybrid', 'Remote'].map((type) => (
                        <label key={type} className="flex items-center space-x-2">
                          <input type="checkbox" className="rounded border-gray-300 text-blue-600 focus:ring-blue-500" />
                          <span className="text-sm">{type}</span>
                        </label>
                      ))}
                    </div>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">Start date</label>
                    <select className="w-full p-3 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:outline-none">
                      <option>Immediately</option>
                      <option>Within 1 month</option>
                      <option>Within 3 months</option>
                    </select>
                  </div>
                  <div className="p-4 bg-gray-50 rounded-lg">
                    <h4 className="font-semibold text-sm mb-2">Who can see this?</h4>
                    <div className="space-y-2">
                      <label className="flex items-center space-x-2">
                        <input type="radio" name="visibility" defaultChecked className="text-blue-600 focus:ring-blue-500" />
                        <span className="text-sm">Recruiters only</span>
                      </label>
                      <label className="flex items-center space-x-2">
                        <input type="radio" name="visibility" className="text-blue-600 focus:ring-blue-500" />
                        <span className="text-sm">All MicroDin members</span>
                      </label>
                    </div>
                  </div>
                </>
              )}
              {openToType === 'hiring' && (
                <>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">Job title *</label>
                    <input type="text" className="w-full p-3 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:outline-none" placeholder="What role are you hiring for?" />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">Company</label>
                    <input type="text" className="w-full p-3 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:outline-none" defaultValue="NexusAI" />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">Location</label>
                    <input type="text" className="w-full p-3 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:outline-none" placeholder="Where is this position based?" />
                  </div>
                  <p className="text-xs text-gray-500">#Hiring will be added to your profile photo</p>
                </>
              )}
              {openToType === 'services' && (
                <>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">Services you offer *</label>
                    <input type="text" className="w-full p-3 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:outline-none" placeholder="Ex: Web Development, Consulting" />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">Description</label>
                    <textarea
                      className="w-full p-3 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:outline-none"
                      rows={4}
                      placeholder="Describe the services you provide..."
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">Location</label>
                    <input type="text" className="w-full p-3 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:outline-none" placeholder="Where do you provide services?" />
                  </div>
                </>
              )}
              <div className="flex space-x-3 pt-4">
                <button
                  onClick={() => setOpenToType(null)}
                  className="flex-1 py-2 border border-gray-300 rounded-full text-sm font-semibold text-gray-700 hover:bg-gray-50 transition-colors"
                >
                  Cancel
                </button>
                <button
                  onClick={() => setOpenToType(null)}
                  className="flex-1 py-2 bg-blue-600 text-white rounded-full text-sm font-semibold hover:bg-blue-700 transition-colors"
                >
                  Save
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Lock screen overlay */}
      {isSignedOut && (
        <div className="fixed inset-0 z-50 flex items-center justify-center" style={{ backgroundColor: "rgba(0,0,0,0.5)", backdropFilter: "blur(6px)" }}>
          <div className="bg-white rounded-lg shadow-2xl p-8 w-[360px] flex flex-col items-center">
            <div className="text-2xl font-bold mb-6" style={{ color: "#0A66C2" }}>Micro<span style={{ fontWeight: 800 }}>Din</span></div>
            <div className="w-20 h-20 rounded-full flex items-center justify-center text-white text-2xl font-bold mb-4" style={{ backgroundColor: "#0A66C2" }}>
              {selfUser?.name?.split(" ").map((n: string) => n[0]).join("") || "U"}
            </div>
            <div className="text-lg font-semibold text-gray-900 mb-1">{selfUser?.name || "User"}</div>
            <div className="text-sm text-gray-500 mb-6">{selfUser?.email || "user@microdin.com"}</div>
            <input type="password" readOnly value="••••••••" className="w-full px-4 py-2 border border-gray-300 rounded mb-4 text-center text-gray-400 bg-gray-50" />
            <button onClick={() => setIsSignedOut(false)} className="w-full py-2 text-white rounded-full font-semibold hover:opacity-90 transition-opacity" style={{ backgroundColor: "#0A66C2" }}>
              Sign in
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default MicroDin;
