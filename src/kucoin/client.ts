import {
  ClientOptionBuilder,
  DefaultClient,
  GlobalApiEndpoint,
  Spot,
  Account,
  TransportOptionBuilder,
} from "kucoin-universal-sdk";

import type { KucoinConfig, Balance, Ticker, Kline, OrderRequest, OrderResult, LiquidityRanking } from "./types.ts";

export class KucoinClient {
  private client: DefaultClient;

  constructor(config: KucoinConfig) {
    const transport = new TransportOptionBuilder()
      .setKeepAlive(true)
      .setMaxConnsPerHost(10)
      .setMaxIdleConns(10)
      .build();

    const options = new ClientOptionBuilder()
      .setKey(config.apiKey)
      .setSecret(config.apiSecret)
      .setPassphrase(config.apiPassphrase)
      .setSpotEndpoint(config.apiUrl ?? GlobalApiEndpoint)
      .setTransportOption(transport)
      .build();

    this.client = new DefaultClient(options);
  }

  async getBalances(): Promise<Balance[]> {
    const api = this.client.restService().getAccountService().getAccountApi();
    const req = Account.Account.GetSpotAccountListReq.builder().build();
    const resp = await api.getSpotAccountList(req);
    return resp.data.map((a: any) => ({
      currency: a.currency,
      available: a.available,
      frozen: a.frozen,
      total: a.total,
      accountType: a.type,
    }));
  }

  async getBalance(currency: string): Promise<Balance | null> {
    const balances = await this.getBalances();
    return balances.find((b) => b.currency === currency) ?? null;
  }

  async getTicker(symbol: string): Promise<Ticker> {
    const api = this.client.restService().getSpotService().getMarketApi();
    const req = Spot.Market.Get24hrStatsReq.builder().setSymbol(symbol).build();
    const resp = await api.get24hrStats(req);
    return {
      symbol,
      last: parseFloat(resp.last),
      changeRate: parseFloat(resp.changeRate),
      changePrice: parseFloat(resp.changePrice),
      high: parseFloat(resp.high),
      low: parseFloat(resp.low),
      vol: parseFloat(resp.vol),
      volValue: parseFloat(resp.volValue),
    };
  }

  async getKlines(
    symbol: string,
    interval: string,
    startAt: number,
    endAt: number,
  ): Promise<Kline[]> {
    const api = this.client.restService().getSpotService().getMarketApi();
    const req = Spot.Market.GetKlinesReq.builder()
      .setSymbol(symbol)
      .setType(interval as any)
      .setStartAt(Math.floor(startAt / 1000))
      .setEndAt(Math.floor(endAt / 1000))
      .build();

    const resp = await api.getKlines(req);
    if (!resp.data || !Array.isArray(resp.data)) return [];
    return resp.data.map((row: any) => ({
      timestamp: row[0] * 1000,
      open: parseFloat(row[1]),
      high: parseFloat(row[2]),
      low: parseFloat(row[3]),
      close: parseFloat(row[4]),
      volume: parseFloat(row[5]),
    }));
  }

  async getTopVolumeSymbols(limit: number = 20): Promise<LiquidityRanking[]> {
    const api = this.client.restService().getSpotService().getMarketApi();
    const req = Spot.Market.GetAllSymbolsReq.builder().build();
    const resp = await api.getAllSymbols(req);
    const usdtPairs = resp.data.filter((s: any) => s.symbol.endsWith("-USDT"));

    const tickers = await Promise.all(
      usdtPairs.slice(0, 50).map(async (s: any) => {
        try {
          const ticker = await this.getTicker(s.symbol);
          return { symbol: s.symbol, volume24h: ticker.volValue, lastPrice: ticker.last, changeRate: ticker.changeRate };
        } catch {
          return null;
        }
      }),
    );

    return tickers
      .filter((t): t is LiquidityRanking => t !== null && t.volume24h > 0)
      .sort((a, b) => b.volume24h - a.volume24h)
      .slice(0, limit);
  }

  async placeOrder(req: OrderRequest): Promise<OrderResult> {
    const api = this.client.restService().getSpotService().getOrderApi();
    const side = req.side === "buy"
      ? Spot.Order.AddOrderSyncReq.SideEnum.BUY
      : Spot.Order.AddOrderSyncReq.SideEnum.SELL;

    const builder = Spot.Order.AddOrderSyncReq.builder()
      .setClientOid(crypto.randomUUID())
      .setSide(side)
      .setSymbol(req.symbol)
      .setType(
        req.type === "limit"
          ? Spot.Order.AddOrderSyncReq.TypeEnum.LIMIT
          : Spot.Order.AddOrderSyncReq.TypeEnum.MARKET,
      )
      .setSize(req.size);

    if (req.price) builder.setPrice(req.price);

    const resp = await api.addOrderSync(builder.build());
    return { orderId: resp.orderId, clientOid: resp.clientOid };
  }

  async cancelAllOrders(symbol: string): Promise<void> {
    const api = this.client.restService().getSpotService().getOrderApi();
    const req = Spot.Order.CancelAllOrdersBySymbolReq.builder().setSymbol(symbol).build();
    await api.cancelAllOrdersBySymbol(req);
  }

  async getOpenOrders(symbol: string): Promise<any[]> {
    const api = this.client.restService().getSpotService().getOrderApi();
    const req = Spot.Order.GetOpenOrdersReq.builder().setSymbol(symbol).build();
    const resp = await api.getOpenOrders(req);
    return resp.data;
  }
}
