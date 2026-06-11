import { HashRouter, Routes, Route, Navigate, useNavigate, useLocation } from "react-router-dom";
import { useEffect } from "react";
import { ThemeProvider } from "@/components/ThemeProvider";
import { AuthProvider } from "@/context/AuthContext";
import { BotProvider } from "@/context/BotContext";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { TooltipProvider } from "@/components/ui/tooltip";
import { Toaster } from "@/components/ui/toaster";
import Navbar from "@/components/Navbar";
import BottomBar from "@/components/BottomBar";
import AIScanner from "@/components/AIScanner";
import LoadingScreen from "@/components/LoadingScreen";
import { useState } from "react";

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
  const location = useLocation();

  if (location.pathname === "/callback") {
    return <Callback />;
  }

  if (loading) {
    return <LoadingScreen onComplete={() => setLoading(false)} />;
  }

  return (
    <div className="min-h-screen w-full bg-background text-foreground font-sans flex flex-col pt-[80px] pb-[52px]">
      <Navbar />
      <main className="flex-1 flex flex-col w-full h-full overflow-y-auto">
        <Routes>
          <Route path="/" element={<Navigate to="/dashboard" replace />} />
          <Route path="/dashboard" element={<Dashboard />} />
          <Route path="/botbuilder" element={<BotBuilder />} />
          <Route path="/manualtraders" element={<ManualTraders />} />
          <Route path="/charts" element={<Charts />} />
          <Route path="/tradingbots" element={<TradingBots />} />
          <Route path="/analysistool" element={<AnalysisTool />} />
          <Route path="/strategies" element={<Strategies />} />
          <Route path="/copytrading" element={<CopyTrading />} />
          <Route path="/tradingview" element={<TradingView />} />
          <Route path="*" element={<Navigate to="/dashboard" replace />} />
        </Routes>
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
              <HashRouter>
                <AppContent />
              </HashRouter>
              <Toaster />
            </TooltipProvider>
          </QueryClientProvider>
        </BotProvider>
      </AuthProvider>
    </ThemeProvider>
  );
}

export default App;
