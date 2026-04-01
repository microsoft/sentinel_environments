import { FormEvent, useEffect, useState, useRef } from "react";
import { Navigate, useLocation, useSearchParams } from "react-router-dom";

const SITE_PASSWORD = "microsoftaifrontiers-blogpost";

// Assets to preload during boot
const assetBase = `${import.meta.env.BASE_URL}desktop/`;
const baseUrl = import.meta.env.BASE_URL;

// Static assets to preload
const STATIC_PRELOAD_ASSETS = [
  // Wallpaper
  `${assetBase}xp-wallpaper.jpg`,
  // Desktop icons
  `${assetBase}micromail-icon.png`,
  `${assetBase}microlendar-icon.png`,
  `${assetBase}github-icon.png`,
  `${assetBase}microscholar-icon.png`,
  `${assetBase}teams-icon.png`,
  `${assetBase}microgram-icon.png`,
  `${assetBase}microtube-icon.png`,
  `${assetBase}microhood-icon.png`,
  `${assetBase}microfy-icon.png`,
  `${assetBase}microdin-icon.png`,
  `${assetBase}info-icon.png`,
  `${assetBase}authors-icon.png`,
  `${assetBase}citations-icon.png`,
  `${assetBase}pdf-icon.png`,
  `${assetBase}download-icon.png`,
  `${assetBase}leaderboard-icon.png`,
  // Taskbar & system
  `${assetBase}xp-start-button.png`,
];

// Boot phases
type BootPhase = "boot" | "welcome" | "password" | "logging-in" | "authenticated" | "shutdown" | "off";

