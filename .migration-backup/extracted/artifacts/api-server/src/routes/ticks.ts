import { Router, type IRouter, type Request, type Response } from "express";
import WebSocket from "ws";

const router: IRouter = Router();

const DERIV_APP_ID = "339IyLjCcUmBEXEzG6tsS";
const DERIV_WS_URL = `wss://ws.binaryws.com/websockets/v3?app_id=${DERIV_APP_ID}`;

// ─── Realistic starting prices & per-tick volatility for each symbol ───────
const SIM_PARAMS: Record<string, { price: number; digits: number; vol: number; tickMs: number }> = {
  R_10:  { price: 6643.20,  digits: 2, vol: 0.0001, tickMs: 1000 },
  R_25:  { price: 3052.88,  digits: 2, vol: 0.00025, tickMs: 1000 },
  R_50:  { price: 4198.46,  digits: 2, vol: 0.0005,  tickMs: 1000 },
  R_75:  { price: 5234.10,  digits: 2, vol: 0.00075, tickMs: 1000 },
  R_100: { price: 1142.54,  digits: 3, vol: 0.001,   tickMs: 1000 },
};

function randNorm(): number {
  // Box-Muller transform
  const u = 1 - Math.random();
  const v = 1 - Math.random();
  return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v);
}

function simPrice(p: number, vol: number): number {
  return p * (1 + vol * randNorm());
}

function generateHistory(symbol: string, count: number): { prices: number[]; times: number[] } {
  const params = SIM_PARAMS[symbol] ?? SIM_PARAMS["R_100"];
  const prices: number[] = [];
  const times: number[]  = [];
  const now = Math.floor(Date.now() / 1000);
  let price = params.price;

  for (let i = count - 1; i >= 0; i--) {
    price = simPrice(price, params.vol);
    prices.push(parseFloat(price.toFixed(params.digits)));
    times.push(now - i);
  }

  return { prices, times };
}

// ─── Try to open a Deriv WebSocket; throws if rejected ─────────────────────
function openDerivWS(): Promise<WebSocket> {
  return new Promise((resolve, reject) => {
    const ws = new WebSocket(DERIV_WS_URL, {
      handshakeTimeout: 8_000,
      headers: {
        "Origin":     "https://app.deriv.com",
        "User-Agent": "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 Chrome/124.0.0.0 Safari/537.36",
      },
    });
    ws.once("open",  () => resolve(ws));
    ws.once("error", (err) => reject(err));
  });
}

// ─── GET /api/ticks/:symbol  ── history (100+ ticks) ───────────────────────
router.get("/ticks/:symbol", async (req: Request, res: Response) => {
  const symbol = req.params.symbol;
  const count  = Math.min(Math.max(parseInt(req.query["count"] as string) || 100, 1), 5000);

  // 1. Try Deriv live data
  try {
    const ws = await openDerivWS();
    const data = await new Promise<{ prices: number[]; times: number[] }>((resolve, reject) => {
      const timer = setTimeout(() => reject(new Error("timeout")), 10_000);
      ws.send(JSON.stringify({ ticks_history: symbol, count, end: "latest", start: 1, style: "ticks" }));
      ws.on("message", (raw) => {
        try {
          const msg = JSON.parse(raw.toString());
          if (msg.error) { clearTimeout(timer); reject(new Error(msg.error.message)); return; }
          if (msg.msg_type === "history") {
            clearTimeout(timer);
            resolve({ prices: msg.history.prices, times: msg.history.times });
          }
        } catch (e) { clearTimeout(timer); reject(e); }
      });
      ws.on("error", (e) => { clearTimeout(timer); reject(e); });
    });
    ws.terminate();
    return res.json({ ...data, source: "live" });
  } catch (_) {
    // Deriv unavailable — fall back to simulation
  }

  // 2. Simulated data
  const sim = generateHistory(symbol, count);
  return res.json({ ...sim, source: "simulated" });
});

// ─── GET /api/ticks/stream/:symbol  ── SSE live stream ─────────────────────
router.get("/ticks/stream/:symbol", (req: Request, res: Response) => {
  const symbol = req.params.symbol;

  res.setHeader("Content-Type",    "text/event-stream");
  res.setHeader("Cache-Control",   "no-cache");
  res.setHeader("Connection",      "keep-alive");
  res.setHeader("X-Accel-Buffering", "no");
  res.flushHeaders();

  let closed = false;
  let ws: WebSocket | null = null;
  let simTimer: ReturnType<typeof setTimeout> | null = null;
  let simPrice = (SIM_PARAMS[symbol] ?? SIM_PARAMS["R_100"]).price;

  const cleanup = () => {
    if (closed) return;
    closed = true;
    if (ws) { try { ws.terminate(); } catch (_) {} }
    if (simTimer) clearTimeout(simTimer);
    if (!res.writableEnded) res.end();
  };

  const sendTick = (value: number, epoch: number) => {
    if (!closed && !res.writableEnded) {
      res.write(`data: ${JSON.stringify({ value, epoch })}\n\n`);
    }
  };

  // Simulation fallback — sends a tick every second
  const startSim = () => {
    const params = SIM_PARAMS[symbol] ?? SIM_PARAMS["R_100"];
    const tick = () => {
      if (closed) return;
      simPrice = simPrice * (1 + params.vol * randNorm());
      sendTick(parseFloat(simPrice.toFixed(params.digits)), Math.floor(Date.now() / 1000));
      simTimer = setTimeout(tick, params.tickMs);
    };
    simTimer = setTimeout(tick, params.tickMs);
  };

  req.on("close",  cleanup);
  req.on("error",  cleanup);
  res.on("close",  cleanup);

  // 1. Try Deriv live WebSocket stream
  openDerivWS()
    .then((socket) => {
      if (closed) { socket.terminate(); return; }
      ws = socket;

      ws.send(JSON.stringify({
        ticks_history: symbol, count: 1, end: "latest", start: 1, style: "ticks", subscribe: 1,
      }));

      ws.on("message", (raw) => {
        if (closed) return;
        try {
          const msg = JSON.parse(raw.toString());
          if (msg.error) { cleanup(); startSim(); return; }
          if (msg.msg_type === "tick") {
            sendTick(msg.tick.quote, msg.tick.epoch);
          }
        } catch (_) {}
      });

      ws.on("close", () => { if (!closed) { ws = null; cleanup(); } });
      ws.on("error", () => { if (!closed) { ws = null; cleanup(); } });
    })
    .catch(() => {
      // Deriv unreachable — use simulator
      if (!closed) startSim();
    });
});

export default router;
