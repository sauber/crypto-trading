# KuCoin Client

REST API wrapper for KuCoin exchange.

## Files

| File | Purpose |
|------|---------|
| `client.ts` | `KucoinClient` class — HTTP methods for market data, orders, balances |
| `types.ts` | Type definitions: `KucoinConfig`, `Balance`, `Ticker`, `Kline`, `OrderRequest`, `OrderResult`, `LiquidityRanking`, `Position` |
| `mod.ts` | Re-exports all types + client for cross-module consumers |

## Methods

- `getTopVolumeSymbols(topN)` — USDT pairs sorted by 24h volume
- `getKlines(symbol, interval, start, end)` — historical OHLCV
- `getBalances()` — account balances
- `getTicker(symbol)` — 24h ticker
- `placeMarketOrder(symbol, side, size)` — place market order
