export interface KucoinConfig {
  apiKey?: string;
  apiSecret?: string;
  apiPassphrase?: string;
  apiUrl?: string;
}

export interface Balance {
  currency: string;
  available: string;
  frozen: string;
  total: string;
  accountType: string;
}

export interface Ticker {
  symbol: string;
  last: number;
  changeRate: number;
  changePrice: number;
  high: number;
  low: number;
  vol: number;
  volValue: number;
}

export interface Kline {
  timestamp: number;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
}

export type OrderSide = "buy" | "sell";
export type OrderType = "limit" | "market";

export interface OrderRequest {
  symbol: string;
  side: OrderSide;
  type: OrderType;
  price?: string;
  size: string;
}

export interface OrderResult {
  orderId: string;
  clientOid: string;
}

export interface LiquidityRanking {
  symbol: string;
  volume24h: number;
  lastPrice: number;
  changeRate: number;
}

export interface Position {
  symbol: string;
  entryPrice: number;
  currentPrice: number;
  size: string;
  pnl: number;
  pnlPercent: number;
}
