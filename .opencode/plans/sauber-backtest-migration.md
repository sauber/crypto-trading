# Migration: @sauber/backtest Integration

## Overview

Replace the 6-role pipeline with a unified @sauber/backtest architecture. Strategies become native `(tick, cash, instruments, portfolio) => Order[]` functions. Backtest uses `Backtest` class. Live engine calls the same strategy functions with live data.

---

## New Files

### 1. `src/backtest/ranked-instrument.ts`

```typescript
import { Instrument, type Series } from "@sauber/backtest";
import type { Kline } from "../kucoin/mod.ts";

export class RankedInstrument extends Instrument {
  readonly rankSeries: Series;
  readonly rankChangeSeries: Series;
  readonly klines: Kline[];
  readonly volumes: Series;

  constructor(
    series: Series,
    start: number,
    symbol: string,
    rankSeries: Series,
    rankChangeSeries: Series,
    klines: Kline[],
    volumes: Series,
    name?: string,
  ) {
    super(series, start, symbol, name);
    this.rankSeries = rankSeries;
    this.rankChangeSeries = rankChangeSeries;
    this.klines = klines;
    this.volumes = volumes;
  }

  rank(tick: number): number {
    if (tick < 0 || tick >= this.length) return NaN;
    return this.rankSeries[tick];
  }

  rankChange(tick: number): number {
    if (tick < 1 || tick >= this.length) return 0;
    return this.rankChangeSeries[tick];
  }
}
```

### 2. `src/backtest/tick-converter.ts`

```typescript
import type { Kline } from "../kucoin/mod.ts";

export class TickConverter {
  private timestamps: Float64Array;

  constructor(klines: Map<string, Kline[]>, referenceCoin: string) {
    const bars = klines.get(referenceCoin);
    if (!bars) throw new Error(`Reference coin ${referenceCoin} not found`);
    this.timestamps = new Float64Array(bars.map((b) => b.timestamp));
  }

  tickToDate(tick: number): Date {
    return new Date(this.timestamps[tick] ?? 0);
  }

  tickToISO(tick: number): string {
    return this.tickToDate(tick).toISOString();
  }

  dateToTick(date: Date): number {
    const ts = date.getTime();
    let lo = 0;
    let hi = this.timestamps.length - 1;
    while (lo < hi) {
      const mid = (lo + hi) >>> 1;
      if (this.timestamps[mid] < ts) lo = mid + 1;
      else hi = mid;
    }
    return lo;
  }

  length(): number {
    return this.timestamps.length;
  }
}
```

### 3. `src/backtest/market.ts`

```typescript
import { Market } from "@sauber/backtest";
import type { Kline } from "../kucoin/mod.ts";
import { RankedInstrument } from "./ranked-instrument.ts";
import { TickConverter } from "./tick-converter.ts";

export interface MarketData {
  market: Market;
  converter: TickConverter;
  minBars: number;
}

export function buildMarketData(
  klines: Map<string, Kline[]>,
  coins: string[],
): MarketData {
  const barCounts = coins.map((c) => (klines.get(c) || []).length);
  const minBars = Math.min(...barCounts);
  if (minBars < 2) throw new Error(`Not enough data: need >=2 bars, got ${minBars}`);

  // Pre-compute ranks for each tick
  const rankData = new Map<string, Float32Array>();
  const rankChangeData = new Map<string, Float32Array>();
  for (const coin of coins) {
    rankData.set(coin, new Float32Array(minBars));
    rankChangeData.set(coin, new Float32Array(minBars));
  }

  for (let tick = 0; tick < minBars; tick++) {
    const scored = coins.map((coin) => {
      const bar = (klines.get(coin) || [])[tick];
      return { coin, score: bar ? bar.volume * bar.close : 0 };
    });
    scored.sort((a, b) => b.score - a.score);
    for (let r = 0; r < scored.length; r++) {
      rankData.get(scored[r].coin)![tick] = r + 1;
    }
  }

  for (const coin of coins) {
    const r = rankData.get(coin)!;
    const rc = rankChangeData.get(coin)!;
    rc[0] = 0;
    for (let tick = 1; tick < minBars; tick++) {
      rc[tick] = r[tick - 1] - r[tick];
    }
  }

  const instruments = [...klines.keys()].map((symbol) => {
    const bars = klines.get(symbol)!;
    return new RankedInstrument(
      new Float32Array(bars.map((b) => b.close)),
      0,
      symbol,
      rankData.get(symbol) ?? new Float32Array(minBars),
      rankChangeData.get(symbol) ?? new Float32Array(minBars),
      bars,
      new Float32Array(bars.map((b) => b.volume)),
    );
  });

  return {
    market: new Market(instruments),
    converter: new TickConverter(klines, coins[0]),
    minBars,
  };
}
```

