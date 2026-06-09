import { LineJournal } from "./line-journal.ts";

Deno.test("LineJournal has name 'line-journal'", () => {
  const logger = LineJournal();
  if (logger.name !== "line-journal") {
    throw new Error(`Expected name "line-journal", got "${logger.name}"`);
  }
});

Deno.test("LineJournal with timestamp and message", () => {
  const logs: string[] = [];
  const origLog = console.log;
  console.log = (msg: unknown) => logs.push(String(msg));

  try {
    const logger = LineJournal();
    logger({ action: "trade", message: "hello", timestamp: "2025-01-01" });

    if (logs.length !== 1) {
      throw new Error(`Expected 1 log, got ${logs.length}`);
    }
    if (logs[0] !== "[2025-01-01] hello") {
      throw new Error(`Unexpected output: "${logs[0]}"`);
    }
  } finally {
    console.log = origLog;
  }
});

Deno.test("LineJournal with side and symbol", () => {
  const logs: string[] = [];
  const origLog = console.log;
  console.log = (msg: unknown) => logs.push(String(msg));

  try {
    const logger = LineJournal();
    logger({
      action: "trade",
      message: "executed",
      side: "buy",
      symbol: "BTC-USDT",
      reason: "RSI oversold",
    });

    if (logs.length !== 1) {
      throw new Error(`Expected 1 log, got ${logs.length}`);
    }
    if (logs[0] !== "Buy BTC-USDT executed (RSI oversold)") {
      throw new Error(`Unexpected output: "${logs[0]}"`);
    }
  } finally {
    console.log = origLog;
  }
});

Deno.test("LineJournal with all fields", () => {
  const logs: string[] = [];
  const origLog = console.log;
  console.log = (msg: unknown) => logs.push(String(msg));

  try {
    const logger = LineJournal();
    logger({
      timestamp: "12:00",
      cycle: 5,
      action: "trade",
      side: "sell",
      symbol: "ETH-USDT",
      message: "market order filled",
      reason: "take profit",
    });

    if (logs.length !== 1) {
      throw new Error(`Expected 1 log, got ${logs.length}`);
    }
    if (logs[0] !== "[12:00] Sell ETH-USDT market order filled (take profit)") {
      throw new Error(`Unexpected output: "${logs[0]}"`);
    }
  } finally {
    console.log = origLog;
  }
});

Deno.test("LineJournal without timestamp", () => {
  const logs: string[] = [];
  const origLog = console.log;
  console.log = (msg: unknown) => logs.push(String(msg));

  try {
    const logger = LineJournal();
    logger({ action: "cycle", message: "starting" });

    if (logs.length !== 1) {
      throw new Error(`Expected 1 log, got ${logs.length}`);
    }
    if (logs[0] !== "starting") {
      throw new Error(`Unexpected output: "${logs[0]}"`);
    }
  } finally {
    console.log = origLog;
  }
});

Deno.test("LineJournal with role prefix", () => {
  const logs: string[] = [];
  const origLog = console.log;
  console.log = (msg: unknown) => logs.push(String(msg));

  try {
    const logger = LineJournal();
    logger({ action: "decision", message: "want to buy", role: "PO", side: "buy", symbol: "BTC-USDT", reason: "rank up" });

    if (logs.length !== 1) {
      throw new Error(`Expected 1 log, got ${logs.length}`);
    }
    if (logs[0] !== "[PO] Buy BTC-USDT want to buy (rank up)") {
      throw new Error(`Unexpected output: "${logs[0]}"`);
    }
  } finally {
    console.log = origLog;
  }
});

Deno.test("LineJournal with timestamp and role", () => {
  const logs: string[] = [];
  const origLog = console.log;
  console.log = (msg: unknown) => logs.push(String(msg));

  try {
    const logger = LineJournal();
    logger({ timestamp: "12:00", role: "EX", action: "sell", side: "sell", symbol: "ETH-USDT", message: "filled", reason: "take profit" });

    if (logs.length !== 1) {
      throw new Error(`Expected 1 log, got ${logs.length}`);
    }
    if (logs[0] !== "[12:00] [EX] Sell ETH-USDT filled (take profit)") {
      throw new Error(`Unexpected output: "${logs[0]}"`);
    }
  } finally {
    console.log = origLog;
  }
});
