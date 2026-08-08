-- User settings sync (AutoPilot config, Goal Mode) and a real, permanent
-- trade journal for every trade Smart Trader itself executes (AutoPilot,
-- Sniper, Smart Copy). Keyed by the account's real Deriv loginid --
-- unlike copy_trading's deliberately-anonymous tables, this is private,
-- first-party account data, not public, so there's no reason to anonymize it.

CREATE TABLE IF NOT EXISTS user_settings (
  loginid TEXT PRIMARY KEY,
  autopilot_config TEXT,   -- JSON blob, same shape as AutoPilotConfig
  goal_settings TEXT,      -- JSON blob, same shape as GoalSettings, nullable
  copy_filters TEXT,       -- JSON blob, same shape as CopyFilters
  updated_at INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS trade_journal (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  loginid TEXT NOT NULL,
  source TEXT NOT NULL,          -- 'AutoPilot' | 'Sniper' | 'SmartCopy'
  contract_id TEXT NOT NULL,
  symbol TEXT NOT NULL,
  symbol_label TEXT NOT NULL,
  contract_type TEXT NOT NULL,
  confidence INTEGER,
  stake REAL NOT NULL,
  currency TEXT NOT NULL,
  opened_at INTEGER NOT NULL,
  pnl REAL,
  won INTEGER,
  settled_at INTEGER
);

CREATE INDEX IF NOT EXISTS idx_trade_journal_loginid ON trade_journal(loginid);
CREATE INDEX IF NOT EXISTS idx_trade_journal_opened ON trade_journal(opened_at);
CREATE UNIQUE INDEX IF NOT EXISTS idx_trade_journal_contract ON trade_journal(contract_id);
