import "dotenv/config";

import { pathToFileURL } from "node:url";
import { app } from "./app";
import { startApiServer } from "./server-runtime";

async function main() {
  await startApiServer(app);
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  void main();
}
