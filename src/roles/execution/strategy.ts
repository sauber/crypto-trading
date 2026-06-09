import type { ExecutionStrategy } from "../types.ts";
import type { KucoinClient } from "../../kucoin/client.ts";
import type { OrderRequest } from "../../kucoin/types.ts";

export const config = {
  name: "market-order",
  dryRun: false,
};

export class MarketOrderExecution implements ExecutionStrategy {
  readonly name = "market-order";
  private client: KucoinClient;
  private dryRun: boolean;

  constructor(client: KucoinClient, dryRun: boolean) {
    this.client = client;
    this.dryRun = dryRun;
  }

  async executeBuy(symbol: string, size: string, reason: string): Promise<string> {
    const order: OrderRequest = { symbol, side: "buy", type: "market", size };
    if (this.dryRun) {
      console.log(`[DRY] Køb ${symbol} size=${size} — ${reason}`);
      return `dry-${Date.now()}`;
    }
    const result = await this.client.placeOrder(order);
    console.log(`Køb ${symbol} size=${size} — ${reason} order=${result.orderId}`);
    return result.orderId;
  }

  async executeSell(symbol: string, size: string, reason: string): Promise<string> {
    const order: OrderRequest = { symbol, side: "sell", type: "market", size };
    if (this.dryRun) {
      console.log(`[DRY] Sælg ${symbol} size=${size} — ${reason}`);
      return `dry-${Date.now()}`;
    }
    const result = await this.client.placeOrder(order);
    console.log(`Sælg ${symbol} size=${size} — ${reason} order=${result.orderId}`);
    return result.orderId;
  }
}
