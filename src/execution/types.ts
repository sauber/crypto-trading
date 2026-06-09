import type { PositionState, Swap, ExecutionResult } from "../engine/mod.ts";

export interface ExecutionStrategy {
  (swaps: Swap[], positions: Map<string, PositionState>, capital: number): Promise<ExecutionResult>;
  readonly name: string;
}
