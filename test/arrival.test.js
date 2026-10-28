import test from "node:test";
import assert from "node:assert/strict";
import { fixture, observation, pack, pending } from "./helpers.js";
import { navigationDestination, observeArrival } from "../src/arrival.js";
import { packSchema } from "../src/contracts.js";
import { editDefinition } from "../extension/editor.js";

const destination = "https://example.com/result";
test("already received arrival observations remain recorded when the deadline, cancellation or binding guard rejects them", async (t) => {
  let now = 0;
  t.mock.method(Date, "now", () => now);
  for (const mode of ["deadline", "cancel", "rebind"]) {
    now = 0;
    const source = page("session"),
      after = page("session", true),
      runtime = {
        session: "session",
        binding: { tabId: 1 },
        cancelled: new Set(),
      };
    runtime.observe = async () => {
      if (mode === "deadline") now = 101;
      else if (mode === "cancel") runtime.cancelled.add("op");
      else runtime.session = "other";
      return after;
    };
    const result = await observeArrival(runtime, {
      source,
      destination,
      pack: { roles: [] },
      rule: { conditions: [], maxObservations: 1, maxElapsedMs: 100 },
      operationId: "op",
    });
    assert.equal(result.checks.length, 1);
    assert.equal(result.checks[0].observationId, after.id);
    assert.equal(result.checks[0].result, "excluded-after-observation");
    assert.equal(
      result.status,
      mode === "deadline" ? "unconfirmed" : "interrupted",
    );
  }
});
function page(
  session,
  arrived = false,
  url = arrived ? destination : "https://example.com/source",
) {
  const o = observation({
    session,
    url,
    documentId: arrived ? "doc-result" : "doc-1",
  });
  o.nodes[0] = {
    ...o.nodes[0],
    tag: arrived ? "div" : "a",
    role: arrived ? "" : "link",
    text: arrived ? "Done" : "Open result",
    value: null,
    editable: false,
    href: arrived ? null : destination,
    locator: { selector: arrived ? "#arrival" : "#go" },
    matches: [arrived ? "#arrival" : "#go"],
  };
  return o;
}
async function start(
  t,
  delivery = "synthetic-dispatched",
  rule = { maxObservations: 2, maxElapsedMs: 1000 },
) {
  const f = await fixture(t),
    { runtime, session } = f;
  const p = pack({
    scope: {
      origin: "https://example.com",
      pathPrefix: "/source",
      conditions: [],
    },
    roles: [
      { id: "go", locator: { selector: "#go" }, extract: "link" },
      { id: "arrival", locator: { selector: "#arrival" }, extract: "text" },
    ],
    permissions: ["read", "click"],
    procedures: [
      {
        id: "open",
        preconditions: [],
        postconditions: [],
        steps: [{ kind: "click", role: "go" }],
        arrival: {
          ...rule,
          conditions: [{ role: "arrival", state: "text", equals: "Done" }],
        },
      },
    ],
  });
  const draft = await runtime.packs.draft(p, null),
    o = page(session);
  o.at = Date.now() + 1;
  assert.equal(
    (await runtime.packs.recordTest(p.id, draft.revision, o)).pass,
    true,
  );
  await runtime.packs.activate(p.id, draft.revision, session, ["click"]);
  const args = { id: p.id, procedure: "open", operationId: "navigate-once" },
    run = runtime.call("packRun", args);
  let command = await pending(runtime);
  assert.equal(command.kind, "observe");
  runtime.reply(session, command.id, page(session));
  command = await pending(runtime);
  assert.equal(command.kind, "act");
  runtime.reply(session, command.id, {
    accepted: true,
    delivery,
    outcome: "unknown",
    reason: "test",
  });
  command = await pending(runtime);
  assert.equal(command.kind, "observe");
  return { ...f, run, args, command };
}
test("arrival verifies destination conditions outside source scope and duplicate operation never clicks again", async (t) => {
  const { runtime, session, command, run, args } = await start(t);
  assert.ok(command.args.selectors.includes("#arrival"));
  runtime.reply(session, command.id, page(session, true));
  const receipt = await run;
  assert.equal(receipt.arrival.status, "arrived");
  assert.equal(receipt.outcome, "observed");
  assert.equal(receipt.steps.length, 1);
  assert.equal(receipt.arrival.checks[0].documentId, "doc-result");
  assert.deepEqual(await runtime.call("packRun", args), receipt);
  assert.equal(runtime.pending, null);
});
test("observed arrival never converts unknown delivery or clears the input fence", async (t) => {
  const { runtime, session, command, run } = await start(t, "unknown");
  runtime.reply(session, command.id, page(session, true));
  const receipt = await run;
  assert.equal(receipt.arrival.status, "arrived");
  assert.equal(receipt.delivery, "unknown");
  assert.equal(receipt.outcome, "unknown");
  assert.equal(runtime.fenced, true);
});
test("unexpected destination is not accepted; same-document arrival is supported", async (t) => {
  const first = await start(t);
  first.runtime.reply(
    first.session,
    first.command.id,
    page(first.session, true, "https://example.com/unexpected"),
  );
  assert.equal((await first.run).arrival.status, "unexpected-destination");
  const second = await start(t);
  const o = page(second.session, true);
  o.documentId = "doc-1";
  second.runtime.reply(second.session, second.command.id, o);
  assert.equal((await second.run).arrival.status, "arrived");
});
test("arrival observation count is bounded and unchanged source is not arrival", async (t) => {
  const { runtime, session, command, run } = await start(t);
  runtime.reply(session, command.id, page(session));
  const next = await pending(runtime);
  runtime.reply(session, next.id, page(session));
  const receipt = await run;
  assert.equal(receipt.arrival.status, "unconfirmed");
  assert.equal(receipt.arrival.checks.length, 2);
  assert.equal(receipt.steps.length, 1);
  assert.equal(runtime.pending, null);
});
test("cancellation/rebind interrupt arrival reads and retain the already delivered click", async (t) => {
  for (const mode of ["cancel", "rebind"]) {
    const { runtime, session, command, run, args } = await start(t);
    if (mode === "cancel")
      await runtime.call("cancel", { operationId: args.operationId });
    else runtime.bind({ tabId: 1, windowId: 2 });
    const receipt = await run;
    assert.equal(receipt.arrival.status, "interrupted");
    assert.equal(receipt.delivery, "synthetic-dispatched");
    assert.throws(
      () => runtime.reply(session, command.id, page(session, true)),
      /unowned/,
    );
    assert.equal(runtime.pending, null);
  }
});
test("arrival budgets cap the pending command deadline without changing normal input timeout", async (t) => {
  t.mock.timers.enable({ apis: ["setTimeout"] });
  const { runtime, command, run } = await start(t, "synthetic-dispatched", {
    maxObservations: 8,
    maxElapsedMs: 100,
  });
  assert.ok(command.deadline - Date.now() <= 100);
  assert.equal(runtime.timeout, 5000);
  t.mock.timers.tick(100);
  const result = await run;
  assert.equal(result.arrival.status, "unconfirmed");
  assert.match(result.arrival.reason, /timeout|time-budget/);
  assert.equal(result.steps.length, 1);
});
test("exact destination and author contracts reject unsafe or misleading arrival configuration", () => {
  const source = { url: "https://example.com/source" };
  for (const href of [
    "javascript:alert(1)",
    "https://u:p@example.com/result",
    "https://elsewhere.example/result",
    source.url,
    "https://example.com/a/../result",
  ])
    assert.throws(() => navigationDestination(source, href));
  assert.equal(
    navigationDestination(source, "https://example.com/result?a=1&a=2"),
    "https://example.com/result?a=1&a=2",
  );
  const fields = {
    id: "author",
    name: "Author",
    version: "0.3.0",
    origin: "https://example.com",
    pathPrefix: "/source",
    role: "go",
    selector: "#go",
    extract: "link",
    cardinality: "one",
    limit: "50",
    kind: "click",
    procedure: "open",
    parameter: "",
    value: "",
    arrivalRole: "arrival",
    arrivalSelector: "#arrival",
    arrivalText: "Done",
    arrivalCount: "4",
    arrivalMs: "1000",
  };
  const draft = packSchema.parse(editDefinition(null, fields));
  assert.equal(draft.procedures[0].arrival.conditions[0].role, "arrival");
  assert.equal(draft.roles.length, 2);
  assert.throws(
    () => editDefinition(null, { ...fields, kind: "fill" }),
    /final navigation/,
  );
  draft.procedures[0].postconditions = [{ role: "arrival", state: "visible" }];
  assert.equal(packSchema.safeParse(draft).success, false);
});
