import http from "node:http";
import { timingSafeEqual } from "node:crypto";
import { z } from "zod";
import { bindingSchema } from "./contracts.js";
const bridgeReply = z
  .object({
    session: z.string().uuid(),
    id: z.string().uuid(),
    result: z.unknown(),
  })
  .strict();
export function authorized(req, config) {
  if (req.headers.host !== `127.0.0.1:${config.port}`) return false;
  const origin = req.headers.origin;
  if (
    origin !== undefined &&
    origin !== `chrome-extension://${config.extensionId}`
  )
    return false;
  if (origin && req.headers["x-swu-extension"] !== config.extensionId)
    return false;
  const token = Buffer.from(req.headers.authorization ?? ""),
    expected = Buffer.from(`Bearer ${config.token}`);
  return token.length === expected.length && timingSafeEqual(token, expected);
}
async function body(req) {
  let size = 0,
    chunks = [];
  for await (const part of req) {
    size += part.length;
    if (size > 1024 * 1024) throw Error("body-too-large");
    chunks.push(part);
  }
  return JSON.parse(Buffer.concat(chunks).toString("utf8"));
}
export function createServer(runtime, config) {
  const server = http.createServer(async (req, res) => {
    res.setHeader("Cache-Control", "no-store");
    res.setHeader("Content-Type", "application/json");
    const origin = req.headers.origin;
    if (
      req.headers.host !== `127.0.0.1:${config.port}` ||
      (origin !== undefined &&
        origin !== `chrome-extension://${config.extensionId}`)
    ) {
      res.writeHead(403);
      res.end('{"error":"forbidden-origin-or-host"}');
      return;
    }
    if (origin) {
      res.setHeader("Access-Control-Allow-Origin", origin);
      res.setHeader("Vary", "Origin");
    }
    if (req.method === "OPTIONS") {
      if (!origin || req.headers["access-control-request-method"] !== "POST") {
        res.writeHead(403);
        res.end();
        return;
      }
      res.setHeader("Access-Control-Allow-Methods", "POST");
      res.setHeader(
        "Access-Control-Allow-Headers",
        "authorization,content-type,x-swu-extension",
      );
      res.writeHead(204);
      res.end();
      return;
    }
    if (!authorized(req, config)) {
      res.writeHead(403);
      res.end('{"error":"unauthorized"}');
      return;
    }
    if (
      req.method !== "POST" ||
      req.headers["content-type"] !== "application/json"
    ) {
      res.writeHead(415);
      res.end('{"error":"post-json-required"}');
      return;
    }
    try {
      const data = await body(req);
      let result;
      if (req.url.startsWith("/bridge/")) {
        if (origin !== `chrome-extension://${config.extensionId}`)
          throw Error("extension-origin-required");
        switch (req.url) {
          case "/bridge/bind":
            result = runtime.bind(bindingSchema.parse(data));
            break;
          case "/bridge/diagnostic": {
            const diagnostic = z.object({
              source: z.enum(["toolbar", "sidebar"]),
              eventUrlPresent: z.boolean(),
              queriedUrlPresent: z.boolean(),
            }).strict().parse(data);
            runtime.adapterDiagnostic = { ...diagnostic, at: Date.now() };
            result = { recorded: true };
            break;
          }
          case "/bridge/poll":
            result = runtime.poll(
              z.object({ session: z.string().uuid() }).strict().parse(data)
                .session,
            );
            break;
          case "/bridge/reply": {
            const r = bridgeReply.parse(data);
            result = runtime.reply(r.session, r.id, r.result);
            break;
          }
          case "/bridge/disconnect-owned":
            runtime.disconnect(
              "browser-disconnected",
              z
                .object({ expectedSession: z.string().uuid().nullable() })
                .strict()
                .parse(data).expectedSession,
            );
            result = { disconnected: true };
            break;
          default:
            throw Error("unknown-route");
        }
      } else if (req.url === "/api") {
        const r = z
          .object({ method: z.string().max(80), args: z.unknown() })
          .strict()
          .parse(data);
        result = await runtime.call(r.method, r.args);
      } else throw Error("unknown-route");
      res.end(JSON.stringify({ result }));
    } catch (e) {
      // Validation errors can echo private values; only fixed error codes leave this boundary.
      res.writeHead(400);
      res.end(
        JSON.stringify({
          error:
            e instanceof z.ZodError
              ? "invalid-request-schema"
              : String(e.message).slice(0, 200),
        }),
      );
    }
  });
  server.requestTimeout = 15000;
  server.headersTimeout = 5000;
  return server;
}
