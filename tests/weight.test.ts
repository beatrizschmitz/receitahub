import { test } from "node:test";
import assert from "node:assert/strict";
import { formatPerKg } from "../src/lib/weight.ts";

test("gramas por kg com vírgula e até 2 casas", () => {
  assert.equal(formatPerKg(122, 68), "1,79");
  assert.equal(formatPerKg(136, 68), "2,0");
  assert.equal(formatPerKg(54, 68), "0,79");
});
