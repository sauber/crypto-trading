# Portfolio

Assess which coins are wanted/unwanted and determine position sizing.

## Interface

```ts
interface PortfolioStrategy {
  (activePositions: PositionState[], candidates: CoinCandidate[]): PortfolioDecision;
  readonly name: string;
}
```

## Strategies

| Name | File | Description |
|------|------|-------------|
| `rank-trend` | `rank-trend.ts` | Buy improving-rank coins, sell declining-rank held coins |

## Output

```ts
interface PortfolioDecision {
  wantToBuy: Array<{ symbol; confidence; reason }>;
  wantToSell: Array<{ symbol; reason }>;
}
```