export default function Login() {
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [searchParams] = useSearchParams();
  const location = useLocation();
  const [bootPhase, setBootPhase] = useState<BootPhase>("boot");
  const [bootProgress, setBootProgress] = useState(0);
  const [selfUser, setSelfUser] = useState<any>(null);

  useEffect(() => {
    fetch("/api/data/self-user")
      .then((r) => r.ok ? r.json() : null)
      .then((data) => {
        if (data?.user) {
          setSelfUser(data.user);
        }
      })
      .catch(() => {});
  }, []);

  // Get the intended path from the state, or default to "/"
  const fromPathname = location.state?.from?.pathname || "/";
  const fromSearch = location.state?.from?.search || "";
  const from = fromPathname + fromSearch;

  // Handle URL password authentication
  useEffect(() => {
    const urlPassword = searchParams.get("password");
    if (urlPassword === SITE_PASSWORD) {
      localStorage.setItem("isAuthenticated", "true");
      const targetPath = location.pathname === "/login" ? from : location.pathname;
      const params = new URLSearchParams(location.search);
      params.delete("password");
      const queryString = params.toString();
      const finalUrl = targetPath + (queryString ? `?${queryString}` : "");
      window.location.href = finalUrl;
    }
  }, [searchParams, location, from]);

  // Track if preloading has started to prevent double-loading
  const preloadStartedRef = useRef(false);

  // Boot animation with real asset preloading
  useEffect(() => {
    if (bootPhase === "boot" && !preloadStartedRef.current) {
      preloadStartedRef.current = true;

      // Build dynamic asset list including user avatar
      const assetsToPreload = [...STATIC_PRELOAD_ASSETS];
      if (selfUser?.avatarUrl) {
        assetsToPreload.push(`${baseUrl}${selfUser.avatarUrl}`);
      }

      let loadedCount = 0;
      const totalAssets = assetsToPreload.length;

      // Preload all assets
      assetsToPreload.forEach((src) => {
        const img = new Image();
        img.onload = () => {
          loadedCount++;
          const progress = (loadedCount / totalAssets) * 100;
          setBootProgress(progress);

          // When all assets loaded, move to welcome screen
          if (loadedCount === totalAssets) {
            setTimeout(() => setBootPhase("welcome"), 500);
          }
        };
        img.onerror = () => {
          // Still count failed loads to avoid getting stuck
          loadedCount++;
          const progress = (loadedCount / totalAssets) * 100;
          setBootProgress(progress);

          if (loadedCount === totalAssets) {
            setTimeout(() => setBootPhase("welcome"), 500);
          }
        };
        img.src = src;
      });

      // Fallback timeout in case assets don't load
      const fallbackTimeout = setTimeout(() => {
        if (bootPhase === "boot") {
          setBootProgress(100);
          setBootPhase("welcome");
        }
      }, 10000); // 10 second max wait

      return () => clearTimeout(fallbackTimeout);
    }
  }, [bootPhase, selfUser?.avatarUrl]);

  // Logging in animation
  useEffect(() => {
    if (bootPhase === "logging-in") {
      const timer = setTimeout(() => {
        localStorage.setItem("isAuthenticated", "true");
        setBootPhase("authenticated");
        setTimeout(() => {
          window.location.href = from;
        }, 800);
      }, 2000);
      return () => clearTimeout(timer);
    }
  }, [bootPhase, from]);

  // Shutdown animation - clears auth and goes to black screen
  useEffect(() => {
    if (bootPhase === "shutdown") {
      localStorage.removeItem("isAuthenticated");
      const timer = setTimeout(() => {
        setBootPhase("off");
      }, 3500);
      return () => clearTimeout(timer);
    }
  }, [bootPhase]);

  // Check if already authenticated
  if (localStorage.getItem("isAuthenticated") === "true") {
    return <Navigate to={from} replace />;
  }

  const handleUserClick = () => {
    setBootPhase("password");
    setError("");
  };

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();
    if (password === SITE_PASSWORD) {
      setBootPhase("logging-in");
    } else {
      setError("The password is incorrect. Please try again.");
      setPassword("");
    }
  };

  const handleBackToWelcome = () => {
    setBootPhase("welcome");
    setPassword("");
    setError("");
  };

  // Boot Screen - Windows XP style
  if (bootPhase === "boot") {
    return (
      <div className="min-h-screen bg-black flex flex-col items-center justify-center select-none">
        {/* Windows XP Logo */}
        <div className="flex flex-col items-center mb-8">
          {/* Windows Flag Logo */}
          <div className="flex gap-0.5 mb-4">
            <div className="w-12 h-12 bg-gradient-to-br from-red-500 to-orange-600 rounded-tl-lg transform -skew-x-6" />
            <div className="w-12 h-12 bg-gradient-to-br from-green-500 to-green-600 rounded-tr-lg transform skew-x-6" />
          </div>
          <div className="flex gap-0.5 -mt-1">
            <div className="w-12 h-12 bg-gradient-to-br from-blue-500 to-blue-600 rounded-bl-lg transform -skew-x-6" />
            <div className="w-12 h-12 bg-gradient-to-br from-yellow-400 to-yellow-500 rounded-br-lg transform skew-x-6" />
          </div>
          <div className="mt-4 text-white text-2xl font-light tracking-wider">
            <span className="font-normal">Sentinel</span>
            <span className="font-bold text-blue-400">XP</span>
          </div>
          <div className="text-gray-500 text-xs mt-1 tracking-widest">Professional</div>
        </div>

        {/* Progress Bar */}
        <div className="w-64 mt-8">
          <div className="h-3 bg-gray-800 rounded-full overflow-hidden border border-gray-700">
            <div
              className="h-full transition-all duration-150 ease-out"
              style={{
                width: `${bootProgress}%`,
                background: 'linear-gradient(to bottom, #3b82f6 0%, #1d4ed8 50%, #1e40af 100%)',
              }}
            />
          </div>
          {/* Animated loading blocks */}
          <div className="flex justify-center mt-4 gap-1">
            {[0, 1, 2].map((i) => (
              <div
                key={i}
                className="w-3 h-3 bg-blue-500 rounded-sm animate-pulse"
                style={{
                  animationDelay: `${i * 200}ms`,
                  opacity: bootProgress > i * 30 ? 1 : 0.3,
                }}
              />
            ))}
          </div>
        </div>

        {/* Copyright */}
        <div className="absolute bottom-8 text-gray-600 text-xs">
          Copyright (c) Microsoft Corporation. All rights reserved.
        </div>
      </div>
    );
  }

  // Welcome Screen - User Selection
  if (bootPhase === "welcome") {
    return (
      <div
        className="min-h-screen flex flex-col select-none"
        style={{
          background: 'linear-gradient(to bottom, #245edc 0%, #3a7bd5 30%, #5b9bd5 70%, #89c4f4 100%)',
        }}
      >
        {/* Top Bar */}
        <div
          className="h-16 flex items-center justify-between px-8"
          style={{
            background: 'linear-gradient(to bottom, #0a2463 0%, #1e3a8a 100%)',
            borderBottom: '2px solid #3b82f6',
          }}
        >
          <div className="flex items-center gap-3">
            {/* Small Windows Flag */}
            <div className="grid grid-cols-2 gap-0.5 w-6 h-6">
              <div className="bg-gradient-to-br from-red-500 to-orange-600 rounded-tl-sm" />
              <div className="bg-gradient-to-br from-green-500 to-green-600 rounded-tr-sm" />
              <div className="bg-gradient-to-br from-blue-500 to-blue-600 rounded-bl-sm" />
              <div className="bg-gradient-to-br from-yellow-400 to-yellow-500 rounded-br-sm" />
            </div>
            <span className="text-white font-semibold">SentinelXP</span>
          </div>
          <div className="text-white/80 text-sm">
            To begin, click your user name
          </div>
        </div>

        {/* Main Content */}
        <div className="flex-1 flex items-center justify-center">
          <div className="flex flex-col items-center">
            {/* Welcome Text */}
            <h1
              className="text-5xl font-light text-white mb-12"
              style={{ textShadow: '2px 2px 8px rgba(0,0,0,0.3)' }}
            >
              Welcome
            </h1>

            {/* User Card */}
            <button
              onClick={handleUserClick}
              className="group flex items-center gap-4 bg-white/10 hover:bg-white/20 border-2 border-white/30 hover:border-white/60 rounded-lg px-6 py-4 transition-all duration-200 cursor-pointer"
              style={{
                boxShadow: '0 4px 20px rgba(0,0,0,0.2)',
              }}
            >
              {/* User Avatar */}
              <div
                className="w-16 h-16 rounded-md flex items-center justify-center overflow-hidden"
                style={{
                  background: selfUser?.avatarUrl
                    ? 'transparent'
                    : `linear-gradient(135deg, #4a90d9 0%, #2563eb 100%)`,
                  border: '3px solid white',
                  boxShadow: '0 2px 8px rgba(0,0,0,0.3)',
                }}
              >
                {selfUser?.avatarUrl ? (
                  <img src={selfUser.avatarUrl} alt={selfUser.name} className="w-full h-full object-cover" />
                ) : (
                  <svg className="w-10 h-10 text-white" fill="currentColor" viewBox="0 0 24 24">
                    <path d="M12 12c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4zm0 2c-2.67 0-8 1.34-8 4v2h16v-2c0-2.66-5.33-4-8-4z"/>
                  </svg>
                )}
              </div>

              {/* User Name */}
              <div className="text-left">
                <div className="text-white text-xl font-medium group-hover:text-yellow-200 transition-colors">
                  {selfUser?.name || 'Sentinel User'}
                </div>
                <div className="text-white/60 text-sm">
                  SentinelBench
                </div>
              </div>

              {/* Arrow */}
              <svg
                className="w-6 h-6 text-white/60 group-hover:text-white group-hover:translate-x-1 transition-all ml-4"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
              </svg>
            </button>

            {/* Hint */}
            <p className="text-white/60 text-sm mt-8">
              Click on your account to log in
            </p>
          </div>
        </div>

        {/* Bottom Bar */}
        <div
          className="h-12 flex items-center justify-end px-8"
          style={{
            background: 'linear-gradient(to top, #0a2463 0%, #1e3a8a 100%)',
            borderTop: '2px solid #3b82f6',
          }}
        >
          <button
            className="text-white/80 hover:text-white text-sm flex items-center gap-2 px-3 py-1 rounded hover:bg-white/10 transition-colors"
            onClick={() => setBootPhase("shutdown")}
          >
            <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
              <path d="M13 3h-2v10h2V3zm4.83 2.17l-1.42 1.42C17.99 7.86 19 9.81 19 12c0 3.87-3.13 7-7 7s-7-3.13-7-7c0-2.19 1.01-4.14 2.58-5.42L6.17 5.17C4.23 6.82 3 9.26 3 12c0 4.97 4.03 9 9 9s9-4.03 9-9c0-2.74-1.23-5.18-3.17-6.83z"/>
            </svg>
            Turn off computer
          </button>
        </div>
      </div>
    );
  }

  // Password Entry Screen
  if (bootPhase === "password") {
    return (
      <div
        className="min-h-screen flex flex-col select-none"
        style={{
          background: 'linear-gradient(to bottom, #245edc 0%, #3a7bd5 30%, #5b9bd5 70%, #89c4f4 100%)',
        }}
      >
        {/* Top Bar */}
        <div
          className="h-16 flex items-center justify-between px-8"
          style={{
            background: 'linear-gradient(to bottom, #0a2463 0%, #1e3a8a 100%)',
            borderBottom: '2px solid #3b82f6',
          }}
        >
          <div className="flex items-center gap-3">
            {/* Small Windows Flag */}
            <div className="grid grid-cols-2 gap-0.5 w-6 h-6">
              <div className="bg-gradient-to-br from-red-500 to-orange-600 rounded-tl-sm" />
              <div className="bg-gradient-to-br from-green-500 to-green-600 rounded-tr-sm" />
              <div className="bg-gradient-to-br from-blue-500 to-blue-600 rounded-bl-sm" />
              <div className="bg-gradient-to-br from-yellow-400 to-yellow-500 rounded-br-sm" />
            </div>
            <span className="text-white font-semibold">SentinelXP</span>
          </div>
        </div>

        {/* Main Content */}
        <div className="flex-1 flex items-center justify-center">
          <div className="flex flex-col items-center">
            {/* User Card with Password */}
            <div
              className="bg-white/10 border-2 border-white/40 rounded-lg p-6 min-w-[400px]"
              style={{
                boxShadow: '0 4px 20px rgba(0,0,0,0.2)',
              }}
            >
              <div className="flex items-start gap-4">
                {/* User Avatar */}
                <div
                  className="w-16 h-16 rounded-md flex items-center justify-center overflow-hidden flex-shrink-0"
                  style={{
                    background: selfUser?.avatarUrl
                      ? 'transparent'
                      : `linear-gradient(135deg, #4a90d9 0%, #2563eb 100%)`,
                    border: '3px solid white',
                    boxShadow: '0 2px 8px rgba(0,0,0,0.3)',
                  }}
                >
                  {selfUser?.avatarUrl ? (
                    <img src={selfUser.avatarUrl} alt={selfUser.name} className="w-full h-full object-cover" />
                  ) : (
                    <svg className="w-10 h-10 text-white" fill="currentColor" viewBox="0 0 24 24">
                      <path d="M12 12c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4zm0 2c-2.67 0-8 1.34-8 4v2h16v-2c0-2.66-5.33-4-8-4z"/>
                    </svg>
                  )}
                </div>

                {/* Form Section */}
                <div className="flex-1">
                  <div className="text-white text-xl font-medium mb-1">
                    {selfUser?.name || 'Sentinel User'}
                  </div>

                  <form onSubmit={handleSubmit} className="mt-3">
                    <div className="flex gap-2">
                      <input
                        type="password"
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        placeholder="Type your password"
                        autoFocus
                        className="flex-1 px-3 py-2 rounded border-2 border-gray-300 focus:border-blue-500 focus:outline-none text-gray-800 text-sm"
                        style={{
                          boxShadow: 'inset 0 1px 3px rgba(0,0,0,0.1)',
                        }}
                      />
                      <button
                        type="submit"
                        className="px-4 py-2 bg-green-600 hover:bg-green-700 text-white rounded flex items-center justify-center transition-colors"
                        style={{
                          boxShadow: '0 2px 4px rgba(0,0,0,0.2)',
                        }}
                      >
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14 5l7 7m0 0l-7 7m7-7H3" />
                        </svg>
                      </button>
                    </div>

                    {/* Error Message */}
                    {error && (
                      <div className="mt-3 flex items-start gap-2 text-yellow-200 text-sm">
                        <svg className="w-5 h-5 flex-shrink-0 text-yellow-300" fill="currentColor" viewBox="0 0 24 24">
                          <path d="M1 21h22L12 2 1 21zm12-3h-2v-2h2v2zm0-4h-2v-4h2v4z"/>
                        </svg>
                        <span>{error}</span>
                      </div>
                    )}
                  </form>

                </div>
              </div>
            </div>

            {/* Back Button */}
            <button
              onClick={handleBackToWelcome}
              className="mt-6 text-white/80 hover:text-white text-sm flex items-center gap-2 px-4 py-2 rounded hover:bg-white/10 transition-colors"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
              </svg>
              Back to user list
            </button>
          </div>
        </div>

        {/* Bottom Bar */}
        <div
          className="h-12 flex items-center justify-end px-8"
          style={{
            background: 'linear-gradient(to top, #0a2463 0%, #1e3a8a 100%)',
            borderTop: '2px solid #3b82f6',
          }}
        >
          <button
            className="text-white/80 hover:text-white text-sm flex items-center gap-2 px-3 py-1 rounded hover:bg-white/10 transition-colors"
            onClick={() => setBootPhase("shutdown")}
          >
            <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
              <path d="M13 3h-2v10h2V3zm4.83 2.17l-1.42 1.42C17.99 7.86 19 9.81 19 12c0 3.87-3.13 7-7 7s-7-3.13-7-7c0-2.19 1.01-4.14 2.58-5.42L6.17 5.17C4.23 6.82 3 9.26 3 12c0 4.97 4.03 9 9 9s9-4.03 9-9c0-2.74-1.23-5.18-3.17-6.83z"/>
            </svg>
            Turn off computer
          </button>
        </div>
      </div>
    );
  }

  // Off Screen - computer is "off", click anywhere to boot
  if (bootPhase === "off") {
    return (
      <div
        className="min-h-screen bg-black flex items-center justify-center select-none cursor-pointer"
        onClick={() => {
          setBootProgress(0);
          setBootPhase("boot");
        }}
      >
        <div className="text-gray-700 text-sm animate-pulse">
          Click anywhere to start
        </div>
      </div>
    );
  }

  // Shutdown Screen
  if (bootPhase === "shutdown") {
    return (
      <div className="min-h-screen bg-[#0a246a] flex flex-col items-center justify-center select-none">
        <div className="text-center">
          <div className="text-white text-xl mb-6">Windows is shutting down...</div>
          {/* Animated dots */}
          <div className="flex justify-center gap-1">
            {[0, 1, 2].map((i) => (
              <div
                key={i}
                className="w-2 h-2 bg-white rounded-full animate-pulse"
                style={{
                  animationDelay: `${i * 200}ms`,
                }}
              />
            ))}
          </div>
        </div>
        {/* This will fade to black after a delay */}
        <div
          className="fixed inset-0 bg-black pointer-events-none animate-fade-in"
          style={{
            animation: 'fadeIn 2s ease-in 1.5s forwards',
            opacity: 0,
          }}
        />
        <style>{`
          @keyframes fadeIn {
            from { opacity: 0; }
            to { opacity: 1; }
          }
        `}</style>
      </div>
    );
  }

  // Logging In Screen
  if (bootPhase === "logging-in") {
    return (
      <div
        className="min-h-screen flex flex-col items-center justify-center select-none"
        style={{
          background: 'linear-gradient(to bottom, #245edc 0%, #3a7bd5 30%, #5b9bd5 70%, #89c4f4 100%)',
        }}
      >
        <div className="flex flex-col items-center">
          {/* User Avatar */}
          <div
            className="w-20 h-20 rounded-md flex items-center justify-center overflow-hidden mb-4"
            style={{
              background: selfUser?.avatarUrl
                ? 'transparent'
                : `linear-gradient(135deg, #4a90d9 0%, #2563eb 100%)`,
              border: '3px solid white',
              boxShadow: '0 4px 12px rgba(0,0,0,0.3)',
            }}
          >
            {selfUser?.avatarUrl ? (
              <img src={selfUser.avatarUrl} alt={selfUser.name} className="w-full h-full object-cover" />
            ) : (
              <svg className="w-12 h-12 text-white" fill="currentColor" viewBox="0 0 24 24">
                <path d="M12 12c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4zm0 2c-2.67 0-8 1.34-8 4v2h16v-2c0-2.66-5.33-4-8-4z"/>
              </svg>
            )}
          </div>

          <h2
            className="text-2xl font-medium text-white mb-6"
            style={{ textShadow: '1px 1px 4px rgba(0,0,0,0.3)' }}
          >
            Welcome, {selfUser?.name?.split(' ')[0] || 'User'}
          </h2>

          {/* Loading text */}
          <div className="text-white/80 text-sm mb-4">Loading your personal settings...</div>

          {/* Loading animation */}
          <div className="flex gap-1">
            {[0, 1, 2, 3, 4].map((i) => (
              <div
                key={i}
                className="w-2 h-2 bg-white rounded-full animate-bounce"
                style={{
                  animationDelay: `${i * 100}ms`,
                  animationDuration: '0.6s',
                }}
              />
            ))}
          </div>
        </div>
      </div>
    );
  }

  // Authenticated - brief flash before redirect
  return (
    <div
      className="min-h-screen flex items-center justify-center select-none"
      style={{
        background: 'linear-gradient(to bottom, #245edc 0%, #3a7bd5 30%, #5b9bd5 70%, #89c4f4 100%)',
      }}
    >
      <div className="text-white text-xl">Loading SentinelBench...</div>
    </div>
  );
}
