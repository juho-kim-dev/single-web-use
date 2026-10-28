import { cpSync, mkdirSync } from "node:fs";
mkdirSync("dist/extension", { recursive: true });
cpSync("extension", "dist/extension", { recursive: true });
console.log("Built dist/extension. Connector runs directly from src/cli.js.");
