# Vercel frontend + AWS backend

SoundStream needs one long-running HTTPS backend that supports both REST and WebSocket upgrades. Deploy the Spring Boot container to an AWS service that exposes a stable HTTPS hostname and forwards `/ws` upgrades (for example ECS or App Runner). Keep it to one instance while rooms are stored in memory.

## 1. Backend environment

Set these values on the AWS service:

```text
PORT=8080
FRONTEND_ORIGINS=https://soundcloud-streaming-frontend.vercel.app
```

The public backend must use HTTPS. Verify it before configuring Vercel:

```bash
curl https://<aws-backend-host>/actuator/health
curl https://<aws-backend-host>/api/rooms
```

The expected responses are `{"status":"UP"}` and a JSON room list.

## 2. Vercel environment

The current AWS URL is committed in `.env.production`. To point a Vercel project at a different backend, override it with this production environment variable:

```text
VITE_API_BASE_URL=https://<aws-backend-host>/api
```

The WebSocket URL is derived as `wss://<aws-backend-host>/ws`. If AWS exposes it on a different hostname, also set:

```text
VITE_WS_URL=wss://<websocket-host>/ws
```

Redeploy after changing either variable; Vite embeds them at build time.

## 3. Production smoke test

1. Open the Vercel site and confirm Live rooms loads without a 404.
2. Create a room with a public SoundCloud song, playlist, or album URL.
3. Open its invite link in a second browser.
4. Tune in once, then verify play, pause, seek, track changes, listener count, chat, and End stream.
