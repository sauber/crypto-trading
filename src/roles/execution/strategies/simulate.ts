import type { ExecutionStrategy, ExecutionConfig } from "../types.ts";
import type { PositionState, Swap, ExecutionResult, TradeRecord } from "../../../engine/types.ts";
import type { Kline } from "../../../kucoin/types.ts";

export const config: ExecutionConfig = { fee: 0.001, maxPositions: 5 };

export class SimulateExecution implements ExecutionStrategy {
  readonly name = "simulate";
  readonly config: ExecutionConfig;
  private prices: Map<string, number>;
  private klines: Map<string, Kline[]>;
  private currentBar: number;

  constructor(
    config: ExecutionConfig,
    prices?: Map<string, number>,
    klines?: Map<string, Kline[]>,
    currentBar?: number,
  ) {
    this.config = config;
    this.prices = prices ?? new Map();
    this.klines = klines ?? new Map();
    this.currentBar = currentBar ?? 0;
  }

  setPrices(prices: Map<string, number>): void {
    this.prices = prices;
  }

  setKlines(klines: Map<string, Kline[]>): void {
    this.klines = klines;
  }

  setCurrentBar(bar: number): void {
    this.currentBar = bar;
  }

  async executeSwaps(
    swaps: Swap[],
    positions: Map<string, PositionState>,
    capital: number,
  ): Promise<ExecutionResult> {
    const newPositions = new Map(positions);
    const trades: TradeRecord[] = [];
    const fee = this.config.fee;

    for (const swap of swaps) {
      let proceeds = 0;

      if (swap.sellSymbol && newPositions.has(swap.sellSymbol)) {
        const pos = newPositions.get(swap.sellSymbol)!;
        const sellPrice = this.prices.get(swap.sellSymbol) || 0;
        if (sellPrice > 0) {
          proceeds = pos.size * sellPrice * (1 - fee);
          trades.push({
            entryTime: new Date(
              (this.klines.get(swap.sellSymbol) || [])[pos.enteredAt]?.timestamp ?? 0,
            ).toISOString(),
            exitTime: new Date(
              (this.klines.get(swap.sellSymbol) || [])[this.currentBar]?.timestamp ?? 0,
            ).toISOString(),
            entryPrice: pos.entryPrice,
            exitPrice: sellPrice,
            pnlPct: ((sellPrice - pos.entryPrice) / pos.entryPrice) * 100,
            bars: this.currentBar - pos.enteredAt,
            reason: swap.reason,
            buySymbol: swap.buySymbol,
            sellSymbol: swap.sellSymbol,
          });
          capital += proceeds;
          newPositions.delete(swap.sellSymbol);
        }
      }

      if (swap.buySymbol) {
        const buyPrice = this.prices.get(swap.buySymbol) || 0;
        if (buyPrice > 0) {
          const maxPositions = this.config.maxPositions ?? 5;
          const slotsLeft = maxPositions - 1 - newPositions.size;
          const spend = proceeds > 0
            ? proceeds
            : capital / Math.max(1, slotsLeft);
          const size = (spend / buyPrice) * (1 - fee);
          capital -= spend;
          newPositions.set(swap.buySymbol, {
            symbol: swap.buySymbol,
            entryPrice: buyPrice,
            size,
            enteredAt: this.currentBar,
            entryValue: spend,
          });
        }
      }
    }

    return { positions: newPositions, capital, trades };
  }
}
