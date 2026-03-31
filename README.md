# HARD2KILL

Skill-based gaming platform where players compete in real-time PvP games with real money on the line.

## Project Structure

```
hard2kill/
├── platform/              💻 Main React App (routing, auth, UI)
├── server/                🌐 Main Express + Colyseus Server (API, proxies)
├── games/
│   ├── gladiatorz/        🎯 2D Top-Down Shooter (PIXI.js)
│   └── wasteland/         🎯 3D FPS (Three.js + Ammo.js)
└── shared/                📚 Shared code (Supabase client, types)
```

## Quick Start

### Install Dependencies

```bash
npm install
```

This will install dependencies for all workspaces.

### Development

Run all services in parallel:

```bash
npm run dev
```

Or run individually:

```bash
# Platform (React app)
npm run dev:platform

# Main server (proxies, API)
npm run dev:server

# GladiatorZ game server
npm run dev:gladiatorz

# Wasteland game server
npm run dev:wasteland
```

### Environment Variables

Copy `.env.example` to `.env` and fill in:

```env
# Supabase
SUPABASE_URL=your_supabase_url
SUPABASE_ANON_KEY=your_anon_key
SUPABASE_SERVICE_KEY=your_service_key

# Stripe
STRIPE_SECRET_KEY=your_stripe_key
STRIPE_WEBHOOK_SECRET=your_webhook_secret

# Ports (optional)
PORT=3000
GLADIATORZ_WS_PORT=3001
WASTELAND_WS_PORT=2567
```

## Games

### GladiatorZ
- **Type:** 2D top-down multiplayer shooter
- **Tech:** PIXI.js, Colyseus, React
- **Features:** Matchmaking, betting, leaderboard
- **Routes:** `/lobby`, `/new`, `/:roomId`

### Wasteland
- **Type:** 3D first-person shooter
- **Tech:** Three.js, Ammo.js (physics), Colyseus
- **Features:** Real-time multiplayer, pot system
- **Route:** `/three-fps` (iframe)

## Architecture

### Platform
React app that provides:
- Landing page with game selection
- Authentication (Supabase)
- Routing between games
- Shared UI components

### Server
Express + Colyseus server that handles:
- Static file serving
- WebSocket proxying to game servers
- Stripe payment webhooks
- API endpoints

### Games
Each game is self-contained with:
- **Client:** Game code (rendering, input, networking)
- **Server:** Colyseus room (game logic, state management)
- **Common:** Shared code between client/server (optional)

### Shared
Code used by all parts of the platform:
- Supabase client
- Helper functions (balance, transactions)
- Common types

## Development Workflow

### Adding a New Game

1. Create directory structure:
```bash
mkdir -p games/newgame/{client,server}
```

2. Add to workspaces in root `package.json`

3. Create `package.json` files for client and server

4. Add proxy in `server/src/index.ts`:
```typescript
app.use('/newgame-ws', createProxyMiddleware({
    target: `http://localhost:2568`,
    ws: true,
    changeOrigin: true,
}));
```

5. Add route in `platform/src/App.tsx`

6. Import shared Supabase client:
```typescript
import { supabase, getCurrentUser } from '@hard2kill/shared';
```

### Building for Production

```bash
npm run build
```

This will:
1. Build all game clients
2. Copy builds to `platform/public/`
3. Build platform
4. Server serves everything from one domain

## Tech Stack

- **Frontend:** React, TypeScript
- **Games:** PIXI.js, Three.js, Ammo.js
- **Networking:** Colyseus (WebSocket)
- **Auth/DB:** Supabase
- **Payments:** Stripe
- **Build:** esbuild, Webpack

## Deployment

Deploy as a single service:

1. Build all games: `npm run build`
2. Games are copied to `platform/public/`
3. Deploy `server/` + `platform/` together
4. Set environment variables on hosting platform

**Note:** Game servers can run on the same instance (different ports) or deployed separately with proxy configuration.

## Contributing

1. Work in your game's directory (`games/yourname/`)
2. Use shared Supabase client from `@hard2kill/shared`
3. Follow existing patterns for consistency
4. Test locally before committing

## License

Proprietary - HARD2KILL Platform
# hard2kill
