import type { TradingConfig } from "../../types.ts";

export const config: TradingConfig = {
  rsiPeriod: 14,
  rsiOversold: 30,
  rsiOverbought: 70,
  minConfidence: 50,
};
