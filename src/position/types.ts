import type { PositionState } from "../engine/mod.ts";

export interface PositionLoader {
  (): Promise<PositionState[]>;
  readonly name: string;
}
