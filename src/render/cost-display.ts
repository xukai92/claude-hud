import { getSessionCost, formatCost } from '../stdin.js';
import type { RenderContext } from '../types.js';
import { dim, yellow } from './colors.js';

export function formatCostDisplay(ctx: RenderContext): string | null {
  const cost = getSessionCost(ctx.stdin);
  if (cost === null) {
    return null;
  }
  const monthlyStr = (ctx.monthlyCost != null && ctx.monthlyCost >= 0.01)
    ? dim(` (${formatCost(ctx.monthlyCost) ?? ''} mtd)`)
    : '';
  return `${yellow(cost)}${monthlyStr}`;
}
