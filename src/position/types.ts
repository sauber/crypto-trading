import type { PositionState } from "../engine/types.ts";

export interface PositionLoader {
  (): Promise<PositionState[]>;
  readonly name: string;
}
