---
name: file-structure
description: Module structure conventions for the KuCoin trading agent. Use when creating new files or refactoring existing modules.
---

# Module structure

## Top-level flat modules

Each component is a flat directory under `src/`:

```
src/<component>/
├── <file>.ts            # Implementation
├── <file>.test.ts       # Test alongside
├── types.ts             # Interface definitions
└── mod.ts               # Barrel export (named exports only)
```

## Import rules

- **Cross-module**: Always go through the target module's `mod.ts`
  - ✅ `import { Kline } from "../kucoin/mod.ts"`
  - ❌ `import { Kline } from "../kucoin/types.ts"`
- **Intra-module**: Direct `./file.ts` paths allowed
  - ✅ `import { RankTrendPortfolio } from "./rank-trend.ts"`
- **Type-only**: Use `import type` for types
- **Only named exports**: No `export default`

## Barrel re-export patterns

```ts
// mod.ts — re-export types first, then classes/functions
export type { TradingStrategy, TradingConfig } from "./types.ts";
export { RsiTimed } from "./rsi-timed.ts";
```

## Naming

- Files: kebab-case (`rsi-timed.ts`, `rank-trend.ts`)
- Names: kebab-case (`rsi-timed`, `macd-timed`)
- Classes/interfaces: PascalCase
## Entry-point scripts

CLI entry points that wrap a module's functionality live inside that module's directory.
Each file describes its action with a `<verb>_<noun>.ts` name:

```
src/market/download_data_cli.ts
src/backtest/backtest_strategy.ts
src/optimize/optimize_parameters.ts
src/trade/trade_account.ts
```

Tasks in `deno.json` reference these scripts by their full path.
No `mod.ts` is needed for script-only directories.

## Script conventions

Scripts are thin wrappers containing only:

- imports of modules and functions
- CLI argument parsing (via imported functions)
- data / config loading
- constant definitions
- sequential calls to imported functions
- console output

Scripts must NOT contain:

- function definitions (`function` keyword or arrow assignments)
- loops (`for`, `while`, `do...while`)
- branching (`if`/`else`/`switch`/ternary)

All logic lives in imported modules. Callbacks are defined in their own module files, not inline.
