import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";

const prisma = new PrismaClient();

async function main() {
  const passwordHash = await bcrypt.hash("password123", 12);

  const alice = await prisma.user.upsert({
    where: { email: "alice@aether.local" },
    update: {},
    create: {
      email: "alice@aether.local",
      username: "alice",
      displayName: "Alice",
      passwordHash,
    },
  });

  const bob = await prisma.user.upsert({
    where: { email: "bob@aether.local" },
    update: {},
    create: {
      email: "bob@aether.local",
      username: "bob",
      displayName: "Bob",
      passwordHash,
    },
  });

  const existing = await prisma.community.findUnique({ where: { slug: "aether-lounge" } });
  if (existing) {
    console.log("Seed already applied");
    return;
  }

  const community = await prisma.community.create({
    data: {
      name: "Aether Lounge",
      slug: "aether-lounge",
      description: "Demo community for Aether",
      ownerId: alice.id,
      members: {
        create: [
          { userId: alice.id, role: "OWNER" },
          { userId: bob.id, role: "MEMBER" },
        ],
      },
      channels: {
        create: [
          { name: "general", type: "TEXT", position: 0 },
          { name: "voice-lobby", type: "VOICE", position: 1 },
          { name: "aether-ai", type: "AI", position: 2 },
          { name: "jukebox", type: "MUSIC", position: 3 },
        ],
      },
    },
  });

  console.log("Seeded users alice/bob (password123) and community", community.slug);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
