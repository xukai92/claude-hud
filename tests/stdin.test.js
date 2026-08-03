import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readStdin, getSessionCost, formatCost } from '../dist/stdin.js';

test('readStdin returns null for TTY input', async () => {
  const originalIsTTY = process.stdin.isTTY;
  Object.defineProperty(process.stdin, 'isTTY', { value: true, configurable: true });

  try {
    const result = await readStdin();
    assert.equal(result, null);
  } finally {
    Object.defineProperty(process.stdin, 'isTTY', { value: originalIsTTY, configurable: true });
  }
});

test('readStdin returns null on stream errors', async () => {
  const originalIsTTY = process.stdin.isTTY;
  const originalSetEncoding = process.stdin.setEncoding;
  Object.defineProperty(process.stdin, 'isTTY', { value: false, configurable: true });
  process.stdin.setEncoding = () => {
    throw new Error('boom');
  };

  try {
    const result = await readStdin();
    assert.equal(result, null);
  } finally {
    process.stdin.setEncoding = originalSetEncoding;
    Object.defineProperty(process.stdin, 'isTTY', { value: originalIsTTY, configurable: true });
  }
});

test('getSessionCost returns null when cost is missing', () => {
  assert.equal(getSessionCost({}), null);
  assert.equal(getSessionCost({ cost: {} }), null);
  assert.equal(getSessionCost({ cost: { total_cost_usd: undefined } }), null);
});

test('getSessionCost returns null for NaN cost', () => {
  assert.equal(getSessionCost({ cost: { total_cost_usd: NaN } }), null);
});

test('getSessionCost returns null for negative cost', () => {
  assert.equal(getSessionCost({ cost: { total_cost_usd: -1 } }), null);
});

test('getSessionCost formats small costs as <$0.01', () => {
  assert.equal(getSessionCost({ cost: { total_cost_usd: 0 } }), '<$0.01');
  assert.equal(getSessionCost({ cost: { total_cost_usd: 0.005 } }), '<$0.01');
});

test('getSessionCost formats normal costs with 2 decimal places', () => {
  assert.equal(getSessionCost({ cost: { total_cost_usd: 0.15 } }), '$0.15');
  assert.equal(getSessionCost({ cost: { total_cost_usd: 1.5 } }), '$1.50');
  assert.equal(getSessionCost({ cost: { total_cost_usd: 12.345 } }), '$12.35');
});

test('formatCost returns null for null, undefined, NaN, and negative', () => {
  assert.equal(formatCost(null), null);
  assert.equal(formatCost(undefined), null);
  assert.equal(formatCost(NaN), null);
  assert.equal(formatCost(-5), null);
});

test('formatCost formats values correctly', () => {
  assert.equal(formatCost(0), '<$0.01');
  assert.equal(formatCost(0.005), '<$0.01');
  assert.equal(formatCost(0.15), '$0.15');
  assert.equal(formatCost(42.99), '$42.99');
});
