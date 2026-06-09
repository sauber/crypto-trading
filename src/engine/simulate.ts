import type { PortfolioStrategy } from "../roles/portfolio/types.ts";
import type { TradingStrategy } from "../roles/trading/types.ts";
import type { DiscoveryStrategy } from "../discovery/types.ts";
import type { Kline } from "../kucoin/types.ts";
import type { PositionState, PipelineResult, TradeRecord } from "./types.ts";

export interface SimConfig {
  initialCapital: number;
  targetPositions: number;
  fee: number;
  startBar?: number;
  verbose?: boolean;
}

export interface SimParams {
  discoveryStrategy: DiscoveryStrategy;
  portfolioStrategy: PortfolioStrategy;
  tradingStrategy: TradingStrategy;
  klines: Map<string, Kline[]>;
  coins: string[];
  interval: string;
  config: SimConfig;
}

export async function pipelineSimulate(params: SimParams): Promise<PipelineResult> {
  const { discoveryStrategy, portfolioStrategy, tradingStrategy, klines, coins, interval, config } = params;
  const { initialCapital, targetPositions, fee } = config;
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
  const verbose = config.verbose ?? true;

  const barTime = (b: number): string =>
    new Date((klines.get(coins[0]) || [])[b]?.timestamp ?? 0).toISOString().slice(0, 16).replace("T", " ");

  const fmtPositions = (pos: Map<string, PositionState>, p: Map<string, number>): string[] =>
    [...pos.values()].map((po) => {
      const pr = p.get(po.symbol) ?? 0;
      return `${po.symbol.padEnd(12)} ${po.size.toFixed(4).padStart(10)} @ $${pr.toFixed(4).padStart(10)} = $${(po.size * pr).toFixed(2)}`;
    });

  for (let bar = startBar; bar < minBars; bar++) {
    const prices = new Map<string, number>();
    for (const coin of coins) {
      const k = klines.get(coin);
      if (k && k.length > bar) prices.set(coin, k[bar].close);
    }

    const candidates = await discoveryStrategy.discover({ klines, barIndex: bar });

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
      targetPositions,
    });

    const hadTrades = plan.swaps.length > 0;

    if (verbose && hadTrades) {
      console.log(`\n── Cycle ${bar - startBar + 1} @ ${barTime(bar)} ──`);
    }

    if (verbose && hadTrades) {
      const eq = equityCurve[equityCurve.length - 1];
      console.log(`   Equity: $${eq.toFixed(2)} | Capital: $${capital.toFixed(2)}`);

      // Portfolio: current positions
      if (positions.size > 0) {
        console.log(`   Portfolio (${positions.size}):`);
        for (const line of fmtPositions(positions, prices)) {
          console.log(`     ${line}`);
        }
      } else {
        console.log(`   Portfolio: (empty)`);
      }

      // Trading: wanted / unwanted signals
      if (decision.wantToBuy.length > 0) {
        console.log(`   Want to buy (${decision.wantToBuy.length}):`);
        for (const b of decision.wantToBuy) {
          console.log(`     ${b.symbol.padEnd(12)} confidence=${b.confidence}  ${b.reason}`);
        }
      }
      if (decision.wantToSell.length > 0) {
        console.log(`   Want to sell (${decision.wantToSell.length}):`);
        for (const s of decision.wantToSell) {
          console.log(`     ${s.symbol.padEnd(12)} ${s.reason}`);
        }
      }
    }

    for (const swap of plan.swaps) {
      let proceeds = 0;

      if (swap.sellSymbol && positions.has(swap.sellSymbol)) {
        const pos = positions.get(swap.sellSymbol)!;
        const sellPrice = prices.get(swap.sellSymbol) || 0;
        if (sellPrice > 0) {
          const gross = pos.size * sellPrice;
          proceeds = gross * (1 - fee);
          const feeAmt = gross * fee;
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
          if (verbose && hadTrades) {
            console.log(`   ─ Sell ${swap.sellSymbol}: ${pos.size.toFixed(4)} coins @ $${sellPrice.toFixed(4)} = $${gross.toFixed(2)} - fee $${feeAmt.toFixed(4)} → $${proceeds.toFixed(2)} received`);
          }
        }
      }

      if (swap.buySymbol) {
        const buyPrice = prices.get(swap.buySymbol) || 0;
        if (buyPrice > 0) {
          const slotsLeft = targetPositions - positions.size;
          const spend = proceeds > 0
            ? proceeds
            : capital / Math.max(1, slotsLeft);
          const size = (spend / buyPrice) * (1 - fee);
          const buyFee = size * buyPrice * fee;
          capital -= spend;
          positions.set(swap.buySymbol, {
            symbol: swap.buySymbol,
            entryPrice: buyPrice,
            size,
            enteredAt: bar,
            entryValue: spend,
          });
          if (verbose && hadTrades) {
            console.log(`   ─ Buy  ${swap.buySymbol}: ${size.toFixed(4)} coins @ $${buyPrice.toFixed(4)} = $${spend.toFixed(2)} spent (fee $${buyFee.toFixed(4)})`);
          }
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
