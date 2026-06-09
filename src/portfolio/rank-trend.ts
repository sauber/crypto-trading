import type { PortfolioStrategy } from "./types.ts";
import type { PositionState, PortfolioDecision } from "../engine/types.ts";
import type { CoinCandidate } from "../discovery/mod.ts";

/**
 * Creates a portfolio strategy that tracks rank changes across cycles.
 *
 * Assigns ranks to candidates by score (1 = highest). Coins whose rank
 * improves (moves closer to 1) are flagged as buys; coins whose rank
 * declines while held are flagged as sells.
 *
 * @param targetPositions - Maximum number of positions to hold.
 * @returns A strategy function that scores candidates and returns a decision.
 */
export function RankTrendPortfolio(targetPositions: number): PortfolioStrategy {
  const rankHistory = new Map<string, number[]>();

  const strategy = function rankTrendStrategy(
    activePositions: PositionState[],
    candidates: CoinCandidate[],
  ): PortfolioDecision {
    const sorted = [...candidates].sort((a, b) => b.score - a.score);
    const currentRanks = new Map(sorted.map((c, i) => [c.symbol, i + 1]));

    for (const c of candidates) {
      if (!rankHistory.has(c.symbol)) rankHistory.set(c.symbol, []);
      const ranks = rankHistory.get(c.symbol)!;
      ranks.push(currentRanks.get(c.symbol) ?? candidates.length);
      if (ranks.length > 24) ranks.shift();
    }

    const scored = candidates.map((c) => {
      const hist = rankHistory.get(c.symbol) ?? [];
      const current = currentRanks.get(c.symbol) ?? candidates.length;
      const prev = hist.length > 1 ? hist[hist.length - 2] : current;
      return { symbol: c.symbol, rankChange: prev - current, rank: current };
    });

    const held = new Set(activePositions.map((p) => p.symbol));

    const wantToBuy = scored
      .filter((s) => s.rankChange > 0 && !held.has(s.symbol))
      .sort((a, b) => b.rankChange - a.rankChange)
      .slice(0, targetPositions)
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
  };

  Object.defineProperty(strategy, "name", {
    value: "rank-trend",
    writable: false,
    configurable: true,
  });

  return strategy;
}
