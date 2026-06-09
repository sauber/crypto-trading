import type { Kline } from "../kucoin/types.ts";

export interface PositionState {
  symbol: string;
  entryPrice: number;
  size: number;
  enteredAt: number;
  entryValue: number;
}

export interface PortfolioDecision {
  wantToBuy: Array<{ symbol: string; confidence: number; reason: string }>;
  wantToSell: Array<{ symbol: string; reason: string }>;
}

export interface Swap {
  sellSymbol: string;
  buySymbol: string;
  reason: string;
}

export interface SwapPlan {
  swaps: Swap[];
}

export interface PipelineResult {
  equityCurve: number[];
  trades: TradeRecord[];
  totalReturn: number;
  maxDrawdown: number;
  sharpeRatio: number;
  winRate: number;
  profitFactor: number;
  totalTrades: number;
}

export interface TradeRecord {
  entryTime: string;
  exitTime: string;
  entryPrice: number;
  exitPrice: number;
  pnlPct: number;
  bars: number;
  reason: string;
  buySymbol: string;
  sellSymbol: string;
}

export interface SimData {
  interval: string;
  coins: string[];
  klines: Map<string, Kline[]>;
}
