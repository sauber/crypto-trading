import { assertEquals } from "@std/assert";
import { BollingerTimed } from "./bb-timed.ts";

Deno.test("creates strategy", () => {
  const s = BollingerTimed();
  assertEquals(typeof s, "function");
});

Deno.test("names strategy", () => {
  const s = BollingerTimed();
  assertEquals(s.name, "bb-timed");
});

Deno.test("default config", () => {
  const s = BollingerTimed({});
  assertEquals(typeof s, "function");
});
