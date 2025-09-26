# 🚀 Aster DEX Liquidation Hunter Bot

[![Next.js](https://img.shields.io/badge/Next.js-15.5-black?style=flat-square&logo=next.js)](https://nextjs.org/)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.0-blue?style=flat-square&logo=typescript)](https://www.typescriptlang.org/)
[![License](https://img.shields.io/badge/License-MIT-green?style=flat-square)](LICENSE)
[![Node](https://img.shields.io/badge/Node.js-20+-green?style=flat-square&logo=node.js)](https://nodejs.org/)

An intelligent cryptocurrency trading bot that monitors and capitalizes on liquidation events on the Aster DEX exchange. Features real-time WebSocket monitoring, automated trading execution, and a beautiful web dashboard for monitoring and configuration.

## ✨ Features

- **🎯 Smart Liquidation Detection** - Monitors real-time liquidation events and executes trades based on market conditions
- **📊 Advanced Order Management** - Intelligent limit orders with order book analysis and slippage protection
- **🛡️ Risk Management** - Automatic stop-loss and take-profit orders on all positions
- **📈 VWAP Analysis** - Filters entries based on VWAP to avoid adverse price movements
- **🌐 Web Dashboard** - Beautiful UI for monitoring positions, liquidations, and bot status
- **📝 Paper Trading** - Test strategies safely without real money
- **🔄 Auto-Reconnection** - WebSocket connections with exponential backoff
- **💾 Trade History** - SQLite database for analyzing historical liquidations
- **⚙️ Hot Configuration** - Update settings without restarting the bot

## 🎬 Quick Start (3 Easy Steps)

### Step 1: Install the Bot
```bash
git clone https://github.com/yourusername/aster-lick-hunter-node.git
cd aster-lick-hunter-node
npm run setup
```

### Step 2: Configure Your API Keys
1. Get your API keys from [Aster DEX](https://www.asterdex.com/en/referral/3TixB2)
2. Edit `config.user.json` and add your keys:
```json
{
  "api": {
    "apiKey": "your-api-key-here",
    "secretKey": "your-secret-key-here"
  }
}
```

### Step 3: Run the Bot
```bash
# Test in paper mode first (recommended)
npm run dev

# When ready for live trading, set paperMode to false in config
```

That's it! Access the dashboard at http://localhost:3000 🎉

## 📋 Prerequisites

- **Node.js** version 20 or higher ([Download](https://nodejs.org/))
- **npm** or **yarn** package manager
- **Git** for cloning the repository
- **Aster DEX Account** - [Create Account (Support Development)](https://www.asterdex.com/en/referral/3TixB2)

## 🔧 Detailed Installation

### 1. Clone the Repository
```bash
git clone https://github.com/yourusername/aster-lick-hunter-node.git
cd aster-lick-hunter-node
```

### 2. Install Dependencies
```bash
npm install
# or
yarn install
```

### 3. Setup Configuration
```bash
npm run setup:config
```
This will create a `config.user.json` file with default settings.

### 4. Configure API Credentials

#### Getting API Keys from Aster DEX:
1. Log in to your [Aster DEX account](https://www.asterdex.com/en/referral/3TixB2)
2. Navigate to Account Settings → API Management
3. Create a new API key with trading permissions
4. **Important:** Enable futures trading permissions
5. Save your API Key and Secret Key securely

#### Add Keys to Configuration:
Edit `config.user.json`:
```json
{
  "api": {
    "apiKey": "paste-your-api-key-here",
    "secretKey": "paste-your-secret-key-here"
  },
  "global": {
    "paperMode": true  // Keep this true for testing!
  }
}
```

> ⚠️ **Security Warning:** Never commit your API keys to Git! The `config.user.json` file is automatically excluded from version control.

### 5. Build the Application
```bash
npm run build
```

## 🎮 Usage

### Development Mode (Recommended for Testing)
```bash
npm run dev
```
This runs both the web dashboard and bot with hot-reload enabled.

### Production Mode
```bash
npm start
```

### Individual Components
```bash
npm run dev:web    # Run only the web dashboard
npm run dev:bot    # Run only the bot service
npm run bot        # Run bot once (no auto-restart)
```

### Running Tests
```bash
npm test           # Test limit order functionality
npm run test:flow  # Test order flow
npm run test:all   # Run all test suites
```

## ⚙️ Configuration Guide

The bot uses a flexible configuration system with three files:

### Configuration Files

#### `config.user.json` (Your Settings - Not Tracked by Git)
Your personal configuration with API keys and custom settings.

#### `config.default.json` (Default Template)
Safe default values used as fallback for missing fields.

### Basic Configuration Structure

```json
{
  "api": {
    "apiKey": "",        // Your Aster DEX API key
    "secretKey": ""      // Your Aster DEX secret key
  },
  "symbols": {
    "ASTERUSDT": {
      "longVolumeThresholdUSDT": 1000,   // Min liquidation size for long entries
      "shortVolumeThresholdUSDT": 2500,  // Min liquidation size for short entries
      "tradeSize": 0.69,                 // Position size for long trades
      "shortTradeSize": 0.69,            // Position size for short trades
      "maxPositionMarginUSDT": 200,      // Max margin per position
      "leverage": 10,                    // Leverage multiplier
      "tpPercent": 1,                    // Take profit percentage
      "slPercent": 20,                   // Stop loss percentage
      "vwapProtection": true,            // Enable VWAP-based filtering
      "vwapTimeframe": "5m",             // VWAP calculation timeframe
      "vwapLookback": 200                // VWAP lookback period
    }
  },
  "global": {
    "riskPercent": 90,                   // Risk per trade (% of balance)
    "paperMode": true,                   // Paper trading mode (ALWAYS START WITH TRUE)
    "positionMode": "HEDGE",             // Position mode (HEDGE or ONE_WAY)
    "maxOpenPositions": 5,               // Max concurrent positions
    "server": {
      "dashboardPort": 3000,             // Web dashboard port
      "websocketPort": 8080              // Internal WebSocket port
    }
  }
}
```

### Adding More Trading Pairs

To add more symbols, simply add them to the `symbols` section:

```json
"symbols": {
  "ASTERUSDT": { ... },
  "BTCUSDT": {
    "longVolumeThresholdUSDT": 10000,
    "shortVolumeThresholdUSDT": 10000,
    "tradeSize": 0.001,
    "shortTradeSize": 0.001,
    "leverage": 5,
    "tpPercent": 2,
    "slPercent": 1
  },
  "ETHUSDT": { ... }
}
```

## 📊 Web Dashboard

Access the dashboard at http://localhost:3000

### Features:
- **Real-time Status** - Bot status, balance, and P&L tracking
- **Position Monitor** - Active positions with entry/exit prices
- **Liquidation Feed** - Live stream of liquidation events
- **Trade History** - Historical trades and performance metrics
- **Configuration Editor** - Update settings without restarting
- **Charts** - Visual representation of trading activity

### Dashboard Pages:
- `/` - Main trading dashboard
- `/config` - Configuration editor
- `/history` - Trade history and analytics

## 🏗️ Architecture

### Core Components

```
aster-lick-hunter-node/
├── src/
│   ├── app/              # Next.js web application
│   │   ├── page.tsx      # Main dashboard
│   │   └── api/          # REST API endpoints
│   ├── bot/              # Bot service
│   │   ├── index.ts      # Bot entry point
│   │   └── websocketServer.ts # Status broadcaster
│   ├── lib/              # Shared libraries
│   │   ├── api/          # Exchange API integration
│   │   ├── bot/          # Bot logic
│   │   │   ├── hunter.ts         # Liquidation monitor
│   │   │   └── positionManager.ts # Position management
│   │   └── db/           # Database operations
│   └── components/       # React UI components
├── config.user.json      # Your configuration (git-ignored)
├── config.default.json   # Default settings
└── package.json         # Dependencies
```

### Data Flow
1. **Hunter** monitors liquidation WebSocket stream
2. **Order Analyzer** evaluates market conditions
3. **Position Manager** executes trades and manages positions
4. **Status Broadcaster** updates web dashboard in real-time
5. **Database** stores trade history for analysis

## 🛠️ Troubleshooting

### Common Issues

#### Bot not receiving liquidations?
- ✅ Check API keys are correctly set in `config.user.json`
- ✅ Ensure futures trading is enabled on your API key
- ✅ Verify WebSocket connection in console logs
- ✅ Check if paper mode is enabled (generates mock liquidations)

#### Orders not being placed?
- ✅ Verify account has sufficient balance
- ✅ Check leverage settings match exchange limits
- ✅ Ensure position mode (HEDGE/ONE_WAY) matches exchange setting
- ✅ Review volume thresholds - they might be too high

#### Web dashboard not loading?
- ✅ Ensure port 3000 is not in use
- ✅ Check if both services are running (`npm run dev`)
- ✅ Clear browser cache and cookies
- ✅ Try accessing http://localhost:3000 directly

#### Configuration not updating?
- ✅ Save changes to `config.user.json`
- ✅ Restart the bot after configuration changes
- ✅ Check JSON syntax is valid (no trailing commas)
- ✅ Ensure you're editing `config.user.json`, not `config.default.json`

### Error Messages

| Error | Solution |
|-------|----------|
| `API key invalid` | Check API key and secret in config |
| `Insufficient balance` | Add funds to futures account |
| `Position size too small` | Increase tradeSize in config |
| `WebSocket disconnected` | Bot will auto-reconnect, check internet |
| `Port already in use` | Stop other services or change ports in config |

## 🔒 Security Best Practices

1. **Never share your API keys** - Keep them secret and secure
2. **Use paper mode first** - Always test strategies with paper trading
3. **Set reasonable stop losses** - Protect your capital
4. **Start with small positions** - Test with minimal risk
5. **Monitor regularly** - Check dashboard for unexpected behavior
6. **Use read-only keys for testing** - Minimize risk during development
7. **Enable 2FA on exchange** - Protect your account
8. **Regular backups** - Backup your configuration and database

## 📚 Advanced Features

### Custom Trading Strategies
Modify `src/lib/bot/hunter.ts` to implement custom entry logic.

### Database Analytics
Query SQLite database for historical analysis:
```sql
SELECT * FROM liquidations
WHERE volume_usdt > 10000
ORDER BY timestamp DESC;
```

### API Integration
Use the bot's API endpoints for external integration:
```javascript
// Get current positions
fetch('http://localhost:3000/api/positions')

// Get bot status
fetch('http://localhost:3000/api/bot/status')
```

## 🤝 Contributing

Contributions are welcome! Please feel free to submit pull requests.

1. Fork the repository
2. Create your feature branch (`git checkout -b feature/AmazingFeature`)
3. Commit your changes (`git commit -m 'Add some AmazingFeature'`)
4. Push to the branch (`git push origin feature/AmazingFeature`)
5. Open a Pull Request

## 📞 Support

- **Issues**: [GitHub Issues](https://github.com/yourusername/aster-lick-hunter-node/issues)
- **Discord**: [Join our community](https://discord.gg/P8Ev3Up)
- **Documentation**: Check the `/docs` folder for detailed API documentation

## 💝 Support Development

This bot is **100% FREE and open-source!** If you find it useful, please consider:

1. **Creating your Aster DEX account with our referral link:**
   ### 👉 [**Support Development - Create Account**](https://www.asterdex.com/en/referral/3TixB2)

   *Using this link helps fund continued development while giving you the same trading conditions.*

2. **Star this repository** ⭐

3. **Share with others** who might find it useful

## 📄 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## ⚠️ Disclaimer

**IMPORTANT:** Trading cryptocurrency involves substantial risk of loss and is not suitable for every investor. The valuation of cryptocurrencies may fluctuate, and, as a result, you may lose more than your original investment.

This bot is provided as-is for educational purposes. The authors are not responsible for any losses incurred through the use of this software. Always do your own research and trade responsibly.

---

<p align="center">
  Made with ❤️ by the Aster Liquidation Hunter community
</p>

<p align="center">
  <a href="https://www.asterdex.com/en/referral/3TixB2">Get Started</a> •
  <a href="https://github.com/yourusername/aster-lick-hunter-node/issues">Report Bug</a> •
  <a href="https://discord.gg/P8Ev3Up">Join Discord</a>
</p>