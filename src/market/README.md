# Market

Download, parse, and convert KuCoin kline data into `@sauber/backtest`-compatible instruments.

## Usage

```typescript
import { market, timeline } from "./market/mod.ts";
import { Market } from "@sauber/backtest";
import { backtest, evaluate, display } from "./backtest/mod.ts";

// Step 1: Download raw klines (one-time, via CLI)
//   deno task testdata

// Step 2: Build instruments with rank data
const instruments = await market();          // RankedInstrument[]
const marketObj = new Market(instruments);   // @sauber/backtest Market

// Step 3: Create timeline converter
const tl = await timeline();                 // { toTick, toDate }
const tickIndex = tl.toTick(new Date("2025-01-15"));
const date = tl.toDate(42);

// Step 4: Use in backtest
const results = backtest(marketObj, strategy, 1000, 0.001, tl);
console.log(display(strategy, results));
```

## API

| Export | Description |
|--------|-------------|
| `market()` | Read cached klines → `RankedInstrument[]` with rank/rank-change |
| `timeline()` | Read cached klines → `{ toTick, toDate }` converter |
| `RankedInstrument` | `Instrument` subclass with `rank(tick)` and `rankChange(tick)` |

## CLI scripts

| Script | Task | Description |
|--------|------|-------------|
| `download-data.ts` | `deno task testdata` | Fetch top coins from KuCoin, verify uniform candle length, write `data/klines.json` |
| `list-coins.ts` | `deno task coins` | Display current liquidity rank table with rank-change and color highlighting |

## Module structure

- **`download.ts`** — fetch + verify (no console output; accepts `onProgress` callback)
- **`market.ts`** — load cached data, compute per-tick rank and rank-change series
- **`timeline.ts`** — convert between tick indices and wall-clock `Date`
- **`ranked-instrument.ts`** — `Instrument` subclass with rank/rankChange/klines/volumes
- Scripts (`download-data.ts`, `list-coins.ts`) handle all console I/O; modules contain only logic.
