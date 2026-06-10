import { Instrument, type Series } from "@sauber/backtest";
import type { Kline } from "../kucoin/mod.ts";

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

  rank(tick: number): number {
    if (tick < 0 || tick >= this.length) return NaN;
    return this.rankSeries[tick];
  }

  rankChange(tick: number): number {
    if (tick < 1 || tick >= this.length) return 0;
    return this.rankChangeSeries[tick];
  }
}
