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

// Test pagination for 7-day range
async function testPagination() {
  console.log('Testing pagination for 7-day range');
  console.log('='.repeat(60));

  const now = Date.now();
  const startTime = now - 7 * 24 * 60 * 60 * 1000;

  console.log(`Start: ${new Date(startTime).toISOString()}`);
  console.log(`End: ${new Date(now).toISOString()}`);
  console.log('');

  const allRecords = [];
  let currentEndTime = now;
  let batchNumber = 0;

  while (true) {
    batchNumber++;
    const params = {
      endTime: currentEndTime,
      limit: 1000,
      timestamp: Date.now(),
      recvWindow: 5000
    };

    // Only set startTime if we haven't gone past it
    if (currentEndTime > startTime) {
      params.startTime = startTime;
    }

    params.signature = createSignature(params, config.api.secretKey);

    console.log(`Batch ${batchNumber}:`);
    console.log(`  Start: ${params.startTime ? new Date(params.startTime).toISOString() : 'none'}`);
    console.log(`  End: ${new Date(params.endTime).toISOString()}`);

    try {
      const response = await axios.get(`${BASE_URL}/fapi/v1/income`, {
        params,
        headers: {
          'X-MBX-APIKEY': config.api.apiKey
        }
      });

      const records = response.data;
      console.log(`  Records: ${records.length}`);

      if (records.length === 0) {
        console.log('  No more records');
        break;
      }

      allRecords.push(...records);

      // Show date range of this batch
      if (records.length > 0) {
        const dates = records.map(r => new Date(r.time).toISOString().split('T')[0]);
        const uniqueDates = [...new Set(dates)];
        console.log(`  Dates: ${uniqueDates.join(', ')}`);
        console.log(`  Oldest: ${new Date(records[records.length - 1].time).toISOString()}`);
      }

      // If we got less than limit, we've reached the end
      if (records.length < 1000) {
        console.log('  Reached end of data');
        break;
      }

      // Check if we've fetched everything needed
      const oldestTime = records[records.length - 1].time;
      if (oldestTime <= startTime) {
        console.log('  Reached start time boundary');
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
testPagination().catch(console.error);