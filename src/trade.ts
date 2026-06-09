import { KucoinClient } from "./kucoin/client.ts";
import { TradingEngine } from "./engine/live.ts";
import type { LiveEngineConfig } from "./engine/live.ts";
import { TopVolumeDiscovery } from "./roles/discovery/strategy.ts";
import { ROLE_CONFIG } from "./roles/config.ts";
import type { KucoinConfig } from "./kucoin/types.ts";
import {
  portfolioRegistry,
  tradingRegistry,
  executionRegistry,
  commRegistry,
  reflectionRegistry,
} from "./roles/registration.ts";

const KUCOIN_API_KEY = Deno.env.get("KUCOIN_API_KEY") || "";
const KUCOIN_API_SECRET = Deno.env.get("KUCOIN_API_SECRET") || "";
const KUCOIN_API_PASSPHRASE = Deno.env.get("KUCOIN_API_PASSPHRASE") || "";
const DRY_RUN = Deno.env.get("DRY_RUN") === "true";

if (!KUCOIN_API_KEY || !KUCOIN_API_SECRET || !KUCOIN_API_PASSPHRASE) {
  console.error("Manglende KuCoin API credentials.");
  Deno.exit(1);
}

const client = new KucoinClient({
  apiKey: KUCOIN_API_KEY,
  apiSecret: KUCOIN_API_SECRET,
  apiPassphrase: KUCOIN_API_PASSPHRASE,
} as KucoinConfig);

const discovery = new TopVolumeDiscovery();

const portfolio = portfolioRegistry
  .get(ROLE_CONFIG.portfolio.strategy)
  .create(ROLE_CONFIG.portfolio.params);

const trading = tradingRegistry
  .get(ROLE_CONFIG.trading.strategy)
  .create(ROLE_CONFIG.trading.params);

const fee = ROLE_CONFIG.execution.params.fee ?? 0.001;
const execution = executionRegistry
  .get(DRY_RUN ? "simulate" : "kucoin")
  .create({ fee }, client, true);

const comm = commRegistry
  .get(ROLE_CONFIG.communication.strategy)
  .create();

const reflection = reflectionRegistry
  .get(ROLE_CONFIG.reflection.strategy)
  .create();

const engineConfig: LiveEngineConfig = {
  client,
  discovery,
  portfolio,
  trading,
  execution,
  communication: comm,
  reflection,
  intervalMs: ROLE_CONFIG.cycleIntervalMs,
  maxPositions: ROLE_CONFIG.maxPositions,
  candleInterval: ROLE_CONFIG.candleInterval,
  candleRangeMs: ROLE_CONFIG.candleRangeMs,
  reserveSymbol: ROLE_CONFIG.reserveSymbol,
};

console.log(`DRY_RUN=${DRY_RUN}`);
console.log(`portfolio=${ROLE_CONFIG.portfolio.strategy}`);
console.log(`trading=${ROLE_CONFIG.trading.strategy}`);
console.log(`execution=${DRY_RUN ? "simulate" : "kucoin"}`);
console.log(`communication=${ROLE_CONFIG.communication.strategy}`);
console.log(`reflection=${ROLE_CONFIG.reflection.strategy}`);

const engine = new TradingEngine(engineConfig);
await engine.start();
