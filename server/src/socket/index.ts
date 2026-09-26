import { Server as HttpServer } from "http";
import { Server } from "socket.io";
import { config } from "../config.js";
import { verifyToken } from "../lib/jwt.js";
import { prisma } from "../lib/prisma.js";
import { registerChatHandlers } from "./chat.js";
import { registerPresence } from "./presence.js";
import { registerWebRtc } from "./webrtc.js";

export let io: Server;

export function initSocket(server: HttpServer) {
  const allowedOrigins = [
    config.clientUrl,
    ...(process.env.CLIENT_URLS || "")
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean),
  ];

  io = new Server(server, {
    cors: { origin: allowedOrigins, credentials: true },
    transports: ["websocket", "polling"],
  });

  io.use(async (socket, next) => {
    try {
      const token = socket.handshake.auth?.token as string;
      if (!token) return next(new Error("Unauthorized"));
      const payload = verifyToken(token);
      socket.data.userId = payload.userId;
      next();
    } catch {
      next(new Error("Unauthorized"));
    }
  });

  io.on("connection", async (socket) => {
    const userId = socket.data.userId as string;
    socket.join(`user:${userId}`);

    await prisma.user.update({
      where: { id: userId },
      data: { status: "ONLINE" },
    });
    io.emit("presence:update", { userId, status: "ONLINE" });

    registerPresence(io, socket);
    registerChatHandlers(io, socket);
    registerWebRtc(io, socket);

    socket.on("disconnect", async () => {
      await prisma.user.update({
        where: { id: userId },
        data: { status: "OFFLINE" },
      });
      await prisma.voiceState.deleteMany({ where: { userId } });
      io.emit("presence:update", { userId, status: "OFFLINE" });
      io.emit("voice:left", { userId });
    });
  });
}
