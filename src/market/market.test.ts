import { _setTestData, _resetCache, type DataCache } from "./data.ts";
import { market } from "./market-data.ts";
import { timeline } from "./timeline.ts";
import type { Timeline } from "./timeline.ts";
import { RankedInstrument } from "./ranked-instrument.ts";
import type { Kline } from "../kucoin/mod.ts";

function kline(ts: number, close: number, volume: number): Kline {
  return { timestamp: ts, open: close, high: close + 1, low: close - 1, close, volume };
}

const TS_A = 1000;
const TS_B = 2000;
const TS_C = 3000;

const KLINES_A = [
  kline(TS_A, 10, 100),   // score = 1000
  kline(TS_B, 11, 50),    // score = 550
  kline(TS_C, 12, 200),   // score = 2400 (highest at tick 2)
];
const KLINES_B = [
  kline(TS_A, 20, 200),   // score = 4000 (highest at tick 0)
  kline(TS_B, 21, 30),    // score = 630
  kline(TS_C, 22, 10),    // score = 220
];
const KLINES_C = [
  kline(TS_A, 5, 300),    // score = 1500 (middle at tick 0)
  kline(TS_B, 6, 100),    // score = 600
  kline(TS_C, 7, 50),     // score = 350
];

function setupData(): void {
  const klines = new Map<string, Kline[]>([
    ["A-USDT", KLINES_A],
    ["B-USDT", KLINES_B],
    ["C-USDT", KLINES_C],
  ]);
  _setTestData({ klines, coins: ["A-USDT", "B-USDT", "C-USDT"] });
}

// ─── market() ────────────────────────────────────────────────────────────

Deno.test("market returns one instrument per symbol", async () => {
  setupData();
  const instruments = await market();
  if (instruments.length !== 3) throw new Error(`expected 3, got ${instruments.length}`);
  const symbols = instruments.map((i) => i.symbol).sort();
  if (symbols.join(",") !== "A-USDT,B-USDT,C-USDT") {
    throw new Error(`unexpected symbols: ${symbols}`);
  }
});

Deno.test("market assigns correct ranks at each tick", async () => {
  setupData();
  const instruments = await market();

  // Tick 0 scores: B=4000, C=1500, A=1000 → ranks: B=1, C=2, A=3
  // Tick 1 scores: B=630, C=600, A=550 → ranks: B=1, C=2, A=3
  // Tick 2 scores: A=2400, C=350, B=220 → ranks: A=1, C=2, B=3
  const a = instruments.find((i) => i.symbol === "A-USDT")!;
  if (a.rank(0) !== 3) throw new Error(`A rank(0): expected 3, got ${a.rank(0)}`);
  if (a.rank(1) !== 3) throw new Error(`A rank(1): expected 3, got ${a.rank(1)}`);
  if (a.rank(2) !== 1) throw new Error(`A rank(2): expected 1, got ${a.rank(2)}`);

  const b = instruments.find((i) => i.symbol === "B-USDT")!;
  if (b.rank(0) !== 1) throw new Error(`B rank(0): expected 1, got ${b.rank(0)}`);
  if (b.rank(1) !== 1) throw new Error(`B rank(1): expected 1, got ${b.rank(1)}`);
  if (b.rank(2) !== 3) throw new Error(`B rank(2): expected 3, got ${b.rank(2)}`);

  const c = instruments.find((i) => i.symbol === "C-USDT")!;
  if (c.rank(0) !== 2) throw new Error(`C rank(0): expected 2, got ${c.rank(0)}`);
  if (c.rank(1) !== 2) throw new Error(`C rank(1): expected 2, got ${c.rank(1)}`);
  if (c.rank(2) !== 2) throw new Error(`C rank(2): expected 2, got ${c.rank(2)}`);
});

