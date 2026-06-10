import type { Kline } from "../kucoin/mod.ts";

export interface DownloadOptions {
  topN?: number;
  daysBack?: number;
  interval?: string;
  onProgress?: (current: number, total: number, symbol: string) => void;
}

export interface DownloadResult {
  interval: string;
  coins: string[];
  klines: Record<string, Kline[]>;
  candleCount: number;
  firstTs: number;
  lastTs: number;
}

/** Fetch top coins from KuCoin, verify uniform candle length, return chronologically-sorted data. */
export async function download(opts: DownloadOptions = {}): Promise<DownloadResult> {
  const {
    topN = 50,
    daysBack = 90,
    interval = "1hour",
    onProgress,
  } = opts;

  const { KucoinClient } = await import("../kucoin/client.ts");

  const client = new KucoinClient({});

  const now = Date.now();
  const startTime = now - daysBack * 86400000;
  const endTime = now;

  const topSymbols = await client.getTopVolumeSymbols(topN);
  const symbols = topSymbols.map((s) => s.symbol);

  const klines: Record<string, Kline[]> = {};
  let count = 0;

  for (const symbol of symbols) {
    onProgress?.(++count, symbols.length, symbol);
    try {
      const data = await client.getKlines(symbol, interval, startTime, endTime);
      data.sort((a, b) => a.timestamp - b.timestamp);
      klines[symbol] = data;
    } catch {
      // skip failed symbols
    }
  }

  const entries = Object.entries(klines);
  const nonEmpty = entries.filter(([, bars]) => bars.length > 0);

  if (nonEmpty.length === 0) {
    throw new Error("No candle data fetched.");
  }

  const lengthCounts = new Map<number, number>();
  for (const [, bars] of nonEmpty) {
    const len = bars.length;
    lengthCounts.set(len, (lengthCounts.get(len) ?? 0) + 1);
  }
  let modeLen = 0;
  let modeCount = 0;
  for (const [len, c] of lengthCounts) {
    if (c > modeCount) { modeLen = len; modeCount = c; }
  }

  if (modeLen === 0 || modeCount < nonEmpty.length / 2) {
    throw new Error(
      `Only ${modeCount}/${nonEmpty.length} coins share the same candle length (${modeLen}). Insufficient data.`,
    );
  }

  const valid = nonEmpty.filter(([, bars]) => bars.length === modeLen);
  const firstTs = Math.min(...valid.map(([, bars]) => bars[0].timestamp));
  const lastTs = Math.max(...valid.map(([, bars]) => bars[bars.length - 1].timestamp));

  return {
    interval,
    coins: valid.map(([s]) => s),
    klines: Object.fromEntries(valid),
    candleCount: modeLen,
    firstTs,
    lastTs,
  };
}
