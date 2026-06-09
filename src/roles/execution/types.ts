import type { PositionState, Swap, ExecutionResult } from "../../engine/types.ts";

export interface ExecutionConfig {
  fee: number;
  maxPositions?: number;
}

export interface ExecutionStrategy {
  readonly name: string;
  readonly config: ExecutionConfig;
  executeSwaps(swaps: Swap[], positions: Map<string, PositionState>, capital: number): Promise<ExecutionResult>;
}
