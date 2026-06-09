import type { Logger, LogEntry } from "./types.ts";

export function SilentLogger(): Logger {
  const logger = (_entry: LogEntry) => {};
  Object.defineProperty(logger, "name", { value: "silent" });
  return logger;
}
