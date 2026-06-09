# Portfolio

Assess which coins are wanted/unwanted and determine position sizing.

## Interface

```ts
interface PortfolioStrategy {
  readonly name: string;
  readonly config: PortfolioConfig;
  analyze(params: {
    candidates: CoinCandidate[];
    activePositions: PositionState[];
    prices: Map<string, number>;
    client: KucoinClient;
    interval: string;
    candleRangeMs: number;
  }): Promise<PortfolioDecision>;
}
```

## Strategies

| Name | File | Description |
|------|------|-------------|
| `rank-trend` | `rank-trend.ts` | Buy improving-rank coins, sell declining-rank held coins |

## Config

```ts
interface PortfolioConfig {
  targetPositions: number;
  allocationMethod: "equal" | "weighted";
}
```

## Output

```ts
interface PortfolioDecision {
  wantToBuy: Array<{ symbol; confidence; reason }>;
  wantToSell: Array<{ symbol; reason }>;
}
```
