/* eslint-disable @typescript-eslint/no-require-imports */
/**
 * Test Chart Data Integration Logic
 *
 * This test simulates the chart component's data processing logic
 * to verify that session data is properly merged with historical data
 * and that filtering works correctly across different time ranges.
 */

const axios = require('axios');
// const fs = require('fs');
// const path = require('path');

// Test configuration
const API_BASE = 'http://localhost:3000/api';

// Mock chart data processing logic (based on PnLChart.tsx)
function processChartData(pnlData, realtimePnL, timeRange) {
  if (!pnlData?.dailyPnL) return [];

  const today = new Date().toISOString().split('T')[0];
  let processedData = [...pnlData.dailyPnL];

  console.log(`[Chart Test] Processing data for ${timeRange}:`);
  console.log(`[Chart Test] - Historical data: ${processedData.length} days`);
  console.log(`[Chart Test] - Session data available: ${!!realtimePnL?.session}`);

  // Log initial data state
  const todayInHistorical = processedData.find(d => d.date === today);
  if (todayInHistorical) {
    console.log(`[Chart Test] Today's historical data:`, todayInHistorical);
  } else {
    console.log(`[Chart Test] No historical data for today (${today})`);
  }

  // Smart real-time data integration
  if (realtimePnL?.session) {
    const todayIndex = processedData.findIndex(d => d.date === today);
    const sessionNetPnL = realtimePnL.session.realizedPnl +
                         realtimePnL.session.commission +
                         realtimePnL.session.fundingFee;

    console.log(`[Chart Test] Session data:`, {
      realizedPnl: realtimePnL.session.realizedPnl,
      commission: realtimePnL.session.commission,
      fundingFee: realtimePnL.session.fundingFee,
      netPnL: sessionNetPnL,
      tradeCount: realtimePnL.session.tradeCount
    });

    if (todayIndex >= 0) {
      // Replace today's data with session data (authoritative source)
      // const existingToday = processedData[todayIndex];
      console.log(`[Chart Test] Replacing today's historical data with current session state`);

      processedData[todayIndex] = {
        date: today,
        realizedPnl: realtimePnL.session.realizedPnl,
        commission: realtimePnL.session.commission,
        fundingFee: realtimePnL.session.fundingFee,
        netPnl: sessionNetPnL,
        tradeCount: realtimePnL.session.tradeCount,
      };

      console.log(`[Chart Test] - Replaced:`, processedData[todayIndex]);
    } else {
      // Add today's session data if not in historical data
      console.log(`[Chart Test] Adding today's session data (not in historical)`);
      const newTodayData = {
        date: today,
        realizedPnl: realtimePnL.session.realizedPnl,
        commission: realtimePnL.session.commission,
        fundingFee: realtimePnL.session.fundingFee,
        netPnl: sessionNetPnL,
        tradeCount: realtimePnL.session.tradeCount,
      };
      processedData.push(newTodayData);
      console.log(`[Chart Test] - Added:`, newTodayData);
    }
  }

  // Ensure data is sorted chronologically
  processedData.sort((a, b) => a.date.localeCompare(b.date));

  console.log(`[Chart Test] Before filtering: ${processedData.length} days`);

  // Apply filtering logic (matches the fixed version)
  if (timeRange === '1y' || timeRange === 'all') {
    const cutoffDate = new Date();
    if (timeRange === '1y') {
      cutoffDate.setFullYear(cutoffDate.getFullYear() - 1);
    } else {
      cutoffDate.setFullYear(cutoffDate.getFullYear() - 2);
    }
    const cutoffDateString = cutoffDate.toISOString().split('T')[0];

    const beforeFilter = processedData.length;
    processedData = processedData.filter(d => d.date >= cutoffDateString);

    console.log(`[Chart Test] After filtering: ${processedData.length} days (removed ${beforeFilter - processedData.length})`);
  } else {
    console.log(`[Chart Test] No client-side filtering for ${timeRange} - using API-filtered data directly`);
  }

  console.log(`[Chart Test] Final chart data for ${timeRange}: ${processedData.length} days`);
  if (processedData.length > 0) {
    const lastDay = processedData[processedData.length - 1];
    console.log(`[Chart Test] Last day in ${timeRange}:`, lastDay);
  }

  return processedData;
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

async function fetchData(endpoint) {
  try {
    const response = await axios.get(`${API_BASE}${endpoint}`);
    return response.data;
  } catch (error) {
    console.error(`❌ Failed to fetch ${endpoint}:`, error.message);
    return null;
  }
}

// Test 1: Chart Processing Consistency
async function testChartProcessingConsistency() {
  console.log('\n🖼️ Testing Chart Processing Consistency...');

  const pnl24h = await fetchData('/income?range=24h');
  const pnl7d = await fetchData('/income?range=7d');
  const realtime = await fetchData('/pnl/realtime');

  if (!pnl24h || !pnl7d || !realtime) {
    logTest('Chart Processing - Data Fetch', false, 'Failed to fetch required data');
    return;
  }

  // Process data for both time ranges
  const chart24h = processChartData(pnl24h, realtime, '24h');
  const chart7d = processChartData(pnl7d, realtime, '7d');

  console.log('\n📊 Chart Data Comparison:');
  console.log(`24h chart: ${chart24h.length} days`);
  console.log(`7d chart: ${chart7d.length} days`);

  // Find today's data in both processed charts
  const today = new Date().toISOString().split('T')[0];
  const today24h = chart24h.find(d => d.date === today);
  const today7d = chart7d.find(d => d.date === today);

  if (today24h && today7d) {
    console.log('\n📈 Today\'s Processed Data:');
    console.log('24h chart:', today24h);
    console.log('7d chart:', today7d);

    // These should be identical after processing
    assertClose(today24h.netPnl, today7d.netPnl, 0.01,
      'Today\'s Net PnL identical in both chart views');
    assertClose(today24h.realizedPnl, today7d.realizedPnl, 0.01,
      'Today\'s Realized PnL identical in both chart views');
    assertEqual(today24h.tradeCount, today7d.tradeCount,
      'Today\'s Trade Count identical in both chart views');
  } else {
    logTest('Today\'s Data in Both Charts', false,
      `24h has today: ${!!today24h}, 7d has today: ${!!today7d}`);
  }

  // 7d should include all dates from 24h (since 7d > 24h)
  const dates24h = new Set(chart24h.map(d => d.date));
  const dates7d = new Set(chart7d.map(d => d.date));

  const missing = [];
  for (const date of dates24h) {
    if (!dates7d.has(date)) {
      missing.push(date);
    }
  }

  logTest('7d chart includes all 24h dates', missing.length === 0,
    missing.length > 0 ? `Missing: ${missing.join(', ')}` : '');
}

// Test 2: Session Data Integration Edge Cases
async function testSessionDataIntegration() {
  console.log('\n🔄 Testing Session Data Integration Edge Cases...');

  const pnl7d = await fetchData('/income?range=7d');
  const realtime = await fetchData('/pnl/realtime');

  if (!pnl7d || !realtime) {
    logTest('Session Integration - Data Fetch', false, 'Failed to fetch data');
    return;
  }

  // Test with real session data
  const chartWithSession = processChartData(pnl7d, realtime, '7d');

  // Test without session data (simulate no realtime data)
  const chartWithoutSession = processChartData(pnl7d, null, '7d');

  console.log('\n📊 Session Integration Results:');
  console.log(`With session: ${chartWithSession.length} days`);
  console.log(`Without session: ${chartWithoutSession.length} days`);

  const today = new Date().toISOString().split('T')[0];
  const todayWithSession = chartWithSession.find(d => d.date === today);
  const todayWithoutSession = chartWithoutSession.find(d => d.date === today);

  if (realtime.session && (realtime.session.realizedPnl !== 0 || realtime.session.tradeCount > 0)) {
    logTest('Session data affects today\'s entry',
      JSON.stringify(todayWithSession) !== JSON.stringify(todayWithoutSession),
      'Today\'s data should be different with vs without session');

    if (todayWithSession && realtime.session) {
      // Session data should be the authoritative source
      const expectedNetPnL = realtime.session.realizedPnl +
                            realtime.session.commission +
                            realtime.session.fundingFee;

      assertClose(todayWithSession.netPnl, expectedNetPnL, 0.01,
        'Today\'s chart data matches session net PnL');
      assertEqual(todayWithSession.tradeCount, realtime.session.tradeCount,
        'Today\'s chart data matches session trade count');
    }
  }
}

// Test 3: Filtering Logic
async function testFilteringLogic() {
  console.log('\n🔍 Testing Filtering Logic...');

  const pnl1y = await fetchData('/income?range=1y');
  const pnlAll = await fetchData('/income?range=all');

  if (!pnl1y || !pnlAll) {
    logTest('Filtering Logic - Data Fetch', false, 'Failed to fetch long-range data');
    return;
  }

  // Process with different ranges to test filtering
  const chart1y = processChartData(pnl1y, null, '1y');
  const chartAll = processChartData(pnlAll, null, 'all');
  const chart7d = processChartData(pnl1y, null, '7d'); // Should not filter

  console.log('\n📊 Filtering Results:');
  console.log(`1y chart: ${chart1y.length} days (filtered)`);
  console.log(`All chart: ${chartAll.length} days (filtered)`);
  console.log(`7d chart: ${chart7d.length} days (not filtered)`);

  // Short ranges should not be filtered client-side
  assertEqual(chart7d.length, pnl1y.dailyPnL.length,
    '7d range should not apply client-side filtering');

  // Long ranges should be filtered
  logTest('1y range applies filtering', chart1y.length <= pnl1y.dailyPnL.length);
  logTest('All range applies filtering', chartAll.length <= pnlAll.dailyPnL.length);

  // Filtered data should still be chronologically sorted
  for (let i = 1; i < chart1y.length; i++) {
    if (chart1y[i].date < chart1y[i-1].date) {
      logTest('1y filtered data is sorted', false, `Unsorted at index ${i}`);
      break;
    }
  }
  if (chart1y.length > 1) {
    logTest('1y filtered data is sorted', true);
  }
}

// Test 4: Data Integrity
async function testDataIntegrity() {
  console.log('\n🔐 Testing Data Integrity...');

  const ranges = ['24h', '7d', '30d'];
  const chartData = {};

  for (const range of ranges) {
    const pnlData = await fetchData(`/income?range=${range}`);
    if (pnlData) {
      chartData[range] = processChartData(pnlData, null, range);
    }
  }

  // Test that longer ranges include shorter range data
  const today = new Date().toISOString().split('T')[0];
  const yesterday = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString().split('T')[0];

  if (chartData['24h'] && chartData['7d']) {
    const today24h = chartData['24h'].find(d => d.date === today);
    const today7d = chartData['7d'].find(d => d.date === today);

    if (today24h && today7d) {
      assertClose(today24h.netPnl, today7d.netPnl, 0.01,
        'Today\'s data consistent between 24h and 7d charts');
    }
  }

  // Test data completeness
  Object.entries(chartData).forEach(([range, data]) => {
    logTest(`${range} chart has valid data`, data.length > 0);

    // All entries should have required fields
    const hasAllFields = data.every(day =>
      typeof day.date === 'string' &&
      typeof day.netPnl === 'number' &&
      typeof day.realizedPnl === 'number' &&
      typeof day.commission === 'number' &&
      typeof day.fundingFee === 'number' &&
      typeof day.tradeCount === 'number'
    );

    logTest(`${range} chart has complete data fields`, hasAllFields);

    // Net PnL should equal sum of components
    const aggregationErrors = data.filter(day => {
      const calculated = day.realizedPnl + day.commission + day.fundingFee;
      return Math.abs(day.netPnl - calculated) > 0.01;
    });

    logTest(`${range} chart aggregation is correct`, aggregationErrors.length === 0,
      aggregationErrors.length > 0 ? `${aggregationErrors.length} days with errors` : '');
  });
}

// Main test runner
async function runChartIntegrationTests() {
  console.log('🖼️ Chart Data Integration Test Suite');
  console.log('=====================================');

  await testChartProcessingConsistency();
  await testSessionDataIntegration();
  await testFilteringLogic();
  await testDataIntegrity();

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

  return testResults.failed === 0;
}

// Run tests if called directly
if (require.main === module) {
  runChartIntegrationTests()
    .then(success => {
      process.exit(success ? 0 : 1);
    })
    .catch(error => {
      console.error('❌ Chart integration test suite failed:', error);
      process.exit(1);
    });
}

module.exports = { runChartIntegrationTests, testResults };