export interface LogEntry {
  timestamp?: string;
  cycle?: number;
  role?: string;
  action: string;
  symbol?: string;
  side?: "buy" | "sell";
  reason?: string;
  message: string;
}

export interface Logger {
  (entry: LogEntry): void;
  readonly name: string;
}
