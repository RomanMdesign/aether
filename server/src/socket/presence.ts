import { Server, Socket } from "socket.io";
import { prisma } from "../lib/prisma.js";

export function registerPresence(io: Server, socket: Socket) {
  const userId = socket.data.userId as string;

  socket.on("presence:set", async ({ status }: { status: "ONLINE" | "IDLE" | "DND" | "OFFLINE" }) => {
    await prisma.user.update({
      where: { id: userId },
      data: { status },
    });
    io.emit("presence:update", { userId, status });
  });
}
