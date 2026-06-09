import type { ExecutionStrategy } from "./types.ts";
import type { PositionState, Swap, ExecutionResult, TradeRecord } from "../engine/mod.ts";
import type { Kline } from "../kucoin/mod.ts";

export function SimulateExecution(
  config: { fee: number; targetPositions?: number },
  prices?: Map<string, number>,
  klines?: Map<string, Kline[]>,
  currentBar?: number,
): ExecutionStrategy {
  const fee = config.fee;
  const targetPositions = config.targetPositions ?? 5;
  const _prices = prices ?? new Map();
  const _klines = klines ?? new Map();
  const _currentBar = currentBar ?? 0;

  const strategy = async (
    swaps: Swap[],
    positions: Map<string, PositionState>,
    capital: number,
  ): Promise<ExecutionResult> => {
    const newPositions = new Map(positions);
    const trades: TradeRecord[] = [];

    for (const swap of swaps) {
      let proceeds = 0;

      if (swap.sellSymbol && newPositions.has(swap.sellSymbol)) {
        const pos = newPositions.get(swap.sellSymbol)!;
        const sellPrice = _prices.get(swap.sellSymbol) || 0;
        if (sellPrice > 0) {
          proceeds = pos.size * sellPrice * (1 - fee);
          trades.push({
            entryTime: new Date(
              (_klines.get(swap.sellSymbol) || [])[pos.enteredAt]?.timestamp ?? 0,
            ).toISOString(),
            exitTime: new Date(
              (_klines.get(swap.sellSymbol) || [])[_currentBar]?.timestamp ?? 0,
            ).toISOString(),
            entryPrice: pos.entryPrice,
            exitPrice: sellPrice,
            pnlPct: ((sellPrice - pos.entryPrice) / pos.entryPrice) * 100,
            bars: _currentBar - pos.enteredAt,
            reason: swap.reason,
            buySymbol: swap.buySymbol,
            sellSymbol: swap.sellSymbol,
          });
          capital += proceeds;
          newPositions.delete(swap.sellSymbol);
        }
      }

      if (swap.buySymbol) {
        const buyPrice = _prices.get(swap.buySymbol) || 0;
        if (buyPrice > 0) {
          const slotsLeft = targetPositions - newPositions.size;
          const spend = proceeds > 0
            ? proceeds
            : capital / Math.max(1, slotsLeft);
          const size = (spend / buyPrice) * (1 - fee);
          capital -= spend;
          newPositions.set(swap.buySymbol, {
            symbol: swap.buySymbol,
            entryPrice: buyPrice,
            size,
            enteredAt: _currentBar,
            entryValue: spend,
          });
        }
      }
    }

    return { positions: newPositions, capital, trades };
  };

  Object.defineProperty(strategy, "name", { value: "simulate" });
  return strategy;
}
