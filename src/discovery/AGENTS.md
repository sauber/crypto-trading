# Discovery

Find top USDT-pairs by 24h volume and return them as `RankedInstrument[]` with per-tick ranks.

## Interface

```ts
interface DiscoveryStrategy {
  (params?: DiscoveryParams): Promise<RankedInstrument[]>;
  readonly name: string;
}
```

## Strategies

| Name | File | Description |
|------|------|-------------|
| `kucoin` | `kucoin.ts` | Fetches via KuCoin REST API (live) |

## Config

- `poolSize` — number of top symbols to fetch klines for (default: 50)
- `interval` — kline interval string (default: `"1hour"`)
- `lookback` — number of intervals to fetch (default: 24)
