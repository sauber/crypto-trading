const INTERVAL_MS: Record<string, number> = {
  "1min": 60000,
  "3min": 180000,
  "5min": 300000,
  "15min": 900000,
  "30min": 1800000,
  "1hour": 3600000,
  "2hour": 7200000,
  "4hour": 14400000,
  "6hour": 21600000,
  "8hour": 28800000,
  "12hour": 43200000,
  "1day": 86400000,
  "1week": 604800000,
};

export function intervalToMs(interval: string): number {
  const ms = INTERVAL_MS[interval];
  if (ms === undefined) throw new Error(`Unknown interval: ${interval}`);
  return ms;
}
