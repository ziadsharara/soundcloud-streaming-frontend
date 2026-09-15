# SoundStream frontend

Vue 3 streaming portal for shared SoundCloud listening rooms.

## Features

- Responsive live-room dashboard with persistent light and dark modes.
- Create or join a room by code or invite URL.
- Start a room with a public SoundCloud song, playlist, album, or share URL.
- Paste several public SoundCloud URLs and manage them with previous, next, remove, and clear queue controls.
- Synchronized playback, listener presence, and a host-managed queue visible to everyone.
- Live chat with recent history for people who join late or reconnect.
- Instant playback-state recovery after reconnects, plus a manual sync control.
- Native invite sharing on supported phones and a clipboard fallback everywhere else.
- Production API/WebSocket URLs configurable at build time.

## Run locally

```bash
npm ci
npm run dev
```

Vite proxies `/api` and `/ws` to the backend on port `8080`. To use another local backend port:

```bash
BACKEND_PORT=8081 npm run dev
```

For separate production origins, set `VITE_API_BASE_URL=https://api.example.com/api`. `VITE_WS_URL` is optional; when omitted it is derived from the API origin.

See [DEPLOYMENT.md](DEPLOYMENT.md) for the Vercel + AWS setup. Vercel builds now stop with a clear error when the production API URL is missing instead of deploying a frontend whose `/api` calls all return 404.

## Verify

```bash
npm run build
npm test
docker build -t soundcloud-streaming-frontend .
```
