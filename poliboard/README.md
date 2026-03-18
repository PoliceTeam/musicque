## PoliBoard Micro‑Frontend (`poliboard`)

This package is a **Vite + React + TypeScript micro‑frontend** exposed via **Module Federation** using `@originjs/vite-plugin-federation`.  
It is intended to be consumed by a host application as `poliboard/Board`.

**Key features:**
- Infinite canvas with zoom & pan
- Real-time collaborative drawing via Socket.IO
- Figma-style multiplayer cursors with usernames
- Eraser tool with adjustable sizes
- Midnight auto-reset countdown timer

---

### 1. Tech Stack

- Vite 5
- React 18 + TypeScript
- Native HTML5 Canvas (`CanvasRenderingContext2D`)
- `@originjs/vite-plugin-federation`
- `socket.io-client`

---

### 2. Local Development

From the repo root:

```bash
cd poliboard
npm install
npm run dev
```

The `dev` script runs:

- `vite build --watch` – continuously builds the remote bundle (including `remoteEntry.js`)
- `vite preview --port 5002 --strictPort` – serves the built bundle on `http://localhost:5002`

So the remote entry is available at:

```text
http://localhost:5002/assets/remoteEntry.js
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
        poliboard: 'http://localhost:5002/assets/remoteEntry.js',
      },
      shared: ['react', 'react-dom'],
    }),
  ],
})
```

Usage in the host React app:

```jsx
import React, { Suspense } from 'react'

const PoliBoardApp = React.lazy(() => import('poliboard/Board'))

export function PoliBoardPage({ username }) {
  return (
    <Suspense fallback={<div>Loading PoliBoard…</div>}>
      <PoliBoardApp roomId="my-room" username={username} />
    </Suspense>
  )
}
```

#### Props

| Prop       | Type     | Default           | Description                       |
|------------|----------|-------------------|-----------------------------------|
| `roomId`   | `string` | `'default-room'`  | Socket.IO room for collaboration  |
| `username` | `string` | `''`              | Display name shown on cursors     |

---

### 4. Environment Variables

This micro‑frontend needs the **Socket.IO server URL** to be available at runtime.

Preferred:

- `VITE_SOCKET_URL` – WebSocket base URL, e.g. `https://socket.your-domain.com`

Example pattern in the host app:

```js
// client/src/App.jsx
if (typeof window !== 'undefined') {
  window.__SOCKET_URL__ = import.meta.env.VITE_SOCKET_URL
}
```

Inside `poliboard`, the URL is resolved as:

```ts
const socketUrl =
  import.meta.env.VITE_SOCKET_URL ||
  (typeof window !== 'undefined' && window.__SOCKET_URL__) ||
  'http://localhost:5001'
```

Make sure the production environment sets `VITE_SOCKET_URL` (and that CORS on the socket server allows the host origin).

---

### 5. Production Build & Deployment

#### 5.1. Build the remote

```bash
cd poliboard
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
  - `https://your-domain.com/poliboard/assets/remoteEntry.js`

If you host under a sub‑path (e.g. `/poliboard/`), set `base` in `vite.config.ts`:

```ts
// poliboard/vite.config.ts
export default defineConfig({
  base: '/poliboard/',
  // existing config...
})
```

Then rebuild before deploying.

#### 5.3. Configure the host for production

Update the host federation config to point to the **deployed** URL:

```js
// client/vite.config.js
remotes: {
  poliboard: 'https://mf.your-domain.com/assets/remoteEntry.js',
},
```

or, if using a sub‑path:

```js
remotes: {
  poliboard: 'https://your-domain.com/poliboard/assets/remoteEntry.js',
},
```

Rebuild and deploy the host app after changing this.

---

### 6. Backend Dependencies

The PoliBoard UI expects a backend with:

- **Socket.IO** server handling:
  - `join-room` – joins a drawing room, returns existing strokes
  - `draw:start` / `draw:move` / `draw:end` – real-time stroke sync
  - `cursor:move` / `cursor:leave` – multiplayer cursor positions
  - `clear-board` – clears all strokes
- **Redis** (optional, falls back to in-memory) for stroke persistence with midnight TTL

Ensure:

- The host app's Socket.IO server is reachable from the browser.
- In production, `VITE_SOCKET_URL` points to the correct backend.

---

### 7. Quick Checklist for Deployment

1. Backend & Socket.IO server deployed and reachable from the host domain.
2. Redis server running (optional – falls back to in-memory store).
3. `VITE_SOCKET_URL` set for both host and micro‑frontend build environments.
4. `poliboard` built: `npm run build` → `dist/`.
5. `dist/` hosted at a stable public URL; verify `remoteEntry.js` is accessible.
6. Host app `client/vite.config.js` `remotes.poliboard` updated to that URL.
7. Host app rebuilt and deployed.

---

### 8. Dockerize & Deploy With `docker-compose`

#### 8.1. Dockerfile

The `poliboard/Dockerfile` is a multi‑stage build:

```dockerfile
FROM node:20.11-alpine AS build
WORKDIR /usr/src/app
COPY package*.json ./
RUN npm ci
COPY . .
ENV NODE_ENV=production
RUN npm run build

FROM nginx:alpine
COPY --from=build /usr/src/app/dist /usr/share/nginx/html
COPY nginx.conf /etc/nginx/conf.d/default.conf
EXPOSE 80
CMD ["nginx", "-g", "daemon off;"]
```

Build & run locally:

```bash
cd poliboard
docker build -t poliboard:latest .
docker run --rm -p 5002:80 poliboard:latest
```

Verify in the browser:

```text
http://localhost:5002/assets/remoteEntry.js
```

#### 8.2. Add a service to `docker-compose.yml`

```yaml
  poliboard:
    build:
      context: ./poliboard
      dockerfile: Dockerfile
    container_name: music-order-poliboard
    restart: always
    ports:
      - "5002:80"
    networks:
      - music-order-network
```

Bring everything up:

```bash
docker compose up -d --build
```

#### 8.3. Point the host to the deployed remote

Update the host federation config (`client/vite.config.js`) for production:

```js
remotes: {
  poliboard: 'http://YOUR_DOMAIN_OR_IP:5002/assets/remoteEntry.js',
},
```

Then rebuild & redeploy the host container/image.

> **Notes:**
> - The host cannot use Docker‑internal DNS like `http://poliboard/...` because the browser cannot resolve that.
> - In a real production setup, put a reverse proxy (Nginx/Traefik) in front and expose under the same domain, e.g. `https://your-domain.com/poliboard/assets/remoteEntry.js`.  
>   If you do that, also set `base: '/poliboard/'` in `vite.config.ts` and rebuild.