Deno.test("market computes rank changes correctly", async () => {
  setupData();
  const instruments = await market();

  // A: ranks [3,3,1] → changes: [0, 0, 2]
  // B: ranks [1,1,3] → changes: [0, 0, -2]
  // C: ranks [2,2,2] → changes: [0, 0, 0]
  const a = instruments.find((i) => i.symbol === "A-USDT")!;
  if (a.rankChange(0) !== 0) throw new Error(`A rankChange(0): expected 0, got ${a.rankChange(0)}`);
  if (a.rankChange(1) !== 0) throw new Error(`A rankChange(1): expected 0, got ${a.rankChange(1)}`);
  if (a.rankChange(2) !== 2) throw new Error(`A rankChange(2): expected 2, got ${a.rankChange(2)}`);

  const b = instruments.find((i) => i.symbol === "B-USDT")!;
  if (b.rankChange(2) !== -2) throw new Error(`B rankChange(2): expected -2, got ${b.rankChange(2)}`);

  const c = instruments.find((i) => i.symbol === "C-USDT")!;
  if (c.rankChange(2) !== 0) throw new Error(`C rankChange(2): expected 0, got ${c.rankChange(2)}`);
});

Deno.test("market preserves close and volume series", async () => {
  setupData();
  const instruments = await market();
  const a = instruments.find((i) => i.symbol === "A-USDT")!;

  if (a.length !== 3) throw new Error(`A length: expected 3, got ${a.length}`);
  if (a.series[0] !== 10 || a.series[1] !== 11 || a.series[2] !== 12) {
    throw new Error(`A close series: expected [10,11,12]`);
  }
  if (a.volumes[0] !== 100 || a.volumes[1] !== 50 || a.volumes[2] !== 200) {
    throw new Error(`A volume series: expected [100,50,200]`);
  }
});

Deno.test("market exposes raw klines on instrument", async () => {
  setupData();
  const instruments = await market();
  const a = instruments.find((i) => i.symbol === "A-USDT")!;
  if (a.klines.length !== 3) throw new Error(`A klines length: expected 3, got ${a.klines.length}`);
  if (a.klines[0].close !== 10) throw new Error(`A klines[0].close: expected 10, got ${a.klines[0].close}`);
  if (a.klines[0].volume !== 100) throw new Error(`A klines[0].volume: expected 100, got ${a.klines[0].volume}`);
});

Deno.test("market throws when fewer than 2 bars", async () => {
  const klines = new Map([["X", [kline(1000, 10, 100)]]]);
  _setTestData({ klines, coins: ["X"] });
  try {
    await market();
    throw new Error("expected market() to throw");
  } catch (e) {
    if (!(e instanceof Error) || !e.message.includes("at least 2 bars")) throw e;
  }
});

Deno.test("market handles symbols not in the coins list (zero-filled rank)", async () => {
  const klines = new Map<string, Kline[]>([
    ["A-USDT", KLINES_A],
    ["B-USDT", KLINES_B],
    ["C-USDT", KLINES_C],
    ["EXTRA-USDT", [kline(1000, 1, 1), kline(2000, 2, 2), kline(3000, 3, 3)]],
  ]);
  _setTestData({ klines, coins: ["A-USDT", "B-USDT", "C-USDT"] });
  const instruments = await market();
  if (instruments.length !== 4) throw new Error(`expected 4 instruments, got ${instruments.length}`);

  const extra = instruments.find((i) => i.symbol === "EXTRA-USDT")!;
  if (extra.rank(0) !== 0) throw new Error(`EXTRA rank(0): expected 0, got ${extra.rank(0)}`);
  if (extra.rank(2) !== 0) throw new Error(`EXTRA rank(2): expected 0, got ${extra.rank(2)}`);
  if (extra.rankChange(0) !== 0) throw new Error(`EXTRA rankChange(0): expected 0`);

  // Core coins still have correct ranks
  const a = instruments.find((i) => i.symbol === "A-USDT")!;
  if (a.rank(0) !== 3) throw new Error(`A rank(0): expected 3, got ${a.rank(0)}`);
  if (a.rank(2) !== 1) throw new Error(`A rank(2): expected 1, got ${a.rank(2)}`);
});

// ─── timeline() ──────────────────────────────────────────────────────────

Deno.test("timeline toDate converts bar index to Date", async () => {
  setupData();
  const tl = await timeline();
  if (tl.toDate(0).getTime() !== TS_A) throw new Error(`toDate(0): expected ${TS_A}`);
  if (tl.toDate(1).getTime() !== TS_B) throw new Error(`toDate(1): expected ${TS_B}`);
  if (tl.toDate(2).getTime() !== TS_C) throw new Error(`toDate(2): expected ${TS_C}`);
});

