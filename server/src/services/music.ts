import { prisma } from "../lib/prisma.js";

/** Royalty-free / demo placeholders — replace with licensed sources in production */
export const DEMO_TRACKS = [
  {
    trackId: "demo-1",
    title: "Nebula Drift",
    artist: "Aether Demo",
    artworkUrl: null as string | null,
    durationMs: 180000,
    source: "demo",
  },
  {
    trackId: "demo-2",
    title: "Study Pulse",
    artist: "Aether Demo",
    artworkUrl: null,
    durationMs: 210000,
    source: "demo",
  },
  {
    trackId: "demo-3",
    title: "Night Circuit",
    artist: "Aether Demo",
    artworkUrl: null,
    durationMs: 195000,
    source: "demo",
  },
];

export async function parseMusicCommand(channelId: string, userId: string, text: string) {
  const raw = text.trim();
  const lower = raw.toLowerCase();

  if (lower === "!queue" || lower.includes("what's the queue") || lower.includes("show queue")) {
    const queue = await prisma.musicQueueItem.findMany({
      where: { channelId },
      orderBy: { position: "asc" },
    });
    return { action: "queue", queue };
  }

  if (lower === "!clear" || lower.includes("clear the queue")) {
    await prisma.musicQueueItem.deleteMany({ where: { channelId } });
    return { action: "clear", queue: [] };
  }

  if (lower.startsWith("!skip") || lower === "skip" || lower.includes("skip this")) {
    const first = await prisma.musicQueueItem.findFirst({
      where: { channelId },
      orderBy: { position: "asc" },
    });
    if (first) await prisma.musicQueueItem.delete({ where: { id: first.id } });
    const queue = await prisma.musicQueueItem.findMany({
      where: { channelId },
      orderBy: { position: "asc" },
    });
    return { action: "skip", queue };
  }

  const playMatch =
    lower.match(/^!play\s+(.+)/) ||
    lower.match(/^play\s+(.+)/) ||
    lower.match(/play\s+(something\s+)?(.+)/);

  if (playMatch || lower.includes("play ")) {
    const query = (playMatch?.[1] || playMatch?.[2] || raw).replace(/^!play\s*/i, "").trim();
    const track =
      DEMO_TRACKS.find(
        (t) =>
          t.title.toLowerCase().includes(query.toLowerCase()) ||
          (query.toLowerCase().includes("study") && t.trackId === "demo-2") ||
          (query.toLowerCase().includes("relax") && t.trackId === "demo-1") ||
          (query.toLowerCase().includes("energy") && t.trackId === "demo-3")
      ) || DEMO_TRACKS[0];

    const maxPos = await prisma.musicQueueItem.aggregate({
      where: { channelId },
      _max: { position: true },
    });
    const item = await prisma.musicQueueItem.create({
      data: {
        channelId,
        trackId: track.trackId,
        title: track.title,
        artist: track.artist,
        artworkUrl: track.artworkUrl,
        durationMs: track.durationMs,
        source: track.source,
        requestedBy: userId,
        position: (maxPos._max.position ?? -1) + 1,
      },
    });
    const queue = await prisma.musicQueueItem.findMany({
      where: { channelId },
      orderBy: { position: "asc" },
    });
    return {
      action: "play",
      message: `Queued **${track.title}** by ${track.artist} (demo catalog — royalty-free placeholder).`,
      item,
      queue,
    };
  }

  return {
    action: "help",
    message:
      "Music commands: !play <mood/title>, !skip, !queue, !clear. Natural language also works. Uses demo/royalty-free catalog only.",
  };
}
