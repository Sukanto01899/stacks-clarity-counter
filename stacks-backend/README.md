# Bitcoin Stamp NFT Chainhook Monitoring Server

Real-time event monitoring for Bitcoin Stamp NFT contract using Chainhooks.

## 🚀 Features

- **Real-time Event Monitoring**: Track mints, transfers, and burns as they happen
- **Multiple Mint Types**: Monitor paid mints, free mints, and owner mints separately
- **RESTful API**: Query historical data and statistics
- **Webhook Support**: Trigger custom actions on blockchain events
- **Statistics Dashboard**: Track total mints, transfers, and active users
- **TypeScript**: Fully typed for better developer experience

## 📋 Prerequisites

1. **Node.js** (v18 or higher)
2. Either:
   - **Hiro Chainhooks API** access (Hiro API key), or
   - **Chainhook Node** running locally/remotely
3. **Stacks blockchain** access (testnet or mainnet)

## 🛠️ Installation

```bash
# Clone the repository
git clone <your-repo-url>
cd bitcoin-stamp-chainhook-server

# Install dependencies
npm install

# Copy environment variables
cp .env.example .env

# Edit .env with your configuration
nano .env
```

## ⚙️ Configuration

Edit `.env` file:

```env
# Server port
PORT=3000

# Your deployed contract details
CONTRACT_ADDRESS=ST1PQHQKV0RJXZFY1DGX8MNSNYVE3VGZJSRTPGZGM
CONTRACT_NAME=bitcoin-stamp-nft

# Choose where to register chainhooks:
# - `hiro`: use Hiro Chainhooks API (recommended)
# - `local`: register against a local Chainhook node
CHAINHOOK_PROVIDER=hiro

# Hiro API key (required when CHAINHOOK_PROVIDER=hiro)
HIRO_API_KEY=your-hiro-api-key-here

# Chainhook node URL (used when CHAINHOOK_PROVIDER=local)
CHAINHOOK_NODE_URL=http://localhost:20456

# Secret token for webhook authentication
CHAINHOOK_AUTH_TOKEN=your-secret-token-here

# Your server's external URL
EXTERNAL_URL=http://localhost:3000
```

## 🏃 Running the Server

### Development Mode

```bash
npm run dev
```

### Production Mode

```bash
# Build
npm run build

# Start
npm start
```

## 📡 API Endpoints

### Statistics

```bash
GET /api/stats
```

Returns overall statistics including total mints, transfers, and active users.

**Response:**

```json
{
  "totalMints": 150,
  "paidMints": 50,
  "freeMints": 80,
  "ownerMints": 20,
  "totalTransfers": 45,
  "totalBurns": 5,
  "activeUsers": 75
}
```

### Get All Mints

```bash
GET /api/mints?limit=50&offset=0
```

**Response:**

```json
{
  "total": 150,
  "limit": 50,
  "offset": 0,
  "data": [
    {
      "tokenId": "42",
      "minter": "ST1SJ3DTE5DN7X54YDH5D64R3BCB6A2AG2ZQ8YPD5",
      "name": "My Bitcoin Stamp",
      "uri": "ipfs://QmXx...",
      "mintType": "paid",
      "txId": "0x123...",
      "blockHeight": 12345,
      "timestamp": 1701234567890
    }
  ]
}
```

### Get All Transfers

```bash
GET /api/transfers?limit=50&offset=0
```

### Get Recent Activity

```bash
GET /api/activity/recent?limit=20
```

### Get User Activity

```bash
GET /api/user/ST1SJ3DTE5DN7X54YDH5D64R3BCB6A2AG2ZQ8YPD5
```

**Response:**

```json
{
  "address": "ST1SJ3DTE5DN7X54YDH5D64R3BCB6A2AG2ZQ8YPD5",
  "totalMints": 5,
  "totalTransfers": 3,
  "mints": [],
  "transfers": []
}
```

### Health Check

```bash
GET /health
```

## 🪝 Webhook Events

The server receives webhook events from Chainhook on these endpoints:

