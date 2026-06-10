# Engine

Shared engine types and pipeline execution.

## Files

| File | Purpose |
|------|---------|
| `types.ts` | `PositionState`, `ExecutionResult`, `TradeRecord` |
| `live.ts` | `TradingEngine` — live loop with discovery/portfolio/trading/execution/reflection/logging |
| `interval.ts` | `intervalToMs()` — interval string to milliseconds conversion |
| `mod.ts` | Re-exports engine types for cross-module consumers |

## Interfaces

All interfaces in `types.ts` — see the file for type definitions.

## Entry points

- `src/backtest/backtest_strategy.ts` — standalone backtest runner
- `src/optimize/optimize_parameters.ts` — BOHB hyperparameter optimization
- `src/trade/trade_account.ts` — live trading loop
