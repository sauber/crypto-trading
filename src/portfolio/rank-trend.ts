import type { PortfolioStrategy, PortfolioConfig } from "./types.ts";
import type { PositionState, PortfolioDecision } from "../engine/types.ts";
import type { CoinCandidate } from "../discovery/mod.ts";

export class RankTrendPortfolio implements PortfolioStrategy {
  readonly name = "rank-trend";
  readonly config: PortfolioConfig;
  private rankHistory = new Map<string, number[]>();

  constructor(config: PortfolioConfig) {
    this.config = config;
  }

  async analyze(params: {
    candidates: CoinCandidate[];
    activePositions: PositionState[];
    prices: Map<string, number>;
    client: unknown;
    interval: string;
    candleRangeMs: number;
  }): Promise<PortfolioDecision> {
    const sorted = [...params.candidates].sort((a, b) => b.score - a.score);
    const currentRanks = new Map(
      sorted.map((c, i) => [c.symbol, i + 1]),
    );

    for (const c of params.candidates) {
      if (!this.rankHistory.has(c.symbol)) {
        this.rankHistory.set(c.symbol, []);
      }
      const ranks = this.rankHistory.get(c.symbol)!;
      ranks.push(currentRanks.get(c.symbol) ?? params.candidates.length);
      if (ranks.length > 24) ranks.shift();
    }

    const scored = params.candidates.map((c) => {
      const hist = this.rankHistory.get(c.symbol) ?? [];
      const current = currentRanks.get(c.symbol) ?? params.candidates.length;
      const prev = hist.length > 1 ? hist[hist.length - 2] : current;
      return {
        symbol: c.symbol,
        rankChange: prev - current,
        rank: current,
      };
    });

    const held = new Set(params.activePositions.map((p) => p.symbol));

    const wantToBuy = scored
      .filter((s) => s.rankChange > 0 && !held.has(s.symbol))
      .sort((a, b) => b.rankChange - a.rankChange)
      .slice(0, this.config.targetPositions)
      .map((s) => ({
        symbol: s.symbol,
        confidence: Math.min(s.rankChange * 20, 100),
        reason: `rank +${s.rankChange} (#${s.rank})`,
      }));

    const wantToSell = scored
      .filter((s) => s.rankChange < 0 && held.has(s.symbol))
      .map((s) => ({
        symbol: s.symbol,
        reason: `rank ${s.rankChange} (#${s.rank})`,
      }));

    return { wantToBuy, wantToSell };
  }
}