### 4. `src/backtest/result.ts`

```typescript
import type { Backtest, Strategy } from "@sauber/backtest";
import type { TickConverter } from "./tick-converter.ts";

export interface TradeRecord {
  entryTime: string;
  exitTime: string;
  entryPrice: number;
  exitPrice: number;
  pnlPct: number;
  bars: number;
  reason: string;
  symbol: string;
}

export interface BacktestResults {
  equityCurve: number[];
  trades: TradeRecord[];
  totalReturn: number;
  maxDrawdown: number;
  sharpeRatio: number;
  winRate: number;
  profitFactor: number;
  totalTrades: number;
}

export interface ReasonLogEntry {
  tick: number;
  symbol: string;
  reason: string;
  type: "buy" | "sell";
}

function getReasonLog(strategy: Strategy): ReasonLogEntry[] {
  return ((strategy as unknown as Record<string, unknown>).reasonLog ?? []) as ReasonLogEntry[];
}

export function collectResults(
  backtest: Backtest,
  strategy: Strategy,
  converter: TickConverter,
  initialCapital: number,
): BacktestResults {
  const reasonLog = getReasonLog(strategy);
  const equityCurve = Array.from(backtest.value);
  const trades = backtest.transactions.map((tx) => {
    const logEntry = reasonLog.find(
      (r) => r.tick === tx.end && r.symbol === tx.instrument.symbol && r.type === "sell",
    );
    return {
      entryTime: converter.tickToISO(tx.start),
      exitTime: converter.tickToISO(tx.end),
      entryPrice: tx.invested / tx.quantity,
      exitPrice: (tx.invested + tx.profit) / tx.quantity,
      pnlPct: (tx.profit / tx.invested) * 100,
      bars: tx.end - tx.start,
      reason: logEntry?.reason ?? tx.reason,
      symbol: tx.instrument.symbol,
    } satisfies TradeRecord;
  });

  const wins = trades.filter((t) => t.pnlPct > 0);
  const losses = trades.filter((t) => t.pnlPct <= 0);
  const totalReturn = ((equityCurve[equityCurve.length - 1] - initialCapital) / initialCapital) * 100;
  const totalProfits = wins.reduce((s, t) => s + t.pnlPct, 0);
  const totalLosses = Math.abs(losses.reduce((s, t) => s + t.pnlPct, 0));
  const profitFactor = totalLosses > 0 ? totalProfits / totalLosses : totalProfits > 0 ? Infinity : 0;
  const winRate = trades.length > 0 ? (wins.length / trades.length) * 100 : 0;

  let peak = initialCapital;
  let maxDD = 0;
  for (const v of equityCurve) {
    if (v > peak) peak = v;
    const dd = (peak - v) / peak;
    if (dd > maxDD) maxDD = dd;
  }

  const returns = equityCurve.slice(1).map((e, i) => (e - equityCurve[i]) / equityCurve[i]);
  const avgReturn = returns.length > 0 ? returns.reduce((a, b) => a + b, 0) / returns.length : 0;
  const variance = returns.reduce((s, r) => s + (r - avgReturn) ** 2, 0) / returns.length;
  const stdDev = Math.sqrt(variance);
  const sharpeRatio = stdDev > 0 ? (avgReturn / stdDev) * Math.sqrt(365 * 24) : 0;

  return { equityCurve, trades, totalReturn, maxDrawdown: maxDD * 100, sharpeRatio, winRate, profitFactor, totalTrades: trades.length };
}

export function evaluate(results: BacktestResults): number {
  const r = results.totalReturn;
  const pf = results.profitFactor === Infinity ? 10 : results.profitFactor;
  const dd = results.maxDrawdown;
  const ddPenalty = dd > 0 ? 1 / (1 + dd / 100) : 1;
  return r * pf * ddPenalty;
}

export function display(strategy: Strategy, results: BacktestResults): string {
  const lines: string[] = [];
  lines.push(`=== Backtest: ${strategy.name ?? "unknown"} ===`);
  lines.push(`Return:  ${results.totalReturn > 0 ? "+" : ""}${results.totalReturn.toFixed(2)}%`);
  lines.push(`Sharpe:  ${results.sharpeRatio.toFixed(2)}`);
  lines.push(`Max DD:  ${results.maxDrawdown.toFixed(2)}%`);
  lines.push(`Win Rate: ${results.winRate.toFixed(1)}%  (${results.totalTrades} trades)`);
  lines.push(`PF:      ${results.profitFactor === Infinity ? "∞" : results.profitFactor.toFixed(2)}`);
  if (results.trades.length > 0) {
    lines.push("", `=== Transactions (${results.trades.length}) ===`);
    const wins = results.trades.filter((t) => t.pnlPct > 0).length;
    lines.push(`W/L: ${wins}/${results.trades.length - wins}`, "");
    const header = `${"#".padEnd(4)} ${"Symbol".padEnd(14)} ${"P/L %".padEnd(9)} ${"Bars".padEnd(5)} Reason`;
    lines.push(header, "-".repeat(header.length));
    for (let i = 0; i < results.trades.length; i++) {
      const t = results.trades[i];
      const pnl = t.pnlPct > 0 ? `+${t.pnlPct.toFixed(2)}` : t.pnlPct.toFixed(2);
      lines.push(`${(i + 1).toString().padEnd(4)} ${t.symbol.padEnd(14)} ${pnl.padEnd(9)} ${t.bars.toString().padEnd(5)} ${t.reason}`);
    }
    const sorted = [...results.trades].sort((a, b) => b.pnlPct - a.pnlPct);
    lines.push("", "Top 5 winners:");
    for (const t of sorted.slice(0, 5)) lines.push(`  +${t.pnlPct.toFixed(2)}% ${t.symbol} (${t.reason})`);
    lines.push("", "Top 5 losers:");
    for (const t of sorted.slice(-5).reverse()) lines.push(`  ${t.pnlPct.toFixed(2)}% ${t.symbol} (${t.reason})`);
  }
  return lines.join("\n");
}
```

