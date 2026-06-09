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

console.log(`Henter top ${TOP_N} coins efter 24h volume...`);
const topSymbols = await client.getTopVolumeSymbols(TOP_N);
const symbols = topSymbols.map((s) => s.symbol);
console.log(`Fundet ${symbols.length} coins, henter klines...`);

const klines: Record<string, unknown[]> = {};
let count = 0;

for (const symbol of symbols) {
  process.stdout.write(`\r${++count}/${symbols.length} ${symbol.padEnd(15)}`);
  try {
    const data = await client.getKlines(symbol, CANDLE_INTERVAL, startTime, endTime);
    klines[symbol] = data;
  } catch (err) {
    console.error(`\nFejl ved ${symbol}: ${err}`);
  }
}

console.log(`\nGemmer ${Object.keys(klines).length} coins til data/klines.json ...`);
const output = {
  interval: CANDLE_INTERVAL,
  coins: Object.keys(klines),
  klines,
};

await Deno.mkdir("data", { recursive: true });
await Deno.writeTextFile("data/klines.json", JSON.stringify(output, null, 2));
console.log("Færdig!");
