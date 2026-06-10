import { assertEquals, assertThrows } from "@std/assert";
import { RoleRegistry } from "./registry.ts";

type Stub = Record<string, never>;

Deno.test("registers entry", () => {
  const r = new RoleRegistry<Stub>();
  r.register("test", () => ({}));
  assertEquals(r.has("test"), true);
});

Deno.test("retrieves entry", () => {
  const r = new RoleRegistry<string>();
  r.register("greet", () => "hello");
  assertEquals(r.get("greet").name, "greet");
});

Deno.test("lists names", () => {
  const r = new RoleRegistry<Stub>();
  r.register("a", () => ({}));
  r.register("b", () => ({}));
  assertEquals(r.list(), ["a", "b"]);
});

Deno.test("checks existence", () => {
  const r = new RoleRegistry<Stub>();
  r.register("x", () => ({}));
  assertEquals(r.has("x"), true);
  assertEquals(r.has("y"), false);
});

Deno.test("throws unknown", () => {
  const r = new RoleRegistry<Stub>();
  assertThrows(() => r.get("missing"), Error, "missing");
});
