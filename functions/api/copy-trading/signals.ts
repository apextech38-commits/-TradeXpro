// Cloudflare Pages Function. Returns real, recent, still-open trade
// broadcasts from opted-in traders whose real computed win rate meets the
// caller's filter -- nothing here is synthesized. Given how short these
// contracts run (a handful of ticks), only broadcasts from the last 15
// seconds are returned as "still actionable"; anything older is stale by
// the time a copier could react to it and is excluded rather than shown
// misleadingly as live.
interface Env {
  DB: D1Database;
}

const STALE_AFTER_MS = 15_000;

export const onRequestGet: PagesFunction<Env> = async (context) => {
  try {
    if (!context.env.DB) {
      return new Response(JSON.stringify({ error: "D1 database not bound." }), { status: 503, headers: { "Content-Type": "application/json" } });
    }

    const url = new URL(context.request.url);
    const minConfidence = Number(url.searchParams.get("minConfidence") ?? "0");
    const minWinRate = Number(url.searchParams.get("minWinRate") ?? "0");
    const since = Date.now() - STALE_AFTER_MS;

    const { results } = await context.env.DB.prepare(
      `SELECT
         c.contract_id AS contractId, c.symbol, c.symbol_label AS symbolLabel,
         c.contract_type AS contractType, c.confidence, c.opened_at AS openedAt,
         t.id AS traderId, t.display_name AS traderName,
         (SELECT COUNT(*) FROM copy_trades c2 WHERE c2.trader_id = t.id AND c2.won IS NOT NULL) AS settled,
         (SELECT SUM(CASE WHEN won = 1 THEN 1 ELSE 0 END) FROM copy_trades c2 WHERE c2.trader_id = t.id AND c2.won IS NOT NULL) AS wins
       FROM copy_trades c
       JOIN copy_traders t ON t.id = c.trader_id
       WHERE c.opened_at >= ? AND c.pnl IS NULL AND c.confidence >= ?
       ORDER BY c.opened_at DESC
       LIMIT 50`
    ).bind(since, Math.round(minConfidence)).all();

    const signals = (results ?? [])
      .map((r: any) => {
        const settled = r.settled ?? 0;
        const winRatePct = settled > 0 ? Math.round(((r.wins ?? 0) / settled) * 100) : null;
        return { ...r, winRatePct };
      })
      .filter((s: any) => s.winRatePct != null && s.winRatePct >= minWinRate);

    return new Response(JSON.stringify({ signals }), { status: 200, headers: { "Content-Type": "application/json" } });
  } catch (err) {
    return new Response(JSON.stringify({ error: "Failed to load signals", detail: String(err) }), { status: 500, headers: { "Content-Type": "application/json" } });
  }
};
