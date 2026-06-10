import { KucoinClient } from "../kucoin/client.ts";

/** Tunables for the kline download. All fields optional with sensible defaults. */
export interface DownloadOptions {
  topN?: number;
  daysBack?: number;
  interval?: string;
}

/** Fetch top coins from KuCoin and write their 1h klines to data/klines.json. */
export async function downloadData(opts: DownloadOptions = {}): Promise<void> {
  const {
    topN = 50,
    daysBack = 90,
    interval = "1hour",
  } = opts;

  // Read KuCoin API credentials from environment
  const KUCOIN_API_KEY = Deno.env.get("KUCOIN_API_KEY") || "";
  const KUCOIN_API_SECRET = Deno.env.get("KUCOIN_API_SECRET") || "";
  const KUCOIN_API_PASSPHRASE = Deno.env.get("KUCOIN_API_PASSPHRASE") || "";

  const client = new KucoinClient({
    apiKey: KUCOIN_API_KEY,
    apiSecret: KUCOIN_API_SECRET,
    apiPassphrase: KUCOIN_API_PASSPHRASE,
  });

  // Determine time range: 90 days back from now
  const now = Date.now();
  const startTime = now - daysBack * 86400000;
  const endTime = now;

  // Fetch top N symbols by 24h volume
  console.log(`Fetching top ${topN} coins by 24h volume...`);
  const topSymbols = await client.getTopVolumeSymbols(topN);
  const symbols = topSymbols.map((s) => s.symbol);
  console.log(`Found ${symbols.length} coins, fetching klines...`);

  // Download klines for each symbol
  const klines: Record<string, unknown[]> = {};
  let count = 0;

  for (const symbol of symbols) {
    process.stdout.write(`\r${++count}/${symbols.length} ${symbol.padEnd(15)}`);
    try {
      const data = await client.getKlines(symbol, interval, startTime, endTime);
      klines[symbol] = data;
    } catch (err) {
      console.error(`\nError at ${symbol}: ${err}`);
    }
  }

  // Build output structure and persist to disk
  console.log(`\nSaving ${Object.keys(klines).length} coins to data/klines.json ...`);
  const output = {
    interval,
    coins: Object.keys(klines),
    klines,
  };

  await Deno.mkdir("data", { recursive: true });
  await Deno.writeTextFile("data/klines.json", JSON.stringify(output, null, 2));
  console.log("Done!");
}
