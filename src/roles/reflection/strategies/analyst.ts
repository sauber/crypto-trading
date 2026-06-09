import type { ReflectionStrategy, ReflectionConfig, PreconditionRecord, OutcomeRecord, ReflectionInsight } from "../types.ts";

export const config: ReflectionConfig = { enabled: true };

export class AnalystReflection implements ReflectionStrategy {
  readonly name = "analyst";
  readonly config: ReflectionConfig;
  private preconditions: PreconditionRecord[] = [];
  private outcomes: OutcomeRecord[] = [];

  constructor(config: ReflectionConfig) {
    this.config = config;
  }

  recordPrecondition(data: PreconditionRecord): void {
    this.preconditions.push(data);
  }

  recordOutcome(data: OutcomeRecord): void {
    this.outcomes.push(data);
  }

  reflect(): ReflectionInsight[] {
    const insights: ReflectionInsight[] = [];

    if (this.outcomes.length === 0) return insights;

    const recentOutcomes = this.outcomes.slice(-10);
    const wins = recentOutcomes.filter((o) => {
      const r = o.result as { totalReturn?: number };
      return (r.totalReturn ?? 0) > 0;
    });
    const losses = recentOutcomes.filter((o) => {
      const r = o.result as { totalReturn?: number };
      return (r.totalReturn ?? 0) <= 0;
    });

    if (wins.length > losses.length) {
      insights.push({
        type: "positive",
        message: `Recent performance: ${wins.length}/${recentOutcomes.length} cycles positive`,
        data: { wins: wins.length, total: recentOutcomes.length },
      });
    } else {
      insights.push({
        type: "warning",
        message: `Recent performance: ${losses.length}/${recentOutcomes.length} cycles negative`,
        data: { losses: losses.length, total: recentOutcomes.length },
      });
    }

    return insights;
  }
}
