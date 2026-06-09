import { RoleRegistry } from "./registry.ts";
import type { PortfolioStrategy, PortfolioConfig } from "./portfolio/types.ts";
import type { TradingStrategy } from "./trading/types.ts";
import type { ExecutionStrategy } from "./execution/types.ts";
import type { CommunicationStrategy } from "./communication/types.ts";
import type { ReflectionStrategy } from "./reflection/types.ts";
import type { Kline } from "../kucoin/types.ts";
import { RankTrendPortfolio } from "./portfolio/strategies/rank-trend/strategy.ts";
import { RsiTimedTrading } from "./trading/strategies/rsi-timed/strategy.ts";
import { MacdTimedTrading } from "./trading/strategies/macd-timed/strategy.ts";
import { BbTimedTrading } from "./trading/strategies/bb-timed/strategy.ts";
import { EmaAdxTimedTrading } from "./trading/strategies/ema-adx-timed/strategy.ts";
import { SimulateExecution } from "./execution/strategies/simulate.ts";
import { KucoinExecution } from "./execution/strategies/kucoin.ts";
import { SilentComm } from "./communication/strategies/silent.ts";
import { VerboseComm } from "./communication/strategies/verbose.ts";
import { NoopReflection } from "./reflection/strategies/noop.ts";
import { AnalystReflection } from "./reflection/strategies/analyst.ts";

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
