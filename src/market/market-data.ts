import { getData } from "./data.ts";
import { RankedInstrument } from "./ranked-instrument.ts";

/** Build RankedInstrument[] from cached klines. Computes per-tick rank (by volume×close) and rank-change series. */
export async function market(): Promise<RankedInstrument[]> {
  const { klines, coins } = await getData();

  // Find the minimum bar count across all coins
  const barCounts = coins.map((c) => (klines.get(c) || []).length);
  const minBars = Math.min(...barCounts);

  if (minBars < 2) {
    throw new Error(`Not enough data: need at least 2 bars, got ${minBars}`);
  }

  // Allocate rank and rank-change arrays
  const rankData = new Map<string, Float32Array>();
  const rankChangeData = new Map<string, Float32Array>();

  for (const coin of coins) {
    rankData.set(coin, new Float32Array(minBars));
    rankChangeData.set(coin, new Float32Array(minBars));
  }

  // Score each coin by volume×close for the current tick, then assign rank
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

  // Compute rank change between consecutive ticks (positive = gaining rank)
  for (const coin of coins) {
    const r = rankData.get(coin)!;
    const rc = rankChangeData.get(coin)!;
    rc[0] = 0;
    for (let tick = 1; tick < minBars; tick++) {
      rc[tick] = r[tick - 1] - r[tick];
    }
  }

  // Build one RankedInstrument per symbol with close, rank, rank-change, and volume series
  const allSymbols = [...klines.keys()];
  return allSymbols.map((symbol) => {
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
}
