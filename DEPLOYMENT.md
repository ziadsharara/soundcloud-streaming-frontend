# Vercel frontend + AWS backend

SoundStream needs one long-running HTTPS backend that supports both REST and WebSocket upgrades. Deploy the Spring Boot container to an AWS service that exposes a stable HTTPS hostname and forwards `/ws` upgrades (for example ECS or App Runner). Keep it to one instance while rooms are stored in memory.

## 1. Backend environment

Set these values on the AWS service:

```text
PORT=8080
FRONTEND_ORIGINS=https://soundstreaming.vercel.app
PUBLIC_FRONTEND_ORIGIN=https://soundstreaming.vercel.app
```

The public backend must use HTTPS. Verify it before configuring Vercel:

```bash
curl https://<aws-backend-host>/actuator/health
curl https://<aws-backend-host>/api/rooms
```

The expected responses are `{"status":"UP"}` and a JSON room list.

## 2. Vercel environment

Production uses a same-origin Vercel rewrite so every Vercel alias can reach AWS without a separate CORS update. Keep this production environment variable set to:

```text
VITE_API_BASE_URL=/api
```

The browser connects directly to the backend WebSocket. Keep this value set to the public backend endpoint:

```text
VITE_WS_URL=wss://<aws-backend-host>/ws
```

Deploy the backend first so it accepts the canonical origin, then redeploy the frontend. Vite embeds the frontend variables at build time.

## 3. Production smoke test

1. Open the Vercel site and confirm Live rooms loads without a 404.
2. Create a room, picking a name and an avatar, with a public SoundCloud song, playlist, or album URL.
3. Open its invite link in a second browser and join with a different name and avatar.
4. Verify play, pause, seek, track changes, the member list, chat, stickers, and End stream.
5. Queue a Spotify and an Anghami link and confirm each is labelled (preview-only, link-only).

If you set `VITE_SPOTIFY_CLIENT_ID`, add `https://<your-vercel-domain>/spotify/callback` to the
Spotify app's redirect URIs, or host-only library browsing will fail at the redirect.
