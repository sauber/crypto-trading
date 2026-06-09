# Communication

Report pipeline results and errors.

## Interface

```ts
interface CommunicationStrategy {
  readonly name: string;
  readonly config: CommunicationConfig;
  report(result: PipelineResult | LiveCycleResult): void;
  insight(insight: ReflectionInsight): void;
  error(err: Error): void;
}
```

## Strategies

| Name | File | Description |
|------|------|-------------|
| `silent` | `silent.ts` | No output (backtest mode) |
| `verbose` | `verbose.ts` | Console output (live mode) |

## Config

```ts
interface CommunicationConfig { silent: boolean }
```
