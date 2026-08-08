import { useEffect, useRef, useState } from "react";
import { AlertTriangle, Brain, Loader2, Send, Sparkles, User, X } from "lucide-react";
import { useLiveScanner } from "@/hooks/useLiveScanner";

type Message = { role: "user" | "assistant"; content: string };

type Props = {
  open?: boolean;
  onClose?: () => void;
};

export default function SmartTraderAIChat({ open, onClose }: Props) {
  const [selfOpen, setSelfOpen] = useState(false);
  const controlled = typeof open === "boolean" && typeof onClose === "function";
  const visible = controlled ? open : selfOpen;
  const endRef = useRef<HTMLDivElement>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { markets, topMarket } = useLiveScanner(visible);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, loading]);

  const close = () => {
    if (controlled) onClose?.();
    else setSelfOpen(false);
  };

  const send = async (preset?: string) => {
    const question = (preset ?? input).trim();
    if (!question || loading) return;

    const next = [...messages, { role: "user" as const, content: question }];
    setMessages(next);
    setInput("");
    setError(null);
    setLoading(true);

    try {
      const response = await fetch("/api/smart-trader-ai", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          question,
          history: next.slice(-8),
          marketContext: {
            capturedAt: new Date().toISOString(),
            topMarket: topMarket
              ? {
                  symbol: topMarket.id,
                  label: topMarket.label,
                  trend: topMarket.trend,
                  confidence: topMarket.confidence,
                  connected: topMarket.connected,
                }
              : null,
            markets: markets.slice(0, 8).map((market) => ({
              symbol: market.id,
              label: market.label,
              trend: market.trend,
              confidence: market.confidence,
              connected: market.connected,
            })),
          },
        }),
      });

      const data = await response.json().catch(() => ({}));
      if (!response.ok || typeof data.answer !== "string") {
        throw new Error(data.error || "Smart Trader AI is unavailable right now.");
      }
      setMessages((current) => [...current, { role: "assistant", content: data.answer }]);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to reach Smart Trader AI.");
    } finally {
      setLoading(false);
    }
  };

  const prompts = [
    "What is the strongest setup right now?",
    "Explain this signal",
    "Review my last loss",
    "Find me a safer setup",
  ];

  if (!visible) {
    return (
      <button
        onClick={() => setSelfOpen(true)}
        className="fixed bottom-6 right-6 z-[60] flex h-12 w-12 items-center justify-center rounded-full bg-gradient-to-br from-primary to-primary/70 text-primary-foreground shadow-lg ring-4 ring-primary/10 transition-transform hover:scale-105"
        aria-label="Open Smart Trader AI"
      >
        <Sparkles className="h-5 w-5" />
      </button>
    );
  }

  return (
    <div className="fixed bottom-6 right-6 z-[60]">
      <div className="mb-3 flex h-[min(620px,calc(100vh-120px))] w-[min(390px,calc(100vw-32px))] flex-col overflow-hidden rounded-2xl border border-border bg-card shadow-2xl">
        <div className="flex items-center justify-between border-b border-border px-4 py-3">
          <div className="flex items-center gap-2">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-primary/10 text-primary">
              <Brain className="h-5 w-5" />
            </div>
            <div>
              <div className="font-semibold">Ask Smart Trader</div>
              <div className="flex items-center gap-1 text-[11px] text-muted-foreground">
                <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" /> Live market context
              </div>
            </div>
          </div>
          <button onClick={close} className="rounded-lg p-2 hover:bg-muted" aria-label="Close">
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="flex-1 space-y-3 overflow-y-auto p-3">
          {messages.length === 0 && (
            <div className="rounded-xl border border-primary/10 bg-primary/[0.04] p-3">
              <div className="mb-1 flex items-center gap-2 text-sm font-medium">
                <Sparkles className="h-4 w-4 text-primary" /> Smart Trader AI is live
              </div>
              <p className="text-xs leading-5 text-muted-foreground">
                Ask about the live scanner, signals, risk controls, or trading concepts. AI analysis is probabilistic and is never a guarantee of profit.
              </p>
            </div>
          )}

          {messages.map((message, index) => (
            <div key={`${message.role}-${index}`} className={`flex gap-2 ${message.role === "user" ? "justify-end" : "justify-start"}`}>
              {message.role === "assistant" && (
                <div className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
                  <Sparkles className="h-3.5 w-3.5" />
                </div>
              )}
              <div className={`max-w-[84%] whitespace-pre-wrap rounded-2xl px-3 py-2.5 text-sm leading-5 ${message.role === "user" ? "rounded-br-md bg-primary text-primary-foreground" : "rounded-bl-md bg-muted"}`}>
                {message.content}
              </div>
              {message.role === "user" && (
                <div className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-muted">
                  <User className="h-3.5 w-3.5" />
                </div>
              )}
            </div>
          ))}

          {loading && (
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-primary/10 text-primary">
                <Sparkles className="h-3.5 w-3.5" />
              </div>
              <span className="flex items-center gap-2"><Loader2 className="h-3.5 w-3.5 animate-spin" /> Analyzing...</span>
            </div>
          )}

          {error && (
            <div className="flex gap-2 rounded-xl border border-destructive/20 bg-destructive/5 p-3 text-xs text-destructive">
              <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
              <span>{error}</span>
            </div>
          )}
          <div ref={endRef} />
        </div>

        {messages.length === 0 && (
          <div className="flex gap-1.5 overflow-x-auto border-t border-border px-3 py-2">
            {prompts.map((prompt) => (
              <button key={prompt} onClick={() => void send(prompt)} className="shrink-0 rounded-full border border-border bg-background px-3 py-1.5 text-[11px] text-muted-foreground hover:border-primary/40 hover:text-foreground">
                {prompt}
              </button>
            ))}
          </div>
        )}

        <div className="border-t border-border p-3">
          <div className="flex items-end gap-2 rounded-xl border border-border bg-background p-1.5 focus-within:border-primary/50">
            <textarea
              value={input}
              onChange={(event) => setInput(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === "Enter" && !event.shiftKey) {
                  event.preventDefault();
                  void send();
                }
              }}
              rows={1}
              disabled={loading}
              placeholder="Ask Smart Trader..."
              className="max-h-24 min-h-9 flex-1 resize-none bg-transparent px-2 py-2 text-sm outline-none placeholder:text-muted-foreground/60"
            />
            <button onClick={() => void send()} disabled={loading || !input.trim()} className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-primary text-primary-foreground disabled:cursor-not-allowed disabled:opacity-40" aria-label="Send">
              {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
            </button>
          </div>
          <div className="mt-1.5 text-center text-[10px] text-muted-foreground">AI can be wrong. Review every trade before executing.</div>
        </div>
      </div>
    </div>
  );
}
