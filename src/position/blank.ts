import type { PositionLoader, PositionConfig } from "./types.ts";
import type { PositionState } from "../engine/types.ts";

export class BlankPositionLoader implements PositionLoader {
  readonly name = "blank";
  readonly config: PositionConfig;

  constructor(config?: Partial<PositionConfig>) {
    this.config = {
      reserveSymbol: "USDC",
      candleInterval: "1hour",
      candleRangeMs: 55 * 3600000,
      ...config,
    };
  }

  async loadPositions(): Promise<PositionState[]> {
    return [];
  }
}
