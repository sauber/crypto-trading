# Trading

Timing of swaps via technical indicators.

## Interface

```ts
interface TradingStrategy {
  (params: {
    wantToBuy: Array<{ symbol: string; confidence: number; reason: string }>;
    wantToSell: Array<{ symbol: string; reason: string }>;
    activePositions: PositionState[];
    prices: Map<string, number>;
    klines: Map<string, Kline[]>;
    targetPositions: number;
  }): SwapPlan;
  readonly name: string;
}
```

## Strategies

| Name | File | Indicators | Description |
|------|------|------------|-------------|
| `rsi-timed` | `rsi-timed.ts` | RSI(14) | Buy when RSI oversold, sell when overbought |
| `macd-timed` | `macd-timed.ts` | MACD(12,26,9) | Buy on MACD cross above signal, sell on cross below |
| `bb-timed` | `bb-timed.ts` | Bollinger Bands(20,2) | Buy near lower band, sell near upper band |
| `ema-adx-timed` | `ema-adx-timed.ts` | EMA(9,21) + ADX(14) | Buy when EMA9>EMA21 + ADX>25, sell when EMA9<EMA21 |

Trading strategies are synchronous — no `async`/`await`.

## Config

Each strategy embeds default parameters in its factory function signature.
