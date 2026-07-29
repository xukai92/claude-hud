import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readStdin, getSessionCost } from '../dist/stdin.js';

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
  assert.equal(getSessionCost({ context_window: {} }), null);
  assert.equal(getSessionCost({ context_window: { cost: null } }), null);
  assert.equal(getSessionCost({ context_window: { cost: undefined } }), null);
});

test('getSessionCost returns null for NaN cost', () => {
  assert.equal(getSessionCost({ context_window: { cost: NaN } }), null);
});

test('getSessionCost formats small costs as <$0.01', () => {
  assert.equal(getSessionCost({ context_window: { cost: 0 } }), '<$0.01');
  assert.equal(getSessionCost({ context_window: { cost: 0.005 } }), '<$0.01');
});

test('getSessionCost formats normal costs with 2 decimal places', () => {
  assert.equal(getSessionCost({ context_window: { cost: 0.15 } }), '$0.15');
  assert.equal(getSessionCost({ context_window: { cost: 1.5 } }), '$1.50');
  assert.equal(getSessionCost({ context_window: { cost: 12.345 } }), '$12.35');
});
