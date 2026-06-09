import type { CommunicationStrategy, CommunicationConfig } from "./types.ts";
import type { PipelineResult } from "../engine/mod.ts";
import type { ReflectionInsight } from "../reflection/mod.ts";

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
