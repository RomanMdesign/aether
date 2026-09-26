import { Router } from "express";
import { requireAuth, AuthRequest } from "../middleware/auth.js";
import { chatWithAi } from "../services/ai.js";
import { prisma } from "../lib/prisma.js";

const router = Router();

router.post("/chat", requireAuth, async (req: AuthRequest, res, next) => {
  try {
    const { messages, channelId } = req.body as {
      messages: { role: string; content: string }[];
      channelId?: string;
    };
    if (!Array.isArray(messages) || messages.length === 0) {
      return res.status(400).json({ error: "messages required" });
    }
    const reply = await chatWithAi(messages.slice(-20));
    if (channelId) {
      await prisma.aiConversation.upsert({
        where: { id: `${channelId}-${req.userId}` },
        create: {
          id: `${channelId}-${req.userId}`,
          channelId,
          userId: req.userId!,
          messages: [...messages, reply],
        },
        update: { messages: [...messages, reply] },
      }).catch(() => {});
    }
    res.json({ message: reply });
  } catch (e) {
    next(e);
  }
});

export default router;
