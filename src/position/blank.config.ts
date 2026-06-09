import type { PositionConfig } from "./types.ts";

export const config: PositionConfig = {
  reserveSymbol: "USDC",
  candleInterval: "1hour",
  candleRangeMs: 55 * 3600000,
};
