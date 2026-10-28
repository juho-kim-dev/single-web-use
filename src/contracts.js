import { z } from "zod";

export const id = z
  .string()
  .regex(/^[a-zA-Z0-9_-]{1,100}$/)
  .refine(
    (s) =>
      !Object.getOwnPropertyNames(Object.prototype).includes(s) &&
      s !== "prototype",
    "reserved-id",
  );
const text = z.string().max(4000);
const revision = z.string().regex(/^[a-f0-9]{64}$/);
const argumentsSchema = z
  .record(id, text)
  .refine((v) => Object.keys(v).length <= 16, "too-many-arguments");
export const locator = z
  .object({ selector: z.string().min(1).max(500), label: text.optional() })
  .strict();
export const condition = z
  .object({
    role: id,
    state: z.enum(["visible", "enabled", "text", "value"]),
    equals: text.optional(),
  })
  .strict();
export const packSchema = z
  .object({
    format: z.literal("paw-swu-pack"),
    schemaVersion: z.literal(1),
    id,
    version: z.string().regex(/^\d+\.\d+\.\d+$/),
    name: z.string().min(1).max(200),
    scope: z
      .object({
        origin: z
          .string()
          .refine((s) => {
            try {
              const u = new URL(s);
              return /^https?:$/.test(u.protocol) && u.origin === s;
            } catch {
              return false;
            }
          })
          .nullable(),
        pathPrefix: z.string().startsWith("/").max(500),
        conditions: z.array(condition).max(8),
      })
      .strict(),
    extends: z
      .object({ id, revision: z.string().regex(/^[a-f0-9]{64}$/) })
      .strict()
      .optional(),
    roles: z
      .array(
        z
          .object({
            id,
            locator,
            extract: z.enum(["text", "link", "state"]),
            cardinality: z.enum(["one", "many"]).optional(),
            limit: z.number().int().min(1).max(100).optional(),
          })
          .strict(),
      )
      .min(1)
      .max(64),
    permissions: z.array(z.enum(["read", "fill", "click", "scroll"])).max(4),
    procedures: z
      .array(
        z
          .object({
            id,
            parameters: z.array(id).max(16).default([]),
            preconditions: z.array(condition).max(8),
            postconditions: z.array(condition).max(8),
            steps: z
              .array(
                z
                  .object({
                    kind: z.enum(["fill", "click", "scroll"]),
                    role: id,
                    text: text.optional(),
                    parameter: id.optional(),
                    linkParameter: id.optional(),
                    dy: z.number().int().min(-1000).max(1000).optional(),
                  })
                  .strict(),
              )
              .min(1)
              .max(8),
          })
          .strict(),
      )
      .max(16),
  })
  .strict()
  .superRefine((p, ctx) => {
    const keys = p.roles.map((r) => r.id);
    if (
      new Set(keys).size !== keys.length ||
      new Set(p.permissions).size !== p.permissions.length ||
      new Set(p.procedures.map((r) => r.id)).size !== p.procedures.length ||
      p.procedures.some(
        (s) => new Set(s.parameters).size !== s.parameters.length,
      )
    )
      ctx.addIssue({
        code: "custom",
        message: "duplicate-role-procedure-permission-or-parameter",
      });
    const conditions = [
      ...p.scope.conditions,
      ...p.procedures.flatMap((s) => [...s.preconditions, ...s.postconditions]),
    ];
    if (
      conditions.some(
        (c) =>
          (!p.extends && !keys.includes(c.role)) ||
          (["text", "value"].includes(c.state) && c.equals === undefined),
      )
    )
      ctx.addIssue({ code: "custom", message: "invalid-condition" });
    if (
      p.procedures.some((s) =>
        s.steps.some(
          (t) =>
            (!p.extends && !keys.includes(t.role)) ||
            !p.permissions.includes(t.kind) ||
            (t.kind === "fill" &&
              (t.text === undefined) === (t.parameter === undefined)) ||
            (t.parameter !== undefined &&
              (t.kind !== "fill" || !s.parameters.includes(t.parameter))) ||
            (t.linkParameter !== undefined &&
              (t.kind !== "click" ||
                !s.parameters.includes(t.linkParameter))) ||
            (t.kind === "scroll" && t.dy === undefined),
        ),
      )
    )
      ctx.addIssue({ code: "custom", message: "invalid-step-or-permission" });
  });

const rect = z
  .object({
    x: z.number().finite(),
    y: z.number().finite(),
    width: z.number().nonnegative(),
    height: z.number().nonnegative(),
  })
  .strict();
export const nodeSchema = z
  .object({
    ref: id,
    tag: z.string().max(50),
    role: text,
    label: text,
    labelSource: z.enum(["aria-label", "title", "placeholder", "none"]),
    text,
    textSegments: z
      .array(z.object({ order: z.number().int().nonnegative(), text }).strict())
      .max(64)
      .default([]),
    textEvidence: z
      .object({
        method: z.literal("range-fully-inside-viewport-and-overflow-clips"),
        truncated: z.boolean(),
        omitted: z.boolean(),
        pixels: z.literal("unverified"),
      })
      .strict(),
    href: text.nullable(),
    value: text.nullable(),
    disabled: z.boolean(),
    editable: z.boolean(),
    rect,
    exposure: z.enum(["hit-tested", "occluded", "unknown"]),
    locator: locator.nullable(),
    matches: z.array(z.string().max(500)).max(256),
    parent: id.nullable(),
    states: z.record(id, text),
  })
  .strict();
