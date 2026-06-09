# Trading

Timing of swaps via technical indicators.

## Interface

```ts
interface TradingStrategy {
  readonly name: string;
  readonly config: TradingConfig;
  plan(params: {
    wantToBuy: Array<{ symbol; confidence; reason }>;
    wantToSell: Array<{ symbol; reason }>;
    activePositions: PositionState[];
    prices: Map<string, number>;
    klines: Map<string, Kline[]>;
    maxPositions: number;
  }): Promise<SwapPlan>;
}
```

## Strategies

| Name | File | Indicators | Description |
|------|------|------------|-------------|
| `rsi-timed` | `rsi-timed.ts` | RSI(14) | Buy when RSI oversold, sell when overbought |
| `macd-timed` | `macd-timed.ts` | MACD(12,26,9) | Buy on MACD cross above signal, sell on cross below |
| `bb-timed` | `bb-timed.ts` | Bollinger Bands(20,2) | Buy near lower band, sell near upper band |
| `ema-adx-timed` | `ema-adx-timed.ts` | EMA(9,21) + ADX(14) | Buy when EMA9>EMA21 + ADX>25, sell when EMA9<EMA21 |

## Config

Each strategy has its own config interface in `<name>.config.ts`.