### 5. `src/backtest/mod.ts`

```typescript
import { Backtest } from "@sauber/backtest";
import type { Market, Strategy } from "@sauber/backtest";
import type { Kline } from "../kucoin/mod.ts";
import { buildMarketData } from "./market.ts";
import { collectResults, evaluate, display } from "./result.ts";

export type { BacktestResults, TradeRecord } from "./result.ts";
export { RankedInstrument } from "./ranked-instrument.ts";
export { TickConverter } from "./tick-converter.ts";
export { evaluate, display };

async function loadKlines(): Promise<{ klines: Map<string, Kline[]>; coins: string[] }> {
  const raw = await Deno.readTextFile("data/klines.json");
  const parsed = JSON.parse(raw);
  const klines = new Map<string, Kline[]>();
  for (const [symbol, bars] of Object.entries(parsed.klines)) {
    klines.set(symbol, bars as Kline[]);
  }
  for (const [, bars] of klines) bars.sort((a, b) => a.timestamp - b.timestamp);
  return { klines, coins: parsed.coins as string[] };
}

export async function loadMarket(): Promise<Market> {
  const { klines, coins } = await loadKlines();
  const { market } = buildMarketData(klines, coins);
  return market;
}

export function backtest(market: Market, strategy: Strategy, cash: number, fee: number): BacktestResults {
  const bt = new Backtest(market, strategy, cash, fee, fee);
  bt.run();
  // Rebuild converter for timestamp mapping — load from cache
  const { klines, coins } = await loadKlines();
  const { converter } = buildMarketData(klines, coins);
  return collectResults(bt, strategy, converter, cash);
}
```

Wait — `backtest` needs to build the converter but it also needs access to the klines data. The simplest approach: pass the converter into `backtest`, or have `loadMarket` return it alongside. But the user's API is `backtest(market, strategy, cash, fee)`. We need the converter internally.

**Fix:** The `backtest` function can also load klines internally, or better, we cache the klines after `loadMarket` so `backtest` can reuse them.

Actually, the simplest fix: `loadMarket` caches klines globally, `backtest` reads from cache.

**Revised `src/backtest/mod.ts`:**

```typescript
import { Backtest } from "@sauber/backtest";
import type { Market, Strategy } from "@sauber/backtest";
import type { Kline } from "../kucoin/mod.ts";
import { buildMarketData } from "./market.ts";
import { collectResults, evaluate, display } from "./result.ts";

export type { BacktestResults, TradeRecord } from "./result.ts";
export { RankedInstrument } from "./ranked-instrument.ts";
export { TickConverter } from "./tick-converter.ts";
export { evaluate, display };

let _cache: { klines: Map<string, Kline[]>; coins: string[] } | null = null;

async function getData(): Promise<{ klines: Map<string, Kline[]>; coins: string[] }> {
  if (_cache) return _cache;
  const raw = await Deno.readTextFile("data/klines.json");
  const parsed = JSON.parse(raw);
  const klines = new Map<string, Kline[]>();
  for (const [symbol, bars] of Object.entries(parsed.klines)) {
    klines.set(symbol, bars as Kline[]);
  }
  for (const [, bars] of klines) bars.sort((a, b) => a.timestamp - b.timestamp);
  _cache = { klines, coins: parsed.coins as string[] };
  return _cache;
}

export async function loadMarket(): Promise<Market> {
  const { klines, coins } = await getData();
  const { market } = buildMarketData(klines, coins);
  return market;
}

export function backtest(market: Market, strategy: Strategy, cash: number, fee: number): BacktestResults {
  const bt = new Backtest(market, strategy, cash, fee, fee);
  bt.run();
  if (!_cache) throw new Error("Call loadMarket() before backtest()");
  const { converter } = buildMarketData(_cache.klines, _cache.coins);
  return collectResults(bt, strategy, converter, cash);
}
```

