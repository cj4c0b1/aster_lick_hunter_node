/**
 * Test Session Data Merging Logic
 *
 * This test specifically focuses on how session PnL data is merged
 * with historical data to ensure no double-counting and proper
 * data consistency between different time ranges.
 */

const axios = require('axios');

// Test configuration
const API_BASE = 'http://localhost:3000/api';

// Mock PnL Service data (simulates different session states)
const mockSessionData = {
  withLoss: {
    session: {
      realizedPnl: -125.50,
      commission: -8.75,
      fundingFee: -2.25,
      totalPnl: -136.50,
      tradeCount: 15,
      startTime: Date.now() - 4 * 60 * 60 * 1000, // 4 hours ago
    }
  },
  withProfit: {
    session: {
      realizedPnl: 87.25,
      commission: -5.50,
      fundingFee: 1.75,
      totalPnl: 83.50,
      tradeCount: 8,
      startTime: Date.now() - 2 * 60 * 60 * 1000, // 2 hours ago
    }
  },
  empty: {
    session: {
      realizedPnl: 0,
      commission: 0,
      fundingFee: 0,
      totalPnl: 0,
      tradeCount: 0,
      startTime: Date.now(),
    }
  }
};

// Mock historical data scenarios
const mockHistoricalData = {
  withToday: {
    dailyPnL: [
      {
        date: '2025-09-24',
        realizedPnl: 45.20,
        commission: -3.15,
        fundingFee: 0.85,
        netPnl: 42.90,
        tradeCount: 6
      },
      {
        date: '2025-09-25',
        realizedPnl: -22.10,
        commission: -1.80,
        fundingFee: -0.50,
        netPnl: -24.40,
        tradeCount: 3
      },
      {
        date: new Date().toISOString().split('T')[0], // Today
        realizedPnl: 15.30,
        commission: -2.20,
        fundingFee: 0.15,
        netPnl: 13.25,
        tradeCount: 4
      }
    ]
  },
  withoutToday: {
    dailyPnL: [
      {
        date: '2025-09-24',
        realizedPnl: 45.20,
        commission: -3.15,
        fundingFee: 0.85,
        netPnl: 42.90,
        tradeCount: 6
      },
      {
        date: '2025-09-25',
        realizedPnl: -22.10,
        commission: -1.80,
        fundingFee: -0.50,
        netPnl: -24.40,
        tradeCount: 3
      }
    ]
  }
};

