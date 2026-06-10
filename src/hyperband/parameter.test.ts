import { assertEquals, assert, assertThrows } from "@std/assert";
import { DecimalParameter, EnumParameter, Parameter } from "./parameter.ts";
import type { ParamSpec } from "./types.ts";

Deno.test("DecimalParameter.random returns value within bounds", () => {
  const p = new DecimalParameter("x", 0, 10, 2);
  for (let i = 0; i < 100; i++) {
    const v = p.random();
    assert(v >= 0, `value ${v} < 0`);
    assert(v <= 10, `value ${v} > 10`);
  }
});

Deno.test("DecimalParameter.random respects precision", () => {
  const p = new DecimalParameter("x", 0, 1, 0);
  for (let i = 0; i < 100; i++) {
    const v = p.random();
    assertEquals(v, Math.round(v), `value ${v} not integer`);
  }
});

Deno.test("DecimalParameter.round clamps to bounds", () => {
  const p = new DecimalParameter("x", 0, 10, 1);
  assertEquals(p.round(-5), 0);
  assertEquals(p.round(15), 10);
});

Deno.test("DecimalParameter.round respects precision", () => {
  const p = new DecimalParameter("x", 0, 10, 2);
  assertEquals(p.round(3.456), 3.46);
});

Deno.test("DecimalParameter.toValue returns number", () => {
  const p = new DecimalParameter("x", 0, 10, 2);
  assertEquals(typeof p.toValue(5.123), "number");
  assertEquals(p.toValue(5.123), 5.12);
});

Deno.test("DecimalParameter.format produces correct string", () => {
  const p = new DecimalParameter("x", 0, 10, 2);
  assertEquals(p.format(5.1), "x=5.10");
});

Deno.test("DecimalParameter.toSpec returns valid spec", () => {
  const p = new DecimalParameter("x", 0, 10, 2);
  const spec = p.toSpec();
  assertEquals(spec.key, "x");
  assertEquals(spec.type, "decimal");
  assertEquals(spec.lo, 0);
  assertEquals(spec.hi, 10);
  assertEquals(spec.precision, 2);
});

Deno.test("EnumParameter.random returns valid index", () => {
  const p = new EnumParameter("signal", ["RSI", "MACD", "BB"]);
  for (let i = 0; i < 100; i++) {
    const v = p.random();
    assert(v >= 0, `value ${v} < 0`);
    assert(v < 3, `value ${v} >= 3`);
    assertEquals(Math.floor(v), v, `value ${v} not integer`);
  }
});

Deno.test("EnumParameter.round clamps to valid range", () => {
  const p = new EnumParameter("signal", ["RSI", "MACD"]);
  assertEquals(p.round(-1), 0);
  assertEquals(p.round(5), 1);
});

Deno.test("EnumParameter.toValue returns correct string", () => {
  const p = new EnumParameter("signal", ["RSI", "MACD", "BB"]);
  assertEquals(p.toValue(0), "RSI");
  assertEquals(p.toValue(1), "MACD");
  assertEquals(p.toValue(2), "BB");
});

Deno.test("EnumParameter.format produces correct string", () => {
  const p = new EnumParameter("signal", ["RSI", "MACD"]);
  assertEquals(p.format(0), "signal=RSI");
  assertEquals(p.format(1), "signal=MACD");
});

Deno.test("EnumParameter.toSpec returns valid spec", () => {
  const p = new EnumParameter("signal", ["RSI", "MACD"]);
  const spec = p.toSpec();
  assertEquals(spec.key, "signal");
  assertEquals(spec.type, "enum");
  assertEquals(spec.values.length, 2);
});

Deno.test("Parameter.fromSpec creates DecimalParameter", () => {
  const spec: ParamSpec = { key: "x", type: "decimal", lo: 0, hi: 10, precision: 2 };
  const p = Parameter.fromSpec(spec);
  assert(p instanceof DecimalParameter);
  assertEquals(p.key, "x");
});

Deno.test("Parameter.fromSpec creates EnumParameter", () => {
  const spec: ParamSpec = { key: "s", type: "enum", values: ["A", "B"] };
  const p = Parameter.fromSpec(spec);
  assert(p instanceof EnumParameter);
  assertEquals(p.key, "s");
});

Deno.test("DecimalParameter constructor rejects lo >= hi", () => {
  assertThrows(() => new DecimalParameter("x", 5, 5, 0));
});

Deno.test("DecimalParameter constructor rejects negative precision", () => {
  assertThrows(() => new DecimalParameter("x", 0, 10, -1));
});

Deno.test("EnumParameter constructor rejects single value", () => {
  assertThrows(() => new EnumParameter("x", ["only"]));
});