---

## 6. `src/strategy/` (5 Strategies)

All strategies share this pattern:
- Use `RankedInstrument` for rank/rankChange data
- Maintain `reasonLog` attached to function
- Sell logic: held positions with rankChange < 0 + timing signal
- Buy logic: non-held instruments with rankChange > 0 + timing signal
- Position sizing: `cash / max(1, remainingSlots)`

### 6a. `src/strategy/rebalancer.ts`

Pure rank-only rebalancing, no timing filter:

```typescript
import type { Strategy, Order, BuyOrder, SellOrder } from "@sauber/backtest";
import type { RankedInstrument } from "../backtest/ranked-instrument.ts";
import type { ReasonLogEntry } from "../backtest/mod.ts";

export function rebalancer(targetPositions: number): Strategy {
  const reasonLog: ReasonLogEntry[] = [];

  const fn: Strategy = (tick, cash, instruments, portfolio) => {
    const orders: Order[] = [];
    const heldSymbols = new Set(portfolio.positions.map((p) => p.instrument.symbol));

    // Sell held positions with rank declining
    for (const pos of portfolio.positions) {
      const inst = pos.instrument as RankedInstrument;
      if (inst.rankChange(tick) < 0) {
        reasonLog.push({ tick, symbol: inst.symbol, reason: `rank ${inst.rankChange(tick)} (#${inst.rank(tick)})`, type: "sell" });
        orders.push({ position: pos, reason: "Close" } as SellOrder);
      }
    }

    // Buy non-held instruments with rank improving
    const sellingCount = orders.length;
    const remainingSlots = targetPositions - (portfolio.positions.length - sellingCount);
    if (remainingSlots <= 0) return orders;

    const candidates = instruments
      .filter((inst) => !heldSymbols.has(inst.symbol) && (inst as RankedInstrument).rankChange(tick) > 0)
      .sort((a, b) => (b as RankedInstrument).rankChange(tick) - (a as RankedInstrument).rankChange(tick))
      .slice(0, remainingSlots);

    const spendPerBuy = cash / candidates.length;
    for (const inst of candidates) {
      const ri = inst as RankedInstrument;
      reasonLog.push({ tick, symbol: ri.symbol, reason: `rank +${ri.rankChange(tick)} (#${ri.rank(tick)})`, type: "buy" });
      orders.push({ instrument: inst, amount: spendPerBuy } as BuyOrder);
    }

    return orders;
  };

  Object.defineProperty(fn, "name", { value: "rebalancer" });
  (fn as unknown as Record<string, unknown>).reasonLog = reasonLog;
  return fn;
}
```

### 6b. `src/strategy/rsi-timed.ts`

Adds RSI timing on top of rank-trend:

```typescript
import type { Strategy, Order, BuyOrder, SellOrder } from "@sauber/backtest";
import type { RankedInstrument } from "../backtest/ranked-instrument.ts";
import type { ReasonLogEntry } from "../backtest/mod.ts";
import { rsi } from "../indicators.ts";

export interface RsiConfig {
  targetPositions?: number;
  rsiPeriod?: number;
  rsiOversold?: number;
  rsiOverbought?: number;
}

