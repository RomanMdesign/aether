import express from "express";
import cors from "cors";
import helmet from "helmet";
import path from "path";
import fs from "fs";
import { config } from "./config.js";
import { errorHandler } from "./middleware/errorHandler.js";
import authRoutes from "./routes/auth.js";
import communitiesRoutes from "./routes/communities.js";
import messagesRoutes from "./routes/messages.js";
import aiRoutes from "./routes/ai.js";
import musicRoutes from "./routes/music.js";

export function createApp() {
  const app = express();
  fs.mkdirSync(config.uploadDir, { recursive: true });

  app.use(helmet({ crossOriginResourcePolicy: { policy: "cross-origin" } }));
  app.use(cors({ origin: config.clientUrl, credentials: true }));
  app.use(express.json({ limit: "1mb" }));
  app.use("/uploads", express.static(path.resolve(config.uploadDir)));

  app.get("/api/health", (_req, res) => res.json({ ok: true, name: "Aether" }));

  app.use("/api/auth", authRoutes);
  app.use("/api/communities", communitiesRoutes);
  app.use("/api/messages", messagesRoutes);
  app.use("/api/ai", aiRoutes);
  app.use("/api/music", musicRoutes);

  app.use(errorHandler);
  return app;
}
