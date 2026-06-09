import type { PipelineResult } from "../engine/mod.ts";
import type { ReflectionInsight } from "../reflection/mod.ts";

export interface CommunicationConfig {
  silent: boolean;
}

export interface CommunicationStrategy {
  readonly name: string;
  readonly config: CommunicationConfig;
  report(result: PipelineResult): void;
  insight(insight: ReflectionInsight): void;
  error(err: Error): void;
}
