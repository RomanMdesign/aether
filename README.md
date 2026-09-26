# Aether

Cinematic community platform — real-time chat, communities, WebRTC voice/video signaling, AI assistant hooks, and a legal music queue architecture.

**Not affiliated with Discord.** Original branding and UI.

## Stack

- **Frontend:** React + Vite + Zustand + Socket.IO client
- **Backend:** Node.js + Express + Socket.IO + Prisma
- **Database:** PostgreSQL
- **Realtime:** WebSocket (chat, presence) + WebRTC signaling (voice/video mesh)

## Quick start (local)

### Requirements

- Node.js 20+
- Docker (for Postgres) or a local PostgreSQL instance

### Setup

```bash
docker compose up -d
npm install
cp .env.example server/.env
# Edit server/.env — set JWT_SECRET at minimum

npm run db:push
npm run db:seed
npm run dev
```

- Client: http://localhost:5173  
- API: http://localhost:4000  

### Demo accounts (after seed)

| Email | Password |
|-------|----------|
| alice@aether.local | password123 |
| bob@aether.local | password123 |

## Deploy on Render

This repo includes `render.yaml` for a Blueprint deploy.

### One-time steps

1. Go to [https://dashboard.render.com](https://dashboard.render.com) and sign in.
2. **New → Blueprint** → connect the GitHub repo **RomanMdesign/aether**.
3. Apply the Blueprint (creates Postgres + `aether-api` + `aether-web`).
4. After the first deploy, open each service and set env vars:

**aether-api**

| Key | Value |
|-----|--------|
| `CLIENT_URL` | `https://<aether-web-service>.onrender.com` |
| `OPENAI_API_KEY` | (optional) your OpenAI key |

**aether-web** (build-time env)

| Key | Value |
|-----|--------|
| `VITE_API_URL` | `https://<aether-api-service>.onrender.com` |
| `VITE_WS_URL` | `https://<aether-api-service>.onrender.com` |

5. **Manual Deploy** both services after setting env vars (frontend must rebuild with `VITE_*`).
6. (Optional) Seed demo users — from your machine:

```bash
export DATABASE_URL="postgresql://...from Render dashboard..."
cd server && npm install && npm run db:seed
```

### Manual setup (without Blueprint)

1. **New → PostgreSQL** → copy Internal Database URL.
2. **New → Web Service** from this repo  
   - Root directory: `server`  
   - Build: `npm install && npx prisma generate && npx prisma db push && npm run build`  
   - Start: `npm run start`  
   - Health check path: `/api/health`
3. **New → Static Site** from this repo  
   - Root directory: `client`  
   - Build: `npm install && npm run build`  
   - Publish: `dist`  
   - Add rewrite: `/*` → `/index.html`

### Notes

- Free web services **sleep** when idle; first load can be slow and WebSockets may reconnect.
- For stable chat/voice, use a paid web plan.
- Voice uses browser WebRTC; add a TURN server for strict networks.

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

See `.env.example` and `render.yaml`.

## License

MIT — use and modify freely. Keep third-party API terms in mind.
