import { Server, Socket } from "socket.io";
import { prisma } from "../lib/prisma.js";
import { canAccessChannel } from "../services/permissions.js";

export function registerChatHandlers(io: Server, socket: Socket) {
  const userId = socket.data.userId as string;

  socket.on("channel:join", async (channelId: string) => {
    if (!(await canAccessChannel(userId, channelId))) return;
    socket.join(`channel:${channelId}`);
  });

  socket.on("channel:leave", (channelId: string) => {
    socket.leave(`channel:${channelId}`);
  });

  socket.on("message:send", async (payload, ack) => {
    try {
      const { channelId, content, parentId } = payload as {
        channelId: string;
        content: string;
        parentId?: string;
      };
      if (!content?.trim()) return ack?.({ error: "Empty" });
      if (!(await canAccessChannel(userId, channelId))) {
        return ack?.({ error: "Forbidden" });
      }
      const msg = await prisma.message.create({
        data: {
          channelId,
          authorId: userId,
          content: content.trim().slice(0, 4000),
          parentId: parentId || null,
        },
        include: {
          author: {
            select: { id: true, username: true, displayName: true, avatarUrl: true },
          },
          reactions: true,
          attachments: true,
        },
      });
      io.to(`channel:${channelId}`).emit("message:new", msg);
      ack?.({ message: msg });
    } catch {
      ack?.({ error: "Failed" });
    }
  });

  socket.on("typing:start", ({ channelId }: { channelId: string }) => {
    socket.to(`channel:${channelId}`).emit("typing", { channelId, userId, typing: true });
  });

  socket.on("typing:stop", ({ channelId }: { channelId: string }) => {
    socket.to(`channel:${channelId}`).emit("typing", { channelId, userId, typing: false });
  });

  socket.on("message:edit", async ({ messageId, content }, ack) => {
    const existing = await prisma.message.findUnique({ where: { id: messageId } });
    if (!existing || existing.authorId !== userId) return ack?.({ error: "Forbidden" });
    const msg = await prisma.message.update({
      where: { id: messageId },
      data: { content: String(content).trim().slice(0, 4000), editedAt: new Date() },
      include: {
        author: { select: { id: true, username: true, displayName: true, avatarUrl: true } },
      },
    });
    if (msg.channelId) io.to(`channel:${msg.channelId}`).emit("message:update", msg);
    ack?.({ message: msg });
  });

  socket.on("message:delete", async ({ messageId }, ack) => {
    const existing = await prisma.message.findUnique({ where: { id: messageId } });
    if (!existing || existing.authorId !== userId) return ack?.({ error: "Forbidden" });
    await prisma.message.update({
      where: { id: messageId },
      data: { deletedAt: new Date(), content: "" },
    });
    if (existing.channelId) {
      io.to(`channel:${existing.channelId}`).emit("message:delete", { id: messageId });
    }
    ack?.({ ok: true });
  });

  socket.on("reaction:toggle", async ({ messageId, emoji }, ack) => {
    const existing = await prisma.reaction.findUnique({
      where: { messageId_userId_emoji: { messageId, userId, emoji } },
    });
    if (existing) {
      await prisma.reaction.delete({ where: { id: existing.id } });
    } else {
      await prisma.reaction.create({ data: { messageId, userId, emoji } });
    }
    const message = await prisma.message.findUnique({
      where: { id: messageId },
      include: { reactions: true },
    });
    if (message?.channelId) {
      io.to(`channel:${message.channelId}`).emit("message:reactions", {
        messageId,
        reactions: message.reactions,
      });
    }
    ack?.({ ok: true });
  });
}
