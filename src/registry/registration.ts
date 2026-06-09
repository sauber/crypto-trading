import { RoleRegistry } from "./registry.ts";
import type { PortfolioStrategy, PortfolioConfig } from "../portfolio/mod.ts";
import type { TradingStrategy } from "../trading/mod.ts";
import type { ExecutionStrategy } from "../execution/mod.ts";
import type { CommunicationStrategy } from "../communication/mod.ts";
import type { ReflectionStrategy } from "../reflection/mod.ts";
import type { DiscoveryStrategy, DiscoveryConfig } from "../discovery/mod.ts";
import type { KucoinClient } from "../kucoin/mod.ts";
import type { Kline } from "../kucoin/mod.ts";
import { FileDiscovery } from "../discovery/mod.ts";
import { KucoinDiscovery } from "../discovery/mod.ts";
import { RankTrendPortfolio } from "../portfolio/mod.ts";
import { RsiTimedTrading } from "../trading/mod.ts";
import { MacdTimedTrading } from "../trading/mod.ts";
import { BbTimedTrading } from "../trading/mod.ts";
import { EmaAdxTimedTrading } from "../trading/mod.ts";
import { SimulateExecution } from "../execution/mod.ts";
import { KucoinExecution } from "../execution/mod.ts";
import { SilentComm } from "../communication/mod.ts";
import { VerboseComm } from "../communication/mod.ts";
import { NoopReflection } from "../reflection/mod.ts";
import { AnalystReflection } from "../reflection/mod.ts";

export const discoveryRegistry = new RoleRegistry<DiscoveryStrategy>();

discoveryRegistry.register("testdata", (config?: unknown) =>
  new FileDiscovery(config as DiscoveryConfig));

discoveryRegistry.register("kucoin", (...args: unknown[]) =>
  new KucoinDiscovery(args[0] as DiscoveryConfig, args[1] as KucoinClient));

export const portfolioRegistry = new RoleRegistry<PortfolioStrategy>();
export const tradingRegistry = new RoleRegistry<TradingStrategy>();
export const executionRegistry = new RoleRegistry<ExecutionStrategy>();
export const commRegistry = new RoleRegistry<CommunicationStrategy>();
export const reflectionRegistry = new RoleRegistry<ReflectionStrategy>();

portfolioRegistry.register("rank-trend", (config?: unknown) =>
  new RankTrendPortfolio(config as PortfolioConfig));

tradingRegistry.register("rsi-timed", (config?: unknown) =>
  new RsiTimedTrading(config as Record<string, number>));
tradingRegistry.register("macd-timed", (config?: unknown) =>
  new MacdTimedTrading(config as Record<string, number>));
tradingRegistry.register("bb-timed", (config?: unknown) =>
  new BbTimedTrading(config as Record<string, number>));
tradingRegistry.register("ema-adx-timed", (config?: unknown) =>
  new EmaAdxTimedTrading(config as Record<string, number>));

executionRegistry.register("simulate", (...args: unknown[]) =>
  new SimulateExecution(
    args[0] as { fee: number },
    args[1] as Map<string, number> | undefined,
    args[2] as Map<string, Kline[]> | undefined,
    args[3] as number | undefined,
  ));
executionRegistry.register("kucoin", (...args: unknown[]) =>
  new KucoinExecution(args[0] as { fee: number }, args[1] as never, args[2] as boolean));

commRegistry.register("silent", () => new SilentComm({ silent: true }));
commRegistry.register("verbose", () => new VerboseComm({ silent: false }));

reflectionRegistry.register("noop", () => new NoopReflection({ enabled: false }));
reflectionRegistry.register("analyst", () => new AnalystReflection({ enabled: true }));
