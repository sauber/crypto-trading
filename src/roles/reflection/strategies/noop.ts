import type { ReflectionStrategy, ReflectionConfig, PreconditionRecord, OutcomeRecord, ReflectionInsight } from "../types.ts";

export const config: ReflectionConfig = { enabled: false };

export class NoopReflection implements ReflectionStrategy {
  readonly name = "noop";
  readonly config: ReflectionConfig;

  constructor(config: ReflectionConfig) {
    this.config = config;
  }

  recordPrecondition(_data: PreconditionRecord): void {}
  recordOutcome(_data: OutcomeRecord): void {}
  reflect(): ReflectionInsight[] {
    return [];
  }
}
