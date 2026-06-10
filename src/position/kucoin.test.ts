import { assertEquals, assert } from "@std/assert";
import { KucoinPositionLoader } from "./kucoin.ts";
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

const config = {
  reserveSymbol: "USDC",
  candleInterval: "1hour",
  candleRangeMs: 55 * 3600000,
};

Deno.test("loads positions", async () => {
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

  const loader = KucoinPositionLoader(config, client);
  const result = await loader();

  assert(getBalancesCalled);
  assert(getTickerCalled);
  assertEquals(result.length, 1);
  assertEquals(result[0].symbol, "BTC-USDT");
  assertEquals(result[0].size, 0.5);
  assertEquals(result[0].entryPrice, 60000);
});

Deno.test("filters reserve", async () => {
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

  const loader = KucoinPositionLoader(config, client);
  const result = await loader();

  assertEquals(result.length, 2);
  assertEquals(result.some((p) => p.symbol === "USDC-USDT"), false);
});

Deno.test("empty balances", async () => {
  const client = {
    getBalances: () => Promise.resolve([]),
  } as unknown as KucoinClient;

  const loader = KucoinPositionLoader(config, client);
  const result = await loader();
  assertEquals(result.length, 0);
});

Deno.test("ticker fallback", async () => {
  let getKlinesCalled = false;

  const client = {
    getBalances: () => Promise.resolve([mockBalance("BTC", "1")]),
    getTicker: () => Promise.reject(new Error("API error")),
    getKlines: (_sym: string, _int: string, _s: number, _e: number) => {
      getKlinesCalled = true;
      return Promise.resolve([mockKline(55000)]);
    },
  } as unknown as KucoinClient;

  const loader = KucoinPositionLoader(config, client);
  const result = await loader();

  assert(getKlinesCalled);
  assertEquals(result.length, 1);
  assertEquals(result[0].entryPrice, 55000);
});

Deno.test("skips failed", async () => {
  const client = {
    getBalances: () =>
      Promise.resolve([mockBalance("BTC", "1"), mockBalance("ETH", "2")]),
    getTicker: (sym: string) => {
      if (sym === "ETH-USDT") return Promise.resolve(mockTicker(3000));
      return Promise.reject(new Error("API error"));
    },
    getKlines: () => Promise.reject(new Error("API error")),
  } as unknown as KucoinClient;

  const loader = KucoinPositionLoader(config, client);
  const result = await loader();

  assertEquals(result.length, 1);
  assertEquals(result[0].symbol, "ETH-USDT");
});
