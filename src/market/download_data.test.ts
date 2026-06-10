import { assertEquals } from "@std/assert";
import { downloadData } from "./download_data.ts";

Deno.test("exports function", () => {
  assertEquals(typeof downloadData, "function");
});
