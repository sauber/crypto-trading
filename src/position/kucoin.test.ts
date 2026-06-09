import { KucoinPositionLoader } from "./kucoin.ts";
import { config } from "./kucoin.config.ts";
import type { KucoinClient, Balance, Ticker, Kline } from "../kucoin/mod.ts";

function mockBalance(currency: string, available: string): Balance {
  return { currency, available, frozen: "0", total: available, accountType: "trade" };
}

function mockTicker(price: number): Ticker {
  return { symbol: "", last: price, changeRate: 0, changePrice: 0, high: 0, low: 0, vol: 0, volValue: 0 };
}

function mockKline(close: number): Kline {
  return { timestamp: 1, open: close, high: close, low: close, close, volume: 1 };
}

Deno.test("KucoinPositionLoader returns positions from getBalances", async () => {
  let getBalancesCalled = false;
  let getTickerCalled = false;

  const client = {
    getBalances: () => {
      getBalancesCalled = true;
      return Promise.resolve([mockBalance("BTC", "0.5")]);
    },
    getTicker: (_sym: string) => {
      getTickerCalled = true;
      return Promise.resolve(mockTicker(60000));
    },
  } as unknown as KucoinClient;

  const loader = new KucoinPositionLoader(config, client);
  const result = await loader.loadPositions();

  if (!getBalancesCalled) throw new Error("getBalances was not called");
  if (!getTickerCalled) throw new Error("getTicker was not called");
  if (result.length !== 1) throw new Error(`expected 1 position, got ${result.length}`);
  if (result[0].symbol !== "BTC-USDT") throw new Error(`expected BTC-USDT, got ${result[0].symbol}`);
  if (result[0].size !== 0.5) throw new Error(`expected size 0.5, got ${result[0].size}`);
  if (result[0].entryPrice !== 60000) throw new Error(`expected price 60000, got ${result[0].entryPrice}`);
});

Deno.test("KucoinPositionLoader filters reserve symbol", async () => {
  const client = {
    getBalances: () =>
      Promise.resolve([
        mockBalance("BTC", "0.5"),
        mockBalance("USDC", "100"),
        mockBalance("ETH", "2"),
      ]),
    getTicker: (sym: string) => {
      if (sym === "BTC-USDT") return Promise.resolve(mockTicker(60000));
      return Promise.resolve(mockTicker(3000));
    },
  } as unknown as KucoinClient;

  const loader = new KucoinPositionLoader(config, client);
  const result = await loader.loadPositions();

  if (result.length !== 2) throw new Error(`expected 2 positions (no USDC), got ${result.length}`);
  if (result.some((p) => p.symbol === "USDC-USDT")) throw new Error("USDC should be filtered out");
});

Deno.test("KucoinPositionLoader returns empty for no active balances", async () => {
  const client = {
    getBalances: () => Promise.resolve([]),
  } as unknown as KucoinClient;

  const loader = new KucoinPositionLoader(config, client);
  const result = await loader.loadPositions();
  if (result.length !== 0) throw new Error("expected empty array");
});

Deno.test("KucoinPositionLoader falls back to klines when ticker fails", async () => {
  let getKlinesCalled = false;

  const client = {
    getBalances: () => Promise.resolve([mockBalance("BTC", "1")]),
    getTicker: () => Promise.reject(new Error("API error")),
    getKlines: (_sym: string, _int: string, _s: number, _e: number) => {
      getKlinesCalled = true;
      return Promise.resolve([mockKline(55000)]);
    },
  } as unknown as KucoinClient;

  const loader = new KucoinPositionLoader(config, client);
  const result = await loader.loadPositions();

  if (!getKlinesCalled) throw new Error("getKlines fallback was not called");
  if (result.length !== 1) throw new Error(`expected 1 position, got ${result.length}`);
  if (result[0].entryPrice !== 55000) throw new Error(`expected price 55000 from klines, got ${result[0].entryPrice}`);
});

Deno.test("KucoinPositionLoader skips coins that fail both ticker and klines", async () => {
  const client = {
    getBalances: () =>
      Promise.resolve([mockBalance("BTC", "1"), mockBalance("ETH", "2")]),
    getTicker: (sym: string) => {
      if (sym === "ETH-USDT") return Promise.resolve(mockTicker(3000));
      return Promise.reject(new Error("API error"));
    },
    getKlines: () => Promise.reject(new Error("API error")),
  } as unknown as KucoinClient;

  const loader = new KucoinPositionLoader(config, client);
  const result = await loader.loadPositions();

  if (result.length !== 1) throw new Error(`expected 1 position (only ETH), got ${result.length}`);
  if (result[0].symbol !== "ETH-USDT") throw new Error(`expected ETH-USDT, got ${result[0].symbol}`);
});
