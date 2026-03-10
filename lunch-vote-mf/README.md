## Lunch Vote Micro‑Frontend (`lunch-vote-mf`)

This package is a **Vite + React micro‑frontend** exposed via **Module Federation** using `@originjs/vite-plugin-federation`.  
It is intended to be consumed by a host application as `lunchVote/LunchVoteApp`.

---

### 1. Tech Stack

- Vite 5
- React 18
- Ant Design 5
- `@originjs/vite-plugin-federation`
- `socket.io-client`
- Axios

---

### 2. Local Development

From the repo root:

```bash
cd lunch-vote-mf
npm install
npm run dev
```

The `dev` script runs:

- `vite build --watch` – continuously builds the remote bundle (including `remoteEntry.js`)
- `vite preview --port 5006 --strictPort` – serves the built bundle on `http://localhost:5006`

So the remote entry is available at:

```text
http://localhost:5006/assets/remoteEntry.js
```

---

### 3. Using the Remote in the Host App

In the host Vite config (example: `client/vite.config.js`):

```js
import federation from '@originjs/vite-plugin-federation'

export default defineConfig({
  plugins: [
    react(),
    federation({
      name: 'client-host',
      remotes: {
        lunchVote: 'http://localhost:5006/assets/remoteEntry.js',
      },
      shared: ['react', 'react-dom', 'antd', 'react-router-dom'],
    }),
  ],
})
```

Usage in the host React app:

```js
import React, { Suspense } from 'react'

const LunchVoteApp = React.lazy(() => import('lunchVote/LunchVoteApp'))

export function LunchVotePage({ username }) {
  return (
    <Suspense fallback={<div>Loading Lunch Vote…</div>}>
      <LunchVoteApp username={username} />
    </Suspense>
  )
}
```

The `username` prop should come from the host app auth context.

---

### 4. Environment Variables

This micro‑frontend needs the **Socket.IO server URL** (and optionally API base) to be available at runtime.

Preferred:

- `VITE_SOCKET_URL` – WebSocket base URL, e.g. `https://socket.your-domain.com`

Example pattern in the host app:

```js
// client/src/App.jsx
if (typeof window !== 'undefined') {
  window.__SOCKET_URL__ = import.meta.env.VITE_SOCKET_URL
}
```

Inside `lunch-vote-mf`, the URL is resolved as:

```js
const socketUrl =
  import.meta.env.VITE_SOCKET_URL ||
  (typeof window !== 'undefined' && window.__SOCKET_URL__) ||
  ''
```

Make sure the production environment sets `VITE_SOCKET_URL` (and that CORS on the socket server allows the host origin).

---

### 5. Production Build & Deployment

#### 5.1. Build the remote

```bash
cd lunch-vote-mf
npm install
npm run build
```

This generates a `dist/` directory containing:

- `assets/remoteEntry.js` (Module Federation entry)
- Other JS/CSS assets
- `index.html` (only for standalone preview)

> In production, **only the built assets are needed** – the host app will dynamically load `remoteEntry.js`.

#### 5.2. Host the static assets

You can host `dist/` on any static file host:

- Nginx / Apache
- S3 + CloudFront
- Vercel / Netlify (static project)

Examples:

- As a subdomain:
  - `https://mf.your-domain.com/assets/remoteEntry.js`
- As a sub‑path:
  - `https://your-domain.com/lunch-vote/assets/remoteEntry.js`

If you host under a sub‑path (e.g. `/lunch-vote/`), set `base` in `vite.config.js`:

```js
// lunch-vote-mf/vite.config.js
export default defineConfig({
  base: '/lunch-vote/',
  // existing config...
})
```

Then rebuild before deploying.

#### 5.3. Configure the host for production

Update the host federation config to point to the **deployed** URL:

```js
// client/vite.config.js
remotes: {
  lunchVote: 'https://mf.your-domain.com/assets/remoteEntry.js',
},
```

or, if using a sub‑path:

```js
remotes: {
  lunchVote: 'https://your-domain.com/lunch-vote/assets/remoteEntry.js',
},
```

