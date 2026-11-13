import { mkdirSync, readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

const INPUT_DIR = process.env.MAKEFUN_INPUT_DIR ?? '/input';
const OUTPUT_DIR = process.env.MAKEFUN_OUTPUT_DIR ?? '/output';
const LEVELS = [0.05, 0.25, 0.5, 0.75, 0.95];
const HISTORY = 2_880;
const MOVE_SCALE = 0.4;
const SAMPLE_STRIDE_DIVISOR = 4;
const VOLATILITY_WINDOW = 120;
const VOLATILITY_EXPONENT = 0.25;

type Market = { id: string; prices: number[] };
type ForecastCase = { horizon_minutes: number; quantiles: number[]; markets: Market[] };

function quantile(sorted: number[], p: number): number {
  const position = (sorted.length - 1) * p;
  const lower = Math.floor(position);
  const fraction = position - lower;
  return sorted[lower] * (1 - fraction) + sorted[Math.min(lower + 1, sorted.length - 1)] * fraction;
}

function forecast(market: Market, horizon: number): number[][] {
  const prices = market.prices;
  if (!prices.length) throw new Error(`market ${market.id} has no price history`);
  const n = prices.length;
  const last = prices[n - 1];
  const first = Math.max(0, n - HISTORY);
  let recentSquares = 0;
  let historySquares = 0;
  const recentStart = Math.max(first + 1, n - VOLATILITY_WINDOW);
  for (let i = first + 1; i < n; i++) historySquares += (prices[i] - prices[i - 1]) ** 2;
  for (let i = recentStart; i < n; i++) recentSquares += (prices[i] - prices[i - 1]) ** 2;
  const recentVol = Math.sqrt(recentSquares / Math.max(1, n - recentStart));
  const historyVol = Math.sqrt(historySquares / Math.max(1, n - first - 1));
  const activity = Math.min(2, Math.max(0.5, ((recentVol + 1e-8) / (historyVol + 1e-8)) ** VOLATILITY_EXPONENT));
  const rows: number[][] = [];

  for (let h = 1; h <= horizon; h++) {
    const changes: number[] = [];
    const stride = Math.max(1, Math.floor(h / SAMPLE_STRIDE_DIVISOR));
    for (let start = first; start + h < n; start += stride) {
      changes.push(prices[start + h] - prices[start]);
    }
    if (changes.length < 12) {
      for (let start = Math.max(0, n - 1 - h); start + h < n; start++) {
        changes.push(prices[start + h] - prices[start]);
      }
    }
    changes.sort((a, b) => a - b);
    rows.push(LEVELS.map((level) => {
      const value = last + MOVE_SCALE * activity * quantile(changes, level);
      return Math.round(Math.min(1, Math.max(0, value)) * 1e6) / 1e6;
    }));
  }
  return rows;
}

mkdirSync(OUTPUT_DIR, { recursive: true });
for (const file of readdirSync(INPUT_DIR).filter((name) => name.endsWith('.in')).sort()) {
  const id = file.slice(0, -3);
  const input = JSON.parse(readFileSync(join(INPUT_DIR, file), 'utf8')) as ForecastCase;
  if (input.quantiles.length !== LEVELS.length || input.quantiles.some((q, i) => q !== LEVELS[i])) {
    throw new Error(`${file} has unsupported quantiles`);
  }
  const forecasts = input.markets.map((market) => ({ id: market.id, q: forecast(market, input.horizon_minutes) }));
  writeFileSync(join(OUTPUT_DIR, `${id}.out`), `${JSON.stringify({ forecasts })}\n`);
}
