---
name: kucoin-trading
description: KuCoin crypto trading agent with 6-role pipeline architecture. TypeScript/Deno project. Use this skill when working with the trading agent's code, strategies or KuCoin API integration.
---

## Architecture (see AGENTS.md for details)

The system consists of 6 roles, executed in a pipeline every hour:

```
Discovery → Portfolio → Trading → Execution → Reflection → Communication
```

- **Discovery**: Find top 20 USDT-pairs by 24h volume (fast, not optimizable)
- **Portfolio**: Assess wanted/unwanted coins based on rank change. Allocate position sizing.
- **Trading**: Timing of swaps via technical indicators (RSI, MACD, BB). Signal on BOTH buy and sell coin.
- **Execution**: Execute swaps — simulated (capital × (1-fee)) or live (KuCoin market order).
- **Reflection**: Collect decisions + outcomes, analyze success/failure (live only).
- **Communication**: Report status — silent in backtest, verbose in live.

## Key concepts

- **Runtime**: Deno 2.7+, TypeScript, strict mode
- **Exchange**: KuCoin via REST API (sub-account)
- **Pipeline backtest**: Entire pipeline runs bar-by-bar (not per-strategy isolation)
- **Optimization**: BOHB over (portfolio_strat × portfolio_params) × (trading_strat × trading_params)
- **Data**: `data/klines.json` downloaded by `deno task testdata` — no API calls during backtest/optimize
- **SOLID**: Single Responsibility per rolle, Open/Closed via RoleRegistry, Dependency Inversion via interfaces

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

- Each strategy has its own directory with `strategy.ts` + `config.ts`
- Strategy names in `kebab-case`
- `import type` for type-only imports
- Write tests BEFORE implementation (TDD)
- See AGENTS.md for complete architecture, interfaces, and migration plan
