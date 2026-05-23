import { useState } from "react";
import {
  Menu, ChevronDown, LogOut, User, Wifi, WifiOff,
  LayoutDashboard, Bot, TrendingUp, CandlestickChart,
  Cpu, BarChart2, Target, Users, Monitor, Moon, Sun,
} from "lucide-react";
import { useAuth } from "@/context/AuthContext";
import { useTheme } from "./ThemeProvider";

interface NavbarProps {
  activeTab: string;
  setActiveTab: (tab: string) => void;
}

interface TabDef { label: string; Icon: React.ComponentType<{ className?: string }> }

export const TABS = [
  "Dashboard",
  "Bot Builder",
  "Manual Traders",
  "Charts",
  "Trading Bots",
  "Analysis Tool",
  "Strategies",
  "Copy Trading",
  "TradingView",
];

const TAB_ICONS: TabDef[] = [
  { label: "Dashboard",      Icon: LayoutDashboard },
  { label: "Bot Builder",    Icon: Bot },
  { label: "Manual Traders", Icon: TrendingUp },
  { label: "Charts",         Icon: CandlestickChart },
  { label: "Trading Bots",   Icon: Cpu },
  { label: "Analysis Tool",  Icon: BarChart2 },
  { label: "Strategies",     Icon: Target },
  { label: "Copy Trading",   Icon: Users },
  { label: "TradingView",    Icon: Monitor },
];

export default function Navbar({ activeTab, setActiveTab }: NavbarProps) {
  const {
    isLoggedIn, isAuthorized, activeAccount, accounts,
    balance, currency, wsConnected, login, signup, logout, switchAccount,
  } = useAuth();
  const { theme, setTheme } = useTheme();

  const [showAccountMenu, setShowAccountMenu] = useState(false);
  const [showThemeMenu, setShowThemeMenu] = useState(false);

  const formattedBalance = balance !== null
    ? `${currency} ${balance.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
    : isLoggedIn ? "Loading..." : null;

  return (
    <nav className="fixed top-0 left-0 right-0 z-40 bg-white border-b border-[#E5E7EB] shadow-sm">

      {/* ── Row 1: Hamburger + Logo + Auth ─────────────────────────────────── */}
      <div className="flex items-center justify-between px-3 h-[44px]">

        {/* Left: Hamburger (toggles theme) + Logo */}
        <div className="flex items-center gap-2">
          <div className="relative">
            <button
              onClick={() => setShowThemeMenu(v => !v)}
              className="p-1.5 text-[#6B7280] hover:text-[#1A1A1A] hover:bg-[#F4F6FA] rounded-md transition-colors"
              aria-label="Toggle theme"
            >
              <Menu className="w-5 h-5" />
            </button>

            {/* Small theme toggle dropdown */}
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
            onClick={() => setActiveTab("Dashboard")}
            className="flex items-start hover:opacity-80 transition-opacity cursor-pointer"
          >
            <span className="text-xl font-bold text-[#1E90FF]">TradeX</span>
            <span className="text-[10px] font-bold ml-0.5 mt-0.5 px-1 py-[1px] rounded bg-[#F59E0B]/20 text-[#F59E0B]">PRO</span>
          </button>
        </div>

        {/* Right: Auth */}
        <div className="flex items-center gap-2">
          {isLoggedIn ? (
            <div className="relative">
              <button
                data-testid="account-menu-button"
                onClick={() => setShowAccountMenu(v => !v)}
                className="flex items-center gap-2 px-3 py-1.5 bg-[#1E90FF]/10 hover:bg-[#1E90FF]/20 border border-[#1E90FF]/30 rounded-md transition-colors"
              >
                <span className={`w-2 h-2 rounded-full shrink-0 ${wsConnected && isAuthorized ? "bg-[#22C55E]" : "bg-[#F59E0B] animate-pulse"}`} />
                <div className="flex flex-col items-start leading-none">
                  <span className="text-[10px] text-[#6B7280]">{activeAccount?.account || "Account"}</span>
                  <span className={`text-sm font-bold ${balance !== null ? "text-[#1E90FF]" : "text-[#6B7280]"}`}>
                    {formattedBalance ?? "—"}
                  </span>
                </div>
                <ChevronDown className={`w-3.5 h-3.5 text-[#6B7280] transition-transform ${showAccountMenu ? "rotate-180" : ""}`} />
              </button>

              {showAccountMenu && (
                <>
                  <div className="fixed inset-0 z-40" onClick={() => setShowAccountMenu(false)} />
                  <div className="absolute right-0 mt-1 w-64 bg-white border border-[#E5E7EB] rounded-xl shadow-xl z-50 overflow-hidden">
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
                        className={`w-full flex items-center justify-between px-4 py-3 text-sm transition-colors ${
                          acct.account === activeAccount?.account
                            ? "bg-[#1E90FF]/10 text-[#1E90FF] font-semibold"
                            : "text-[#1A1A1A] hover:bg-[#F4F6FA]"
                        }`}
                      >
                        <div className="flex items-center gap-2">
                          <User className="w-4 h-4" />
                          <span>{acct.account}</span>
                        </div>
                        <span className="text-xs text-[#6B7280] px-1.5 py-0.5 bg-[#F4F6FA] rounded">{acct.currency}</span>
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
          ) : (
            <>
              <button
                data-testid="button-login"
                onClick={login}
                className="px-3 py-1.5 text-sm font-semibold text-[#1E90FF] border border-[#1E90FF] hover:bg-[#1E90FF]/10 rounded-md transition-colors whitespace-nowrap"
              >
                Log In
              </button>
              <button
                data-testid="button-signup"
                onClick={signup}
                className="px-3 py-1.5 text-sm font-semibold text-white bg-[#1E90FF] hover:bg-[#1a7fe0] rounded-md transition-colors whitespace-nowrap"
              >
                Sign Up
              </button>
            </>
          )}
        </div>
      </div>

      {/* ── Row 2: Tab bar (dark navy) ──────────────────────────────────────── */}
      <div className="overflow-x-auto no-scrollbar bg-[#0E1C2F]">
        <div className="flex items-center gap-0.5 px-2 py-1.5 w-max min-w-full">
          {TAB_ICONS.map(({ label, Icon }) => {
            const isActive = activeTab === label;
            return (
              <button
                key={label}
                data-testid={`tab-${label.toLowerCase().replace(/\s+/g, "-")}`}
                onClick={() => setActiveTab(label)}
                className={`flex items-center gap-1.5 whitespace-nowrap px-3 py-1.5 text-xs font-semibold rounded-md transition-all shrink-0 ${
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
  );
}
