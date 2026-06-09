---
name: kucoin-trading
description: KuCoin crypto trading agent med 6-rolle pipeline arkitektur. TypeScript/Deno projekt. Brug denne skill når du arbejder med trading agentens kode, strategier eller KuCoin API integration.
---

## Arkitektur (see AGENTS.md for detaljer)

Systemet består af 6 roller, der eksekveres i en pipeline hver time:

```
Discovery → Portfolio → Trading → Execution → Reflection → Communication
```

- **Discovery**: Find top 20 USDT-pairs efter 24h volume (fast, ikke optimérbar)
- **Portfolio**: Vurder ønsket/uønsket coins baseret på rank-ændring. Alloker positionsstørrelse.
- **Trading**: Timing af swaps via tekniske indikatorer (RSI, MACD, BB). Signal på BÅDE buy og sell coin.
- **Execution**: Udfør swaps — simuleret (kapital × (1-fee)) eller live (KuCoin market order).
- **Reflection**: Saml beslutninger + outcomes, analyser success/fejl (kun live).
- **Communication**: Rapporter status — silent i backtest, verbose i live.

## Nøglekoncepter

- **Runtime**: Deno 2.7+, TypeScript, strict mode
- **Exchange**: KuCoin via REST API (sub-account)
- **Pipeline backtest**: Hele pipeline køres bar-for-bar (ikke per-strategi isolation)
- **Optimering**: BOHB over (portfolio_strat × portfolio_params) × (trading_strat × trading_params)
- **Data**: `data/klines.json` downloades af `deno task testdata` — ingen API-kald under backtest/optimize
- **SOLID**: Single Responsibility per rolle, Open/Closed via RoleRegistry, Dependency Inversion via interfaces

## Environment variables

| Variabel | Beskrivelse |
|----------|-------------|
| `KUCOIN_API_KEY` | API key fra KuCoin sub-account |
| `KUCOIN_API_SECRET` | API secret |
| `KUCOIN_API_PASSPHRASE` | API passphrase |
| `DRY_RUN` | `"true"` = ingen rigtige ordrer (live) |

## Kommandoer

```sh
deno task testdata              # Download kline data (første gang)
deno task backtest              # Kør pipeline backtest
deno task optimize              # BOHB parameter-optimering
deno task trade                 # Live trading (dry-run med DRY_RUN=true)
deno check src/                 # Type-check hele projektet
deno test --allow-read          # Kør tests
```

## Udviklingsnoter

- Hver strategi har sin egen mappe med `strategy.ts` + `config.ts`
- Strategi-navne i `kebab-case`
- `import type` for type-only imports
- Skriv test FØR implementering (TDD)
- Se AGENTS.md for komplet arkitektur, interfaces, og migrationsplan
