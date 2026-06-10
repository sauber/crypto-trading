import type { KucoinConfig, Balance, Ticker, Kline, OrderRequest, OrderResult, LiquidityRanking } from "./types.ts";

let _sdk: Record<string, unknown> | null = null;

async function getSDK(): Promise<Record<string, unknown>> {
  if (!_sdk) {
    _sdk = await import("kucoin-universal-sdk");
  }
  return _sdk;
}

export class KucoinClient {
  private client: unknown = null;
  private config: KucoinConfig;

  constructor(config: KucoinConfig) {
    this.config = config;
  }

  async #ensureClient(): Promise<void> {
    if (this.client) return;
    const sdk = await getSDK();
    const TransportOptionBuilder = sdk.TransportOptionBuilder as any;
    const ClientOptionBuilder = sdk.ClientOptionBuilder as any;
    const DefaultClient = sdk.DefaultClient as any;

    const transport = new TransportOptionBuilder()
      .setKeepAlive(true)
      .setMaxConnsPerHost(10)
      .setMaxIdleConns(10)
      .build();

    const options = new ClientOptionBuilder()
      .setKey(this.config.apiKey)
      .setSecret(this.config.apiSecret)
      .setPassphrase(this.config.apiPassphrase)
      .setSpotEndpoint(this.config.apiUrl ?? sdk.GlobalApiEndpoint)
      .setTransportOption(transport)
      .build();

    this.client = new DefaultClient(options);
  }

  async getBalances(): Promise<Balance[]> {
    await this.#ensureClient();
    const sdk = await getSDK();
    const api = (this.client as any).restService().getAccountService().getAccountApi();
    const req = (sdk.Account as any).Account.GetSpotAccountListReq.builder().build();
    const resp = await api.getSpotAccountList(req);
    return resp.data.map((a: any) => ({
      currency: a.currency,
      available: a.available,
      frozen: a.frozen,
      total: a.balance,
      accountType: a.type,
    }));
  }

  async getBalance(currency: string): Promise<Balance | null> {
    const balances = await this.getBalances();
    return balances.find((b) => b.currency === currency) ?? null;
  }

  async getTicker(symbol: string): Promise<Ticker> {
    await this.#ensureClient();
    const sdk = await getSDK();
    const api = (this.client as any).restService().getSpotService().getMarketApi();
    const req = (sdk.Spot as any).Market.Get24hrStatsReq.builder().setSymbol(symbol).build();
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
    await this.#ensureClient();
    const sdk = await getSDK();
    const api = (this.client as any).restService().getSpotService().getMarketApi();
    const req = (sdk.Spot as any).Market.GetKlinesReq.builder()
      .setSymbol(symbol)
      .setType(interval)
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
    await this.#ensureClient();
    const sdk = await getSDK();
    const api = (this.client as any).restService().getSpotService().getMarketApi();
    const req = (sdk.Spot as any).Market.GetAllSymbolsReq.builder().build();
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
      .filter((t: any): t is LiquidityRanking => t !== null && t.volume24h > 0)
      .sort((a: any, b: any) => b.volume24h - a.volume24h)
      .slice(0, limit);
  }

  async placeOrder(req: OrderRequest): Promise<OrderResult> {
    await this.#ensureClient();
    const sdk = await getSDK();
    const api = (this.client as any).restService().getSpotService().getOrderApi();
    const side = req.side === "buy"
      ? (sdk.Spot as any).Order.AddOrderSyncReq.SideEnum.BUY
      : (sdk.Spot as any).Order.AddOrderSyncReq.SideEnum.SELL;

    const builder = (sdk.Spot as any).Order.AddOrderSyncReq.builder()
      .setClientOid(crypto.randomUUID())
      .setSide(side)
      .setSymbol(req.symbol)
      .setType(
        req.type === "limit"
          ? (sdk.Spot as any).Order.AddOrderSyncReq.TypeEnum.LIMIT
          : (sdk.Spot as any).Order.AddOrderSyncReq.TypeEnum.MARKET,
      )
      .setSize(req.size);

    if (req.price) builder.setPrice(req.price);

    const resp = await api.addOrderSync(builder.build());
    return { orderId: resp.orderId, clientOid: resp.clientOid };
  }

  async cancelAllOrders(symbol: string): Promise<void> {
    await this.#ensureClient();
    const sdk = await getSDK();
    const api = (this.client as any).restService().getSpotService().getOrderApi();
    const req = (sdk.Spot as any).Order.CancelAllOrdersBySymbolReq.builder().build();
    await api.cancelAllOrdersBySymbol(req);
  }

  async getOpenOrders(symbol: string): Promise<any[]> {
    await this.#ensureClient();
    const sdk = await getSDK();
    const api = (this.client as any).restService().getSpotService().getOrderApi();
    const req = (sdk.Spot as any).Order.GetOpenOrdersReq.builder().build();
    const resp = await api.getOpenOrders(req);
    return resp.data;
  }
}
