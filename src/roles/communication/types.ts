import type { PipelineResult } from "../../engine/types.ts";
import type { ReflectionInsight } from "../reflection/types.ts";

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
