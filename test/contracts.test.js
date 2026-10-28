import test from "node:test";
import assert from "node:assert/strict";
import {
  packSchema,
  actionSchema,
  observationSchema,
} from "../src/contracts.js";
import { pack, observation, action } from "./helpers.js";
import { readFile } from "node:fs/promises";

test("distributed example pack and named run arguments agree with public contracts", async () => {
  const example = packSchema.parse(
    JSON.parse(
      await readFile(
        new URL("../examples/search-pack.json", import.meta.url),
        "utf8",
      ),
    ),
  );
  const run = JSON.parse(
    await readFile(
      new URL("../examples/run-query.json", import.meta.url),
      "utf8",
    ),
  );
  assert.equal(run.id, example.id);
  assert.equal(run.procedure, example.procedures[0].id);
  assert.deepEqual(
    Object.keys(run.arguments),
    example.procedures[0].parameters,
  );
});
test("strict pack schema rejects scripts, missing role references, invalid permissions and credentials in origin", () => {
  assert.equal(packSchema.parse(pack()).id, "search");
  assert.throws(() => packSchema.parse({ ...pack(), script: "alert(1)" }));
  assert.throws(() => packSchema.parse(pack({ permissions: ["read"] })));
  assert.throws(() =>
    packSchema.parse(
      pack({
        scope: {
          origin: "https://user:secret@example.com",
          pathPrefix: "/",
          conditions: [],
        },
      }),
    ),
  );
  const p = pack();
  p.procedures[0].steps[0].role = "missing";
  assert.throws(() => packSchema.parse(p));
});
test("action requires explicit expected field value and intent; unknown evidence keys rejected", () => {
  const o = observation(),
    a = action(o);
  assert.equal(actionSchema.parse(a).kind, "fill");
  delete a.expectedValue;
  assert.throws(() => actionSchema.parse(a));
  assert.throws(() =>
    observationSchema.parse({ ...o, chromeDocumentId: "leak" }),
  );
});
