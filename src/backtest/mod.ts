import { Backtest, Market } from "@sauber/backtest";
import type { Strategy } from "@sauber/backtest";
import { market } from "../market/mod.ts";
import type { Timeline } from "../market/mod.ts";
import { collectResults, evaluate, display } from "./result.ts";
import type { BacktestResults } from "./result.ts";

export type { BacktestResults, TradeRecord, ReasonLogEntry } from "./result.ts";
export { evaluate, display };

export async function loadMarket(): Promise<Market> {
  const instruments = await market();
  return new Market(instruments);
}

export function backtest(
  market: Market,
  strategy: Strategy,
  cash: number,
  fee: number,
  tl: Timeline,
): BacktestResults {
  const bt = new Backtest(market, strategy, cash, fee, fee);
  bt.run();
  return collectResults(bt, strategy, tl, cash);
}
