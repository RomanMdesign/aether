import { Router } from "express";
import { z } from "zod";
import { prisma } from "../lib/prisma.js";
import { hashPassword, verifyPassword } from "../lib/password.js";
import { signToken } from "../lib/jwt.js";
import { requireAuth, AuthRequest } from "../middleware/auth.js";

const router = Router();

const registerSchema = z.object({
  email: z.string().email(),
  username: z.string().min(3).max(32).regex(/^[a-zA-Z0-9_]+$/),
  displayName: z.string().min(1).max(64),
  password: z.string().min(8).max(128),
});

router.post("/register", async (req, res, next) => {
  try {
    const body = registerSchema.parse(req.body);
    const exists = await prisma.user.findFirst({
      where: { OR: [{ email: body.email }, { username: body.username }] },
    });
    if (exists) return res.status(409).json({ error: "Email or username taken" });

    const user = await prisma.user.create({
      data: {
        email: body.email,
        username: body.username,
        displayName: body.displayName,
        passwordHash: await hashPassword(body.password),
      },
      select: { id: true, email: true, username: true, displayName: true, avatarUrl: true },
    });
    const token = signToken({ userId: user.id });
    res.status(201).json({ user, token });
  } catch (e) {
    next(e);
  }
});

router.post("/login", async (req, res, next) => {
  try {
    const { emailOrUsername, password } = req.body as {
      emailOrUsername?: string;
      password?: string;
    };
    if (!emailOrUsername || !password) {
      return res.status(400).json({ error: "Missing credentials" });
    }
    const user = await prisma.user.findFirst({
      where: {
        OR: [{ email: emailOrUsername }, { username: emailOrUsername }],
      },
    });
    if (!user || !(await verifyPassword(password, user.passwordHash))) {
      return res.status(401).json({ error: "Invalid credentials" });
    }
    const token = signToken({ userId: user.id });
    res.json({
      user: {
        id: user.id,
        email: user.email,
        username: user.username,
        displayName: user.displayName,
        avatarUrl: user.avatarUrl,
        bio: user.bio,
        status: user.status,
      },
      token,
    });
  } catch (e) {
    next(e);
  }
});

router.get("/me", requireAuth, async (req: AuthRequest, res, next) => {
  try {
    const user = await prisma.user.findUnique({
      where: { id: req.userId! },
      select: {
        id: true,
        email: true,
        username: true,
        displayName: true,
        avatarUrl: true,
        bio: true,
        status: true,
        customStatus: true,
      },
    });
    res.json({ user });
  } catch (e) {
    next(e);
  }
});

export default router;
