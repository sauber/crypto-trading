# Discovery Rollen

## Funktionsbeskrivelse

Discovery-rollen har ansvar for at identificere de mest interessante coins at handle med, baseret på likviditet. For hver cyklus (eller bar i backtest) rangeres coins efter likviditet, og de **top N** mest likide returneres til resten af pipelinen.

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

Jo højere værdi, desto mere likvid er coin'en. Dette bruges til at rangere coins og vælge de **top N**.

## Strategier

### `testdata` (`FileDiscovery`)

- **Anvendelse**: Backtest og optimering
- **Datakilde**: Forud-indlæste `Kline[]` via `DiscoveryParams.klines`
- **Parametre**: `{ topN: 20 }`
- **Opførsel**: Ved hver bar i simulationen beregnes likviditet for alle coins i datasættet. De `topN` coins med højest likviditet returneres.

### `kucoin` (`KucoinDiscovery`)

- **Anvendelse**: Live trading
- **Datakilde**: KuCoin REST API (via `KucoinClient`)
- **Parametre**: `{ topN: 20 }`
- **Opførsel**: Henter de 50 mest handlede USDT-pairs fra KuCoin via ticker-data, henter candles for hver, beregner likviditet fra nyeste candle, og returnerer de `topN` coins.

## Arkitektur

```
src/discovery/
├── README.md              # Denne fil
├── types.ts               # DiscoveryStrategy interface + DiscoveryConfig + DiscoveryParams
├── testdata.ts            # FileDiscovery (testdata-strategi)
├── testdata.config.ts     # Standardkonfiguration for testdata
├── kucoin.ts              # KucoinDiscovery (live-strategi)
├── kucoin.config.ts       # Standardkonfiguration for live
├── testdata.test.ts       # Unit tests for FileDiscovery
└── kucoin.test.ts         # Unit tests for KucoinDiscovery
```

## Registrering

Strategier registreres i `src/roles/registration.ts` via `discoveryRegistry`:

```typescript
discoveryRegistry.register("testdata", (config) => new FileDiscovery(config));
discoveryRegistry.register("kucoin", (config, client) => new KucoinDiscovery(config, client));
```

## Konfiguration

I `ROLE_CONFIG` i `src/roles/config.ts`:

```typescript
discovery: { strategy: "kucoin", params: { topN: 20 } },
```

Skift til `"testdata"` for at bruge testdata (relevant i test).
