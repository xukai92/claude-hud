import { test } from 'node:test';
import assert from 'node:assert/strict';
import { updateAndGetMonthlyCost } from '../dist/cost-tracker.js';
import { mkdtemp, rm, readFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

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
  const originalHome = process.env.HOME;
  process.env.HOME = tmpDir;

  try {
    const result1 = updateAndGetMonthlyCost('sess-a', 0.50);
    assert.equal(typeof result1, 'number');
    assert.ok(result1 >= 0.50);

    const result2 = updateAndGetMonthlyCost('sess-b', 0.25);
    assert.equal(typeof result2, 'number');
    assert.ok(result2 >= 0.75);
  } finally {
    process.env.HOME = originalHome;
    await rm(tmpDir, { recursive: true, force: true });
  }
});

test('updateAndGetMonthlyCost uses delta accumulation for same session', async () => {
  const tmpDir = await mkdtemp(join(tmpdir(), 'claude-hud-cost-'));
  const originalHome = process.env.HOME;
  process.env.HOME = tmpDir;

  try {
    updateAndGetMonthlyCost('sess-delta', 0.10);
    const result = updateAndGetMonthlyCost('sess-delta', 0.30);
    assert.equal(typeof result, 'number');
    // Should be 0.30 (delta from 0.10 to 0.30 is 0.20, plus original 0.10)
    assert.ok(Math.abs(result - 0.30) < 0.001);
  } finally {
    process.env.HOME = originalHome;
    await rm(tmpDir, { recursive: true, force: true });
  }
});
