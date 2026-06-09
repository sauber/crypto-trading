import type { StrategyResult } from "../strategies/types.ts";
import type { KucoinClient } from "../kucoin/client.ts";
import type { PositionState } from "../risk/types.ts";

export interface DiscoveryStrategy {
  readonly name: string;
  discover(client: KucoinClient): Promise<CoinCandidate[]>;
}

export interface CoinCandidate {
  symbol: string;
  score: number;
  reason: string;
}

export interface PortfolioStrategy {
  readonly name: string;
  analyze(
    symbol: string,
    closes: number[],
    highs: number[],
    lows: number[],
    volumes: number[],
  ): StrategyResult;
}

export interface PortfolioConfig {
  maxPositions: number;
  reserveSymbol: string;
  stopLossPct: number;
  takeProfitPct: number;
}

export interface PortfolioDecision {
  wantToBuy: Array<{ symbol: string; confidence: number; reason: string; price: number }>;
  wantToSell: Array<{ symbol: string; size: string; reason: string }>;
  activePositions: PositionState[];
  slotsAvailable: number;
}

export interface TradingStrategy {
  readonly name: string;
  plan(params: {
    wantToBuy: Array<{ symbol: string; confidence: number; reason: string; price: number }>;
    wantToSell: Array<{ symbol: string; size: string; reason: string }>;
    activePositions: PositionState[];
    prices: Map<string, number>;
    availableCapital: number;
    maxPositions: number;
  }): Promise<SwapPlan>;
}

export interface SwapPlan {
  swaps: Swap[];
}

export interface Swap {
  sellSymbol: string;
  sellSize: string;
  buySymbol: string;
  buyAmount: number;
  reason: string;
}

export interface ExecutionStrategy {
  readonly name: string;
  executeBuy(symbol: string, size: string, reason: string): Promise<string>;
  executeSell(symbol: string, size: string, reason: string): Promise<string>;
}

export interface CommunicationStrategy {
  readonly name: string;
  info(role: string, message: string): void;
  warn(role: string, message: string): void;
  error(role: string, message: string): void;
}
