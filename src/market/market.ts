import type { Kline } from "../kucoin/mod.ts";
import { RankedInstrument } from "./ranked-instrument.ts";

export interface DataCache {
  klines: Map<string, Kline[]>;
  coins: string[];
}

let _cache: DataCache | null = null;

/** @internal Inject cached test data, bypassing file read. */
export function _setTestData(data: DataCache): void {
  _cache = data;
}

/** @internal Clear cache so next market() re-reads from disk. */
export function _resetCache(): void {
  _cache = null;
}

export async function getData(): Promise<DataCache> {
  if (_cache) return _cache;

  const raw = await Deno.readTextFile("data/klines.json");
  const parsed = JSON.parse(raw);
  const klines = new Map<string, Kline[]>();
  for (const [symbol, bars] of Object.entries(parsed.klines as Record<string, unknown>)) {
    klines.set(symbol, bars as Kline[]);
  }

  _cache = { klines, coins: parsed.coins as string[] };
  return _cache;
}

/** Build RankedInstrument[] from klines map. Computes per-tick rank (by volume×close) and rank-change series. */
export function buildRankedInstruments(
  klines: Map<string, Kline[]>,
  coins: string[],
): RankedInstrument[] {
  if (coins.length === 0) return [];

  const tickCount = klines.get(coins[0])?.length ?? 0;

  const rankData = new Map<string, Float32Array>();
  const rankChangeData = new Map<string, Float32Array>();

  for (const coin of coins) {
    rankData.set(coin, new Float32Array(tickCount));
    rankChangeData.set(coin, new Float32Array(tickCount));
  }

  for (let tick = 0; tick < tickCount; tick++) {
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
    for (let tick = 1; tick < tickCount; tick++) {
      rc[tick] = r[tick - 1] - r[tick];
    }
  }

  const allSymbols = [...klines.keys()];
  return allSymbols.map((symbol) => {
    const bars = klines.get(symbol)!;
    return new RankedInstrument(
      new Float32Array(bars.map((b) => b.close)),
      0,
      symbol,
      rankData.get(symbol) ?? new Float32Array(tickCount),
      rankChangeData.get(symbol) ?? new Float32Array(tickCount),
      bars,
      new Float32Array(bars.map((b) => b.volume)),
    );
  });
}

/** Load cached klines and build RankedInstrument[]. */
export async function market(): Promise<RankedInstrument[]> {
  const { klines, coins } = await getData();
  return buildRankedInstruments(klines, coins);
}
