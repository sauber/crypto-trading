# Discovery

Returns `RankedInstrument[]` with per-tick rank/rankChange computed from klines.

## Interface

```typescript
interface DiscoveryStrategy {
  (params?: DiscoveryParams): Promise<RankedInstrument[]>;
  readonly name: string;
}
```

## Strategies

| Name | File | Description |
|------|------|-------------|
| `kucoin` | `kucoin.ts` | Fetches via KuCoin REST API (live) |

### `kucoin` (`KucoinDiscovery`)

- **Usage**: Live trading
- **Data source**: KuCoin REST API (via `KucoinClient`)
- **Config**: `{ poolSize, interval, lookback }`
- **Behavior**: Fetches top USDT pairs, fetches klines for each, calls `buildRankedInstruments()` for per-tick rank/rankChange series.
