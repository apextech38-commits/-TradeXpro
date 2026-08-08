// Cloudflare Pages Function. Requires a D1 binding named `DB` on the
// `tradexpro` Pages project (see migrations/0001_copy_trading.sql for setup).
//
// Registers an anonymous trader ID as a followable copy-trading source.
// traderId is generated client-side (crypto.randomUUID()) -- this endpoint
// never receives, and this database never stores, any real Deriv account
// identifier.
interface Env {
  DB: D1Database;
}

export const onRequestPost: PagesFunction<Env> = async (context) => {
  try {
    if (!context.env.DB) {
      return new Response(JSON.stringify({ error: "D1 database not bound. See migrations/0001_copy_trading.sql." }), {
        status: 503,
        headers: { "Content-Type": "application/json" },
      });
    }

    const body = await context.request.json<{ traderId: string; displayName: string }>();
    const { traderId, displayName } = body;

    if (!traderId || typeof traderId !== "string" || traderId.length > 64) {
      return new Response(JSON.stringify({ error: "Missing or invalid traderId" }), {
        status: 400,
        headers: { "Content-Type": "application/json" },
      });
    }
    const cleanName = (displayName || "Trader").toString().slice(0, 40);

    await context.env.DB.prepare(
      "INSERT INTO copy_traders (id, display_name, opted_in_at) VALUES (?, ?, ?) " +
      "ON CONFLICT(id) DO UPDATE SET display_name = excluded.display_name"
    ).bind(traderId, cleanName, Date.now()).run();

    return new Response(JSON.stringify({ ok: true }), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  } catch (err) {
    return new Response(JSON.stringify({ error: "Opt-in failed", detail: String(err) }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }
};
