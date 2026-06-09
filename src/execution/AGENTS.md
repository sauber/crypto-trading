# Execution

Execute swap plans as simulated or live KuCoin market orders.

## Interface

```ts
interface ExecutionStrategy {
  (swaps: Swap[], positions: Map<string, PositionState>, capital: number): Promise<ExecutionResult>;
  readonly name: string;
}
```

## Strategies

| Name | File | Description |
|------|------|-------------|
| `simulate` | `simulate.ts` | Capital × (1-fee) calculation, no real API calls |
| `kucoin` | `kucoin.ts` | Places real market orders via KuCoin REST API |
