import type { Backtest, Strategy } from "@sauber/backtest";
import type { TickConverter } from "./tick-converter.ts";

export interface TradeRecord {
  entryTime: string;
  exitTime: string;
  entryPrice: number;
  exitPrice: number;
  pnlPct: number;
  bars: number;
  reason: string;
  buyReason: string;
  symbol: string;
  analystComment: string;
}

export interface BacktestResults {
  equityCurve: number[];
  trades: TradeRecord[];
  totalReturn: number;
  maxDrawdown: number;
  sharpeRatio: number;
  winRate: number;
  profitFactor: number;
  totalTrades: number;
}

export interface ReasonLogEntry {
  tick: number;
  symbol: string;
  reason: string;
  type: "buy" | "sell";
}

function getReasonLog(strategy: Strategy): ReasonLogEntry[] {
  return ((strategy as unknown as Record<string, unknown>).reasonLog ??
    []) as ReasonLogEntry[];
}

function generateAnalystComment(
  pnlPct: number,
  bars: number,
  buyReason: string,
  sellReason: string,
): string {
  if (pnlPct > 10) {
    return `Strong win — signal captured major move in ${bars} bars.`;
  }
  if (pnlPct > 2) {
    return `Solid gain — rank trend held and RSI target reached over ${bars} bars.`;
  }
  if (pnlPct > 0) {
    return `Modest profit — exit signal triggered before full move exhausted (${bars} bars).`;
  }
  if (pnlPct > -3) {
    return `Slight loss — rank momentum faded shortly after entry (${bars} bars).`;
  }
  if (pnlPct > -8) {
    return `Moderate loss — rank reversal exceeded tolerance before exit signal (${bars} bars).`;
  }
  return `Significant loss — rank trend strongly opposed entry direction over ${bars} bars; consider tighter rank-change filter.`;
}

export function collectResults(
  backtest: Backtest,
  strategy: Strategy,
  converter: TickConverter,
  initialCapital: number,
): BacktestResults {
  const reasonLog = getReasonLog(strategy);
  const equityCurve = Array.from(backtest.value);

  const trades = backtest.transactions.map((tx) => {
    const sellLog = reasonLog.find(
      (r) =>
        r.tick === tx.end &&
        r.symbol === tx.instrument.symbol &&
        r.type === "sell",
    );
    const buyLog = reasonLog.find(
      (r) =>
        r.tick === tx.start &&
        r.symbol === tx.instrument.symbol &&
        r.type === "buy",
    );
    const sellReason = sellLog?.reason ?? tx.reason;
    const buyReason = buyLog?.reason ?? "unknown";
    const pnlPct = (tx.profit / tx.invested) * 100;
    const bars = tx.end - tx.start;

    const analystComment = generateAnalystComment(
      pnlPct,
      bars,
      buyReason,
      sellReason,
    );

    return {
      entryTime: converter.tickToISO(tx.start),
      exitTime: converter.tickToISO(tx.end),
      entryPrice: tx.invested / tx.quantity,
      exitPrice: (tx.invested + tx.profit) / tx.quantity,
      pnlPct,
      bars,
      reason: sellReason,
      buyReason,
      symbol: tx.instrument.symbol,
      analystComment,
    } satisfies TradeRecord;
  });

  const wins = trades.filter((t) => t.pnlPct > 0);
  const losses = trades.filter((t) => t.pnlPct <= 0);
  const finalValue = equityCurve[equityCurve.length - 1];
  const totalReturn =
    ((finalValue - initialCapital) / initialCapital) * 100;
  const totalProfits = wins.reduce((s, t) => s + t.pnlPct, 0);
  const totalLosses = Math.abs(losses.reduce((s, t) => s + t.pnlPct, 0));
  const profitFactor = totalLosses > 0
    ? totalProfits / totalLosses
    : totalProfits > 0
    ? Infinity
    : 0;
  const winRate = trades.length > 0 ? (wins.length / trades.length) * 100 : 0;

  let peak = initialCapital;
  let maxDD = 0;
  for (const v of equityCurve) {
    if (v > peak) peak = v;
    const dd = (peak - v) / peak;
    if (dd > maxDD) maxDD = dd;
  }

  const returns = equityCurve.slice(1).map((e, i) =>
    (e - equityCurve[i]) / equityCurve[i]
  );
  const avgReturn = returns.length > 0
    ? returns.reduce((a, b) => a + b, 0) / returns.length
    : 0;
  const variance = returns.reduce((s, r) => s + (r - avgReturn) ** 2, 0) /
    returns.length;
  const stdDev = Math.sqrt(variance);
  const sharpeRatio = stdDev > 0
    ? (avgReturn / stdDev) * Math.sqrt(365 * 24)
    : 0;

  return {
    equityCurve,
    trades,
    totalReturn,
    maxDrawdown: maxDD * 100,
    sharpeRatio,
    winRate,
    profitFactor,
    totalTrades: trades.length,
  };
}

export function evaluate(results: BacktestResults): number {
  const r = results.totalReturn;
  const pf = results.profitFactor === Infinity ? 10 : results.profitFactor;
  const dd = results.maxDrawdown;
  const ddPenalty = dd > 0 ? 1 / (1 + dd / 100) : 1;
  return r * pf * ddPenalty;
}

