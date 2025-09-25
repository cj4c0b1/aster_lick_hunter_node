import Link from 'next/link';

export default function Home() {
  return (
    <div className="min-h-screen bg-gradient-to-b from-gray-50 to-white">
      <div className="max-w-4xl mx-auto px-4 py-16 sm:px-6 lg:px-8">
        <div className="text-center">
          <h1 className="text-5xl font-bold text-gray-900 mb-4">
            Aster Liquidation Hunter Bot
          </h1>
          <p className="text-xl text-gray-600 mb-8">
            Advanced cryptocurrency futures trading bot that monitors and capitalizes on liquidation events
          </p>
        </div>

        <div className="grid md:grid-cols-2 gap-8 mt-12">
          <div className="bg-white p-6 rounded-lg shadow-md">
            <h2 className="text-2xl font-semibold mb-4">🎯 Key Features</h2>
            <ul className="space-y-3 text-gray-700">
              <li className="flex items-start">
                <span className="text-green-500 mr-2">✓</span>
                Real-time liquidation monitoring via WebSocket
              </li>
              <li className="flex items-start">
                <span className="text-green-500 mr-2">✓</span>
                Automated counter-trading with configurable thresholds
              </li>
              <li className="flex items-start">
                <span className="text-green-500 mr-2">✓</span>
                Built-in position management with SL/TP orders
              </li>
              <li className="flex items-start">
                <span className="text-green-500 mr-2">✓</span>
                Paper trading mode for risk-free testing
              </li>
              <li className="flex items-start">
                <span className="text-green-500 mr-2">✓</span>
                Multi-symbol support with individual configurations
              </li>
            </ul>
          </div>

          <div className="bg-white p-6 rounded-lg shadow-md">
            <h2 className="text-2xl font-semibold mb-4">⚙️ How It Works</h2>
            <ol className="space-y-3 text-gray-700 list-decimal list-inside">
              <li>Configure API credentials and trading parameters</li>
              <li>Set volume thresholds for each trading symbol</li>
              <li>Bot monitors liquidation events in real-time</li>
              <li>Analyzes market conditions when thresholds are met</li>
              <li>Executes counter-trades automatically</li>
              <li>Manages positions with stop-loss and take-profit</li>
            </ol>
          </div>
        </div>

        <div className="mt-12 bg-yellow-50 border border-yellow-200 rounded-lg p-6">
          <h2 className="text-xl font-semibold text-yellow-800 mb-3">⚠️ Risk Warning</h2>
          <p className="text-yellow-700">
            Trading cryptocurrency futures involves substantial risk of loss and is not suitable for all investors.
            Past performance is not indicative of future results. Always start with paper trading mode and use
            proper risk management. Never risk more than you can afford to lose.
          </p>
        </div>

        <div className="mt-12 flex flex-col sm:flex-row gap-4 justify-center">
          <Link
            href="/config"
            className="px-8 py-3 bg-blue-600 text-white font-semibold rounded-lg hover:bg-blue-700 transition text-center"
          >
            Configure Bot
          </Link>
          <Link
            href="/dashboard"
            className="px-8 py-3 bg-gray-800 text-white font-semibold rounded-lg hover:bg-gray-900 transition text-center"
          >
            View Dashboard
          </Link>
        </div>

        <div className="mt-16 text-center text-gray-600">
          <h3 className="text-lg font-semibold mb-3">Getting Started</h3>
          <div className="space-y-2">
            <p>1. Configure your API credentials in the Configuration page</p>
            <p>2. Add symbols and set trading parameters</p>
            <p>3. Run the bot locally with: <code className="bg-gray-100 px-2 py-1 rounded">npm run bot</code></p>
            <p>4. Monitor positions and performance in the Dashboard</p>
          </div>
        </div>
      </div>
    </div>
  );
}