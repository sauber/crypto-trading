import { pipelineSimulate } from "./engine/simulate.ts";
import { FileDiscovery } from "./discovery/testdata.ts";
import { RankTrendPortfolio } from "./portfolio/rank-trend.ts";
import { RsiTimed, MacdTimed, BollingerTimed, EmaAdxTimed } from "./trading/mod.ts";
import { LineJournal } from "./communication/line-journal.ts";
import type { Kline } from "./kucoin/mod.ts";

function parseArgs() {
  const portfolioArg = Deno.args.find((a) => a.startsWith("--portfolio="));
  const tradingArg = Deno.args.find((a) => a.startsWith("--trading="));
  const portfolio = portfolioArg?.split("=")[1] ?? "rank-trend";
  const trading = tradingArg?.split("=")[1] ?? "rsi-timed";
  return { portfolio, trading };
}

function createPortfolioStrategy(name: string) {
  switch (name) {
    case "rank-trend":
      return RankTrendPortfolio(5);
    default:
      throw new Error(`Unknown portfolio strategy: ${name}`);
  }
}

function createTradingStrategy(name: string) {
  switch (name) {
    case "rsi-timed":
      return RsiTimed();
    case "macd-timed":
      return MacdTimed();
    case "bb-timed":
      return BollingerTimed();
    case "ema-adx-timed":
      return EmaAdxTimed();
    default:
      throw new Error(`Unknown trading strategy: ${name}`);
  }
}

async function loadData(): Promise<{
  interval: string;
  coins: string[];
  klines: Map<string, Kline[]>;
}> {
  try {
    const raw = await Deno.readTextFile("data/klines.json");
    const parsed = JSON.parse(raw);
    const klines = new Map<string, Kline[]>();
    for (const [symbol, bars] of Object.entries(parsed.klines)) {
      klines.set(symbol, bars as Kline[]);
    }
    console.log(`Loaded ${klines.size} coins from data/klines.json\n`);
    return { interval: parsed.interval, coins: parsed.coins, klines };
  } catch {
    console.error("data/klines.json not found.");
    console.error("Run 'deno task testdata' to download data.");
    Deno.exit(1);
  }
}

const args = parseArgs();
console.log(`=== Pipeline Backtest ===`);
console.log(`Portfolio: ${args.portfolio}`);
console.log(`Trading:   ${args.trading}\n`);

const data = await loadData();

const discoveryStrategy = FileDiscovery({ topN: 20 });
const portfolioStrategy = createPortfolioStrategy(args.portfolio);
const tradingStrategy = createTradingStrategy(args.trading);
const logger = LineJournal();

const result = await pipelineSimulate({
  discoveryStrategy,
  portfolioStrategy,
  tradingStrategy,
  klines: data.klines,
  coins: data.coins,
  interval: data.interval,
  config: {
    initialCapital: 1000,
    targetPositions: 5,
    fee: 0.001,
  },
  logger,
});

console.log(`=== Results ===`);
console.log(`Total Return:  ${result.totalReturn > 0 ? "+" : ""}${result.totalReturn.toFixed(2)}%`);
console.log(`Sharpe Ratio:  ${result.sharpeRatio.toFixed(2)}`);
console.log(`Max Drawdown:  ${result.maxDrawdown.toFixed(2)}%`);
console.log(`Win Rate:      ${result.winRate.toFixed(1)}%`);
console.log(`Profit Factor: ${result.profitFactor === Infinity ? "∞" : result.profitFactor.toFixed(2)}`);
console.log(`Total Trades:  ${result.totalTrades}`);
console.log(`Equity Curve:  ${result.equityCurve.length} points`);

if (result.trades.length > 0) {
  console.log(`\n=== Transactions (${result.trades.length}) ===`);
  const wins = result.trades.filter((t) => t.pnlPct > 0).length;
  const losses = result.trades.filter((t) => t.pnlPct <= 0).length;
  console.log(`W/L: ${wins}/${losses}\n`);

  const header = `${"#".padEnd(4)} ${"Sell".padEnd(14)} → ${"Buy".padEnd(14)} ${"P/L %".padEnd(9)} ${"Bars".padEnd(5)} Reason`;
  console.log(header);
  console.log("-".repeat(header.length));

  for (let i = 0; i < result.trades.length; i++) {
    const t = result.trades[i];
    const pnl = t.pnlPct > 0 ? `+${t.pnlPct.toFixed(2)}` : t.pnlPct.toFixed(2);
    console.log(
      `${(i + 1).toString().padEnd(4)} ${t.sellSymbol.padEnd(14)} → ${t.buySymbol.padEnd(14)} ${pnl.padEnd(9)} ${t.bars.toString().padEnd(5)} ${t.reason}`,
    );
  }

  console.log(`\nTop 5 winners:`);
  const topWins = [...result.trades].sort((a, b) => b.pnlPct - a.pnlPct).slice(0, 5);
  for (const t of topWins) {
    console.log(`  +${t.pnlPct.toFixed(2)}% ${t.sellSymbol} → ${t.buySymbol} (${t.reason})`);
  }

  console.log(`\nTop 5 losers:`);
  const topLosses = [...result.trades].sort((a, b) => a.pnlPct - b.pnlPct).slice(0, 5);
  for (const t of topLosses) {
    console.log(`  ${t.pnlPct.toFixed(2)}% ${t.sellSymbol} → ${t.buySymbol} (${t.reason})`);
  }
}
