import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { api } from "../lib/api";
import { getSocket } from "../lib/socket";
import { VoiceMesh } from "../lib/webrtc";
import { useAuth } from "../store/auth";

type Channel = {
  id: string;
  name: string;
  type: "TEXT" | "VOICE" | "AI" | "MUSIC";
  position: number;
};

type Community = {
  id: string;
  name: string;
  slug: string;
  channels: Channel[];
  members: {
    user: {
      id: string;
      username: string;
      displayName: string;
      avatarUrl?: string | null;
      status?: string;
    };
  }[];
};

type Message = {
  id: string;
  content: string;
  createdAt: string;
  author: { id: string; username: string; displayName: string };
  reactions?: { emoji: string; userId: string }[];
};

export default function AppShell() {
  const user = useAuth((s) => s.user)!;
  const logout = useAuth((s) => s.logout);

  const [communities, setCommunities] = useState<Community[]>([]);
  const [activeCommunityId, setActiveCommunityId] = useState<string | null>(null);
  const [activeChannelId, setActiveChannelId] = useState<string | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [draft, setDraft] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [voiceStatus, setVoiceStatus] = useState<string>("Disconnected");
  const [muted, setMuted] = useState(false);
  const [creating, setCreating] = useState(false);
  const [newName, setNewName] = useState("");

  const meshRef = useRef<VoiceMesh | null>(null);
  const audioContainerRef = useRef<HTMLDivElement>(null);

  const activeCommunity = useMemo(
    () => communities.find((c) => c.id === activeCommunityId) || null,
    [communities, activeCommunityId]
  );
  const activeChannel = useMemo(
    () => activeCommunity?.channels.find((c) => c.id === activeChannelId) || null,
    [activeCommunity, activeChannelId]
  );

  const loadCommunities = useCallback(async () => {
    const data = await api<{ communities: Community[] }>("/api/communities");
    setCommunities(data.communities);
    if (!activeCommunityId && data.communities[0]) {
      setActiveCommunityId(data.communities[0].id);
      const ch = data.communities[0].channels.find((c) => c.type === "TEXT") || data.communities[0].channels[0];
      if (ch) setActiveChannelId(ch.id);
    }
  }, [activeCommunityId]);

  useEffect(() => {
    loadCommunities().catch((e) => setError(e.message));
  }, [loadCommunities]);

  useEffect(() => {
    if (!activeChannelId) return;
    const socket = getSocket();
    socket.emit("channel:join", activeChannelId);

    api<{ messages: Message[] }>(`/api/messages/channel/${activeChannelId}`)
      .then((d) => setMessages(d.messages))
      .catch((e) => setError(e.message));

    const onNew = (msg: Message) => {
      setMessages((prev) => (prev.some((m) => m.id === msg.id) ? prev : [...prev, msg]));
    };
    const onDelete = ({ id }: { id: string }) => {
      setMessages((prev) => prev.filter((m) => m.id !== id));
    };

    socket.on("message:new", onNew);
    socket.on("message:delete", onDelete);

    return () => {
      socket.emit("channel:leave", activeChannelId);
      socket.off("message:new", onNew);
      socket.off("message:delete", onDelete);
    };
  }, [activeChannelId]);

  async function sendMessage() {
    if (!draft.trim() || !activeChannelId || !activeChannel) return;
    const text = draft.trim();
    setDraft("");

    if (activeChannel.type === "AI") {
      const history = messages.slice(-10).map((m) => ({
        role: m.author.id === user.id ? "user" : "assistant",
        content: m.content,
      }));
      history.push({ role: "user", content: text });
      const socket = getSocket();
      socket.emit("message:send", { channelId: activeChannelId, content: text }, () => {});
      try {
        const res = await api<{ message: { content: string } }>("/api/ai/chat", {
          method: "POST",
          body: JSON.stringify({ messages: history, channelId: activeChannelId }),
        });
        socket.emit("message:send", {
          channelId: activeChannelId,
          content: `🤖 ${res.message.content}`,
        });
      } catch (e) {
        setError(e instanceof Error ? e.message : "AI failed");
      }
      return;
    }

    if (activeChannel.type === "MUSIC" || text.startsWith("!")) {
      try {
        const res = await api<{ message?: string; action: string }>("/api/music/command", {
          method: "POST",
          body: JSON.stringify({ channelId: activeChannelId, text }),
        });
        getSocket().emit("message:send", {
          channelId: activeChannelId,
          content: res.message || `Music: ${res.action}`,
        });
      } catch (e) {
        setError(e instanceof Error ? e.message : "Music command failed");
      }
      return;
    }

    getSocket().emit("message:send", { channelId: activeChannelId, content: text }, (ack: { error?: string }) => {
      if (ack?.error) setError(ack.error);
    });
  }

  async function joinVoice() {
    if (!activeChannel || activeChannel.type !== "VOICE") return;
    const socket = getSocket();
    socket.emit("voice:join", { channelId: activeChannel.id }, async (ack: {
      error?: string;
      peers?: { userId: string }[];
      iceServers?: RTCIceServer[];
    }) => {
      if (ack?.error) {
        setError(ack.error);
        return;
      }
      try {
        const mesh = new VoiceMesh(ack.iceServers || [{ urls: "stun:stun.l.google.com:19302" }], (target, data) => {
          socket.emit("voice:signal", {
            channelId: activeChannel.id,
            targetUserId: target,
            data,
          });
        });
        mesh.onRemoteStream = (uid, stream) => {
          const el = document.createElement("audio");
          el.autoplay = true;
          el.srcObject = stream;
          el.dataset.uid = uid;
          audioContainerRef.current?.appendChild(el);
        };
        mesh.onPeerLeft = (uid) => {
          audioContainerRef.current?.querySelectorAll(`audio[data-uid="${uid}"]`).forEach((n) => n.remove());
        };
        await mesh.enableMedia(true, false);
        meshRef.current = mesh;
        setVoiceStatus("Connected");
        for (const p of ack.peers || []) {
          await mesh.connectTo(p.userId, user.id < p.userId);
        }
        socket.on("voice:signal", ({ fromUserId, data }) => {
          mesh.handleSignal(fromUserId, data);
        });
        socket.on("voice:peer-joined", async ({ userId: peerId }) => {
          if (peerId !== user.id) await mesh.connectTo(peerId, user.id < peerId);
        });
        socket.on("voice:peer-left", ({ userId: peerId }) => {
          mesh.closePeer(peerId);
        });
      } catch (e) {
        setError(e instanceof Error ? e.message : "Microphone permission denied");
        setVoiceStatus("Error");
      }
    });
  }

  function leaveVoice() {
    if (!activeChannel) return;
    getSocket().emit("voice:leave", { channelId: activeChannel.id });
    meshRef.current?.destroy();
    meshRef.current = null;
    if (audioContainerRef.current) audioContainerRef.current.innerHTML = "";
    setVoiceStatus("Disconnected");
  }

  function toggleMute() {
    const next = !muted;
    setMuted(next);
    meshRef.current?.setMuted(next);
    if (activeChannel?.type === "VOICE") {
      getSocket().emit("voice:state", { channelId: activeChannel.id, muted: next });
    }
  }

  async function createCommunity() {
    if (!newName.trim()) return;
    setCreating(true);
    try {
      await api("/api/communities", {
        method: "POST",
        body: JSON.stringify({ name: newName.trim() }),
      });
      setNewName("");
      await loadCommunities();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Create failed");
    } finally {
      setCreating(false);
    }
  }

  return (
    <div className="shell">
      <aside className="rail">
        {communities.map((c) => (
          <button
            key={c.id}
            className={`icon-btn ${c.id === activeCommunityId ? "active" : ""}`}
            title={c.name}
            onClick={() => {
              setActiveCommunityId(c.id);
              const ch = c.channels.find((x) => x.type === "TEXT") || c.channels[0];
              setActiveChannelId(ch?.id ?? null);
            }}
          >
            {c.name.slice(0, 2).toUpperCase()}
          </button>
        ))}
        <button className="icon-btn" title="New community" onClick={() => setNewName(prompt("Community name") || "")}>
          +
        </button>
      </aside>

      <aside className="sidebar">
        <h2>{activeCommunity?.name || "Aether"}</h2>
        {newName && (
          <div style={{ marginBottom: 12 }}>
            <input
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              placeholder="Name"
              style={{
                width: "100%",
                marginBottom: 6,
                background: "var(--bg-elevated)",
                border: "1px solid var(--border)",
                borderRadius: 8,
                color: "var(--text)",
                padding: 8,
              }}
            />
            <button className="btn" type="button" disabled={creating} onClick={createCommunity}>
              Create
            </button>
          </div>
        )}
        <div className="channel-list">
          {activeCommunity?.channels
            .slice()
            .sort((a, b) => a.position - b.position)
            .map((ch) => (
              <button
                key={ch.id}
                className={ch.id === activeChannelId ? "active" : ""}
                onClick={() => setActiveChannelId(ch.id)}
              >
                {ch.type === "VOICE" ? "🔊 " : ch.type === "AI" ? "✦ " : ch.type === "MUSIC" ? "♪ " : "# "}
                {ch.name}
              </button>
            ))}
        </div>
      </aside>

      <main className="main">
        {error && (
          <div style={{ padding: "8px 16px", background: "rgba(240,113,120,0.15)", color: "var(--danger)" }}>
            {error}
            <button className="btn ghost" style={{ marginLeft: 8, padding: "4px 8px" }} onClick={() => setError(null)}>
              dismiss
            </button>
          </div>
        )}

        {activeChannel?.type === "VOICE" && (
          <div className="voice-panel">
            <span>Voice: {voiceStatus}</span>
            <button className="btn" type="button" onClick={joinVoice}>
              Join
            </button>
            <button className="btn ghost" type="button" onClick={leaveVoice}>
              Leave
            </button>
            <button className="btn ghost" type="button" onClick={toggleMute}>
              {muted ? "Unmute" : "Mute"}
            </button>
            <div ref={audioContainerRef} />
          </div>
        )}

        <div className="msg-list">
          {messages.map((m) => (
            <div className="msg" key={m.id}>
              <div className="meta">
                <span className="author">{m.author.displayName}</span>
                {new Date(m.createdAt).toLocaleTimeString()}
              </div>
              <div>{m.content}</div>
            </div>
          ))}
          {!messages.length && (
            <p style={{ color: "var(--muted)" }}>
              {activeChannel?.type === "AI"
                ? "Ask the Aether assistant anything."
                : activeChannel?.type === "MUSIC"
                  ? "Try: !play study  ·  !queue  ·  !skip"
                  : "No messages yet. Say hello."}
            </p>
          )}
        </div>

        <div className="composer">
          <input
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                sendMessage();
              }
            }}
            placeholder={
              activeChannel
                ? `Message ${activeChannel.type === "TEXT" ? "#" : ""}${activeChannel.name}`
                : "Select a channel"
            }
            disabled={!activeChannel || activeChannel.type === "VOICE"}
          />
          <button className="btn" type="button" onClick={sendMessage} disabled={!draft.trim()}>
            Send
          </button>
        </div>
      </main>

      <aside className="members">
        <h3 style={{ margin: "0 0 12px", fontSize: 13, color: "var(--muted)" }}>MEMBERS</h3>
        {activeCommunity?.members.map((m) => (
          <div className="member-row" key={m.user.id}>
            <span className={`dot ${m.user.status === "ONLINE" ? "online" : ""}`} />
            {m.user.displayName}
          </div>
        ))}
      </aside>

      <footer className="userbar">
        <strong>{user.displayName}</strong>
        <span style={{ color: "var(--muted)", fontSize: 13 }}>@{user.username}</span>
        <span style={{ flex: 1 }} />
        <span style={{ fontSize: 12, color: "var(--muted)" }}>{voiceStatus}</span>
        <button className="btn ghost" type="button" onClick={logout}>
          Log out
        </button>
      </footer>
    </div>
  );
}
