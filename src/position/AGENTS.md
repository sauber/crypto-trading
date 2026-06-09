# Position

Load current portfolio state from various sources.

## Interface

```ts
interface PositionLoader {
  readonly name: string;
  readonly config: PositionConfig;
  loadPositions(): Promise<PositionState[]>;
}
```

## Strategies

| Name | File | Description |
|------|------|-------------|
| `blank` | `blank.ts` | Returns empty portfolio (initial start) |
| `kucoin` | `kucoin.ts` | Reads current balances from KuCoin API |

## Config

```ts
interface PositionConfig {
  reserveSymbol: string;
  candleInterval: string;
  candleRangeMs: number;
}
```
