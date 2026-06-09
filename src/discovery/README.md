# Discovery Role

## Description

The Discovery role is responsible for identifying the most interesting coins to trade, based on liquidity. For each cycle (or bar in backtest), coins are ranked by liquidity, and the **top N** most liquid ones are returned to the rest of the pipeline.

## Definition

```typescript
interface DiscoveryStrategy {
  readonly name: string;
  readonly config: DiscoveryConfig;
  discover(params?: DiscoveryParams): Promise<CoinCandidate[]>;
}

interface DiscoveryConfig {
  topN: number;
}

interface DiscoveryParams {
  klines?: Map<string, Kline[]>;
  barIndex?: number;
}
```

## Output: `CoinCandidate[]`

```typescript
interface CoinCandidate {
  symbol: string;       // "BTC-USDT"
  score: number;        // Likviditets-score (volume * close)
  reason: string;       // Menneskelig forklaring
}
```

## Likviditets-beregning

Likviditet udregnes som:

```
liquidity = volume * closingPrice
```

The higher the value, the more liquid the coin. This is used to rank coins and select the **top N**.

## Strategier

### `testdata` (`FileDiscovery`)

- **Usage**: Backtest and optimization
- **Data source**: Pre-loaded `Kline[]` via `DiscoveryParams.klines`
- **Parameters**: `{ topN: 20 }`
- **Behavior**: At each bar of the simulation, liquidity is calculated for all coins in the dataset. The `topN` coins with the highest liquidity are returned.

### `kucoin` (`KucoinDiscovery`)

- **Usage**: Live trading
- **Data source**: KuCoin REST API (via `KucoinClient`)
- **Parameters**: `{ topN: 20 }`
- **Behavior**: Fetches the 50 most traded USDT pairs from KuCoin via ticker data, fetches candles for each, calculates liquidity from the latest candle, and returns the `topN` coins.

## Architecture

```
src/discovery/
├── README.md              # This file
├── types.ts               # DiscoveryStrategy interface + DiscoveryConfig + DiscoveryParams
├── testdata.ts            # FileDiscovery (testdata strategy)
├── testdata.config.ts     # Default configuration for testdata
├── kucoin.ts              # KucoinDiscovery (live strategy)
├── kucoin.config.ts       # Default configuration for live
├── testdata.test.ts       # Unit tests for FileDiscovery
└── kucoin.test.ts         # Unit tests for KucoinDiscovery
```

## Registration

Strategies are registered in `src/roles/registration.ts` via `discoveryRegistry`:

```typescript
discoveryRegistry.register("testdata", (config) => new FileDiscovery(config));
discoveryRegistry.register("kucoin", (config, client) => new KucoinDiscovery(config, client));
```

## Configuration

In `ROLE_CONFIG` in `src/roles/config.ts`:

```typescript
discovery: { strategy: "kucoin", params: { topN: 20 } },
```

Switch to `"testdata"` to use testdata (relevant in test).
