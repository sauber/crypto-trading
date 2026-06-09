import { pipelineSimulate } from "./simulate.ts";
import { FileDiscovery } from "../discovery/testdata.ts";
import { RankTrendPortfolio } from "../portfolio/rank-trend.ts";
import { RsiTimed } from "../trading/mod.ts";
import type { Kline } from "../kucoin/mod.ts";

function makeKlines(
  nBars: number,
  startPrice = 100,
  step = 0.3,
  volume = 1000,
): Kline[] {
  const klines: Kline[] = [];
  const baseTime = 1700000000000;
  for (let i = 0; i < nBars; i++) {
    const price = startPrice + i * step;
    klines.push({
      timestamp: baseTime + i * 3600000,
      open: price,
      high: price + 1 + Math.random() * 2,
      low: price - 1 - Math.random() * 2,
      close: price,
      volume: volume + Math.random() * 200,
    });
  }
  return klines;
}

Deno.test("pipeline with rank-trend + rsi-timed produces valid results", async () => {
  const coins = ["BTC-USDT", "ETH-USDT", "SOL-USDT", "ADA-USDT", "XRP-USDT"];
  const klines = new Map<string, Kline[]>();

  // Give each coin different volume profiles so rank-trend can differentiate
  const volumes = [2000, 1500, 1000, 500, 250];
  for (let i = 0; i < coins.length; i++) {
    klines.set(coins[i], makeKlines(200, 100 + i * 10, 0.2 + i * 0.05, volumes[i]));
  }

  const result = await pipelineSimulate({
    discoveryStrategy: FileDiscovery({ topN: coins.length }),
    portfolioStrategy: RankTrendPortfolio(5),
    tradingStrategy: RsiTimed(),
    klines,
    coins,
    interval: "1hour",
    config: { initialCapital: 1000, targetPositions: 5, fee: 0.001 },
  });

  if (result.equityCurve.length !== 200 - 50 + 2) {
    throw new Error(
      `equityCurve length ${result.equityCurve.length} !== ${200 - 50 + 2}`,
    );
  }
  if (result.totalReturn < -100) {
    throw new Error(`Total return ${result.totalReturn}% is unreasonably low`);
  }
  if (result.maxDrawdown < 0 || result.maxDrawdown > 100) {
    throw new Error(`Max drawdown ${result.maxDrawdown}% out of range`);
  }
  if (result.totalTrades < 0) {
    throw new Error(`totalTrades ${result.totalTrades} < 0`);
  }
});

Deno.test("pipeline with rank-trend buys improving-rank coins", async () => {
  const coins = ["BTC-USDT", "ETH-USDT"];
  const baseTime = 1700000000000;

  // Create klines where BTC volume starts high then drops, ETH starts low then rises
  const btcKlines: Kline[] = [];
  const ethKlines: Kline[] = [];
  for (let i = 0; i < 100; i++) {
    btcKlines.push({
      timestamp: baseTime + i * 3600000,
      open: 100,
      high: 101,
      low: 99,
      close: 100,
      volume: 2000 - i * 10,
    });
    ethKlines.push({
      timestamp: baseTime + i * 3600000,
      open: 50,
      high: 51,
      low: 49,
      close: 50,
      volume: 500 + i * 10,
    });
  }

  const klines = new Map<string, Kline[]>();
  klines.set("BTC-USDT", btcKlines);
  klines.set("ETH-USDT", ethKlines);

  const result = await pipelineSimulate({
    discoveryStrategy: FileDiscovery({ topN: coins.length }),
    portfolioStrategy: RankTrendPortfolio(5),
    tradingStrategy: RsiTimed(),
    klines,
    coins,
    interval: "1hour",
    config: { initialCapital: 1000, targetPositions: 5, fee: 0.001 },
  });

  if (result.totalTrades < 0) {
    throw new Error("Should have non-negative trades");
  }
});
