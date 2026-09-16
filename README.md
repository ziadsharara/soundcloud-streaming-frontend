# SoundStream frontend

Vue 3 portal for shared listening rooms, built on the Koda design system (paper and ink, wobbly
borders, hard offset shadows, drawn marks).

## Features

- Join with a name and one of twelve drawn avatars; the room shows who is listening.
- Create or join a room by code or invite URL.
- Queue SoundCloud, Spotify and Anghami links, each labelled with how far it can be synced.
- Synchronized playback with a host-managed queue visible to everyone.
- Chat with stickers and an emoji picker; messages carry the sender's name and face.
- Optional, host-only Spotify connect for browsing your own playlists and liked songs.
- Hosts can delete their rooms from the Live rooms list.
- Instant playback-state recovery after reconnects, plus a manual sync control.
- Native invite sharing on supported phones, clipboard fallback everywhere else.
- Persistent light and dark modes; light is the default.

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
| `VITE_SPOTIFY_CLIENT_ID` | Optional, host-only Spotify library browsing |

Spotify sign-in uses PKCE in the browser, so no client secret is shipped. Spotify development-mode
apps admit five allow-listed Premium accounts, so treat it as a convenience for the host only.
Pasting Spotify links works without it.

See [DEPLOYMENT.md](DEPLOYMENT.md) for the Vercel + AWS setup.

## Verify

```bash
npm run build
npm test
docker build -t soundstream-frontend .
```