export function RsiTimed(config?: RsiConfig): Strategy {
  const targetPositions = config?.targetPositions ?? 5;
  const rsiPeriod = config?.rsiPeriod ?? 14;
  const rsiOversold = config?.rsiOversold ?? 30;
  const rsiOverbought = config?.rsiOverbought ?? 70;
  const reasonLog: ReasonLogEntry[] = [];

  const fn: Strategy = (tick, cash, instruments, portfolio) => {
    const orders: Order[] = [];
    const heldSymbols = new Set(portfolio.positions.map((p) => p.instrument.symbol));

    for (const pos of portfolio.positions) {
      const inst = pos.instrument as RankedInstrument;
      if (tick < rsiPeriod + 1 || inst.rankChange(tick) >= 0) continue;
      const closes = inst.klines.slice(0, tick + 1).map((k) => k.close);
      const rsiVals = rsi(closes, rsiPeriod);
      const lastRSI = rsiVals[rsiVals.length - 1];
      if (lastRSI > rsiOverbought || lastRSI < rsiOversold) {
        reasonLog.push({ tick, symbol: inst.symbol, reason: `rank ${inst.rankChange(tick)} (#${inst.rank(tick)}) (RSI ${lastRSI.toFixed(0)})`, type: "sell" });
        orders.push({ position: pos, reason: "Close" } as SellOrder);
      }
    }

    const sellingCount = orders.length;
    const remainingSlots = targetPositions - (portfolio.positions.length - sellingCount);
    if (remainingSlots <= 0) return orders;

    const candidates = instruments
      .filter((inst) => {
        if (heldSymbols.has(inst.symbol)) return false;
        const ri = inst as RankedInstrument;
        return ri.rankChange(tick) > 0;
      })
      .sort((a, b) => (b as RankedInstrument).rankChange(tick) - (a as RankedInstrument).rankChange(tick))
      .slice(0, remainingSlots);

    const spendPerBuy = cash / Math.max(1, candidates.length);
    for (const inst of candidates) {
      const ri = inst as RankedInstrument;
      if (tick < rsiPeriod + 1) continue;
      const closes = ri.klines.slice(0, tick + 1).map((k) => k.close);
      const rsiVals = rsi(closes, rsiPeriod);
      const lastRSI = rsiVals[rsiVals.length - 1];
      if (lastRSI < rsiOversold) {
        reasonLog.push({ tick, symbol: ri.symbol, reason: `rank +${ri.rankChange(tick)} (#${ri.rank(tick)}) (RSI ${lastRSI.toFixed(0)})`, type: "buy" });
        orders.push({ instrument: inst, amount: spendPerBuy } as BuyOrder);
      }
    }

    return orders;
  };

  Object.defineProperty(fn, "name", { value: "rsi-timed" });
  (fn as unknown as Record<string, unknown>).reasonLog = reasonLog;
  return fn;
}
```

### 6c. `src/strategy/macd-timed.ts`

```typescript
import type { Strategy, Order, BuyOrder, SellOrder } from "@sauber/backtest";
import type { RankedInstrument } from "../backtest/ranked-instrument.ts";
import type { ReasonLogEntry } from "../backtest/mod.ts";
import { macd } from "../indicators.ts";

export interface MacdConfig {
  targetPositions?: number;
  fastPeriod?: number;
  slowPeriod?: number;
  signalPeriod?: number;
}

export function MacdTimed(config?: MacdConfig): Strategy {
  const targetPositions = config?.targetPositions ?? 5;
  const fastPeriod = config?.fastPeriod ?? 12;
  const slowPeriod = config?.slowPeriod ?? 26;
  const signalPeriod = config?.signalPeriod ?? 9;
  const minBars = slowPeriod + signalPeriod;
  const reasonLog: ReasonLogEntry[] = [];

  const fn: Strategy = (tick, cash, instruments, portfolio) => {
    const orders: Order[] = [];
    const heldSymbols = new Set(portfolio.positions.map((p) => p.instrument.symbol));

    for (const pos of portfolio.positions) {
      const inst = pos.instrument as RankedInstrument;
      if (tick < minBars || inst.rankChange(tick) >= 0) continue;
      const closes = inst.klines.slice(0, tick + 1).map((k) => k.close);
      const { histogram } = macd(closes, fastPeriod, slowPeriod, signalPeriod);
      if (histogram.length < 2) continue;
      if (histogram[histogram.length - 2] >= 0 && histogram[histogram.length - 1] < 0) {
        reasonLog.push({ tick, symbol: inst.symbol, reason: `rank ${inst.rankChange(tick)} (#${inst.rank(tick)}) (MACD bearish)`, type: "sell" });
        orders.push({ position: pos, reason: "Close" } as SellOrder);
      }
    }

    const sellingCount = orders.length;
    const remainingSlots = targetPositions - (portfolio.positions.length - sellingCount);
    if (remainingSlots <= 0) return orders;

    const candidates = instruments
      .filter((inst) => {
        if (heldSymbols.has(inst.symbol)) return false;
        return (inst as RankedInstrument).rankChange(tick) > 0;
      })
      .sort((a, b) => (b as RankedInstrument).rankChange(tick) - (a as RankedInstrument).rankChange(tick))
      .slice(0, remainingSlots);

    const spendPerBuy = cash / Math.max(1, candidates.length);
    for (const inst of candidates) {
      const ri = inst as RankedInstrument;
      if (tick < minBars) continue;
      const closes = ri.klines.slice(0, tick + 1).map((k) => k.close);
      const { histogram } = macd(closes, fastPeriod, slowPeriod, signalPeriod);
      if (histogram.length < 2) continue;
      if (histogram[histogram.length - 2] <= 0 && histogram[histogram.length - 1] > 0) {
        reasonLog.push({ tick, symbol: ri.symbol, reason: `rank +${ri.rankChange(tick)} (#${ri.rank(tick)}) (MACD bullish)`, type: "buy" });
        orders.push({ instrument: inst, amount: spendPerBuy } as BuyOrder);
      }
    }

    return orders;
  };

  Object.defineProperty(fn, "name", { value: "macd-timed" });
  (fn as unknown as Record<string, unknown>).reasonLog = reasonLog;
  return fn;
}
```

### 6d. `src/strategy/bb-timed.ts`

```typescript
import type { Strategy, Order, BuyOrder, SellOrder } from "@sauber/backtest";
import type { RankedInstrument } from "../backtest/ranked-instrument.ts";
import type { ReasonLogEntry } from "../backtest/mod.ts";
import { rsi, bollingerBands } from "../indicators.ts";

