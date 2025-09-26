/**
 * Test PnL Data Consistency Between Time Ranges
 *
 * This test verifies that the same trading data appears consistently
 * across different time range views (24h vs 7d) and that session data
 * is properly integrated without double-counting.
 */

const axios = require('axios');
const fs = require('fs');
const path = require('path');

// Test configuration
const API_BASE = 'http://localhost:3000/api';
const CONFIG_PATH = path.join(__dirname, '..', 'config.json');

// Load API credentials from config
let config;
try {
  config = JSON.parse(fs.readFileSync(CONFIG_PATH, 'utf-8'));
} catch (error) {
  console.error('❌ Failed to load config.json:', error.message);
  process.exit(1);
}

// Test results tracker
const testResults = {
  passed: 0,
  failed: 0,
  errors: []
};

function logTest(name, passed, details = '') {
  const status = passed ? '✅ PASS' : '❌ FAIL';
  console.log(`${status}: ${name}`);
  if (details) console.log(`   ${details}`);

  if (passed) {
    testResults.passed++;
  } else {
    testResults.failed++;
    testResults.errors.push({ name, details });
  }
}

function assertEqual(actual, expected, message) {
  const passed = actual === expected;
  logTest(message, passed, passed ? '' : `Expected: ${expected}, Got: ${actual}`);
  return passed;
}

function assertClose(actual, expected, tolerance, message) {
  const diff = Math.abs(actual - expected);
  const passed = diff <= tolerance;
  logTest(message, passed, passed ? '' : `Expected: ${expected} ± ${tolerance}, Got: ${actual} (diff: ${diff})`);
  return passed;
}

async function fetchPnLData(range) {
  try {
    const response = await axios.get(`${API_BASE}/income?range=${range}`);
    return response.data;
  } catch (error) {
    console.error(`❌ Failed to fetch ${range} data:`, error.message);
    return null;
  }
}

async function fetchRealtimePnL() {
  try {
    const response = await axios.get(`${API_BASE}/pnl/realtime`);
    return response.data;
  } catch (error) {
    console.error('❌ Failed to fetch realtime PnL:', error.message);
    return null;
  }
}

// Test 1: Data Consistency Between Time Ranges
async function testDataConsistency() {
  console.log('\n🔍 Testing Data Consistency Between Time Ranges...');

  const data24h = await fetchPnLData('24h');
  const data7d = await fetchPnLData('7d');

  if (!data24h || !data7d) {
    logTest('Data Consistency - API Calls', false, 'Failed to fetch data');
    return;
  }

  // Check that both APIs returned valid data
  logTest('24h API Response Valid',
    data24h.dailyPnL && Array.isArray(data24h.dailyPnL));
  logTest('7d API Response Valid',
    data7d.dailyPnL && Array.isArray(data7d.dailyPnL));

  // Get today's date
  const today = new Date().toISOString().split('T')[0];

  // Find today's data in both ranges
  const today24h = data24h.dailyPnL.find(d => d.date === today);
  const today7d = data7d.dailyPnL.find(d => d.date === today);

  console.log(`\n📊 Today's Data Comparison (${today}):`);
  console.log('24h data:', today24h);
  console.log('7d data:', today7d);

  if (today24h && today7d) {
    // Today's data should be identical between 24h and 7d
    assertClose(today24h.netPnl, today7d.netPnl, 0.01,
      'Today\'s Net PnL matches between 24h and 7d');
    assertClose(today24h.realizedPnl, today7d.realizedPnl, 0.01,
      'Today\'s Realized PnL matches between 24h and 7d');
    assertClose(today24h.commission, today7d.commission, 0.01,
      'Today\'s Commission matches between 24h and 7d');
    assertEqual(today24h.tradeCount, today7d.tradeCount,
      'Today\'s Trade Count matches between 24h and 7d');
  } else {
    logTest('Today\'s Data Presence', false,
      `24h has today: ${!!today24h}, 7d has today: ${!!today7d}`);
  }

  // Check that 7d includes all days from 24h
  const dates24h = new Set(data24h.dailyPnL.map(d => d.date));
  const dates7d = new Set(data7d.dailyPnL.map(d => d.date));

  const missing24hDates = [];
  for (const date of dates24h) {
    if (!dates7d.has(date)) {
      missing24hDates.push(date);
    }
  }

  logTest('7d includes all 24h dates', missing24hDates.length === 0,
    missing24hDates.length > 0 ? `Missing dates: ${missing24hDates.join(', ')}` : '');
}

// Test 2: Session Data Integration
async function testSessionDataIntegration() {
  console.log('\n🔄 Testing Session Data Integration...');

  const realtimeData = await fetchRealtimePnL();

  if (!realtimeData) {
    logTest('Session Data Integration - API Call', false, 'Failed to fetch realtime data');
    return;
  }

  logTest('Realtime API Response Valid',
    realtimeData.session && typeof realtimeData.session === 'object');

  if (realtimeData.session) {
    const session = realtimeData.session;
    console.log('\n📈 Session Data:');
    console.log(`Realized PnL: ${session.realizedPnl}`);
    console.log(`Commission: ${session.commission}`);
    console.log(`Funding Fee: ${session.fundingFee}`);
    console.log(`Trade Count: ${session.tradeCount}`);

    // Verify session data consistency
    const sessionNetPnL = session.realizedPnl + session.commission + session.fundingFee;
    assertClose(session.totalPnl, sessionNetPnL, 0.01,
      'Session total PnL equals sum of components');

    // Check for reasonable values
    logTest('Session data has reasonable values',
      Math.abs(session.realizedPnl) < 1000000 &&
      Math.abs(session.commission) < 10000 &&
      session.tradeCount >= 0);
  }
}

