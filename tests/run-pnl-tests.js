/* eslint-disable @typescript-eslint/no-require-imports */
/**
 * Master Test Runner for PnL Data Consistency
 *
 * This script runs all PnL-related tests and provides a comprehensive
 * report on data consistency, cache behavior, and session integration.
 *
 * Usage:
 *   node tests/run-pnl-tests.js
 *   npm run test:pnl (if added to package.json)
 */

// const fs = require('fs');
// const path = require('path');
const { loadTestConfig } = require('./loadTestConfig');

// Import all test suites
const { runAllTests: runDataConsistencyTests } = require('./test-pnl-data-consistency');
const { runChartIntegrationTests } = require('./test-chart-data-integration');
const { runSessionMergingTests } = require('./test-session-data-merging');
const { runCacheBehaviorTests } = require('./test-cache-behavior');

// Overall test results
const overallResults = {
  suites: {},
  totalPassed: 0,
  totalFailed: 0,
  totalTime: 0,
  startTime: Date.now()
};

function logSection(title) {
  const border = '='.repeat(60);
  console.log('\n' + border);
  console.log(`🧪 ${title}`);
  console.log(border);
}

function logSubSection(title) {
  console.log('\n' + '-'.repeat(40));
  console.log(`📋 ${title}`);
  console.log('-'.repeat(40));
}

async function checkPrerequisites() {
  logSection('Checking Prerequisites');

  // Check if config exists and has API credentials
  try {
    const config = loadTestConfig();
    if (!config.api || !config.api.apiKey || !config.api.secretKey) {
      console.log('❌ API credentials not configured!');
      console.log('   Please add api.apiKey and api.secretKey to config.user.json');
      return false;
    }

    console.log('✅ Configuration loaded with API credentials');
  } catch (error) {
    console.log('❌ Failed to load configuration:', error.message);
    return false;
  }

  // Check if API server is running
  try {
    const axios = require('axios');
    await axios.get('http://localhost:3000/api/income?range=24h', { timeout: 5000 });
    console.log('✅ API server is running and responding');
  } catch (error) {
    console.log('❌ API server not responding!');
    console.log('   Please start the development server: npm run dev');
    console.log('   Error:', error.message);
    return false;
  }

  console.log('✅ All prerequisites met');
  return true;
}

async function runTestSuite(name, testFunction, description) {
  logSubSection(`${name}: ${description}`);

  const start = Date.now();

  try {
    const success = await testFunction();
    const time = Date.now() - start;

    overallResults.suites[name] = {
      success,
      time,
      description
    };

    const status = success ? '✅ PASSED' : '❌ FAILED';
    console.log(`\n${status}: ${name} (${time}ms)`);

    return success;
  } catch (error) {
    const time = Date.now() - start;

    overallResults.suites[name] = {
      success: false,
      time,
      error: error.message,
      description
    };

    console.log(`\n❌ CRASHED: ${name} (${time}ms)`);
    console.log(`Error: ${error.message}`);

    return false;
  }
}

function generateDetailedReport() {
  logSection('Detailed Test Report');

  Object.entries(overallResults.suites).forEach(([name, result]) => {
    const status = result.success ? '✅' : '❌';
    const time = `${result.time}ms`;

    console.log(`\n${status} ${name}`);
    console.log(`   Description: ${result.description}`);
    console.log(`   Time: ${time}`);

    if (result.error) {
      console.log(`   Error: ${result.error}`);
    }
  });
}

function generateSummaryReport() {
  logSection('Executive Summary');

  const totalTime = Date.now() - overallResults.startTime;
  const suiteCount = Object.keys(overallResults.suites).length;
  const passedSuites = Object.values(overallResults.suites).filter(s => s.success).length;
  const failedSuites = suiteCount - passedSuites;

  console.log(`\n📊 Test Execution Summary:`);
  console.log(`   Total Test Suites: ${suiteCount}`);
  console.log(`   Passed Suites: ${passedSuites}`);
  console.log(`   Failed Suites: ${failedSuites}`);
  console.log(`   Success Rate: ${((passedSuites / suiteCount) * 100).toFixed(1)}%`);
  console.log(`   Total Time: ${totalTime}ms (${(totalTime / 1000).toFixed(1)}s)`);

  console.log(`\n🎯 Test Coverage:`);
  console.log(`   ✅ API Data Consistency - Verifies 24h vs 7d data matches`);
  console.log(`   ✅ Chart Integration - Tests data processing logic`);
  console.log(`   ✅ Session Merging - Validates real-time data integration`);
  console.log(`   ✅ Cache Behavior - Ensures optimal performance`);

  if (failedSuites === 0) {
    console.log(`\n🎉 ALL TESTS PASSED!`);
    console.log(`   Your PnL data consistency fixes are working correctly.`);
    console.log(`   The 24h loss should now appear consistently in 7d view.`);
  } else {
    console.log(`\n⚠️  ${failedSuites} TEST SUITE(S) FAILED`);
    console.log(`   Please review the detailed report above.`);
    console.log(`   Common issues:`);
    console.log(`   • API server not running (npm run dev)`);
    console.log(`   • Missing API credentials in config.user.json`);
    console.log(`   • Network connectivity issues`);
    console.log(`   • Incorrect data format from API`);
  }

  console.log(`\n📋 Next Steps:`);
  if (failedSuites === 0) {
    console.log(`   1. Test the actual UI to confirm 24h vs 7d consistency`);
    console.log(`   2. Make some test trades to verify real-time integration`);
    console.log(`   3. Monitor cache performance in production`);
  } else {
    console.log(`   1. Fix any failing tests`);
    console.log(`   2. Re-run this test suite`);
    console.log(`   3. Check browser console for additional debugging info`);
  }
}

