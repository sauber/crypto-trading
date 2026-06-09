export interface ReflectionConfig {
  enabled: boolean;
}

export interface PreconditionRecord {
  cycle: number;
  portfolioDecision: unknown;
  swapPlan: unknown;
}

export interface OutcomeRecord {
  cycle: number;
  result: unknown;
}

export interface ReflectionInsight {
  type: string;
  message: string;
  data: unknown;
}

export interface ReflectionStrategy {
  readonly name: string;
  readonly config: ReflectionConfig;
  recordPrecondition(data: PreconditionRecord): void;
  recordOutcome(data: OutcomeRecord): void;
  reflect(): ReflectionInsight[];
}
