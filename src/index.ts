import "dotenv/config";
import { createServer } from "node:http";
import { loadConfig } from "./config.js";
import { createApp } from "./http/app.js";

const config = loadConfig();
const app = createApp(config);
const server = createServer(app);

server.listen(config.port, () => {
  console.log(`YNAB MCP server listening on ${config.publicBaseUrl.href}`);
});
