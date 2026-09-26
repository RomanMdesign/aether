import { Router } from "express";
import { prisma } from "../lib/prisma.js";
import { requireAuth, AuthRequest } from "../middleware/auth.js";
import { canAccessChannel } from "../services/permissions.js";
import { parseMusicCommand, DEMO_TRACKS } from "../services/music.js";

const router = Router();

router.get("/queue/:channelId", requireAuth, async (req: AuthRequest, res, next) => {
  try {
    if (!(await canAccessChannel(req.userId!, req.params.channelId))) {
      return res.status(403).json({ error: "Forbidden" });
    }
    const items = await prisma.musicQueueItem.findMany({
      where: { channelId: req.params.channelId },
      orderBy: { position: "asc" },
    });
    res.json({ queue: items, demoCatalog: DEMO_TRACKS });
  } catch (e) {
    next(e);
  }
});

router.post("/command", requireAuth, async (req: AuthRequest, res, next) => {
  try {
    const { channelId, text } = req.body as { channelId?: string; text?: string };
    if (!channelId || !text) return res.status(400).json({ error: "channelId and text required" });
    if (!(await canAccessChannel(req.userId!, channelId))) {
      return res.status(403).json({ error: "Forbidden" });
    }
    const result = await parseMusicCommand(channelId, req.userId!, text);
    res.json(result);
  } catch (e) {
    next(e);
  }
});

export default router;
