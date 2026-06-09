import type { ExecutionStrategy, ExecutionConfig } from "../types.ts";
import type { PositionState, Swap, ExecutionResult, TradeRecord } from "../../../engine/types.ts";
import { KucoinClient } from "../../../kucoin/client.ts";
import type { OrderRequest } from "../../../kucoin/types.ts";

export const config: ExecutionConfig = { fee: 0.001 };

export class KucoinExecution implements ExecutionStrategy {
  readonly name = "kucoin";
  readonly config: ExecutionConfig;
  private client: KucoinClient;
  private dryRun: boolean;

  constructor(config: ExecutionConfig, client: KucoinClient, dryRun: boolean) {
    this.config = config;
    this.client = client;
    this.dryRun = dryRun;
  }

  async executeSwaps(
    swaps: Swap[],
    _positions: Map<string, PositionState>,
    _capital: number,
  ): Promise<ExecutionResult> {
    const newPositions = new Map<string, PositionState>();
    const trades: TradeRecord[] = [];

    for (const swap of swaps) {
      if (swap.sellSymbol) {
        if (this.dryRun) {
          console.log(`[DRY] Sell ${swap.sellSymbol} — ${swap.reason}`);
          trades.push({
            entryTime: new Date().toISOString(),
            exitTime: new Date().toISOString(),
            entryPrice: 0,
            exitPrice: 0,
            pnlPct: 0,
            bars: 0,
            reason: swap.reason,
            buySymbol: swap.buySymbol,
            sellSymbol: swap.sellSymbol,
          });
        } else {
          try {
            const totalBalances = await this.client.getBalances();
            const currency = swap.sellSymbol.replace("-USDT", "");
            const bal = totalBalances.find((b) => b.currency === currency);
            if (bal && parseFloat(bal.available) > 0) {
              const order: OrderRequest = {
                symbol: swap.sellSymbol,
                side: "sell",
                type: "market",
                size: bal.available,
              };
              const result = await this.client.placeOrder(order);
              console.log(`Sold ${swap.sellSymbol} order=${result.orderId}`);
            }
          } catch (err) {
            console.error(`Sell error ${swap.sellSymbol}: ${err}`);
          }
        }
      }

      if (swap.buySymbol) {
        if (this.dryRun) {
          console.log(`[DRY] Buy ${swap.buySymbol} — ${swap.reason}`);
        } else {
          try {
            const usdcBal = await this.client.getBalance("USDC");
            const available = usdcBal ? parseFloat(usdcBal.available) : 0;
            if (available > 0) {
              const order: OrderRequest = {
                symbol: swap.buySymbol,
                side: "buy",
                type: "market",
                size: available.toFixed(2),
              };
              const result = await this.client.placeOrder(order);
              console.log(`Bought ${swap.buySymbol} order=${result.orderId}`);
            }
          } catch (err) {
            console.error(`Buy error ${swap.buySymbol}: ${err}`);
          }
        }
      }
    }

    return { positions: newPositions, capital: 0, trades };
  }
}
