import { Instrument, type Series } from "@sauber/backtest";
import type { Kline } from "../kucoin/mod.ts";

/** An Instrument extended with per-tick rank, rank-change, klines, and volume series for portfolio analysis. */
export class RankedInstrument extends Instrument {
  readonly rankSeries: Series;
  readonly rankChangeSeries: Series;
  readonly klines: Kline[];
  readonly volumes: Series;

  constructor(
    series: Series,
    start: number,
    symbol: string,
    rankSeries: Series,
    rankChangeSeries: Series,
    klines: Kline[],
    volumes: Series,
    name?: string,
  ) {
    super(series, start, symbol, name);
    this.rankSeries = rankSeries;
    this.rankChangeSeries = rankChangeSeries;
    this.klines = klines;
    this.volumes = volumes;
  }

  /** Rank at tick (1 = highest volume×close). Returns NaN if tick is out of range. */
  rank(tick: number): number {
    if (tick < 0 || tick >= this.length) return NaN;
    return this.rankSeries[tick];
  }

  /** Change in rank from previous tick (positive = gaining rank). Returns 0 at tick 0 or if out of range. */
  rankChange(tick: number): number {
    if (tick < 1 || tick >= this.length) return 0;
    return this.rankChangeSeries[tick];
  }
}
