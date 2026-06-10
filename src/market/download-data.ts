import { download } from "./download.ts";

const result = await download({
  onProgress: (current, total, symbol) => {
    process.stdout.write(`\r${current}/${total} ${symbol.padEnd(15)}`);
  },
});

console.log(`\nSaving ${result.coins.length} coins to data/klines.json ...`);

await Deno.mkdir("data", { recursive: true });
await Deno.writeTextFile(
  "data/klines.json",
  JSON.stringify(
    { interval: result.interval, coins: result.coins, klines: result.klines },
    null,
    2,
  ),
);

const fmt = (ts: number) => new Date(ts).toISOString().replace(/\.\d{3}Z$/, "Z");
console.log(`Done! ${result.candleCount} candles each, ${fmt(result.firstTs)} \u2192 ${fmt(result.lastTs)}`);
