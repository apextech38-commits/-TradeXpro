import { useState } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import {
  Menu, ChevronDown, LogOut, User, Wifi, WifiOff,
  LayoutDashboard, Bot, TrendingUp, CandlestickChart,
  Cpu, BarChart2, Target, Users, Monitor, Moon, Sun,
} from "lucide-react";
import { useAuth } from "@/context/AuthContext";
import { useTheme } from "./ThemeProvider";

interface TabDef { label: string; Icon: React.ComponentType<{ className?: string }>; route: string; }

export const TABS = [
  "Dashboard", "Bot Builder", "Manual Traders", "Charts",
  "Trading Bots", "Analysis Tool", "Strategies", "Copy Trading", "TradingView",
];

const TAB_ICONS: TabDef[] = [
  { label: "Dashboard",     Icon: LayoutDashboard, route: "/dashboard" },
  { label: "Bot Builder",   Icon: Bot,             route: "/botbuilder" },
  { label: "Manual Traders",Icon: TrendingUp,      route: "/manualtraders" },
  { label: "Charts",        Icon: CandlestickChart,route: "/charts" },
  { label: "Trading Bots",  Icon: Cpu,             route: "/tradingbots" },
  { label: "Analysis Tool", Icon: BarChart2,       route: "/analysistool" },
  { label: "Strategies",    Icon: Target,          route: "/strategies" },
  { label: "Copy Trading",  Icon: Users,           route: "/copytrading" },
  { label: "TradingView",   Icon: Monitor,         route: "/tradingview" },
];

function accountLabel(acct: { account: string; account_type?: string }) {
  if (acct.account_type === "demo") return "Demo";
  if (acct.account_type === "real") return "Real";
  // fallback: infer from prefix (DOT = demo, ROT = real)
  if (acct.account.startsWith("DOT")) return "Demo";
  if (acct.account.startsWith("ROT")) return "Real";
  return acct.account;
}

