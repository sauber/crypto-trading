import { assertEquals } from "@std/assert";
import { download } from "./download.ts";

Deno.test("exports function", () => {
  assertEquals(typeof download, "function");
});
