# Discovery

Find top USDT-pairs by 24h volume.

## Interface

```ts
interface DiscoveryStrategy {
  readonly name: string;
  readonly config: DiscoveryConfig;
  discover(params?: DiscoveryParams): Promise<CoinCandidate[]>;
}
```

## Strategies

| Name | File | Description |
|------|------|-------------|
| `testdata` | `testdata.ts` | Reads from pre-loaded klines map (backtest/optimize) |
| `kucoin` | `kucoin.ts` | Fetches via KuCoin REST API (live) |

## Config

```ts
interface DiscoveryConfig { topN: number }
```

## Types

- `CoinCandidate` — `{ symbol, score, reason }` output type
- `DiscoveryParams` — optional klines + barIndex for testdata mode
