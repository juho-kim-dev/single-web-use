import { readJSON } from "./storage.js";
import { homedir } from "node:os";
import path from "node:path";
export const dataRoot = () =>
  path.resolve(process.env.SWU_HOME ?? path.join(homedir(), ".paw-swu"));
export async function config() {
  return readJSON(path.join(dataRoot(), "connector.json"));
}
export async function call(method, args = {}, { timeout = 120000 } = {}) {
  const c = await config();
  const response = await fetch(`http://127.0.0.1:${c.port}/api`, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      authorization: `Bearer ${c.token}`,
    },
    body: JSON.stringify({ method, args }),
    signal: AbortSignal.timeout(timeout),
  });
  const result = await response.json();
  if (result.error) throw Error(result.error);
  return result.result;
}
