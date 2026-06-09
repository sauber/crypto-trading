import { KucoinClient } from "./kucoin/client.ts";
import { TradingEngine } from "./engine.ts";

const KUCOIN_API_KEY = Deno.env.get("KUCOIN_API_KEY") || "";
const KUCOIN_API_SECRET = Deno.env.get("KUCOIN_API_SECRET") || "";
const KUCOIN_API_PASSPHRASE = Deno.env.get("KUCOIN_API_PASSPHRASE") || "";
const DRY_RUN = Deno.env.get("DRY_RUN") === "true";

const client = new KucoinClient({
  apiKey: KUCOIN_API_KEY, apiSecret: KUCOIN_API_SECRET, apiPassphrase: KUCOIN_API_PASSPHRASE,
});

const engine = new TradingEngine({ client, portfolioStrategyName: "momentum", dryRun: DRY_RUN });
await engine.start();
