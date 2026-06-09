import type { PortfolioStrategy } from "../roles/portfolio/types.ts";
import type { TradingStrategy } from "../roles/trading/types.ts";
import type { Kline } from "../kucoin/types.ts";
import type { PositionState, PipelineResult, TradeRecord } from "./types.ts";
import type { CoinCandidate } from "../roles/types.ts";

export interface SimConfig {
  initialCapital: number;
  maxPositions: number;
  fee: number;
  startBar?: number;
}

export interface SimParams {
  portfolioStrategy: PortfolioStrategy;
  tradingStrategy: TradingStrategy;
  klines: Map<string, Kline[]>;
  coins: string[];
  interval: string;
  config: SimConfig;
}

export async function pipelineSimulate(params: SimParams): Promise<PipelineResult> {
  const { portfolioStrategy, tradingStrategy, klines, coins, interval, config } = params;
  const { initialCapital, maxPositions, fee } = config;
  const startBar = config.startBar ?? 50;

  const barCounts = coins.map((c) => (klines.get(c) || []).length);
  const minBars = Math.min(...barCounts);
  if (minBars <= startBar) {
    throw new Error(`Not enough data: need >${startBar} bars, got ${minBars}`);
  }

  let capital = initialCapital;
  const positions = new Map<string, PositionState>();
  const trades: TradeRecord[] = [];
  const equityCurve: number[] = [initialCapital];
  let peak = initialCapital;
  let maxDD = 0;

  for (let bar = startBar; bar < minBars; bar++) {
    const prices = new Map<string, number>();
    for (const coin of coins) {
      const k = klines.get(coin);
      if (k && k.length > bar) prices.set(coin, k[bar].close);
    }

    const candidates: CoinCandidate[] = coins.map((c) => {
      const k = klines.get(c);
      const lastKline = k?.[bar];
      return {
        symbol: c,
        score: lastKline?.volume ?? 0,
        reason: "simulation",
      };
    });

    const activePositions = [...positions.values()];

    let equity = capital;
    for (const pos of activePositions) {
      const price = prices.get(pos.symbol) ?? 0;
      equity += pos.size * price;
    }
    if (equity > peak) peak = equity;
    const dd = (peak - equity) / peak;
    if (dd > maxDD) maxDD = dd;
    equityCurve.push(equity);

    const decision = await portfolioStrategy.analyze({
      candidates,
      activePositions,
      prices,
      client: undefined as any,
      interval,
      candleRangeMs: 0,
    });

    const klinesUpToBar = new Map<string, Kline[]>();
    for (const coin of coins) {
      const k = klines.get(coin);
      if (k) klinesUpToBar.set(coin, k.slice(0, bar + 1));
    }

    const plan = await tradingStrategy.plan({
      wantToBuy: decision.wantToBuy,
      wantToSell: decision.wantToSell,
      activePositions,
      prices,
      klines: klinesUpToBar,
      maxPositions,
    });

    for (const swap of plan.swaps) {
      let proceeds = 0;

      if (swap.sellSymbol && positions.has(swap.sellSymbol)) {
        const pos = positions.get(swap.sellSymbol)!;
        const sellPrice = prices.get(swap.sellSymbol) || 0;
        if (sellPrice > 0) {
          proceeds = pos.size * sellPrice * (1 - fee);
          trades.push({
            entryTime: new Date(
              (klines.get(swap.sellSymbol) || [])[pos.enteredAt]?.timestamp ?? 0,
            ).toISOString(),
            exitTime: new Date(
              (klines.get(swap.sellSymbol) || [])[bar]?.timestamp ?? 0,
            ).toISOString(),
            entryPrice: pos.entryPrice,
            exitPrice: sellPrice,
            pnlPct: ((sellPrice - pos.entryPrice) / pos.entryPrice) * 100,
            bars: bar - pos.enteredAt,
            reason: swap.reason,
            buySymbol: swap.buySymbol,
            sellSymbol: swap.sellSymbol,
          });
          capital += proceeds;
          positions.delete(swap.sellSymbol);
        }
      }

      if (swap.buySymbol) {
        const buyPrice = prices.get(swap.buySymbol) || 0;
        if (buyPrice > 0) {
          const slotsLeft = maxPositions - 1 - positions.size;
          const spend = proceeds > 0
            ? proceeds
            : capital / Math.max(1, slotsLeft);
          const size = (spend / buyPrice) * (1 - fee);
          capital -= spend;
          positions.set(swap.buySymbol, {
            symbol: swap.buySymbol,
            entryPrice: buyPrice,
            size,
            enteredAt: bar,
            entryValue: spend,
          });
        }
      }
    }
  }

  let finalEquity = capital;
  for (const [symbol, pos] of positions) {
    const k = klines.get(symbol);
    if (k && k.length > 0) finalEquity += pos.size * k[k.length - 1].close;
  }
  equityCurve.push(finalEquity);

  const wins = trades.filter((t) => t.pnlPct > 0);
  const losses = trades.filter((t) => t.pnlPct <= 0);
  const totalReturn = ((finalEquity - initialCapital) / initialCapital) * 100;
  const totalProfits = wins.reduce((s, t) => s + t.pnlPct, 0);
  const totalLosses = Math.abs(losses.reduce((s, t) => s + t.pnlPct, 0));
  const profitFactor = totalLosses > 0
    ? totalProfits / totalLosses
    : totalProfits > 0
    ? Infinity
    : 0;
  const winRate = trades.length > 0 ? (wins.length / trades.length) * 100 : 0;

  const returns = equityCurve.slice(1).map((e, i) =>
    (e - equityCurve[i]) / equityCurve[i]
  );
  const avgReturn = returns.length > 0
    ? returns.reduce((a, b) => a + b, 0) / returns.length
    : 0;
  const variance = returns.reduce((s, r) => s + (r - avgReturn) ** 2, 0) /
    returns.length;
  const stdDev = Math.sqrt(variance);
  const sharpeRatio = stdDev > 0
    ? (avgReturn / stdDev) * Math.sqrt(365 * 24)
    : 0;

  return {
    equityCurve,
    trades,
    totalReturn,
    maxDrawdown: maxDD * 100,
    sharpeRatio,
    winRate,
    profitFactor,
    totalTrades: trades.length,
  };
}
