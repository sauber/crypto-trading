# Market

Download, parse, and convert KuCoin kline data into `@sauber/backtest`-compatible instruments.

## Usage

```typescript
import { downloadData, market, timeline } from "./market/mod.ts";
import { Market } from "@sauber/backtest";
import { backtest, evaluate, display } from "./backtest/mod.ts";

// Step 1: Download raw klines (one-time)
await downloadData();

// Step 2: Build instruments with rank data
const instruments = await market();          // RankedInstrument[]
const marketObj = new Market(instruments);   // @sauber/backtest Market

// Step 3: Create timeline converter
const tl = await timeline();                 // { toBar, toDate }
const barIndex = tl.toBar(new Date("2025-01-15"));
const date = tl.toDate(42);

// Step 4: Use in backtest
const results = backtest(marketObj, strategy, 1000, 0.001, tl);
console.log(display(strategy, results));
```

## API

| Export | Description |
|--------|-------------|
| `downloadData()` | Fetch top coins from KuCoin, write `data/klines.json` |
| `market()` | Read cached klines → `RankedInstrument[]` with rank/rank-change |
| `timeline()` | Read cached klines → `{ toBar, toDate }` converter |
| `RankedInstrument` | `Instrument` subclass with `rank(tick)` and `rankChange(tick)` |
