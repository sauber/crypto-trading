import { pipelineSimulate } from "./simulate.ts";
import type { PortfolioStrategy, PortfolioConfig } from "../roles/portfolio/types.ts";
import type { TradingStrategy, TradingConfig } from "../roles/trading/types.ts";
import type { Kline } from "../kucoin/types.ts";
import type { PositionState, PortfolioDecision, SwapPlan } from "./types.ts";
import type { CoinCandidate } from "../roles/types.ts";

class AlwaysBuyPortfolio implements PortfolioStrategy {
  readonly name = "always-buy";
  readonly config: PortfolioConfig = { maxPositions: 5, allocationMethod: "equal" };

  async analyze(
    params: {
      candidates: CoinCandidate[];
      activePositions: PositionState[];
      prices: Map<string, number>;
      client: unknown;
      interval: string;
      candleRangeMs: number;
    },
  ): Promise<PortfolioDecision> {
    return {
      wantToBuy: params.candidates.map((c) => ({
        symbol: c.symbol,
        confidence: 100,
        reason: "always-buy",
      })),
      wantToSell: [],
    };
  }
}

class RotatePortfolio implements PortfolioStrategy {
  readonly name = "rotate";
  readonly config: PortfolioConfig = { maxPositions: 5, allocationMethod: "equal" };
  private bar = 0;

  async analyze(
    params: {
      candidates: CoinCandidate[];
      activePositions: PositionState[];
      prices: Map<string, number>;
      client: unknown;
      interval: string;
      candleRangeMs: number;
    },
  ): Promise<PortfolioDecision> {
    this.bar++;
    const held = new Set(params.activePositions.map((p) => p.symbol));

    if (this.bar % 15 === 0) {
      return {
        wantToBuy: [],
        wantToSell: params.activePositions.map((p) => ({
          symbol: p.symbol,
          reason: "rotate-sell",
        })),
      };
    }

    const candidates = params.candidates.filter((c) => !held.has(c.symbol));
    return {
      wantToBuy: candidates.slice(0, 1).map((c) => ({
        symbol: c.symbol,
        confidence: 100,
        reason: "rotate-buy",
      })),
      wantToSell: [],
    };
  }
}

class FirstCoinTrading implements TradingStrategy {
  readonly name = "first-coin";
  readonly config: TradingConfig = {
    rsiPeriod: 14,
    rsiOversold: 30,
    rsiOverbought: 70,
    minConfidence: 50,
  };

  async plan(
    params: {
      wantToBuy: Array<{ symbol: string; confidence: number; reason: string }>;
      wantToSell: Array<{ symbol: string; reason: string }>;
      activePositions: PositionState[];
      prices: Map<string, number>;
      klines: Map<string, Kline[]>;
      maxPositions: number;
    },
  ): Promise<SwapPlan> {
    const maxSlots = params.maxPositions - 1;
    const activeCount = params.activePositions.length;
    const slotsLeft = maxSlots - activeCount;

    const swaps = params.wantToBuy.slice(0, slotsLeft).map((buy) => ({
      sellSymbol: "",
      buySymbol: buy.symbol,
      reason: buy.reason,
    }));

    return { swaps };
  }
}

class RotateTrading implements TradingStrategy {
  readonly name = "rotate";
  readonly config: TradingConfig = {
    rsiPeriod: 14,
    rsiOversold: 30,
    rsiOverbought: 70,
    minConfidence: 50,
  };

  async plan(
    params: {
      wantToBuy: Array<{ symbol: string; confidence: number; reason: string }>;
      wantToSell: Array<{ symbol: string; reason: string }>;
      activePositions: PositionState[];
      prices: Map<string, number>;
      klines: Map<string, Kline[]>;
      maxPositions: number;
    },
  ): Promise<SwapPlan> {
    const swaps: Array<{ sellSymbol: string; buySymbol: string; reason: string }> = [];

    for (const sell of params.wantToSell) {
      swaps.push({
        sellSymbol: sell.symbol,
        buySymbol: "",
        reason: sell.reason,
      });
    }

    for (const buy of params.wantToBuy) {
      swaps.push({
        sellSymbol: "",
        buySymbol: buy.symbol,
        reason: buy.reason,
      });
    }

    return { swaps };
  }
}

function makeKlines(nBars: number, startPrice = 100, step = 0.5): Kline[] {
  const klines: Kline[] = [];
  const baseTime = 1700000000000;
  for (let i = 0; i < nBars; i++) {
    const price = startPrice + i * step;
    klines.push({
      timestamp: baseTime + i * 3600000,
      open: price,
      high: price + 1,
      low: price - 1,
      close: price,
      volume: 1000,
    });
  }
  return klines;
}