export default function Navbar() {
  const navigate = useNavigate();
  const location = useLocation();
  const {
    isLoggedIn, isAuthorized, activeAccount, accounts,
    balance, currency, wsConnected, login, signup, logout, switchAccount,
  } = useAuth();
  const { theme, setTheme } = useTheme();

  const [showAccountMenu, setShowAccountMenu] = useState(false);
  const [showThemeMenu, setShowThemeMenu] = useState(false);
  const [showCashier, setShowCashier] = useState(false);
  const [cashierTab, setCashierTab] = useState<'deposit' | 'withdraw'>('deposit');

  const formattedBalance = balance !== null
    ? `${currency} ${balance.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
    : isLoggedIn ? "Loading..." : null;

  const activeRoute = location.pathname;

  return (
    <>
      <nav className="fixed top-0 left-0 right-0 z-40 bg-white border-b border-[#E5E7EB] shadow-sm">
        {/* Row 1 */}
        <div className="flex items-center justify-between px-3 h-[44px]">
        <div className="flex items-center gap-2">
          <div className="relative">
            <button
              onClick={() => setShowThemeMenu(v => !v)}
              className="p-1.5 text-[#6B7280] hover:text-[#1A1A1A] hover:bg-[#F4F6FA] rounded-md transition-colors"
              aria-label="Toggle theme"
            >
              <Menu className="w-5 h-5" />
            </button>
            {showThemeMenu && (
              <>
                <div className="fixed inset-0 z-40" onClick={() => setShowThemeMenu(false)} />
                <div className="absolute left-0 top-full mt-1 z-50 bg-white border border-[#E5E7EB] rounded-xl shadow-xl p-1 min-w-[140px]">
                  <button
                    onClick={() => { setTheme(theme === "dark" ? "light" : "dark"); setShowThemeMenu(false); }}
                    className="w-full flex items-center gap-2.5 px-3 py-2.5 text-sm text-[#1A1A1A] hover:bg-[#F4F6FA] rounded-lg transition-colors"
                  >
                    {theme === "dark"
                      ? <><Sun className="w-4 h-4 text-[#F59E0B]" /><span>Light mode</span></>
                      : <><Moon className="w-4 h-4 text-[#6B7280]" /><span>Dark mode</span></>
                    }
                  </button>
                </div>
              </>
            )}
          </div>
          <button
            data-testid="logo-home"
            onClick={() => navigate("/dashboard")}
            className="flex items-start hover:opacity-80 transition-opacity cursor-pointer"
          >
            <span className="text-xl font-bold text-[#1E90FF]">TradeX</span>
            <span className="text-[10px] font-bold ml-0.5 mt-0.5 px-1 py-[1px] rounded bg-[#F59E0B]/20 text-[#F59E0B]">PRO</span>
          </button>
        </div>

        {/* Auth */}
        <div className="flex items-center gap-2">
          {isLoggedIn ? (
            <>
            <button
              onClick={() => setShowCashier(true)}
              className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-[#1E90FF] border border-[#1E90FF]/30 rounded-md hover:bg-[#1E90FF]/10 transition-colors shrink-0"
            >
              💳 Cashier
            </button>
            <div className="relative">
              <button
                data-testid="account-menu-button"
                onClick={() => setShowAccountMenu(v => !v)}
                className="flex items-center gap-1.5 px-2 py-1.5 bg-[#1E90FF]/10 hover:bg-[#1E90FF]/20 border border-[#1E90FF]/30 rounded-md transition-colors"
              >
                <span className={`w-2 h-2 rounded-full shrink-0 ${wsConnected && isAuthorized ? "bg-[#22C55E]" : "bg-[#F59E0B]"} animate-pulse`} />
                <div className="flex flex-col items-start leading-none">
                  <span className="text-xs font-semibold text-[#1A1A1A]">
                    {activeAccount ? accountLabel(activeAccount) : "Account"}
                  </span>
                  <span className={`text-sm font-bold ${balance !== null ? "text-[#1E90FF]" : "text-[#6B7280]"}`}>
                    {formattedBalance ?? "—"}
                  </span>
                </div>
                <ChevronDown className={`w-3.5 h-3.5 text-[#6B7280] transition-transform ${showAccountMenu ? "rotate-180" : ""}`} />
              </button>
              {showAccountMenu && (
                <>
                  <div className="fixed inset-0 z-40" onClick={() => setShowAccountMenu(false)} />
                  <div className="absolute right-0 mt-1 z-50 w-64 bg-white border border-[#E5E7EB] rounded-xl shadow-xl overflow-hidden">
                    <div className="px-4 py-3 border-b border-[#E5E7EB] bg-[#F4F6FA] flex items-center gap-2">
                      {wsConnected && isAuthorized
                        ? <><Wifi className="w-4 h-4 text-[#22C55E]" /><span className="text-xs text-[#22C55E] font-medium">Live — Connected to Deriv</span></>
                        : <><WifiOff className="w-4 h-4 text-[#F59E0B]" /><span className="text-xs text-[#F59E0B] font-medium">Reconnecting...</span></>
                      }
                    </div>
                    {accounts.map(acct => (
                      <button
                        key={acct.account}
                        data-testid={`switch-${acct.account}`}
                        onClick={() => { switchAccount(acct); setShowAccountMenu(false); }}
                        className={`w-full flex items-center justify-between px-4 py-3 text-sm transition-colors ${acct.account === activeAccount?.account ? "bg-[#1E90FF]/10 text-[#1E90FF] font-semibold" : "text-[#1A1A1A] hover:bg-[#F4F6FA]"}`}
                      >
                        <div className="flex items-center gap-2">
                          <User className="w-4 h-4" />
                          <div className="flex flex-col items-start">
                            <span className="font-semibold">{accountLabel(acct)}</span>
                            <span className="text-[10px] text-[#6B7280]">{acct.account}</span>
                          </div>
                        </div>
                        <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${
                          acct.account_type === "demo"
                            ? "bg-[#F59E0B]/15 text-[#F59E0B]"
                            : "bg-[#22C55E]/15 text-[#22C55E]"
                        }`}>
                          {acct.currency}
                        </span>
                      </button>
                    ))}
                    <div className="border-t border-[#E5E7EB]">
                      <button
                        data-testid="button-logout"
                        onClick={() => { logout(); setShowAccountMenu(false); }}
                        className="w-full flex items-center gap-2 px-4 py-3 text-sm text-[#EF4444] hover:bg-[#EF4444]/10 transition-colors"
                      >
                        <LogOut className="w-4 h-4" />
                        Log Out
                      </button>
                    </div>
                  </div>
                </>
              )}
            </div>
            </>
          ) : (
            <>
              <button
                data-testid="button-login"
                onClick={login}
                className="px-3 py-1.5 text-sm font-semibold text-[#1E90FF] border border-[#1E90FF]/10 hover:bg-[#1E90FF]/10 rounded-md transition-colors whitespace-nowrap"
              >Log In</button>
              <button
                data-testid="button-signup"
                onClick={signup}
                className="px-3 py-1.5 text-sm font-semibold text-white bg-[#1E90FF] hover:bg-[#1a7fe0] rounded-md transition-colors whitespace-nowrap"
              >Sign Up</button>
            </>
          )}
        </div>
      </div>

      {/* Row 2 — Tab bar */}
      <div className="overflow-x-auto no-scrollbar bg-[#0E1C2F]">
        <div className="flex items-center gap-0.5 px-2 py-1.5 w-max min-w-full">
          {TAB_ICONS.map(({ label, Icon, route }) => {
            const isActive = activeRoute === route;
            return (
              <button
                key={label}
                data-testid={`tab-${label.toLowerCase().replace(/\s+/g, "-")}`}
                onClick={() => navigate(route)}
                className={`flex items-center gap-1.5 whitespace-nowrap px-3 py-1.5 text-xs font-semibold rounded shrink-0 ${
                  isActive
                    ? "bg-[#1E90FF] text-white shadow-sm"
                    : "bg-transparent text-[#9CA3AF] hover:text-white hover:bg-white/10"
                }`}
              >
                <Icon className="w-3.5 h-3.5" />
                {label.toUpperCase()}
              </button>
            );
          })}
        </div>
      </div>
    </nav>

      {/* Cashier Drawer */}
      {showCashier && (
        <div className="fixed inset-0 z-50 flex items-end">
          <div className="absolute inset-0 bg-black/50" onClick={() => setShowCashier(false)} />
          <div className="relative w-full bg-background rounded-t-3xl shadow-2xl flex flex-col" style={{ height: "auto" }}>
            <div className="flex items-center justify-between px-5 py-4 border-b border-border shrink-0">
              <h2 className="text-base font-bold text-foreground">Cashier</h2>
              <button onClick={() => setShowCashier(false)} className="p-1 text-muted-foreground hover:text-foreground">✕</button>
            </div>
            <div className="flex flex-col gap-3 p-5">
              <button
                onClick={() => { window.open('https://app.deriv.com/cashier/deposit', '_blank'); setShowCashier(false); }}
                className="w-full flex items-center gap-3 px-4 py-4 bg-[#22C55E]/10 border border-[#22C55E]/30 rounded-xl hover:bg-[#22C55E]/20 transition-colors"
              >
                <span className="text-2xl">💰</span>
                <div className="text-left">
                  <div className="font-semibold text-foreground">Deposit</div>
                  <div className="text-xs text-muted-foreground">Add funds to your account</div>
                </div>
              </button>
              <button
                onClick={() => { window.open('https://app.deriv.com/cashier/withdrawal', '_blank'); setShowCashier(false); }}
                className="w-full flex items-center gap-3 px-4 py-4 bg-[#1E90FF]/10 border border-[#1E90FF]/30 rounded-xl hover:bg-[#1E90FF]/20 transition-colors"
              >
                <span className="text-2xl">🏦</span>
                <div className="text-left">
                  <div className="font-semibold text-foreground">Withdraw</div>
                  <div className="text-xs text-muted-foreground">Transfer funds to your bank</div>
                </div>
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
