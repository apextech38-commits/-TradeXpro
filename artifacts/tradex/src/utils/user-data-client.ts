// Real client for functions/api/user-settings.ts and functions/api/trade-journal.ts.
// Everything here is best-effort: a backend hiccup must never block a real
// trade or leave settings unusable -- localStorage remains the fast,
// synchronous source of truth in the UI; these calls sync it to D1 for
// cross-device persistence and a permanent audit trail on top.

export interface RemoteSettings {
  autopilotConfig: unknown | null;
  goalSettings: unknown | null;
  copyFilters: unknown | null;
  updatedAt: number | null;
}

export async function loadUserSettings(loginid: string): Promise<RemoteSettings | null> {
  try {
    const res = await fetch(`/api/user-settings?loginid=${encodeURIComponent(loginid)}`);
    if (!res.ok) return null;
    return (await res.json()) as RemoteSettings;
  } catch {
    return null;
  }
}

export async function saveUserSettings(loginid: string, patch: { autopilotConfig?: unknown; goalSettings?: unknown; copyFilters?: unknown }): Promise<void> {
  try {
    await fetch("/api/user-settings", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ loginid, ...patch }),
    });
  } catch {
    // Best-effort -- localStorage already has the authoritative local copy.
  }
}

export interface JournalEntryArgs {
  loginid: string; source: "AutoPilot" | "Sniper" | "SmartCopy";
  contractId: string; symbol: string; symbolLabel: string; contractType: string;
  confidence?: number; stake: number; currency: string;
}
export async function logJournalEntry(args: JournalEntryArgs): Promise<void> {
  try {
    await fetch("/api/trade-journal", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(args),
    });
  } catch {
    // Best-effort.
  }
}

export async function settleJournalEntry(contractId: string, pnl: number, won: boolean): Promise<void> {
  try {
    await fetch("/api/trade-journal", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ contractId, pnl, won }),
    });
  } catch {
    // Best-effort.
  }
}

export interface JournalEntry {
  source: string; contractId: string; symbol: string; symbolLabel: string; contractType: string;
  confidence: number | null; stake: number; currency: string; openedAt: number; pnl: number | null; won: number | null; settledAt: number | null;
}
export async function fetchJournal(loginid: string, limit = 50): Promise<JournalEntry[]> {
  const res = await fetch(`/api/trade-journal?loginid=${encodeURIComponent(loginid)}&limit=${limit}`);
  if (!res.ok) throw new Error("Failed to load trade journal.");
  const data = (await res.json()) as { entries: JournalEntry[] };
  return data.entries;
}
