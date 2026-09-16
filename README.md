# SoundStream frontend

Vue 3 portal for shared listening rooms, built on the Koda design system (paper and ink, wobbly
borders, hard offset shadows, drawn marks).

## Features

- Join with a name and one of twelve drawn avatars; the room shows who is listening.
- Create or join a room by code or invite URL.
- Queue SoundCloud, YouTube Music and YouTube links.
- Synchronized playback with a host-managed queue visible to everyone.
- Chat with stickers and an emoji picker; messages carry the sender's name and face.
- Hosts can delete their rooms from the Live rooms list.
- Instant playback-state recovery after reconnects, plus a manual sync control.
- Native invite sharing on supported phones, clipboard fallback everywhere else.
- Persistent light and dark modes; light is the default.
- Installable as an app on phones and desktops (PWA), with an offline-ready shell.

## Run locally

```bash
npm ci
npm run dev
```

Vite proxies `/api` and `/ws` to the backend on port `8080`. To use another local backend port:

```bash
BACKEND_PORT=8081 npm run dev
```

## Configuration

| Variable | Purpose |
|---|---|
| `VITE_API_BASE_URL` | `/api` behind a proxy, or a full HTTPS backend URL including `/api` |
| `VITE_WS_URL` | Optional; derived from the API origin when omitted |

See [DEPLOYMENT.md](DEPLOYMENT.md) for the Vercel + AWS setup.

## Installing as an app

The build ships a web app manifest and a service worker, so Chrome, Edge and Android offer
**Install app** (the button in the header appears once the browser says it qualifies). iOS Safari
has no install prompt, so the same button shows the Share → Add to Home Screen instruction instead.

The service worker only runs in a real build — use `npm run preview`, not `npm run dev`, to exercise
it. The API and the WebSocket are never cached: rooms are live, and a cached room is a wrong room.

Icons live in `public/` and are generated from `public/icon.svg`.

## Verify

```bash
npm run build
npm test
docker build -t soundstream-frontend .
```
