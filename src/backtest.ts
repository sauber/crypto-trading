import { KucoinClient } from "./kucoin/client.ts";
import { simulate } from "./strategies/simulate.ts";
import type { SimConfig, SimResult } from "./strategies/simulate.ts";
import { getStrategyEntry } from "./strategies/registry.ts";

const stratArg = Deno.args.find((a) => a.startsWith("--strategy="));
if (!stratArg) { console.error(`Brug: --strategy=${["momentum", "mean-reversion", "trend-following"].join("|")}`); Deno.exit(1); }
const entry = getStrategyEntry(stratArg.split("=")[1]);

const KUCOIN_API_KEY = Deno.env.get("KUCOIN_API_KEY") || "";
const KUCOIN_API_SECRET = Deno.env.get("KUCOIN_API_SECRET") || "";
const KUCOIN_API_PASSPHRASE = Deno.env.get("KUCOIN_API_PASSPHRASE") || "";
const CANDLE_INTERVAL = "1hour";
const TEST_DAYS = 60;
const TEST_COINS = 10;

const simConfig: SimConfig = {
  stopLossPct: entry.stopLossPct,
  takeProfitPct: entry.takeProfitPct,
  minCandles: entry.minCandles,
  initialCapital: entry.initialCapital,
};

const client = new KucoinClient({
  apiKey: KUCOIN_API_KEY, apiSecret: KUCOIN_API_SECRET, apiPassphrase: KUCOIN_API_PASSPHRASE,
});

const now = Date.now();
const startTime = now - TEST_DAYS * 86400000;
const endTime = now;

console.log(`=== Backtest: ${entry.name} ===`);
console.log(`Periode: ${new Date(startTime).toISOString().slice(0, 10)} - ${new Date(endTime).toISOString().slice(0, 10)}`);
console.log(`SL: ${simConfig.stopLossPct * 100}%, TP: ${simConfig.takeProfitPct * 100}%\n`);

const topSymbols = await client.getTopVolumeSymbols(TEST_COINS);
const symbols = topSymbols.map((s) => s.symbol);

const allResults: SimResult[] = [];

for (const symbol of symbols) {
  process.stdout.write(`${symbol}...`);
  const klines = await client.getKlines(symbol, CANDLE_INTERVAL, startTime, endTime);
  if (klines.length < simConfig.minCandles) {
    console.log(` for lidt data (${klines.length})`);
    continue;
  }
  const strategy = entry.create();
  const result = simulate(symbol, klines, strategy, simConfig);
  allResults.push(result);
  console.log(` ${result.totalTrades} trades, return=${result.totalReturn > 0 ? "+" : ""}${result.totalReturn}%`);
}

for (const r of allResults) {
  const sign = r.totalReturn > 0 ? "+" : "";
  console.log(`\n${r.symbol} — return=${sign}${r.totalReturn}%  win=${r.winRate}%  trades=${r.totalTrades}  PF=${r.profitFactor}  DD=${r.maxDrawdown}%`);
  for (const t of r.trades.slice(-10)) {
    const ts = t.exitTime.slice(11, 19);
    const reason = t.reason.length > 22 ? t.reason.slice(0, 22) + ".." : t.reason;
    console.log(`  ${ts} ${reason.padEnd(24)} ${t.pnlPct > 0 ? "+" : ""}${t.pnlPct}% (${t.bars}t)`);
  }
}

console.log(`\n=== Samlet Resultat (${allResults.length} coins) ===\n`);

let totalTrades = 0, totalWins = 0, totalReturnSum = 0;
let bestReturn = -Infinity, worstReturn = Infinity;
let bestSymbol = "", worstSymbol = "";

for (const r of allResults) {
  totalTrades += r.totalTrades;
  totalWins += r.totalTrades * r.winRate / 100;
  totalReturnSum += r.totalReturn;
  if (r.totalReturn > bestReturn) { bestReturn = r.totalReturn; bestSymbol = r.symbol; }
  if (r.totalReturn < worstReturn) { worstReturn = r.totalReturn; worstSymbol = r.symbol; }
}

const avgReturn = totalReturnSum / allResults.length;
const avgWinRate = totalTrades > 0 ? (totalWins / totalTrades * 100) : 0;

console.log(`Samlede trades: ${totalTrades}`);
console.log(`Avg win rate: ${avgWinRate.toFixed(1)}%`);
console.log(`Avg return: ${avgReturn > 0 ? "+" : ""}${avgReturn.toFixed(2)}%`);
console.log(`Bedste: ${bestSymbol} ${bestReturn > 0 ? "+" : ""}${bestReturn.toFixed(2)}%`);
console.log(`Værste: ${worstSymbol} ${worstReturn > 0 ? "+" : ""}${worstReturn.toFixed(2)}%`);
