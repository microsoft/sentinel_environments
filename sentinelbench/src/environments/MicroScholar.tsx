import { useState, useEffect, useRef, useMemo, useCallback } from "react";

import { useMicroscholarData, type ApiPaper, type ApiCoauthor } from "../hooks/useMicroscholarData";
import {
  Menu,
  GraduationCap,
  Star,
  FlaskConical,
  Search,
  Quote,
  BookmarkPlus,
  ArrowLeft,
  Settings,
  Bell,
  BarChart3,
  List,
  Grid3X3,
  X,
  HelpCircle,
  Beaker,
  MoreVertical,
  ChevronRight,
  Pencil,

  Trash2,
  UserPlus,
} from "lucide-react";

export const TASK_ID_MICROSCHOLAR = "microscholar";

// ============================================================================
// LOCAL TYPE DEFINITIONS (extending UserProfile with scholar data)
// ============================================================================

/**
 * ScholarUser combines base UserProfile with scholar-specific fields.
 * This allows the component to work with the nested user structure.
 */
interface ScholarUser {
  id: string;
  isSelf?: boolean;
  name: string;
  email: string;
  avatarUrl: string;
  affiliation: string;
  department?: string;
  title: string;
  location: string;
  interests: string[];
  // Scholar-specific stats
  citations: number;
  hIndex: number;
  i10Index: number;
  citationsSince2020: number;
  hIndexSince2020: number;
  isVerified?: boolean;
  homepage?: string;
  orcid?: string;
}

// Alias for Paper type (now ApiPaper from hook)
type Paper = ApiPaper;

// ============================================================================
// VIEW TYPES
// ============================================================================
type ViewType = "home" | "profile" | "library" | "labs" | "settings" | "help" | "alerts" | "metrics" | "scholar-profile" | "paper-detail" | "ai-search" | "citation-graph" | "privacy" | "terms";

// Task thresholds (for future use with different task types)
const _TASK_THRESHOLDS = {
  citation: 1000,    // Wait for paper to reach N citations
  new_paper: 1,      // Wait for new paper to appear
  cited_by: 1,       // Wait for paper to be cited
  alert: 1,          // Wait for alert to trigger
  search: 1,         // Wait for specific paper in search
} as const;
void _TASK_THRESHOLDS; // Preserve for documentation

// ============================================================================
// MAIN COMPONENT
// ============================================================================

