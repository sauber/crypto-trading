import { pipelineSimulate } from "./engine/simulate.ts";
import { RankTrendPortfolio } from "./roles/portfolio/strategies/rank-trend/strategy.ts";
import { config as rankTrendCfg } from "./roles/portfolio/strategies/rank-trend/config.ts";
import { RsiTimedTrading } from "./roles/trading/strategies/rsi-timed/strategy.ts";
import { config as rsiTimedCfg } from "./roles/trading/strategies/rsi-timed/config.ts";
import { MacdTimedTrading } from "./roles/trading/strategies/macd-timed/strategy.ts";
import { config as macdTimedCfg } from "./roles/trading/strategies/macd-timed/config.ts";
import { BbTimedTrading } from "./roles/trading/strategies/bb-timed/strategy.ts";
import { config as bbTimedCfg } from "./roles/trading/strategies/bb-timed/config.ts";
import { EmaAdxTimedTrading } from "./roles/trading/strategies/ema-adx-timed/strategy.ts";
import { config as emaAdxTimedCfg } from "./roles/trading/strategies/ema-adx-timed/config.ts";
import type { Kline } from "./kucoin/types.ts";

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
      return new RankTrendPortfolio(rankTrendCfg);
    default:
      throw new Error(`Unknown portfolio strategy: ${name}`);
  }
}

function createTradingStrategy(name: string) {
  switch (name) {
    case "rsi-timed":
      return new RsiTimedTrading(rsiTimedCfg);
    case "macd-timed":
      return new MacdTimedTrading(macdTimedCfg);
    case "bb-timed":
      return new BbTimedTrading(bbTimedCfg);
    case "ema-adx-timed":
      return new EmaAdxTimedTrading(emaAdxTimedCfg);
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
    console.log(`Indlæste ${klines.size} coins fra data/klines.json\n`);
    return { interval: parsed.interval, coins: parsed.coins, klines };
  } catch {
    console.error("data/klines.json ikke fundet.");
    console.error("Kør 'deno task testdata' for at downloade data.");
    Deno.exit(1);
  }
}

const args = parseArgs();
console.log(`=== Pipeline Backtest ===`);
console.log(`Portfolio: ${args.portfolio}`);
console.log(`Trading:   ${args.trading}\n`);

const data = await loadData();

const portfolioStrategy = createPortfolioStrategy(args.portfolio);
const tradingStrategy = createTradingStrategy(args.trading);

const result = await pipelineSimulate({
  portfolioStrategy,
  tradingStrategy,
  klines: data.klines,
  coins: data.coins,
  interval: data.interval,
  config: {
    initialCapital: 1000,
    maxPositions: 5,
    fee: 0.001,
  },
});

console.log(`=== Resultater ===`);
console.log(`Total Return:  ${result.totalReturn > 0 ? "+" : ""}${result.totalReturn.toFixed(2)}%`);
console.log(`Sharpe Ratio:  ${result.sharpeRatio.toFixed(2)}`);
console.log(`Max Drawdown:  ${result.maxDrawdown.toFixed(2)}%`);
console.log(`Win Rate:      ${result.winRate.toFixed(1)}%`);
console.log(`Profit Factor: ${result.profitFactor === Infinity ? "∞" : result.profitFactor.toFixed(2)}`);
console.log(`Total Trades:  ${result.totalTrades}`);
console.log(`Equity Curve:  ${result.equityCurve.length} punkter`);
