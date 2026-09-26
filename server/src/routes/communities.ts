import { Router } from "express";
import { z } from "zod";
import { prisma } from "../lib/prisma.js";
import { requireAuth, AuthRequest } from "../middleware/auth.js";
import { getMemberRole, roleAtLeast } from "../services/permissions.js";

const router = Router();

function slugify(name: string) {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 48);
}

router.get("/", requireAuth, async (req: AuthRequest, res, next) => {
  try {
    const memberships = await prisma.communityMember.findMany({
      where: { userId: req.userId! },
      include: {
        community: {
          include: {
            channels: { orderBy: { position: "asc" } },
            members: {
              include: {
                user: {
                  select: {
                    id: true,
                    username: true,
                    displayName: true,
                    avatarUrl: true,
                    status: true,
                  },
                },
              },
            },
          },
        },
      },
    });
    res.json({ communities: memberships.map((m) => m.community) });
  } catch (e) {
    next(e);
  }
});

router.get("/discover", requireAuth, async (_req, res, next) => {
  try {
    const list = await prisma.community.findMany({
      where: { visibility: "PUBLIC" },
      take: 50,
      orderBy: { createdAt: "desc" },
      select: {
        id: true,
        name: true,
        slug: true,
        description: true,
        iconUrl: true,
        _count: { select: { members: true } },
      },
    });
    res.json({ communities: list });
  } catch (e) {
    next(e);
  }
});

router.post("/", requireAuth, async (req: AuthRequest, res, next) => {
  try {
    const schema = z.object({
      name: z.string().min(2).max(64),
      description: z.string().max(500).optional(),
      visibility: z.enum(["PUBLIC", "PRIVATE"]).optional(),
    });
    const body = schema.parse(req.body);
    let slug = slugify(body.name);
    const clash = await prisma.community.findUnique({ where: { slug } });
    if (clash) slug = `${slug}-${Date.now().toString(36)}`;

    const community = await prisma.community.create({
      data: {
        name: body.name,
        slug,
        description: body.description,
        visibility: body.visibility || "PUBLIC",
        ownerId: req.userId!,
        members: { create: { userId: req.userId!, role: "OWNER" } },
        channels: {
          create: [
            { name: "general", type: "TEXT", position: 0 },
            { name: "voice", type: "VOICE", position: 1 },
            { name: "ai-assistant", type: "AI", position: 2 },
            { name: "music", type: "MUSIC", position: 3 },
          ],
        },
      },
      include: { channels: true, members: true },
    });
    res.status(201).json({ community });
  } catch (e) {
    next(e);
  }
});

router.post("/:id/join", requireAuth, async (req: AuthRequest, res, next) => {
  try {
    const community = await prisma.community.findUnique({ where: { id: req.params.id } });
    if (!community) return res.status(404).json({ error: "Not found" });
    if (community.visibility === "PRIVATE") {
      return res.status(403).json({ error: "Private community — use an invite" });
    }
    const ban = await prisma.communityBan.findUnique({
      where: { communityId_userId: { communityId: community.id, userId: req.userId! } },
    });
    if (ban) return res.status(403).json({ error: "You are banned" });

    await prisma.communityMember.upsert({
      where: { communityId_userId: { communityId: community.id, userId: req.userId! } },
      create: { communityId: community.id, userId: req.userId!, role: "MEMBER" },
      update: {},
    });
    res.json({ ok: true });
  } catch (e) {
    next(e);
  }
});

router.post("/:id/leave", requireAuth, async (req: AuthRequest, res, next) => {
  try {
    const role = await getMemberRole(req.userId!, req.params.id);
    if (role === "OWNER") {
      return res.status(400).json({ error: "Owner cannot leave — transfer ownership or delete" });
    }
    await prisma.communityMember.deleteMany({
      where: { communityId: req.params.id, userId: req.userId! },
    });
    res.json({ ok: true });
  } catch (e) {
    next(e);
  }
});

router.post("/:id/invites", requireAuth, async (req: AuthRequest, res, next) => {
  try {
    const role = await getMemberRole(req.userId!, req.params.id);
    if (!roleAtLeast(role, "MODERATOR")) return res.status(403).json({ error: "Forbidden" });
    const code = Math.random().toString(36).slice(2, 10);
    const invite = await prisma.invite.create({
      data: {
        code,
        communityId: req.params.id,
        createdBy: req.userId!,
        maxUses: req.body?.maxUses ?? null,
        expiresAt: req.body?.expiresAt ? new Date(req.body.expiresAt) : null,
      },
    });
    res.status(201).json({ invite });
  } catch (e) {
    next(e);
  }
});

router.post("/invites/:code/accept", requireAuth, async (req: AuthRequest, res, next) => {
  try {
    const invite = await prisma.invite.findUnique({ where: { code: req.params.code } });
    if (!invite) return res.status(404).json({ error: "Invalid invite" });
    if (invite.expiresAt && invite.expiresAt < new Date()) {
      return res.status(410).json({ error: "Invite expired" });
    }
    if (invite.maxUses != null && invite.uses >= invite.maxUses) {
      return res.status(410).json({ error: "Invite exhausted" });
    }
    await prisma.communityMember.upsert({
      where: {
        communityId_userId: { communityId: invite.communityId, userId: req.userId! },
      },
      create: { communityId: invite.communityId, userId: req.userId!, role: "MEMBER" },
      update: {},
    });
    await prisma.invite.update({
      where: { id: invite.id },
      data: { uses: { increment: 1 } },
    });
    res.json({ ok: true, communityId: invite.communityId });
  } catch (e) {
    next(e);
  }
});

export default router;
