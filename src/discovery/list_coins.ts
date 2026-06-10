interface Kline {
  timestamp: number;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
}

interface KlineData {
  interval: string;
  coins: string[];
  klines: Record<string, Kline[]>;
}

interface Entry {
  symbol: string;
  price: number;
  currentLiquidity: number;
  previousLiquidity: number;
}

interface Row {
  rankStr: string;
  symbol: string;
  priceStr: string;
  liqStr: string;
}

const content = await Deno.readTextFile("data/klines.json");
const data: KlineData = JSON.parse(content);

const entries: Entry[] = [];

for (const coin of data.coins) {
  const bars = data.klines[coin];
  if (!bars || bars.length === 0) continue;
  const curr = bars[0];
  const prev = bars[1];
  const currentLiquidity = curr.close * curr.volume;
  const previousLiquidity = prev ? prev.close * prev.volume : 0;
  entries.push({ symbol: coin, price: curr.close, currentLiquidity, previousLiquidity });
}

entries.sort((a, b) => b.currentLiquidity - a.currentLiquidity);

const prevRanked = [...entries].sort((a, b) => b.previousLiquidity - a.previousLiquidity);
const prevRank = new Map<string, number>();
for (let i = 0; i < prevRanked.length; i++) {
  if (prevRanked[i].previousLiquidity > 0) {
    prevRank.set(prevRanked[i].symbol, i + 1);
  }
}

const rows: Row[] = [];
for (let i = 0; i < entries.length; i++) {
  const e = entries[i];
  const currentRank = i + 1;
  const pr = prevRank.get(e.symbol);
  let change = "";
  if (pr !== undefined) {
    const diff = pr - currentRank;
    if (diff > 0) change = ` (+${diff})`;
    else if (diff < 0) change = ` (${diff})`;
  }
  rows.push({
    rankStr: `${currentRank}${change}`,
    symbol: e.symbol,
    priceStr: e.price.toFixed(2),
    liqStr: e.currentLiquidity.toLocaleString("en-US", {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }),
  });
}

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
  console.log(
    r.rankStr.padEnd(rankWid),
    r.symbol.padEnd(symWid),
    r.priceStr.padStart(priceWid),
    r.liqStr.padStart(liqWid),
  );
}
