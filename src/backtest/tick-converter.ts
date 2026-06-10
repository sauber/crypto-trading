import type { Kline } from "../kucoin/mod.ts";

export class TickConverter {
  private timestamps: Float64Array;

  constructor(klines: Map<string, Kline[]>, referenceCoin: string) {
    const bars = klines.get(referenceCoin);
    if (!bars) throw new Error(`Reference coin ${referenceCoin} not found`);
    this.timestamps = new Float64Array(bars.map((b) => b.timestamp));
  }

  tickToDate(tick: number): Date {
    return new Date(this.timestamps[tick] ?? 0);
  }

  tickToISO(tick: number): string {
    return this.tickToDate(tick).toISOString();
  }

  dateToTick(date: Date): number {
    const ts = date.getTime();
    let lo = 0;
    let hi = this.timestamps.length - 1;
    while (lo < hi) {
      const mid = (lo + hi) >>> 1;
      if (this.timestamps[mid] < ts) lo = mid + 1;
      else hi = mid;
    }
    return lo;
  }

  length(): number {
    return this.timestamps.length;
  }
}