Rebuild and deploy the host app after changing this.

---

### 6. Backend Dependencies

The Lunch Vote UI expects a backend with routes similar to:

- `POST /api/lunch-vote/options`
- `GET  /api/lunch-vote/options/today`
- `POST /api/lunch-vote/options/:id/vote`

and a Socket.IO server that emits:

- `lunch_vote_updated` – broadcast when options or votes change

Ensure:

- The host app proxies `/api` to the backend in development.
- In production, the host app is configured to call the correct API base URL.

---

### 7. Quick Checklist for Deployment

1. Backend & Socket.IO server deployed and reachable from the host domain.
2. `VITE_SOCKET_URL` set for both host and micro‑frontend build environments.
3. `lunch-vote-mf` built: `npm run build` → `dist/`.
4. `dist/` hosted at a stable public URL; verify `remoteEntry.js` is accessible.
5. Host app `client/vite.config.js` `remotes.lunchVote` updated to that URL.
6. Host app rebuilt and deployed.

Once all steps are done, the host should be able to render `LunchVoteApp` remotely via `@lunch-vote-mf/`.

---

### 8. Dockerize & Deploy With `docker-compose`

If you want to deploy this micro‑frontend **together with the host app** (and backend) using Docker, the simplest approach is:

- Build the micro‑frontend into static assets (`dist/`)
- Serve `dist/` using **Nginx**
- Expose it as a public URL so the host can load `remoteEntry.js`

#### 8.1. Create `lunch-vote-mf/Dockerfile`

Create a multi‑stage Dockerfile like this:

```dockerfile
# ---- build stage ----
FROM node:20-alpine AS build
WORKDIR /app

COPY package*.json ./
RUN npm ci

COPY . .
RUN npm run build

# ---- runtime stage ----
FROM nginx:alpine

# Serve the built Vite assets
COPY --from=build /app/dist /usr/share/nginx/html

# Optional: basic SPA fallback (remote still works without it, but nice for direct access)
RUN printf '%s\n' \
  'server {' \
  '  listen 80;' \
  '  server_name _;' \
  '  root /usr/share/nginx/html;' \
  '  location / {' \
  '    try_files $uri $uri/ /index.html;' \
  '  }' \
  '}' > /etc/nginx/conf.d/default.conf
```

Then you can build & run the container:

```bash
cd lunch-vote-mf
docker build -t lunch-vote-mf:latest .
docker run --rm -p 5006:80 lunch-vote-mf:latest
```

Verify in the browser:

```text
http://localhost:5006/assets/remoteEntry.js
```

#### 8.2. Add a service to `docker-compose.yml`

In your repo `docker-compose.yml`, add a new service (example name: `lunch_vote_mf`):

```yaml
  lunch_vote_mf:
    build:
      context: ./lunch-vote-mf
      dockerfile: Dockerfile
    container_name: music-order-lunch-vote-mf
    restart: always
    ports:
      - "5006:80"
    networks:
      - music-order-network
```

Bring everything up:

```bash
docker compose up -d --build
```

#### 8.3. Point the host to the deployed remote

Because `remoteEntry.js` must be reachable **from the user’s browser**, your host app needs a public URL, for example:

- Local / single server: `http://<server-ip-or-domain>:5006/assets/remoteEntry.js`

Update the host federation config (`client/vite.config.js`) for production:

```js
remotes: {
  lunchVote: 'http://YOUR_DOMAIN_OR_IP:5006/assets/remoteEntry.js',
},
```

Then rebuild & redeploy the host container/image.

> Notes:
> - The host cannot use Docker‑internal DNS like `http://lunch_vote_mf/...` because the browser cannot resolve that.
> - In a real production setup, you’ll typically put **a reverse proxy (Nginx/Traefik)** in front and expose the micro‑frontend under the same domain, e.g. `https://your-domain.com/lunch-vote/assets/remoteEntry.js`.  
>   If you do that, also set `base: '/lunch-vote/'` in `lunch-vote-mf/vite.config.js` and rebuild.


