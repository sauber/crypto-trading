import type { PositionState, PortfolioDecision } from "../engine/types.ts";
import type { CoinCandidate } from "../discovery/mod.ts";

export interface PortfolioStrategy {
  (activePositions: PositionState[], candidates: CoinCandidate[]): PortfolioDecision;
  readonly name: string;
}
