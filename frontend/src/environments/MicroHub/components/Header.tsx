import {
  Menu,
  Lock,
  Globe,
  Search,
  Plus,
  ChevronDown,
  BookOpen,
  Code,
  CircleDot,
  GitPullRequest,
  Bell,
  Inbox,
  Users,
  Star,
  Settings,
} from "lucide-react";
import { classNames } from "../utils";
import { useMicrohubCtx, useMicrohubUI } from "../contexts";
import { Avatar } from "./Avatar";

// Module-scope (no React.memo): consumes both data and UI contexts, so memo
// would be a no-op — context churn re-renders consumers regardless of prop
// equality. The extraction itself is what fixes the remount bug; without it
// every poll tick was tearing down and rebuilding the entire <header>.
export const Header = () => {
  const { repository, selfUser, unreadNotifications } = useMicrohubCtx();
  const {
    sideMenuOpen,
    setSideMenuOpen,
    setRoute,
    setCommandPaletteOpen,
    isLoggedIn,
    createMenuOpen,
    setCreateMenuOpen,
    setNewRepoModalOpen,
    setImportRepoModalOpen,
    setNewIssueModalOpen,
    setNewPRModalOpen,
    notificationsOpen,
    setNotificationsOpen,
    notifications,
    handleNotificationClick,
    inboxOpen,
    setInboxOpen,
    userMenuOpen,
    setUserMenuOpen,
    setIsSignedOut,
    handleViewProfile,
  } = useMicrohubUI();

  if (!repository) return null;

  return (
    <header className="bg-[#010409] text-white px-4 py-3 flex items-center justify-between sticky top-0 z-50">
      <div className="flex items-center space-x-4">
        {/* Hamburger menu */}
        <button className="p-1.5 hover:bg-gray-700 rounded" onClick={() => setSideMenuOpen(!sideMenuOpen)}>
          <Menu className="w-5 h-5" />
        </button>

        {/* MicroHub logo */}
        <a href="#" className="text-white hover:text-gray-300" onClick={(e) => { e.preventDefault(); setRoute("code"); }}>
          <img src="desktop/github-icon.png" alt="MicroHub" className="w-8 h-8 object-contain" />
        </a>

        {/* Repository path */}
        <div className="flex items-center text-sm">
          <a href="#" className="text-gray-300 hover:text-white hover:underline" onClick={(e) => { e.preventDefault(); handleViewProfile(repository.owner); }}>
            {repository.owner}
          </a>
          <span className="mx-1 text-gray-500">/</span>
          <a href="#" className="text-white font-semibold hover:underline" onClick={(e) => { e.preventDefault(); setRoute("code"); }}>
            {repository.name}
          </a>
          {repository.isPrivate ? (
            <Lock className="w-4 h-4 ml-2 text-gray-500" />
          ) : (
            <Globe className="w-4 h-4 ml-2 text-gray-500" />
          )}
        </div>
      </div>

      <div className="flex items-center space-x-3">
        {/* Search bar */}
        <div className="hidden md:flex items-center">
          <button
            onClick={() => setCommandPaletteOpen(true)}
            className="flex items-center space-x-2 px-3 py-1.5 bg-[#0d1117] border border-gray-700 rounded-md text-gray-400 hover:border-gray-600"
          >
            <Search className="w-4 h-4" />
            <span className="text-sm">Type</span>
            <span className="text-xs border border-gray-600 rounded px-1.5 py-0.5">/</span>
            <span className="text-sm">to search</span>
          </button>
        </div>

        {isLoggedIn ? (
          <>
            <div className="flex items-center space-x-1">
              {/* Create new dropdown */}
              <div className="relative">
                <button
                  className="p-1.5 hover:bg-gray-700 rounded flex items-center"
                  onClick={() => setCreateMenuOpen(!createMenuOpen)}
                >
                  <Plus className="w-4 h-4" />
                  <ChevronDown className="w-3 h-3" />
                </button>
                {createMenuOpen && (
                  <div className="absolute right-0 mt-2 w-48 bg-[#161b22] border border-gray-700 rounded-lg shadow-lg py-1 z-50">
                    <button
                      onClick={() => { setCreateMenuOpen(false); setNewRepoModalOpen(true); }}
                      className="w-full text-left px-4 py-2 text-sm hover:bg-gray-800 flex items-center"
                    >
                      <BookOpen className="w-4 h-4 mr-3" />New repository
                    </button>
                    <button
                      onClick={() => { setCreateMenuOpen(false); setImportRepoModalOpen(true); }}
                      className="w-full text-left px-4 py-2 text-sm hover:bg-gray-800 flex items-center"
                    >
                      <Code className="w-4 h-4 mr-3" />Import repository
                    </button>
                    <div className="border-t border-gray-700 my-1" />
                    <button
                      onClick={() => { setCreateMenuOpen(false); setNewIssueModalOpen(true); }}
                      className="w-full text-left px-4 py-2 text-sm hover:bg-gray-800 flex items-center"
                    >
                      <CircleDot className="w-4 h-4 mr-3" />New issue
                    </button>
                    <button
                      onClick={() => { setCreateMenuOpen(false); setNewPRModalOpen(true); }}
                      className="w-full text-left px-4 py-2 text-sm hover:bg-gray-800 flex items-center"
                    >
                      <GitPullRequest className="w-4 h-4 mr-3" />New pull request
                    </button>
                  </div>
                )}
              </div>

              {/* Issues icon */}
              <button className="p-1.5 hover:bg-gray-700 rounded" onClick={() => { setRoute("issues"); }}>
                <CircleDot className="w-5 h-5" />
              </button>

              {/* PRs icon */}
              <button className="p-1.5 hover:bg-gray-700 rounded" onClick={() => { setRoute("pulls"); }}>
                <GitPullRequest className="w-5 h-5" />
              </button>

              {/* Notifications */}
              <div className="relative">
                <button
                  className="p-1.5 hover:bg-gray-700 rounded relative"
                  onClick={() => setNotificationsOpen(!notificationsOpen)}
                >
                  <Bell className="w-5 h-5" />
                  {unreadNotifications > 0 && (
                    <span className="absolute -top-1 -right-1 w-4 h-4 bg-blue-500 rounded-full text-[10px] flex items-center justify-center">
                      {unreadNotifications}
                    </span>
                  )}
                </button>

                {notificationsOpen && (
                  <div className="absolute right-0 mt-2 w-80 bg-[#161b22] border border-gray-700 rounded-lg shadow-lg">
                    <div className="p-3 border-b border-gray-700">
                      <span className="font-medium">Notifications</span>
                    </div>
                    <div className="max-h-64 overflow-y-auto">
                      {notifications.map(n => (
                        <button
                          key={n.id}
                          onClick={() => handleNotificationClick(n)}
                          className={classNames(
                            "w-full p-3 text-left hover:bg-gray-800 flex items-center space-x-3",
                            !n.read && "bg-blue-900/20"
                          )}
                        >
                          {!n.read && <div className="w-2 h-2 bg-blue-500 rounded-full flex-shrink-0" />}
                          <span className="text-sm">{n.title}</span>
                        </button>
                      ))}
                    </div>
                  </div>
                )}
              </div>

              {/* Inbox */}
              <div className="relative">
                <button
                  className="p-1.5 hover:bg-gray-700 rounded"
                  onClick={() => setInboxOpen(!inboxOpen)}
                >
                  <Inbox className="w-5 h-5" />
                </button>
                {inboxOpen && (
                  <div className="absolute right-0 mt-2 w-72 bg-[#161b22] border border-gray-700 rounded-lg shadow-lg z-50">
                    <div className="p-3 border-b border-gray-700 flex items-center justify-between">
                      <span className="font-medium">Inbox</span>
                      <span className="text-xs text-gray-400">0 unread</span>
                    </div>
                    <div className="p-6 text-center text-gray-400">
                      <Inbox className="w-8 h-8 mx-auto mb-2 opacity-50" />
                      <p className="text-sm">All caught up!</p>
                      <p className="text-xs">No messages in your inbox</p>
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* User avatar */}
            <div className="relative">
              <button
                onClick={() => setUserMenuOpen(!userMenuOpen)}
                className="flex items-center hover:opacity-80"
              >
                {selfUser && <Avatar user={selfUser} size="sm" />}
              </button>

              {userMenuOpen && (
                <div className="absolute right-0 mt-2 w-56 bg-[#161b22] border border-gray-700 rounded-lg shadow-lg py-1 z-50">
                  <div className="px-4 py-2 border-b border-gray-700">
                    <p className="text-sm font-medium">{selfUser?.name}</p>
                    <p className="text-xs text-gray-400">@{selfUser?.username}</p>
                  </div>
                  <button onClick={() => { handleViewProfile(selfUser?.username || ""); setUserMenuOpen(false); }} className="w-full text-left px-4 py-2 text-sm hover:bg-gray-800 flex items-center">
                    <Users className="w-4 h-4 mr-3" />Your profile
                  </button>
                  <button onClick={() => { handleViewProfile(selfUser?.username || ""); setUserMenuOpen(false); }} className="w-full text-left px-4 py-2 text-sm hover:bg-gray-800 flex items-center">
                    <BookOpen className="w-4 h-4 mr-3" />Your repositories
                  </button>
                  <button onClick={() => { handleViewProfile(selfUser?.username || ""); setUserMenuOpen(false); }} className="w-full text-left px-4 py-2 text-sm hover:bg-gray-800 flex items-center">
                    <Star className="w-4 h-4 mr-3" />Your stars
                  </button>
                  <div className="border-t border-gray-700 my-1" />
                  <button onClick={() => { setRoute("settings"); setUserMenuOpen(false); }} className="w-full text-left px-4 py-2 text-sm hover:bg-gray-800 flex items-center">
                    <Settings className="w-4 h-4 mr-3" />Settings
                  </button>
                  <button
                    onClick={() => setIsSignedOut(true)}
                    className="w-full text-left px-4 py-2 text-sm hover:bg-gray-800 text-red-400 flex items-center"
                  >
                    Sign out
                  </button>
                </div>
              )}
            </div>
          </>
        ) : (
          <div className="flex items-center space-x-2">
            <button className="px-3 py-1.5 text-sm hover:text-gray-300">Sign in</button>
            <button className="px-3 py-1.5 text-sm bg-green-600 hover:bg-green-700 rounded-md">Sign up</button>
          </div>
        )}
      </div>
    </header>
  );
};