Deno.test("pipelineSimulate returns correct PipelineResult structure", async () => {
  const coins = ["BTC-USDT", "ETH-USDT", "SOL-USDT"];
  const klines = new Map<string, Kline[]>();
  for (const coin of coins) klines.set(coin, makeKlines(100));

  const result = await pipelineSimulate({
    portfolioStrategy: new AlwaysBuyPortfolio(),
    tradingStrategy: new FirstCoinTrading(),
    klines,
    coins,
    interval: "1hour",
    config: { initialCapital: 1000, maxPositions: 3, fee: 0.001 },
  });

  if (result.trades.length !== result.totalTrades) {
    throw new Error(
      `trades.length ${result.trades.length} !== totalTrades ${result.totalTrades}`,
    );
  }
  if (result.equityCurve.length !== 100 - 50 + 2) {
    throw new Error(
      `equityCurve length ${result.equityCurve.length} !== ${100 - 50 + 2}`,
    );
  }
  if (result.totalReturn <= 0) throw new Error("Expected positive return with rising prices");
  if (result.sharpeRatio <= 0) throw new Error("Expected positive Sharpe ratio");
  if (result.maxDrawdown < 0) throw new Error("Max drawdown should be >= 0");
  if (result.winRate < 0 || result.winRate > 100) {
    throw new Error(`Win rate ${result.winRate} out of range`);
  }
  if (result.totalTrades > 0 && result.profitFactor <= 0) {
    throw new Error(`Profit factor ${result.profitFactor} should be > 0 when trades exist`);
  }
});

Deno.test("pipelineSimulate with insufficient data throws", async () => {
  const coins = ["BTC-USDT"];
  const klines = new Map<string, Kline[]>();
  klines.set("BTC-USDT", makeKlines(10));

  let threw = false;
  try {
    await pipelineSimulate({
      portfolioStrategy: new AlwaysBuyPortfolio(),
      tradingStrategy: new FirstCoinTrading(),
      klines,
      coins,
      interval: "1hour",
      config: { initialCapital: 1000, maxPositions: 3, fee: 0.001 },
    });
  } catch {
    threw = true;
  }
  if (!threw) throw new Error("Expected error with insufficient data");
});

Deno.test("pipelineSimulate with multiple coins respects maxPositions limit", async () => {
  const coins = ["BTC-USDT", "ETH-USDT", "SOL-USDT", "ADA-USDT", "DOT-USDT"];
  const klines = new Map<string, Kline[]>();
  for (const coin of coins) klines.set(coin, makeKlines(100));

  const result = await pipelineSimulate({
    portfolioStrategy: new AlwaysBuyPortfolio(),
    tradingStrategy: new FirstCoinTrading(),
    klines,
    coins,
    interval: "1hour",
    config: { initialCapital: 1000, maxPositions: 3, fee: 0.001 },
  });

  if (result.equityCurve[result.equityCurve.length - 1] <= 0) {
    throw new Error("Final equity should be positive");
  }
  if (result.maxDrawdown > 100) throw new Error("Drawdown > 100% impossible");
});

Deno.test("pipelineSimulate records trades when positions are sold", async () => {
  const coins = ["BTC-USDT", "ETH-USDT"];
  const klines = new Map<string, Kline[]>();
  for (const coin of coins) klines.set(coin, makeKlines(200, 100, 0.3));

  const result = await pipelineSimulate({
    portfolioStrategy: new RotatePortfolio(),
    tradingStrategy: new RotateTrading(),
    klines,
    coins,
    interval: "1hour",
    config: { initialCapital: 1000, maxPositions: 3, fee: 0.001 },
  });

  if (result.totalTrades <= 0) {
    throw new Error(
      `Expected at least 1 completed trade with rotate strategy, got ${result.totalTrades}`,
    );
  }
  for (const t of result.trades) {
    if (t.entryPrice <= 0) throw new Error(`entryPrice ${t.entryPrice} <= 0`);
    if (t.exitPrice <= 0) throw new Error(`exitPrice ${t.exitPrice} <= 0`);
    if (t.bars <= 0) throw new Error(`bars ${t.bars} <= 0`);
  }
  if (result.equityCurve.length !== 200 - 50 + 2) {
    throw new Error(
      `equityCurve length ${result.equityCurve.length} !== ${200 - 50 + 2}`,
    );
  }
});
