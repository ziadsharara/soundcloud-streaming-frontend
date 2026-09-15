# Vercel frontend + AWS backend

SoundStream needs one long-running HTTPS backend that supports both REST and WebSocket upgrades. Deploy the Spring Boot container to an AWS service that exposes a stable HTTPS hostname and forwards `/ws` upgrades (for example ECS or App Runner). Keep it to one instance while rooms and OAuth sessions are stored in memory.

## 1. Backend environment

Set these values on the AWS service:

```text
PORT=8080
FRONTEND_ORIGINS=https://soundcloud-streaming-frontend.vercel.app
SOUNDCLOUD_CLIENT_ID=<SoundCloud application client id>
SOUNDCLOUD_CLIENT_SECRET=<SoundCloud application client secret>
SOUNDCLOUD_REDIRECT_URI=https://<aws-backend-host>/api/auth/soundcloud/callback
```

The public backend must use HTTPS. Verify it before configuring Vercel:

```bash
curl https://<aws-backend-host>/actuator/health
curl https://<aws-backend-host>/api/rooms
```

The expected responses are `{"status":"UP"}` and a JSON room list.

## 2. SoundCloud application

Register a SoundCloud API application and add this exact callback URL:

```text
https://<aws-backend-host>/api/auth/soundcloud/callback
```

New SoundCloud API application registration requires an Artist Pro account. Do not put the client secret in Vercel or any `VITE_*` variable; Vite variables are public browser code.

## 3. Vercel environment

Add this production environment variable to the frontend project:

```text
VITE_API_BASE_URL=https://<aws-backend-host>/api
```

The WebSocket URL is derived as `wss://<aws-backend-host>/ws`. If AWS exposes it on a different hostname, also set:

```text
VITE_WS_URL=wss://<websocket-host>/ws
```

Redeploy after changing either variable; Vite embeds them at build time.

## 4. Production smoke test

1. Open the Vercel site and confirm Live rooms loads without a 404.
2. Connect SoundCloud and approve access.
3. Confirm Recently played, My playlists, Liked tracks, and Liked playlists load.
4. Create a room, play a track, and open its invite link in a second browser.
5. Tune in once, then verify play, pause, seek, track changes, listener count, chat, and End stream.
