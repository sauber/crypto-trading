# Position

Load current portfolio state from various sources.

## Interface

```ts
interface PositionLoader {
  (): Promise<PositionState[]>;
  readonly name: string;
}
```

## Strategies

| Name | File | Description |
|------|------|-------------|
| `blank` | `blank.ts` | Returns empty portfolio (initial start) |
| `kucoin` | `kucoin.ts` | Reads current balances from KuCoin API |
