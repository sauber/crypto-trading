import type { KucoinClient } from "../kucoin/client.ts";
import type { RiskConfig, PositionState, RiskDecision, CloseAction } from "./types.ts";

export const DEFAULT_RISK_CONFIG: RiskConfig = {
  maxPositions: 5,
  reserveSymbol: "USDC",
  stopLossPct: 0.10,
  takeProfitPct: 0.20,
};

export class RiskManager {
  private positions = new Map<string, PositionState>();
  private config: RiskConfig;
  private client: KucoinClient;

  constructor(client: KucoinClient, config: RiskConfig = DEFAULT_RISK_CONFIG) {
    this.client = client;
    this.config = config;
  }

  getConfig(): RiskConfig {
    return { ...this.config };
  }

  getPositions(): PositionState[] {
    return [...this.positions.values()];
  }

  getActiveCount(): number {
    return this.positions.size;
  }

  hasPosition(symbol: string): boolean {
    return this.positions.has(symbol);
  }

  addPosition(symbol: string, entryPrice: number, size: string, entryValue: number): void {
    this.positions.set(symbol, {
      symbol, entryPrice, size, entryValue,
      enteredAt: Date.now(),
    });
  }

  removePosition(symbol: string): void {
    this.positions.delete(symbol);
  }

  async evaluate(
    priceMap: Map<string, number>,
    sellSignals: Map<string, string>,
  ): Promise<RiskDecision> {
    const toClose: CloseAction[] = [];
    const config = this.config;

    for (const [symbol, pos] of this.positions) {
      const currentPrice = priceMap.get(symbol);
      if (!currentPrice) continue;

      const pnlPct = (currentPrice - pos.entryPrice) / pos.entryPrice;

      if (pnlPct <= -config.stopLossPct) {
        toClose.push({ symbol, reason: "stop_loss" });
      } else if (pnlPct >= config.takeProfitPct) {
        toClose.push({ symbol, reason: "take_profit" });
      } else if (sellSignals.has(symbol)) {
        toClose.push({ symbol, reason: "strategy_sell", strategyReason: sellSignals.get(symbol) });
      }
    }

    const slotsFreed = toClose.length;
    const activeAfterClose = this.positions.size - slotsFreed;
    const maxTradeSlots = config.maxPositions - 1;
    const slotsAvailable = maxTradeSlots - activeAfterClose;

    const reason = toClose.length > 0
      ? `Lukker ${toClose.length} position(er): ${toClose.map((c) => c.reason).join(", ")}`
      : "Ingen ændringer";

    return { toClose, slotsAvailable, reason };
  }

  async calculateSize(availableUSDT: number): Promise<string> {
    const tradeSlots = this.config.maxPositions - 1;
    const size = availableUSDT / tradeSlots;
    return size.toFixed(2);
  }
}
