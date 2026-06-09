import type { CommunicationStrategy, CommunicationConfig } from "../types.ts";
import type { PipelineResult } from "../../../engine/types.ts";
import type { ReflectionInsight } from "../../reflection/types.ts";

export const config: CommunicationConfig = { silent: true };

export class SilentComm implements CommunicationStrategy {
  readonly name = "silent";
  readonly config: CommunicationConfig;

  constructor(config: CommunicationConfig) {
    this.config = config;
  }

  report(_result: PipelineResult): void {}
  insight(_insight: ReflectionInsight): void {}
  error(_err: Error): void {}
}
