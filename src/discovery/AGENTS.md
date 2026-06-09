# Discovery

Find top USDT-pairs by 24h volume.

## Interface

```ts
interface DiscoveryStrategy {
  (params?: DiscoveryParams): Promise<CoinCandidate[]>;
  readonly name: string;
}
```

## Strategies

| Name | File | Description |
|------|------|-------------|
| `testdata` | `testdata.ts` | Reads from pre-loaded klines map (backtest/optimize) |
| `kucoin` | `kucoin.ts` | Fetches via KuCoin REST API (live) |

## Types

- `CoinCandidate` — `{ symbol, score, reason }` output type
- `DiscoveryParams` — optional klines + barIndex for testdata mode