// Session data merging logic (matches PnLChart.tsx)
function mergeSessionData(historicalData, sessionData) {
  if (!historicalData?.dailyPnL) return [];

  const today = new Date().toISOString().split('T')[0];
  let processedData = [...historicalData.dailyPnL];

  console.log(`[Session Merge] Processing ${processedData.length} historical days`);
  console.log(`[Session Merge] Today: ${today}`);

  if (sessionData?.session) {
    const todayIndex = processedData.findIndex(d => d.date === today);
    const sessionNetPnL = sessionData.session.realizedPnl +
                         sessionData.session.commission +
                         sessionData.session.fundingFee;

    console.log(`[Session Merge] Session data:`, {
      realizedPnl: sessionData.session.realizedPnl,
      commission: sessionData.session.commission,
      fundingFee: sessionData.session.fundingFee,
      netPnL: sessionNetPnL,
      tradeCount: sessionData.session.tradeCount
    });

    if (todayIndex >= 0) {
      // Replace today's data with session data (authoritative source)
      const existingToday = processedData[todayIndex];
      console.log(`[Session Merge] Replacing historical today:`, existingToday);

      processedData[todayIndex] = {
        date: today,
        realizedPnl: sessionData.session.realizedPnl,
        commission: sessionData.session.commission,
        fundingFee: sessionData.session.fundingFee,
        netPnl: sessionNetPnL,
        tradeCount: sessionData.session.tradeCount,
      };

      console.log(`[Session Merge] With session today:`, processedData[todayIndex]);
    } else {
      // Add today's session data
      console.log(`[Session Merge] Adding session data as new today entry`);
      const newTodayData = {
        date: today,
        realizedPnl: sessionData.session.realizedPnl,
        commission: sessionData.session.commission,
        fundingFee: sessionData.session.fundingFee,
        netPnl: sessionNetPnL,
        tradeCount: sessionData.session.tradeCount,
      };
      processedData.push(newTodayData);
      console.log(`[Session Merge] Added:`, newTodayData);
    }
  }

  return processedData.sort((a, b) => a.date.localeCompare(b.date));
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

// Test 1: Session Data Replaces Historical Today
async function testSessionReplacesHistorical() {
  console.log('\n🔄 Testing Session Data Replaces Historical Today...');

  const historicalWithToday = mockHistoricalData.withToday;
  const sessionWithLoss = mockSessionData.withLoss;

  const merged = mergeSessionData(historicalWithToday, sessionWithLoss);

  const today = new Date().toISOString().split('T')[0];
  const todayData = merged.find(d => d.date === today);
  const originalToday = historicalWithToday.dailyPnL.find(d => d.date === today);

  logTest('Today exists in merged data', !!todayData);

  if (todayData && originalToday) {
    // Session data should completely replace historical data for today
    assertClose(todayData.realizedPnl, sessionWithLoss.session.realizedPnl, 0.01,
      'Today\'s realized PnL matches session (replaced historical)');

    assertEqual(todayData.tradeCount, sessionWithLoss.session.tradeCount,
      'Today\'s trade count matches session (replaced historical)');

    // Should NOT be the sum of historical + session
    const wouldBeDoubleCount = originalToday.realizedPnl + sessionWithLoss.session.realizedPnl;
    logTest('No double-counting occurred',
      Math.abs(todayData.realizedPnl - wouldBeDoubleCount) > 0.01,
      `Avoided double-count: ${wouldBeDoubleCount} vs actual: ${todayData.realizedPnl}`);

    // Net PnL should be calculated correctly
    const expectedNetPnL = sessionWithLoss.session.realizedPnl +
                          sessionWithLoss.session.commission +
                          sessionWithLoss.session.fundingFee;
    assertClose(todayData.netPnl, expectedNetPnL, 0.01,
      'Today\'s net PnL correctly calculated from session components');
  }
}

// Test 2: Session Data Added When No Historical Today
async function testSessionAddedWhenNoHistorical() {
  console.log('\n➕ Testing Session Data Added When No Historical Today...');

  const historicalWithoutToday = mockHistoricalData.withoutToday;
  const sessionWithProfit = mockSessionData.withProfit;

  const merged = mergeSessionData(historicalWithoutToday, sessionWithProfit);

  const today = new Date().toISOString().split('T')[0];
  const todayData = merged.find(d => d.date === today);

  logTest('Today added to data when not in historical', !!todayData);

  if (todayData) {
    // Should exactly match session data
    assertClose(todayData.realizedPnl, sessionWithProfit.session.realizedPnl, 0.01,
      'Added today\'s realized PnL matches session exactly');

    assertEqual(todayData.tradeCount, sessionWithProfit.session.tradeCount,
      'Added today\'s trade count matches session exactly');

    const expectedNetPnL = sessionWithProfit.session.realizedPnl +
                          sessionWithProfit.session.commission +
                          sessionWithProfit.session.fundingFee;
    assertClose(todayData.netPnl, expectedNetPnL, 0.01,
      'Added today\'s net PnL correctly calculated');
  }

  // Should have one more day than original
  assertEqual(merged.length, historicalWithoutToday.dailyPnL.length + 1,
    'Merged data has one additional day for today');

  // Should be sorted chronologically
  for (let i = 1; i < merged.length; i++) {
    if (merged[i].date < merged[i-1].date) {
      logTest('Merged data is chronologically sorted', false, `Unsorted at index ${i}`);
      return;
    }
  }
  logTest('Merged data is chronologically sorted', true);
}

// Test 3: Empty Session Data Handling
async function testEmptySessionHandling() {
  console.log('\n🔄 Testing Empty Session Data Handling...');

  const historicalWithToday = mockHistoricalData.withToday;
  const emptySession = mockSessionData.empty;

  const merged = mergeSessionData(historicalWithToday, emptySession);

  const today = new Date().toISOString().split('T')[0];
  const todayData = merged.find(d => d.date === today);
  const originalToday = historicalWithToday.dailyPnL.find(d => d.date === today);

  logTest('Today exists in merged data with empty session', !!todayData);

  if (todayData && originalToday) {
    // With empty session, today should be replaced with zeros
    assertClose(todayData.realizedPnl, 0, 0.01,
      'Empty session results in zero realized PnL');

    assertEqual(todayData.tradeCount, 0,
      'Empty session results in zero trade count');

    assertClose(todayData.netPnl, 0, 0.01,
      'Empty session results in zero net PnL');
  }
}

// Test 4: No Session Data Handling
async function testNoSessionHandling() {
  console.log('\n🚫 Testing No Session Data Handling...');

  const historicalWithToday = mockHistoricalData.withToday;

  const merged = mergeSessionData(historicalWithToday, null);

  // Should be identical to historical data
  assertEqual(merged.length, historicalWithToday.dailyPnL.length,
    'No session data preserves historical data length');

  const today = new Date().toISOString().split('T')[0];
  const todayData = merged.find(d => d.date === today);
  const originalToday = historicalWithToday.dailyPnL.find(d => d.date === today);

  if (todayData && originalToday) {
    assertClose(todayData.realizedPnl, originalToday.realizedPnl, 0.01,
      'No session preserves historical today\'s realized PnL');

    assertEqual(todayData.tradeCount, originalToday.tradeCount,
      'No session preserves historical today\'s trade count');
  }
}

// Test 5: Consistency Across Different Session States
async function testConsistencyAcrossStates() {
  console.log('\n🔄 Testing Consistency Across Different Session States...');

  const historical = mockHistoricalData.withToday;
  const today = new Date().toISOString().split('T')[0];

  // Test with different session states
  const states = {
    loss: mockSessionData.withLoss,
    profit: mockSessionData.withProfit,
    empty: mockSessionData.empty
  };

  const results = {};

  Object.entries(states).forEach(([stateName, sessionData]) => {
    const merged = mergeSessionData(historical, sessionData);
    const todayData = merged.find(d => d.date === today);
    results[stateName] = todayData;

    console.log(`\n📊 ${stateName} state - Today's data:`, todayData);
  });

  // Verify that each state produces different results (when they should)
  logTest('Loss state differs from profit state',
    results.loss.netPnl !== results.profit.netPnl,
    `Loss: ${results.loss.netPnl}, Profit: ${results.profit.netPnl}`);

  logTest('Empty state has zero values',
    results.empty.netPnl === 0 && results.empty.tradeCount === 0);

  // All should have today's date
  Object.entries(results).forEach(([state, data]) => {
    assertEqual(data.date, today, `${state} state has correct date`);
  });
}

// Test 6: Real API Integration
async function testRealAPIIntegration() {
  console.log('\n🌐 Testing Real API Integration...');

  try {
    // Fetch real data
    const pnl7d = await axios.get(`${API_BASE}/income?range=7d`);
    const realtime = await axios.get(`${API_BASE}/pnl/realtime`);

    if (pnl7d.data && realtime.data) {
      const merged = mergeSessionData(pnl7d.data, realtime.data);

      logTest('Real API data merges without errors', true);

      const today = new Date().toISOString().split('T')[0];
      const todayData = merged.find(d => d.date === today);

      if (todayData && realtime.data.session) {
        const sessionNetPnL = realtime.data.session.realizedPnl +
                             realtime.data.session.commission +
                             realtime.data.session.fundingFee;

        assertClose(todayData.netPnl, sessionNetPnL, 0.01,
          'Real API: Today\'s net PnL matches session calculation');

        console.log('\n📊 Real API Today\'s Data:');
        console.log('Session PnL:', sessionNetPnL);
        console.log('Chart PnL:', todayData.netPnl);
        console.log('Trade Count:', todayData.tradeCount);
      }
    }
  } catch (error) {
    logTest('Real API Integration', false, `API Error: ${error.message}`);
  }
}

// Main test runner
async function runSessionMergingTests() {
  console.log('🔄 Session Data Merging Test Suite');
  console.log('===================================');

  await testSessionReplacesHistorical();
  await testSessionAddedWhenNoHistorical();
  await testEmptySessionHandling();
  await testNoSessionHandling();
  await testConsistencyAcrossStates();
  await testRealAPIIntegration();

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
  runSessionMergingTests()
    .then(success => {
      process.exit(success ? 0 : 1);
    })
    .catch(error => {
      console.error('❌ Session merging test suite failed:', error);
      process.exit(1);
    });
}

module.exports = { runSessionMergingTests, testResults, mergeSessionData, mockSessionData, mockHistoricalData };