export interface BbConfig {
  targetPositions?: number;
  rsiPeriod?: number;
  rsiOversold?: number;
  rsiOverbought?: number;
  bbPeriod?: number;
  bbStdDev?: number;
}

export function BollingerTimed(config?: BbConfig): Strategy {
  const targetPositions = config?.targetPositions ?? 5;
  const rsiPeriod = config?.rsiPeriod ?? 14;
  const rsiOversold = config?.rsiOversold ?? 30;
  const rsiOverbought = config?.rsiOverbought ?? 70;
  const bbPeriod = config?.bbPeriod ?? 20;
  const bbStdDev = config?.bbStdDev ?? 2;
  const minBars = Math.max(rsiPeriod, bbPeriod) + 10;
  const reasonLog: ReasonLogEntry[] = [];

  const fn: Strategy = (tick, cash, instruments, portfolio) => {
    const orders: Order[] = [];
    const heldSymbols = new Set(portfolio.positions.map((p) => p.instrument.symbol));

    for (const pos of portfolio.positions) {
      const inst = pos.instrument as RankedInstrument;
      if (tick < minBars || inst.rankChange(tick) >= 0) continue;
      const closes = inst.klines.slice(0, tick + 1).map((k) => k.close);
      const rsiVals = rsi(closes, rsiPeriod);
      if (rsiVals.length < 2) continue;
      const latestRSI = rsiVals[rsiVals.length - 1];
      const prevRSI = rsiVals[rsiVals.length - 2];
      const bb = bollingerBands(closes, bbPeriod, bbStdDev);
      const bbIdx = closes.length - 1 - bb.offset;
      const latestClose = closes[closes.length - 1];

      if (latestRSI > rsiOverbought && latestClose > bb.upper[bbIdx]) {
        reasonLog.push({ tick, symbol: inst.symbol, reason: `rank ${inst.rankChange(tick)} (#${inst.rank(tick)}) (RSI ${latestRSI.toFixed(0)} overbought)`, type: "sell" });
        orders.push({ position: pos, reason: "Close" } as SellOrder);
      } else if (prevRSI > rsiOverbought && latestRSI <= rsiOverbought) {
        reasonLog.push({ tick, symbol: inst.symbol, reason: `rank ${inst.rankChange(tick)} (#${inst.rank(tick)}) (RSI fell from overbought)`, type: "sell" });
        orders.push({ position: pos, reason: "Close" } as SellOrder);
      }
    }

    const sellingCount = orders.length;
    const remainingSlots = targetPositions - (portfolio.positions.length - sellingCount);
    if (remainingSlots <= 0) return orders;

    const candidates = instruments
      .filter((inst) => {
        if (heldSymbols.has(inst.symbol)) return false;
        return (inst as RankedInstrument).rankChange(tick) > 0;
      })
      .sort((a, b) => (b as RankedInstrument).rankChange(tick) - (a as RankedInstrument).rankChange(tick))
      .slice(0, remainingSlots);

    const spendPerBuy = cash / Math.max(1, candidates.length);
    for (const inst of candidates) {
      const ri = inst as RankedInstrument;
      if (tick < minBars) continue;
      const closes = ri.klines.slice(0, tick + 1).map((k) => k.close);
      const rsiVals = rsi(closes, rsiPeriod);
      if (rsiVals.length < 1) continue;
      const latestRSI = rsiVals[rsiVals.length - 1];
      const bb = bollingerBands(closes, bbPeriod, bbStdDev);
      const bbIdx = closes.length - 1 - bb.offset;
      const latestClose = closes[closes.length - 1];
      if (latestRSI < rsiOversold && latestClose < bb.lower[bbIdx]) {
        reasonLog.push({ tick, symbol: ri.symbol, reason: `rank +${ri.rankChange(tick)} (#${ri.rank(tick)}) (RSI ${latestRSI.toFixed(0)} oversold)`, type: "buy" });
        orders.push({ instrument: inst, amount: spendPerBuy } as BuyOrder);
      }
    }

    return orders;
  };

  Object.defineProperty(fn, "name", { value: "bb-timed" });
  (fn as unknown as Record<string, unknown>).reasonLog = reasonLog;
  return fn;
}
```

### 6e. `src/strategy/ema-adx-timed.ts`

```typescript
import type { Strategy, Order, BuyOrder, SellOrder } from "@sauber/backtest";
import type { RankedInstrument } from "../backtest/ranked-instrument.ts";
import type { ReasonLogEntry } from "../backtest/mod.ts";
import { ema, adx } from "../indicators.ts";

