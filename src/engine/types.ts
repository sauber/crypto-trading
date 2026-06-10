export interface PositionState {
  symbol: string;
  entryPrice: number;
  size: number;
  enteredAt: number;
  entryValue: number;
}

export interface ExecutionResult {
  positions: Map<string, PositionState>;
  capital: number;
  trades: TradeRecord[];
}

export interface TradeRecord {
  entryTime: string;
  exitTime: string;
  entryPrice: number;
  exitPrice: number;
  pnlPct: number;
  bars: number;
  reason: string;
  symbol: string;
}
