import "dotenv/config";
import http from "http";
import { createApp } from "./app.js";
import { initSocket } from "./socket/index.js";
import { config } from "./config.js";

const app = createApp();
const server = http.createServer(app);
initSocket(server);

server.listen(config.port, () => {
  console.log(`Aether API + WS on http://localhost:${config.port}`);
});