export interface EmaAdxConfig {
  targetPositions?: number;
  fastEMA?: number;
  slowEMA?: number;
  adxPeriod?: number;
  adxThreshold?: number;
}

export function EmaAdxTimed(config?: EmaAdxConfig): Strategy {
  const targetPositions = config?.targetPositions ?? 5;
  const fastEMA = config?.fastEMA ?? 9;
  const slowEMA = config?.slowEMA ?? 21;
  const adxPeriod = config?.adxPeriod ?? 14;
  const adxThreshold = config?.adxThreshold ?? 25;
  const minBars = Math.max(slowEMA, adxPeriod) + 10;
  const reasonLog: ReasonLogEntry[] = [];

  const fn: Strategy = (tick, cash, instruments, portfolio) => {
    const orders: Order[] = [];
    const heldSymbols = new Set(portfolio.positions.map((p) => p.instrument.symbol));

    for (const pos of portfolio.positions) {
      const inst = pos.instrument as RankedInstrument;
      if (tick < minBars || inst.rankChange(tick) >= 0) continue;
      const closes = inst.klines.slice(0, tick + 1).map((k) => k.close);
      const highs = inst.klines.slice(0, tick + 1).map((k) => k.high);
      const lows = inst.klines.slice(0, tick + 1).map((k) => k.low);

      const fast = ema(closes, fastEMA);
      const slow = ema(closes, slowEMA);
      const latestFast = fast[fast.length - 1];
      const latestSlow = slow[slow.length - 1];
      const prevFast = fast.length > 1 ? fast[fast.length - 2] : latestFast;
      const prevSlow = slow.length > 1 ? slow[slow.length - 2] : latestSlow;
      const adxVals = adx(highs, lows, closes, adxPeriod);
      const latestADX = adxVals[adxVals.length - 1];
      const bearishCross = prevFast >= prevSlow && latestFast < latestSlow;

      if (bearishCross || latestADX < adxThreshold) {
        const reason = bearishCross ? "EMA bearish cross" : `ADX ${latestADX.toFixed(0)} weak`;
        reasonLog.push({ tick, symbol: inst.symbol, reason: `rank ${inst.rankChange(tick)} (#${inst.rank(tick)}) (${reason})`, type: "sell" });
        orders.push({ position: pos, reason: "Close" } as SellOrder);
      }
    }

    const sellingCount = orders.length;
    const remainingSlots = targetPositions - (portfolio.positions.length - sellingCount);
    if (remainingSlots <= 0) return orders;

    const candidates = instruments
      .filter((inst) => {
        if (heldSymbols.has(inst.symbol)) return false;
        return (inst as RankedInstrument).rankChange(tick) > 0;
      })
      .sort((a, b) => (b as RankedInstrument).rankChange(tick) - (a as RankedInstrument).rankChange(tick))
      .slice(0, remainingSlots);

    const spendPerBuy = cash / Math.max(1, candidates.length);
    for (const inst of candidates) {
      const ri = inst as RankedInstrument;
      if (tick < minBars) continue;
      const closes = ri.klines.slice(0, tick + 1).map((k) => k.close);
      const highs = ri.klines.slice(0, tick + 1).map((k) => k.high);
      const lows = ri.klines.slice(0, tick + 1).map((k) => k.low);

      const fast = ema(closes, fastEMA);
      const slow = ema(closes, slowEMA);
      const latestFast = fast[fast.length - 1];
      const latestSlow = slow[slow.length - 1];
      const prevFast = fast.length > 1 ? fast[fast.length - 2] : latestFast;
      const prevSlow = slow.length > 1 ? slow[slow.length - 2] : latestSlow;
      const adxVals = adx(highs, lows, closes, adxPeriod);
      const latestADX = adxVals[adxVals.length - 1];
      const bullishCross = prevFast <= prevSlow && latestFast > latestSlow;

      if (bullishCross && latestADX > adxThreshold) {
        reasonLog.push({ tick, symbol: ri.symbol, reason: `rank +${ri.rankChange(tick)} (#${ri.rank(tick)}) (EMA bullish, ADX ${latestADX.toFixed(0)})`, type: "buy" });
        orders.push({ instrument: inst, amount: spendPerBuy } as BuyOrder);
      }
    }

    return orders;
  };

  Object.defineProperty(fn, "name", { value: "ema-adx-timed" });
  (fn as unknown as Record<string, unknown>).reasonLog = reasonLog;
  return fn;
}
```

### 6f. `src/strategy/mod.ts`

```typescript
export { rebalancer } from "./rebalancer.ts";
export { RsiTimed } from "./rsi-timed.ts";
export { MacdTimed } from "./macd-timed.ts";
export { BollingerTimed } from "./bb-timed.ts";
export { EmaAdxTimed } from "./ema-adx-timed.ts";
```

---

## Modified Files

### 7. `src/backtest.ts` — Simplified entry point

```typescript
import { loadMarket, backtest, display, evaluate } from "./backtest/mod.ts";
import { RsiTimed } from "./strategy/mod.ts";

