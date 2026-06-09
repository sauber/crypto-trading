import type { PositionLoader } from "./types.ts";
import type { PositionState } from "../engine/types.ts";
import type { KucoinClient } from "../kucoin/mod.ts";

export function KucoinPositionLoader(
  config: { reserveSymbol: string; candleInterval: string; candleRangeMs: number },
  client: KucoinClient,
): PositionLoader {
  const { reserveSymbol, candleInterval, candleRangeMs } = config;

  const strategy = async (): Promise<PositionState[]> => {
    const balances = await client.getBalances();
    const activeBalances = balances.filter(
      (b) => parseFloat(b.available) > 0 && b.currency !== reserveSymbol,
    );

    if (activeBalances.length === 0) return [];

    const now = Date.now();
    const positions: PositionState[] = [];

    for (const b of activeBalances) {
      const symbol = `${b.currency}-USDT`;
      try {
        const ticker = await client.getTicker(symbol);
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
          const klines = await client.getKlines(
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
  };

  Object.defineProperty(strategy, "name", { value: "kucoin" });
  return strategy;
}
