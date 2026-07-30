import { existsSync, mkdirSync, readFileSync, renameSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { getHudPluginDir } from './claude-config-dir.js';
import { homedir } from 'node:os';

interface SessionEntry {
  cost: number;
  lastCostUsd: number;
  date: string;
}

interface CostCache {
  sessions: Record<string, SessionEntry>;
}

function getCachePath(): string {
  return join(getHudPluginDir(homedir()), '.cost-cache.json');
}

function readCache(): CostCache {
  const cachePath = getCachePath();
  for (let attempt = 0; attempt < 2; attempt++) {
    try {
      const data = JSON.parse(readFileSync(cachePath, 'utf8'));
      if (data && typeof data.sessions === 'object') return data;
    } catch { /* retry */ }
  }
  return { sessions: {} };
}

function writeCache(data: CostCache): void {
  const cachePath = getCachePath();
  const dir = join(cachePath, '..');
  const tmp = `${cachePath}.${process.pid}.tmp`;
  try {
    if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
    writeFileSync(tmp, JSON.stringify(data));
    renameSync(tmp, cachePath);
  } catch { /* stale cache is better than a crash */ }
}

export function updateAndGetMonthlyCost(sessionId: string | undefined, costUsd: number | undefined): number | null {
  if (!sessionId || costUsd == null || !Number.isFinite(costUsd) || costUsd < 0) {
    return null;
  }

  try {
    const today = new Date().toISOString().slice(0, 10);
    const month = today.slice(0, 7);
    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() - 60);
    const cutoffStr = cutoff.toISOString().slice(0, 10);

    const data = readCache();

    const sessions: Record<string, SessionEntry> = {};
    for (const [id, e] of Object.entries(data.sessions ?? {})) {
      if (typeof e?.cost === 'number' && Number.isFinite(e.cost)
          && typeof e?.date === 'string' && e.date >= cutoffStr) {
        sessions[id] = e;
      }
    }

    const existing = sessions[sessionId];
    const lastKnown = existing?.lastCostUsd ?? existing?.cost ?? 0;
    const newCost = !existing ? costUsd
      : costUsd >= lastKnown ? existing.cost + (costUsd - lastKnown)
      : existing.cost + costUsd;
    sessions[sessionId] = { cost: newCost, lastCostUsd: costUsd, date: today };

    const monthly = Object.values(sessions)
      .filter(e => e.date.startsWith(month))
      .reduce((sum, e) => sum + e.cost, 0);

    writeCache({ sessions });
    return monthly;
  } catch {
    return null;
  }
}