const config = {
  strategy: "rsi-timed",
  cash: 1000,
  fee: 0.001,
};

const strategy = RsiTimed({ targetPositions: 5 });
const market = await loadMarket();
const results = backtest(market, strategy, config.cash, config.fee);
const score = evaluate(results);
console.log(display(strategy, results));
```

### 8. `src/optimize.ts` — Simplified optimizer

Uses `loadMarket()`, `backtest()`, `evaluate()`. Iterates over strategy params, calls `backtest()` + `evaluate()` for each config. BOHB with TPE sampling across strategy parameter space.

### 9. `src/config.ts` — Simplified config

```typescript
export const CONFIG = {
  strategy: { name: "rsi-timed", params: { rsiPeriod: 14, rsiOversold: 30, rsiOverbought: 70 } },
  initialCapital: 1000,
  fee: 0.001,
  targetPositions: 5,
  reserveSymbol: "USDC",
  candleInterval: "1hour",
  candleRangeMs: 55 * 3600000,
  cycleIntervalMs: 3600000,
};
```

### 10. `src/registry/registration.ts` — Single strategy registry

```typescript
import { RoleRegistry } from "./registry.ts";
import type { Strategy } from "@sauber/backtest";
import { rebalancer, RsiTimed, MacdTimed, BollingerTimed, EmaAdxTimed } from "../strategy/mod.ts";

export const strategyRegistry = new RoleRegistry<Strategy>();

strategyRegistry.register("rebalancer", (config?: unknown) => rebalancer((config as any)?.targetPositions ?? 5));
strategyRegistry.register("rsi-timed", (config?: unknown) => RsiTimed(config as Record<string, number>));
strategyRegistry.register("macd-timed", (config?: unknown) => MacdTimed(config as Record<string, number>));
strategyRegistry.register("bb-timed", (config?: unknown) => BollingerTimed(config as Record<string, number>));
strategyRegistry.register("ema-adx-timed", (config?: unknown) => EmaAdxTimed(config as Record<string, number>));
```

### 11. `src/engine/live.ts` — Simplified live engine

- Removes `portfolio`, `trading`, `logger`, `reflection` dependencies
- `cycle()` builds `Instrument[]` from live klines, builds `Portfolio` from balances
- Calls `strategy(0, cash, instruments, portfolio)` → `Order[]`
- Executes orders via `KucoinClient`

### 12. `src/trade.ts` — Simplified live entry point

Uses `strategyRegistry`, creates strategy, wires to simplified `TradingEngine`.

### 13. `src/deno.json` — Update tasks

```json
{
  "tasks": {
    "backtest": "deno run --allow-env --allow-read src/backtest.ts",
    "optimize": "deno run --allow-env --allow-read src/optimize.ts --strategy=rsi-timed",
    "trade": "deno run --allow-net --allow-env --allow-read --env-file=.env src/trade.ts"
  }
}
```

---

## Files to Delete

- `src/trading/` — entire directory
- `src/portfolio/` — entire directory
- `src/communication/` — entire directory
- `src/reflection/` — entire directory
- `src/execution/simulate.ts`
- `src/execution/types.ts`
- `src/engine/simulate.ts`
- `src/discovery/testdata.ts`
- `src/discovery/types.ts`

## Files to Keep (unchanged)

- `src/kucoin/` — KuCoin API client
- `src/indicators.ts` — indicator functions
- `src/position/` — position loaders (used by live engine)
- `src/execution/kucoin.ts` — KuCoin order execution
- `src/discovery/kucoin.ts` — KuCoin discovery (for live)
- `src/registry/registry.ts` — generic RoleRegistry class

## Verification

After all changes, run:
```sh
deno check src/
```
to verify type correctness.
