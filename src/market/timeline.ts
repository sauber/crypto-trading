import { getData } from "./data.ts";

/** Convert between bar indices and wall-clock Date objects using the first coin's timestamp series. */
export interface Timeline {
  /** Return the bar index whose timestamp is nearest to (>=) the given date. */
  toBar(date: Date): number;
  /** Return the Date of the given bar index. */
  toDate(bar: number): Date;
}

/** Load cached klines and build a Timeline converter keyed on the first coin's bar timestamps. */
export async function timeline(): Promise<Timeline> {
  const { klines, coins } = await getData();

  // Use the first coin as the reference timeline
  const ref = klines.get(coins[0]);
  if (!ref) throw new Error(`Reference coin ${coins[0]} not found`);

  const timestamps = new Float64Array(ref.map((b) => b.timestamp));

  return {
    toBar(date: Date): number {
      // Binary search for the bar matching the date
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
    toDate(bar: number): Date {
      return new Date(timestamps[bar] ?? 0);
    },
  };
}