export const observationSchema = z
  .object({
    id,
    surfaceId: id,
    session: id,
    documentId: id,
    generation: z.number().int().nonnegative(),
    revision: z.number().int().nonnegative(),
    url: z.string().url().max(8000),
    at: z.number().finite(),
    viewport: z
      .object({
        width: z.number().positive(),
        height: z.number().positive(),
        x: z.number(),
        y: z.number(),
        scale: z.number().positive(),
        dpr: z.number().positive(),
      })
      .strict(),
    nodes: z.array(nodeSchema).max(300),
    coverage: z
      .object({
        visited: z.number().int().max(12000),
        truncated: z.boolean(),
        limitations: z.array(text).max(12),
      })
      .strict(),
    evidence: z.literal("dom-and-hit-test-not-pixels"),
    userEpoch: z.number().int().nonnegative(),
  })
  .strict();
export const actionSchema = z
  .object({
    operationId: id,
    observationId: id,
    target: id,
    kind: z.enum(["click", "fill", "scroll"]),
    text: text.optional(),
    expectedValue: text.optional(),
    dy: z.number().int().min(-1000).max(1000).optional(),
    intent: z.enum(["read-navigation", "edit-field", "scroll"]),
    postcondition: condition.optional(),
  })
  .strict()
  .superRefine((a, c) => {
    if (
      (a.kind === "fill" &&
        (a.text === undefined ||
          a.expectedValue === undefined ||
          a.intent !== "edit-field")) ||
      (a.kind === "scroll" && (a.dy === undefined || a.intent !== "scroll")) ||
      (a.kind === "click" && a.intent !== "read-navigation")
    )
      c.addIssue({ code: "custom", message: "action-arguments-mismatch" });
  });
export const receiptSchema = z
  .object({
    accepted: z.boolean(),
    delivery: z.enum(["not-sent", "synthetic-dispatched", "unknown"]),
    outcome: z.enum(["observed", "not-observed", "unknown"]),
    reason: z.string().max(1000),
    after: observationSchema.optional(),
  })
  .strict();
export const readOptions = z
  .object({
    packId: id.optional(),
    packRevision: revision.optional(),
    effectiveRevision: revision.optional(),
    roles: z.array(id).max(64).optional(),
    kinds: z
      .array(z.enum(["text", "link", "state"]))
      .max(3)
      .default(["text", "link", "state"]),
    within: id.optional(),
    offset: z.number().int().min(0).max(6400).default(0),
    limit: z.number().int().min(1).max(100).default(20),
    maxBytes: z.number().int().min(1024).max(524288).default(32768),
  })
  .strict();
export const apiSchemas = {
  status: z.object({}).strict(),
  observe: z.object({ read: readOptions.optional() }).strict(),
  read: readOptions.extend({ observationId: id.optional() }).strict(),
  capabilities: z
    .object({
      observationId: id.optional(),
      purpose: z.enum(["read", "act", "manage", "all"]).default("all"),
    })
    .strict(),
  observationRead: z.object({ observationId: id }).strict(),
  observationHistory: z.object({}).strict(),
  observationDiff: z.object({ before: id, after: id }).strict(),
  contentSave: z
    .object({
      observationId: id,
      name: z.string().min(1).max(200),
      read: readOptions.default({}),
    })
    .strict(),
  contentList: z.object({}).strict(),
  contentRead: z.object({ id }).strict(),
  act: actionSchema,
  operation: z.object({ operationId: id }).strict(),
  cancel: z.object({ operationId: id }).strict(),
  packs: z.object({}).strict(),
  packGet: z.object({ id }).strict(),
  packDraft: z
    .object({ pack: packSchema, expected: revision.nullable() })
    .strict(),
  packPropose: z
    .object({
      id,
      name: z.string().min(1).max(200),
      observationId: id,
      target: id,
    })
    .strict(),
  packTest: z.object({ id, revision }).strict(),
  packActivate: z
    .object({
      id,
      revision,
      acknowledgePermissions: z
        .array(z.enum(["read", "fill", "click", "scroll"]))
        .max(4)
        .default([]),
    })
    .strict(),
  packDeactivate: z.object({ id, expected: revision }).strict(),
  packContext: z
    .object({
      observationId: id,
      offset: z.number().int().min(0).max(4096).default(0),
      limit: z.number().int().min(1).max(16).default(4),
      maxBytes: z.number().int().min(1024).max(524288).default(65536),
    })
    .strict(),
  packRun: z
    .object({
      id,
      procedure: id,
      operationId: id,
      arguments: argumentsSchema.default({}),
    })
    .strict(),
  packExport: z.object({ id, revision }).strict(),
  packImport: z
    .object({ pack: packSchema, expected: revision.nullable() })
    .strict(),
  packUpdatePreview: z.object({ id, pack: packSchema }).strict(),
};
