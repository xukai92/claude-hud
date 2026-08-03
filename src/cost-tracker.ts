import { existsSync, mkdirSync, readFileSync, renameSync, unlinkSync, writeFileSync } from 'node:fs';
import * as path from 'node:path';
import * as os from 'node:os';
import { getHudPluginDir } from './claude-config-dir.js';

export type CostTrackerDeps = {
  homeDir: () => string;
  now: () => Date;
};

const defaultDeps: CostTrackerDeps = {
  homeDir: () => os.homedir(),
  now: () => new Date(),
};

interface SessionEntry {
  months: Record<string, number>;
  lastCostUsd: number;
}

interface CostCache {
  sessions: Record<string, SessionEntry>;
}

function localDate(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

function localMonth(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
}

function getCachePath(homeDir: string): string {
  return path.join(getHudPluginDir(homeDir), '.cost-cache.json');
}

function readCache(homeDir: string): CostCache {
  const cachePath = getCachePath(homeDir);
  try {
    const data = JSON.parse(readFileSync(cachePath, 'utf8'));
    if (data && typeof data.sessions === 'object') return data;
  } catch { /* fall through */ }
  return { sessions: {} };
}

function writeCache(homeDir: string, data: CostCache): void {
  const cachePath = getCachePath(homeDir);
  const cacheDir = path.dirname(cachePath);
  const tmp = `${cachePath}.${process.pid}.tmp`;
  try {
    if (!existsSync(cacheDir)) mkdirSync(cacheDir, { recursive: true });
    writeFileSync(tmp, JSON.stringify(data));
    renameSync(tmp, cachePath);
  } catch {
    try { unlinkSync(tmp); } catch { /* ignore */ }
  }
}

const NEAR_ZERO = 0.001;

export function updateAndGetMonthlyCost(
  sessionId: string | undefined,
  costUsd: number | undefined,
  overrides: Partial<CostTrackerDeps> = {},
): number | null {
  if (!sessionId || costUsd == null || !Number.isFinite(costUsd) || costUsd < 0) {
    return null;
  }

  const deps = { ...defaultDeps, ...overrides };

  try {
    const now = deps.now();
    const homeDir = deps.homeDir();
    const month = localMonth(now);

    const cutoff = new Date(now.getTime());
    cutoff.setDate(cutoff.getDate() - 60);
    const cutoffMonth = localMonth(cutoff);

    const data = readCache(homeDir);

    const sessions: Record<string, SessionEntry> = {};
    for (const [id, e] of Object.entries(data.sessions ?? {})) {
      if (!e || typeof e.lastCostUsd !== 'number') continue;
      const months: Record<string, number> = {};
      let hasValidMonth = false;
      for (const [m, v] of Object.entries(e.months ?? {})) {
        if (typeof v === 'number' && Number.isFinite(v) && m >= cutoffMonth) {
          months[m] = v;
          hasValidMonth = true;
        }
      }
      if (hasValidMonth) {
        sessions[id] = { months, lastCostUsd: e.lastCostUsd };
      }
    }

    const existing = sessions[sessionId];
    const lastKnown = existing?.lastCostUsd ?? 0;

    let delta: number;
    if (!existing) {
      delta = costUsd;
    } else if (costUsd < NEAR_ZERO) {
      delta = costUsd;
    } else if (costUsd >= lastKnown) {
      delta = costUsd - lastKnown;
    } else {
      delta = 0;
    }

    if (!existing) {
      sessions[sessionId] = { months: { [month]: delta }, lastCostUsd: costUsd };
    } else {
      existing.months[month] = (existing.months[month] ?? 0) + delta;
      existing.lastCostUsd = costUsd;
    }

    const monthly = Object.values(sessions)
      .reduce((sum, e) => sum + (e.months[month] ?? 0), 0);

    writeCache(homeDir, { sessions });
    return monthly;
  } catch {
    return null;
  }
}
