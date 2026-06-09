import type { PositionState, Swap, ExecutionResult } from "../engine/mod.ts";

export interface ExecutionConfig {
  fee: number;
  targetPositions?: number;
}

export interface ExecutionStrategy {
  readonly name: string;
  readonly config: ExecutionConfig;
  executeSwaps(swaps: Swap[], positions: Map<string, PositionState>, capital: number): Promise<ExecutionResult>;
}
