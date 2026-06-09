# Communication

Log pipeline events, decisions, and trades.

## Interface

```ts
interface LogEntry {
  timestamp?: string;
  cycle?: number;
  action: string;
  symbol?: string;
  side?: "buy" | "sell";
  reason?: string;
  message: string;
}

interface Logger {
  (entry: LogEntry): void;
  readonly name: string;
}
```

## Loggers

| Name | File | Use | Timestamps |
|------|------|-----|------------|
| `silent` | `silent.ts` | Optimizing | None |
| `line-journal` | `line-journal.ts` | Backtest / Live | From caller or `Date.now()` |
| `dashboard` *(future)* | — | Live trading | Realtime |

## Usage

Loggers are passed as a parameter to engine factories:

```ts
// Backtest
const logger = LineJournal();
const result = await pipelineSimulate({ ..., logger });

// Live trading
const logger = LineJournal();
const engine = new TradingEngine({ ..., logger });
```

## Design notes

- Single-method callable interface (function with `.name` property)
- Logger implementation determines output verbosity and format
- Backtest passes kline timestamps; live trading omits timestamps (handled by logger)
- Future: Dashboard logger with TUI rendering
