// Cloudflare Pages Function. POST opens a real trade broadcast when an
// opted-in trader's own trade executes; PATCH settles it with the real
// outcome once it closes. No fabricated data ever enters this table --
// every row corresponds to an actual trade a real, opted-in user placed
// through their own authenticated Deriv session (execution always happens
// client-side; this backend only ever records outcomes, never places trades
// or holds any trading credential).
interface Env {
  DB: D1Database;
}

export const onRequestPost: PagesFunction<Env> = async (context) => {
  try {
    if (!context.env.DB) {
      return new Response(JSON.stringify({ error: "D1 database not bound." }), { status: 503, headers: { "Content-Type": "application/json" } });
    }
    const body = await context.request.json<{
      traderId: string; contractId: string; symbol: string; symbolLabel: string;
      contractType: string; confidence: number; stake: number; currency: string; durationTicks: number;
    }>();
    const { traderId, contractId, symbol, symbolLabel, contractType, confidence, stake, currency, durationTicks } = body;

    if (!traderId || !contractId || !symbol || !contractType || !currency) {
      return new Response(JSON.stringify({ error: "Missing required fields" }), { status: 400, headers: { "Content-Type": "application/json" } });
    }

    // Broadcasting requires having actually opted in first -- prevents an
    // arbitrary POST from injecting fake trader activity under an unregistered ID.
    const trader = await context.env.DB.prepare("SELECT id FROM copy_traders WHERE id = ?").bind(traderId).first();
    if (!trader) {
      return new Response(JSON.stringify({ error: "traderId is not opted in" }), { status: 403, headers: { "Content-Type": "application/json" } });
    }

    await context.env.DB.prepare(
      `INSERT INTO copy_trades (trader_id, contract_id, symbol, symbol_label, contract_type, confidence, stake, currency, duration_ticks, opened_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
    ).bind(traderId, contractId, symbol, symbolLabel || symbol, contractType, Math.round(confidence), stake, currency, durationTicks, Date.now()).run();

    return new Response(JSON.stringify({ ok: true }), { status: 200, headers: { "Content-Type": "application/json" } });
  } catch (err) {
    return new Response(JSON.stringify({ error: "Broadcast failed", detail: String(err) }), { status: 500, headers: { "Content-Type": "application/json" } });
  }
};

export const onRequestPatch: PagesFunction<Env> = async (context) => {
  try {
    if (!context.env.DB) {
      return new Response(JSON.stringify({ error: "D1 database not bound." }), { status: 503, headers: { "Content-Type": "application/json" } });
    }
    const body = await context.request.json<{ contractId: string; pnl: number; won: boolean }>();
    const { contractId, pnl, won } = body;
    if (!contractId || typeof pnl !== "number") {
      return new Response(JSON.stringify({ error: "Missing required fields" }), { status: 400, headers: { "Content-Type": "application/json" } });
    }

    await context.env.DB.prepare(
      "UPDATE copy_trades SET pnl = ?, won = ?, settled_at = ? WHERE contract_id = ?"
    ).bind(pnl, won ? 1 : 0, Date.now(), contractId).run();

    return new Response(JSON.stringify({ ok: true }), { status: 200, headers: { "Content-Type": "application/json" } });
  } catch (err) {
    return new Response(JSON.stringify({ error: "Settle failed", detail: String(err) }), { status: 500, headers: { "Content-Type": "application/json" } });
  }
};