- `POST /webhooks/paid-mint` - Paid mint events
- `POST /webhooks/free-mint` - Free mint events
- `POST /webhooks/owner-mint` - Owner mint events
- `POST /webhooks/transfer` - NFT transfer events
- `POST /webhooks/burn` - NFT burn events

All webhooks are authenticated using the `CHAINHOOK_AUTH_TOKEN`.

Note: the Hiro Chainhooks API `http_post` action only supports a URL (no custom headers), so this server also accepts `?token=CHAINHOOK_AUTH_TOKEN` on webhook URLs (this is what the `CHAINHOOK_PROVIDER=hiro` registration uses).

## 🔧 Chainhook Setup

### Install Chainhook

```bash
# Download from Hiro
https://github.com/hirosystems/chainhook
```

### Start Chainhook Node

```bash
chainhook service start --config-path=./config.toml
```

### Example config.toml

```toml
[storage]
working_dir = "chainhook-data"

[network]
mode = "testnet"

[http_api]
http_port = 20456
display_logs = true
```

## 📊 Monitoring Events

Once the server is running, it will automatically:

1. Register predicates with Chainhook
2. Listen for blockchain events
3. Process and store events in memory
4. Make data available via REST API

### Example: Monitor in Real-time

```bash
# Watch logs
npm run dev

# In another terminal, trigger a mint transaction
# Watch the logs for real-time updates
```

## 🎯 Use Cases

### 1. Real-time Dashboard

Query the API to build a live dashboard showing:

- Recent mints
- Top collectors
- Mint statistics
- Transfer activity

### 2. Discord/Telegram Notifications

Extend webhook handlers to send notifications:

```typescript
app.post('/webhooks/paid-mint', async (req, res) => {
  // ... existing code ...
  
  // Send Discord notification
  await sendDiscordNotification({
    title: "New NFT Minted! 🎉",
    description: `Token #${mintEvent.tokenId}`,
    minter: mintEvent.minter
  });
});
```

### 3. Leaderboard

Track top minters and create a leaderboard:

```typescript
app.get('/api/leaderboard', (req, res) => {
  const minterCounts = {};
  mintEvents.forEach(m => {
    minterCounts[m.minter] = (minterCounts[m.minter] || 0) + 1;
  });
  
  const leaderboard = Object.entries(minterCounts)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 10);
  
  res.json(leaderboard);
});
```

### 4. Analytics

Track mint trends over time, most popular metadata, etc.

## 🗄️ Database Integration (Optional)

To persist data, add a database:

```bash
npm install pg @types/pg
```

Update code to save events to PostgreSQL/MongoDB instead of memory.

## 🔒 Security

- Always change `CHAINHOOK_AUTH_TOKEN` in production
- Use HTTPS for `EXTERNAL_URL`
- Add rate limiting for public endpoints
- Validate all incoming webhook payloads

## 📝 Project Structure

```
.
├── src/
│   └── index.ts          # Main server file
├── dist/                 # Compiled JavaScript
├── .env                  # Environment variables
├── .env.example          # Example env file
├── package.json
├── tsconfig.json
└── README.md
```

## 🐛 Troubleshooting

### Chainhook not connecting

- Ensure Chainhook node is running
- Check `CHAINHOOK_NODE_URL` is correct
- Verify network connectivity

### Webhooks not receiving events

- Check `EXTERNAL_URL` is accessible from Chainhook
- Verify `CHAINHOOK_AUTH_TOKEN` matches
- Check contract address and name are correct

### Events not showing

- Ensure predicates registered successfully
- Check Chainhook logs for errors
- Verify contract is deployed on correct network

## 📚 Resources

- [Chainhook Documentation](https://docs.hiro.so/chainhook)
- [Stacks.js Documentation](https://stacks.js.org)
- [Bitcoin Stamp NFT Contract](./contracts/bitcoin-stamp-nft.clar)

## 🤝 Contributing

Contributions welcome! Please open an issue or submit a PR.

## 📄 License

MIT
