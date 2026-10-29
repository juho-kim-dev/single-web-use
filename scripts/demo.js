import http from "node:http";
import { readFile } from "node:fs/promises";
const html = await readFile(new URL("../examples/demo.html", import.meta.url));
const container = await readFile(
  new URL("../examples/reading.html", import.meta.url),
);
http
  .createServer((req, res) => {
    res.setHeader("content-type", "text/html; charset=utf-8");
    res.end(
      req.url === "/container"
        ? container
        : req.url === "/reading"
          ? '<!doctype html><title>SWU reading fixture</title><h1>Local navigation outcome</h1><p>This is a synthetic page.</p><a href="/">Back to demo</a>'
          : html,
    );
  })
  .listen(47832, "127.0.0.1", () =>
    console.log("Synthetic demo: http://127.0.0.1:47832/ (Ctrl+C to stop)"),
  );
