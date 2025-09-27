/* eslint-disable @typescript-eslint/no-require-imports */
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

// Fetch using the fixed approach (no startTime in API params, filter locally)
async function fetchWithLocalFilter(days) {
  const now = Date.now();
  const targetStartTime = now - days * 24 * 60 * 60 * 1000;

  console.log(`\nFetching ${days}-day data with local filtering`);
  console.log('='.repeat(50));

  const allRecords = [];
  let currentEndTime = now;
  let batchCount = 0;

  while (true) {
    batchCount++;
    const params = {
      endTime: currentEndTime,
      limit: 1000,
      timestamp: Date.now(),
      recvWindow: 5000
    };

    params.signature = createSignature(params, config.api.secretKey);

    try {
      const response = await axios.get(`${BASE_URL}/fapi/v1/income`, {
        params,
        headers: { 'X-MBX-APIKEY': config.api.apiKey }
      });

      const records = response.data;
      if (records.length === 0) break;

      // Filter locally
      const filteredRecords = records.filter(r => r.time >= targetStartTime);
      allRecords.push(...filteredRecords);

      // Stop if we've gone past our target time
      if (filteredRecords.length < records.length) break;
      if (records.length < 1000) break;

      const oldestTime = records[records.length - 1].time;
      if (oldestTime <= targetStartTime) break;

      currentEndTime = oldestTime - 1;
    } catch (error) {
      console.error('Error:', error.response?.data || error.message);
      break;
    }
  }

  // Count by date
  const byDate = {};
  allRecords.forEach(r => {
    const date = new Date(r.time).toISOString().split('T')[0];
    byDate[date] = (byDate[date] || 0) + 1;
  });

  console.log(`Total records: ${allRecords.length}`);
  console.log(`Batches fetched: ${batchCount}`);
  console.log('Records by date:');
  Object.entries(byDate)
    .sort(([a], [b]) => a.localeCompare(b))
    .forEach(([date, count]) => {
      console.log(`  ${date}: ${count} records`);
    });

  const today = new Date().toISOString().split('T')[0];
  console.log(`\nToday (${today}) included: ${byDate[today] ? 'YES (' + byDate[today] + ' records)' : 'NO'}`);

  return allRecords;
}

// Run tests for different time ranges
async function runVerification() {
  console.log('PnL Data Fetching Verification');
  console.log('='.repeat(60));

  // Test key time ranges
  const ranges = [
    { days: 1, label: '24 hours' },
    { days: 7, label: '7 days' },
    { days: 30, label: '30 days' }
  ];

  for (const range of ranges) {
    const records = await fetchWithLocalFilter(range.days);

    // Check if today is included
    const today = new Date().toISOString().split('T')[0];
    const todayRecords = records.filter(r =>
      new Date(r.time).toISOString().split('T')[0] === today
    );

    if (todayRecords.length === 0 && range.days >= 1) {
      console.log(`⚠️ WARNING: ${range.label} range missing today's data!`);
    } else {
      console.log(`✅ ${range.label} range includes today's data`);
    }

    await new Promise(resolve => setTimeout(resolve, 1000));
  }

  console.log('\n' + '='.repeat(60));
  console.log('Verification complete!');
}

// Run verification
runVerification().catch(console.error);