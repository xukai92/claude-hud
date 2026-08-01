import { test } from 'node:test';
import assert from 'node:assert/strict';
import { updateAndGetMonthlyCost } from '../dist/cost-tracker.js';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

function makeDeps(tmpDir, dateStr) {
  return {
    homeDir: () => tmpDir,
    now: () => new Date(dateStr),
  };
}

test('updateAndGetMonthlyCost returns null for missing sessionId', () => {
  assert.equal(updateAndGetMonthlyCost(undefined, 1.0), null);
  assert.equal(updateAndGetMonthlyCost('', 1.0), null);
});

test('updateAndGetMonthlyCost returns null for invalid cost', () => {
  assert.equal(updateAndGetMonthlyCost('sess-1', undefined), null);
  assert.equal(updateAndGetMonthlyCost('sess-1', NaN), null);
  assert.equal(updateAndGetMonthlyCost('sess-1', -1), null);
});

test('updateAndGetMonthlyCost tracks and accumulates session costs', async () => {
  const tmpDir = await mkdtemp(join(tmpdir(), 'claude-hud-cost-'));
  const deps = makeDeps(tmpDir, '2026-07-15T12:00:00');

  try {
    const result1 = updateAndGetMonthlyCost('sess-a', 0.50, deps);
    assert.equal(result1, 0.50);

    const result2 = updateAndGetMonthlyCost('sess-b', 0.25, deps);
    assert.equal(result2, 0.75);
  } finally {
    await rm(tmpDir, { recursive: true, force: true });
  }
});

test('updateAndGetMonthlyCost uses delta accumulation for same session', async () => {
  const tmpDir = await mkdtemp(join(tmpdir(), 'claude-hud-cost-'));
  const deps = makeDeps(tmpDir, '2026-07-15T12:00:00');

  try {
    updateAndGetMonthlyCost('sess-delta', 0.10, deps);
    const result = updateAndGetMonthlyCost('sess-delta', 0.30, deps);
    assert.ok(Math.abs(result - 0.30) < 0.001);
  } finally {
    await rm(tmpDir, { recursive: true, force: true });
  }
});

test('month-boundary: session cost attributed to correct month', async () => {
  const tmpDir = await mkdtemp(join(tmpdir(), 'claude-hud-cost-'));

  try {
    const juneDeps = makeDeps(tmpDir, '2026-06-30T23:00:00');
    updateAndGetMonthlyCost('sess-span', 50.00, juneDeps);

    const julyDeps = makeDeps(tmpDir, '2026-07-01T10:00:00');
    const julyTotal = updateAndGetMonthlyCost('sess-span', 50.20, julyDeps);

    assert.ok(Math.abs(julyTotal - 0.20) < 0.001,
      `July should only show the $0.20 delta, got $${julyTotal}`);
  } finally {
    await rm(tmpDir, { recursive: true, force: true });
  }
});

test('/clear reset: near-zero cost treated as new session start', async () => {
  const tmpDir = await mkdtemp(join(tmpdir(), 'claude-hud-cost-'));
  const deps = makeDeps(tmpDir, '2026-07-15T12:00:00');

  try {
    updateAndGetMonthlyCost('sess-clear', 5.00, deps);
    // /clear resets cost to near-zero
    updateAndGetMonthlyCost('sess-clear', 0.0001, deps);
    const result = updateAndGetMonthlyCost('sess-clear', 0.50, deps);
    // Should be original 5.00 + 0.0001 (the reset) + 0.50 delta from 0.0001
    assert.ok(Math.abs(result - 5.50) < 0.01,
      `Expected ~$5.50 after /clear and new spend, got $${result}`);
  } finally {
    await rm(tmpDir, { recursive: true, force: true });
  }
});

test('interleaved terminals: cost decrease without near-zero does not double-count', async () => {
  const tmpDir = await mkdtemp(join(tmpdir(), 'claude-hud-cost-'));
  const deps = makeDeps(tmpDir, '2026-07-15T12:00:00');

  try {
    updateAndGetMonthlyCost('sess-interleave', 5.00, deps);
    // Another terminal reports lower cost (interleaving) — not a /clear
    const result = updateAndGetMonthlyCost('sess-interleave', 3.00, deps);
    // Should not add 3.00 on top; delta=0 so total stays at 5.00
    assert.equal(result, 5.00);
  } finally {
    await rm(tmpDir, { recursive: true, force: true });
  }
});

test('60-day pruning removes old entries', async () => {
  const tmpDir = await mkdtemp(join(tmpdir(), 'claude-hud-cost-'));

  try {
    // Create entry in April
    const aprilDeps = makeDeps(tmpDir, '2026-04-15T12:00:00');
    updateAndGetMonthlyCost('sess-old', 100.00, aprilDeps);

    // Query in July — April entry should be pruned
    const julyDeps = makeDeps(tmpDir, '2026-07-15T12:00:00');
    const result = updateAndGetMonthlyCost('sess-new', 1.00, julyDeps);
    assert.equal(result, 1.00);
  } finally {
    await rm(tmpDir, { recursive: true, force: true });
  }
});
