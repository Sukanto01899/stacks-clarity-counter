# Bitcoin Stamp NFT Chainhooks Monitoring Server

Real-time event monitoring for a Bitcoin Stamp NFT contract using Hiro Chainhooks (testnet/mainnet).

## Features

- Real-time event monitoring for mints, transfers, and burns
- Separate mint types (paid, free, owner)
- REST API for stats and historical events
- Webhook endpoints secured with a shared token
- Optional data fetch helper via Hiro Stacks API
- Simple STX faucet endpoint (testnet by default)

## Prerequisites

- Node.js v18+
- Either:
  - **Option A (recommended):** Hiro Chainhooks API access (`HIRO_API_KEY`)
  - **Option B:** a local Chainhook node running (HTTP API)

## Quickstart (Option A: Hiro testnet)

1. Create `.env` from the example:

```bash
cp .env.example .env
```

2. Edit `stacks-backend/.env`:

```env
STACKS_NETWORK=testnet
CHAINHOOK_PROVIDER=hiro
HIRO_API_KEY=your-hiro-api-key-here

# Must be publicly reachable by Hiro for webhook delivery (use ngrok/cloudflared)
EXTERNAL_URL=https://your-public-url

CHAINHOOK_AUTH_TOKEN=your-secret-token-here

CONTRACT_ADDRESS=ST1...
CONTRACT_NAME=bitcoin-stamp-nft
```

3. Run:

```bash
npm run dev
```

### Cloudflared tunnel (for `EXTERNAL_URL`)

Hiro needs to reach your webhook URL, so you’ll typically run a tunnel during local development:

```bash
npm run tunnel
```

Then set `EXTERNAL_URL` in `stacks-backend/.env` to the `https://...trycloudflare.com` URL printed by cloudflared.

## Option B (Local Chainhook node)

Set:

```env
STACKS_NETWORK=testnet
CHAINHOOK_PROVIDER=local
CHAINHOOK_NODE_URL=http://localhost:20456
EXTERNAL_URL=http://localhost:3000
CHAINHOOK_AUTH_TOKEN=your-secret-token-here
```

## API Endpoints

- `GET /health`
- `GET /api/stats`
- `GET /api/mints?limit=50&offset=0`
- `GET /api/transfers?limit=50&offset=0`
- `GET /api/activity/recent?limit=20`
- `GET /api/user/:address`
- `GET /api/faucet/status`
- `POST /api/faucet/claim`

### Fetch Tx (Hiro Stacks API)

- `GET /api/stacks/tx/:txid`

This fetches transaction JSON from Hiro Stacks API:
- Testnet: `https://api.testnet.hiro.so`
- Mainnet: `https://api.mainnet.hiro.so`

Controlled by `STACKS_NETWORK` or overridden via `STACKS_API_BASE_URL`.

### Faucet

Configure the faucet in `.env`:

```env
FAUCET_ENABLED=true
FAUCET_PRIVATE_KEY=your_testnet_private_key
FAUCET_ADDRESS=your_testnet_address
FAUCET_AMOUNT_STX=1
FAUCET_COOLDOWN_MINUTES=1440
FAUCET_IP_COOLDOWN_MINUTES=1440
```

Request STX:

```bash
curl -X POST http://localhost:3000/api/faucet/claim \
  -H "content-type: application/json" \
  -d "{\"address\":\"STX_ADDRESS\"}"
```

## Webhook Endpoints

- `POST /webhooks/paid-mint`
- `POST /webhooks/free-mint`
- `POST /webhooks/owner-mint`
- `POST /webhooks/transfer`
- `POST /webhooks/burn`

Auth:
- Local predicates can send `Authorization: Bearer <CHAINHOOK_AUTH_TOKEN>`.
- Hiro Chainhooks `http_post` action only supports a URL (no custom headers), so this server also accepts `?token=<CHAINHOOK_AUTH_TOKEN>` (used automatically when `CHAINHOOK_PROVIDER=hiro`).
