import { Backtest } from "@sauber/backtest";
import type { Market, Strategy } from "@sauber/backtest";
import type { Kline } from "../kucoin/mod.ts";
import { buildMarketData } from "./market.ts";
import { collectResults, evaluate, display } from "./result.ts";
import type { BacktestResults } from "./result.ts";

export type { BacktestResults, TradeRecord, ReasonLogEntry } from "./result.ts";
export { RankedInstrument } from "./ranked-instrument.ts";
export { TickConverter } from "./tick-converter.ts";
export { evaluate, display };

let _dataCache: { klines: Map<string, Kline[]>; coins: string[] } | null = null;

async function getData(): Promise<{
  klines: Map<string, Kline[]>;
  coins: string[];
}> {
  if (_dataCache) return _dataCache;
  const raw = await Deno.readTextFile("data/klines.json");
  const parsed = JSON.parse(raw);
  const klines = new Map<string, Kline[]>();
  for (const [symbol, bars] of Object.entries(parsed.klines)) {
    klines.set(symbol, bars as Kline[]);
  }
  for (const [, bars] of klines) {
    bars.sort((a, b) => a.timestamp - b.timestamp);
  }
  _dataCache = { klines, coins: parsed.coins as string[] };
  return _dataCache;
}

export async function loadMarket(): Promise<Market> {
  const { klines, coins } = await getData();
  const { market } = buildMarketData(klines, coins);
  return market;
}

export function backtest(
  market: Market,
  strategy: Strategy,
  cash: number,
  fee: number,
): BacktestResults {
  const bt = new Backtest(market, strategy, cash, fee, fee);
  bt.run();

  if (!_dataCache) {
    throw new Error("Call loadMarket() before backtest()");
  }
  const { converter } = buildMarketData(_dataCache.klines, _dataCache.coins);
  return collectResults(bt, strategy, converter, cash);
}
