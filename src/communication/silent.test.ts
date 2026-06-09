import { SilentLogger } from "./silent.ts";

Deno.test("SilentLogger has name 'silent'", () => {
  const logger = SilentLogger();
  if (logger.name !== "silent") {
    throw new Error(`Expected name "silent", got "${logger.name}"`);
  }
});

Deno.test("SilentLogger logs nothing", () => {
  const logs: string[] = [];
  const origLog = console.log;
  console.log = (msg: unknown) => logs.push(String(msg));

  try {
    const logger = SilentLogger();
    logger({ action: "trade", message: "should not appear" });

    if (logs.length !== 0) {
      throw new Error(`Expected 0 logs, got ${logs.length}: ${logs.join(", ")}`);
    }
  } finally {
    console.log = origLog;
  }
});
