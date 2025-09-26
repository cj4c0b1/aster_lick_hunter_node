# 🚀 Aster DEX Liquidation Hunter Bot

A smart trading bot that monitors and trades liquidation events on Aster DEX. Features automated trading, risk management, and a beautiful web dashboard.

## 💝 Support This Free Bot

**This bot is 100% FREE!** If you find it useful, please support development by creating your Aster DEX account with our referral link:

### 👉 [**Create Aster DEX Account (Support Development)**](https://www.asterdex.com/en/referral/3TixB2)

*Using our referral link costs you nothing extra but helps fund continued development. Thank you!*

## 🎯 What Makes This Bot Special

📈 **Real-time Liquidation Hunting** - Monitors and instantly trades liquidation events
💰 **Smart Position Management** - Automatic stop-loss and take-profit on every trade
🧪 **Paper Trading Mode** - Test strategies safely with simulated trades
🎨 **Beautiful Web Dashboard** - Monitor everything from a clean, modern UI
⚡ **One-Click Setup** - Get running in under 2 minutes
🔄 **Auto-Reconnection** - Never miss a trade due to connection issues
📊 **VWAP Protection** - Avoid bad entries with volume-weighted analysis
🛡️ **Risk Controls** - Position limits and leverage management built-in

## 🚀 Quick Start

### Prerequisites
- [Node.js 20+](https://nodejs.org/)
- [Aster DEX Account](https://www.asterdex.com/en/referral/3TixB2)

### Installation

```bash
# 1. Clone the repository
git clone https://github.com/CryptoGnome/aster_lick_hunter_node.git
cd aster_lick_hunter_node

# 2. Run setup wizard
npm run setup

# 3. Start the bot
npm run dev
```

### Configuration

1. **Get API Keys**: Sign in to [Aster DEX](https://www.asterdex.com/en/referral/3TixB2) → Settings → API Management
2. **Configure Bot**: Open http://localhost:3000/config
3. **Add API Keys**: Paste your keys in the web UI
4. **Start Trading**: Toggle paper mode off when ready

## 📊 Web Dashboard

Access at http://localhost:3000

- **Dashboard** - Monitor positions and P&L
- **Config** - Adjust all settings via UI
- **History** - View past trades

## ⚙️ Commands

```bash
npm run dev        # Run bot + dashboard
npm run start      # Production mode
npm run bot        # Run bot only
npm test           # Run tests
```

## 🛡️ Safety Features

- Paper mode for testing
- Automatic stop-loss/take-profit
- Position size limits
- WebSocket auto-reconnection

## 📱 Configuration Options

All settings available in the web UI:

| Setting | Description | Default |
|---------|-------------|---------|
| Paper Mode | Test without real money | ON |
| Leverage | Position multiplier | 10x |
| Stop Loss | Max loss per trade | 20% |
| Take Profit | Target profit | 1% |
| Volume Filter | Min liquidation size | $1000 |

## 🚨 Important Notes

1. **Always start in paper mode** - Test your settings first
2. **API Security** - Never share your API keys
3. **Risk Warning** - Crypto trading involves significant risk

## 🤝 Need Help or Want to Contribute?

### 🐛 Found a Bug?
[**Create an Issue**](https://github.com/CryptoGnome/aster_lick_hunter_node/issues/new) - We'll fix it ASAP!

### 💡 Have an Idea?
[**Request a Feature**](https://github.com/CryptoGnome/aster_lick_hunter_node/issues/new?title=Feature%20Request:%20) - We love new ideas!

### 🔧 Want to Contribute?
1. Fork the repo
2. Create your feature branch (`git checkout -b feature/YourFeature`)
3. Commit changes (`git commit -m 'Add YourFeature'`)
4. Push (`git push origin feature/YourFeature`)
5. [Open a Pull Request](https://github.com/CryptoGnome/aster_lick_hunter_node/pulls)

### 💬 Join the Community
[**Discord Server**](https://discord.gg/P8Ev3Up) - Get help, share strategies, and chat with other traders!

## 📄 License

MIT License - Free to use and modify

## ⚠️ Disclaimer

Trading cryptocurrency carries substantial risk. This bot is for educational purposes. Always do your own research and trade responsibly. The authors are not responsible for any losses.

---

<p align="center">
  <b>Support Development:</b> <a href="https://www.asterdex.com/en/referral/3TixB2">Create Aster DEX Account</a>
</p>