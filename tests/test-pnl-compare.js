const crypto = require('crypto');
const axios = require('axios');
const { loadTestConfig } = require('./loadTestConfig');

// Load config
const config = loadTestConfig();

const BASE_URL = 'https://fapi.asterdex.com';

// Helper to create signature
function createSignature(params, secretKey) {
  const queryString = Object.entries(params)
    .map(([key, value]) => `${key}=${value}`)
    .join('&');
  return crypto.createHmac('sha256', secretKey).update(queryString).digest('hex');
}

// Fetch ALL income history without date filter
async function getAllIncome() {
  const params = {
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
    console.error('Error fetching all income:', error.response?.data || error.message);
    return [];
  }
}

// Fetch income with specific date range
async function getIncomeByRange(startTime, endTime) {
  const params = {
    startTime,
    endTime,
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
    console.error('Error fetching income by range:', error.response?.data || error.message);
    return [];
  }
}

// Main comparison test
async function compareTimeRanges() {
  console.log('='.repeat(80));
  console.log('PnL Time Range Comparison Test');
  console.log('='.repeat(80));
  console.log('');

  const now = Date.now();
  const today = new Date().toISOString().split('T')[0];

  // Define exact time boundaries
  const todayStart = new Date(today + 'T00:00:00Z').getTime();
  const yesterdayStart = todayStart - 24 * 60 * 60 * 1000;
  const weekAgoStart = todayStart - 7 * 24 * 60 * 60 * 1000;

  console.log('Time boundaries:');
  console.log(`  Now: ${new Date(now).toISOString()}`);
  console.log(`  Today start (UTC): ${new Date(todayStart).toISOString()}`);
  console.log(`  Yesterday start (UTC): ${new Date(yesterdayStart).toISOString()}`);
  console.log(`  Week ago start (UTC): ${new Date(weekAgoStart).toISOString()}`);
  console.log('');

  // Test 1: Get last 7 days default (no startTime)
  console.log('Test 1: Default API call (last 7 days, no startTime)');
  console.log('-'.repeat(40));
  const defaultRecords = await getAllIncome();
  console.log(`Records: ${defaultRecords.length}`);
  if (defaultRecords.length > 0) {
    const dates = defaultRecords.map(r => new Date(r.time).toISOString());
    console.log(`  Earliest: ${dates[dates.length - 1]}`);
    console.log(`  Latest: ${dates[0]}`);

    // Count today's records
    const todayRecords = defaultRecords.filter(r => {
      const recordDate = new Date(r.time).toISOString().split('T')[0];
      return recordDate === today;
    });
    console.log(`  Today's records: ${todayRecords.length}`);
  }
  console.log('');

  // Test 2: Last 24 hours (rolling)
  console.log('Test 2: Last 24 hours (rolling from now)');
  console.log('-'.repeat(40));
  const last24h = now - 24 * 60 * 60 * 1000;
  const records24h = await getIncomeByRange(last24h, now);
  console.log(`Records: ${records24h.length}`);
  if (records24h.length > 0) {
    const dates = records24h.map(r => new Date(r.time).toISOString());
    console.log(`  Earliest: ${dates[dates.length - 1]}`);
    console.log(`  Latest: ${dates[0]}`);

    // Group by date
    const byDate = {};
    records24h.forEach(r => {
      const date = new Date(r.time).toISOString().split('T')[0];
      byDate[date] = (byDate[date] || 0) + 1;
    });
    console.log('  By date:', byDate);
  }
  console.log('');

  // Test 3: Today only (from midnight UTC)
  console.log('Test 3: Today only (from midnight UTC)');
  console.log('-'.repeat(40));
  const recordsToday = await getIncomeByRange(todayStart, now);
  console.log(`Records: ${recordsToday.length}`);
  if (recordsToday.length > 0) {
    const dates = recordsToday.map(r => new Date(r.time).toISOString());
    console.log(`  Earliest: ${dates[dates.length - 1]}`);
    console.log(`  Latest: ${dates[0]}`);

    // Show income types
    const byType = {};
    recordsToday.forEach(r => {
      byType[r.incomeType] = (byType[r.incomeType] || 0) + 1;
    });
    console.log('  By type:', byType);
  }
  console.log('');

  // Test 4: Last 7 days (from 7 days ago midnight)
  console.log('Test 4: Last 7 days (from 7 days ago midnight)');
  console.log('-'.repeat(40));
  const records7d = await getIncomeByRange(weekAgoStart, now);
  console.log(`Records: ${records7d.length}`);
  if (records7d.length > 0) {
    const dates = records7d.map(r => new Date(r.time).toISOString());
    console.log(`  Earliest: ${dates[dates.length - 1]}`);
    console.log(`  Latest: ${dates[0]}`);

    // Group by date
    const byDate = {};
    records7d.forEach(r => {
      const date = new Date(r.time).toISOString().split('T')[0];
      byDate[date] = (byDate[date] || 0) + 1;
    });
    console.log('  By date:', byDate);
  }
  console.log('');

  // Compare results
  console.log('Comparison Summary:');
  console.log('-'.repeat(40));
  console.log(`Default (no dates): ${defaultRecords.length} records`);
  console.log(`Last 24h rolling: ${records24h.length} records`);
  console.log(`Today only: ${recordsToday.length} records`);
  console.log(`Last 7 days: ${records7d.length} records`);

  // Check for discrepancies
  console.log('\nDiscrepancy Analysis:');
  console.log('-'.repeat(40));

  // Today's records in each dataset
  const todayIn24h = records24h.filter(r =>
    new Date(r.time).toISOString().split('T')[0] === today
  ).length;
  const todayIn7d = records7d.filter(r =>
    new Date(r.time).toISOString().split('T')[0] === today
  ).length;
  const todayInDefault = defaultRecords.filter(r =>
    new Date(r.time).toISOString().split('T')[0] === today
  ).length;

  console.log(`Today's records in 24h data: ${todayIn24h}`);
  console.log(`Today's records in 7d data: ${todayIn7d}`);
  console.log(`Today's records in default data: ${todayInDefault}`);
  console.log(`Today's records in today-only data: ${recordsToday.length}`);

  if (todayIn24h !== recordsToday.length || todayIn7d !== recordsToday.length) {
    console.log('\n⚠️  DISCREPANCY DETECTED!');
    console.log('Today\'s records count differs between time ranges!');
  }

  console.log('\n' + '='.repeat(80));
}

// Run the test
compareTimeRanges().catch(console.error);