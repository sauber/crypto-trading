import { KucoinClient } from "../src/kucoin/client.ts";

const KUCOIN_API_KEY = Deno.env.get("KUCOIN_API_KEY") || "";
const KUCOIN_API_SECRET = Deno.env.get("KUCOIN_API_SECRET") || "";
const KUCOIN_API_PASSPHRASE = Deno.env.get("KUCOIN_API_PASSPHRASE") || "";

const client = new KucoinClient({
  apiKey: KUCOIN_API_KEY,
  apiSecret: KUCOIN_API_SECRET,
  apiPassphrase: KUCOIN_API_PASSPHRASE,
});

const CANDLE_INTERVAL = "1hour";
const TOP_N = 50;
const DAYS_BACK = 90;

const now = Date.now();
const startTime = now - DAYS_BACK * 86400000;
const endTime = now;

console.log(`Fetching top ${TOP_N} coins by 24h volume...`);
const topSymbols = await client.getTopVolumeSymbols(TOP_N);
const symbols = topSymbols.map((s) => s.symbol);
console.log(`Found ${symbols.length} coins, fetching klines...`);

const klines: Record<string, unknown[]> = {};
let count = 0;

for (const symbol of symbols) {
  process.stdout.write(`\r${++count}/${symbols.length} ${symbol.padEnd(15)}`);
  try {
    const data = await client.getKlines(symbol, CANDLE_INTERVAL, startTime, endTime);
    klines[symbol] = data;
  } catch (err) {
    console.error(`\nError at ${symbol}: ${err}`);
  }
}

console.log(`\nSaving ${Object.keys(klines).length} coins to data/klines.json ...`);
const output = {
  interval: CANDLE_INTERVAL,
  coins: Object.keys(klines),
  klines,
};

await Deno.mkdir("data", { recursive: true });
await Deno.writeTextFile("data/klines.json", JSON.stringify(output, null, 2));
console.log("Done!");
