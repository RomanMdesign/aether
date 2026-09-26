import { Server, Socket } from "socket.io";
import { prisma } from "../lib/prisma.js";
import { canAccessChannel } from "../services/permissions.js";
import { config } from "../config.js";

export function registerWebRtc(io: Server, socket: Socket) {
  const userId = socket.data.userId as string;

  socket.on("voice:join", async ({ channelId }, ack) => {
    if (!(await canAccessChannel(userId, channelId))) {
      return ack?.({ error: "Forbidden" });
    }
    const channel = await prisma.channel.findUnique({ where: { id: channelId } });
    if (!channel || channel.type !== "VOICE") return ack?.({ error: "Not a voice channel" });

    await prisma.voiceState.upsert({
      where: { channelId_userId: { channelId, userId } },
      create: { channelId, userId },
      update: {},
    });

    socket.join(`voice:${channelId}`);
    const peers = await prisma.voiceState.findMany({
      where: { channelId },
      include: {
        user: { select: { id: true, username: true, displayName: true, avatarUrl: true } },
      },
    });

    socket.to(`voice:${channelId}`).emit("voice:peer-joined", {
      userId,
      user: peers.find((p) => p.userId === userId)?.user,
    });

    ack?.({
      peers: peers.filter((p) => p.userId !== userId),
      iceServers: [{ urls: config.stunUrls }],
    });
  });

  socket.on("voice:leave", async ({ channelId }) => {
    await prisma.voiceState.deleteMany({ where: { channelId, userId } });
    socket.leave(`voice:${channelId}`);
    socket.to(`voice:${channelId}`).emit("voice:peer-left", { userId });
  });

  socket.on("voice:signal", ({ channelId, targetUserId, data }) => {
    io.to(`user:${targetUserId}`).emit("voice:signal", {
      fromUserId: userId,
      channelId,
      data,
    });
  });

  socket.on(
    "voice:state",
    async ({
      channelId,
      muted,
      deafened,
      video,
      sharing,
    }: {
      channelId: string;
      muted?: boolean;
      deafened?: boolean;
      video?: boolean;
      sharing?: boolean;
    }) => {
      await prisma.voiceState.updateMany({
        where: { channelId, userId },
        data: {
          ...(muted !== undefined && { muted }),
          ...(deafened !== undefined && { deafened }),
          ...(video !== undefined && { video }),
          ...(sharing !== undefined && { sharing }),
        },
      });
      socket.to(`voice:${channelId}`).emit("voice:state", {
        userId,
        muted,
        deafened,
        video,
        sharing,
      });
    }
  );
}
