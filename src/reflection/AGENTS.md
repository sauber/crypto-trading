# Reflection

Collect decisions and outcomes, analyze success/failure patterns.

## Interface

```ts
interface ReflectionStrategy {
  readonly name: string;
  readonly config: ReflectionConfig;
  recordPrecondition(data: PreconditionRecord): void;
  recordOutcome(data: OutcomeRecord): void;
  reflect(): ReflectionInsight[];
}
```

## Strategies

| Name | File | Description |
|------|------|-------------|
| `noop` | `noop.ts` | No-op (backtest mode) |
| `analyst` | `analyst.ts` | Logs decisions and outcomes for review (live mode) |

## Config

```ts
interface ReflectionConfig { enabled: boolean }
```
