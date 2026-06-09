import type { Logger, LogEntry } from "./types.ts";

export function LineJournal(): Logger {
  const logger = (entry: LogEntry) => {
    const parts: string[] = [];

    if (entry.timestamp) {
      parts.push(`[${entry.timestamp}]`);
    }

    if (entry.role) {
      parts.push(`[${entry.role}]`);
    }

    if (entry.side === "buy") {
      parts.push("Buy");
    } else if (entry.side === "sell") {
      parts.push("Sell");
    }

    if (entry.symbol) {
      parts.push(entry.symbol);
    }

    parts.push(entry.message);

    if (entry.reason) {
      parts.push(`(${entry.reason})`);
    }

    console.log(parts.join(" "));
  };

  Object.defineProperty(logger, "name", { value: "line-journal" });
  return logger;
}