const MicroScholar = () => {
  // ---------------------------------------------------------------------------
  // Server Data Hook
  // ---------------------------------------------------------------------------
  const {
    papers,
    alerts,
    coauthors,
    config,
    users,
    isLoading,
    error,
    citePaper: hookCitePaper,
    savePaper: hookSavePaper,
    markAlertRead: hookMarkAlertRead,

    searchPapers: hookSearchPapers,
    advancedSearchPapers: hookAdvancedSearchPapers,
  } = useMicroscholarData();

  // ---------------------------------------------------------------------------
  // API-derived helpers (replaces static syntheticData)
  // ---------------------------------------------------------------------------
  const toScholarUser = useCallback((u: Record<string, any>): ScholarUser => {
    const s = u.scholar || {};
    return {
      id: u.id,
      isSelf: u.isSelf,
      name: u.name,
      email: s.email ?? u.email ?? "",
      avatarUrl: u.avatarUrl ?? "",
      affiliation: s.affiliation ?? "",
      department: s.department,
      title: s.title ?? "",
      location: u.location ?? "",
      interests: s.interests ?? [],
      citations: s.citations ?? 0,
      hIndex: s.hIndex ?? 0,
      i10Index: s.i10Index ?? 0,
      citationsSince2020: s.citationsSince2020 ?? 0,
      hIndexSince2020: s.hIndexSince2020 ?? 0,
      isVerified: s.isVerified,
      homepage: s.homepage,
      orcid: s.orcid,
    };
  }, []);

  const scholarUsers = useMemo(() =>
    Object.values(users)
      .filter((u: any) => !!u.scholar)
      .map((u: any) => toScholarUser(u)),
    [users, toScholarUser]
  );

  const selfUser = useMemo(() => {
    const raw = config?.selfUser;
    return raw?.scholar ? toScholarUser(raw) : scholarUsers.find(u => u.isSelf);
  }, [config, toScholarUser, scholarUsers]);
  const user = selfUser;

  const getUserById = useCallback((id: string): ScholarUser | undefined => {
    const raw = users[id];
    return raw?.scholar ? toScholarUser(raw) : undefined;
  }, [users, toScholarUser]);

  const getPapersByAuthor = useCallback((authorId: string): Paper[] =>
    papers.filter(p => p.authorIds?.includes(authorId)).sort((a, b) => b.citedBy - a.citedBy),
    [papers]
  );

  const getTotalCitationsFromPapers = useCallback((authorId: string): number =>
    getPapersByAuthor(authorId).reduce((sum, p) => sum + p.citedBy, 0),
    [getPapersByAuthor]
  );

  const getCoauthors = useCallback((authorId: string): ScholarUser[] => {
    const ids = new Set<string>();
    coauthors.forEach((rel: ApiCoauthor) => {
      if (rel.authorId1 === authorId) ids.add(rel.authorId2);
      if (rel.authorId2 === authorId) ids.add(rel.authorId1);
    });
    return Array.from(ids).map(id => getUserById(id)).filter((u): u is ScholarUser => u !== undefined);
  }, [coauthors, getUserById]);

  const getRegularPapers = useCallback((): Paper[] =>
    papers.filter(p => !p.isTargetPaper),
    [papers]
  );

  const taskDuration = config?.duration ?? 120;

  // ---------------------------------------------------------------------------
  // State Variables
  // ---------------------------------------------------------------------------
  const [startTime] = useState(Date.now());
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<Paper[]>([]);
  const [targetPaperShown, setTargetPaperShown] = useState(false);
  const [targetPaperClicked, setTargetPaperClicked] = useState(false);
  const [isSignedOut, setIsSignedOut] = useState(false);
  const [thresholdReachedAt, setThresholdReachedAt] = useState<number | null>(null);
  const [actionCompleted, setActionCompleted] = useState(false);
  const [_actionCompletedAt, setActionCompletedAt] = useState<number | null>(null);
  const [showCiteModal, setShowCiteModal] = useState(false);
  const [selectedPaper, setSelectedPaper] = useState<Paper | null>(null);
  const [savedPapers, setSavedPapers] = useState<string[]>([]);
  const [currentTime, setCurrentTime] = useState(Date.now());
  const [searchType, setSearchType] = useState<"articles" | "caselaw">("articles");
  const [showMenu, setShowMenu] = useState(false);
  const [showProfileDropdown, setShowProfileDropdown] = useState(false);
  const [currentView, setCurrentView] = useState<ViewType>("home");
  const [showAdvancedSearch, setShowAdvancedSearch] = useState(false);
  const [libraryView, setLibraryView] = useState<"list" | "grid">("list");
  const [settingsSection, setSettingsSection] = useState<"search" | "languages" | "library" | "account">("search");

  // Advanced search state
  const [advAllWords, setAdvAllWords] = useState("");
  const [advExactPhrase, setAdvExactPhrase] = useState("");
  const [advAtLeastOne, setAdvAtLeastOne] = useState("");
  const [advWithout, setAdvWithout] = useState("");
  const [advAuthor, setAdvAuthor] = useState("");
  const [advPublication, setAdvPublication] = useState("");
  const [advDateStart, setAdvDateStart] = useState("");
  const [advDateEnd, setAdvDateEnd] = useState("");

  // Pagination state
  const [currentPage, setCurrentPage] = useState(1);
  const RESULTS_PER_PAGE = 10;

  // Search filters state
  const [sortBy, setSortBy] = useState<"relevance" | "date" | "citations">("relevance");
  const [yearFilter, setYearFilter] = useState<"any" | "2024" | "2023" | "2020" | "custom">("any");
  const [customYearStart] = useState("");
  const [customYearEnd] = useState("");
  const [includeBooks, setIncludeBooks] = useState(true);

  // New state for viewing other scholars and managing coauthors
  const [viewingScholarId, setViewingScholarId] = useState<string | null>(null);
  const [viewingPaperId, setViewingPaperId] = useState<string | null>(null);
  const [showEditCoauthorsModal, setShowEditCoauthorsModal] = useState(false);
  const [userCoauthorIds, setUserCoauthorIds] = useState<string[]>([]);
  const [showAllPapers, setShowAllPapers] = useState(false);
  const [showAllViewingScholarPapers, setShowAllViewingScholarPapers] = useState(false);
  const INITIAL_PAPERS_TO_SHOW = 5;

  // AI Search state
  const [aiSearchQuery, setAiSearchQuery] = useState("");
  const [aiSearchResults, setAiSearchResults] = useState<Paper[]>([]);
  const [aiSearchLoading, setAiSearchLoading] = useState(false);

  // Citation graph state
  const [citationGraphPaperId, setCitationGraphPaperId] = useState<string | null>(null);

  // Library filter state
  const [libraryFilter, setLibraryFilter] = useState<"all" | "to-read" | "important">("all");
  const [paperLabels, setPaperLabels] = useState<Record<string, string[]>>({});

  // Edit profile modal state
  const [showEditProfileModal, setShowEditProfileModal] = useState(false);
  const [editProfileName, setEditProfileName] = useState("");
  const [editProfileAffiliation, setEditProfileAffiliation] = useState("");

  // Create alert form state
  const [newAlertType, setNewAlertType] = useState<"citation" | "keyword" | "new_paper">("citation");
  const [newAlertKeywords, setNewAlertKeywords] = useState("");

  // Home page recommended articles view
  const [recommendedView, setRecommendedView] = useState<"list" | "grid">("list");

  // Toast notification state
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const showToast = (message: string) => {
    setToastMessage(message);
    setTimeout(() => setToastMessage(null), 3000);
  };

  // Select all papers state
  const [selectAllPapers, setSelectAllPapers] = useState(false);
  const [selectedPaperIds, setSelectedPaperIds] = useState<string[]>([]);

  const searchInputRef = useRef<HTMLInputElement>(null);
  const menuButtonRef = useRef<HTMLButtonElement>(null);
  const profileButtonRef = useRef<HTMLButtonElement>(null);

  const getInitials = (name: string) => {
    if (!name) return "";
    const parts = name.split(' ');
    if (parts.length > 1) {
      return `${parts[0][0]}${parts[parts.length - 1][0]}`.toUpperCase();
    }
    return name.substring(0, 2).toUpperCase();
  }

  // ---------------------------------------------------------------------------
  // Effects
  // ---------------------------------------------------------------------------

  // Update current time every second
  useEffect(() => {
    const timer = setInterval(() => setCurrentTime(Date.now()), 1000);
    return () => clearInterval(timer);
  }, []);


  // Initialize coauthor IDs from API data once loaded
  useEffect(() => {
    if (!selfUser || userCoauthorIds.length > 0) return;
    const ids = getCoauthors(selfUser.id).map(c => c.id);
    if (ids.length > 0) setUserCoauthorIds(ids);
  }, [selfUser, getCoauthors, userCoauthorIds.length]);

  // Target paper injection detection — server injects the target paper via event.
  // When it appears in polled data, prepend to search results if active.
  useEffect(() => {
    if (targetPaperShown) return;
    const targetInPolled = papers.find(p => p.isTargetPaper);
    if (targetInPolled) {
      setTargetPaperShown(true);
      if (thresholdReachedAt === null) {
        setThresholdReachedAt(Date.now());
      }
      // If search results are active, prepend the target paper
      if (searchResults.length > 0 && !searchResults.find(p => p.isTargetPaper)) {
        setSearchResults((prev) => [targetInPolled as Paper, ...prev]);
      }
    }
  }, [papers, targetPaperShown, thresholdReachedAt, searchResults]);

  // ---------------------------------------------------------------------------
  // Handlers
  // ---------------------------------------------------------------------------

  const handleSearch = useCallback(async (e: React.FormEvent) => {
    e.preventDefault();
    if (!searchQuery.trim()) return;

    // Delegate search to server
    const results = await hookSearchPapers(searchQuery);
    setSearchResults(results as Paper[]);
    setCurrentPage(1); // Reset to first page on new search
  }, [searchQuery, hookSearchPapers]);

  const handleAdvancedSearch = useCallback(async () => {
    // Delegate advanced search to server
    const results = await hookAdvancedSearchPapers({
      allWords: advAllWords,
      exactPhrase: advExactPhrase,
      atLeastOne: advAtLeastOne,
      without: advWithout,
      author: advAuthor,
      publication: advPublication,
      dateStart: advDateStart,
      dateEnd: advDateEnd,
    });
    setSearchResults(results as Paper[]);
    setCurrentPage(1);
    setShowAdvancedSearch(false);
  }, [hookAdvancedSearchPapers, advAllWords, advExactPhrase, advAtLeastOne, advWithout, advAuthor, advPublication, advDateStart, advDateEnd]);

  const handleCiteClick = (paper: Paper) => {
    setSelectedPaper(paper);
    setShowCiteModal(true);

    // Notify server of citation action (for active mode evaluation)
    hookCitePaper(paper.id);

    // Mark action as completed when citing the target paper
    if (paper.isTargetPaper && !actionCompleted) {
      setTargetPaperClicked(true);
      setActionCompleted(true);
      setActionCompletedAt(Date.now());
    }
  };

  const handleSavePaper = (paperId: string) => {
    setSavedPapers((prev) =>
      prev.includes(paperId) ? prev.filter((id) => id !== paperId) : [...prev, paperId]
    );
    hookSavePaper(paperId);
  };

  const handleResetTask = () => {
    if (window.confirm("Reset this task? Progress will be lost.")) {
      window.location.reload();
    }
  };

  const getCitationFormats = (paper: Paper) => {
    const authorParts = paper.authors.split(", ");
    const firstAuthor = authorParts[0] || "Author";

    return [
      {
        name: "MLA",
        citation: `${firstAuthor}, et al. "${paper.title}." ${paper.source} (${paper.year}).`,
      },
      {
        name: "APA",
        citation: `${firstAuthor}, et al. (${paper.year}). ${paper.title}. ${paper.source}.`,
      },
      {
        name: "Chicago",
        citation: `${paper.authors}. "${paper.title}." ${paper.source} (${paper.year}).`,
      },
      {
        name: "Harvard",
        citation: `${firstAuthor}, et al., ${paper.year}. ${paper.title}. ${paper.source}.`,
      },
      {
        name: "Vancouver",
        citation: `${firstAuthor}, et al. ${paper.title}. ${paper.source}. ${paper.year}.`,
      },
    ];
  };

  // ---------------------------------------------------------------------------
  // Computed Values
  // ---------------------------------------------------------------------------
  const elapsedTime = Math.floor((currentTime - startTime) / 1000);
  const isLocalhost = window.location.hostname === "localhost";
  const [adminConsoleEnabled, setAdminConsoleEnabled] = useState(() => {
    return localStorage.getItem("adminConsoleEnabled") === "true";
  });

  useEffect(() => {
    const handleStorageChange = () => {
      setAdminConsoleEnabled(localStorage.getItem("adminConsoleEnabled") === "true");
    };
    window.addEventListener("storage", handleStorageChange);
    const interval = setInterval(handleStorageChange, 2000);
    return () => {
      window.removeEventListener("storage", handleStorageChange);
      clearInterval(interval);
    };
  }, []);

  const showDevTools = isLocalhost || adminConsoleEnabled;

  // ---------------------------------------------------------------------------
  // Loading Gate
  // ---------------------------------------------------------------------------
  if (!config || isLoading) {
    const isNetworkError = error && /failed to fetch|networkerror/i.test(error);
    const isNoSession = error && /409/.test(error);
    const isMismatch = error && /environment mismatch/i.test(error);
    return (
      <div className="flex items-center justify-center h-screen bg-white">
        <div className="text-center max-w-md px-6">
          <div className="text-4xl mb-3">🎓</div>
          <h1 className="text-xl font-semibold mb-6 text-gray-900">MicroScholar</h1>
          {!error ? (
            <>
              <div className="w-8 h-8 border-2 border-blue-500 border-t-transparent rounded-full animate-spin mx-auto mb-4" />
              <p className="text-sm text-gray-500">Connecting to MicroScholar...</p>
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
              <p className="text-sm text-gray-500">Navigate to the correct environment from the desktop, or re-init with a MicroScholar scenario.</p>
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


  // ---------------------------------------------------------------------------
  // Back Header Component (reused across views)
  // ---------------------------------------------------------------------------
  const BackHeader = () => (
    <header className="border-b border-gray-200 bg-white">
      <div className="max-w-7xl mx-auto px-6 py-4 flex items-center justify-between">
        <button
          onClick={() => setCurrentView("home")}
          className="text-[#1a73e8] hover:underline text-sm flex items-center space-x-1"
        >
          <ArrowLeft className="w-4 h-4" />
          <span>Back to Scholar</span>
        </button>
        <img src="desktop/microscholar-icon.png" alt="MicroScholar" className="h-6 object-contain" />
        <div className="w-32"></div>
      </div>
    </header>
  );

  // ---------------------------------------------------------------------------
  // Helper: Get coauthors based on userCoauthorIds state
  // ---------------------------------------------------------------------------
  const getUserCoauthors = (): ScholarUser[] => {
    return userCoauthorIds
      .map(id => getUserById(id))
      .filter((u): u is ScholarUser => u !== undefined);
  };

  // ---------------------------------------------------------------------------
  // PROFILE VIEW
  // ---------------------------------------------------------------------------
  if (currentView === "profile") {
    // Get user's papers and coauthors from the new data
    const userPapers = user ? getPapersByAuthor(user.id) : [];
    const userCoauthors = getUserCoauthors();
    const totalCitationsFromPapers = user ? getTotalCitationsFromPapers(user.id) : 0;
    const papersToShow = showAllPapers ? userPapers : userPapers.slice(0, INITIAL_PAPERS_TO_SHOW);
    const hasMorePapers = userPapers.length > INITIAL_PAPERS_TO_SHOW;

    if (!user) {
      return (
        <div className="min-h-screen bg-white">
          <BackHeader />
          <div className="max-w-4xl mx-auto px-6 py-8">
            <p>User profile not found.</p>
          </div>
        </div>
      );
    }

    return (
      <div className="min-h-screen bg-gray-50">
        {/* Header with profile dropdown */}
        <header className="border-b border-gray-200 bg-white">
          <div className="max-w-6xl mx-auto px-4 py-3 flex items-center justify-between">
            <button
              onClick={() => setCurrentView("home")}
              className="text-[#1a73e8] hover:underline text-sm flex items-center space-x-1"
            >
              <ArrowLeft className="w-4 h-4" />
              <span>Back to Scholar</span>
            </button>
            <img src="desktop/microscholar-icon.png" alt="MicroScholar" className="h-6 object-contain" />
            <div className="relative">
              <button
                onClick={() => setShowProfileDropdown(!showProfileDropdown)}
                className="w-8 h-8 rounded-full flex items-center justify-center hover:ring-2 hover:ring-blue-200 transition-all cursor-pointer overflow-hidden"
                title={user?.name ?? ""}
              >
                {user?.avatarUrl ? (
                  <img src={user.avatarUrl} alt={user.name} className="w-full h-full object-cover" />
                ) : (
                  <span className="w-full h-full bg-blue-500 flex items-center justify-center text-white text-sm font-medium">{getInitials(user?.name ?? "")}</span>
                )}
              </button>
              {showProfileDropdown && (
                <div className="absolute right-0 top-full mt-1 bg-white border border-gray-200 rounded-lg shadow-lg py-2 z-50 w-56">
                  <div className="px-4 py-2 border-b border-gray-100">
                    <p className="font-medium text-sm text-gray-900">{user?.name}</p>
                    <p className="text-xs text-gray-500">{user?.email ?? ""}</p>
                  </div>
                  <button
                    onClick={() => {
                      setCurrentView("settings");
                      setShowProfileDropdown(false);
                    }}
                    className="block w-full text-left px-4 py-2 hover:bg-gray-100 text-sm text-gray-700"
                  >
                    <Settings className="w-4 h-4 inline mr-2" />
                    Settings
                  </button>
                  <hr className="my-2" />
                  <button
                    onClick={() => {
                      setIsSignedOut(true);
                      setShowProfileDropdown(false);
                    }}
                    disabled={isSignedOut}
                    className="block w-full text-left px-4 py-2 hover:bg-gray-100 text-sm text-gray-700 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {isSignedOut ? "Signed Out" : "Sign out"}
                  </button>
                </div>
              )}
            </div>
          </div>
        </header>

        <div className="max-w-6xl mx-auto py-8 px-4">
          <div className="grid grid-cols-12 gap-8">
            {/* Main content */}
            <div className="col-span-8">
              {/* Profile Header */}
              <div className="flex items-start space-x-6 mb-6">
                {user.avatarUrl ? (
                  <img src={user.avatarUrl} alt={user.name} className="w-28 h-28 rounded-full object-cover ring-4 ring-white" />
                ) : (
                  <div className="w-28 h-28 bg-gradient-to-br from-blue-500 to-blue-600 rounded-full flex items-center justify-center ring-4 ring-white">
                    <span className="text-white text-4xl font-medium">{getInitials(user.name)}</span>
                  </div>
                )}
                <div className="flex-1 pt-2">
                  <div className="flex items-center">
                    <h2 className="text-2xl font-normal mb-1">{user.name}</h2>
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        setEditProfileName(user.name);
                        setEditProfileAffiliation(user.affiliation);
                        setShowEditProfileModal(true);
                      }}
                      className="ml-3 text-gray-500 hover:text-gray-700"
                      title="Edit profile"
                    >
                      <Pencil className="w-4 h-4"/>
                    </button>
                  </div>
                  <p className="text-gray-600 mb-2">{user.title}, {user.affiliation}</p>
                  <p className="text-sm text-gray-500">Verified email at {user.email.split('@')[1]}</p>
                  <div className="flex flex-wrap gap-2 mt-3">
                    {(user.interests || []).map((interest) => (
                      <span key={interest} className="px-3 py-1 bg-gray-100 text-gray-700 rounded-full text-xs capitalize hover:bg-gray-200 cursor-pointer">
                        {interest}
                      </span>
                    ))}
                  </div>
                </div>
              </div>

              {/* Publication list */}
              <div className="bg-white p-4 rounded-lg border border-gray-200">
                <div className="grid grid-cols-12 items-center pb-3 border-b border-gray-200 mb-3 text-sm font-medium text-gray-500">
                  <div className="col-span-9 flex items-center space-x-2">
                    <input
                      type="checkbox"
                      className="w-4 h-4"
                      checked={selectAllPapers}
                      onChange={(e) => {
                        setSelectAllPapers(e.target.checked);
                        if (e.target.checked) {
                          setSelectedPaperIds(papersToShow.map(p => p.id));
                        } else {
                          setSelectedPaperIds([]);
                        }
                      }}
                    />
                    <span>TITLE</span>
                  </div>
                  <div className="col-span-1 text-right">CITED BY</div>
                  <div className="col-span-2 text-right">YEAR</div>
                </div>
                <div className="space-y-4">
                  {papersToShow.map(paper => (
                    <div key={paper.id} className="grid grid-cols-12 items-start">
                      <div className="col-span-9 flex items-start">
                        <input
                          type="checkbox"
                          className="w-4 h-4 mt-1 mr-3"
                          checked={selectedPaperIds.includes(paper.id)}
                          onChange={(e) => {
                            if (e.target.checked) {
                              setSelectedPaperIds(prev => [...prev, paper.id]);
                            } else {
                              setSelectedPaperIds(prev => prev.filter(id => id !== paper.id));
                              setSelectAllPapers(false);
                            }
                          }}
                        />
                        <div>
                          <button
                            onClick={() => {
                              setViewingPaperId(paper.id);
                              setCurrentView("paper-detail");
                            }}
                            className="text-blue-800 hover:underline text-left"
                          >
                            {paper.title}
                          </button>
                          <div className="text-xs text-gray-600">
                            {(paper.authorIds || []).map((authorId, idx) => {
                              const author = getUserById(authorId);
                              if (!author) return null;
                              return (
                                <span key={authorId}>
                                  {idx > 0 && ", "}
                                  {author.id === user?.id ? (
                                    <span className="text-gray-600">{author.name}</span>
                                  ) : (
                                    <button
                                      onClick={() => {
                                        setViewingScholarId(author.id);
                                        setShowAllViewingScholarPapers(false);
                                        setCurrentView("scholar-profile");
                                      }}
                                      className="text-blue-700 hover:underline"
                                    >
                                      {author.name}
                                    </button>
                                  )}
                                </span>
                              );
                            })}
                          </div>
                          <div className="text-xs text-gray-500">{paper.source}</div>
                        </div>
                      </div>
                      <div className="col-span-1 text-right text-sm text-blue-800 hover:underline cursor-pointer">{paper.citedBy}</div>
                      <div className="col-span-2 text-right text-sm">{paper.year}</div>
                    </div>
                  ))}
                </div>
                <div className="text-center mt-4">
                  {showAllPapers ? (
                    <button
                      onClick={() => setShowAllPapers(false)}
                      className="text-sm text-gray-600 hover:text-gray-800"
                    >
                      SHOW LESS
                    </button>
                  ) : (
                    <button
                      onClick={() => setShowAllPapers(true)}
                      disabled={!hasMorePapers}
                      className={`text-sm ${hasMorePapers ? 'text-gray-600 hover:text-gray-800' : 'text-gray-300 cursor-not-allowed'}`}
                    >
                      SHOW MORE
                    </button>
                  )}
                </div>
              </div>
            </div>

            {/* Sidebar */}
            <div className="col-span-4">
              {/* Cited by with Bar Chart */}
              <div className="bg-white p-4 rounded-lg border border-gray-200 mb-6">
                <div className="flex items-center justify-between mb-3">
                  <h3 className="text-sm font-medium text-gray-800">Cited by</h3>
                </div>

                {/* Citation Bar Chart */}
                {(() => {
                  // Generate citation data by year based on total citations from papers
                  const currentYear = new Date().getFullYear();
                  const years = Array.from({ length: 10 }, (_, i) => currentYear - 9 + i);

                  // Generate realistic-looking citation growth (exponential-ish)
                  const rawData = years.map((year, idx) => {
                    const progress = (idx + 1) / years.length;
                    const base = Math.pow(progress, 1.8) * totalCitationsFromPapers * 0.15;
                    const variance = (Math.sin(year * 12.9898) * 43758.5453) % 1 * 0.3 + 0.85;
                    return Math.round(base * variance);
                  });

                  const maxCitations = Math.max(...rawData);

                  return (
                    <div className="mb-4">
                      {/* Bar chart */}
                      <div className="flex items-end justify-between h-20 gap-1 mb-1">
                        {rawData.map((citations, idx) => {
                          const height = maxCitations > 0 ? (citations / maxCitations) * 100 : 0;
                          return (
                            <div
                              key={years[idx]}
                              className="flex-1 bg-[#4285f4] hover:bg-[#1a73e8] cursor-pointer transition-colors rounded-t-sm"
                              style={{ height: `${Math.max(height, 2)}%` }}
                              title={`${years[idx]}: ${citations} citations`}
                            />
                          );
                        })}
                      </div>
                      {/* Year labels */}
                      <div className="flex justify-between text-[10px] text-gray-500">
                        {years.filter((_, i) => i % 2 === 0).map(year => (
                          <span key={year}>{year}</span>
                        ))}
                      </div>
                    </div>
                  );
                })()}

                {/* Stats table - using dynamic total from papers */}
                <table className="w-full text-sm">
                  <thead>
                    <tr className="text-left text-xs text-gray-500">
                      <th></th>
                      <th className="font-normal text-right">All</th>
                      <th className="font-normal text-right">Since 2020</th>
                    </tr>
                  </thead>
                  <tbody className="text-gray-700">
                    <tr>
                      <td className="py-1">Citations</td>
                      <td className="text-right text-blue-800 hover:underline cursor-pointer">{totalCitationsFromPapers.toLocaleString()}</td>
                      <td className="text-right text-blue-800 hover:underline cursor-pointer">{Math.round(totalCitationsFromPapers * 0.7).toLocaleString()}</td>
                    </tr>
                    <tr>
                      <td className="py-1">h-index</td>
                      <td className="text-right">{user.hIndex}</td>
                      <td className="text-right">{user.hIndexSince2020}</td>
                    </tr>
                    <tr>
                      <td className="py-1">i10-index</td>
                      <td className="text-right">{user.i10Index}</td>
                      <td className="text-right">-</td>
                    </tr>
                  </tbody>
                </table>
              </div>

              {/* Co-authors */}
              <div className="bg-white p-4 rounded-lg border border-gray-200">
                <div className="flex items-center justify-between mb-3">
                  <h3 className="text-sm font-medium text-gray-800">Co-authors</h3>
                  <button
                    onClick={() => setShowEditCoauthorsModal(true)}
                    className="text-xs font-medium text-blue-700 hover:underline"
                  >
                    EDIT
                  </button>
                </div>
                <div className="space-y-3">
                  {userCoauthors.slice(0, 5).map(coauthor => (
                    <button
                      key={coauthor.id}
                      onClick={() => {
                        setViewingScholarId(coauthor.id);
                        setShowAllViewingScholarPapers(false);
                        setCurrentView("scholar-profile");
                      }}
                      className="flex items-center space-x-3 group w-full text-left"
                    >
                      {coauthor.avatarUrl ? (
                        <img src={coauthor.avatarUrl} alt={coauthor.name} className="w-8 h-8 rounded-full object-cover" />
                      ) : (
                        <div className="w-8 h-8 bg-gray-300 rounded-full flex items-center justify-center">
                          <span className="text-white text-xs font-medium">{getInitials(coauthor.name)}</span>
                        </div>
                      )}
                      <div className="flex-1">
                        <p className="text-sm text-blue-800 group-hover:underline">{coauthor.name}</p>
                        <p className="text-xs text-gray-500">{coauthor.title}</p>
                      </div>
                      <ChevronRight className="w-5 h-5 text-gray-400" />
                    </button>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // ---------------------------------------------------------------------------
  // SCHOLAR PROFILE VIEW (viewing another scholar's profile)
  // ---------------------------------------------------------------------------
  if (currentView === "scholar-profile" && viewingScholarId) {
    const viewingScholar = getUserById(viewingScholarId);
    const scholarPapers = viewingScholar ? getPapersByAuthor(viewingScholar.id) : [];
    const scholarCoauthors = viewingScholar ? getCoauthors(viewingScholar.id) : [];
    const scholarTotalCitations = viewingScholar ? getTotalCitationsFromPapers(viewingScholar.id) : 0;
    const scholarPapersToShow = showAllViewingScholarPapers ? scholarPapers : scholarPapers.slice(0, INITIAL_PAPERS_TO_SHOW);
    const scholarHasMorePapers = scholarPapers.length > INITIAL_PAPERS_TO_SHOW;

    if (!viewingScholar) {
      return (
        <div className="min-h-screen bg-white">
          <BackHeader />
          <div className="max-w-4xl mx-auto px-6 py-8">
            <p>Scholar profile not found.</p>
          </div>
        </div>
      );
    }

    return (
      <div className="min-h-screen bg-gray-50">
        {/* Header */}
        <header className="border-b border-gray-200 bg-white">
          <div className="max-w-6xl mx-auto px-4 py-3 flex items-center justify-between">
            <button
              onClick={() => {
                setViewingScholarId(null);
                setCurrentView("profile");
              }}
              className="text-[#1a73e8] hover:underline text-sm flex items-center space-x-1"
            >
              <ArrowLeft className="w-4 h-4" />
              <span>Back to my profile</span>
            </button>
            <img src="desktop/microscholar-icon.png" alt="MicroScholar" className="h-6 object-contain" />
            <div className="w-32"></div>
          </div>
        </header>

        <div className="max-w-6xl mx-auto py-8 px-4">
          <div className="grid grid-cols-12 gap-8">
            {/* Main content */}
            <div className="col-span-8">
              {/* Profile Header */}
              <div className="flex items-start space-x-6 mb-6">
                {viewingScholar.avatarUrl ? (
                  <img src={viewingScholar.avatarUrl} alt={viewingScholar.name} className="w-28 h-28 rounded-full object-cover ring-4 ring-white" />
                ) : (
                  <div className="w-28 h-28 bg-gradient-to-br from-gray-400 to-gray-500 rounded-full flex items-center justify-center ring-4 ring-white">
                    <span className="text-white text-4xl font-medium">{getInitials(viewingScholar.name)}</span>
                  </div>
                )}
                <div className="flex-1 pt-2">
                  <h2 className="text-2xl font-normal mb-1">{viewingScholar.name}</h2>
                  <p className="text-gray-600 mb-2">{viewingScholar.title}, {viewingScholar.affiliation}</p>
                  {viewingScholar.isVerified && (
                    <p className="text-sm text-gray-500">Verified email at {viewingScholar.email.split('@')[1]}</p>
                  )}
                  <div className="flex flex-wrap gap-2 mt-3">
                    {(viewingScholar.interests || []).map((interest) => (
                      <span key={interest} className="px-3 py-1 bg-gray-100 text-gray-700 rounded-full text-xs capitalize hover:bg-gray-200 cursor-pointer">
                        {interest}
                      </span>
                    ))}
                  </div>
                </div>
              </div>

              {/* Publication list */}
              <div className="bg-white p-4 rounded-lg border border-gray-200">
                <div className="grid grid-cols-12 items-center pb-3 border-b border-gray-200 mb-3 text-sm font-medium text-gray-500">
                  <div className="col-span-9 flex items-center space-x-2">
                    <span>TITLE</span>
                  </div>
                  <div className="col-span-1 text-right">CITED BY</div>
                  <div className="col-span-2 text-right">YEAR</div>
                </div>
                <div className="space-y-4">
                  {scholarPapersToShow.map(paper => (
                    <div key={paper.id} className="grid grid-cols-12 items-start">
                      <div className="col-span-9">
                        <div>
                          <button
                            onClick={() => {
                              setViewingPaperId(paper.id);
                              setCurrentView("paper-detail");
                            }}
                            className="text-blue-800 hover:underline text-left"
                          >
                            {paper.title}
                          </button>
                          <div className="text-xs text-gray-600">
                            {(paper.authorIds || []).map((authorId, idx) => {
                              const author = getUserById(authorId);
                              if (!author) return null;
                              return (
                                <span key={authorId}>
                                  {idx > 0 && ", "}
                                  {author.id === viewingScholarId ? (
                                    <span className="text-gray-600">{author.name}</span>
                                  ) : author.id === user?.id ? (
                                    <button
                                      onClick={() => {
                                        setViewingScholarId(null);
                                        setCurrentView("profile");
                                      }}
                                      className="text-blue-700 hover:underline"
                                    >
                                      {author.name}
                                    </button>
                                  ) : (
                                    <button
                                      onClick={() => {
                                        setViewingScholarId(author.id);
                                        setShowAllViewingScholarPapers(false);
                                      }}
                                      className="text-blue-700 hover:underline"
                                    >
                                      {author.name}
                                    </button>
                                  )}
                                </span>
                              );
                            })}
                          </div>
                          <div className="text-xs text-gray-500">{paper.source}</div>
                        </div>
                      </div>
                      <div className="col-span-1 text-right text-sm text-blue-800 hover:underline cursor-pointer">{paper.citedBy}</div>
                      <div className="col-span-2 text-right text-sm">{paper.year}</div>
                    </div>
                  ))}
                </div>
                <div className="text-center mt-4">
                  {showAllViewingScholarPapers ? (
                    <button
                      onClick={() => setShowAllViewingScholarPapers(false)}
                      className="text-sm text-gray-600 hover:text-gray-800"
                    >
                      SHOW LESS
                    </button>
                  ) : (
                    <button
                      onClick={() => setShowAllViewingScholarPapers(true)}
                      disabled={!scholarHasMorePapers}
                      className={`text-sm ${scholarHasMorePapers ? 'text-gray-600 hover:text-gray-800' : 'text-gray-300 cursor-not-allowed'}`}
                    >
                      SHOW MORE
                    </button>
                  )}
                </div>
              </div>
            </div>

            {/* Sidebar */}
            <div className="col-span-4">
              {/* Cited by with Bar Chart */}
              <div className="bg-white p-4 rounded-lg border border-gray-200 mb-6">
                <div className="flex items-center justify-between mb-3">
                  <h3 className="text-sm font-medium text-gray-800">Cited by</h3>
                </div>

                {/* Citation Bar Chart */}
                {(() => {
                  const currentYear = new Date().getFullYear();
                  const years = Array.from({ length: 10 }, (_, i) => currentYear - 9 + i);

                  const rawData = years.map((year, idx) => {
                    const progress = (idx + 1) / years.length;
                    const base = Math.pow(progress, 1.8) * scholarTotalCitations * 0.15;
                    const variance = (Math.sin(year * 12.9898) * 43758.5453) % 1 * 0.3 + 0.85;
                    return Math.round(base * variance);
                  });

                  const maxCitations = Math.max(...rawData);

                  return (
                    <div className="mb-4">
                      <div className="flex items-end justify-between h-20 gap-1 mb-1">
                        {rawData.map((citations, idx) => {
                          const height = maxCitations > 0 ? (citations / maxCitations) * 100 : 0;
                          return (
                            <div
                              key={years[idx]}
                              className="flex-1 bg-[#4285f4] hover:bg-[#1a73e8] cursor-pointer transition-colors rounded-t-sm"
                              style={{ height: `${Math.max(height, 2)}%` }}
                              title={`${years[idx]}: ${citations} citations`}
                            />
                          );
                        })}
                      </div>
                      <div className="flex justify-between text-[10px] text-gray-500">
                        {years.filter((_, i) => i % 2 === 0).map(year => (
                          <span key={year}>{year}</span>
                        ))}
                      </div>
                    </div>
                  );
                })()}

                {/* Stats table */}
                <table className="w-full text-sm">
                  <thead>
                    <tr className="text-left text-xs text-gray-500">
                      <th></th>
                      <th className="font-normal text-right">All</th>
                      <th className="font-normal text-right">Since 2020</th>
                    </tr>
                  </thead>
                  <tbody className="text-gray-700">
                    <tr>
                      <td className="py-1">Citations</td>
                      <td className="text-right text-blue-800">{scholarTotalCitations.toLocaleString()}</td>
                      <td className="text-right text-blue-800">{Math.round(scholarTotalCitations * 0.7).toLocaleString()}</td>
                    </tr>
                    <tr>
                      <td className="py-1">h-index</td>
                      <td className="text-right">{viewingScholar.hIndex}</td>
                      <td className="text-right">{viewingScholar.hIndexSince2020}</td>
                    </tr>
                    <tr>
                      <td className="py-1">i10-index</td>
                      <td className="text-right">{viewingScholar.i10Index}</td>
                      <td className="text-right">-</td>
                    </tr>
                  </tbody>
                </table>
              </div>

              {/* Co-authors */}
              <div className="bg-white p-4 rounded-lg border border-gray-200">
                <div className="flex items-center justify-between mb-3">
                  <h3 className="text-sm font-medium text-gray-800">Co-authors</h3>
                </div>
                <div className="space-y-3">
                  {scholarCoauthors.slice(0, 5).map(coauthor => (
                    <button
                      key={coauthor.id}
                      onClick={() => {
                        if (coauthor.id === user?.id) {
                          // Navigate to own profile
                          setViewingScholarId(null);
                          setCurrentView("profile");
                        } else {
                          // Navigate to other scholar's profile
                          setViewingScholarId(coauthor.id);
                          setShowAllViewingScholarPapers(false);
                        }
                      }}
                      className="flex items-center space-x-3 group w-full text-left"
                    >
                      {coauthor.avatarUrl ? (
                        <img src={coauthor.avatarUrl} alt={coauthor.name} className="w-8 h-8 rounded-full object-cover" />
                      ) : (
                        <div className={`w-8 h-8 ${coauthor.id === user?.id ? 'bg-blue-500' : 'bg-gray-300'} rounded-full flex items-center justify-center`}>
                          <span className="text-white text-xs font-medium">{getInitials(coauthor.name)}</span>
                        </div>
                      )}
                      <div className="flex-1">
                        <p className="text-sm text-blue-800 group-hover:underline">
                          {coauthor.name}
                          {coauthor.id === user?.id && <span className="text-gray-500 ml-1">(you)</span>}
                        </p>
                        <p className="text-xs text-gray-500">{coauthor.title}</p>
                      </div>
                      <ChevronRight className="w-5 h-5 text-gray-400" />
                    </button>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // ---------------------------------------------------------------------------
  // LIBRARY VIEW
  // ---------------------------------------------------------------------------
  if (currentView === "library") {
    return (
      <div className="min-h-screen bg-white">
        <BackHeader />
        <div className="max-w-7xl mx-auto px-6 py-8">
          <div className="flex gap-8">
            {/* Left Sidebar */}
            <div className="w-48 flex-shrink-0">
              <h2 className="text-lg font-medium text-gray-800 mb-4">My library</h2>

              {/* Labels/Filters */}
              <div className="space-y-1 mb-6">
                <button
                  onClick={() => setLibraryFilter("all")}
                  className={`w-full text-left px-3 py-2 rounded text-sm ${libraryFilter === "all" ? "bg-blue-100 text-[#1a73e8]" : "text-gray-700 hover:bg-gray-100"}`}
                >
                  All articles
                </button>
                <button
                  onClick={() => setLibraryFilter("to-read")}
                  className={`w-full text-left px-3 py-2 rounded text-sm ${libraryFilter === "to-read" ? "bg-blue-100 text-[#1a73e8]" : "text-gray-700 hover:bg-gray-100"}`}
                >
                  Reading list
                </button>
                <button
                  onClick={() => setLibraryFilter("important")}
                  className={`w-full text-left px-3 py-2 rounded text-sm ${libraryFilter === "important" ? "bg-blue-100 text-[#1a73e8]" : "text-gray-700 hover:bg-gray-100"}`}
                >
                  Important
                </button>
                <button
                  onClick={() => showToast("Trash is empty")}
                  className="w-full text-left px-3 py-2 rounded text-sm text-gray-700 hover:bg-gray-100"
                >
                  Trash
                </button>
              </div>

              <button
                onClick={() => {
                  const label = prompt("Enter new label name:");
                  if (label && label.trim()) {
                    showToast(`Label "${label}" created`);
                  }
                }}
                className="text-sm text-[#1a73e8] hover:underline"
              >
                Manage labels...
              </button>

              {/* Date filters */}
              <div className="mt-6 pt-6 border-t border-gray-200">
                <div className="text-xs text-gray-500 mb-2">Any time</div>
                <div className="space-y-1 text-sm">
                  <button className="block text-[#1a73e8] hover:underline">Since 2024</button>
                  <button className="block text-[#1a73e8] hover:underline">Since 2023</button>
                  <button className="block text-[#1a73e8] hover:underline">Since 2020</button>
                  <button className="block text-[#1a73e8] hover:underline">Custom range...</button>
                </div>
              </div>
            </div>

            {/* Main Content */}
            <div className="flex-1">
              <div className="flex items-center justify-between mb-4">
                <input
                  type="text"
                  placeholder="Search your library"
                  className="flex-1 max-w-md px-4 py-2 border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
                <div className="flex items-center space-x-2 ml-4">
                  <button
                    onClick={() => setLibraryView("list")}
                    className={`p-2 rounded ${libraryView === "list" ? "bg-gray-200" : "hover:bg-gray-100"}`}
                  >
                    <List className="w-5 h-5" />
                  </button>
                  <button
                    onClick={() => setLibraryView("grid")}
                    className={`p-2 rounded ${libraryView === "grid" ? "bg-gray-200" : "hover:bg-gray-100"}`}
                  >
                    <Grid3X3 className="w-5 h-5" />
                  </button>
                </div>
              </div>

          {savedPapers.length === 0 ? (
            <div className="text-center py-16">
              <Star className="w-24 h-24 mx-auto text-gray-300 mb-4" />
              <h3 className="text-xl text-gray-700 mb-2">Your library is empty</h3>
              <p className="text-gray-600 mb-4">Save articles to your library for easy access later</p>
              <button
                onClick={() => setCurrentView("home")}
                className="px-6 py-2 bg-[#4285F4] text-white rounded hover:bg-[#3367D6]"
              >
                Search for articles
              </button>
            </div>
          ) : (
            <div className={libraryView === "list" ? "space-y-6" : "grid grid-cols-3 gap-6"}>
              {savedPapers
                .filter(paperId => {
                  if (libraryFilter === "all") return true;
                  const labels = paperLabels[paperId] || [];
                  if (libraryFilter === "to-read") return labels.includes("to-read");
                  if (libraryFilter === "important") return labels.includes("important");
                  return true;
                })
                .map((paperId) => {
                const paper = papers.find((p) => p.id === paperId) || searchResults.find((p) => p.id === paperId);
                if (!paper) return null;
                const labels = paperLabels[paperId] || [];
                return (
                  <div key={paper.id} className={libraryView === "list" ? "" : "border border-gray-200 rounded p-4"}>
                    <h3 className="text-lg mb-1">
                      <button
                        onClick={() => {
                          setViewingPaperId(paper.id);
                          setCurrentView("paper-detail");
                        }}
                        className="text-[#1a0dab] hover:underline text-left"
                      >
                        {paper.title}
                      </button>
                    </h3>
                    <div className="text-sm text-[#006621] mb-2">{paper.authors}</div>
                    <div className="text-sm text-gray-700 mb-2">{paper.snippet.substring(0, 150)}...</div>
                    <div className="flex items-center space-x-3 text-xs">
                      <button onClick={() => handleCiteClick(paper)} className="text-[#1a0dab] hover:underline">Cite</button>
                      <button
                        onClick={() => {
                          setViewingPaperId(paper.id);
                          setCurrentView("paper-detail");
                        }}
                        className="text-[#1a0dab] hover:underline"
                      >
                        Cited by {paper.citedBy.toLocaleString()}
                      </button>
                      <button
                        onClick={() => {
                          setPaperLabels(prev => ({
                            ...prev,
                            [paperId]: labels.includes("to-read")
                              ? labels.filter(l => l !== "to-read")
                              : [...labels, "to-read"]
                          }));
                        }}
                        className={`hover:underline ${labels.includes("to-read") ? "text-blue-600" : "text-gray-500"}`}
                      >
                        {labels.includes("to-read") ? "✓ To read" : "Mark to read"}
                      </button>
                      <button
                        onClick={() => {
                          setPaperLabels(prev => ({
                            ...prev,
                            [paperId]: labels.includes("important")
                              ? labels.filter(l => l !== "important")
                              : [...labels, "important"]
                          }));
                        }}
                        className={`hover:underline ${labels.includes("important") ? "text-yellow-600" : "text-gray-500"}`}
                      >
                        {labels.includes("important") ? "★ Important" : "Mark important"}
                      </button>
                      <button onClick={() => handleSavePaper(paper.id)} className="text-red-600 hover:underline">Remove</button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
            </div>
          </div>
        </div>
      </div>
    );
  }

  // ---------------------------------------------------------------------------
  // LABS VIEW
  // ---------------------------------------------------------------------------
  if (currentView === "labs") {
    return (
      <div className="min-h-screen bg-white">
        <BackHeader />
        <div className="max-w-4xl mx-auto px-6 py-8">
          <div className="text-center mb-8">
            <Beaker className="w-16 h-16 mx-auto text-[#4285F4] mb-4" />
            <h2 className="text-3xl font-normal mb-2">Scholar Labs</h2>
            <p className="text-gray-600">Experimental features and tools for researchers</p>
          </div>

          <div className="space-y-6">
            {/* AI Search */}
            <div className="border border-gray-200 rounded-lg p-6 hover:shadow-md transition-shadow">
              <div className="flex items-start space-x-4">
                <div className="w-12 h-12 bg-blue-100 rounded-lg flex items-center justify-center">
                  <Search className="w-6 h-6 text-[#4285F4]" />
                </div>
                <div className="flex-1">
                  <div className="flex items-center space-x-2 mb-1">
                    <h3 className="text-lg font-medium">AI-Powered Search</h3>
                    <span className="px-2 py-0.5 bg-green-100 text-green-700 text-xs rounded">New</span>
                  </div>
                  <p className="text-gray-600 text-sm mb-3">
                    Use natural language to find relevant papers. Ask questions like "papers about transformer architectures for vision"
                  </p>
                  <button
                    onClick={() => setCurrentView("ai-search")}
                    className="text-[#1a73e8] text-sm hover:underline"
                  >
                    Try it now →
                  </button>
                </div>
              </div>
            </div>

            {/* Citation Graph */}
            <div className="border border-gray-200 rounded-lg p-6 hover:shadow-md transition-shadow">
              <div className="flex items-start space-x-4">
                <div className="w-12 h-12 bg-purple-100 rounded-lg flex items-center justify-center">
                  <BarChart3 className="w-6 h-6 text-purple-600" />
                </div>
                <div className="flex-1">
                  <h3 className="text-lg font-medium mb-1">Citation Graph Explorer</h3>
                  <p className="text-gray-600 text-sm mb-3">
                    Visualize the citation network of any paper. Discover influential works and research trends.
                  </p>
                  <button
                    onClick={() => setCurrentView("citation-graph")}
                    className="text-[#1a73e8] text-sm hover:underline"
                  >
                    Explore →
                  </button>
                </div>
              </div>
            </div>

            {/* Alerts */}
            <div className="border border-gray-200 rounded-lg p-6 hover:shadow-md transition-shadow">
              <div className="flex items-start space-x-4">
                <div className="w-12 h-12 bg-yellow-100 rounded-lg flex items-center justify-center">
                  <Bell className="w-6 h-6 text-yellow-600" />
                </div>
                <div className="flex-1">
                  <h3 className="text-lg font-medium mb-1">Smart Alerts</h3>
                  <p className="text-gray-600 text-sm mb-3">
                    Get notified when new papers match your research interests or when your papers get cited.
                  </p>
                  <button
                    onClick={() => setCurrentView("alerts")}
                    className="text-[#1a73e8] text-sm hover:underline"
                  >
                    Set up alerts →
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // ---------------------------------------------------------------------------
  // AI SEARCH VIEW
  // ---------------------------------------------------------------------------
  if (currentView === "ai-search") {
    const handleAiSearch = () => {
      if (!aiSearchQuery.trim()) return;
      setAiSearchLoading(true);
      // Use server-side search for AI queries
      hookSearchPapers(aiSearchQuery).then(results => {
        setAiSearchResults(results.slice(0, 10) as Paper[]);
        setAiSearchLoading(false);
      });
    };

    return (
      <div className="min-h-screen bg-white">
        <BackHeader />
        <div className="max-w-4xl mx-auto px-6 py-8">
          <div className="text-center mb-8">
            <div className="w-16 h-16 bg-blue-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <Search className="w-8 h-8 text-[#4285F4]" />
            </div>
            <h2 className="text-3xl font-normal mb-2">AI-Powered Search</h2>
            <p className="text-gray-600">Ask questions in natural language to find relevant papers</p>
          </div>

          {/* Search Input */}
          <div className="mb-8">
            <div className="flex space-x-3">
              <input
                type="text"
                value={aiSearchQuery}
                onChange={(e) => setAiSearchQuery(e.target.value)}
                onKeyPress={(e) => e.key === "Enter" && handleAiSearch()}
                placeholder="e.g., papers about transformer architectures for vision"
                className="flex-1 px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
              <button
                onClick={handleAiSearch}
                disabled={aiSearchLoading}
                className="px-6 py-3 bg-[#4285F4] text-white rounded-lg hover:bg-[#3367D6] disabled:bg-gray-400"
              >
                {aiSearchLoading ? "Searching..." : "Search"}
              </button>
            </div>
            <p className="text-sm text-gray-500 mt-2">
              Try: "recent papers on large language models" or "attention mechanisms in computer vision"
            </p>
          </div>

          {/* Results */}
          {aiSearchResults.length > 0 && (
            <div className="space-y-4">
              <h3 className="text-lg font-medium text-gray-800">
                Found {aiSearchResults.length} relevant papers
              </h3>
              {aiSearchResults.map(paper => (
                <div key={paper.id} className="border border-gray-200 rounded-lg p-4 hover:shadow-md transition-shadow">
                  <button
                    onClick={() => {
                      setViewingPaperId(paper.id);
                      setCurrentView("paper-detail");
                    }}
                    className="text-[#1a0dab] hover:underline text-left font-medium"
                  >
                    {paper.title}
                  </button>
                  <p className="text-sm text-[#006621] mt-1">{paper.authors}</p>
                  <p className="text-sm text-gray-600 mt-1">{paper.source}, {paper.year}</p>
                  <p className="text-sm text-gray-500 mt-2">{paper.snippet}</p>
                  <div className="flex space-x-4 mt-3 text-sm">
                    <button
                      onClick={() => handleCiteClick(paper)}
                      className="text-[#1a0dab] hover:underline"
                    >
                      Cite
                    </button>
                    <button
                      onClick={() => handleSavePaper(paper.id)}
                      className="text-[#1a0dab] hover:underline"
                    >
                      {savedPapers.includes(paper.id) ? "Saved" : "Save"}
                    </button>
                    <span className="text-gray-500">Cited by {paper.citedBy.toLocaleString()}</span>
                  </div>
                </div>
              ))}
            </div>
          )}

          {aiSearchQuery && !aiSearchLoading && aiSearchResults.length === 0 && (
            <div className="text-center py-12 text-gray-500">
              <Search className="w-12 h-12 mx-auto mb-4 text-gray-300" />
              <p>No papers found matching your query. Try different keywords.</p>
            </div>
          )}
        </div>
      </div>
    );
  }

  // ---------------------------------------------------------------------------
  // CITATION GRAPH VIEW
  // ---------------------------------------------------------------------------
  if (currentView === "citation-graph") {
    const selectedPaperForGraph = citationGraphPaperId
      ? papers.find(p => p.id === citationGraphPaperId)
      : null;

    // Get citing and cited papers for the graph
    const citingPapers = selectedPaperForGraph
      ? papers.filter(p => p.id !== selectedPaperForGraph.id && p.year >= selectedPaperForGraph.year).slice(0, 5)
      : [];
    const citedPapers = selectedPaperForGraph
      ? papers.filter(p => p.id !== selectedPaperForGraph.id && p.year <= selectedPaperForGraph.year).slice(0, 5)
      : [];

    return (
      <div className="min-h-screen bg-white">
        <BackHeader />
        <div className="max-w-5xl mx-auto px-6 py-8">
          <div className="text-center mb-8">
            <div className="w-16 h-16 bg-purple-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <BarChart3 className="w-8 h-8 text-purple-600" />
            </div>
            <h2 className="text-3xl font-normal mb-2">Citation Graph Explorer</h2>
            <p className="text-gray-600">Visualize the citation network of any paper</p>
          </div>

          {/* Paper Selection */}
          {!selectedPaperForGraph ? (
            <div>
              <h3 className="text-lg font-medium mb-4">Select a paper to explore its citation network:</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {papers.slice(0, 8).map(paper => (
                  <button
                    key={paper.id}
                    onClick={() => setCitationGraphPaperId(paper.id)}
                    className="text-left border border-gray-200 rounded-lg p-4 hover:border-purple-400 hover:shadow-md transition-all"
                  >
                    <p className="text-[#1a0dab] font-medium">{paper.title}</p>
                    <p className="text-sm text-gray-600 mt-1">{paper.authors}</p>
                    <p className="text-xs text-gray-500 mt-1">Cited by {paper.citedBy.toLocaleString()}</p>
                  </button>
                ))}
              </div>
            </div>
          ) : (
            <div>
              {/* Selected Paper */}
              <div className="mb-8 p-6 bg-purple-50 border border-purple-200 rounded-lg">
                <div className="flex justify-between items-start">
                  <div>
                    <h3 className="text-xl font-medium text-purple-900">{selectedPaperForGraph.title}</h3>
                    <p className="text-purple-700 mt-1">{selectedPaperForGraph.authors}</p>
                    <p className="text-sm text-purple-600 mt-1">{selectedPaperForGraph.source}, {selectedPaperForGraph.year}</p>
                  </div>
                  <button
                    onClick={() => setCitationGraphPaperId(null)}
                    className="text-purple-600 hover:underline text-sm"
                  >
                    Change paper
                  </button>
                </div>
              </div>

              {/* Citation Graph Visualization */}
              <div className="grid grid-cols-3 gap-6">
                {/* Cited Papers (References) */}
                <div>
                  <h4 className="text-lg font-medium mb-4 text-center">References ({citedPapers.length})</h4>
                  <div className="space-y-3">
                    {citedPapers.map(paper => (
                      <button
                        key={paper.id}
                        onClick={() => setCitationGraphPaperId(paper.id)}
                        className="w-full text-left p-3 border border-gray-200 rounded-lg hover:border-blue-400 hover:bg-blue-50 transition-all text-sm"
                      >
                        <p className="text-[#1a0dab] font-medium line-clamp-2">{paper.title}</p>
                        <p className="text-gray-500 text-xs mt-1">{paper.year}</p>
                      </button>
                    ))}
                  </div>
                </div>

                {/* Center: Current Paper */}
                <div className="flex flex-col items-center justify-center">
                  <div className="w-full p-4 bg-purple-100 border-2 border-purple-400 rounded-lg text-center">
                    <p className="font-medium text-purple-900">{selectedPaperForGraph.title}</p>
                    <p className="text-sm text-purple-700 mt-2">Cited by {selectedPaperForGraph.citedBy.toLocaleString()}</p>
                  </div>
                  <div className="flex items-center justify-center my-4">
                    <div className="w-px h-8 bg-gray-300"></div>
                  </div>
                  <button
                    onClick={() => {
                      setViewingPaperId(selectedPaperForGraph.id);
                      setCurrentView("paper-detail");
                    }}
                    className="text-[#1a0dab] hover:underline text-sm"
                  >
                    View paper details →
                  </button>
                </div>

                {/* Citing Papers */}
                <div>
                  <h4 className="text-lg font-medium mb-4 text-center">Cited by ({citingPapers.length})</h4>
                  <div className="space-y-3">
                    {citingPapers.map(paper => (
                      <button
                        key={paper.id}
                        onClick={() => setCitationGraphPaperId(paper.id)}
                        className="w-full text-left p-3 border border-gray-200 rounded-lg hover:border-green-400 hover:bg-green-50 transition-all text-sm"
                      >
                        <p className="text-[#1a0dab] font-medium line-clamp-2">{paper.title}</p>
                        <p className="text-gray-500 text-xs mt-1">{paper.year}</p>
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    );
  }

  // ---------------------------------------------------------------------------
  // ALERTS VIEW
  // ---------------------------------------------------------------------------
  if (currentView === "alerts") {
    const unreadCount = alerts.filter(a => !a.isRead).length;

    const markAsRead = (alertId: string) => {
      hookMarkAlertRead(alertId);
    };

    const markAllAsRead = () => {
      alerts.filter(a => !a.isRead).forEach(a => hookMarkAlertRead(a.id));
    };

    const getAlertIcon = (type: string) => {
      switch (type) {
        case 'citation':
          return <Quote className="w-5 h-5 text-blue-600" />;
        case 'new_paper':
          return <BookmarkPlus className="w-5 h-5 text-green-600" />;
        case 'keyword':
          return <Search className="w-5 h-5 text-purple-600" />;
        default:
          return <Bell className="w-5 h-5 text-gray-600" />;
      }
    };

    return (
      <div className="min-h-screen bg-white">
        <BackHeader />
        <div className="max-w-3xl mx-auto px-6 py-8">
          <div className="flex items-center justify-between mb-6">
            <div>
              <h2 className="text-2xl font-normal">Alerts</h2>
              <p className="text-sm text-gray-500 mt-1">
                {unreadCount > 0 ? `${unreadCount} unread alerts` : "All caught up!"}
              </p>
            </div>
            {unreadCount > 0 && (
              <button
                onClick={markAllAsRead}
                className="text-sm text-[#1a73e8] hover:underline"
              >
                Mark all as read
              </button>
            )}
          </div>

          <div className="space-y-3">
            {alerts.length === 0 ? (
              <div className="text-center py-12">
                <Bell className="w-12 h-12 text-gray-300 mx-auto mb-4" />
                <p className="text-gray-500">No alerts yet</p>
                <p className="text-sm text-gray-400 mt-1">
                  We'll notify you when something important happens
                </p>
              </div>
            ) : (
              (alerts || []).map(alert => (
                <div
                  key={alert.id}
                  className={`p-4 border rounded-lg transition-colors ${
                    alert.isRead
                      ? "bg-white border-gray-200"
                      : "bg-blue-50 border-blue-200"
                  }`}
                >
                  <div className="flex items-start space-x-3">
                    <div className={`w-10 h-10 rounded-full flex items-center justify-center ${
                      alert.isRead ? "bg-gray-100" : "bg-blue-100"
                    }`}>
                      {getAlertIcon(alert.type)}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-start justify-between">
                        <div>
                          <h3 className={`text-sm font-medium ${
                            alert.isRead ? "text-gray-700" : "text-gray-900"
                          }`}>
                            {alert.title}
                          </h3>
                          <p className="text-sm text-gray-600 mt-0.5">
                            {alert.description}
                          </p>
                        </div>
                        {!alert.isRead && (
                          <button
                            onClick={() => markAsRead(alert.id)}
                            className="text-xs text-[#1a73e8] hover:underline ml-4 flex-shrink-0"
                          >
                            Mark read
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>

          {/* Create New Alert */}
          <div className="mt-8 pt-6 border-t border-gray-200">
            <h3 className="text-lg font-medium mb-4">Create New Alert</h3>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Alert type</label>
                <select
                  value={newAlertType}
                  onChange={(e) => setNewAlertType(e.target.value as "citation" | "keyword" | "new_paper")}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2"
                >
                  <option value="citation">New citations to my papers</option>
                  <option value="new_paper">New papers from coauthors</option>
                  <option value="keyword">Papers matching keywords</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Keywords (optional)</label>
                <input
                  type="text"
                  value={newAlertKeywords}
                  onChange={(e) => setNewAlertKeywords(e.target.value)}
                  placeholder="e.g., machine learning, transformers"
                  className="w-full border border-gray-300 rounded-lg px-3 py-2"
                />
              </div>
              <button
                onClick={() => {
                  setNewAlertKeywords("");
                  showToast("Alert created successfully");
                }}
                className="px-4 py-2 bg-[#4285F4] text-white rounded-lg hover:bg-[#3367D6]"
              >
                Create Alert
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // ---------------------------------------------------------------------------
  // SETTINGS VIEW
  // ---------------------------------------------------------------------------
  if (currentView === "settings") {
    return (
      <div className="min-h-screen bg-white">
        <BackHeader />
        <div className="max-w-5xl mx-auto px-6 py-8">
          <h2 className="text-2xl font-normal mb-6">Settings</h2>

          <div className="flex gap-8">
            {/* Left Sidebar */}
            <div className="w-48 flex-shrink-0">
              <div className="space-y-1">
                <button
                  onClick={() => setSettingsSection("search")}
                  className={`w-full text-left px-3 py-2 rounded text-sm ${settingsSection === "search" ? "bg-blue-100 text-[#1a73e8]" : "text-gray-700 hover:bg-gray-100"}`}
                >
                  Search results
                </button>
                <button
                  onClick={() => setSettingsSection("languages")}
                  className={`w-full text-left px-3 py-2 rounded text-sm ${settingsSection === "languages" ? "bg-blue-100 text-[#1a73e8]" : "text-gray-700 hover:bg-gray-100"}`}
                >
                  Languages
                </button>
                <button
                  onClick={() => setSettingsSection("library")}
                  className={`w-full text-left px-3 py-2 rounded text-sm ${settingsSection === "library" ? "bg-blue-100 text-[#1a73e8]" : "text-gray-700 hover:bg-gray-100"}`}
                >
                  Library links
                </button>
                <button
                  onClick={() => setSettingsSection("account")}
                  className={`w-full text-left px-3 py-2 rounded text-sm ${settingsSection === "account" ? "bg-blue-100 text-[#1a73e8]" : "text-gray-700 hover:bg-gray-100"}`}
                >
                  Account
                </button>
              </div>
            </div>

            {/* Main Content */}
            <div className="flex-1">
          {settingsSection === "search" && (
            <div className="space-y-6">
              <h3 className="text-lg font-medium mb-4">Search results</h3>
              <div className="space-y-4">
                <label className="flex items-center justify-between">
                  <span className="text-gray-700">Results per page</span>
                  <select className="border border-gray-300 rounded px-3 py-1.5">
                    <option>10</option>
                    <option>20</option>
                    <option>50</option>
                  </select>
                </label>
                <label className="flex items-center">
                  <input type="checkbox" className="mr-3 w-4 h-4" defaultChecked />
                  <span className="text-gray-700">Include patents</span>
                </label>
                <label className="flex items-center">
                  <input type="checkbox" className="mr-3 w-4 h-4" defaultChecked />
                  <span className="text-gray-700">Include citations</span>
                </label>
              </div>
            </div>
          )}

          {settingsSection === "languages" && (
            <div className="space-y-6">
              <h3 className="text-lg font-medium mb-4">Languages</h3>
              <div className="space-y-4">
                <label className="flex items-center justify-between">
                  <span className="text-gray-700">Search language</span>
                  <select className="border border-gray-300 rounded px-3 py-1.5">
                    <option>English</option>
                    <option>Spanish</option>
                    <option>French</option>
                    <option>German</option>
                    <option>Chinese</option>
                  </select>
                </label>
                <p className="text-sm text-gray-500">Results will be filtered to show papers in the selected language.</p>
              </div>
            </div>
          )}

          {settingsSection === "library" && (
            <div className="space-y-6">
              <h3 className="text-lg font-medium mb-4">Library settings</h3>
              <div className="space-y-4">
                <label className="flex items-center">
                  <input type="checkbox" className="mr-3 w-4 h-4" defaultChecked />
                  <span className="text-gray-700">Show citation counts in library</span>
                </label>
                <label className="flex items-center">
                  <input type="checkbox" className="mr-3 w-4 h-4" defaultChecked />
                  <span className="text-gray-700">Auto-update citation counts</span>
                </label>
              </div>

              {/* Export & Import */}
              <div className="mt-8 pt-6 border-t border-gray-200">
                <h3 className="text-lg font-medium mb-4">Export & Import</h3>
                <div className="flex space-x-4">
                  <button
                    onClick={() => {
                      const libraryData = savedPapers.map(paperId => {
                        const paper = papers.find(p => p.id === paperId);
                        if (!paper) return null;
                        return {
                          title: paper.title,
                          authors: paper.authors,
                          year: paper.year,
                          source: paper.source,
                          citedBy: paper.citedBy
                        };
                      }).filter(Boolean);
                      const dataStr = JSON.stringify(libraryData, null, 2);
                      const blob = new Blob([dataStr], { type: "application/json" });
                      const url = URL.createObjectURL(blob);
                      const a = document.createElement("a");
                      a.href = url;
                      a.download = "microscholar-library.json";
                      a.click();
                      URL.revokeObjectURL(url);
                    }}
                    className="px-4 py-2 border border-gray-300 rounded hover:bg-gray-50"
                  >
                    Export library
                  </button>
                  <button
                    onClick={() => {
                      const input = document.createElement("input");
                      input.type = "file";
                      input.accept = ".bib,.json";
                      input.onchange = (e) => {
                        const file = (e.target as HTMLInputElement).files?.[0];
                        if (file) {
                          showToast(`Importing ${file.name}...`);
                        }
                      };
                      input.click();
                    }}
                    className="px-4 py-2 border border-gray-300 rounded hover:bg-gray-50"
                  >
                    Import from BibTeX
                  </button>
                </div>
              </div>
            </div>
          )}

          {settingsSection === "account" && (
            <div className="space-y-6">
              <h3 className="text-lg font-medium mb-4">Account</h3>
              <div className="space-y-4">
                <div className="flex items-center space-x-4">
                  {user?.avatarUrl ? (
                    <img src={user.avatarUrl} alt="" className="w-16 h-16 rounded-full" />
                  ) : (
                    <div className="w-16 h-16 rounded-full bg-gray-300 flex items-center justify-center text-gray-600 font-medium">
                      {user?.name?.charAt(0) || '?'}
                    </div>
                  )}
                  <div>
                    <p className="font-medium">{user?.name}</p>
                    <p className="text-sm text-gray-600">{user?.email}</p>
                  </div>
                </div>
                <button className="text-[#1a73e8] hover:underline text-sm">Manage Account</button>
              </div>
            </div>
          )}
            </div>
          </div>
        </div>
      </div>
    );
  }

  // ---------------------------------------------------------------------------
  // PRIVACY VIEW
  // ---------------------------------------------------------------------------
  if (currentView === "privacy") {
    return (
      <div className="min-h-screen bg-white">
        <BackHeader />
        <div className="max-w-3xl mx-auto px-6 py-8">
          <h2 className="text-2xl font-normal mb-6">Privacy Policy</h2>

          <div className="space-y-6 text-gray-700">
            <section>
              <h3 className="text-lg font-medium mb-2">Information We Collect</h3>
              <p className="text-sm leading-relaxed">
                MicroScholar collects information you provide directly, such as your name, email address,
                institutional affiliation, and research interests. We also collect information about your
                usage of our service, including search queries, saved papers, and citation exports.
              </p>
            </section>

            <section>
              <h3 className="text-lg font-medium mb-2">How We Use Your Information</h3>
              <p className="text-sm leading-relaxed">
                We use the information we collect to provide, maintain, and improve our services,
                including personalizing your experience with relevant paper recommendations and alerts.
                We may also use your information to communicate with you about updates and features.
              </p>
            </section>

            <section>
              <h3 className="text-lg font-medium mb-2">Information Sharing</h3>
              <p className="text-sm leading-relaxed">
                We do not sell your personal information. We may share aggregated, anonymized data
                for research purposes. Your public profile information may be visible to other scholars
                using MicroScholar.
              </p>
            </section>

            <section>
              <h3 className="text-lg font-medium mb-2">Data Security</h3>
              <p className="text-sm leading-relaxed">
                We implement appropriate technical and organizational measures to protect your personal
                information against unauthorized access, alteration, disclosure, or destruction.
              </p>
            </section>

            <section>
              <h3 className="text-lg font-medium mb-2">Your Rights</h3>
              <p className="text-sm leading-relaxed">
                You have the right to access, correct, or delete your personal information. You may
                also opt out of certain data collection practices. Contact us to exercise these rights.
              </p>
            </section>

            <p className="text-xs text-gray-500 mt-8">
              Last updated: December 2024
            </p>
          </div>
        </div>
      </div>
    );
  }

  // ---------------------------------------------------------------------------
  // TERMS VIEW
  // ---------------------------------------------------------------------------
  if (currentView === "terms") {
    return (
      <div className="min-h-screen bg-white">
        <BackHeader />
        <div className="max-w-3xl mx-auto px-6 py-8">
          <h2 className="text-2xl font-normal mb-6">Terms of Service</h2>

          <div className="space-y-6 text-gray-700">
            <section>
              <h3 className="text-lg font-medium mb-2">Acceptance of Terms</h3>
              <p className="text-sm leading-relaxed">
                By accessing and using MicroScholar, you agree to be bound by these Terms of Service
                and all applicable laws and regulations. If you do not agree with any of these terms,
                you are prohibited from using this service.
              </p>
            </section>

            <section>
              <h3 className="text-lg font-medium mb-2">Use License</h3>
              <p className="text-sm leading-relaxed">
                Permission is granted to temporarily access MicroScholar for personal, non-commercial
                research purposes. This license does not include the right to modify, copy, or distribute
                the service's content for commercial purposes.
              </p>
            </section>

            <section>
              <h3 className="text-lg font-medium mb-2">User Responsibilities</h3>
              <p className="text-sm leading-relaxed">
                Users are responsible for maintaining the confidentiality of their account credentials.
                You agree not to use the service for any unlawful purpose or to violate any applicable
                laws or regulations.
              </p>
            </section>

            <section>
              <h3 className="text-lg font-medium mb-2">Content and Citations</h3>
              <p className="text-sm leading-relaxed">
                MicroScholar provides citation information as a convenience. Users are responsible for
                verifying the accuracy of citations and ensuring compliance with applicable citation
                standards and copyright laws.
              </p>
            </section>

            <section>
              <h3 className="text-lg font-medium mb-2">Disclaimer</h3>
              <p className="text-sm leading-relaxed">
                MicroScholar is provided "as is" without warranties of any kind. We do not guarantee
                the accuracy, completeness, or timeliness of any information provided through the service.
              </p>
            </section>

            <section>
              <h3 className="text-lg font-medium mb-2">Modifications</h3>
              <p className="text-sm leading-relaxed">
                We reserve the right to modify these terms at any time. Continued use of the service
                after changes constitutes acceptance of the modified terms.
              </p>
            </section>

            <p className="text-xs text-gray-500 mt-8">
              Last updated: December 2024
            </p>
          </div>
        </div>
      </div>
    );
  }

  // ---------------------------------------------------------------------------
  // PAPER DETAIL VIEW (Cited By View)
  // ---------------------------------------------------------------------------
  if (currentView === "paper-detail" && viewingPaperId) {
    const paper = papers.find(p => p.id === viewingPaperId);

    if (!paper) {
      return (
        <div className="min-h-screen bg-white">
          <BackHeader />
          <div className="max-w-4xl mx-auto px-6 py-8 text-center">
            <p className="text-gray-500">Paper not found</p>
          </div>
        </div>
      );
    }

    // Get citing papers (papers published same year or later, simulating citations)
    const citingPapers = papers
      .filter(p => p.id !== paper.id && p.year >= paper.year)
      .sort((a, b) => b.citedBy - a.citedBy)
      .slice(0, 20);

    // Get versions (mock - show same paper from different sources)
    const allVersions = 3 + Math.floor(Math.random() * 5);

    return (
      <div className="min-h-screen bg-white">
        <BackHeader />
        <div className="max-w-4xl mx-auto px-6 py-4">
          {/* Header showing what we're viewing */}
          <div className="mb-4 pb-4 border-b border-gray-200">
            <div className="text-sm text-gray-600 mb-1">
              Papers that cite:
            </div>
            <div className="text-lg text-[#1a0dab]" dangerouslySetInnerHTML={{ __html: paper.titleHtml }} />
            <div className="text-sm text-[#006621] mt-1">
              {(paper.authorIds || []).map((authorId, idx) => {
                const author = getUserById(authorId);
                return (
                  <span key={authorId}>
                    {idx > 0 && ", "}
                    {author ? (
                      <button
                        onClick={() => {
                          setViewingScholarId(authorId);
                          setCurrentView("scholar-profile");
                        }}
                        className="hover:underline text-[#006621]"
                      >
                        {author.name.split(" ").map(n => n[0]).join("")} {author.name.split(" ").pop()}
                      </button>
                    ) : (
                      <span>{paper.authors.split(", ")[idx] || "Unknown"}</span>
                    )}
                  </span>
                );
              })}
              {" - "}{paper.source}, {paper.year}
            </div>
            <div className="flex items-center space-x-4 mt-3 text-xs">
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  handleCiteClick(paper);
                }}
                className="text-[#1a0dab] hover:underline flex items-center space-x-1"
              >
                <Quote className="w-3 h-3" />
                <span>Cite</span>
              </button>
              <span className="text-gray-500">Cited by {paper.citedBy.toLocaleString()}</span>
              <span className="text-gray-500">All {allVersions} versions</span>
            </div>
          </div>

          {/* Results count */}
          <div className="text-sm text-gray-600 mb-4">
            About {citingPapers.length.toLocaleString()} results
          </div>

          {/* Citing papers in search result format */}
          <div className="space-y-6">
            {citingPapers.map(result => (
              <div key={result.id} className="group">
                {/* Source/URL line */}
                <div className="text-xs text-[#006621] mb-1 flex items-center">
                  <span>{result.source?.toLowerCase().replace(/\s+/g, '') || 'scholar'}.com</span>
                  <span className="mx-1">›</span>
                  <span>article</span>
                </div>

                {/* Title - navigate to paper detail view */}
                <button
                  onClick={() => {
                    setViewingPaperId(result.id);
                    setCurrentView("paper-detail");
                  }}
                  className="text-lg text-[#1a0dab] hover:underline block text-left leading-snug"
                  dangerouslySetInnerHTML={{ __html: result.titleHtml }}
                />

                {/* Authors and year */}
                <div className="text-xs text-[#006621] mt-1">
                  {(result.authorIds || []).map((authorId, idx) => {
                    const author = getUserById(authorId);
                    if (!author) return null;
                    return (
                      <span key={authorId}>
                        {idx > 0 && ", "}
                        <button
                          onClick={() => {
                            setViewingScholarId(authorId);
                            setCurrentView("scholar-profile");
                          }}
                          className="hover:underline"
                        >
                          {author.name.split(" ").map(n => n[0]).join("")} {author.name.split(" ").pop()}
                        </button>
                      </span>
                    );
                  })}
                  {" - "}{result.source}, {result.year}
                </div>

                {/* Snippet */}
                <div className="text-sm text-gray-600 mt-1 leading-relaxed">
                  {result.snippet}
                </div>

                {/* Action links */}
                <div className="flex items-center space-x-4 mt-2 text-xs">
                  {/* Save */}
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      handleSavePaper(result.id);
                    }}
                    className="text-[#1a0dab] hover:underline flex items-center space-x-1"
                  >
                    {savedPapers.includes(result.id) ? (
                      <>
                        <Star className="w-3 h-3 fill-current" />
                        <span>Saved</span>
                      </>
                    ) : (
                      <>
                        <BookmarkPlus className="w-3 h-3" />
                        <span>Save</span>
                      </>
                    )}
                  </button>

                  {/* Cite */}
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      handleCiteClick(result);
                    }}
                    className="text-[#1a0dab] hover:underline flex items-center space-x-1"
                  >
                    <Quote className="w-3 h-3" />
                    <span>Cite</span>
                  </button>

                  {/* Cited by */}
                  <button
                    onClick={() => {
                      setViewingPaperId(result.id);
                    }}
                    className="text-[#1a0dab] hover:underline"
                  >
                    Cited by {result.citedBy.toLocaleString()}
                  </button>

                  {/* Related articles */}
                  <button
                    onClick={() => {
                      const authorNames = result.authors.split(",")[0].trim();
                      setSearchQuery(authorNames);
                      hookSearchPapers(authorNames).then(results => {
                        setSearchResults(results.length > 0 ? results as Paper[] : papers.slice(0, 10));
                        setCurrentPage(1);
                        setCurrentView("home");
                      });
                    }}
                    className="text-[#1a0dab] hover:underline"
                  >
                    Related articles
                  </button>
                </div>
              </div>
            ))}
          </div>

          {/* If no citing papers */}
          {citingPapers.length === 0 && (
            <div className="text-center py-8 text-gray-500">
              No citing papers found yet.
            </div>
          )}
        </div>
      </div>
    );
  }

  // ---------------------------------------------------------------------------
  // HELP VIEW
  // ---------------------------------------------------------------------------
  if (currentView === "help") {
    return (
      <div className="min-h-screen bg-white">
        <BackHeader />
        <div className="max-w-3xl mx-auto px-6 py-8">
          <h2 className="text-2xl font-normal mb-6">Help Center</h2>

          <div className="space-y-8">
            <section>
              <h3 className="text-lg font-medium mb-3 flex items-center">
                <HelpCircle className="w-5 h-5 mr-2 text-[#4285F4]" />
                Getting Started
              </h3>
              <div className="prose text-gray-600">
                <p>Microscholar helps you find scholarly articles, theses, books, and more. Use the search box to find academic papers on any topic.</p>
              </div>
            </section>

            <section>
              <h3 className="text-lg font-medium mb-3">Search Tips</h3>
              <ul className="space-y-2 text-gray-600">
                <li>• Use quotes for exact phrases: "machine learning"</li>
                <li>• Use author: to search by author: author:einstein</li>
                <li>• Use OR to find either term: cats OR dogs</li>
                <li>• Use - to exclude terms: jaguar -car</li>
              </ul>
            </section>

            <section>
              <h3 className="text-lg font-medium mb-3">Advanced Search</h3>
              <p className="text-gray-600 mb-3">
                Click the menu icon and select "Advanced search" to refine your queries with specific fields like author, publication, and date range.
              </p>
            </section>

            <section>
              <h3 className="text-lg font-medium mb-3">My Library</h3>
              <p className="text-gray-600">
                Save articles to your library for easy access later. Click the star icon on any search result to add it to your library.
              </p>
            </section>

            <section>
              <h3 className="text-lg font-medium mb-3">Citations</h3>
              <p className="text-gray-600">
                Click "Cite" under any article to get formatted citations in MLA, APA, Chicago, and other styles. You can also export to BibTeX.
              </p>
            </section>
          </div>
        </div>
      </div>
    );
  }

  // ---------------------------------------------------------------------------
  // ADVANCED SEARCH MODAL
  // ---------------------------------------------------------------------------
  const AdvancedSearchModal = () => (
    <div
      className="fixed inset-0 bg-black/50 flex items-center justify-center z-50"
      onClick={() => setShowAdvancedSearch(false)}
    >
      <div
        className="bg-white rounded-lg shadow-xl w-full max-w-2xl mx-4 max-h-[90vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between p-4 border-b">
          <h2 className="text-lg font-medium">Advanced Search</h2>
          <button
            onClick={() => setShowAdvancedSearch(false)}
            className="text-gray-500 hover:text-gray-700"
          >
            <X className="w-5 h-5" />
          </button>
        </div>
        <div className="p-6 space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">with all of the words</label>
            <input
              type="text"
              value={advAllWords}
              onChange={(e) => setAdvAllWords(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">with the exact phrase</label>
            <input
              type="text"
              value={advExactPhrase}
              onChange={(e) => setAdvExactPhrase(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">with at least one of the words</label>
            <input
              type="text"
              value={advAtLeastOne}
              onChange={(e) => setAdvAtLeastOne(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">without the words</label>
            <input
              type="text"
              value={advWithout}
              onChange={(e) => setAdvWithout(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Author</label>
              <input
                type="text"
                placeholder="e.g., Einstein"
                value={advAuthor}
                onChange={(e) => setAdvAuthor(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Publication</label>
              <input
                type="text"
                placeholder="e.g., Nature"
                value={advPublication}
                onChange={(e) => setAdvPublication(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Date range start</label>
              <input
                type="text"
                placeholder="e.g., 2020"
                value={advDateStart}
                onChange={(e) => setAdvDateStart(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Date range end</label>
              <input
                type="text"
                placeholder="e.g., 2024"
                value={advDateEnd}
                onChange={(e) => setAdvDateEnd(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
          </div>
          <div className="pt-4 flex justify-end space-x-3">
            <button
              onClick={() => setShowAdvancedSearch(false)}
              className="px-4 py-2 text-gray-700 hover:bg-gray-100 rounded"
            >
              Cancel
            </button>
            <button
              onClick={handleAdvancedSearch}
              className="px-4 py-2 bg-[#4285F4] text-white rounded hover:bg-[#3367D6]"
            >
              Search
            </button>
          </div>
        </div>
      </div>
    </div>
  );

  // ---------------------------------------------------------------------------
  // Render (Home View)
  // ---------------------------------------------------------------------------
  return (
    <div className="min-h-screen bg-white flex flex-col">
      {/* Dev Tools */}
      {showDevTools && (
        <div className="bg-gradient-to-r from-yellow-50 to-amber-50 border border-yellow-200/50 rounded-xl p-4 mx-4 mt-4 shadow-sm">
          <div className="flex items-center justify-between text-sm">
            <div className="text-yellow-800 font-medium">
              <strong>Dev:</strong> Elapsed: {elapsedTime}s | Results: {searchResults.length} |
              Target: {targetPaperShown ? "✅" : "❌"} | Clicked: {targetPaperClicked ? "✅" : "❌"}
            </div>
            <button
              onClick={handleResetTask}
              className="px-3 py-1.5 bg-gradient-to-r from-red-500 to-red-600 text-white text-xs rounded-lg hover:from-red-600 hover:to-red-700"
            >
              Reset
            </button>
          </div>
        </div>
      )}

      {/* ===================================================================== */}
      {/* HEADER                                                               */}
      {/* ===================================================================== */}
      <header className="border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-4 py-2.5 flex items-center justify-between">
          {/* Left nav items */}
          <div className="flex items-center space-x-4">
            {/* Hamburger menu */}
            <div className="relative">
              <button
                ref={menuButtonRef}
                onClick={() => setShowMenu(!showMenu)}
                className="p-2 hover:bg-gray-100 rounded-full"
                aria-label="Menu"
              >
                <Menu className="w-5 h-5 text-gray-600" />
              </button>

              {/* Dropdown menu - positioned under the burger */}
              {showMenu && (
                <div className="absolute left-0 top-full mt-1 bg-white border border-gray-200 rounded-lg shadow-lg py-2 z-50 w-56">
                  <button
                    onClick={() => {
                      setCurrentView("settings");
                      setShowMenu(false);
                    }}
                    className="block w-full text-left px-4 py-2 hover:bg-gray-100 text-sm text-gray-700"
                  >
                    <Settings className="w-4 h-4 inline mr-2" />
                    Settings
                  </button>
                  <button
                    onClick={() => {
                      setShowAdvancedSearch(true);
                      setShowMenu(false);
                    }}
                    className="block w-full text-left px-4 py-2 hover:bg-gray-100 text-sm text-gray-700"
                  >
                    <Search className="w-4 h-4 inline mr-2" />
                    Advanced search
                  </button>
                  <hr className="my-2" />
                  <button
                    onClick={() => {
                      setCurrentView("help");
                      setShowMenu(false);
                    }}
                    className="block w-full text-left px-4 py-2 hover:bg-gray-100 text-sm text-gray-700"
                  >
                    <HelpCircle className="w-4 h-4 inline mr-2" />
                    Help
                  </button>
                </div>
              )}
            </div>

            {/* My profile */}
            <button
              onClick={() => setCurrentView("profile")}
              className="flex items-center space-x-2 text-gray-600 hover:bg-gray-100 px-4 py-2 rounded text-sm"
            >
              <GraduationCap className="w-5 h-5" />
              <span>My profile</span>
            </button>

            {/* My library */}
            <button
              onClick={() => setCurrentView("library")}
              className="flex items-center space-x-2 text-gray-600 hover:bg-gray-100 px-4 py-2 rounded text-sm"
            >
              <Star className="w-5 h-5" />
              <span>My library</span>
            </button>

            {/* Labs - NEW! */}
            <button
              onClick={() => setCurrentView("labs")}
              className="flex items-center space-x-2 text-gray-600 hover:bg-gray-100 px-4 py-2 rounded text-sm"
            >
              <FlaskConical className="w-5 h-5" />
              <span>Labs</span>
            </button>
          </div>

          {/* User profile dropdown - right side */}
          <div className="relative">
            <button
              ref={profileButtonRef}
              onClick={() => setShowProfileDropdown(!showProfileDropdown)}
              className="w-8 h-8 rounded-full flex items-center justify-center hover:ring-2 hover:ring-blue-200 transition-all cursor-pointer overflow-hidden"
              title={user?.name ?? ""}
            >
              {user?.avatarUrl ? (
                <img src={user.avatarUrl} alt={user.name} className="w-full h-full object-cover" />
              ) : (
                <span className="w-full h-full bg-blue-500 flex items-center justify-center text-white text-sm font-medium">{getInitials(user?.name ?? "")}</span>
              )}
            </button>

            {/* Profile dropdown */}
            {showProfileDropdown && (
              <div className="absolute right-0 top-full mt-1 bg-white border border-gray-200 rounded-lg shadow-lg py-2 z-50 w-56">
                <div className="px-4 py-2 border-b border-gray-100">
                  <p className="font-medium text-sm text-gray-900">{user?.name}</p>
                  <p className="text-xs text-gray-500">{user?.email ?? ""}</p>
                </div>
                <button
                  onClick={() => {
                    setCurrentView("profile");
                    setShowProfileDropdown(false);
                  }}
                  className="block w-full text-left px-4 py-2 hover:bg-gray-100 text-sm text-gray-700"
                >
                  <GraduationCap className="w-4 h-4 inline mr-2" />
                  My profile
                </button>
                <button
                  onClick={() => {
                    setCurrentView("settings");
                    setShowProfileDropdown(false);
                  }}
                  className="block w-full text-left px-4 py-2 hover:bg-gray-100 text-sm text-gray-700"
                >
                  <Settings className="w-4 h-4 inline mr-2" />
                  Settings
                </button>
                <hr className="my-2" />
                <button
                  onClick={() => {
                    setIsSignedOut(true);
                    setShowProfileDropdown(false);
                  }}
                  disabled={isSignedOut}
                  className="block w-full text-left px-4 py-2 hover:bg-gray-100 text-sm text-gray-700 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {isSignedOut ? "Signed Out" : "Sign out"}
                </button>
              </div>
            )}
          </div>
        </div>
      </header>

      {/* ===================================================================== */}
      {/* MAIN CONTENT                                                         */}
      {/* ===================================================================== */}
      <main className="flex-1">
        <div className="max-w-3xl mx-auto px-4 py-8">
          {/* ================================================================= */}
          {/* LOGO - "Micro" colored + "Scholar" gray                          */}
          {/* ================================================================= */}
          <div className="text-center mb-6">
            <h1 className="text-5xl font-normal tracking-tight">
              <span className="text-[#4285F4]">M</span>
              <span className="text-[#EA4335]">i</span>
              <span className="text-[#FBBC04]">c</span>
              <span className="text-[#4285F4]">r</span>
              <span className="text-[#34A853]">o</span>
              <span className="text-gray-500 font-light ml-2">Scholar</span>
            </h1>
          </div>

          {/* ================================================================= */}
          {/* SEARCH BOX - Sharp corners, no shadow                            */}
          {/* ================================================================= */}
          <form onSubmit={handleSearch} className="mb-4">
            <div className="flex">
              <input
                ref={searchInputRef}
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="flex-1 px-4 py-3 text-base border border-gray-300 border-r-0 focus:outline-none focus:border-blue-500"
                placeholder=""
                aria-label="Search"
              />
              <button
                type="submit"
                className="px-6 bg-[#4285F4] text-white hover:bg-[#3367D6] flex items-center justify-center border border-[#4285F4]"
                aria-label="Search"
              >
                <Search className="w-5 h-5" strokeWidth={2.5} />
              </button>
            </div>
          </form>

          {/* ================================================================= */}
          {/* RADIO BUTTONS - Articles only (Case law removed - no data)       */}
          {/* ================================================================= */}
          <div className="flex items-center justify-center space-x-6 text-sm mb-6">
            <label className="flex items-center space-x-2 cursor-pointer">
              <input
                type="radio"
                name="search-type"
                checked={searchType === "articles"}
                onChange={() => setSearchType("articles")}
                className="w-4 h-4 text-blue-600"
              />
              <span className="text-gray-700">Articles</span>
            </label>
          </div>

          {/* ================================================================= */}
          {/* NEW LABS BANNER                                                  */}
          {/* ================================================================= */}
          {!searchResults.length && (
            <div className="text-center mb-4">
              <span className="text-[#EA4335] font-medium">New!</span>{" "}
              <button
                onClick={() => setCurrentView("labs")}
                className="text-[#1a73e8] hover:underline"
              >
                Scholar Labs: An AI Powered Scholar Search
              </button>
            </div>
          )}

          {/* ================================================================= */}
          {/* NEW WAY TO SEARCH PROMO                                          */}
          {/* ================================================================= */}
          {!searchResults.length && (
            <div className="text-center my-8">
              <div className="inline-block bg-gradient-to-r from-blue-500 to-indigo-600 rounded-lg p-8 text-white text-center shadow-lg">
                <p className="font-semibold mb-3">A new way to search</p>
                <button
                  onClick={() => setCurrentView("labs")}
                  className="bg-white text-blue-600 font-semibold rounded-full px-6 py-2 flex items-center space-x-2 shadow-md hover:bg-gray-100 transition-all"
                >
                  <Beaker className="w-5 h-5" />
                  <span>Try Scholar Labs</span>
                </button>
              </div>
            </div>
          )}

          {/* ================================================================= */}
          {/* RECOMMENDED ARTICLES                                             */}
          {/* ================================================================= */}
          {!searchResults.length && (
            <div className="mt-8">
              <div className="flex justify-between items-center mb-3">
                <h2 className="font-medium text-gray-800">Recommended articles</h2>
                <div className="flex items-center space-x-2">
                  <button
                    onClick={() => setRecommendedView(recommendedView === "list" ? "grid" : "list")}
                    className={`p-2 hover:bg-gray-100 rounded-full ${recommendedView === "grid" ? "text-blue-600 bg-blue-50" : "text-gray-500"}`}
                    title="Toggle grid view"
                  >
                    <Grid3X3 className="w-4 h-4" />
                  </button>
                  <button
                    onClick={() => setCurrentView("settings")}
                    className="p-2 hover:bg-gray-100 rounded-full text-gray-500"
                    title="Customize recommendations"
                  >
                    <MoreVertical className="w-4 h-4" />
                  </button>
                </div>
              </div>
              <div className={recommendedView === "grid" ? "grid grid-cols-2 gap-4" : "border border-gray-200 rounded-md"}>
                {getRegularPapers().slice(0, recommendedView === "grid" ? 4 : 2).map((paper, index) => (
                  <div key={paper.id} className={recommendedView === "grid" ? "border border-gray-200 rounded-lg p-4" : `p-4 ${index === 0 ? 'border-b border-gray-200' : ''}`}>
                    <div className="flex items-start">
                      <button
                        onClick={() => handleSavePaper(paper.id)}
                        className="mr-3 mt-1 flex-shrink-0"
                        title={savedPapers.includes(paper.id) ? "Remove from library" : "Save to library"}
                      >
                        <Star className={`w-5 h-5 ${savedPapers.includes(paper.id) ? "text-yellow-500 fill-yellow-500" : "text-gray-400"}`} />
                      </button>
                      <div className="flex-1">
                        <button
                          onClick={() => {
                            setViewingPaperId(paper.id);
                            setCurrentView("paper-detail");
                          }}
                          className="text-blue-800 hover:underline text-base text-left"
                        >
                          {paper.title}
                        </button>
                        <p className="text-sm text-gray-600">{paper.authors}</p>
                        <p className="text-sm text-gray-600">{paper.source} - {4 + index*2} days ago</p>
                      </div>
                      <div className="ml-4 flex-shrink-0">
                        <button
                          onClick={() => {
                            setViewingPaperId(paper.id);
                            setCurrentView("paper-detail");
                          }}
                          className="text-sm text-green-700 font-medium hover:underline"
                          title="View paper"
                        >
                          PDF
                        </button>
                      </div>
                    </div>
                    <button
                      onClick={() => {
                        setSearchQuery(paper.source);
                        hookSearchPapers(paper.source).then(results => {
                          setSearchResults(results as Paper[]);
                        });
                      }}
                      className="text-blue-700 text-sm ml-8 mt-2 inline-block hover:underline"
                    >
                      More articles from {4 + index*2} days ago
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}


          {/* ================================================================= */}
          {/* SEARCH RESULTS                                                   */}
          {/* ================================================================= */}
          {searchResults.length > 0 && (() => {
            // Apply filters
            let filteredResults = [...searchResults];

            // Filter by year
            if (yearFilter !== "any") {
              const currentYear = new Date().getFullYear();
              let minYear = 0;
              if (yearFilter === "2024") minYear = 2024;
              else if (yearFilter === "2023") minYear = 2023;
              else if (yearFilter === "2020") minYear = 2020;
              else if (yearFilter === "custom" && customYearStart) {
                minYear = parseInt(customYearStart) || 0;
                const maxYear = customYearEnd ? parseInt(customYearEnd) : currentYear;
                filteredResults = filteredResults.filter(p => p.year >= minYear && p.year <= maxYear);
              }
              if (yearFilter !== "custom") {
                filteredResults = filteredResults.filter(p => p.year >= minYear);
              }
            }

            // Filter books
            if (!includeBooks) {
              filteredResults = filteredResults.filter(p => !p.isBook);
            }

            // Apply sorting
            if (sortBy === "date") {
              filteredResults.sort((a, b) => b.year - a.year);
            } else if (sortBy === "citations") {
              filteredResults.sort((a, b) => b.citedBy - a.citedBy);
            }

            const totalPages = Math.ceil(filteredResults.length / RESULTS_PER_PAGE);
            const startIdx = (currentPage - 1) * RESULTS_PER_PAGE;
            const paginatedResults = filteredResults.slice(startIdx, startIdx + RESULTS_PER_PAGE);

            return (
            <div className="mt-8 flex gap-8">
              {/* Filter Sidebar */}
              <div className="w-48 flex-shrink-0">
                <div className="sticky top-4 space-y-6">
                  {/* Date filter */}
                  <div>
                    <h3 className="text-sm font-medium text-gray-700 mb-2">Any time</h3>
                    <div className="space-y-1 text-sm">
                      <label className="flex items-center">
                        <input
                          type="radio"
                          name="yearFilter"
                          checked={yearFilter === "any"}
                          onChange={() => { setYearFilter("any"); setCurrentPage(1); }}
                          className="mr-2"
                        />
                        <span className={yearFilter === "any" ? "text-gray-900" : "text-[#1a0dab]"}>Any time</span>
                      </label>
                      <label className="flex items-center">
                        <input
                          type="radio"
                          name="yearFilter"
                          checked={yearFilter === "2024"}
                          onChange={() => { setYearFilter("2024"); setCurrentPage(1); }}
                          className="mr-2"
                        />
                        <span className={yearFilter === "2024" ? "text-gray-900" : "text-[#1a0dab]"}>Since 2024</span>
                      </label>
                      <label className="flex items-center">
                        <input
                          type="radio"
                          name="yearFilter"
                          checked={yearFilter === "2023"}
                          onChange={() => { setYearFilter("2023"); setCurrentPage(1); }}
                          className="mr-2"
                        />
                        <span className={yearFilter === "2023" ? "text-gray-900" : "text-[#1a0dab]"}>Since 2023</span>
                      </label>
                      <label className="flex items-center">
                        <input
                          type="radio"
                          name="yearFilter"
                          checked={yearFilter === "2020"}
                          onChange={() => { setYearFilter("2020"); setCurrentPage(1); }}
                          className="mr-2"
                        />
                        <span className={yearFilter === "2020" ? "text-gray-900" : "text-[#1a0dab]"}>Since 2020</span>
                      </label>
                    </div>
                  </div>

                  {/* Sort by */}
                  <div>
                    <h3 className="text-sm font-medium text-gray-700 mb-2">Sort by</h3>
                    <div className="space-y-1 text-sm">
                      <label className="flex items-center">
                        <input
                          type="radio"
                          name="sortBy"
                          checked={sortBy === "relevance"}
                          onChange={() => { setSortBy("relevance"); setCurrentPage(1); }}
                          className="mr-2"
                        />
                        <span className={sortBy === "relevance" ? "text-gray-900" : "text-[#1a0dab]"}>Relevance</span>
                      </label>
                      <label className="flex items-center">
                        <input
                          type="radio"
                          name="sortBy"
                          checked={sortBy === "date"}
                          onChange={() => { setSortBy("date"); setCurrentPage(1); }}
                          className="mr-2"
                        />
                        <span className={sortBy === "date" ? "text-gray-900" : "text-[#1a0dab]"}>Date</span>
                      </label>
                      <label className="flex items-center">
                        <input
                          type="radio"
                          name="sortBy"
                          checked={sortBy === "citations"}
                          onChange={() => { setSortBy("citations"); setCurrentPage(1); }}
                          className="mr-2"
                        />
                        <span className={sortBy === "citations" ? "text-gray-900" : "text-[#1a0dab]"}>Citations</span>
                      </label>
                    </div>
                  </div>

                  {/* Include options */}
                  <div>
                    <h3 className="text-sm font-medium text-gray-700 mb-2">Include</h3>
                    <div className="space-y-1 text-sm">
                      <label className="flex items-center">
                        <input
                          type="checkbox"
                          checked={includeBooks}
                          onChange={() => { setIncludeBooks(!includeBooks); setCurrentPage(1); }}
                          className="mr-2"
                        />
                        <span className="text-gray-700">Books</span>
                      </label>
                    </div>
                  </div>

                  {/* Create alert */}
                  <button
                    onClick={() => setCurrentView("alerts")}
                    className="text-sm text-[#1a0dab] hover:underline"
                  >
                    Create alert
                  </button>
                </div>
              </div>

              {/* Results */}
              <div className="flex-1">
              {/* Results header */}
              <div className="text-sm text-gray-600 mb-6">
                About {filteredResults.length.toLocaleString()} results (0.08 sec)
              </div>

              {/* Results list - flat, no cards */}
              <div className="space-y-8">
                {paginatedResults.map((result) => (
                  <div
                    key={result.id}
                    className={result.isTargetPaper ? "bg-yellow-50 -mx-4 px-4 py-3 border-l-4 border-yellow-400" : ""}
                  >
                    {/* Title row with optional PDF link */}
                    <div className="flex items-start justify-between gap-4">
                      <div className="flex-1">
                        {/* Book tag if applicable */}
                        {result.isBook && (
                          <span className="text-xs text-gray-500 mr-1">[BOOK]</span>
                        )}
                        {/* Title - navigate to paper detail view */}
                        <button
                          onClick={() => {
                            setViewingPaperId(result.id);
                            setCurrentView("paper-detail");
                          }}
                          className="text-lg text-[#1a0dab] hover:underline text-left"
                          dangerouslySetInnerHTML={{ __html: result.titleHtml }}
                        />
                      </div>

                      {/* PDF link on right */}
                      {result.pdfLink && (
                        <button
                          onClick={() => {
                            setViewingPaperId(result.id);
                            setCurrentView("paper-detail");
                          }}
                          className="flex-shrink-0 text-xs border border-gray-200 rounded px-2 py-1 hover:bg-gray-50"
                        >
                          <span className="text-[#1a0dab]">[PDF]</span>
                          <span className="text-gray-500 ml-1">{result.pdfSource}</span>
                        </button>
                      )}
                    </div>

                    {/* Authors line - clickable */}
                    <div className="text-sm text-[#006621] mt-0.5">
                      {(result.authorIds || []).map((authorId, idx) => {
                        const author = getUserById(authorId);
                        return (
                          <span key={authorId}>
                            {idx > 0 && ", "}
                            {author ? (
                              <button
                                onClick={() => {
                                  setViewingScholarId(authorId);
                                  setCurrentView("scholar-profile");
                                }}
                                className="hover:underline text-[#006621]"
                              >
                                {author.name}
                              </button>
                            ) : (
                              <span>{result.authors.split(", ")[idx] || "Unknown"}</span>
                            )}
                          </span>
                        );
                      })}
                      {" - "}{result.source}, {result.year}
                    </div>

                    {/* Snippet */}
                    <div className="text-sm text-gray-600 mt-1 leading-relaxed">
                      {result.snippet}
                    </div>

                    {/* Action links */}
                    <div className="flex items-center space-x-4 mt-2 text-xs">
                      {/* Save */}
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleSavePaper(result.id);
                        }}
                        className="text-[#1a0dab] hover:underline flex items-center space-x-1"
                      >
                        {savedPapers.includes(result.id) ? (
                          <>
                            <Star className="w-3 h-3 fill-current" />
                            <span>Saved</span>
                          </>
                        ) : (
                          <>
                            <BookmarkPlus className="w-3 h-3" />
                            <span>Save</span>
                          </>
                        )}
                      </button>

                      {/* Cite */}
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleCiteClick(result);
                        }}
                        className="text-[#1a0dab] hover:underline flex items-center space-x-1"
                      >
                        <Quote className="w-3 h-3" />
                        <span>Cite</span>
                      </button>

                      {/* Cited by */}
                      <button
                        onClick={() => {
                          setViewingPaperId(result.id);
                          setCurrentView("paper-detail");
                        }}
                        className="text-[#1a0dab] hover:underline"
                      >
                        Cited by {result.citedBy.toLocaleString()}
                      </button>

                      {/* Related articles */}
                      <button
                        onClick={() => {
                          // Search for related papers by the same authors via server
                          const authorNames = result.authors.split(",")[0].trim();
                          setSearchQuery(authorNames);
                          hookSearchPapers(authorNames).then(results => {
                            setSearchResults(results.length > 0 ? results as Paper[] : papers.slice(0, 10));
                            setCurrentPage(1);
                          });
                        }}
                        className="text-[#1a0dab] hover:underline"
                      >
                        Related articles
                      </button>

                      {/* All versions */}
                      <button
                        onClick={() => {
                          setViewingPaperId(result.id);
                          setCurrentView("paper-detail");
                        }}
                        className="text-[#1a0dab] hover:underline"
                      >
                        All {Math.floor(result.citedBy / 100) + 2} versions
                      </button>
                    </div>
                  </div>
                ))}
              </div>

              {/* Pagination Controls */}
              {totalPages > 1 && (
                <div className="flex items-center justify-center mt-10 mb-8">
                  <nav className="flex items-center space-x-1">
                    {/* Previous button */}
                    <button
                      onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                      disabled={currentPage === 1}
                      className="px-3 py-2 text-sm text-[#1a0dab] hover:underline disabled:text-gray-400 disabled:no-underline"
                    >
                      Previous
                    </button>

                    {/* Page numbers */}
                    {Array.from({ length: Math.min(10, totalPages) }, (_, i) => {
                      let pageNum: number;
                      if (totalPages <= 10) {
                        pageNum = i + 1;
                      } else if (currentPage <= 5) {
                        pageNum = i + 1;
                      } else if (currentPage >= totalPages - 4) {
                        pageNum = totalPages - 9 + i;
                      } else {
                        pageNum = currentPage - 4 + i;
                      }
                      return (
                        <button
                          key={pageNum}
                          onClick={() => setCurrentPage(pageNum)}
                          className={`w-10 h-10 flex items-center justify-center text-sm rounded-full ${
                            currentPage === pageNum
                              ? "bg-[#4285F4] text-white"
                              : "text-[#1a0dab] hover:bg-gray-100"
                          }`}
                        >
                          {pageNum}
                        </button>
                      );
                    })}

                    {/* Next button */}
                    <button
                      onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                      disabled={currentPage === totalPages}
                      className="px-3 py-2 text-sm text-[#1a0dab] hover:underline disabled:text-gray-400 disabled:no-underline"
                    >
                      Next
                    </button>
                  </nav>
                </div>
              )}
              </div>
            </div>
            );
          })()}
        </div>
      </main>



      {/* ===================================================================== */}
      {/* CITE MODAL                                                           */}
      {/* ===================================================================== */}
      {showCiteModal && selectedPaper && (
        <div
          className="fixed inset-0 bg-black/50 flex items-center justify-center z-50"
          onClick={() => setShowCiteModal(false)}
        >
          <div
            className="bg-white rounded-lg shadow-xl w-full max-w-lg mx-4"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between p-4 border-b">
              <h2 className="text-lg font-medium">Cite</h2>
              <button
                onClick={() => setShowCiteModal(false)}
                className="text-gray-500 hover:text-gray-700 text-2xl leading-none"
              >
                ×
              </button>
            </div>
            <div className="p-4 space-y-4">
              {getCitationFormats(selectedPaper).map((format) => (
                <div key={format.name}>
                  <div className="font-medium text-sm text-gray-700 mb-1">{format.name}</div>
                  <div className="text-sm text-gray-600 bg-gray-50 p-3 rounded border select-all">
                    {format.citation}
                  </div>
                </div>
              ))}

              {/* Export options */}
              <div className="pt-4 border-t">
                <div className="text-sm text-gray-500 mb-2">Export to:</div>
                <div className="flex space-x-3 text-sm">
                  <button
                    onClick={() => {
                      const bibtex = `@article{${selectedPaper.id},
  title={${selectedPaper.title}},
  author={${selectedPaper.authors}},
  year={${selectedPaper.year}},
  journal={${selectedPaper.source}}
}`;
                      navigator.clipboard.writeText(bibtex);
                      showToast("BibTeX copied to clipboard");
                    }}
                    className="text-[#1a0dab] hover:underline"
                  >
                    BibTeX
                  </button>
                  <button
                    onClick={() => {
                      const endnote = `%0 Journal Article
%T ${selectedPaper.title}
%A ${selectedPaper.authors}
%D ${selectedPaper.year}
%J ${selectedPaper.source}`;
                      navigator.clipboard.writeText(endnote);
                      showToast("EndNote format copied to clipboard");
                    }}
                    className="text-[#1a0dab] hover:underline"
                  >
                    EndNote
                  </button>
                  <button
                    onClick={() => {
                      const refman = `TY  - JOUR
TI  - ${selectedPaper.title}
AU  - ${selectedPaper.authors}
PY  - ${selectedPaper.year}
JO  - ${selectedPaper.source}
ER  -`;
                      navigator.clipboard.writeText(refman);
                      showToast("RefMan format copied to clipboard");
                    }}
                    className="text-[#1a0dab] hover:underline"
                  >
                    RefMan
                  </button>
                  <button
                    onClick={() => {
                      const refworks = `RT Journal
T1 ${selectedPaper.title}
A1 ${selectedPaper.authors}
YR ${selectedPaper.year}
JF ${selectedPaper.source}`;
                      navigator.clipboard.writeText(refworks);
                      showToast("RefWorks format copied to clipboard");
                    }}
                    className="text-[#1a0dab] hover:underline"
                  >
                    RefWorks
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ===================================================================== */}
      {/* EDIT COAUTHORS MODAL                                                 */}
      {/* ===================================================================== */}
      {showEditCoauthorsModal && (
        <div
          className="fixed inset-0 bg-black/50 flex items-center justify-center z-50"
          onClick={() => setShowEditCoauthorsModal(false)}
        >
          <div
            className="bg-white rounded-lg shadow-xl w-full max-w-md mx-4 max-h-[80vh] flex flex-col"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between p-4 border-b">
              <h2 className="text-lg font-medium">Edit Co-authors</h2>
              <button
                onClick={() => setShowEditCoauthorsModal(false)}
                className="text-gray-500 hover:text-gray-700"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="p-4 flex-1 overflow-y-auto">
              {/* Current coauthors */}
              <div className="mb-6">
                <h3 className="text-sm font-medium text-gray-700 mb-3">Current Co-authors</h3>
                {getUserCoauthors().length === 0 ? (
                  <p className="text-sm text-gray-500 italic">No co-authors added yet.</p>
                ) : (
                  <div className="space-y-2">
                    {getUserCoauthors().map(coauthor => (
                      <div key={coauthor.id} className="flex items-center justify-between p-2 bg-gray-50 rounded-lg">
                        <div className="flex items-center space-x-3">
                          {coauthor.avatarUrl ? (
                            <img src={coauthor.avatarUrl} alt={coauthor.name} className="w-8 h-8 rounded-full object-cover" />
                          ) : (
                            <div className="w-8 h-8 bg-gray-300 rounded-full flex items-center justify-center">
                              <span className="text-white text-xs font-medium">{getInitials(coauthor.name)}</span>
                            </div>
                          )}
                          <div>
                            <p className="text-sm font-medium text-gray-900">{coauthor.name}</p>
                            <p className="text-xs text-gray-500">{coauthor.affiliation}</p>
                          </div>
                        </div>
                        <button
                          onClick={() => {
                            setUserCoauthorIds(prev => prev.filter(id => id !== coauthor.id));
                          }}
                          className="p-1 text-red-500 hover:bg-red-50 rounded"
                          title="Remove co-author"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Available scholars to add */}
              <div>
                <h3 className="text-sm font-medium text-gray-700 mb-3">Add Co-authors</h3>
                <div className="space-y-2">
                  {scholarUsers
                    .filter(s => !s.isSelf && !userCoauthorIds.includes(s.id))
                    .map(scholar => (
                      <div key={scholar.id} className="flex items-center justify-between p-2 bg-gray-50 rounded-lg">
                        <div className="flex items-center space-x-3">
                          {scholar.avatarUrl ? (
                            <img src={scholar.avatarUrl} alt={scholar.name} className="w-8 h-8 rounded-full object-cover" />
                          ) : (
                            <div className="w-8 h-8 bg-gray-300 rounded-full flex items-center justify-center">
                              <span className="text-white text-xs font-medium">{getInitials(scholar.name)}</span>
                            </div>
                          )}
                          <div>
                            <p className="text-sm font-medium text-gray-900">{scholar.name}</p>
                            <p className="text-xs text-gray-500">{scholar.affiliation}</p>
                          </div>
                        </div>
                        <button
                          onClick={() => {
                            setUserCoauthorIds(prev => [...prev, scholar.id]);
                          }}
                          className="p-1 text-blue-500 hover:bg-blue-50 rounded"
                          title="Add co-author"
                        >
                          <UserPlus className="w-4 h-4" />
                        </button>
                      </div>
                    ))}
                  {scholarUsers.filter(s => !s.isSelf && !userCoauthorIds.includes(s.id)).length === 0 && (
                    <p className="text-sm text-gray-500 italic">All available scholars are already co-authors.</p>
                  )}
                </div>
              </div>
            </div>
            <div className="p-4 border-t bg-gray-50">
              <button
                onClick={() => setShowEditCoauthorsModal(false)}
                className="w-full px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
              >
                Done
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ===================================================================== */}
      {/* EDIT PROFILE MODAL                                                   */}
      {/* ===================================================================== */}
      {showEditProfileModal && (
        <div
          className="fixed inset-0 bg-black/50 flex items-center justify-center z-50"
          onClick={() => setShowEditProfileModal(false)}
        >
          <div
            className="bg-white rounded-lg shadow-xl w-full max-w-md mx-4"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="p-4 border-b flex justify-between items-center">
              <h3 className="text-lg font-medium">Edit Profile</h3>
              <button
                onClick={() => setShowEditProfileModal(false)}
                className="text-gray-500 hover:text-gray-700"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="p-4 space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Name</label>
                <input
                  type="text"
                  value={editProfileName}
                  onChange={(e) => setEditProfileName(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Affiliation</label>
                <input
                  type="text"
                  value={editProfileAffiliation}
                  onChange={(e) => setEditProfileAffiliation(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
              <p className="text-sm text-gray-500">
                Note: Profile changes are temporary and will reset on page refresh.
              </p>
            </div>
            <div className="p-4 border-t bg-gray-50 flex space-x-3">
              <button
                onClick={() => setShowEditProfileModal(false)}
                className="flex-1 px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-100"
              >
                Cancel
              </button>
              <button
                onClick={() => {
                  // In a real app, this would save to backend
                  setShowEditProfileModal(false);
                }}
                className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
              >
                Save Changes
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ===================================================================== */}
      {/* ADVANCED SEARCH MODAL                                                */}
      {/* ===================================================================== */}
      {showAdvancedSearch && <AdvancedSearchModal />}

      {/* ===================================================================== */}
      {/* LOCK SCREEN                                                          */}
      {/* ===================================================================== */}
      {isSignedOut && (
        <div className="fixed inset-0 z-50 flex items-center justify-center" style={{ backgroundColor: "rgba(0,0,0,0.5)", backdropFilter: "blur(6px)" }}>
          <div className="bg-white rounded-lg shadow-2xl p-8 w-[360px] flex flex-col items-center">
            <div className="text-2xl font-bold mb-6" style={{ color: "#4285F4" }}>MicroScholar</div>
            <div className="w-20 h-20 rounded-full flex items-center justify-center text-white text-2xl font-bold mb-4" style={{ backgroundColor: "#4285F4" }}>
              {selfUser?.name?.split(" ").map((n: string) => n[0]).join("") || "U"}
            </div>
            <div className="text-lg font-semibold text-gray-900 mb-1">{selfUser?.name || "Researcher"}</div>
            <div className="text-sm text-gray-500 mb-6">{selfUser?.email || "user@microscholar.com"}</div>
            <input type="password" readOnly value="••••••••" className="w-full px-4 py-2 border border-gray-300 rounded mb-4 text-center text-gray-400 bg-gray-50" />
            <button onClick={() => setIsSignedOut(false)} className="w-full py-2 text-white rounded font-semibold hover:opacity-90 transition-opacity" style={{ backgroundColor: "#4285F4" }}>
              Sign in
            </button>
          </div>
        </div>
      )}

      {/* ===================================================================== */}
      {/* HINTS (Dev mode)                                                     */}
      {/* ===================================================================== */}
      {/* Toast Notification */}
      {toastMessage && (
        <div className="fixed top-4 left-1/2 transform -translate-x-1/2 bg-gray-900 text-white px-6 py-3 rounded-lg shadow-2xl z-[9999] text-sm font-medium animate-pulse">
          {toastMessage}
        </div>
      )}

      {showDevTools && (
        <div className="fixed bottom-4 left-4 bg-gray-900 text-green-400 rounded-lg p-4 font-mono text-xs max-w-md z-50">
          <div className="font-bold text-green-300 mb-2">🛠️ HINTS</div>
          <p>
            <strong className="text-yellow-400">Task:</strong> Search for papers, wait for target
            paper to appear, click Cite on it
          </p>
          <p>
            <strong className="text-yellow-400">Duration:</strong> {taskDuration}s
          </p>
          <p>
            <strong className="text-yellow-400">Status ID:</strong> #microscholar-status
          </p>
          <p>
            <strong className="text-yellow-400">Code ID:</strong> #microscholar-code
          </p>
        </div>
      )}

      {/* ===================================================================== */}
      {/* FOOTER                                                               */}
      {/* ===================================================================== */}
      <footer className="border-t border-gray-200 bg-[#f2f2f2] mt-auto">
        <div className="max-w-7xl mx-auto px-4 py-3">
          <div className="flex flex-col sm:flex-row items-center justify-between text-xs text-gray-600">
            <div className="flex items-center space-x-4 mb-2 sm:mb-0">
              <div className="flex items-center space-x-1">
                <span className="w-4 h-4 rounded-full bg-gray-400 flex items-center justify-center text-white text-[8px]">EN</span>
                <span>English</span>
              </div>
            </div>
            <div className="flex items-center space-x-6">
              <button onClick={() => setCurrentView("privacy")} className="hover:underline">Privacy</button>
              <button onClick={() => setCurrentView("terms")} className="hover:underline">Terms</button>
              <button onClick={() => setCurrentView("help")} className="hover:underline">Help</button>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
};

export default MicroScholar;
