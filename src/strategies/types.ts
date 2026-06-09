export type Signal = "buy" | "sell" | "hold";

export interface StrategyResult {
  signal: Signal;
  confidence: number;
  reason: string;
}

export interface Strategy {
  readonly name: string;
  analyze(symbol: string, closes: number[], highs: number[], lows: number[], volumes: number[]): StrategyResult;
}
