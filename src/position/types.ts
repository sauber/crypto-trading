import type { PositionState } from "../engine/types.ts";

export interface PositionConfig {
  reserveSymbol: string;
  candleInterval: string;
  candleRangeMs: number;
}

export interface PositionLoader {
  readonly name: string;
  readonly config: PositionConfig;
  loadPositions(): Promise<PositionState[]>;
}
