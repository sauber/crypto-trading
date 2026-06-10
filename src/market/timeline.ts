import { getData } from "./market.ts";

/** Convert between tick indices and wall-clock Date objects using the first coin's timestamp series. */
export interface Timeline {
  /** Return the tick index whose timestamp is nearest to (>=) the given date. */
  toTick(date: Date): number;
  /** Return the Date of the given tick index. */
  toDate(tick: number): Date;
}

/** Load cached klines and build a Timeline converter keyed on the first coin's tick timestamps. */
export async function timeline(): Promise<Timeline> {
  const { klines, coins } = await getData();

  // Use the first coin as the reference timeline
  const ref = klines.get(coins[0]);
  if (!ref) throw new Error(`Reference coin ${coins[0]} not found`);

  const timestamps = new Float64Array(ref.map((b) => b.timestamp));

  return {
    toTick(date: Date): number {
      // Binary search for the tick matching the date
      const ts = date.getTime();
      let lo = 0;
      let hi = timestamps.length - 1;
      while (lo < hi) {
        const mid = (lo + hi) >>> 1;
        if (timestamps[mid] < ts) lo = mid + 1;
        else hi = mid;
      }
      return lo;
    },
    toDate(tick: number): Date {
      return new Date(timestamps[tick] ?? 0);
    },
  };
}
