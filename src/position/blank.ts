import type { PositionLoader } from "./types.ts";
import type { PositionState } from "../engine/types.ts";

export function BlankPositionLoader(config?: {
  reserveSymbol?: string;
  candleInterval?: string;
  candleLookback?: number;
}): PositionLoader {
  const _config = {
    reserveSymbol: "USDC",
    candleInterval: "1hour",
    candleLookback: 55,
    ...config,
  };

  const strategy = async (): Promise<PositionState[]> => {
    return [];
  };

  Object.defineProperty(strategy, "name", { value: "blank" });
  return strategy;
}
