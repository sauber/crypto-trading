export function ema(values: number[], period: number): number[] {
  const result: number[] = [];
  const multiplier = 2 / (period + 1);
  const sma = values.slice(0, period).reduce((a, b) => a + b, 0) / period;
  result.push(sma);
  for (let i = period; i < values.length; i++) {
    result.push((values[i] - result[result.length - 1]) * multiplier + result[result.length - 1]);
  }
  return result;
}

export function macd(
  closes: number[], fastPeriod = 12, slowPeriod = 26, signalPeriod = 9,
): { macdLine: number[]; signalLine: number[]; histogram: number[] } {
  const fastEMA = ema(closes, fastPeriod);
  const slowEMA = ema(closes, slowPeriod);
  const offset = slowPeriod - fastPeriod;
  const macdLine: number[] = [];
  for (let i = 0; i < fastEMA.length - offset; i++) {
    macdLine.push(fastEMA[i + offset] - slowEMA[i]);
  }
  const signalLine = ema(macdLine, signalPeriod);
  const sigOffset = signalPeriod - 1;
  const histogram: number[] = [];
  for (let i = 0; i < macdLine.length - sigOffset; i++) {
    histogram.push(macdLine[i + sigOffset] - signalLine[i]);
  }
  return { macdLine, signalLine, histogram };
}

export function rsi(closes: number[], period = 14): number[] {
  const result: number[] = [];
  const gains: number[] = [];
  const losses: number[] = [];
  for (let i = 1; i < closes.length; i++) {
    const diff = closes[i] - closes[i - 1];
    gains.push(diff > 0 ? diff : 0);
    losses.push(diff < 0 ? -diff : 0);
  }
  let avgGain = gains.slice(0, period).reduce((a, b) => a + b, 0) / period;
  let avgLoss = losses.slice(0, period).reduce((a, b) => a + b, 0) / period;
  for (let i = period - 1; i < gains.length; i++) {
    if (i > period - 1) {
      avgGain = (avgGain * (period - 1) + gains[i]) / period;
      avgLoss = (avgLoss * (period - 1) + losses[i]) / period;
    }
    const rs = avgLoss > 0 ? avgGain / avgLoss : 100;
    result.push(100 - 100 / (1 + rs));
  }
  return result;
}

export function bollingerBands(closes: number[], period = 20, stdDev = 2) {
  const middle: number[] = [];
  const upper: number[] = [];
  const lower: number[] = [];
  for (let i = period - 1; i < closes.length; i++) {
    const slice = closes.slice(i - period + 1, i + 1);
    const mean = slice.reduce((a, b) => a + b, 0) / period;
    const variance = slice.reduce((a, b) => a + (b - mean) ** 2, 0) / period;
    const std = Math.sqrt(variance);
    middle.push(mean);
    upper.push(mean + stdDev * std);
    lower.push(mean - stdDev * std);
  }
  return { middle, upper, lower, offset: period - 1 };
}

export function avgVolume(volumes: number[], period = 26): number {
  if (volumes.length < period) return volumes.reduce((a, b) => a + b, 0) / volumes.length;
  return volumes.slice(-period).reduce((a, b) => a + b, 0) / period;
}

export function adx(highs: number[], lows: number[], closes: number[], period = 14): number[] {
  const n = highs.length;
  const tr: number[] = [];
  const plusDM: number[] = [];
  const minusDM: number[] = [];

  for (let i = 1; i < n; i++) {
    const hl = highs[i] - lows[i];
    const hc = Math.abs(highs[i] - closes[i - 1]);
    const lc = Math.abs(lows[i] - closes[i - 1]);
    tr.push(Math.max(hl, hc, lc));

    const upMove = highs[i] - highs[i - 1];
    const downMove = lows[i - 1] - lows[i];
    if (upMove > downMove && upMove > 0) plusDM.push(upMove); else plusDM.push(0);
    if (downMove > upMove && downMove > 0) minusDM.push(downMove); else minusDM.push(0);
  }

  const smooth = (values: number[]): number[] => {
    const result: number[] = [values.slice(0, period).reduce((a, b) => a + b, 0)];
    for (let i = period; i < values.length; i++) {
      result.push(result[result.length - 1] - result[result.length - 1] / period + values[i]);
    }
    return result;
  };

  const trSmooth = smooth(tr);
  const pdmSmooth = smooth(plusDM);
  const mdmSmooth = smooth(minusDM);

  const plusDI = pdmSmooth.map((v, i) => trSmooth[i] > 0 ? (v / trSmooth[i]) * 100 : 0);
  const minusDI = mdmSmooth.map((v, i) => trSmooth[i] > 0 ? (v / trSmooth[i]) * 100 : 0);

  const dx: number[] = [];
  for (let i = 0; i < plusDI.length; i++) {
    const sum = plusDI[i] + minusDI[i];
    dx.push(sum > 0 ? Math.abs(plusDI[i] - minusDI[i]) / sum * 100 : 0);
  }

  const adxVals: number[] = [dx.slice(0, period).reduce((a, b) => a + b, 0) / period];
  for (let i = period; i < dx.length; i++) {
    adxVals.push((adxVals[adxVals.length - 1] * (period - 1) + dx[i]) / period);
  }

  return adxVals;
}
