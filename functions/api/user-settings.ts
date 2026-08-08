// Cloudflare Pages Function. Cross-device sync for AutoPilot config and
// Goal Mode settings, keyed by the account's real loginid (private,
// first-party data -- not the anonymous copy-trading tables).
interface Env {
  DB: D1Database;
}

export const onRequestGet: PagesFunction<Env> = async (context) => {
  try {
    if (!context.env.DB) {
      return new Response(JSON.stringify({ error: "D1 database not bound." }), { status: 503, headers: { "Content-Type": "application/json" } });
    }
    const url = new URL(context.request.url);
    const loginid = url.searchParams.get("loginid");
    if (!loginid) {
      return new Response(JSON.stringify({ error: "loginid is required" }), { status: 400, headers: { "Content-Type": "application/json" } });
    }

    const row = await context.env.DB.prepare(
      "SELECT autopilot_config, goal_settings, copy_filters, updated_at FROM user_settings WHERE loginid = ?"
    ).bind(loginid).first<{ autopilot_config: string | null; goal_settings: string | null; copy_filters: string | null; updated_at: number }>();

    return new Response(JSON.stringify({
      autopilotConfig: row?.autopilot_config ? JSON.parse(row.autopilot_config) : null,
      goalSettings: row?.goal_settings ? JSON.parse(row.goal_settings) : null,
      copyFilters: row?.copy_filters ? JSON.parse(row.copy_filters) : null,
      updatedAt: row?.updated_at ?? null,
    }), { status: 200, headers: { "Content-Type": "application/json" } });
  } catch (err) {
    return new Response(JSON.stringify({ error: "Failed to load settings", detail: String(err) }), { status: 500, headers: { "Content-Type": "application/json" } });
  }
};

export const onRequestPut: PagesFunction<Env> = async (context) => {
  try {
    if (!context.env.DB) {
      return new Response(JSON.stringify({ error: "D1 database not bound." }), { status: 503, headers: { "Content-Type": "application/json" } });
    }
    const body = await context.request.json<{ loginid: string; autopilotConfig?: unknown; goalSettings?: unknown; copyFilters?: unknown }>();
    const { loginid, autopilotConfig, goalSettings, copyFilters } = body;
    if (!loginid) {
      return new Response(JSON.stringify({ error: "loginid is required" }), { status: 400, headers: { "Content-Type": "application/json" } });
    }

    await context.env.DB.prepare(
      `INSERT INTO user_settings (loginid, autopilot_config, goal_settings, copy_filters, updated_at)
       VALUES (?, ?, ?, ?, ?)
       ON CONFLICT(loginid) DO UPDATE SET
         autopilot_config = COALESCE(excluded.autopilot_config, user_settings.autopilot_config),
         goal_settings = CASE WHEN ? THEN excluded.goal_settings ELSE user_settings.goal_settings END,
         copy_filters = COALESCE(excluded.copy_filters, user_settings.copy_filters),
         updated_at = excluded.updated_at`
    ).bind(
      loginid,
      autopilotConfig != null ? JSON.stringify(autopilotConfig) : null,
      goalSettings !== undefined ? JSON.stringify(goalSettings) : null, // goalSettings may be explicitly null (goal cleared) -- distinct from "not provided"
      copyFilters != null ? JSON.stringify(copyFilters) : null,
      Date.now(),
      goalSettings !== undefined ? 1 : 0
    ).run();

    return new Response(JSON.stringify({ ok: true }), { status: 200, headers: { "Content-Type": "application/json" } });
  } catch (err) {
    return new Response(JSON.stringify({ error: "Failed to save settings", detail: String(err) }), { status: 500, headers: { "Content-Type": "application/json" } });
  }
};
