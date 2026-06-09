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
├── <file>.config.ts     # Config constant
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
// mod.ts — re-export types first, then classes/configs
export type { TradingStrategy, TradingConfig } from "./types.ts";
export { RsiTimedTrading } from "./rsi-timed.ts";
export { config as rsiTimedCfg } from "./rsi-timed.config.ts";
```

## Naming

- Files: `PascalCase.ts` (e.g., `rank-trend.ts` → file is `PascalCase.ts`? No, camelCase for files actually)
- Actually: files are camelCase (`rsi-timed.ts`, `rank-trend.ts`)
- Strategy names: kebab-case (`rsi-timed`, `macd-timed`)
- Classes/interfaces: PascalCase
- Config constants: `config` (renamed on import)
