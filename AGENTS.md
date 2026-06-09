# KuCoin Crypto Trading Agent

## Arkitektur

Systemet består af 6 roller, der hver især har en strategi. Rollerne eksekveres i en pipeline hver gang trading-cyklussen kører (hver 1. time).

```
  Discovery (fast: top-20 volume)
       │
       ▼ coins[]
  Portfolio (vurder ønsket/uønsket baseret på rank-ændring)
       │
       ▼ PortfolioDecision { wantToBuy, wantToSell }
  Trading (timing via tekniske indikatorer: RSI, MACD, BB, etc.)
       │
       ▼ SwapPlan { swaps: [{ buy, sell }] }
  Execution (simuleret eller live: kapital × (1-fee) eller KuCoin ordre)
       │
       ▼ positions opdateret
  Reflection (kun live: samler beslutninger + outcomes, rapporterer)
  Communication (silent i backtest, verbose i live)
```

## Roller

| Rolle | Ansvarsområde | Interface | Første strategi |
|-------|---------------|-----------|-----------------|
| **Discovery** | Find top 20 USDT-pairs efter 24h volume | `DiscoveryStrategy` | `top-volume` |
| **Portfolio** | Vurder hvilke coins der er ønsket/uønsket + positionsstørrelse | `PortfolioStrategy` | `rank-trend` |
| **Trading** | Timing af swaps via tekniske indikatorer | `TradingStrategy` | `rsi-timed` |
| **Execution** | Udfør swaps (simuleret eller live) | `ExecutionStrategy` | `simulate` / `kucoin` |
| **Reflection** | Saml beslutninger, reflektér over success/failure | `ReflectionStrategy` | `noop` / `analyst` |
| **Communication** | Rapporter status | `CommunicationStrategy` | `silent` / `verbose` |

## Interfaces

### PortfolioStrategy

```ts
interface PortfolioStrategy {
  readonly name: string;
  readonly config: PortfolioConfig;
  analyze(params: {
    candidates: CoinCandidate[];       // Fra Discovery
    activePositions: PositionState[];  // Nuværende portfolio
    prices: Map<string, number>;       // Nuværende priser
    client: KucoinClient;
    interval: string;                  // "1hour"
    candleRangeMs: number;
  }): Promise<PortfolioDecision>;
}

interface PortfolioDecision {
  wantToBuy: Array<{ symbol: string; confidence: number; reason: string }>;
  wantToSell: Array<{ symbol: string; reason: string }>;
}
```

### TradingStrategy

```ts
interface TradingStrategy {
  readonly name: string;
  readonly config: TradingConfig;
  plan(params: {
    wantToBuy: Array<{ symbol: string; confidence: number; reason: string }>;
    wantToSell: Array<{ symbol: string; reason: string }>;
    activePositions: PositionState[];
    prices: Map<string, number>;
    klines: Map<string, Kline[]>;      // Alle coins' historik til indicator-beregning
    maxPositions: number;
  }): Promise<SwapPlan>;
}

interface SwapPlan {
  swaps: Swap[];
}

interface Swap {
  sellSymbol: string;
  buySymbol: string;
  reason: string;
}
```

### ExecutionStrategy

```ts
interface ExecutionStrategy {
  readonly name: string;
  readonly config: ExecutionConfig;
  executeSwaps(swaps: Swap[], positions: Map<string, PositionState>, capital: number): Promise<ExecutionResult>;
}

interface ExecutionResult {
  positions: Map<string, PositionState>;
  capital: number;
  trades: TradeRecord[];
}
```

### ReflectionStrategy

```ts
interface ReflectionStrategy {
  readonly name: string;
  readonly config: ReflectionConfig;
  recordPrecondition(data: PreconditionRecord): void;
  recordOutcome(data: OutcomeRecord): void;
  reflect(): ReflectionInsight[];
}
```

### CommunicationStrategy

```ts
interface CommunicationStrategy {
  readonly name: string;
  readonly config: CommunicationConfig;
  report(result: PipelineResult | LiveCycleResult): void;
  insight(insight: ReflectionInsight): void;
  error(err: Error): void;
}
```

## Pipeline Simulate (backtest/optimize)

`src/engine/simulate.ts` — `pipelineSimulate()`:

```
Input:  portfolio Strategy, trading Strategy, data (klines, coins), config (maxPositions, capital, fee)
Output: PipelineResult { equityCurve, trades, totalReturn, sharpe, maxDD, ... }

For hver bar i tidslinjen:
  1. Portfolio.analyze() → PortfolioDecision
  2. Trading.plan() → SwapPlan
  3. Execution.executeSwaps() → opdater positions + capital
  4. Gentag
  
Bemærk: Discovery køres IKKE under simulate — coins er en fast pulje.
Bemærk: Reflection og Communication er IKKE aktive i simulate.
```

