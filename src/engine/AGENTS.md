# Engine

Shared engine types and pipeline execution.

## Files

| File | Purpose |
|------|---------|
| `types.ts` | `PositionState`, `PortfolioDecision`, `Swap`, `SwapPlan`, `PipelineResult`, `TradeRecord`, `ExecutionResult`, `SimData` |
| `simulate.ts` | `pipelineSimulate()` — bar-by-bar backtest |
| `live.ts` | `TradingEngine` — live loop with discovery/portfolio/trading/execution/reflection/logger |
| `mod.ts` | Re-exports all engine types for cross-module consumers |

## Interfaces

All interfaces in `types.ts` — see the file for type definitions.

### Pipeline simulate

```
Input:  portfolioStrategy, tradingStrategy, klines, coins, config
Output: PipelineResult

For each bar:
  1. Discovery outputs candidates
  2. Portfolio.analyze() → PortfolioDecision
  3. Trading.plan() → SwapPlan
  4. Execution.executeSwaps() → positions + capital updated
```

## Entry points

- `backtest.ts` — standalone backtest runner
- `optimize.ts` — BOHB hyperparameter optimization
- `trade.ts` — live trading loop
