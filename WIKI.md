# Aster DEX Liquidation Hunter Bot - Wiki

## Table of Contents
- [Installation & Setup](#installation--setup)
- [Updating the Bot](#updating-the-bot)
- [Common Operations](#common-operations)
- [Troubleshooting](#troubleshooting)
- [Development](#development)

## Installation & Setup

### First Time Installation

```bash
# Clone the repository
git clone https://github.com/CryptoGnome/aster_lick_hunter_node.git
cd aster_lick_hunter_node

# Run automatic setup (installs dependencies and builds)
npm run setup

# Start the bot
npm run dev
```

### Manual Installation

```bash
# Install dependencies
npm install

# Build the project
npm run build

# Start development mode
npm run dev
```

## Updating the Bot

### Standard Update Procedure

When pulling updates from the repository, always follow these steps:

```bash
# 1. Stop the running bot (Ctrl+C)

# 2. Pull latest changes
git pull

# 3. Install new/updated dependencies
npm install

# 4. Rebuild the project
npm run build

# 5. Start the bot
npm run dev
```

### Why Each Step Matters

- **`git pull`**: Fetches latest code changes
- **`npm install`**: Updates dependencies that may have changed
- **`npm run build`**: Compiles TypeScript and prepares production bundles
- **`npm run dev`**: Starts both the web UI and bot service

### Quick Update (if no dependency changes)

If you know dependencies haven't changed:

```bash
git pull
npm run build
npm run dev
```

## Common Operations

### Running Different Modes

```bash
# Development mode (with hot reload)
npm run dev

# Production mode
npm start

# Web UI only
npm run dev:web

# Bot only (with watch mode)
npm run dev:bot

# Bot only (single run)
npm run bot
```

### Testing

```bash
# Run all tests
npm run test:all

# Test limit orders
npm test

# Test bot simulation
npm run test:simulation

# Test order flow
npm run test:flow
```

### Code Quality

```bash
# Check for linting issues
npm run lint

# Check TypeScript types
npx tsc --noEmit
```

### Configuration

```bash
# Setup initial configuration
npm run setup:config

# This will:
# - Migrate existing config.json to config.user.json
# - Create config.user.json from defaults if needed
# - Remove config.json from git tracking
```

## Troubleshooting

### Port Already in Use

If you see "Port 3000 is already in use":

```bash
# Windows
netstat -ano | findstr :3000
taskkill /PID <PID> /F

# Linux/Mac
lsof -i :3000
kill -9 <PID>
```

### WebSocket Connection Issues

1. Check your API keys are correct
2. Ensure you're not running multiple instances
3. Check firewall settings
4. Try restarting with `npm run dev`

### Build Errors

```bash
# Clean install
rm -rf node_modules package-lock.json
npm install
npm run build
```

### Configuration Issues

```bash
# Reset to default configuration
cp config.default.json config.user.json
# Then add your API keys via web UI at http://localhost:3000/config
```

## Development

### Project Structure

```
aster_lick_hunter_node/
├── src/
│   ├── app/           # Next.js pages and API routes
│   ├── bot/           # Bot service and WebSocket server
│   ├── lib/           # Shared business logic
│   │   ├── api/       # Exchange API interaction
│   │   ├── bot/       # Bot components
│   │   └── db/        # Database operations
│   └── components/    # React UI components
├── config.user.json   # User configuration (gitignored)
├── config.default.json # Default configuration
└── package.json       # Dependencies and scripts
```

### Making Changes

1. **Before making changes**: Create a branch
   ```bash
   git checkout -b feature/your-feature-name
   ```

2. **Test your changes**:
   ```bash
   npm run lint
   npx tsc --noEmit
   npm test
   ```

3. **Build and verify**:
   ```bash
   npm run build
   npm run dev
   ```

### API Testing

To test API connections without running the full bot:

```bash
# Use the Node.js REPL
node

# Then in the REPL:
const { loadConfig } = require('./dist/lib/bot/config');
const { getBalance } = require('./dist/lib/api/market');

(async () => {
  const config = await loadConfig();
  const balance = await getBalance(config.api);
  console.log(balance);
})();
```

### Database Operations

The bot uses SQLite for storing liquidation history:

```bash
# View database (requires sqlite3 CLI)
sqlite3 liquidations.db

# In SQLite:
.tables
SELECT * FROM liquidations ORDER BY timestamp DESC LIMIT 10;
.quit
```

### Logs and Debugging

- Bot logs: Check terminal output when running `npm run dev`
- Web UI logs: Check browser console (F12)
- WebSocket status: Monitor at http://localhost:3000 dashboard
- Database: Check `liquidations.db` for historical data

### Environment Variables

While not required, you can use environment variables:

```bash
# Create .env.local file
API_KEY=your_api_key_here
SECRET_KEY=your_secret_key_here

# These will override config.user.json values
```

## Best Practices

### Before Going Live

1. **Always test in paper mode first**
2. **Start with small position sizes**
3. **Monitor the first few trades closely**
4. **Set conservative stop-loss levels**
5. **Keep your API keys secure**

### Regular Maintenance

```bash
# Weekly: Update dependencies
npm update

# Monthly: Check for major updates
npm outdated

# As needed: Clean database
# The bot auto-manages database size, but you can manually clean old entries
```

### Backup Configuration

```bash
# Backup your configuration
cp config.user.json config.user.backup.json

# Backup database
cp liquidations.db liquidations.backup.db
```

## Support and Resources

- **GitHub Issues**: [Report bugs or request features](https://github.com/CryptoGnome/aster_lick_hunter_node/issues)
- **Discord**: [Join the community](https://discord.gg/P8Ev3Up)
- **Video Tutorial**: [Setup guide on YouTube](https://www.youtube.com/watch?v=Np9LZpWUhXY)

## Security Notes

- **Never commit `config.user.json`** - It contains your API keys
- **Keep your API keys secret** - Don't share them with anyone
- **Use paper mode** - Test all changes in paper mode first
- **Monitor positions** - Always keep an eye on open positions