# Execution

Execute swap plans as simulated or live KuCoin market orders.

> **Stub** — execution strategies are planned but not yet implemented.
> Currently, order execution is handled inline in `src/engine/live.ts`.

## Interface (planned)

```ts
interface ExecutionStrategy {
  (swaps: Swap[], positions: Map<string, PositionState>, capital: number): Promise<ExecutionResult>;
  readonly name: string;
}
```

## Strategies (planned)

| Name | File | Description |
|------|------|-------------|
| `simulate` | `simulate.ts` | Capital × (1-fee) calculation, no real API calls |
| `kucoin` | `kucoin.ts` | Places real market orders via KuCoin REST API |
