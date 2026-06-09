import type { PositionLoader, PositionConfig } from "./types.ts";
import type { PositionState } from "../engine/types.ts";
import type { KucoinClient } from "../kucoin/mod.ts";

export class KucoinPositionLoader implements PositionLoader {
  readonly name = "kucoin";
  readonly config: PositionConfig;
  private client: KucoinClient;

  constructor(config: PositionConfig, client: KucoinClient) {
    this.config = config;
    this.client = client;
  }

  async loadPositions(): Promise<PositionState[]> {
    const { reserveSymbol, candleInterval, candleRangeMs } = this.config;
    const balances = await this.client.getBalances();
    const activeBalances = balances.filter(
      (b) => parseFloat(b.available) > 0 && b.currency !== reserveSymbol,
    );

    if (activeBalances.length === 0) return [];

    const now = Date.now();
    const positions: PositionState[] = [];

    for (const b of activeBalances) {
      const symbol = `${b.currency}-USDT`;
      try {
        const ticker = await this.client.getTicker(symbol);
        const price = ticker.last;
        const size = parseFloat(b.available);
        positions.push({
          symbol,
          entryPrice: price,
          size,
          enteredAt: now - candleRangeMs,
          entryValue: size * price,
        });
      } catch {
        try {
          const klines = await this.client.getKlines(
            symbol, candleInterval, now - candleRangeMs, now,
          );
          if (klines.length > 0) {
            const price = klines[klines.length - 1].close;
            const size = parseFloat(b.available);
            positions.push({
              symbol,
              entryPrice: price,
              size,
              enteredAt: now - candleRangeMs,
              entryValue: size * price,
            });
          }
        } catch {
          // skip coins where price cannot be determined
        }
      }
    }

    return positions;
  }
}
