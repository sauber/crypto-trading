import type { Kline } from "../kucoin/mod.ts";

interface DataCache {
  klines: Map<string, Kline[]>;
  coins: string[];
}

let _cache: DataCache | null = null;

/** Read and cache data/klines.json. Subsequent calls return the cached parse. */
export async function getData(): Promise<DataCache> {
  // Return cached data if already loaded
  if (_cache) return _cache;

  // Parse JSON and build Map
  const raw = await Deno.readTextFile("data/klines.json");
  const parsed = JSON.parse(raw);
  const klines = new Map<string, Kline[]>();
  for (const [symbol, bars] of Object.entries(parsed.klines)) {
    klines.set(symbol, bars as Kline[]);
  }

  // Sort bars by timestamp for each symbol
  for (const [, bars] of klines) {
    bars.sort((a, b) => a.timestamp - b.timestamp);
  }

  _cache = { klines, coins: parsed.coins as string[] };
  return _cache;
}
