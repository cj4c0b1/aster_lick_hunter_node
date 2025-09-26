const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const axios = require('axios');

// Load config - using user config from parent directory
const configPath = path.join(__dirname, '..', 'config.user.json');
if (!fs.existsSync(configPath)) {
  console.error('config.user.json not found. Please run: npm run setup:config');
  process.exit(1);
}
const config = JSON.parse(fs.readFileSync(configPath, 'utf-8'));

const BASE_URL = 'https://fapi.asterdex.com';

// Helper to create signature
function createSignature(params, secretKey) {
  const queryString = Object.entries(params)
    .map(([key, value]) => `${key}=${value}`)
    .join('&');
  return crypto.createHmac('sha256', secretKey).update(queryString).digest('hex');
}

// Fetch income history
async function getIncomeHistory(range) {
  const now = Date.now();
  let startTime;

  switch (range) {
    case '24h':
      startTime = now - 24 * 60 * 60 * 1000;
      break;
    case '7d':
      startTime = now - 7 * 24 * 60 * 60 * 1000;
      break;
    case '30d':
      startTime = now - 30 * 24 * 60 * 60 * 1000;
      break;
    default:
      startTime = now - 7 * 24 * 60 * 60 * 1000;
  }

  const params = {
    startTime,
    endTime: now,
    limit: 1000,
    timestamp: Date.now(),
    recvWindow: 5000
  };

  params.signature = createSignature(params, config.api.secretKey);

  try {
    const response = await axios.get(`${BASE_URL}/fapi/v1/income`, {
      params,
      headers: {
        'X-MBX-APIKEY': config.api.apiKey
      }
    });

    return response.data;
  } catch (error) {
    console.error('Error fetching income:', error.response?.data || error.message);
    return [];
  }
}

// Aggregate by day
function aggregateByDay(records) {
  const dailyMap = new Map();

  records.forEach(record => {
    const date = new Date(record.time).toISOString().split('T')[0];

    if (!dailyMap.has(date)) {
      dailyMap.set(date, {
        date,
        realizedPnl: 0,
        commission: 0,
        fundingFee: 0,
        transfer: 0,
        count: 0,
        records: []
      });
    }

    const daily = dailyMap.get(date);
    daily.count++;
    daily.records.push({
      type: record.incomeType,
      amount: parseFloat(record.income),
      symbol: record.symbol,
      time: new Date(record.time).toISOString()
    });

    const amount = parseFloat(record.income);
    switch (record.incomeType) {
      case 'REALIZED_PNL':
        daily.realizedPnl += amount;
        break;
      case 'COMMISSION':
        daily.commission += amount;
        break;
      case 'FUNDING_FEE':
        daily.fundingFee += amount;
        break;
      case 'TRANSFER':
        daily.transfer += amount;
        break;
    }
  });

  return Array.from(dailyMap.values())
    .sort((a, b) => a.date.localeCompare(b.date))
    .map(day => ({
      ...day,
      netPnl: day.realizedPnl + day.commission + day.fundingFee
    }));
}

// Main test function
async function testPnLData() {
  console.log('='.repeat(80));
  console.log('PnL Data Test - Fetching directly from exchange');
  console.log('='.repeat(80));
  console.log('');

  const ranges = ['24h', '7d', '30d'];

  for (const range of ranges) {
    console.log(`\nFetching ${range} data...`);
    console.log('-'.repeat(40));

    const records = await getIncomeHistory(range);
    console.log(`Total records: ${records.length}`);

    if (records.length > 0) {
      // Count by type
      const byType = records.reduce((acc, r) => {
        acc[r.incomeType] = (acc[r.incomeType] || 0) + 1;
        return acc;
      }, {});
      console.log('Records by type:', byType);

      // Aggregate by day
      const dailyData = aggregateByDay(records);
      console.log(`Days with data: ${dailyData.length}`);

      // Show date range
      if (dailyData.length > 0) {
        console.log(`Date range: ${dailyData[0].date} to ${dailyData[dailyData.length - 1].date}`);

        // Show today's data
        const today = new Date().toISOString().split('T')[0];
        const todayData = dailyData.find(d => d.date === today);

        console.log(`\nToday (${today}) data:`);
        if (todayData) {
          console.log(`  - Realized PnL: ${todayData.realizedPnl.toFixed(2)}`);
          console.log(`  - Commission: ${todayData.commission.toFixed(2)}`);
          console.log(`  - Funding Fee: ${todayData.fundingFee.toFixed(2)}`);
          console.log(`  - Net PnL: ${todayData.netPnl.toFixed(2)}`);
          console.log(`  - Record count: ${todayData.count}`);

          // Show individual records for today
          console.log(`  - Today's records:`);
          todayData.records.forEach(r => {
            console.log(`    ${r.time}: ${r.type} ${r.amount.toFixed(4)} ${r.symbol || ''}`);
          });
        } else {
          console.log('  No data for today');
        }

        // Show last 3 days
        console.log('\nLast 3 days summary:');
        dailyData.slice(-3).forEach(day => {
          console.log(`  ${day.date}: Net PnL = ${day.netPnl.toFixed(2)} (${day.count} records)`);
        });
      }
    }

    // Small delay between requests
    await new Promise(resolve => setTimeout(resolve, 1000));
  }

  console.log('\n' + '='.repeat(80));
  console.log('Test complete!');
  console.log('='.repeat(80));
}

// Run the test
testPnLData().catch(console.error);