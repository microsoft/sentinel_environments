import { useState, useEffect, useMemo, useCallback, useRef } from "react";
import { useMicrohoodData } from "../hooks/useMicrohoodData";
import {
  Search,
  Bell,
  ChevronDown,
  TrendingUp,
  TrendingDown,
  Gift,
  CreditCard,
  ArrowUpRight,
  ArrowDownRight,
  MoreHorizontal,
  Home,
  BarChart3,
  Repeat,
  User,
  Menu,
  X,
  Star,
  Check,
  ChevronRight,
  Lock,
  Unlock,
  Key,
  AlertTriangle,
  FileText,
  Share2,
  EyeOff,
  Plus,
  Copy,
  DollarSign,
  Building,
  Briefcase,
  Sun,
  Moon,
  Settings,
} from "lucide-react";

export const TASK_ID_MICROHOOD = "microhood";

// ============================================================================
// TYPE DEFINITIONS (UI-only)
// ============================================================================



// ============================================================================
// COMPONENT
// ============================================================================

const MicroHood = () => {
  // ===================== API DATA =====================
  const {
    stocks, watchlist: apiWatchlist, news, portfolio, config,
    isLoading, error,
    placeOrder, toggleWatchlist: apiToggleWatchlist,
  } = useMicrohoodData();

  const currentUser = useMemo(() => {
    const raw = config?.selfUser;
    if (!raw) {
      return { id: "user", name: "User", username: "user", avatarUrl: "" };
    }
    return {
      id: raw.id,
      name: raw.name,
      username: raw.username,
      avatarUrl: raw.avatarUrl,
    };
  }, [config?.selfUser]);

  // ===================== DERIVED FROM API =====================
  // MCRO price from server-interpolated stocks
  const currentPrice = useMemo(() => {
    const mcro = stocks.find(s => s.symbol === "MCRO");
    return mcro?.currentPrice ?? 0;
  }, [stocks]);

  // Track a sliding window of MCRO prices for chart
  const priceHistoryRef = useRef<number[]>([]);
  const [priceHistory, setPriceHistory] = useState<number[]>([]);
  useEffect(() => {
    if (currentPrice <= 0) return;
    const hist = priceHistoryRef.current;
    hist.push(currentPrice);
    if (hist.length > 50) hist.shift();
    setPriceHistory([...hist]);
  }, [currentPrice]);

  // Generate static price patterns for non-1D timeframes (cosmetic only)
  const generatePriceHistory = (basePrice: number, points: number, volatility: number): number[] => {
    return Array(points).fill(0).map((_, i) =>
      basePrice - (volatility * 2) + Math.sin(i * 0.3) * volatility + Math.random() * volatility
    );
  };
  const [priceHistoryByTimeframe] = useState<Record<string, number[]>>(() => ({
    "1D": [],
    "1W": generatePriceHistory(430, 50, 20),
    "1M": generatePriceHistory(420, 50, 35),
    "3M": generatePriceHistory(400, 50, 50),
    "YTD": generatePriceHistory(370, 50, 70),
    "1Y": generatePriceHistory(350, 50, 90),
    "ALL": generatePriceHistory(250, 50, 150),
  }));

  // Portfolio from API
  const buyingPower = portfolio?.buying_power ?? 10000;
  const portfolioValue = portfolio?.portfolio_value ?? 0;
  const portfolioChange = portfolio?.total_gain ?? 0;
  const portfolioChangePercent = portfolio?.total_gain_percent ?? 0;

  // Starting price = first MCRO price we saw
  const startingPriceRef = useRef<number>(0);
  if (currentPrice > 0 && startingPriceRef.current === 0) {
    startingPriceRef.current = currentPrice;
  }
  const startingPrice = startingPriceRef.current || currentPrice;

  const priceChange = currentPrice - startingPrice;
  const priceChangePercent = startingPrice > 0 ? (priceChange / startingPrice) * 100 : 0;

  // MCRO shares
  const ownedShares = useMemo(() => {
    const mcro = stocks.find(s => s.symbol === "MCRO");
    return mcro?.shares ?? 0;
  }, [stocks]);

  // allStocksWithCurrentPrices -- directly from API (already has current prices)
  const allStocksWithCurrentPrices = stocks;

  // Watchlist from API -- enrich with inWatchlist flag
  const watchlistItems = useMemo(() =>
    apiWatchlist.map(w => ({ ...w, color: "#6B7280", inWatchlist: true })),
    [apiWatchlist]
  );

  // ===================== UI STATE =====================
  const [toast, setToast] = useState<string | null>(null);
  const [hasPlacedOrder, setHasPlacedOrder] = useState(false);
  const [orderType, setOrderType] = useState<"buy" | "sell" | null>(null);
  const [selectedTimeframe, setSelectedTimeframe] = useState("1D");

  const [isSignedOut, setIsSignedOut] = useState(false);

  const [showOrderModal, setShowOrderModal] = useState(false);
  const [orderQuantity, setOrderQuantity] = useState("1");
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [activeTab, setActiveTab] = useState<"home" | "search" | "transfers" | "profile">("home");

  // UI Panel States
  const [showSearchModal, setShowSearchModal] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [showNotificationsPanel, setShowNotificationsPanel] = useState(false);
  const [showTransferModal, setShowTransferModal] = useState(false);
  const [showRewardsModal, setShowRewardsModal] = useState(false);
  const [showCardModal, setShowCardModal] = useState(false);
  const [buyingPowerExpanded, setBuyingPowerExpanded] = useState(false);
  const [showAllStocks, setShowAllStocks] = useState(false);
  const [activeNavSection, setActiveNavSection] = useState<"investing" | "crypto" | "spending" | "retirement">("investing");
  const [editingWatchlist, setEditingWatchlist] = useState(false);

  // Selected stock for detail view
  const [selectedStock, setSelectedStock] = useState<{
    symbol: string;
    name: string;
    price: number;
    change: number;
    changePercent: number;
    color: string;
    shares?: number;
    avgCost?: number;
  } | null>(null);
  const [orderStep, setOrderStep] = useState<"quantity" | "review">("quantity");
  const [orderTypeSelection, setOrderTypeSelection] = useState<"market" | "limit">("market");
  const [limitPrice, setLimitPrice] = useState("");

  // Full realism state
  const [showCardSettingsModal, setShowCardSettingsModal] = useState(false);
  const [cardFrozen, setCardFrozen] = useState(false);
  const [transferStep, setTransferStep] = useState<"menu" | "to-bank" | "from-bank" | "stocks">("menu");
  const [transferAmount, setTransferAmount] = useState("");
  const [showMoreOptionsDropdown, setShowMoreOptionsDropdown] = useState(false);
  const [transactions, setTransactions] = useState<Array<{ merchant: string; amount: number; date: string; type: "spending" | "order" }>>([
    { merchant: "Coffee Shop", amount: -4.50, date: "Today", type: "spending" },
    { merchant: "Grocery Store", amount: -67.23, date: "Yesterday", type: "spending" },
    { merchant: "Gas Station", amount: -45.00, date: "Dec 18", type: "spending" },
    { merchant: "Restaurant", amount: -32.50, date: "Dec 17", type: "spending" },
    { merchant: "Transfer In", amount: 500.00, date: "Dec 15", type: "spending" },
  ]);
  const [showIRAModal, setShowIRAModal] = useState(false);
  const [iraContribution, setIraContribution] = useState("");
  const [iraBalance, setIraBalance] = useState(7500.00);
  const [notifications, setNotifications] = useState([
    { id: 1, type: "price", title: "MCRO is up 5%", desc: "MicroSystems Corp reached $472.50", time: "2m ago", unread: true },
    { id: 2, type: "order", title: "Order filled", desc: "Bought 1 share of MCRO at $450.00", time: "1h ago", unread: true },
    { id: 3, type: "news", title: "Breaking News", desc: "Tech stocks rally on strong earnings", time: "2h ago", unread: false },
    { id: 4, type: "alert", title: "Price alert", desc: "PEAR crossed your $180 target", time: "3h ago", unread: false },
    { id: 5, type: "dividend", title: "Dividend received", desc: "$12.50 from CHIP", time: "1d ago", unread: false },
  ]);
  const [showAllNotifications, setShowAllNotifications] = useState(false);

  // Theme state
  const [theme, setTheme] = useState<"dark" | "light">("dark");
  const [showSettingsModal, setShowSettingsModal] = useState(false);

  // Theme-aware color classes
  const themeClasses = useMemo(() => ({
    bg: theme === "dark" ? "bg-black" : "bg-white",
    bgSecondary: theme === "dark" ? "bg-gray-900" : "bg-gray-100",
    bgTertiary: theme === "dark" ? "bg-gray-800" : "bg-gray-200",
    bgHover: theme === "dark" ? "hover:bg-gray-900" : "hover:bg-gray-100",
    bgHoverSecondary: theme === "dark" ? "hover:bg-gray-800" : "hover:bg-gray-200",
    bgModal: theme === "dark" ? "bg-gray-900" : "bg-white",
    bgOverlay: theme === "dark" ? "bg-black/80" : "bg-black/50",
    bgCard: theme === "dark" ? "bg-gray-900" : "bg-gray-50",
    bgInput: theme === "dark" ? "bg-gray-800" : "bg-gray-100",
    text: theme === "dark" ? "text-white" : "text-gray-900",
    textSecondary: theme === "dark" ? "text-gray-400" : "text-gray-600",
    textMuted: theme === "dark" ? "text-gray-500" : "text-gray-500",
    border: theme === "dark" ? "border-gray-800" : "border-gray-200",
    borderSecondary: theme === "dark" ? "border-gray-700" : "border-gray-300",
    navActive: theme === "dark" ? "text-white" : "text-gray-900",
    navInactive: theme === "dark" ? "text-gray-500" : "text-gray-400",
    chartLine: theme === "dark" ? "#4B5563" : "#9CA3AF",
    chartText: theme === "dark" ? "#6B7280" : "#6B7280",
  }), [theme]);

  // Toast helper
  const showToast = useCallback((message: string) => {
    setToast(message);
    setTimeout(() => setToast(null), 2500);
  }, []);

  // Handlers
  const handleSelectStock = useCallback((stock: {
    symbol: string;
    name: string;
    price: number;
    change: number;
    changePercent: number;
    color: string;
    shares?: number;
    avgCost?: number;
  }) => {
    setSelectedStock(stock);
    setShowSearchModal(false);
    setSearchQuery("");
    showToast(`Viewing ${stock.symbol}`);
  }, [showToast]);

  const handleToggleWatchlist = useCallback((symbol: string) => {
    const existing = watchlistItems.find(item => item.symbol === symbol);
    const isCurrentlyInWatchlist = existing?.inWatchlist ?? false;
    apiToggleWatchlist(symbol);
    showToast(isCurrentlyInWatchlist ? `Removed ${symbol} from watchlist` : `Added ${symbol} to watchlist`);
  }, [watchlistItems, showToast, apiToggleWatchlist]);

  const isInWatchlist = useCallback((symbol: string) => {
    const item = watchlistItems.find(w => w.symbol === symbol);
    return item?.inWatchlist ?? false;
  }, [watchlistItems]);

  const handlePlaceOrder = useCallback((type: "buy" | "sell") => {
    setOrderType(type);
    setShowOrderModal(true);
    setOrderQuantity("1");
    setOrderStep("quantity");
    setOrderTypeSelection("market");
    setLimitPrice("");
  }, []);

  const handleConfirmOrder = useCallback(async () => {
    const qty = parseInt(orderQuantity) || 1;
    const tradingSymbol = selectedStock?.symbol || "MCRO";
    const effectivePrice = orderTypeSelection === "limit" && limitPrice ? parseFloat(limitPrice) : currentPrice;
    const orderCost = effectivePrice * qty;

    if (!orderType) return;

    const result = await placeOrder(
      tradingSymbol,
      orderType,
      qty,
      orderTypeSelection,
      orderTypeSelection === "limit" && limitPrice ? parseFloat(limitPrice) : undefined,
    );

    if (!result.success) {
      showToast(result.error || "Order failed");
      return;
    }

    // Update local transaction log (cosmetic)
    setTransactions(prev => [{
      merchant: `${orderType === "buy" ? "Buy" : "Sell"} ${qty} ${tradingSymbol} @ ${formatCurrency(effectivePrice)}`,
      amount: orderType === "buy" ? -orderCost : orderCost,
      date: "Just now",
      type: "order" as const,
    }, ...prev]);
    showToast(`${orderType === "buy" ? "Bought" : "Sold"} ${qty} share${qty > 1 ? "s" : ""} of ${tradingSymbol}`);

    setHasPlacedOrder(true);
    setShowOrderModal(false);
  }, [orderType, orderQuantity, currentPrice, selectedStock, showToast, orderTypeSelection, limitPrice, placeOrder]);

  const handleTimeframeChange = useCallback((tf: string) => {
    setSelectedTimeframe(tf);
    const newHistory = priceHistoryByTimeframe[tf];
    if (newHistory) {
      // Keep last point as current price for continuity
      const updatedHistory = [...newHistory.slice(0, -1), currentPrice];
      setPriceHistory(updatedHistory);
    }
  }, [priceHistoryByTimeframe, currentPrice]);

  const _handleComingSoon = useCallback((feature: string) => {
    showToast(`${feature} coming soon!`);
  }, [showToast]);
  void _handleComingSoon; // Mark as intentionally unused for now

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: "USD",
      minimumFractionDigits: 2,
    }).format(value);
  };

  const formatChange = (value: number, percent: number) => {
    const sign = value >= 0 ? "+" : "";
    return `${sign}${formatCurrency(value)} (${sign}${percent.toFixed(2)}%)`;
  };

  // Chart rendering
  const renderChart = () => {
    const width = 600;
    const height = 200;
    const padding = { top: 20, right: 20, bottom: 30, left: 20 };
    const chartWidth = width - padding.left - padding.right;
    const chartHeight = height - padding.top - padding.bottom;

    const minPrice = Math.min(...priceHistory) - 5;
    const maxPrice = Math.max(...priceHistory) + 5;
    const priceRange = maxPrice - minPrice;

    const points = priceHistory.map((price, i) => {
      const x = padding.left + (i / (priceHistory.length - 1)) * chartWidth;
      const y = padding.top + chartHeight - ((price - minPrice) / priceRange) * chartHeight;
      return `${x},${y}`;
    }).join(" ");

    const areaPoints = `${padding.left},${padding.top + chartHeight} ${points} ${padding.left + chartWidth},${padding.top + chartHeight}`;
    const isPositive = currentPrice >= startingPrice;
    const lineColor = isPositive ? "#00C805" : "#FF5000";

    // Previous close line position
    const prevCloseY = padding.top + chartHeight - ((startingPrice - minPrice) / priceRange) * chartHeight;

    return (
      <svg width="100%" height={height} viewBox={`0 0 ${width} ${height}`} preserveAspectRatio="xMidYMid meet">
        <defs>
          <linearGradient id="chartGradient" x1="0%" y1="0%" x2="0%" y2="100%">
            <stop offset="0%" stopColor={lineColor} stopOpacity="0.3" />
            <stop offset="100%" stopColor={lineColor} stopOpacity="0" />
          </linearGradient>
        </defs>

        {/* Previous day close dotted line */}
        <line
          x1={padding.left}
          y1={prevCloseY}
          x2={padding.left + chartWidth}
          y2={prevCloseY}
          stroke={themeClasses.chartLine}
          strokeWidth="1"
          strokeDasharray="4 4"
        />
        <text
          x={padding.left + chartWidth + 5}
          y={prevCloseY + 4}
          fill={themeClasses.chartText}
          fontSize="10"
          fontFamily="sans-serif"
        >
          {formatCurrency(startingPrice)}
        </text>

        <polygon points={areaPoints} fill="url(#chartGradient)" />
        <polyline
          points={points}
          fill="none"
          stroke={lineColor}
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        {/* Current price dot with pulse animation */}
        <circle
          cx={padding.left + chartWidth}
          cy={padding.top + chartHeight - ((currentPrice - minPrice) / priceRange) * chartHeight}
          r="6"
          fill={lineColor}
          opacity="0.3"
        >
          <animate attributeName="r" values="6;10;6" dur="2s" repeatCount="indefinite" />
          <animate attributeName="opacity" values="0.3;0.1;0.3" dur="2s" repeatCount="indefinite" />
        </circle>
        <circle
          cx={padding.left + chartWidth}
          cy={padding.top + chartHeight - ((currentPrice - minPrice) / priceRange) * chartHeight}
          r="4"
          fill={lineColor}
        />
      </svg>
    );
  };

  const timeframes = ["1D", "1W", "1M", "3M", "YTD", "1Y", "ALL"];

  // ---------------------------------------------------------------------------
  // Loading Gate
  // ---------------------------------------------------------------------------
  if (!config || isLoading) {
    const isNetworkError = error && /failed to fetch|networkerror/i.test(error);
    const isNoSession = error && /409/.test(error);
    const isMismatch = error && /environment mismatch/i.test(error);
    return (
      <div className="flex items-center justify-center h-screen bg-gray-900">
        <div className="text-center max-w-md px-6">
          <div className="text-4xl mb-3">📈</div>
          <h1 className="text-xl font-semibold mb-6 text-white">MicroHood</h1>
          {!error ? (
            <>
              <div className="w-8 h-8 border-2 border-green-500 border-t-transparent rounded-full animate-spin mx-auto mb-4" />
              <p className="text-sm text-gray-400">Connecting to MicroHood...</p>
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
              <p className="text-sm text-gray-400">Navigate to the correct environment from the desktop, or re-init with a MicroHood scenario.</p>
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
    <div className={`min-h-screen ${themeClasses.bg} ${themeClasses.text} transition-colors duration-300`} style={{ fontFamily: "'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif" }}>
      {/* Header */}
      <header className={`border-b ${themeClasses.border} sticky top-0 ${themeClasses.bg} z-40 transition-colors duration-300`}>
        <div className="max-w-7xl mx-auto px-4 py-3">
          <div className="flex items-center justify-between">
            {/* Logo */}
            <div className="flex items-center gap-8">
              <div className="flex items-center gap-2">
                <img src="desktop/microhood-icon.png" alt="MicroHood" className="w-8 h-8 object-contain" />
                <span className="text-xl font-bold text-white">MicroHood</span>
              </div>

              {/* Navigation */}
              <nav className="hidden md:flex items-center gap-6 text-sm">
                <button
                  onClick={() => setActiveNavSection("investing")}
                  className={`${activeNavSection === "investing" ? `${themeClasses.navActive} font-medium` : themeClasses.textSecondary} hover:text-[#00C805] transition-colors`}
                >
                  Investing
                </button>
                <button
                  onClick={() => setActiveNavSection("crypto")}
                  className={`${activeNavSection === "crypto" ? `${themeClasses.navActive} font-medium` : themeClasses.textSecondary} hover:text-[#00C805] transition-colors`}
                >
                  Crypto
                </button>
                <button
                  onClick={() => setActiveNavSection("spending")}
                  className={`${activeNavSection === "spending" ? `${themeClasses.navActive} font-medium` : themeClasses.textSecondary} hover:text-[#00C805] transition-colors`}
                >
                  Spending
                </button>
                <button
                  onClick={() => setActiveNavSection("retirement")}
                  className={`${activeNavSection === "retirement" ? `${themeClasses.navActive} font-medium` : themeClasses.textSecondary} hover:text-[#00C805] transition-colors`}
                >
                  Retirement
                </button>
                <button
                  onClick={() => setShowNotificationsPanel(!showNotificationsPanel)}
                  className={`${themeClasses.textSecondary} hover:text-[#00C805] transition-colors`}
                >
                  Notifications
                </button>
              </nav>
            </div>

            {/* Right side */}
            <div className="flex items-center gap-4">
              <button
                onClick={() => setShowSearchModal(true)}
                className={`hidden md:flex items-center gap-2 ${themeClasses.bgSecondary} rounded-full px-4 py-2 ${themeClasses.bgHoverSecondary} transition-colors`}
              >
                <Search size={16} className={themeClasses.textSecondary} />
                <span className={`text-sm ${themeClasses.textMuted} w-48 text-left`}>Search</span>
              </button>
              <button
                onClick={() => setShowNotificationsPanel(!showNotificationsPanel)}
                className={`p-2 ${themeClasses.bgHoverSecondary} rounded-full transition-colors relative ${showNotificationsPanel ? themeClasses.bgTertiary : ""}`}
              >
                <Bell size={20} className={themeClasses.textSecondary} />
                <span className="absolute top-1 right-1 w-2 h-2 bg-[#00C805] rounded-full" />
              </button>
              <button
                onClick={() => setShowSettingsModal(true)}
                className={`p-2 ${themeClasses.bgHoverSecondary} rounded-full transition-colors ${showSettingsModal ? themeClasses.bgTertiary : ""}`}
              >
                <Settings size={20} className={themeClasses.textSecondary} />
              </button>
              <button
                onClick={() => setIsSignedOut(true)}
                className="hidden md:block px-4 py-2 text-sm font-medium text-[#00C805] hover:bg-[#00C805]/10 rounded-full transition-colors"
              >
                Log Out
              </button>
              <button className="md:hidden p-2" onClick={() => setMobileMenuOpen(!mobileMenuOpen)}>
                {mobileMenuOpen ? <X size={24} /> : <Menu size={24} />}
              </button>
            </div>
          </div>
        </div>
      </header>

      {/* Mobile Menu */}
      {mobileMenuOpen && (
        <div className={`md:hidden fixed inset-0 ${themeClasses.bg} z-50 pt-16`}>
          <div className="p-4 space-y-4">
            <button
              onClick={() => { setActiveNavSection("investing"); setMobileMenuOpen(false); }}
              className={`w-full text-left py-3 text-lg border-b ${themeClasses.border} ${activeNavSection === "investing" ? `font-medium ${themeClasses.navActive}` : themeClasses.textSecondary}`}
            >
              Investing
            </button>
            <button
              onClick={() => { setActiveNavSection("crypto"); setMobileMenuOpen(false); }}
              className={`w-full text-left py-3 text-lg border-b ${themeClasses.border} ${activeNavSection === "crypto" ? `font-medium ${themeClasses.navActive}` : themeClasses.textSecondary}`}
            >
              Crypto
            </button>
            <button
              onClick={() => { setActiveNavSection("spending"); setMobileMenuOpen(false); }}
              className={`w-full text-left py-3 text-lg border-b ${themeClasses.border} ${activeNavSection === "spending" ? `font-medium ${themeClasses.navActive}` : themeClasses.textSecondary}`}
            >
              Spending
            </button>
            <button
              onClick={() => { setActiveNavSection("retirement"); setMobileMenuOpen(false); }}
              className={`w-full text-left py-3 text-lg border-b ${themeClasses.border} ${activeNavSection === "retirement" ? `font-medium ${themeClasses.navActive}` : themeClasses.textSecondary}`}
            >
              Retirement
            </button>
            <button
              onClick={() => { setShowSettingsModal(true); setMobileMenuOpen(false); }}
              className={`w-full text-left py-3 text-lg border-b ${themeClasses.border} ${themeClasses.textSecondary} flex items-center gap-2`}
            >
              <Settings size={20} /> Settings
            </button>
            <button
              onClick={() => { setIsSignedOut(true); setMobileMenuOpen(false); }}
              className="w-full py-3 mt-4 bg-[#00C805] text-black font-bold rounded-full"
            >
              Log Out
            </button>
          </div>
        </div>
      )}

      <main className="max-w-7xl mx-auto px-4 py-6">
        {/* Section Content Based on Nav */}
        {activeNavSection === "crypto" && (
          <div className="space-y-6 mb-8">
            <h1 className="text-3xl font-bold">Crypto</h1>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {[
                { symbol: "BTC", name: "Bitcoin", price: 43250.00, change: 2.34, color: "#F7931A" },
                { symbol: "ETH", name: "Ethereum", price: 2280.50, change: -1.23, color: "#627EEA" },
                { symbol: "SOL", name: "Solana", price: 98.75, change: 5.67, color: "#00FFA3" },
                { symbol: "DOGE", name: "Dogecoin", price: 0.085, change: 0.45, color: "#C2A633" },
                { symbol: "ADA", name: "Cardano", price: 0.52, change: -0.89, color: "#0033AD" },
                { symbol: "DOT", name: "Polkadot", price: 7.23, change: 1.12, color: "#E6007A" },
              ].map(crypto => (
                <button
                  key={crypto.symbol}
                  onClick={() => {
                    handleSelectStock({
                      symbol: crypto.symbol,
                      name: crypto.name,
                      price: crypto.price,
                      change: crypto.price * (crypto.change / 100),
                      changePercent: crypto.change,
                      color: crypto.color,
                    });
                    setActiveNavSection("investing");
                  }}
                  className={`${themeClasses.bgSecondary} rounded-xl p-4 text-left ${themeClasses.bgHoverSecondary} transition-colors group`}
                >
                  <div className="flex items-center gap-3 mb-3">
                    <div className="w-10 h-10 rounded-full flex items-center justify-center text-white font-bold" style={{ backgroundColor: crypto.color }}>
                      {crypto.symbol[0]}
                    </div>
                    <div>
                      <p className="font-medium">{crypto.symbol}</p>
                      <p className={`text-sm ${themeClasses.textMuted}`}>{crypto.name}</p>
                    </div>
                    <ChevronRight size={16} className={`${themeClasses.textMuted} ml-auto opacity-0 group-hover:opacity-100 transition-opacity`} />
                  </div>
                  <p className="text-xl font-bold">{formatCurrency(crypto.price)}</p>
                  <p className={`text-sm ${crypto.change >= 0 ? "text-[#00C805]" : "text-[#FF5000]"}`}>
                    {crypto.change >= 0 ? "+" : ""}{crypto.change.toFixed(2)}%
                  </p>
                </button>
              ))}
            </div>
            <p className={`${themeClasses.textMuted} text-sm text-center`}>Crypto trading available 24/7</p>
          </div>
        )}

        {activeNavSection === "spending" && (
          <div className="space-y-6 mb-8">
            <h1 className="text-3xl font-bold">Spending</h1>
            <div className={`${themeClasses.bgSecondary} rounded-xl p-6`}>
              <div className="flex items-center justify-between mb-6">
                <div>
                  <p className={`${themeClasses.textSecondary} text-sm`}>Available to spend</p>
                  <p className="text-3xl font-bold mt-1">{formatCurrency(buyingPower * 0.6)}</p>
                </div>
                <div className="w-12 h-12 rounded-full bg-[#00C805]/20 flex items-center justify-center">
                  <CreditCard size={24} className="text-[#00C805]" />
                </div>
              </div>
              <div className="space-y-4">
                <h3 className={`font-medium ${themeClasses.textSecondary}`}>Recent Transactions</h3>
                {transactions.map((tx, i) => (
                  <div key={i} className={`flex items-center justify-between py-2 ${tx.type === "order" ? `${themeClasses.bgTertiary}/50 -mx-2 px-2 rounded-lg` : ""}`}>
                    <div className="flex items-center gap-3">
                      {tx.type === "order" && (
                        <div className="w-8 h-8 rounded-full bg-[#00C805]/20 flex items-center justify-center">
                          <BarChart3 size={14} className="text-[#00C805]" />
                        </div>
                      )}
                      <div>
                        <p className="font-medium">{tx.merchant}</p>
                        <p className={`text-sm ${themeClasses.textMuted}`}>{tx.date}</p>
                      </div>
                    </div>
                    <p className={`font-medium ${tx.amount >= 0 ? "text-[#00C805]" : themeClasses.text}`}>
                      {tx.amount >= 0 ? "+" : ""}{formatCurrency(Math.abs(tx.amount))}
                    </p>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {activeNavSection === "retirement" && (
          <div className="space-y-6 mb-8">
            <h1 className="text-3xl font-bold">Retirement</h1>
            <div className={`${themeClasses.bgSecondary} rounded-xl p-6`}>
              <div className="flex items-center justify-between mb-6">
                <div>
                  <p className={`${themeClasses.textSecondary} text-sm`}>IRA Balance</p>
                  <p className="text-3xl font-bold mt-1">{formatCurrency(iraBalance)}</p>
                </div>
                <div className="text-right">
                  <p className="text-[#00C805] text-lg font-medium">+12.4%</p>
                  <p className={`${themeClasses.textMuted} text-sm`}>This year</p>
                </div>
              </div>
              <div className={`h-2 ${themeClasses.bgTertiary} rounded-full overflow-hidden mb-6`}>
                <div className="h-full bg-[#00C805] rounded-full" style={{ width: `${Math.min((iraBalance / 50000) * 100, 100)}%` }} />
              </div>
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div className={`${themeClasses.bgTertiary} rounded-lg p-4`}>
                  <p className={themeClasses.textSecondary}>Contribution Limit</p>
                  <p className="text-xl font-bold mt-1">$7,000</p>
                  <p className={`${themeClasses.textMuted} mt-1`}>{formatCurrency(Math.min(iraBalance * 0.3, 7000))} contributed</p>
                </div>
                <div className={`${themeClasses.bgTertiary} rounded-lg p-4`}>
                  <p className={themeClasses.textSecondary}>Projected at 65</p>
                  <p className="text-xl font-bold mt-1">{formatCurrency(iraBalance * 50)}</p>
                  <p className={`${themeClasses.textMuted} mt-1`}>Based on 7% return</p>
                </div>
              </div>
            </div>
            <button
              onClick={() => setShowIRAModal(true)}
              className="w-full py-3 bg-[#00C805] text-black font-bold rounded-full hover:bg-[#00B504]"
            >
              Contribute to IRA
            </button>
          </div>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Main Content */}
          <div className="lg:col-span-2 space-y-6">
            {/* Portfolio Value */}
            <div>
              <div className="flex items-baseline gap-3">
                <h1 className="text-4xl md:text-5xl font-bold tracking-tight">
                  {formatCurrency(portfolioValue)}
                </h1>
              </div>
              <div className={`flex items-center gap-2 mt-2 text-lg ${portfolioChange >= 0 ? "text-[#00C805]" : "text-[#FF5000]"}`}>
                {portfolioChange >= 0 ? <ArrowUpRight size={20} /> : <ArrowDownRight size={20} />}
                <span className="font-medium">{formatChange(portfolioChange, portfolioChangePercent)}</span>
                <span className="text-gray-500">Today</span>
              </div>
            </div>

            {/* Chart */}
            <div className={`${themeClasses.bg} rounded-lg`}>
              <div className="h-52 md:h-64">
                {renderChart()}
              </div>
              {/* Timeframe selector */}
              <div className="flex gap-2 mt-4 overflow-x-auto pb-2">
                {timeframes.map((tf) => (
                  <button
                    key={tf}
                    onClick={() => handleTimeframeChange(tf)}
                    className={`px-4 py-2 text-sm font-medium rounded-full whitespace-nowrap transition-colors ${
                      selectedTimeframe === tf
                        ? "bg-[#00C805] text-black"
                        : "text-gray-400 hover:text-white hover:bg-gray-800"
                    }`}
                  >
                    {tf}
                  </button>
                ))}
              </div>
            </div>

            {/* Quick Actions */}
            <div className="grid grid-cols-4 gap-3">
              <button
                onClick={() => handlePlaceOrder("buy")}
                className={`flex flex-col items-center gap-2 p-4 ${themeClasses.bgSecondary} rounded-xl ${themeClasses.bgHoverSecondary} transition-colors`}
              >
                <TrendingUp size={24} className="text-[#00C805]" />
                <span className={`text-sm ${themeClasses.textSecondary}`}>Invest</span>
              </button>
              <button
                onClick={() => setShowTransferModal(true)}
                className={`flex flex-col items-center gap-2 p-4 ${themeClasses.bgSecondary} rounded-xl ${themeClasses.bgHoverSecondary} transition-colors`}
              >
                <Repeat size={24} className={themeClasses.textSecondary} />
                <span className={`text-sm ${themeClasses.textSecondary}`}>Transfer</span>
              </button>
              <button
                onClick={() => setShowRewardsModal(true)}
                className={`flex flex-col items-center gap-2 p-4 ${themeClasses.bgSecondary} rounded-xl ${themeClasses.bgHoverSecondary} transition-colors`}
              >
                <Gift size={24} className={themeClasses.textSecondary} />
                <span className={`text-sm ${themeClasses.textSecondary}`}>Rewards</span>
              </button>
              <button
                onClick={() => setShowCardModal(true)}
                className={`flex flex-col items-center gap-2 p-4 ${themeClasses.bgSecondary} rounded-xl ${themeClasses.bgHoverSecondary} transition-colors`}
              >
                <CreditCard size={24} className={themeClasses.textSecondary} />
                <span className={`text-sm ${themeClasses.textSecondary}`}>Card</span>
              </button>
            </div>

            {/* Buying Power */}
            <button
              onClick={() => setBuyingPowerExpanded(!buyingPowerExpanded)}
              className={`w-full ${themeClasses.bgSecondary} rounded-xl p-5 text-left ${themeClasses.bgHoverSecondary} transition-colors`}
            >
              <div className="flex items-center justify-between">
                <div>
                  <p className={`${themeClasses.textSecondary} text-sm`}>Buying Power</p>
                  <p className={`text-2xl font-bold mt-1 ${themeClasses.text}`}>{formatCurrency(buyingPower)}</p>
                </div>
                <ChevronDown size={24} className={`${themeClasses.textMuted} transition-transform ${buyingPowerExpanded ? "rotate-180" : ""}`} />
              </div>
              {buyingPowerExpanded && (
                <div className={`mt-4 pt-4 border-t ${themeClasses.border} space-y-3`}>
                  <div className="flex justify-between text-sm">
                    <span className={themeClasses.textSecondary}>Cash</span>
                    <span className={themeClasses.text}>{formatCurrency(buyingPower * 0.6)}</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className={themeClasses.textSecondary}>Margin Available</span>
                    <span className={themeClasses.text}>{formatCurrency(buyingPower * 0.4)}</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className={themeClasses.textSecondary}>Pending Deposits</span>
                    <span className={themeClasses.text}>$0.00</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className={themeClasses.textSecondary}>Withdrawable Cash</span>
                    <span className={themeClasses.text}>{formatCurrency(buyingPower * 0.5)}</span>
                  </div>
                </div>
              )}
            </button>

            {/* Positions */}
            <div>
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-xl font-bold">Stocks</h2>
                <button
                  onClick={() => setShowAllStocks(!showAllStocks)}
                  className="text-[#00C805] text-sm font-medium hover:underline"
                >
                  {showAllStocks ? "Show Less" : "Show More"}
                </button>
              </div>
              <div className="space-y-1">
                {/* Show only stocks user owns, with dynamic prices */}
                {(showAllStocks
                  ? allStocksWithCurrentPrices.filter(s => s.shares > 0)
                  : allStocksWithCurrentPrices.filter(s => s.shares > 0).slice(0, 3)
                ).map((stock) => {
                  const value = stock.shares * stock.currentPrice;
                  const gain = (stock.currentPrice - stock.avgCost) * stock.shares;
                  const gainPercent = stock.avgCost > 0 ? ((stock.currentPrice - stock.avgCost) / stock.avgCost) * 100 : 0;
                  const isPositive = gain >= 0;

                  return (
                    <button
                      key={stock.symbol}
                      onClick={() => {
                        setSelectedStock({
                          symbol: stock.symbol,
                          name: stock.name,
                          price: stock.currentPrice,
                          change: stock.change,
                          changePercent: stock.changePercent,
                          color: stock.color,
                          shares: stock.shares,
                          avgCost: stock.avgCost,
                        });
                        handlePlaceOrder("buy");
                      }}
                      className="w-full flex items-center justify-between p-4 hover:bg-gray-900 rounded-xl transition-colors group"
                    >
                      <div className="flex items-center gap-4">
                        <div
                          className="w-10 h-10 rounded-full flex items-center justify-center text-white font-bold text-sm"
                          style={{ backgroundColor: stock.color }}
                        >
                          {stock.symbol.charAt(0)}
                        </div>
                        <div className="text-left">
                          <p className="font-medium">{stock.symbol}</p>
                          <p className="text-sm text-gray-500">{stock.shares} shares</p>
                        </div>
                      </div>
                      <div className="text-right">
                        <p className="font-medium">{formatCurrency(value)}</p>
                        <p className={`text-sm ${isPositive ? "text-[#00C805]" : "text-[#FF5000]"}`}>
                          {isPositive ? "+" : ""}{gainPercent.toFixed(2)}%
                        </p>
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>
          </div>

          {/* Sidebar */}
          <div className="space-y-6">
            {/* Featured Stock */}
            <div className={`${themeClasses.bgSecondary} rounded-xl overflow-hidden`}>
              <div className="p-5">
                <div className="flex items-center justify-between mb-4">
                  <div className="flex items-center gap-3">
                    <div
                      className="w-12 h-12 rounded-full flex items-center justify-center"
                      style={{ backgroundColor: selectedStock?.color || "#00A4EF" }}
                    >
                      <span className="text-white font-bold text-lg">
                        {selectedStock?.symbol?.[0] || "M"}
                      </span>
                    </div>
                    <div>
                      <p className="font-bold text-lg">{selectedStock?.symbol || "MCRO"}</p>
                      <p className={`text-sm ${themeClasses.textSecondary}`}>{selectedStock?.name || "MicroSystems Corp"}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    {/* Watchlist Toggle Button */}
                    <button
                      onClick={() => {
                        handleToggleWatchlist(selectedStock?.symbol || "MCRO");
                      }}
                      className={`p-2 rounded-full transition-all ${
                        isInWatchlist(selectedStock?.symbol || "MCRO")
                          ? "bg-[#00C805]/20 text-[#00C805]"
                          : `${themeClasses.bgHoverSecondary} ${themeClasses.textMuted}`
                      }`}
                      title={isInWatchlist(selectedStock?.symbol || "MCRO") ? "Remove from watchlist" : "Add to watchlist"}
                    >
                      <Star
                        size={20}
                        fill={isInWatchlist(selectedStock?.symbol || "MCRO") ? "#00C805" : "none"}
                      />
                    </button>
                    <div className="relative">
                      <button
                        onClick={() => setShowMoreOptionsDropdown(!showMoreOptionsDropdown)}
                        className={`p-2 ${themeClasses.bgHoverSecondary} rounded-full ${showMoreOptionsDropdown ? themeClasses.bgTertiary : ""}`}
                      >
                        <MoreHorizontal size={20} className={themeClasses.textMuted} />
                      </button>
                      {showMoreOptionsDropdown && (
                        <div className={`absolute right-0 top-full mt-2 w-48 ${themeClasses.bgTertiary} rounded-xl shadow-xl border ${themeClasses.borderSecondary} overflow-hidden z-50`}>
                          <button
                            onClick={() => {
                              handleToggleWatchlist(selectedStock?.symbol || "MCRO");
                              setShowMoreOptionsDropdown(false);
                            }}
                            className={`w-full flex items-center gap-3 px-4 py-3 ${themeClasses.bgHover} text-left`}
                          >
                            <Plus size={16} className={themeClasses.textSecondary} />
                            <span className="text-sm">Add to list</span>
                          </button>
                          <button
                            onClick={() => {
                              const symbol = selectedStock?.symbol || "MCRO";
                              showToast(`Price alert set for ${symbol}`);
                              setShowMoreOptionsDropdown(false);
                            }}
                            className={`w-full flex items-center gap-3 px-4 py-3 ${themeClasses.bgHover} text-left`}
                          >
                            <Bell size={16} className={themeClasses.textSecondary} />
                            <span className="text-sm">Set price alert</span>
                          </button>
                          <button
                            onClick={() => {
                              const symbol = selectedStock?.symbol || "MCRO";
                              navigator.clipboard.writeText(`https://microhood.app/stock/${symbol}`);
                              showToast("Link copied to clipboard!");
                              setShowMoreOptionsDropdown(false);
                            }}
                            className={`w-full flex items-center gap-3 px-4 py-3 ${themeClasses.bgHover} text-left`}
                          >
                            <Share2 size={16} className={themeClasses.textSecondary} />
                            <span className="text-sm">Share</span>
                          </button>
                          <button
                            onClick={() => {
                              showToast("Stock hidden from feed");
                              setShowMoreOptionsDropdown(false);
                            }}
                            className={`w-full flex items-center gap-3 px-4 py-3 ${themeClasses.bgHover} text-left border-t ${themeClasses.borderSecondary}`}
                          >
                            <EyeOff size={16} className="text-gray-400" />
                            <span className="text-sm">Hide</span>
                          </button>
                        </div>
                      )}
                    </div>
                  </div>
                </div>

                <div className="flex items-baseline gap-2 mb-1">
                  <span className="text-3xl font-bold">
                    {formatCurrency(selectedStock?.price || currentPrice)}
                  </span>
                </div>
                <div className={`flex items-center gap-1 ${
                  (selectedStock?.change ?? priceChange) >= 0 ? "text-[#00C805]" : "text-[#FF5000]"
                }`}>
                  {(selectedStock?.change ?? priceChange) >= 0 ? <TrendingUp size={16} /> : <TrendingDown size={16} />}
                  <span className="font-medium">
                    {formatChange(
                      selectedStock?.change ?? priceChange,
                      selectedStock?.changePercent ?? priceChangePercent
                    )}
                  </span>
                </div>

                <div className="grid grid-cols-2 gap-3 mt-5">
                  <button
                    onClick={() => handlePlaceOrder("buy")}
                    disabled={hasPlacedOrder || !!selectedStock}
                    className={`py-3 rounded-full font-bold text-sm transition-all ${
                      hasPlacedOrder || selectedStock
                        ? "bg-gray-700 text-gray-500 cursor-not-allowed"
                        : "bg-[#00C805] text-black hover:bg-[#00B504] active:scale-[0.98]"
                    }`}
                  >
                    {hasPlacedOrder && orderType === "buy" ? "Bought" : "Buy"}
                  </button>
                  <button
                    onClick={() => handlePlaceOrder("sell")}
                    disabled={hasPlacedOrder || !!selectedStock}
                    className={`py-3 rounded-full font-bold text-sm transition-all ${
                      hasPlacedOrder || selectedStock
                        ? "bg-gray-700 text-gray-500 cursor-not-allowed"
                        : "bg-gray-800 text-white hover:bg-gray-700 active:scale-[0.98]"
                    }`}
                  >
                    {hasPlacedOrder && orderType === "sell" ? "Sold" : "Sell"}
                  </button>
                </div>
                {selectedStock && (
                  <button
                    onClick={() => setSelectedStock(null)}
                    className="w-full mt-3 py-2 text-sm text-[#00C805] hover:underline"
                  >
                    ← Back to MCRO
                  </button>
                )}
              </div>

              {/* Your Position */}
              <div className="border-t border-gray-800 p-5">
                <h4 className="text-sm font-medium text-gray-400 mb-3">Your Position</h4>
                <div className="grid grid-cols-2 gap-4 text-sm">
                  <div>
                    <p className="text-gray-500">Shares</p>
                    <p className="font-medium">{selectedStock?.shares ?? ownedShares}</p>
                  </div>
                  <div>
                    <p className="text-gray-500">Market Value</p>
                    <p className="font-medium">
                      {formatCurrency((selectedStock?.price || currentPrice) * (selectedStock?.shares ?? ownedShares))}
                    </p>
                  </div>
                  <div>
                    <p className="text-gray-500">Avg Cost</p>
                    <p className="font-medium">{selectedStock?.avgCost ? formatCurrency(selectedStock.avgCost) : "$380.50"}</p>
                  </div>
                  <div>
                    <p className="text-gray-500">Total Return</p>
                    {(() => {
                      const avgCost = selectedStock?.avgCost || 380.50;
                      const price = selectedStock?.price || currentPrice;
                      const shares = selectedStock?.shares ?? ownedShares;
                      const returnValue = (price - avgCost) * shares;
                      const returnPercent = ((price - avgCost) / avgCost) * 100;
                      return (
                        <p className={`font-medium ${returnValue >= 0 ? "text-[#00C805]" : "text-[#FF5000]"}`}>
                          {formatCurrency(returnValue)} ({returnPercent.toFixed(2)}%)
                        </p>
                      );
                    })()}
                  </div>
                </div>
              </div>

              {/* Stats */}
              <div className="border-t border-gray-800 p-5">
                <h4 className="text-sm font-medium text-gray-400 mb-3">Stats</h4>
                <div className="grid grid-cols-2 gap-4 text-sm">
                  <div>
                    <p className="text-gray-500">Open</p>
                    <p className="font-medium">{formatCurrency(startingPrice)}</p>
                  </div>
                  <div>
                    <p className="text-gray-500">High</p>
                    <p className="font-medium">{formatCurrency(Math.max(...priceHistory))}</p>
                  </div>
                  <div>
                    <p className="text-gray-500">Low</p>
                    <p className="font-medium">{formatCurrency(Math.min(...priceHistory))}</p>
                  </div>
                  <div>
                    <p className="text-gray-500">Volume</p>
                    <p className="font-medium">23.4M</p>
                  </div>
                  <div>
                    <p className="text-gray-500">Market Cap</p>
                    <p className="font-medium">$3.12T</p>
                  </div>
                  <div>
                    <p className="text-gray-500">P/E Ratio</p>
                    <p className="font-medium">35.24</p>
                  </div>
                  <div>
                    <p className="text-gray-500">52W High</p>
                    <p className="font-medium">$468.35</p>
                  </div>
                  <div>
                    <p className="text-gray-500">52W Low</p>
                    <p className="font-medium">$309.45</p>
                  </div>
                </div>
              </div>

              {/* Analyst Ratings */}
              <div className="border-t border-gray-800 p-5">
                <h4 className="text-sm font-medium text-gray-400 mb-3">Analyst Ratings</h4>
                <div className="flex items-center gap-2 mb-3">
                  <div className="flex-1 h-2 bg-gray-800 rounded-full overflow-hidden flex">
                    <div className="bg-[#00C805] h-full" style={{ width: "72%" }} />
                    <div className="bg-gray-500 h-full" style={{ width: "20%" }} />
                    <div className="bg-[#FF5000] h-full" style={{ width: "8%" }} />
                  </div>
                </div>
                <div className="flex justify-between text-xs">
                  <span className="text-[#00C805]">72% Buy</span>
                  <span className="text-gray-400">20% Hold</span>
                  <span className="text-[#FF5000]">8% Sell</span>
                </div>
                <p className="text-xs text-gray-500 mt-2">Based on 45 analyst ratings</p>
              </div>
            </div>

            {/* Watchlist */}
            <div className={`${themeClasses.bgSecondary} rounded-xl p-5`}>
              <div className="flex items-center justify-between mb-4">
                <h3 className={`font-bold ${themeClasses.text}`}>Watchlist</h3>
                <button
                  onClick={() => setEditingWatchlist(!editingWatchlist)}
                  className="text-[#00C805] text-sm hover:underline"
                >
                  {editingWatchlist ? "Done" : "Edit"}
                </button>
              </div>
              <div className="space-y-3">
                {watchlistItems.filter(item => item.inWatchlist).map((item) => (
                  <div key={item.symbol} className="flex items-center justify-between py-2">
                    {editingWatchlist && (
                      <button
                        onClick={() => apiToggleWatchlist(item.symbol)}
                        className="mr-3 w-6 h-6 rounded-full bg-red-500/20 text-red-500 flex items-center justify-center hover:bg-red-500/30"
                      >
                        <X size={14} />
                      </button>
                    )}
                    <button
                      onClick={() => !editingWatchlist && handleSelectStock({
                        symbol: item.symbol,
                        name: item.name,
                        price: item.price,
                        change: item.change,
                        changePercent: item.changePercent,
                        color: "#6B7280", // Default gray for watchlist items
                      })}
                      className={`flex-1 flex items-center justify-between ${!editingWatchlist ? `${themeClasses.bgHoverSecondary} -mx-2 px-2 py-1 rounded-lg cursor-pointer` : ""}`}
                      disabled={editingWatchlist}
                    >
                      <div className="text-left">
                        <p className={`font-medium ${themeClasses.text}`}>{item.symbol}</p>
                        <p className={`text-xs ${themeClasses.textMuted}`}>{item.name}</p>
                      </div>
                      <div className="text-right flex items-center gap-2">
                        <div>
                          <p className={`font-medium ${themeClasses.text}`}>{formatCurrency(item.price)}</p>
                          <p className={`text-xs ${item.change >= 0 ? "text-[#00C805]" : "text-[#FF5000]"}`}>
                            {item.change >= 0 ? "+" : ""}{item.changePercent.toFixed(2)}%
                          </p>
                        </div>
                        {!editingWatchlist && <ChevronRight size={16} className={themeClasses.textMuted} />}
                      </div>
                    </button>
                  </div>
                ))}
                {watchlistItems.filter(item => item.inWatchlist).length === 0 && (
                  <p className={`${themeClasses.textMuted} text-sm text-center py-4`}>No items in watchlist</p>
                )}
              </div>
              {/* Watchlist is fully managed via API -- removed items disappear on next poll */}
            </div>

            {/* News */}
            <div className={`${themeClasses.bgSecondary} rounded-xl p-5`}>
              <h3 className={`font-bold mb-4 ${themeClasses.text}`}>News</h3>
              <div className="space-y-4">
                {news.map((item) => (
                  <div key={item.id} className={`border-b ${themeClasses.border} pb-4 last:border-0 last:pb-0`}>
                    <p className={`text-sm ${themeClasses.textSecondary} mb-1`}>{item.source} · {item.time}</p>
                    <p className={`text-sm font-medium leading-snug ${themeClasses.text}`}>{item.title}</p>
                  </div>
                ))}
              </div>
            </div>

            {/* About */}
            <div className={`${themeClasses.bgSecondary} rounded-xl p-5`}>
              <h3 className={`font-bold mb-3 ${themeClasses.text}`}>About</h3>
              <p className={`text-sm ${themeClasses.textSecondary} leading-relaxed`}>
                MicroSystems Corp develops and supports software, services, devices, and solutions worldwide.
                The company operates through Enterprise Solutions, Cloud Infrastructure, and Consumer Technology segments.
              </p>
              <div className="mt-4 grid grid-cols-2 gap-3 text-xs">
                <div>
                  <p className={themeClasses.textMuted}>Headquarters</p>
                  <p className={themeClasses.textSecondary}>Redmond, WA</p>
                </div>
                <div>
                  <p className={themeClasses.textMuted}>Employees</p>
                  <p className={themeClasses.textSecondary}>221,000</p>
                </div>
              </div>
            </div>

            {/* People Also Own */}
            <div className={`${themeClasses.bgSecondary} rounded-xl p-5`}>
              <h3 className={`font-bold mb-4 ${themeClasses.text}`}>People Also Own</h3>
              <div className="flex gap-3 overflow-x-auto pb-2">
                {[
                  { symbol: "PEAR", price: 181.50, change: 1.80 },
                  { symbol: "ALPH", price: 142.30, change: -1.01 },
                  { symbol: "CHIP", price: 495.20, change: 3.27 },
                  { symbol: "RVRS", price: 178.25, change: 1.39 },
                ].map((stock) => (
                  <div key={stock.symbol} className={`flex-shrink-0 ${themeClasses.bgTertiary} rounded-lg p-3 min-w-[100px]`}>
                    <p className={`font-medium text-sm ${themeClasses.text}`}>{stock.symbol}</p>
                    <p className={`text-xs ${themeClasses.textSecondary}`}>{formatCurrency(stock.price)}</p>
                    <p className={`text-xs mt-1 ${stock.change >= 0 ? "text-[#00C805]" : "text-[#FF5000]"}`}>
                      {stock.change >= 0 ? "+" : ""}{stock.change.toFixed(2)}%
                    </p>
                  </div>
                ))}
              </div>
            </div>

            {/* Account */}
            <div className={`${themeClasses.bgSecondary} rounded-xl p-5`}>
              <div className="flex items-center gap-3">
                {currentUser.avatarUrl ? (
                  <img
                    src={currentUser.avatarUrl}
                    alt={currentUser.name}
                    className="w-10 h-10 rounded-full object-cover"
                  />
                ) : (
                  <div className="w-10 h-10 rounded-full bg-gradient-to-br from-purple-500 to-pink-500 flex items-center justify-center">
                    <span className="text-white font-bold text-sm">
                      {currentUser.name.split(" ").map((n: string) => n[0]).join("")}
                    </span>
                  </div>
                )}
                <div>
                  <p className="font-medium">{currentUser.name}</p>
                  <p className="text-sm text-gray-500">@{currentUser.username}</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </main>

      {/* Mobile Bottom Nav */}
      <nav className={`md:hidden fixed bottom-0 left-0 right-0 ${themeClasses.bg} border-t ${themeClasses.border} px-6 py-3 z-40`}>
        <div className="flex items-center justify-around">
          {[
            { icon: Home, label: "Home", tab: "home" as const },
            { icon: Search, label: "Search", tab: "search" as const },
            { icon: BarChart3, label: "Investing", tab: "transfers" as const },
            { icon: User, label: "Profile", tab: "profile" as const },
          ].map(({ icon: Icon, label, tab }) => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={`flex flex-col items-center gap-1 ${
                activeTab === tab ? themeClasses.navActive : themeClasses.textMuted
              }`}
            >
              <Icon size={24} />
              <span className="text-xs">{label}</span>
            </button>
          ))}
        </div>
      </nav>

      {/* Order Modal - Two Step Flow */}
      {showOrderModal && (
        <div className={`fixed inset-0 ${themeClasses.bgOverlay} z-50 flex items-end md:items-center justify-center`}>
          <div className={`${themeClasses.bgModal} w-full md:w-96 md:rounded-2xl rounded-t-2xl p-6 ${theme === "light" ? "border border-gray-200" : ""}`}>
            {/* Header */}
            <div className="flex items-center justify-between mb-6">
              <div className="flex items-center gap-3">
                {orderStep === "review" && (
                  <button
                    onClick={() => setOrderStep("quantity")}
                    className={`${themeClasses.textSecondary} hover:${themeClasses.text}`}
                  >
                    <ChevronDown size={24} className="rotate-90" />
                  </button>
                )}
                <h3 className="text-xl font-bold">
                  {orderStep === "quantity"
                    ? `${orderType === "buy" ? "Buy" : "Sell"} MCRO`
                    : "Review Order"}
                </h3>
              </div>
              <button onClick={() => setShowOrderModal(false)} className={`${themeClasses.textSecondary} hover:${themeClasses.text}`}>
                <X size={24} />
              </button>
            </div>

            {/* Step 1: Quantity & Order Type */}
            {orderStep === "quantity" && (
              <div className="space-y-4">
                {/* Order Type Selector */}
                <div>
                  <label className={`text-sm ${themeClasses.textSecondary} mb-2 block`}>Order Type</label>
                  <div className="grid grid-cols-2 gap-2">
                    <button
                      onClick={() => setOrderTypeSelection("market")}
                      className={`py-3 px-4 rounded-lg text-sm font-medium transition-all ${
                        orderTypeSelection === "market"
                          ? "bg-[#00C805]/20 border-2 border-[#00C805] text-[#00C805]"
                          : `${themeClasses.bgTertiary} border-2 border-transparent ${themeClasses.textSecondary} ${themeClasses.bgHoverSecondary}`
                      }`}
                    >
                      Market Order
                    </button>
                    <button
                      onClick={() => setOrderTypeSelection("limit")}
                      className={`py-3 px-4 rounded-lg text-sm font-medium transition-all ${
                        orderTypeSelection === "limit"
                          ? "bg-[#00C805]/20 border-2 border-[#00C805] text-[#00C805]"
                          : `${themeClasses.bgTertiary} border-2 border-transparent ${themeClasses.textSecondary} ${themeClasses.bgHoverSecondary}`
                      }`}
                    >
                      Limit Order
                    </button>
                  </div>
                  <p className={`text-xs ${themeClasses.textMuted} mt-2`}>
                    {orderTypeSelection === "market"
                      ? "Execute immediately at current market price"
                      : "Set a target price for your order"}
                  </p>
                </div>

                {/* Limit Price Input (if limit order) */}
                {orderTypeSelection === "limit" && (
                  <div>
                    <label className={`text-sm ${themeClasses.textSecondary}`}>Limit Price</label>
                    <div className="relative mt-2">
                      <span className={`absolute left-4 top-1/2 -translate-y-1/2 ${themeClasses.textSecondary}`}>$</span>
                      <input
                        type="number"
                        value={limitPrice}
                        onChange={(e) => setLimitPrice(e.target.value)}
                        placeholder={currentPrice.toFixed(2)}
                        className={`w-full ${themeClasses.bgInput} border ${themeClasses.borderSecondary} rounded-lg pl-8 pr-4 py-3 text-lg font-medium focus:border-[#00C805] focus:outline-none ${themeClasses.text}`}
                        step="0.01"
                      />
                    </div>
                  </div>
                )}

                {/* Shares Input */}
                <div>
                  <label className={`text-sm ${themeClasses.textSecondary}`}>Shares</label>
                  <input
                    type="number"
                    value={orderQuantity}
                    onChange={(e) => setOrderQuantity(e.target.value)}
                    className={`w-full ${themeClasses.bgInput} border ${themeClasses.borderSecondary} rounded-lg px-4 py-3 mt-2 text-lg font-medium focus:border-[#00C805] focus:outline-none ${themeClasses.text}`}
                    min="1"
                  />
                </div>

                {/* Preview */}
                <div className={`${themeClasses.bgTertiary} rounded-lg p-4 space-y-2`}>
                  <div className="flex justify-between text-sm">
                    <span className={themeClasses.textSecondary}>
                      {orderTypeSelection === "market" ? "Market Price" : "Limit Price"}
                    </span>
                    <span>
                      {formatCurrency(orderTypeSelection === "limit" && limitPrice ? parseFloat(limitPrice) : currentPrice)}
                    </span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className={themeClasses.textSecondary}>Estimated {orderType === "buy" ? "Cost" : "Credit"}</span>
                    <span className="font-medium">
                      {formatCurrency(
                        (orderTypeSelection === "limit" && limitPrice ? parseFloat(limitPrice) : currentPrice) *
                        parseInt(orderQuantity || "0")
                      )}
                    </span>
                  </div>
                </div>

                {/* Review Button */}
                <button
                  onClick={() => setOrderStep("review")}
                  disabled={!orderQuantity || parseInt(orderQuantity) < 1}
                  className={`w-full py-4 rounded-full font-bold text-lg transition-all ${
                    !orderQuantity || parseInt(orderQuantity) < 1
                      ? `${themeClasses.bgTertiary} ${themeClasses.textMuted} cursor-not-allowed`
                      : `${themeClasses.bgTertiary} ${themeClasses.text} ${themeClasses.bgHoverSecondary}`
                  }`}
                >
                  Review Order
                </button>
              </div>
            )}

            {/* Step 2: Review & Confirm */}
            {orderStep === "review" && (
              <div className="space-y-4">
                {/* Order Summary */}
                <div className={`${themeClasses.bgTertiary} rounded-xl p-4`}>
                  <div className="flex items-center gap-3 mb-4">
                    <div className="w-10 h-10 rounded-full bg-[#00A4EF] flex items-center justify-center">
                      <span className="text-white font-bold">M</span>
                    </div>
                    <div>
                      <p className="font-bold">MCRO</p>
                      <p className={`text-xs ${themeClasses.textSecondary}`}>MicroSystems Corp</p>
                    </div>
                  </div>

                  <div className={`space-y-3 pt-3 border-t ${themeClasses.borderSecondary}`}>
                    <div className="flex justify-between text-sm">
                      <span className={themeClasses.textSecondary}>Order Type</span>
                      <span className="capitalize">{orderTypeSelection}</span>
                    </div>
                    <div className="flex justify-between text-sm">
                      <span className={themeClasses.textSecondary}>Action</span>
                      <span className={orderType === "buy" ? "text-[#00C805]" : "text-[#FF5000]"}>
                        {orderType === "buy" ? "Buy" : "Sell"}
                      </span>
                    </div>
                    <div className="flex justify-between text-sm">
                      <span className={themeClasses.textSecondary}>Shares</span>
                      <span>{orderQuantity}</span>
                    </div>
                    <div className="flex justify-between text-sm">
                      <span className={themeClasses.textSecondary}>
                        {orderTypeSelection === "market" ? "Market Price" : "Limit Price"}
                      </span>
                      <span>
                        {formatCurrency(orderTypeSelection === "limit" && limitPrice ? parseFloat(limitPrice) : currentPrice)}
                      </span>
                    </div>
                    <div className={`flex justify-between text-sm pt-2 border-t ${themeClasses.borderSecondary}`}>
                      <span className={`${themeClasses.textSecondary} font-medium`}>
                        Estimated {orderType === "buy" ? "Cost" : "Credit"}
                      </span>
                      <span className="font-bold text-lg">
                        {formatCurrency(
                          (orderTypeSelection === "limit" && limitPrice ? parseFloat(limitPrice) : currentPrice) *
                          parseInt(orderQuantity || "0")
                        )}
                      </span>
                    </div>
                  </div>
                </div>

                {/* Buying Power / Shares Available Notice */}
                <div className="text-sm text-gray-400 text-center">
                  {orderType === "buy" ? (
                    <>Buying Power: <span className="text-white">{formatCurrency(buyingPower)}</span></>
                  ) : (
                    <>Shares Available: <span className="text-white">{ownedShares}</span></>
                  )}
                </div>

                {/* Confirm Button */}
                <button
                  onClick={handleConfirmOrder}
                  className={`w-full py-4 rounded-full font-bold text-lg transition-all flex items-center justify-center gap-2 ${
                    orderType === "buy"
                      ? "bg-[#00C805] text-black hover:bg-[#00B504]"
                      : "bg-[#FF5000] text-white hover:bg-[#E04500]"
                  }`}
                >
                  <Check size={20} />
                  Confirm {orderType === "buy" ? "Purchase" : "Sale"}
                </button>

                <p className="text-xs text-gray-500 text-center">
                  By confirming, you agree to execute this {orderTypeSelection} order
                </p>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Lock Screen */}
      {isSignedOut && (
        <div className="fixed inset-0 z-50 flex items-center justify-center" style={{ backgroundColor: "rgba(0,0,0,0.5)", backdropFilter: "blur(6px)" }}>
          <div className="bg-white rounded-lg shadow-2xl p-8 w-[360px] flex flex-col items-center">
            <div className="text-2xl font-bold mb-6" style={{ color: "#00C805" }}>MicroHood</div>
            <div className="w-20 h-20 rounded-full flex items-center justify-center text-white text-2xl font-bold mb-4" style={{ backgroundColor: "#00C805" }}>
              U
            </div>
            <div className="text-lg font-semibold text-gray-900 mb-1">Investor</div>
            <div className="text-sm text-gray-500 mb-6">Portfolio Account</div>
            <input type="password" readOnly value="••••••••" className="w-full px-4 py-2 border border-gray-300 rounded mb-4 text-center text-gray-400 bg-gray-50" />
            <button onClick={() => setIsSignedOut(false)} className="w-full py-2 text-white rounded-full font-semibold hover:opacity-90 transition-opacity" style={{ backgroundColor: "#00C805" }}>
              Sign in
            </button>
          </div>
        </div>
      )}

      {/* Hints removed -- dev info in dev tools bar */}

      {/* Search Modal */}
      {showSearchModal && (
        <div className={`fixed inset-0 ${themeClasses.bgOverlay} z-50 flex items-start justify-center pt-20`}>
          <div className={`${themeClasses.bgModal} w-full max-w-2xl mx-4 rounded-2xl overflow-hidden ${theme === "light" ? "border border-gray-200" : ""}`}>
            <div className={`p-4 border-b ${themeClasses.border}`}>
              <div className="flex items-center gap-3">
                <Search size={20} className={themeClasses.textSecondary} />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Search stocks, ETFs, crypto..."
                  className={`flex-1 bg-transparent ${themeClasses.text} text-lg focus:outline-none`}
                  autoFocus
                />
                <button onClick={() => { setShowSearchModal(false); setSearchQuery(""); }} className={`${themeClasses.textSecondary} hover:${themeClasses.text}`}>
                  <X size={24} />
                </button>
              </div>
            </div>
            <div className="p-4 max-h-96 overflow-y-auto">
              {searchQuery.length === 0 ? (
                <div>
                  <p className={`${themeClasses.textMuted} text-sm mb-3`}>Popular Searches</p>
                  <div className="space-y-2">
                    {["MCRO", "PEAR", "ALPH", "VOLT", "CHIP"].map(symbol => (
                      <button key={symbol} onClick={() => setSearchQuery(symbol)} className={`w-full text-left p-3 ${themeClasses.bgHoverSecondary} rounded-lg flex items-center gap-3`}>
                        <div className={`w-8 h-8 rounded-full ${themeClasses.bgTertiary} flex items-center justify-center text-sm font-bold`}>{symbol[0]}</div>
                        <span className={themeClasses.text}>{symbol}</span>
                      </button>
                    ))}
                  </div>
                </div>
              ) : (
                <div className="space-y-2">
                  {/* Search results with dynamic prices */}
                  {allStocksWithCurrentPrices
                    .filter(s => s.symbol.toLowerCase().includes(searchQuery.toLowerCase()) || s.name.toLowerCase().includes(searchQuery.toLowerCase()))
                    .map(stock => (
                      <button
                        key={stock.symbol}
                        onClick={() => handleSelectStock({
                          symbol: stock.symbol,
                          name: stock.name,
                          price: stock.currentPrice,
                          change: stock.change,
                          changePercent: stock.changePercent,
                          color: stock.color,
                          shares: stock.shares,
                          avgCost: stock.avgCost,
                        })}
                        className={`w-full text-left p-3 ${themeClasses.bgHoverSecondary} rounded-lg flex items-center justify-between`}
                      >
                        <div className="flex items-center gap-3">
                          <div className="w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold" style={{ backgroundColor: stock.color }}>{stock.symbol[0]}</div>
                          <div>
                            <p className={`${themeClasses.text} font-medium`}>{stock.symbol}</p>
                            <p className={`${themeClasses.textMuted} text-sm`}>{stock.name}</p>
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          <p className={themeClasses.text}>{formatCurrency(stock.currentPrice)}</p>
                          <ChevronRight size={16} className={themeClasses.textMuted} />
                        </div>
                      </button>
                    ))}
                  {allStocksWithCurrentPrices.filter(s => s.symbol.toLowerCase().includes(searchQuery.toLowerCase()) || s.name.toLowerCase().includes(searchQuery.toLowerCase())).length === 0 && (
                    <p className={`${themeClasses.textMuted} text-center py-8`}>No results found for "{searchQuery}"</p>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Notifications Panel */}
      {showNotificationsPanel && !showAllNotifications && (
        <div className={`fixed top-16 right-4 w-80 ${themeClasses.bgSecondary} rounded-xl shadow-xl z-50 border ${themeClasses.border}`}>
          <div className={`p-4 border-b ${themeClasses.border} flex items-center justify-between`}>
            <h3 className="font-bold">Notifications</h3>
            <button onClick={() => setShowNotificationsPanel(false)} className={`${themeClasses.textSecondary} hover:${themeClasses.text}`}>
              <X size={20} />
            </button>
          </div>
          <div className="max-h-96 overflow-y-auto">
            {notifications.map((notif) => (
              <button
                key={notif.id}
                onClick={() => {
                  // Mark as read
                  setNotifications(prev => prev.map(n => n.id === notif.id ? { ...n, unread: false } : n));
                  // Navigate based on type
                  if (notif.type === "price" || notif.type === "alert") {
                    const symbol = notif.desc.match(/([A-Z]{3,4})/)?.[1] || "MCRO";
                    // Use dynamic prices
                    const stock = allStocksWithCurrentPrices.find(s => s.symbol === symbol);
                    if (stock) {
                      handleSelectStock({
                        symbol: stock.symbol,
                        name: stock.name,
                        price: stock.currentPrice,
                        change: stock.change,
                        changePercent: stock.changePercent,
                        color: stock.color,
                        shares: stock.shares,
                        avgCost: stock.avgCost,
                      });
                    }
                    setShowNotificationsPanel(false);
                  } else if (notif.type === "order") {
                    setActiveNavSection("spending");
                    setShowNotificationsPanel(false);
                  } else {
                    showToast("Notification viewed");
                  }
                }}
                className={`w-full text-left p-4 border-b ${themeClasses.border} last:border-0 ${themeClasses.bgHoverSecondary} transition-colors ${notif.unread ? "bg-[#00C805]/5" : ""}`}
              >
                <div className="flex items-start gap-3">
                  {notif.unread && <span className="w-2 h-2 bg-[#00C805] rounded-full mt-2 flex-shrink-0" />}
                  <div className="flex-1">
                    <p className={`text-sm font-medium ${themeClasses.text}`}>{notif.title}</p>
                    <p className={`text-xs ${themeClasses.textSecondary} mt-0.5`}>{notif.desc}</p>
                    <p className={`text-xs ${themeClasses.textMuted} mt-1`}>{notif.time}</p>
                  </div>
                  <ChevronRight size={14} className={themeClasses.textMuted} />
                </div>
              </button>
            ))}
          </div>
          <div className={`p-3 border-t ${themeClasses.border}`}>
            <button
              onClick={() => setShowAllNotifications(true)}
              className="w-full text-center text-sm text-[#00C805] hover:underline"
            >
              View all notifications
            </button>
          </div>
        </div>
      )}

      {/* Expanded Notifications Panel */}
      {showAllNotifications && (
        <div className={`fixed inset-0 ${themeClasses.bgOverlay} z-50 flex items-center justify-center`}>
          <div className={`${themeClasses.bgModal} w-full max-w-lg mx-4 rounded-2xl max-h-[80vh] overflow-hidden ${theme === "light" ? "border border-gray-200" : ""}`}>
            <div className={`p-4 border-b ${themeClasses.border} flex items-center justify-between sticky top-0 ${themeClasses.bgModal}`}>
              <h3 className="text-xl font-bold">All Notifications</h3>
              <button onClick={() => { setShowAllNotifications(false); setShowNotificationsPanel(false); }} className="text-gray-400 hover:text-white">
                <X size={24} />
              </button>
            </div>
            <div className="overflow-y-auto max-h-[60vh]">
              {notifications.map((notif) => (
                <button
                  key={notif.id}
                  onClick={() => {
                    setNotifications(prev => prev.map(n => n.id === notif.id ? { ...n, unread: false } : n));
                    if (notif.type === "price" || notif.type === "alert") {
                      const symbol = notif.desc.match(/([A-Z]{3,4})/)?.[1] || "MCRO";
                      // Use dynamic prices
                      const stock = allStocksWithCurrentPrices.find(s => s.symbol === symbol);
                      if (stock) {
                        handleSelectStock({
                          symbol: stock.symbol,
                          name: stock.name,
                          price: stock.currentPrice,
                          change: stock.change,
                          changePercent: stock.changePercent,
                          color: stock.color,
                          shares: stock.shares,
                          avgCost: stock.avgCost,
                        });
                      }
                      setShowAllNotifications(false);
                      setShowNotificationsPanel(false);
                    } else if (notif.type === "order") {
                      setActiveNavSection("spending");
                      setShowAllNotifications(false);
                      setShowNotificationsPanel(false);
                    } else {
                      showToast("Notification viewed");
                    }
                  }}
                  className={`w-full text-left p-4 border-b border-gray-800 last:border-0 hover:bg-gray-800 transition-colors ${notif.unread ? "bg-[#00C805]/5" : ""}`}
                >
                  <div className="flex items-start gap-3">
                    {notif.unread && <span className="w-2 h-2 bg-[#00C805] rounded-full mt-2 flex-shrink-0" />}
                    <div className="flex-1">
                      <p className="text-sm font-medium text-white">{notif.title}</p>
                      <p className="text-xs text-gray-400 mt-0.5">{notif.desc}</p>
                      <p className="text-xs text-gray-500 mt-1">{notif.time}</p>
                    </div>
                    <ChevronRight size={14} className="text-gray-500 mt-1" />
                  </div>
                </button>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Transfer Modal */}
      {showTransferModal && (
        <div className={`fixed inset-0 ${themeClasses.bgOverlay} z-50 flex items-end md:items-center justify-center`}>
          <div className={`${themeClasses.bgModal} w-full md:w-96 md:rounded-2xl rounded-t-2xl p-6`}>
            <div className="flex items-center justify-between mb-6">
              <div className="flex items-center gap-3">
                {transferStep !== "menu" && (
                  <button onClick={() => { setTransferStep("menu"); setTransferAmount(""); }} className={`${themeClasses.textSecondary} hover:${themeClasses.text}`}>
                    <ChevronDown size={24} className="rotate-90" />
                  </button>
                )}
                <h3 className={`text-xl font-bold ${themeClasses.text}`}>
                  {transferStep === "menu" && "Transfer"}
                  {transferStep === "to-bank" && "Withdraw to Bank"}
                  {transferStep === "from-bank" && "Deposit from Bank"}
                  {transferStep === "stocks" && "Transfer Stocks"}
                </h3>
              </div>
              <button onClick={() => { setShowTransferModal(false); setTransferStep("menu"); setTransferAmount(""); }} className={`${themeClasses.textSecondary} hover:${themeClasses.text}`}>
                <X size={24} />
              </button>
            </div>

            {transferStep === "menu" && (
              <div className="space-y-4">
                <button
                  onClick={() => setTransferStep("to-bank")}
                  className={`w-full p-4 ${themeClasses.bgSecondary} rounded-xl text-left ${themeClasses.bgHoverSecondary} transition-colors flex items-center gap-4`}
                >
                  <div className="w-10 h-10 rounded-full bg-blue-500/20 flex items-center justify-center">
                    <Building size={20} className="text-blue-400" />
                  </div>
                  <div className="flex-1">
                    <p className={`font-medium ${themeClasses.text}`}>Transfer to your bank</p>
                    <p className={`text-sm ${themeClasses.textSecondary} mt-1`}>Move money to your linked bank account</p>
                  </div>
                  <ChevronRight size={20} className={themeClasses.textMuted} />
                </button>
                <button
                  onClick={() => setTransferStep("from-bank")}
                  className={`w-full p-4 ${themeClasses.bgSecondary} rounded-xl text-left ${themeClasses.bgHoverSecondary} transition-colors flex items-center gap-4`}
                >
                  <div className="w-10 h-10 rounded-full bg-green-500/20 flex items-center justify-center">
                    <DollarSign size={20} className="text-green-400" />
                  </div>
                  <div className="flex-1">
                    <p className={`font-medium ${themeClasses.text}`}>Transfer from your bank</p>
                    <p className={`text-sm ${themeClasses.textSecondary} mt-1`}>Add money from your linked bank account</p>
                  </div>
                  <ChevronRight size={20} className={themeClasses.textMuted} />
                </button>
                <button
                  onClick={() => setTransferStep("stocks")}
                  className={`w-full p-4 ${themeClasses.bgSecondary} rounded-xl text-left ${themeClasses.bgHoverSecondary} transition-colors flex items-center gap-4`}
                >
                  <div className="w-10 h-10 rounded-full bg-purple-500/20 flex items-center justify-center">
                    <Briefcase size={20} className="text-purple-400" />
                  </div>
                  <div className="flex-1">
                    <p className={`font-medium ${themeClasses.text}`}>Transfer stocks</p>
                    <p className={`text-sm ${themeClasses.textSecondary} mt-1`}>Move stocks to or from another brokerage</p>
                  </div>
                  <ChevronRight size={20} className={themeClasses.textMuted} />
                </button>
                <p className={`text-xs ${themeClasses.textMuted} mt-4 text-center`}>Linked account: Chase ****4523</p>
              </div>
            )}

            {transferStep === "to-bank" && (
              <div className="space-y-4">
                <div className={`${themeClasses.bgSecondary} rounded-xl p-4`}>
                  <p className={`text-sm ${themeClasses.textSecondary} mb-2`}>Available to withdraw</p>
                  <p className={`text-2xl font-bold ${themeClasses.text}`}>{formatCurrency(buyingPower * 0.5)}</p>
                </div>
                <div>
                  <label className={`text-sm ${themeClasses.textSecondary}`}>Amount</label>
                  <div className="relative mt-2">
                    <span className={`absolute left-4 top-1/2 -translate-y-1/2 ${themeClasses.textSecondary} text-xl`}>$</span>
                    <input
                      type="number"
                      value={transferAmount}
                      onChange={(e) => setTransferAmount(e.target.value)}
                      placeholder="0.00"
                      className={`w-full ${themeClasses.bgInput} ${themeClasses.border} rounded-lg pl-10 pr-4 py-4 text-2xl font-medium focus:border-[#00C805] focus:outline-none ${themeClasses.text}`}
                    />
                  </div>
                </div>
                <p className={`text-xs ${themeClasses.textMuted}`}>Transfer to Chase ****4523 • 1-3 business days</p>
                <button
                  onClick={() => {
                    const amount = parseFloat(transferAmount);
                    if (amount > 0 && amount <= buyingPower * 0.5) {
                      setTransactions(prev => [{ merchant: "Withdraw to Chase ****4523", amount: -amount, date: "Just now", type: "spending" }, ...prev]);
                      showToast(`Withdrew ${formatCurrency(amount)} to your bank`);
                      setShowTransferModal(false);
                      setTransferStep("menu");
                      setTransferAmount("");
                    } else {
                      showToast("Invalid amount");
                    }
                  }}
                  disabled={!transferAmount || parseFloat(transferAmount) <= 0}
                  className={`w-full py-4 rounded-full font-bold ${
                    !transferAmount || parseFloat(transferAmount) <= 0
                      ? `${themeClasses.bgTertiary} ${themeClasses.textMuted} cursor-not-allowed`
                      : "bg-[#00C805] text-black hover:bg-[#00B504]"
                  }`}
                >
                  Withdraw
                </button>
              </div>
            )}

            {transferStep === "from-bank" && (
              <div className="space-y-4">
                <div className={`${themeClasses.bgSecondary} rounded-xl p-4`}>
                  <p className={`text-sm ${themeClasses.textSecondary} mb-2`}>Current buying power</p>
                  <p className={`text-2xl font-bold ${themeClasses.text}`}>{formatCurrency(buyingPower)}</p>
                </div>
                <div>
                  <label className={`text-sm ${themeClasses.textSecondary}`}>Amount to deposit</label>
                  <div className="relative mt-2">
                    <span className={`absolute left-4 top-1/2 -translate-y-1/2 ${themeClasses.textSecondary} text-xl`}>$</span>
                    <input
                      type="number"
                      value={transferAmount}
                      onChange={(e) => setTransferAmount(e.target.value)}
                      placeholder="0.00"
                      className={`w-full ${themeClasses.bgInput} ${themeClasses.border} rounded-lg pl-10 pr-4 py-4 text-2xl font-medium focus:border-[#00C805] focus:outline-none ${themeClasses.text}`}
                    />
                  </div>
                </div>
                <p className={`text-xs ${themeClasses.textMuted}`}>From Chase ****4523 • Instant deposit up to $1,000</p>
                <button
                  onClick={() => {
                    const amount = parseFloat(transferAmount);
                    if (amount > 0 && amount <= 10000) {
                      setTransactions(prev => [{ merchant: "Deposit from Chase ****4523", amount: amount, date: "Just now", type: "spending" }, ...prev]);
                      showToast(`Deposited ${formatCurrency(amount)} instantly`);
                      setShowTransferModal(false);
                      setTransferStep("menu");
                      setTransferAmount("");
                    } else {
                      showToast("Invalid amount (max $10,000)");
                    }
                  }}
                  disabled={!transferAmount || parseFloat(transferAmount) <= 0}
                  className={`w-full py-4 rounded-full font-bold ${
                    !transferAmount || parseFloat(transferAmount) <= 0
                      ? `${themeClasses.bgTertiary} ${themeClasses.textMuted} cursor-not-allowed`
                      : "bg-[#00C805] text-black hover:bg-[#00B504]"
                  }`}
                >
                  Deposit
                </button>
              </div>
            )}

            {transferStep === "stocks" && (
              <div className="space-y-4">
                <div className={`${themeClasses.bgSecondary} rounded-xl p-4 text-center`}>
                  <Briefcase size={32} className={`${themeClasses.textMuted} mx-auto mb-3`} />
                  <p className={`font-medium ${themeClasses.text}`}>Transfer stocks from another brokerage</p>
                  <p className={`text-sm ${themeClasses.textSecondary} mt-2`}>Move your investments to MicroHood with an ACATS transfer</p>
                </div>
                <div className="space-y-3">
                  <button className={`w-full p-4 ${themeClasses.bgSecondary} rounded-xl text-left ${themeClasses.bgHoverSecondary} transition-colors`}>
                    <p className={`font-medium ${themeClasses.text}`}>Full account transfer</p>
                    <p className={`text-sm ${themeClasses.textSecondary} mt-1`}>Move all assets from another broker</p>
                  </button>
                  <button className={`w-full p-4 ${themeClasses.bgSecondary} rounded-xl text-left ${themeClasses.bgHoverSecondary} transition-colors`}>
                    <p className={`font-medium ${themeClasses.text}`}>Partial transfer</p>
                    <p className={`text-sm ${themeClasses.textSecondary} mt-1`}>Move specific stocks</p>
                  </button>
                </div>
                <button
                  onClick={() => {
                    showToast("Stock transfer initiated - check email for next steps");
                    setShowTransferModal(false);
                    setTransferStep("menu");
                  }}
                  className="w-full py-4 bg-[#00C805] text-black rounded-full font-bold hover:bg-[#00B504]"
                >
                  Start Transfer
                </button>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Rewards Modal */}
      {showRewardsModal && (
        <div className="fixed inset-0 bg-black/80 z-50 flex items-end md:items-center justify-center">
          <div className="bg-gray-900 w-full md:w-96 md:rounded-2xl rounded-t-2xl p-6">
            <div className="flex items-center justify-between mb-6">
              <h3 className="text-xl font-bold">Rewards</h3>
              <button onClick={() => setShowRewardsModal(false)} className="text-gray-400 hover:text-white">
                <X size={24} />
              </button>
            </div>
            <div className="text-center py-6">
              <div className="w-16 h-16 rounded-full bg-[#00C805]/20 flex items-center justify-center mx-auto mb-4">
                <Gift size={32} className="text-[#00C805]" />
              </div>
              <h4 className="text-2xl font-bold mb-2">Earn Free Stocks</h4>
              <p className="text-gray-400 text-sm mb-6">Invite friends to MicroHood and you'll both get a free stock!</p>
              <button
                onClick={() => {
                  const referralCode = `MH${currentUser.username.toUpperCase().slice(0, 4)}${Math.random().toString(36).slice(2, 6).toUpperCase()}`;
                  const referralUrl = `https://microhood.app/join?ref=${referralCode}`;
                  navigator.clipboard.writeText(referralUrl);
                  showToast("Referral link copied to clipboard!");
                }}
                className="w-full py-3 bg-[#00C805] text-black font-bold rounded-full hover:bg-[#00B504] flex items-center justify-center gap-2"
              >
                <Copy size={18} />
                Invite Friends
              </button>
              <p className="text-xs text-gray-500 mt-3">Your referral link will be copied to clipboard</p>
            </div>
            <div className="border-t border-gray-800 mt-4 pt-4">
              <p className="text-sm text-gray-400 mb-2">Your referral stats</p>
              <div className="flex justify-between text-sm">
                <span className="text-gray-500">Friends invited</span>
                <span className="text-white">3</span>
              </div>
              <div className="flex justify-between text-sm mt-1">
                <span className="text-gray-500">Free stocks earned</span>
                <span className="text-[#00C805]">$45.67</span>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Card Modal */}
      {showCardModal && !showCardSettingsModal && (
        <div className="fixed inset-0 bg-black/80 z-50 flex items-end md:items-center justify-center">
          <div className="bg-gray-900 w-full md:w-96 md:rounded-2xl rounded-t-2xl p-6">
            <div className="flex items-center justify-between mb-6">
              <h3 className="text-xl font-bold">MicroHood Card</h3>
              <button onClick={() => setShowCardModal(false)} className="text-gray-400 hover:text-white">
                <X size={24} />
              </button>
            </div>
            <div className={`bg-gradient-to-br from-gray-800 to-gray-900 rounded-2xl p-6 mb-6 border ${cardFrozen ? "border-blue-500" : "border-gray-700"} relative overflow-hidden`}>
              {cardFrozen && (
                <div className="absolute inset-0 bg-blue-500/10 flex items-center justify-center">
                  <div className="bg-blue-500 text-white px-4 py-2 rounded-full text-sm font-bold flex items-center gap-2">
                    <Lock size={16} />
                    Card Frozen
                  </div>
                </div>
              )}
              <div className="flex justify-between items-start mb-8">
                <span className="text-xl font-bold text-[#00C805]">MicroHood</span>
                <CreditCard size={24} className="text-gray-500" />
              </div>
              <p className="text-gray-400 text-sm mb-1">Card Number</p>
              <p className="text-white font-mono">•••• •••• •••• 4523</p>
              <div className="flex justify-between mt-4">
                <div>
                  <p className="text-gray-400 text-xs">Valid Thru</p>
                  <p className="text-white text-sm">12/27</p>
                </div>
                <div>
                  <p className="text-gray-400 text-xs">CVV</p>
                  <p className="text-white text-sm">•••</p>
                </div>
              </div>
            </div>
            <div className="space-y-3">
              <div className="flex justify-between text-sm">
                <span className="text-gray-400">Available balance</span>
                <span className="text-white">{formatCurrency(buyingPower * 0.6)}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-gray-400">Pending transactions</span>
                <span className="text-white">$0.00</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-gray-400">Cashback earned</span>
                <span className="text-[#00C805]">$23.45</span>
              </div>
            </div>
            <button
              onClick={() => setShowCardSettingsModal(true)}
              className="w-full py-3 mt-6 bg-gray-800 text-white font-medium rounded-full hover:bg-gray-700"
            >
              Manage Card
            </button>
          </div>
        </div>
      )}

      {/* Card Settings Modal */}
      {showCardSettingsModal && (
        <div className="fixed inset-0 bg-black/80 z-50 flex items-end md:items-center justify-center">
          <div className="bg-gray-900 w-full md:w-96 md:rounded-2xl rounded-t-2xl p-6">
            <div className="flex items-center justify-between mb-6">
              <div className="flex items-center gap-3">
                <button onClick={() => setShowCardSettingsModal(false)} className="text-gray-400 hover:text-white">
                  <ChevronDown size={24} className="rotate-90" />
                </button>
                <h3 className="text-xl font-bold">Card Settings</h3>
              </div>
              <button onClick={() => { setShowCardSettingsModal(false); setShowCardModal(false); }} className="text-gray-400 hover:text-white">
                <X size={24} />
              </button>
            </div>
            <div className="space-y-3">
              <button
                onClick={() => {
                  setCardFrozen(!cardFrozen);
                  showToast(cardFrozen ? "Card unfrozen" : "Card frozen temporarily");
                }}
                className="w-full p-4 bg-gray-800 rounded-xl text-left hover:bg-gray-700 transition-colors flex items-center gap-4"
              >
                <div className={`w-10 h-10 rounded-full flex items-center justify-center ${cardFrozen ? "bg-green-500/20" : "bg-blue-500/20"}`}>
                  {cardFrozen ? <Unlock size={20} className="text-green-400" /> : <Lock size={20} className="text-blue-400" />}
                </div>
                <div className="flex-1">
                  <p className="font-medium">{cardFrozen ? "Unfreeze Card" : "Freeze Card"}</p>
                  <p className="text-sm text-gray-400 mt-1">
                    {cardFrozen ? "Enable card for transactions" : "Temporarily disable all transactions"}
                  </p>
                </div>
              </button>
              <button
                onClick={() => showToast("PIN change request sent to your email")}
                className="w-full p-4 bg-gray-800 rounded-xl text-left hover:bg-gray-700 transition-colors flex items-center gap-4"
              >
                <div className="w-10 h-10 rounded-full bg-purple-500/20 flex items-center justify-center">
                  <Key size={20} className="text-purple-400" />
                </div>
                <div className="flex-1">
                  <p className="font-medium">Change PIN</p>
                  <p className="text-sm text-gray-400 mt-1">Update your card PIN</p>
                </div>
              </button>
              <button
                onClick={() => showToast("Report submitted - new card will arrive in 5-7 days")}
                className="w-full p-4 bg-gray-800 rounded-xl text-left hover:bg-gray-700 transition-colors flex items-center gap-4"
              >
                <div className="w-10 h-10 rounded-full bg-red-500/20 flex items-center justify-center">
                  <AlertTriangle size={20} className="text-red-400" />
                </div>
                <div className="flex-1">
                  <p className="font-medium">Report Lost or Stolen</p>
                  <p className="text-sm text-gray-400 mt-1">Deactivate and request replacement</p>
                </div>
              </button>
              <button
                onClick={() => showToast("Statements available in your email")}
                className="w-full p-4 bg-gray-800 rounded-xl text-left hover:bg-gray-700 transition-colors flex items-center gap-4"
              >
                <div className="w-10 h-10 rounded-full bg-gray-700 flex items-center justify-center">
                  <FileText size={20} className="text-gray-400" />
                </div>
                <div className="flex-1">
                  <p className="font-medium">View Statements</p>
                  <p className="text-sm text-gray-400 mt-1">Download monthly statements</p>
                </div>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* IRA Contribution Modal */}
      {showIRAModal && (
        <div className="fixed inset-0 bg-black/80 z-50 flex items-end md:items-center justify-center">
          <div className="bg-gray-900 w-full md:w-96 md:rounded-2xl rounded-t-2xl p-6">
            <div className="flex items-center justify-between mb-6">
              <h3 className="text-xl font-bold">Contribute to IRA</h3>
              <button onClick={() => { setShowIRAModal(false); setIraContribution(""); }} className="text-gray-400 hover:text-white">
                <X size={24} />
              </button>
            </div>
            <div className="space-y-4">
              <div className="bg-gray-800 rounded-xl p-4">
                <div className="flex justify-between text-sm mb-2">
                  <span className="text-gray-400">Current IRA Balance</span>
                  <span className="text-white font-medium">{formatCurrency(iraBalance)}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-gray-400">2024 Contribution Limit</span>
                  <span className="text-white font-medium">$7,000</span>
                </div>
                <div className="flex justify-between text-sm mt-2">
                  <span className="text-gray-400">Remaining this year</span>
                  <span className="text-[#00C805] font-medium">{formatCurrency(Math.max(0, 7000 - iraBalance * 0.3))}</span>
                </div>
              </div>
              <div>
                <label className="text-sm text-gray-400">Contribution Amount</label>
                <div className="relative mt-2">
                  <span className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400 text-xl">$</span>
                  <input
                    type="number"
                    value={iraContribution}
                    onChange={(e) => setIraContribution(e.target.value)}
                    placeholder="0.00"
                    className="w-full bg-gray-800 border border-gray-700 rounded-lg pl-10 pr-4 py-4 text-2xl font-medium focus:border-[#00C805] focus:outline-none"
                  />
                </div>
              </div>
              <div className="flex gap-2">
                {[100, 500, 1000].map(amount => (
                  <button
                    key={amount}
                    onClick={() => setIraContribution(amount.toString())}
                    className="flex-1 py-2 bg-gray-800 rounded-lg text-sm hover:bg-gray-700 transition-colors"
                  >
                    ${amount}
                  </button>
                ))}
              </div>
              <p className="text-xs text-gray-500">Contributions from your buying power. Tax-deductible up to annual limit.</p>
              <button
                onClick={() => {
                  const amount = parseFloat(iraContribution);
                  if (amount > 0 && amount <= buyingPower) {
                    setIraBalance(prev => prev + amount);
                    setTransactions(prev => [{ merchant: "IRA Contribution", amount: -amount, date: "Just now", type: "order" }, ...prev]);
                    showToast(`Contributed ${formatCurrency(amount)} to your IRA`);
                    setShowIRAModal(false);
                    setIraContribution("");
                  } else if (amount > buyingPower) {
                    showToast("Insufficient buying power");
                  } else {
                    showToast("Enter a valid amount");
                  }
                }}
                disabled={!iraContribution || parseFloat(iraContribution) <= 0}
                className={`w-full py-4 rounded-full font-bold ${
                  !iraContribution || parseFloat(iraContribution) <= 0
                    ? "bg-gray-700 text-gray-500 cursor-not-allowed"
                    : "bg-[#00C805] text-black hover:bg-[#00B504]"
                }`}
              >
                Contribute
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Settings Modal */}
      {showSettingsModal && (
        <div className={`fixed inset-0 ${themeClasses.bgOverlay} z-50 flex items-center justify-center`}>
          <div className={`${themeClasses.bgModal} w-full max-w-md rounded-2xl p-6 mx-4 shadow-2xl ${theme === "light" ? "border border-gray-200" : ""}`}>
            {/* Header */}
            <div className="flex items-center justify-between mb-6">
              <h3 className={`text-xl font-bold ${themeClasses.text}`}>Settings</h3>
              <button onClick={() => setShowSettingsModal(false)} className={`${themeClasses.textSecondary} hover:${themeClasses.text}`}>
                <X size={24} />
              </button>
            </div>

            {/* Settings Options */}
            <div className="space-y-4">
              {/* Theme Toggle */}
              <div className={`flex items-center justify-between p-4 ${themeClasses.bgSecondary} rounded-xl`}>
                <div className="flex items-center gap-3">
                  {theme === "dark" ? (
                    <Moon size={20} className="text-[#00C805]" />
                  ) : (
                    <Sun size={20} className="text-[#00C805]" />
                  )}
                  <div>
                    <p className={`font-medium ${themeClasses.text}`}>Appearance</p>
                    <p className={`text-sm ${themeClasses.textMuted}`}>
                      {theme === "dark" ? "Dark mode" : "Light mode"}
                    </p>
                  </div>
                </div>
                <button
                  onClick={() => setTheme(theme === "dark" ? "light" : "dark")}
                  className={`relative w-14 h-8 rounded-full transition-colors ${
                    theme === "light" ? "bg-[#00C805]" : themeClasses.bgTertiary
                  }`}
                >
                  <span
                    className={`absolute top-1 w-6 h-6 rounded-full bg-white shadow-md transition-transform ${
                      theme === "light" ? "translate-x-7" : "translate-x-1"
                    }`}
                  />
                </button>
              </div>

              {/* Notifications Setting */}
              <div className={`flex items-center justify-between p-4 ${themeClasses.bgSecondary} rounded-xl`}>
                <div className="flex items-center gap-3">
                  <Bell size={20} className={themeClasses.textSecondary} />
                  <div>
                    <p className={`font-medium ${themeClasses.text}`}>Notifications</p>
                    <p className={`text-sm ${themeClasses.textMuted}`}>Push and email alerts</p>
                  </div>
                </div>
                <button
                  onClick={() => showToast("Notification settings updated")}
                  className={`px-3 py-1.5 ${themeClasses.bgTertiary} rounded-lg text-sm font-medium ${themeClasses.textSecondary} hover:${themeClasses.text}`}
                >
                  Manage
                </button>
              </div>

              {/* Privacy Setting */}
              <div className={`flex items-center justify-between p-4 ${themeClasses.bgSecondary} rounded-xl`}>
                <div className="flex items-center gap-3">
                  <Lock size={20} className={themeClasses.textSecondary} />
                  <div>
                    <p className={`font-medium ${themeClasses.text}`}>Privacy & Security</p>
                    <p className={`text-sm ${themeClasses.textMuted}`}>Two-factor authentication</p>
                  </div>
                </div>
                <ChevronRight size={20} className={themeClasses.textMuted} />
              </div>

              {/* Help Setting */}
              <div className={`flex items-center justify-between p-4 ${themeClasses.bgSecondary} rounded-xl`}>
                <div className="flex items-center gap-3">
                  <AlertTriangle size={20} className={themeClasses.textSecondary} />
                  <div>
                    <p className={`font-medium ${themeClasses.text}`}>Help & Support</p>
                    <p className={`text-sm ${themeClasses.textMuted}`}>FAQs and contact us</p>
                  </div>
                </div>
                <ChevronRight size={20} className={themeClasses.textMuted} />
              </div>
            </div>

            {/* Footer */}
            <div className={`mt-6 pt-4 border-t ${themeClasses.border}`}>
              <p className={`text-center text-sm ${themeClasses.textMuted}`}>MicroHood v2.4.0</p>
            </div>
          </div>
        </div>
      )}

      {/* Toast Notification */}
      {toast && (
        <div className={`fixed bottom-24 left-1/2 transform -translate-x-1/2 ${themeClasses.bgTertiary} ${themeClasses.text} px-6 py-3 rounded-full shadow-lg z-50 animate-pulse`}>
          {toast}
        </div>
      )}
    </div>
  );
};

export default MicroHood;