Deno.test("timeline toBar returns exact match for bar timestamp", async () => {
  setupData();
  const tl = await timeline();
  if (tl.toBar(new Date(TS_A)) !== 0) throw new Error(`toBar(${TS_A}): expected 0`);
  if (tl.toBar(new Date(TS_B)) !== 1) throw new Error(`toBar(${TS_B}): expected 1`);
  if (tl.toBar(new Date(TS_C)) !== 2) throw new Error(`toBar(${TS_C}): expected 2`);
});

Deno.test("timeline toBar returns next bar for date between timestamps", async () => {
  setupData();
  const tl = await timeline();
  const mid = Math.floor((TS_A + TS_B) / 2);
  if (tl.toBar(new Date(mid)) !== 1) {
    throw new Error(`toBar(${mid}): expected 1 (between bar 0 and 1)`);
  }
});

Deno.test("timeline toBar clamps to last bar for date after last timestamp", async () => {
  setupData();
  const tl = await timeline();
  if (tl.toBar(new Date(TS_C + 9999)) !== 2) {
    throw new Error(`toBar(after last): expected 2, got ${tl.toBar(new Date(TS_C + 9999))}`);
  }
});

Deno.test("timeline toBar returns 0 for date before first timestamp", async () => {
  setupData();
  const tl = await timeline();
  if (tl.toBar(new Date(TS_A - 9999)) !== 0) {
    throw new Error(`toBar(before first): expected 0, got ${tl.toBar(new Date(TS_A - 9999))}`);
  }
});

Deno.test("timeline toDate returns epoch for out-of-range bar", async () => {
  setupData();
  const tl = await timeline();
  if (tl.toDate(99).getTime() !== 0) {
    throw new Error(`toDate(99): expected epoch, got ${tl.toDate(99).getTime()}`);
  }
  if (tl.toDate(-1).getTime() !== 0) {
    throw new Error(`toDate(-1): expected epoch, got ${tl.toDate(-1).getTime()}`);
  }
});

// ─── RankedInstrument ────────────────────────────────────────────────────

function makeInst(
  series: number[],
  ranks: number[],
  changes: number[],
  vols: number[],
): RankedInstrument {
  return new RankedInstrument(
    new Float32Array(series),
    0,
    "X",
    new Float32Array(ranks),
    new Float32Array(changes),
    series.map((c, i) => kline(1000 + i * 1000, c, vols[i] ?? 0)),
    new Float32Array(vols),
  );
}

Deno.test("RankedInstrument rank returns value for valid tick", () => {
  const inst = makeInst([10, 20], [1, 2], [0, 1], [100, 200]);
  if (inst.rank(0) !== 1) throw new Error(`rank(0): expected 1, got ${inst.rank(0)}`);
  if (inst.rank(1) !== 2) throw new Error(`rank(1): expected 2, got ${inst.rank(1)}`);
});

Deno.test("RankedInstrument rank returns NaN for out-of-range tick", () => {
  const inst = makeInst([10, 20], [1, 2], [0, 1], [100, 200]);
  if (!isNaN(inst.rank(-1))) throw new Error(`rank(-1): expected NaN`);
  if (!isNaN(inst.rank(5))) throw new Error(`rank(5): expected NaN`);
});

Deno.test("RankedInstrument rankChange returns value for valid tick", () => {
  const inst = makeInst([10, 20, 30], [3, 1, 2], [0, 2, -1], [100, 200, 300]);
  if (inst.rankChange(1) !== 2) throw new Error(`rankChange(1): expected 2, got ${inst.rankChange(1)}`);
  if (inst.rankChange(2) !== -1) throw new Error(`rankChange(2): expected -1, got ${inst.rankChange(2)}`);
});

Deno.test("RankedInstrument rankChange returns 0 for tick 0", () => {
  const inst = makeInst([10, 20], [1, 2], [0, 1], [100, 200]);
  if (inst.rankChange(0) !== 0) throw new Error(`rankChange(0): expected 0, got ${inst.rankChange(0)}`);
});

Deno.test("RankedInstrument rankChange returns 0 for out-of-range tick", () => {
  const inst = makeInst([10, 20], [1, 2], [0, 1], [100, 200]);
  if (inst.rankChange(-1) !== 0) throw new Error(`rankChange(-1): expected 0`);
  if (inst.rankChange(5) !== 0) throw new Error(`rankChange(5): expected 0`);
});