## Data

- Backtest og optimizer bruger `data/klines.json` (genereret af `deno task testdata`)
- Ingen API-kald under backtest/optimize
- Format:
  ```json
  {
    "interval": "1hour",
    "coins": ["BTC-USDT", "ETH-USDT", ...],
    "klines": { "BTC-USDT": [{ "timestamp": ..., "open": ..., "high": ..., "low": ..., "close": ..., "volume": ... }, ...] }
  }
  ```

## Optimering

```
Søgerum: (portfolio_strat × portfolio_params) × (trading_strat × trading_params)
Første kørsel: (rank-trend: 2 params) × (rsi-timed, macd-timed, bb-timed: 4 params hver) = 24 kombinationer

Metode: BOHB (Bayesian Optimization + HyperBand)
Antal evaluationer: ~140 (ca. 20-40 min)
```

## Coding Standards

### SOLID

| Princip | Hvordan |
|---------|---------|
| **S**ingle Responsibility | Hver rolle har én opgave. Hver strategi har én analyse-metode. |
| **O**pen/Closed | Nye strategier tilføjes via `register()` i RoleRegistry — ingen eksisterende kode ændres. |
| **L**iskov Substitution | Alle strategier implementerer samme interface; simulation og live kan byttes frit. |
| **I**nterface Segregation | Hver rolle har sit eget interface — ingen rolle afhænger af en andens interface. |
| **D**ependency Inversion | Engine afhænger af abstrakte interfaces (PortfolioStrategy, TradingStrategy), ikke konkrete strategier. |

### TDD

- Skriv test FØR implementering
- Test filer: `src/**/*.test.ts`
- Kør tests: `deno test --allow-read --allow-net`
- Mock strategier: opret `AlwaysBuyTrading` / `AlwaysSellPortfolio` til pipeline test

### Deno

- TypeScript, strict mode (tsconfig)
- `import type` for type-only imports
- `export interface` for alle kontrakter
- Hver strategi har sin egen mappe med `strategy.ts` + `config.ts`
- Konvention: strategi-navne i `kebab-case`

### Projektstruktur

```
src/
├── trade.ts                        Entry point (live)
├── backtest.ts                     Entry point (backtest)
├── optimize.ts                     Entry point (optimize)
├── indicators.ts                   Fælles indikatorer (EMA, MACD, RSI, BB, ADX)
├── engine/
│   ├── types.ts                    PipelineResult, PositionState, Swap, SwapPlan, PortfolioDecision
│   └── simulate.ts                 pipelineSimulate()
├── kucoin/
│   ├── client.ts                   KuCoin REST API wrapper
│   └── types.ts                    Balance, Ticker, Kline, OrderRequest
├── roles/
│   ├── config.ts                   ROLE_CONFIG — aktiv strategi per rolle
│   ├── registry.ts                 RoleRegistry<T>
│   ├── discovery/strategy.ts       TopVolume
│   ├── portfolio/
│   │   ├── types.ts                PortfolioStrategy interface
│   │   └── strategies/rank-trend/  strategy.ts + config.ts
│   ├── trading/
│   │   ├── types.ts                TradingStrategy interface
│   │   └── strategies/             rsi-timed/, macd-timed/, bb-timed/, ema-adx-timed/
│   ├── execution/
│   │   └── strategies/             simulate.ts, kucoin.ts
│   ├── communication/
│   │   └── strategies/             silent.ts, verbose.ts
│   └── reflection/
│       └── strategies/             noop.ts, analyst.ts
scripts/
└── download-data.ts                Hent klines → data/klines.json
data/
└── klines.json                     Cachede kline-data (ignoreret af git)
```
## Kommandoer

```sh
deno task testdata              # Download kline data (første gang)
deno task backtest              # Kør pipeline backtest
deno task optimize              # BOHB parameter-optimering
deno task trade                 # Live trading (dry-run med DRY_RUN=true)
deno check src/                 # Type-check hele projektet
deno test --allow-read          # Kør tests
```

## Environment

| Variabel | Beskrivelse |
|----------|-------------|
| `KUCOIN_API_KEY` | API key fra KuCoin sub-account |
| `KUCOIN_API_SECRET` | API secret |
| `KUCOIN_API_PASSPHRASE` | API passphrase |
| `DRY_RUN` | `"true"` = ingen rigtige ordrer |
