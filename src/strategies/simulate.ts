import type { Kline } from "../kucoin/types.ts";
import type { Strategy } from "./types.ts";

export interface SimConfig {
  stopLossPct: number;
  takeProfitPct: number;
  minCandles: number;
  initialCapital: number;
}

export interface Trade {
  entryTime: string;
  exitTime: string;
  entryPrice: number;
  exitPrice: number;
  pnlPct: number;
  bars: number;
  reason: string;
}

export interface SimResult {
  symbol: string;
  strategyName: string;
  config: SimConfig;
  trades: Trade[];
  totalReturn: number;
  winRate: number;
  avgWin: number;
  avgLoss: number;
  profitFactor: number;
  maxDrawdown: number;
  totalTrades: number;
  score: number;
}

export function simulate(
  symbol: string,
  klines: Kline[],
  strategy: Strategy,
  simConfig: SimConfig,
): SimResult {
  const n = klines.length;
  const closes = new Array<number>(n);
  const highs = new Array<number>(n);
  const lows = new Array<number>(n);
  const volumes = new Array<number>(n);
  for (let i = 0; i < n; i++) {
    closes[i] = klines[i].close;
    highs[i] = klines[i].high;
    lows[i] = klines[i].low;
    volumes[i] = klines[i].volume;
  }

  const trades: Trade[] = [];
  let capital = simConfig.initialCapital;
  let peak = simConfig.initialCapital;
  let maxDrawdown = 0;
  let inPosition = false;
  let entryPrice = 0;
  let entryBar = 0;
  let coins = 0;

  for (let i = simConfig.minCandles; i < n; i++) {
    const result = strategy.analyze(
      symbol,
      closes.slice(0, i + 1),
      highs.slice(0, i + 1),
      lows.slice(0, i + 1),
      volumes.slice(0, i + 1),
    );

    if (!inPosition && result.signal === "buy") {
      entryPrice = closes[i];
      coins = capital / entryPrice;
      entryBar = i;
      inPosition = true;
      continue;
    }

    if (inPosition) {
      const stopPrice = entryPrice * (1 - simConfig.stopLossPct);
      const takePrice = entryPrice * (1 + simConfig.takeProfitPct);
      let exitPrice = 0;
      let reason = "";

      if (lows[i] <= stopPrice) {
        exitPrice = stopPrice;
        reason = "stop_loss";
      } else if (highs[i] >= takePrice) {
        exitPrice = takePrice;
        reason = "take_profit";
      } else if (result.signal === "sell") {
        exitPrice = closes[i];
        reason = result.reason;
      }

      if (exitPrice > 0) {
        const newCapital = coins * exitPrice;
        const pnlPct = (newCapital - capital) / capital * 100;
        trades.push({
          entryTime: new Date(klines[entryBar].timestamp).toISOString(),
          exitTime: new Date(klines[i].timestamp).toISOString(),
          entryPrice: +entryPrice.toFixed(4),
          exitPrice: +exitPrice.toFixed(4),
          pnlPct: +pnlPct.toFixed(2),
          bars: i - entryBar,
          reason,
        });
        capital = newCapital;
        inPosition = false;
        if (capital > peak) peak = capital;
        const dd = (peak - capital) / peak * 100;
        if (dd > maxDrawdown) maxDrawdown = dd;
      }
    }
  }

  if (inPosition) {
    const exitPrice = closes[n - 1];
    const newCapital = coins * exitPrice;
    trades.push({
      entryTime: new Date(klines[entryBar].timestamp).toISOString(),
      exitTime: new Date(klines[n - 1].timestamp).toISOString(),
      entryPrice: +entryPrice.toFixed(4),
      exitPrice: +exitPrice.toFixed(4),
      pnlPct: +((newCapital - capital) / capital * 100).toFixed(2),
      bars: n - 1 - entryBar,
      reason: "end_of_data",
    });
    capital = newCapital;
  }

  const wins = trades.filter((t) => t.pnlPct > 0);
  const losses = trades.filter((t) => t.pnlPct <= 0);
  const totalReturn = ((capital - simConfig.initialCapital) / simConfig.initialCapital * 100);
  const avgWin = wins.length > 0 ? wins.reduce((s, t) => s + t.pnlPct, 0) / wins.length : 0;
  const avgLoss = losses.length > 0 ? losses.reduce((s, t) => s + t.pnlPct, 0) / losses.length : 0;
  const totalProfits = wins.reduce((s, t) => s + t.pnlPct, 0);
  const totalLosses = Math.abs(losses.reduce((s, t) => s + t.pnlPct, 0));
  const profitFactor = totalLosses > 0 ? totalProfits / totalLosses : totalProfits > 0 ? Infinity : 0;
  const ddWeight = maxDrawdown > 0 ? 1 / (1 + maxDrawdown / 100) : 1;
  const score = totalReturn * profitFactor * ddWeight;

  return {
    symbol, strategyName: strategy.name, config: simConfig,
    trades,
    totalReturn: +totalReturn.toFixed(2),
    winRate: trades.length > 0 ? +((wins.length / trades.length) * 100).toFixed(1) : 0,
    avgWin: +avgWin.toFixed(2), avgLoss: +avgLoss.toFixed(2),
    profitFactor: +profitFactor.toFixed(2), maxDrawdown: +maxDrawdown.toFixed(2),
    totalTrades: trades.length, score: +score.toFixed(2),
  };
}
