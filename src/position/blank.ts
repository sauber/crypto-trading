import type { PositionLoader } from "./types.ts";
import type { PositionState } from "../engine/types.ts";

export function BlankPositionLoader(config?: {
  reserveSymbol?: string;
  candleInterval?: string;
  candleRangeMs?: number;
}): PositionLoader {
  const _config = {
    reserveSymbol: "USDC",
    candleInterval: "1hour",
    candleRangeMs: 55 * 3600000,
    ...config,
  };

  const strategy = async (): Promise<PositionState[]> => {
    return [];
  };

  Object.defineProperty(strategy, "name", { value: "blank" });
  return strategy;
}
