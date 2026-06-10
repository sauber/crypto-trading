import { market } from "./market.ts";

interface Row {
  rankStr: string;
  symbol: string;
  priceStr: string;
  liqStr: string;
  color: string;
}

const instruments = await market();

const last = instruments.reduce((max, inst) => Math.max(max, inst.length), 0) - 1;

const rows: Row[] = [];

for (const inst of instruments) {
  if (inst.length < 2) continue;
  const currentRank = inst.rank(last);
  if (currentRank <= 0) continue;

  const rc = inst.rankChange(last);
  const price = inst.series[last];
  const prevPrice = inst.series[last - 1];
  const priceChange = price - prevPrice;
  const liquidity = inst.series[last] * inst.volumes[last];

  let change = "";
  let color = "";
  if (!isNaN(rc)) {
    if (rc > 0) change = ` (+${rc})`;
    else if (rc < 0) change = ` (${rc})`;
    if (rc > 0 && priceChange > 0) color = "\x1b[32m";
    else if (rc < 0 && priceChange < 0) color = "\x1b[31m";
  }

  rows.push({
    rankStr: `${currentRank}${change}`,
    symbol: inst.symbol,
    priceStr: price.toFixed(2),
    liqStr: liquidity.toLocaleString("en-US", {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }),
    color,
  });
}

rows.sort((a, b) => parseInt(a.rankStr) - parseInt(b.rankStr));

const rankWid = Math.max("Rank".length, ...rows.map((r) => r.rankStr.length));
const symWid = Math.max("Coin".length, ...rows.map((r) => r.symbol.length));
const priceWid = Math.max("Price".length, ...rows.map((r) => r.priceStr.length));
const liqWid = Math.max("Liquidity".length, ...rows.map((r) => r.liqStr.length));

console.log(
  "Rank".padEnd(rankWid),
  "Coin".padEnd(symWid),
  "Price".padStart(priceWid),
  "Liquidity".padStart(liqWid),
);
console.log("─".repeat(rankWid + 1 + symWid + 1 + priceWid + 1 + liqWid));

for (const r of rows) {
  const line =
    `${r.rankStr.padEnd(rankWid)} ${r.symbol.padEnd(symWid)} ${r.priceStr.padStart(priceWid)} ${r.liqStr.padStart(liqWid)}`;
  if (r.color) {
    console.log(r.color + line + "\x1b[0m");
  } else {
    console.log(line);
  }
}