function strategyAnalystComment(results: BacktestResults): string {
  const { trades, totalReturn, maxDrawdown, winRate, profitFactor, totalTrades } = results;
  const wins = trades.filter((t) => t.pnlPct > 0);
  const losses = trades.filter((t) => t.pnlPct <= 0);
  const avgWin = wins.length > 0 ? wins.reduce((s, t) => s + t.pnlPct, 0) / wins.length : 0;
  const avgLoss = losses.length > 0 ? losses.reduce((s, t) => s + t.pnlPct, 0) / losses.length : 0;

  const fastTrades = trades.filter((t) => t.bars <= 5);
  const slowTrades = trades.filter((t) => t.bars > 20);
  const fastWinRate = fastTrades.length > 0
    ? (fastTrades.filter((t) => t.pnlPct > 0).length / fastTrades.length) * 100
    : 0;
  const slowWinRate = slowTrades.length > 0
    ? (slowTrades.filter((t) => t.pnlPct > 0).length / slowTrades.length) * 100
    : 0;

  const lines: string[] = [];

  lines.push(
    `Strategy achieved +${totalReturn.toFixed(2)}% total return with ${winRate.toFixed(1)}% win rate over ${totalTrades} trades.`,
  );
  lines.push(
    `Average winner: +${avgWin.toFixed(2)}%, average loser: ${avgLoss.toFixed(2)}%. PF: ${profitFactor === Infinity ? "∞" : profitFactor.toFixed(2)}.`,
  );

  if (fastTrades.length > 0) {
    lines.push(
      `Short holds (≤5 bars, ${fastTrades.length} trades): ${fastWinRate.toFixed(0)}% win rate. ` +
      (fastWinRate < winRate
        ? "Quick flips underperform — rank signals need more time to develop."
        : "Quick flips outperform — rank momentum is strongest immediately after entry."),
    );
  }
  if (slowTrades.length > 0) {
    lines.push(
      `Long holds (>20 bars, ${slowTrades.length} trades): ${slowWinRate.toFixed(0)}% win rate. ` +
      (slowWinRate < winRate
        ? "Extended holds degrade returns — rank trends reverse over longer windows."
        : "Extended holds build gains — rank trends persist over time."),
    );
  }

  const avgWinBars = wins.length > 0 ? wins.reduce((s, t) => s + t.bars, 0) / wins.length : 0;
  const avgLossBars = losses.length > 0 ? losses.reduce((s, t) => s + t.bars, 0) / losses.length : 0;
  lines.push(
    `Ideal hold duration: winners average ${avgWinBars.toFixed(0)} bars, losers average ${avgLossBars.toFixed(0)} bars. ` +
    (avgWinBars > avgLossBars
      ? "Patience rewards — cutting losers early and letting winners run."
      : "Trend fades quickly — consider tighter stop-loss or shorter RSI period."),
  );

  if (profitFactor < 1.5) {
    lines.push(
      `Risk/reward is marginal (PF ${profitFactor.toFixed(2)}). Consider tightening rank-change entry filter or increasing overbought threshold to reduce noise.`,
    );
  }

  if (maxDrawdown > 15) {
    lines.push(
      `Max drawdown of ${maxDrawdown.toFixed(1)}% is high. Adding a minimum holding period or market-wide stop could reduce tail risk.`,
    );
  }

  return lines.join("\n");
}

export function display(
  strategy: Strategy,
  results: BacktestResults,
): string {
  const lines: string[] = [];

  lines.push(`=== Backtest: ${strategy.name ?? "unknown"} ===`);
  lines.push(
    `Return:  ${results.totalReturn > 0 ? "+" : ""}${results.totalReturn.toFixed(2)}%`,
  );
  lines.push(`Sharpe:  ${results.sharpeRatio.toFixed(2)}`);
  lines.push(`Max DD:  ${results.maxDrawdown.toFixed(2)}%`);
  lines.push(
    `Win Rate: ${results.winRate.toFixed(1)}%  (${results.totalTrades} trades)`,
  );
  lines.push(
    `PF:      ${results.profitFactor === Infinity ? "∞" : results.profitFactor.toFixed(2)}`,
  );

  if (results.trades.length > 0) {
    lines.push("");
    lines.push(`=== Transactions (${results.trades.length}) ===`);
    const wins = results.trades.filter((t) => t.pnlPct > 0).length;
    lines.push(`W/L: ${wins}/${results.trades.length - wins}`);
    lines.push("");

    for (let i = 0; i < results.trades.length; i++) {
      const t = results.trades[i];
      const pnl = t.pnlPct > 0 ? `+${t.pnlPct.toFixed(2)}` : t.pnlPct.toFixed(2);
      lines.push(
        `#${i + 1} ${t.symbol}: ${pnl}% (${t.bars} bars)`,
      );
      lines.push(`  Buy:  ${t.buyReason}`);
      lines.push(`  Sell: ${t.reason}`);
      lines.push(`  Analyst: ${t.analystComment}`);
    }

    const sorted = [...results.trades].sort((a, b) => b.pnlPct - a.pnlPct);
    lines.push("");
    lines.push("Top 5 winners:");
    for (const t of sorted.slice(0, 5)) {
      lines.push(`  +${t.pnlPct.toFixed(2)}% ${t.symbol} (${t.reason})`);
    }
    lines.push("");
    lines.push("Top 5 losers:");
    for (const t of sorted.slice(-5).reverse()) {
      lines.push(`  ${t.pnlPct.toFixed(2)}% ${t.symbol} (${t.reason})`);
    }

    lines.push("");
    lines.push("=== Analyst Summary ===");
    lines.push(strategyAnalystComment(results));
  }

  return lines.join("\n");
}
