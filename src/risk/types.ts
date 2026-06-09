export interface PositionState {
  symbol: string;
  entryPrice: number;
  size: string;
  enteredAt: number;
  entryValue: number;
}

export interface RiskConfig {
  maxPositions: number;
  reserveSymbol: string;
  stopLossPct: number;
  takeProfitPct: number;
}

export interface RiskDecision {
  toClose: CloseAction[];
  slotsAvailable: number;
  reason: string;
}

export interface CloseAction {
  symbol: string;
  reason: "stop_loss" | "take_profit" | "strategy_sell";
  strategyReason?: string;
}