// Test 3: Aggregation Logic
async function testAggregationLogic() {
  console.log('\n🧮 Testing Aggregation Logic...');

  const data7d = await fetchPnLData('7d');

  if (!data7d || !data7d.dailyPnL) {
    logTest('Aggregation Logic - Data Available', false, 'No data to test');
    return;
  }

  // Test that each day's netPnl equals sum of components
  let aggregationErrors = 0;

  data7d.dailyPnL.forEach(day => {
    const calculatedNet = day.realizedPnl + day.commission + day.fundingFee;
    const diff = Math.abs(day.netPnl - calculatedNet);

    if (diff > 0.01) {
      aggregationErrors++;
      console.log(`❌ Aggregation error on ${day.date}: netPnl=${day.netPnl}, calculated=${calculatedNet}`);
    }
  });

  logTest('Daily PnL aggregation is correct', aggregationErrors === 0,
    aggregationErrors > 0 ? `${aggregationErrors} days with aggregation errors` : '');

  // Test metrics calculation
  if (data7d.metrics) {
    const metrics = data7d.metrics;
    const totalCalculated = data7d.dailyPnL.reduce((sum, day) => sum + day.netPnl, 0);

    assertClose(metrics.totalPnl, totalCalculated, 0.01,
      'Metrics total PnL matches sum of daily PnL');

    const profitableDays = data7d.dailyPnL.filter(d => d.netPnl > 0).length;
    const lossDays = data7d.dailyPnL.filter(d => d.netPnl < 0).length;

    assertEqual(metrics.profitableDays, profitableDays,
      'Metrics profitable days count is correct');
    assertEqual(metrics.lossDays, lossDays,
      'Metrics loss days count is correct');
  }
}

// Test 4: Cache Behavior (if we can test it)
async function testCacheBehavior() {
  console.log('\n💾 Testing Cache Behavior...');

  // Make two identical requests quickly
  const start1 = Date.now();
  const data1 = await fetchPnLData('7d');
  const time1 = Date.now() - start1;

  const start2 = Date.now();
  const data2 = await fetchPnLData('7d');
  const time2 = Date.now() - start2;

  logTest('Cache responses are identical',
    JSON.stringify(data1) === JSON.stringify(data2),
    'Cached and fresh data should be identical');

  logTest('Second request is faster (cached)', time2 < time1,
    `First: ${time1}ms, Second: ${time2}ms`);

  console.log(`📊 Request times: First=${time1}ms, Second=${time2}ms`);
}

// Test 5: Edge Cases
async function testEdgeCases() {
  console.log('\n🔍 Testing Edge Cases...');

  // Test with different time ranges
  const ranges = ['24h', '7d', '30d'];
  const results = {};

  for (const range of ranges) {
    results[range] = await fetchPnLData(range);
  }

  // All should return valid data
  for (const range of ranges) {
    logTest(`${range} returns valid data`,
      results[range] && results[range].dailyPnL && Array.isArray(results[range].dailyPnL));
  }

  // Longer ranges should include data from shorter ranges
  const today = new Date().toISOString().split('T')[0];

  if (results['24h'] && results['7d'] && results['30d']) {
    const hasToday24h = results['24h'].dailyPnL.some(d => d.date === today);
    const hasToday7d = results['7d'].dailyPnL.some(d => d.date === today);
    const hasToday30d = results['30d'].dailyPnL.some(d => d.date === today);

    if (hasToday24h) {
      logTest('If 24h has today, 7d should too', hasToday7d);
      logTest('If 24h has today, 30d should too', hasToday30d);
    }
  }
}

// Main test runner
async function runAllTests() {
  console.log('🧪 PnL Data Consistency Test Suite');
  console.log('=====================================');

  await testDataConsistency();
  await testSessionDataIntegration();
  await testAggregationLogic();
  await testCacheBehavior();
  await testEdgeCases();

  // Summary
  console.log('\n📊 Test Summary');
  console.log('===============');
  console.log(`✅ Passed: ${testResults.passed}`);
  console.log(`❌ Failed: ${testResults.failed}`);
  console.log(`📈 Success Rate: ${((testResults.passed / (testResults.passed + testResults.failed)) * 100).toFixed(1)}%`);

  if (testResults.failed > 0) {
    console.log('\n❌ Failed Tests:');
    testResults.errors.forEach(error => {
      console.log(`  • ${error.name}: ${error.details}`);
    });
  }

  console.log('\n' + '='.repeat(50));

  return testResults.failed === 0;
}

// Run tests if called directly
if (require.main === module) {
  runAllTests()
    .then(success => {
      process.exit(success ? 0 : 1);
    })
    .catch(error => {
      console.error('❌ Test suite failed:', error);
      process.exit(1);
    });
}

module.exports = { runAllTests, testResults };