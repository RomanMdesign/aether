import { Router } from "express";
import { prisma } from "../lib/prisma.js";
import { requireAuth, AuthRequest } from "../middleware/auth.js";
import { canAccessChannel } from "../services/permissions.js";

const router = Router();

router.get("/channel/:channelId", requireAuth, async (req: AuthRequest, res, next) => {
  try {
    const { channelId } = req.params;
    if (!(await canAccessChannel(req.userId!, channelId))) {
      return res.status(403).json({ error: "Forbidden" });
    }
    const limit = Math.min(Number(req.query.limit) || 50, 100);
    const before = req.query.before as string | undefined;
    const messages = await prisma.message.findMany({
      where: {
        channelId,
        deletedAt: null,
        ...(before ? { createdAt: { lt: new Date(before) } } : {}),
      },
      orderBy: { createdAt: "desc" },
      take: limit,
      include: {
        author: {
          select: { id: true, username: true, displayName: true, avatarUrl: true },
        },
        reactions: true,
        attachments: true,
      },
    });
    res.json({ messages: messages.reverse() });
  } catch (e) {
    next(e);
  }
});

export default router;
