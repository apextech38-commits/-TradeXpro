import { useState, useRef, useCallback, useEffect } from "react";
import { X, BookOpen, RefreshCw, UserPlus, AlertCircle, CheckCircle2, Loader2 } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/context/AuthContext";
import { DERIV_APP_ID } from "@/context/AuthContext";

const WS_URL   = `wss://ws.binaryws.com/websockets/v3?app_id=${DERIV_APP_ID}`;
const OAUTH_URL = `https://oauth.deriv.com/oauth2/authorize?app_id=${DERIV_APP_ID}&l=EN&brand=deriv`;
const TOKEN_KEY = "deriv_token";

// ─── Inline toast ─────────────────────────────────────────────────────────────
interface Toast { id: number; msg: string; type: "success" | "error" }
let _toastId = 0;

function Toasts({ toasts, remove }: { toasts: Toast[]; remove: (id: number) => void }) {
  return (
    <div className="fixed bottom-20 left-1/2 -translate-x-1/2 z-50 flex flex-col gap-2 pointer-events-none">
      {toasts.map(t => (
        <div
          key={t.id}
          className={`flex items-center gap-2 px-5 py-3 rounded-xl shadow-lg text-sm font-medium text-white pointer-events-auto transition-all
            ${t.type === "success" ? "bg-[#22C55E]" : "bg-[#EF4444]"}`}
        >
          {t.type === "success"
            ? <CheckCircle2 className="w-4 h-4 shrink-0" />
            : <AlertCircle   className="w-4 h-4 shrink-0" />}
          {t.msg}
          <button onClick={() => remove(t.id)} className="ml-2 opacity-70 hover:opacity-100">
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      ))}
    </div>
  );
}

