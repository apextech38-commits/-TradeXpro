-- Smart Copy backend schema (Cloudflare D1 / SQLite dialect).
--
-- Privacy design: trader_id is a client-generated opaque UUID (crypto.randomUUID(),
-- persisted in the browser's localStorage), never a real Deriv loginid. This
-- database never receives a Deriv session token, account ID, or any other
-- real-account identifier -- only anonymous trade outcomes, which is all
-- copy-trading actually needs.
--
-- To apply: create a D1 database in the Cloudflare dashboard (Workers & Pages
-- -> D1 -> Create database), bind it to the `tradexpro` Pages project as
-- environment variable name `DB` (Settings -> Functions -> D1 database
-- bindings), then run this file's contents once via the dashboard's D1
-- Console tab (or `wrangler d1 execute <db-name> --file=migrations/0001_copy_trading.sql`
-- from a machine with Cloudflare CLI access).

CREATE TABLE IF NOT EXISTS copy_traders (
  id TEXT PRIMARY KEY,
  display_name TEXT NOT NULL,
  opted_in_at INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS copy_trades (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  trader_id TEXT NOT NULL REFERENCES copy_traders(id),
  contract_id TEXT NOT NULL,
  symbol TEXT NOT NULL,
  symbol_label TEXT NOT NULL,
  contract_type TEXT NOT NULL,       -- CALL / PUT
  confidence INTEGER NOT NULL,
  stake REAL NOT NULL,
  currency TEXT NOT NULL,
  duration_ticks INTEGER NOT NULL,
  opened_at INTEGER NOT NULL,        -- unix ms
  pnl REAL,                          -- null until settled
  won INTEGER,                       -- null until settled; 0 or 1 after
  settled_at INTEGER
);

CREATE INDEX IF NOT EXISTS idx_copy_trades_trader ON copy_trades(trader_id);
CREATE INDEX IF NOT EXISTS idx_copy_trades_opened ON copy_trades(opened_at);
CREATE UNIQUE INDEX IF NOT EXISTS idx_copy_trades_contract ON copy_trades(contract_id);
