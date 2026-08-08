// Cloudflare Pages Function. A real, permanent record of every trade Smart
// Trader itself places (AutoPilot, Sniper, Smart Copy), keyed by the
// account's real loginid -- survives a page refresh or device change,
// unlike the in-memory session log the UI shows immediately.
interface Env {
  DB: D1Database;
}

export const onRequestPost: PagesFunction<Env> = async (context) => {
  try {
    if (!context.env.DB) {
      return new Response(JSON.stringify({ error: "D1 database not bound." }), { status: 503, headers: { "Content-Type": "application/json" } });
    }
    const body = await context.request.json<{
      loginid: string; source: string; contractId: string; symbol: string; symbolLabel: string;
      contractType: string; confidence?: number; stake: number; currency: string;
    }>();
    const { loginid, source, contractId, symbol, symbolLabel, contractType, confidence, stake, currency } = body;
    if (!loginid || !source || !contractId || !symbol || !contractType || !currency) {
      return new Response(JSON.stringify({ error: "Missing required fields" }), { status: 400, headers: { "Content-Type": "application/json" } });
    }

    await context.env.DB.prepare(
      `INSERT INTO trade_journal (loginid, source, contract_id, symbol, symbol_label, contract_type, confidence, stake, currency, opened_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
    ).bind(loginid, source, contractId, symbol, symbolLabel || symbol, contractType, confidence ?? null, stake, currency, Date.now()).run();

    return new Response(JSON.stringify({ ok: true }), { status: 200, headers: { "Content-Type": "application/json" } });
  } catch (err) {
    return new Response(JSON.stringify({ error: "Journal entry failed", detail: String(err) }), { status: 500, headers: { "Content-Type": "application/json" } });
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
      "UPDATE trade_journal SET pnl = ?, won = ?, settled_at = ? WHERE contract_id = ?"
    ).bind(pnl, won ? 1 : 0, Date.now(), contractId).run();

    return new Response(JSON.stringify({ ok: true }), { status: 200, headers: { "Content-Type": "application/json" } });
  } catch (err) {
    return new Response(JSON.stringify({ error: "Settle failed", detail: String(err) }), { status: 500, headers: { "Content-Type": "application/json" } });
  }
};

export const onRequestGet: PagesFunction<Env> = async (context) => {
  try {
    if (!context.env.DB) {
      return new Response(JSON.stringify({ error: "D1 database not bound." }), { status: 503, headers: { "Content-Type": "application/json" } });
    }
    const url = new URL(context.request.url);
    const loginid = url.searchParams.get("loginid");
    const limit = Math.min(200, Number(url.searchParams.get("limit") ?? "50"));
    if (!loginid) {
      return new Response(JSON.stringify({ error: "loginid is required" }), { status: 400, headers: { "Content-Type": "application/json" } });
    }

    const { results } = await context.env.DB.prepare(
      `SELECT source, contract_id AS contractId, symbol, symbol_label AS symbolLabel, contract_type AS contractType,
              confidence, stake, currency, opened_at AS openedAt, pnl, won, settled_at AS settledAt
       FROM trade_journal WHERE loginid = ? ORDER BY opened_at DESC LIMIT ?`
    ).bind(loginid, limit).all();

    return new Response(JSON.stringify({ entries: results ?? [] }), { status: 200, headers: { "Content-Type": "application/json" } });
  } catch (err) {
    return new Response(JSON.stringify({ error: "Failed to load journal", detail: String(err) }), { status: 500, headers: { "Content-Type": "application/json" } });
  }
};
