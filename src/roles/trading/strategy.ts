import type { TradingStrategy, SwapPlan, Swap } from "../types.ts";
import type { PositionState } from "../../risk/types.ts";

export const config = { name: "immediate-swap" };

export class ImmediateSwap implements TradingStrategy {
  readonly name = "immediate-swap";

  async plan(params: {
    wantToBuy: Array<{ symbol: string; confidence: number; reason: string; price: number }>;
    wantToSell: Array<{ symbol: string; size: string; reason: string }>;
    activePositions: PositionState[];
    prices: Map<string, number>;
    availableCapital: number;
    maxPositions: number;
  }): Promise<SwapPlan> {
    const swaps: Swap[] = [];
    const { wantToBuy, wantToSell, activePositions, prices } = params;

    // Match sells to buys one-to-one
    // Each sell frees up capital ≈ size * price, which gets reinvested in the buy
    const sellCandidates = [...wantToSell].filter((s) => prices.has(s.symbol) && (prices.get(s.symbol) || 0) > 0);
    const buyCandidates = [...wantToBuy].filter((b) => b.price > 0);

    const n = Math.min(sellCandidates.length, buyCandidates.length, params.maxPositions - 1);

    for (let i = 0; i < n; i++) {
      const sell = sellCandidates[i];
      const buy = buyCandidates[i];
      const price = prices.get(sell.symbol) || 0;
      const proceeds = parseFloat(sell.size) * price;
      swaps.push({
        sellSymbol: sell.symbol,
        sellSize: sell.size,
        buySymbol: buy.symbol,
        buyAmount: proceeds,
        reason: `${sell.reason} → ${buy.reason}`,
      });
    }

    // If there are more buys than sells, use availableCapital for additional buys
    const remainingBuys = buyCandidates.slice(n);
    if (remainingBuys.length > 0 && params.availableCapital > 0) {
      const slotsLeft = params.maxPositions - 1 - (activePositions.length - n);
      const perSlot = params.availableCapital / Math.max(1, slotsLeft);
      for (let i = 0; i < Math.min(remainingBuys.length, slotsLeft); i++) {
        const buy = remainingBuys[i];
        swaps.push({
          sellSymbol: "",
          sellSize: "",
          buySymbol: buy.symbol,
          buyAmount: perSlot,
          reason: `Ny position: ${buy.reason}`,
        });
      }
    }

    return { swaps };
  }
}
