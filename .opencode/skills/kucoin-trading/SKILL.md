---
name: kucoin-trading
description: KuCoin crypto trading agent with 6-role pipeline architecture. TypeScript/Deno project. Use this skill when working with the trading agent's code, strategies or KuCoin API integration.
---

## Architecture (see AGENTS.md for details)

6-role pipeline executed every trading cycle (1h):

```
Discovery → Portfolio → Trading → Execution → Reflection → Communication
```

- **Discovery**: Find top 20 USDT-pairs by 24h volume
- **Portfolio**: Assess wanted/unwanted coins based on rank change; position sizing
- **Trading**: Timing of swaps via technical indicators (RSI, MACD, BB, EMA+ADX)
- **Execution**: Simulated (capital × (1-fee)) or live KuCoin market orders
- **Reflection**: Collect decisions + outcomes, analyze success/failure (live only)
- **Communication**: Report status — silent in backtest, verbose in live

## Module structure

Flat top-level modules under `src/`:

| Module | Contents |
|--------|----------|
| `engine/` | Pipeline simulate, live engine, shared types |
| `discovery/` | Top-volume coin discovery (testdata, kucoin) |
| `portfolio/` | Rank-trend portfolio strategy |
| `trading/` | RSI, MACD, BB, EMA+ADX timed strategies |
| `execution/` | Simulated + KuCoin execution |
| `communication/` | Silent + verbose reporting |
| `reflection/` | Noop + analyst reflection |
| `position/` | Blank + KuCoin portfolio loaders |
| `registry/` | RoleRegistry + all strategy registrations |
| `kucoin/` | KuCoin REST API client + types |

## Key concepts

- **Runtime**: Deno 2.7+, TypeScript, strict mode
- **Exchange**: KuCoin via REST API (sub-account)
- **Pipeline backtest**: Entire pipeline runs bar-by-bar (not per-strategy isolation)
- **Optimization**: BOHB over (portfolio_strat × portfolio_params) × (trading_strat × trading_params)
- **Data**: `data/klines.json` downloaded by `deno task testdata` — no API calls during backtest/optimize
- **SOLID**: Single Responsibility per module, Open/Closed via RoleRegistry, Dependency Inversion via interfaces

## Environment variables

| Variable | Description |
|----------|-------------|
| `KUCOIN_API_KEY` | API key from KuCoin sub-account |
| `KUCOIN_API_SECRET` | API secret |
| `KUCOIN_API_PASSPHRASE` | API passphrase |
| `DRY_RUN` | `"true"` = no real orders (live) |

## Commands

```sh
deno task testdata              # Download kline data (first time)
deno task backtest              # Run pipeline backtest
deno task optimize              # BOHB parameter optimization
deno task trade                 # Live trading (dry-run with DRY_RUN=true)
deno check src/                 # Type-check entire project
deno test --allow-read          # Run tests
```

## Development notes

- Each strategy is a single file in its component directory, config in `<name>.config.ts`
- Cross-module imports go through `mod.ts`; intra-module uses direct `./file.ts` paths
- `import type` for type-only imports
- Write tests BEFORE implementation (TDD)
- See `AGENTS.md` and per-component `AGENTS.md` for interfaces and architecture