// ─── Tutorial modal ───────────────────────────────────────────────────────────
function TutorialModal({ onClose }: { onClose: () => void }) {
  const steps = [
    { n: 1, title: "Log in with Deriv",          desc: "Click 'Log In' in the top navigation and complete OAuth login." },
    { n: 2, title: "Enter master trader's token", desc: "Paste the master trader's API token into the 'Enter client token' field." },
    { n: 3, title: "Click Add",                   desc: "Press the Add button to register the token for copy trading." },
    { n: 4, title: "Click Start Copy Trading",    desc: "Press Start Copy Trading to begin replicating the master trader's positions." },
  ];
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50"
      onClick={e => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div className="bg-card border border-border rounded-2xl shadow-xl w-full max-w-md mx-4 overflow-hidden">
        <div className="flex items-center justify-between px-6 py-4 border-b border-border">
          <div className="flex items-center gap-2">
            <BookOpen className="w-5 h-5 text-primary" />
            <h2 className="text-lg font-bold text-foreground">How Copy Trading Works</h2>
          </div>
          <button onClick={onClose} className="text-muted-foreground hover:text-foreground transition-colors">
            <X className="w-5 h-5" />
          </button>
        </div>
        <div className="p-6 space-y-4">
          {steps.map(s => (
            <div key={s.n} className="flex gap-4 items-start">
              <div className="w-8 h-8 rounded-full bg-primary/10 border border-primary/30 flex items-center justify-center text-primary font-bold text-sm shrink-0">
                {s.n}
              </div>
              <div>
                <p className="font-semibold text-foreground text-sm">{s.title}</p>
                <p className="text-muted-foreground text-xs mt-0.5 leading-relaxed">{s.desc}</p>
              </div>
            </div>
          ))}
        </div>
        <div className="px-6 pb-6">
          <button
            onClick={onClose}
            className="w-full bg-primary hover:bg-primary/90 text-white rounded-lg py-2.5 font-semibold text-sm transition-colors"
          >
            Got it
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Trader row ───────────────────────────────────────────────────────────────
interface Trader {
  loginid?: string;
  token?: string;
  min_trade_stake?: string;
  max_trade_stake?: string;
  trade_types?: string[];
  assets?: string[];
}

function TraderRow({ trader }: { trader: Trader }) {
  return (
    <div className="flex items-center justify-between py-3 border-b border-border last:border-0 gap-3 flex-wrap text-sm">
      <div className="flex items-center gap-2">
        <UserPlus className="w-4 h-4 text-primary shrink-0" />
        <span className="font-mono text-foreground font-medium">
          {trader.loginid ?? (trader.token ? trader.token.slice(0, 8) + "…" : "Unknown")}
        </span>
      </div>
      <div className="flex gap-4 text-muted-foreground text-xs">
        {trader.min_trade_stake && (
          <span>Min: <span className="text-foreground">{trader.min_trade_stake}</span></span>
        )}
        {trader.max_trade_stake && (
          <span>Max: <span className="text-foreground">{trader.max_trade_stake}</span></span>
        )}
      </div>
    </div>
  );
}

// ─── Main page ────────────────────────────────────────────────────────────────
export default function CopyTrading() {
  const { isLoggedIn, activeAccount, accounts, switchAccount } = useAuth();

  const [tokenInput, setTokenInput]     = useState("");
  const [addedTokens, setAddedTokens]   = useState<string[]>([]);
  const [traders, setTraders]           = useState<Trader[]>([]);
  const [isCopying, setIsCopying]       = useState(false);
  const [toasts, setToasts]             = useState<Toast[]>([]);
  const [showTutorial, setShowTutorial] = useState(false);
  const [syncing, setSyncing]           = useState(false);
  const [adding, setAdding]             = useState(false);
  const [startingCopy, setStartingCopy] = useState(false);

  const copyWsRef = useRef<WebSocket | null>(null);

  const addToast = useCallback((msg: string, type: Toast["type"]) => {
    const id = ++_toastId;
    setToasts(prev => [...prev, { id, msg, type }]);
    setTimeout(() => setToasts(prev => prev.filter(t => t.id !== id)), 4000);
  }, []);

  const removeToast = useCallback((id: number) => {
    setToasts(prev => prev.filter(t => t.id !== id));
  }, []);

  // Open a short-lived authorized WS, send a message, get one response, close
  const sendAuthorized = useCallback((
    message: object,
    onMsg: (msg: Record<string, unknown>) => void,
    onFail?: () => void
  ) => {
    const token = localStorage.getItem(TOKEN_KEY);
    if (!token) { onFail?.(); return; }

    const ws = new WebSocket(WS_URL);
    let authorized = false;

    ws.onopen  = () => ws.send(JSON.stringify({ authorize: token }));
    ws.onerror = () => { onFail?.(); ws.close(); };

    ws.onmessage = (evt) => {
      try {
        const msg = JSON.parse(evt.data) as Record<string, unknown>;
        if (msg.error) { onFail?.(); ws.close(); return; }

        if (msg.msg_type === "authorize" && !authorized) {
          authorized = true;
          ws.send(JSON.stringify(message));
          return;
        }

        if (msg.msg_type !== "authorize") {
          onMsg(msg);
          ws.close();
        }
      } catch (_) { onFail?.(); ws.close(); }
    };

    ws.onclose = () => {};
    return ws;
  }, []);

  // ── Token display ────────────────────────────────────────────────────────
  const maskedToken = (() => {
    if (!isLoggedIn || !activeAccount) return null;
    const id = activeAccount.account || "";
    if (id.length >= 2) return id.slice(0, 2) + "*".repeat(5);
    return "CR*****";
  })();

  // ── Start Demo → Real ────────────────────────────────────────────────────
  const handleStartDemoToReal = () => {
    if (!isLoggedIn) {
      window.location.href = OAUTH_URL;
      return;
    }
    // Find a real (non-virtual) account — VRTC prefix = virtual, CR prefix = real
    const realAccount = accounts.find(
      a => !a.account.startsWith("VR") && !a.account.startsWith("VRTC")
    );
    if (realAccount) {
      switchAccount(realAccount);
      addToast(`Switched to real account: ${realAccount.account}`, "success");
    } else {
      addToast("No real account found. Please create a real account on Deriv first.", "error");
    }
  };

  // ── Add token ────────────────────────────────────────────────────────────
  const handleAdd = () => {
    const tok = tokenInput.trim();
    if (!tok) { addToast("Please enter a token", "error"); return; }
    if (!isLoggedIn) { addToast("Please log in first", "error"); return; }

    setAdding(true);
    sendAuthorized(
      { copy_start: tok },
      (msg) => {
        setAdding(false);
        if (msg.error) {
          addToast("Invalid token", "error");
        } else {
          setAddedTokens(prev => prev.includes(tok) ? prev : [...prev, tok]);
          setTokenInput("");
          addToast("Token added successfully!", "success");
        }
      },
      () => {
        setAdding(false);
        addToast("Invalid token", "error");
      }
    );
  };

  // ── Sync ─────────────────────────────────────────────────────────────────
  const handleSync = () => {
    if (!isLoggedIn) { addToast("Please log in first", "error"); return; }
    setSyncing(true);
    sendAuthorized(
      { copytrading_list: 1 },
      (msg) => {
        setSyncing(false);
        if (msg.error) {
          addToast("Failed to sync", "error");
          return;
        }
        const list = msg.copytrading_list as { traders?: Trader[]; copiers?: Trader[] } | undefined;
        const traderList = list?.traders ?? [];
        setTraders(traderList);
        // Also update addedTokens from synced list
        if (traderList.length > 0) {
          const tokens = traderList.map(t => t.token ?? t.loginid ?? "").filter(Boolean);
          setAddedTokens(prev => {
            const merged = [...new Set([...prev, ...tokens])];
            return merged;
          });
        }
        addToast(`Synced — ${traderList.length} trader(s) found`, "success");
      },
      () => {
        setSyncing(false);
        addToast("Sync failed. Please try again.", "error");
      }
    );
  };

  // ── Start / Stop Copy Trading ─────────────────────────────────────────────
  const handleToggleCopy = () => {
    if (!isLoggedIn) { addToast("Please log in first", "error"); return; }

    if (isCopying) {
      // Stop — send copy_stop for each token
      addedTokens.forEach(tok => {
        sendAuthorized({ copy_stop: tok }, () => {});
      });
      setIsCopying(false);
      addToast("Copy trading stopped", "success");
      return;
    }

    if (addedTokens.length === 0) {
      addToast("Add at least 1 trader token before starting", "error");
      return;
    }

    setStartingCopy(true);
    // Re-send copy_start for all tokens to ensure they're active
    let done = 0;
    let anyError = false;
    addedTokens.forEach(tok => {
      sendAuthorized(
        { copy_start: tok },
        (msg) => {
          done++;
          if (msg.error) anyError = true;
          if (done === addedTokens.length) {
            setStartingCopy(false);
            if (anyError) {
              addToast("Some tokens failed to start", "error");
            } else {
              setIsCopying(true);
              addToast("Copy trading is now active!", "success");
            }
          }
        },
        () => {
          done++;
          anyError = true;
          if (done === addedTokens.length) {
            setStartingCopy(false);
            addToast("Failed to start copy trading", "error");
          }
        }
      );
    });
  };

  // Clean up WS on unmount
  useEffect(() => {
    return () => { copyWsRef.current?.close(); };
  }, []);

  return (
    <>
      <Toasts toasts={toasts} remove={removeToast} />
      {showTutorial && <TutorialModal onClose={() => setShowTutorial(false)} />}

      <div className="flex-1 p-4 md:p-8 max-w-3xl mx-auto w-full space-y-8">

        {/* Top action buttons */}
        <div className="flex flex-col md:flex-row gap-4 pt-4">
          <Button
            data-testid="button-start-copy"
            onClick={handleStartDemoToReal}
            className="bg-[#22C55E] hover:bg-[#16a34a] text-white h-12 px-8 text-base font-semibold rounded-lg shadow-sm"
          >
            Start Demo to Real Copy Trading
          </Button>
          <Button
            variant="outline"
            data-testid="button-tutorial"
            onClick={() => setShowTutorial(true)}
            className="border-border text-foreground hover:bg-secondary h-12 px-8 text-base font-semibold rounded-lg"
          >
            Tutorial
          </Button>
        </div>

        {/* Your Token */}
        <div className="space-y-2">
          <h2 className="text-muted-foreground text-sm font-medium">Your Token</h2>
          <div
            data-testid="text-token"
            className={`bg-card border border-border rounded-lg p-4 inline-block font-mono text-xl tracking-widest select-all shadow-sm ${
              maskedToken ? "text-foreground" : "text-muted-foreground italic text-base"
            }`}
          >
            {maskedToken ?? "Please log in first"}
          </div>
        </div>

        {/* Replicator card */}
        <div className="bg-card border border-border rounded-xl p-6 shadow-sm">
          <h2 className="text-xl font-bold text-foreground mb-6">Add tokens to Replicator</h2>

          <div className="space-y-6">
            <Input
              placeholder="Enter client token"
              data-testid="input-client-token"
              value={tokenInput}
              onChange={e => setTokenInput(e.target.value)}
              onKeyDown={e => { if (e.key === "Enter") handleAdd(); }}
              className="h-12 bg-background border-border text-foreground placeholder:text-muted-foreground font-mono"
            />

            <div className="flex flex-wrap gap-3">
              {/* Add */}
              <Button
                data-testid="button-add-token"
                onClick={handleAdd}
                disabled={adding}
                className="bg-primary hover:bg-primary/90 text-white h-10 px-6"
              >
                {adding ? <Loader2 className="w-4 h-4 animate-spin" /> : "Add"}
              </Button>

              {/* Sync */}
              <Button
                variant="outline"
                data-testid="button-sync"
                onClick={handleSync}
                disabled={syncing}
                className="border-teal-500 text-teal-500 hover:bg-teal-500/10 h-10 px-6"
              >
                {syncing
                  ? <Loader2 className="w-4 h-4 animate-spin" />
                  : <><RefreshCw className="w-4 h-4 mr-1.5" />Sync</>}
              </Button>

              {/* Start / Stop Copy Trading */}
              <Button
                data-testid="button-start-copy-trading"
                onClick={handleToggleCopy}
                disabled={startingCopy}
                className={`h-10 px-6 w-full sm:w-auto sm:ml-auto text-white transition-colors ${
                  isCopying
                    ? "bg-[#EF4444] hover:bg-[#DC2626]"
                    : "bg-[#22C55E] hover:bg-[#16a34a]"
                }`}
              >
                {startingCopy
                  ? <Loader2 className="w-4 h-4 animate-spin" />
                  : isCopying ? "Stop Copy Trading" : "Start Copy Trading"}
              </Button>
            </div>

            {/* Added tokens preview */}
            {addedTokens.length > 0 && (
              <div className="space-y-1">
                {addedTokens.map((tok, i) => (
                  <div key={i} className="flex items-center justify-between bg-background border border-border rounded-lg px-4 py-2">
                    <span className="font-mono text-sm text-foreground truncate">{tok.slice(0, 8)}…</span>
                    <button
                      onClick={() => {
                        // Send copy_stop for this token
                        sendAuthorized({ copy_stop: tok }, () => {});
                        setAddedTokens(prev => prev.filter(t => t !== tok));
                        setTraders(prev => prev.filter(t => t.token !== tok && t.loginid !== tok));
                        addToast("Token removed", "success");
                      }}
                      className="text-muted-foreground hover:text-[#EF4444] transition-colors ml-3 shrink-0"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  </div>
                ))}
              </div>
            )}

            {/* Synced trader details */}
            {traders.length > 0 && (
              <div className="pt-2 border-t border-border">
                <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3">
                  Synced Traders
                </p>
                {traders.map((t, i) => <TraderRow key={i} trader={t} />)}
              </div>
            )}

            {/* Status footer */}
            <div className="pt-6 border-t border-border flex justify-between items-center text-sm">
              <span className="text-muted-foreground">Total Clients added:</span>
              <span className="text-foreground font-bold" data-testid="text-client-count">
                {addedTokens.length}
              </span>
            </div>

            {/* Copy status badge */}
            {isCopying && (
              <div className="flex items-center gap-2 bg-[#22C55E]/10 border border-[#22C55E]/30 rounded-lg px-4 py-3 text-sm">
                <span className="w-2 h-2 rounded-full bg-[#22C55E] animate-pulse" />
                <span className="text-[#22C55E] font-medium">
                  Copy trading active — replicating {addedTokens.length} trader{addedTokens.length !== 1 ? "s" : ""}
                </span>
              </div>
            )}
          </div>
        </div>
      </div>
    </>
  );
}
