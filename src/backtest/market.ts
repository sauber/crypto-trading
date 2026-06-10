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

  if (minBars < 2) {
    throw new Error(`Not enough data: need at least 2 bars, got ${minBars}`);
  }

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

  const allSymbols = [...klines.keys()];
  const instruments = allSymbols.map((symbol) => {
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
