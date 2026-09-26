# Aether

Cinematic community platform — real-time chat, communities, WebRTC voice/video signaling, AI assistant hooks, and a legal music queue architecture.

**Not affiliated with Discord.** Original branding and UI.

## Stack

- **Frontend:** React + Vite + Zustand + Socket.IO client
- **Backend:** Node.js + Express + Socket.IO + Prisma
- **Database:** PostgreSQL
- **Realtime:** WebSocket (chat, presence) + WebRTC signaling (voice/video mesh)

## Quick start

### Requirements

- Node.js 20+
- Docker (for Postgres) or a local PostgreSQL instance

### Setup

```bash
# Start Postgres
docker compose up -d

# Install dependencies
npm install

# Configure env
cp .env.example server/.env
# Edit server/.env — set JWT_SECRET at minimum

# Database
npm run db:push
npm run db:seed

# Run API + client
npm run dev
```

- Client: http://localhost:5173  
- API: http://localhost:4000  

### Demo accounts (after seed)

| Email | Password |
|-------|----------|
| alice@aether.local | password123 |
| bob@aether.local | password123 |

## Features (foundation)

- [x] Register / login / JWT sessions
- [x] Communities, channels (text / voice / AI / music)
- [x] Real-time messaging (Socket.IO)
- [x] Presence (online / offline)
- [x] WebRTC signaling (mesh voice join/leave/mute)
- [x] AI channel integration (OpenAI-compatible; optional API key)
- [x] Music queue model + command-oriented service (demo / royalty-free only)
- [ ] Production SFU (LiveKit/mediasoup) for large voice rooms
- [ ] TURN for NAT traversal
- [ ] Full moderation UI, DMs UI polish, file CDN

## Legal music

Do **not** stream copyrighted audio to multiple users from a single bot stream.  
Spotify Web API is for **user-linked Premium playback** only (see Spotify developer policy).  
Demo tracks must be royalty-free / CC0.

## Environment

See `.env.example`.

## License

MIT — use and modify freely. Keep third-party API terms in mind.