function generateTroubleshootingGuide() {
  const failedSuites = Object.entries(overallResults.suites)
    .filter(([_, result]) => !result.success);

  if (failedSuites.length === 0) return;

  logSection('Troubleshooting Guide');

  failedSuites.forEach(([name, _result]) => {
    console.log(`\n❌ ${name} Failed`);

    switch (name) {
      case 'Data Consistency':
        console.log(`   Possible causes:`);
        console.log(`   • API returning different data for 24h vs 7d`);
        console.log(`   • Session data not integrating properly`);
        console.log(`   • Date boundary issues (timezone problems)`);
        console.log(`   Fix: Check API logs and verify date handling`);
        break;

      case 'Chart Integration':
        console.log(`   Possible causes:`);
        console.log(`   • Chart processing logic has bugs`);
        console.log(`   • Session data merging incorrectly`);
        console.log(`   • Filtering logic removing data unexpectedly`);
        console.log(`   Fix: Review PnLChart.tsx data processing`);
        break;

      case 'Session Merging':
        console.log(`   Possible causes:`);
        console.log(`   • Double-counting session + historical data`);
        console.log(`   • Session data not replacing historical properly`);
        console.log(`   • Empty session data handling issues`);
        console.log(`   Fix: Verify session replacement logic`);
        break;

      case 'Cache Behavior':
        console.log(`   Possible causes:`);
        console.log(`   • Cache TTL too long, serving stale data`);
        console.log(`   • Cache not invalidating on new trades`);
        console.log(`   • Memory issues with cache storage`);
        console.log(`   Fix: Adjust cache TTL or add invalidation`);
        break;

      default:
        console.log(`   Check the error message and logs above`);
    }
  });
}

// Main test runner
async function runAllPnLTests() {
  console.log('🚀 PnL Data Consistency Test Suite');
  console.log('===================================');
  console.log('This comprehensive test suite verifies that the PnL chart');
  console.log('displays consistent data across different time ranges and');
  console.log('properly integrates real-time session data.');
  console.log('');

  // Check prerequisites
  const prerequisitesPassed = await checkPrerequisites();
  if (!prerequisitesPassed) {
    console.log('\n❌ Prerequisites not met. Please fix the issues above and try again.');
    process.exit(1);
  }

  // Run all test suites
  const results = [];

  results.push(await runTestSuite(
    'Data Consistency',
    runDataConsistencyTests,
    'Verifies 24h and 7d views show the same data for today'
  ));

  results.push(await runTestSuite(
    'Chart Integration',
    runChartIntegrationTests,
    'Tests chart component data processing and filtering logic'
  ));

  results.push(await runTestSuite(
    'Session Merging',
    runSessionMergingTests,
    'Validates session data replaces historical data correctly'
  ));

  results.push(await runTestSuite(
    'Cache Behavior',
    runCacheBehaviorTests,
    'Ensures cache provides performance without stale data'
  ));

  // Generate reports
  generateDetailedReport();
  generateTroubleshootingGuide();
  generateSummaryReport();

  // Return overall success
  const allPassed = results.every(result => result);
  return allPassed;
}

// Run tests if called directly
if (require.main === module) {
  runAllPnLTests()
    .then(success => {
      console.log('\n' + '='.repeat(60));
      process.exit(success ? 0 : 1);
    })
    .catch(error => {
      console.error('\n❌ Test runner crashed:', error);
      console.error('Stack trace:', error.stack);
      process.exit(1);
    });
}

module.exports = { runAllPnLTests };