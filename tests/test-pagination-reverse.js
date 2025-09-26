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

// Test reverse pagination (from newest to oldest)
async function testReversePagination() {
  console.log('Testing reverse pagination for 7-day range');
  console.log('='.repeat(60));

  const now = Date.now();
  const startTime = now - 7 * 24 * 60 * 60 * 1000;

  console.log(`Target Start: ${new Date(startTime).toISOString()}`);
  console.log(`End: ${new Date(now).toISOString()}`);
  console.log('');

  const allRecords = [];
  let currentEndTime = now;
  let batchNumber = 0;
  let reachedTargetTime = false;

  while (!reachedTargetTime) {
    batchNumber++;
    const params = {
      endTime: currentEndTime,
      limit: 1000,
      timestamp: Date.now(),
      recvWindow: 5000
    };

    // Don't set startTime initially - we'll paginate backwards
    params.signature = createSignature(params, config.api.secretKey);

    console.log(`Batch ${batchNumber}:`);
    console.log(`  Request End: ${new Date(params.endTime).toISOString()}`);
    console.log(`  Request Start: not set (fetching most recent 1000)`);

    try {
      const response = await axios.get(`${BASE_URL}/fapi/v1/income`, {
        params,
        headers: {
          'X-MBX-APIKEY': config.api.apiKey
        }
      });

      const records = response.data;
      console.log(`  Records received: ${records.length}`);

      if (records.length === 0) {
        console.log('  No more records');
        break;
      }

      // Filter out records older than our target startTime
      const filteredRecords = records.filter(r => r.time >= startTime);
      allRecords.push(...filteredRecords);

      // Show what we got
      if (records.length > 0) {
        const dates = records.map(r => new Date(r.time).toISOString().split('T')[0]);
        const uniqueDates = [...new Set(dates)];
        console.log(`  Dates in batch: ${uniqueDates.join(', ')}`);
        console.log(`  Newest in batch: ${new Date(records[0].time).toISOString()}`);
        console.log(`  Oldest in batch: ${new Date(records[records.length - 1].time).toISOString()}`);
        console.log(`  Records kept (after filtering): ${filteredRecords.length}`);
      }

      // Check if the oldest record in this batch is before our target
      const oldestTime = records[records.length - 1].time;
      if (oldestTime <= startTime) {
        console.log('  Reached target time boundary');
        reachedTargetTime = true;
        break;
      }

      // If we got less than limit, we've reached the end
      if (records.length < 1000) {
        console.log('  Reached end of available data');
        break;
      }

      // Continue from just before the oldest record
      currentEndTime = oldestTime - 1;
      console.log('');
    } catch (error) {
      console.error('Error:', error.response?.data || error.message);
      break;
    }
  }

  console.log('');
  console.log('='.repeat(60));
  console.log(`Total records fetched: ${allRecords.length}`);

  // Count by date
  const byDate = {};
  allRecords.forEach(r => {
    const date = new Date(r.time).toISOString().split('T')[0];
    byDate[date] = (byDate[date] || 0) + 1;
  });

  console.log('Records by date:');
  Object.entries(byDate)
    .sort(([a], [b]) => a.localeCompare(b))
    .forEach(([date, count]) => {
      console.log(`  ${date}: ${count} records`);
    });

  // Check for today
  const today = new Date().toISOString().split('T')[0];
  console.log(`\nToday (${today}) included: ${byDate[today] ? 'YES (' + byDate[today] + ' records)' : 'NO'}`);
}

// Run the test
testReversePagination().catch(console.error);