// Cloudflare Pages Function. Real aggregate query over actually-settled
// trades -- no trader appears here without at least one real settled trade,
// and win rate is computed directly from wins/settled, not stored or
// fabricated separately.
interface Env {
  DB: D1Database;
}

export const onRequestGet: PagesFunction<Env> = async (context) => {
  try {
    if (!context.env.DB) {
      return new Response(JSON.stringify({ error: "D1 database not bound." }), { status: 503, headers: { "Content-Type": "application/json" } });
    }

    const { results } = await context.env.DB.prepare(
      `SELECT
         t.id AS traderId,
         t.display_name AS displayName,
         COUNT(c.id) AS totalTrades,
         SUM(CASE WHEN c.won IS NOT NULL THEN 1 ELSE 0 END) AS settledTrades,
         SUM(CASE WHEN c.won = 1 THEN 1 ELSE 0 END) AS wins,
         SUM(CASE WHEN c.pnl IS NOT NULL THEN c.pnl ELSE 0 END) AS totalPnl
       FROM copy_traders t
       JOIN copy_trades c ON c.trader_id = t.id
       GROUP BY t.id
       HAVING settledTrades > 0
       ORDER BY (CAST(wins AS REAL) / settledTrades) DESC
       LIMIT 20`
    ).all();

    const traders = (results ?? []).map((r: any) => ({
      traderId: r.traderId,
      displayName: r.displayName,
      totalTrades: r.totalTrades,
      settledTrades: r.settledTrades,
      winRatePct: r.settledTrades > 0 ? Math.round((r.wins / r.settledTrades) * 100) : null,
      totalPnl: r.totalPnl,
    }));

    return new Response(JSON.stringify({ traders }), { status: 200, headers: { "Content-Type": "application/json" } });
  } catch (err) {
    return new Response(JSON.stringify({ error: "Failed to load traders", detail: String(err) }), { status: 500, headers: { "Content-Type": "application/json" } });
  }
};
