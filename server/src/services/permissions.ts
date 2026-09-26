import { prisma } from "../lib/prisma.js";

export async function canAccessChannel(userId: string, channelId: string): Promise<boolean> {
  const channel = await prisma.channel.findUnique({
    where: { id: channelId },
    include: { community: { include: { members: true, bans: true } } },
  });
  if (!channel) return false;
  if (!channel.communityId) return true;
  const banned = channel.community?.bans.some((b) => b.userId === userId);
  if (banned) return false;
  return !!channel.community?.members.some((m) => m.userId === userId);
}

export async function getMemberRole(userId: string, communityId: string) {
  const member = await prisma.communityMember.findUnique({
    where: { communityId_userId: { communityId, userId } },
  });
  return member?.role ?? null;
}

const rank: Record<string, number> = {
  OWNER: 4,
  ADMIN: 3,
  MODERATOR: 2,
  MEMBER: 1,
};

export function roleAtLeast(role: string | null, min: string) {
  if (!role) return false;
  return (rank[role] ?? 0) >= (rank[min] ?? 99);
}
