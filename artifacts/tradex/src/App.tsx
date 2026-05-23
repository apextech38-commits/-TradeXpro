import { useState, useEffect } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { ThemeProvider } from "@/components/ThemeProvider";
import { AuthProvider } from "@/context/AuthContext";
import { BotProvider } from "@/context/BotContext";

import LoadingScreen from "@/components/LoadingScreen";
import Navbar, { TABS } from "@/components/Navbar";
import BottomBar from "@/components/BottomBar";
import AIScanner from "@/components/AIScanner";

import Dashboard from "@/pages/Dashboard";
import BotBuilder from "@/pages/BotBuilder";
import ManualTraders from "@/pages/ManualTraders";
import Charts from "@/pages/Charts";
import TradingBots from "@/pages/TradingBots";
import AnalysisTool from "@/pages/AnalysisTool";
import Strategies from "@/pages/Strategies";
import CopyTrading from "@/pages/CopyTrading";
import TradingView from "@/pages/TradingView";
import Callback from "@/pages/Callback";

const queryClient = new QueryClient();

function AppContent() {
  const [loading, setLoading] = useState(true);
  const initTab = (() => {
    const p = new URLSearchParams(window.location.search).get("tab");
    if (p) {
      const found = TABS.find(t => t.toLowerCase().replace(/\s+/g, "-") === p.toLowerCase());
      if (found) return found;
    }
    return TABS[0];
  })();
  const [activeTab, setActiveTab] = useState(initTab);

  useEffect(() => {
    const handler = (e: Event) => {
      const tab = (e as CustomEvent<string>).detail;
      if (TABS.includes(tab)) setActiveTab(tab);
    };
    window.addEventListener("tradex:navigate", handler);
    return () => window.removeEventListener("tradex:navigate", handler);
  }, []);

  const _pathname = window.location.pathname.replace(/\/$/, "");
  const _search   = new URLSearchParams(window.location.search);
  const isCallback = _pathname.endsWith("/callback") || _search.has("acct1");
  if (isCallback) return <Callback />;

  if (loading) {
    return <LoadingScreen onComplete={() => setLoading(false)} />;
  }

  const renderContent = () => {
    switch (activeTab) {
      case "Dashboard":      return <Dashboard />;
      case "Bot Builder":    return <BotBuilder />;
      case "Manual Traders": return <ManualTraders />;
      case "Charts":         return <Charts />;
      case "Trading Bots":   return <TradingBots />;
      case "Analysis Tool":  return <AnalysisTool />;
      case "Strategies":     return <Strategies />;
      case "Copy Trading":   return <CopyTrading />;
      case "TradingView":    return <TradingView />;
      default:               return <Dashboard />;
    }
  };

  return (
    <div className="min-h-screen w-full bg-background text-foreground font-sans flex flex-col pt-[80px] pb-[52px]">
      <Navbar activeTab={activeTab} setActiveTab={setActiveTab} />
      <main className="flex-1 flex flex-col w-full h-full overflow-y-auto">
        <div key={activeTab} className="tradex-page-enter flex-1 flex flex-col w-full h-full">
          {renderContent()}
        </div>
      </main>
      <BottomBar />
      <AIScanner />
    </div>
  );
}

function App() {
  return (
    <ThemeProvider defaultTheme="light" storageKey="tradex-theme-v3">
      <AuthProvider>
        <BotProvider>
          <QueryClientProvider client={queryClient}>
            <TooltipProvider>
              <AppContent />
              <Toaster />
            </TooltipProvider>
          </QueryClientProvider>
        </BotProvider>
      </AuthProvider>
    </ThemeProvider>
  );
}

export default App;
