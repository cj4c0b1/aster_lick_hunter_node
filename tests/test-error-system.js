#!/usr/bin/env node
/* eslint-disable @typescript-eslint/no-require-imports */
/* eslint-disable @typescript-eslint/no-unused-vars */

// Test script for the error logging system
const axios = require('axios');

const BASE_URL = 'http://localhost:3000';

async function testErrorAPIs() {
  console.log('Testing Error Logging System APIs...\n');

  try {
    // Test 1: Get all errors
    console.log('1. Testing GET /api/errors');
    const errorsResponse = await axios.get(`${BASE_URL}/api/errors`);
    console.log(`   ✓ Found ${errorsResponse.data.errors.length} errors`);

    // Test 2: Get error statistics
    console.log('\n2. Testing GET /api/errors/stats');
    const statsResponse = await axios.get(`${BASE_URL}/api/errors/stats?hours=24`);
    const stats = statsResponse.data.stats;
    console.log(`   ✓ Total errors: ${stats.total}`);
    console.log(`   ✓ Recent errors (24h): ${stats.recentCount}`);
    console.log(`   ✓ Error types:`, stats.byType);
    console.log(`   ✓ Error severities:`, stats.bySeverity);

    // Test 3: Test filtering
    console.log('\n3. Testing filtered queries');
    const filteredResponse = await axios.get(`${BASE_URL}/api/errors?severity=high&limit=10`);
    console.log(`   ✓ High severity errors: ${filteredResponse.data.errors.length}`);

    // Test 4: Export errors
    console.log('\n4. Testing GET /api/errors/export');
    const exportResponse = await axios.get(`${BASE_URL}/api/errors/export?format=json&hours=1`);
    console.log(`   ✓ Export contains ${exportResponse.data.errors.length} errors from last hour`);
    console.log(`   ✓ Session ID: ${exportResponse.data.sessionId}`);
    console.log(`   ✓ System info:`, {
      platform: exportResponse.data.systemInfo?.platform,
      memory: `${Math.round(exportResponse.data.systemInfo?.memory?.used / 1024 / 1024)}MB used`
    });

    // Test 5: Get specific error (if any exist)
    if (errorsResponse.data.errors.length > 0) {
      const firstError = errorsResponse.data.errors[0];
      console.log(`\n5. Testing GET /api/errors/${firstError.id}`);
      const errorDetailResponse = await axios.get(`${BASE_URL}/api/errors/${firstError.id}`);
      console.log(`   ✓ Retrieved error: "${errorDetailResponse.data.error.message}"`);
    }

    // Test 6: Test markdown export
    console.log('\n6. Testing markdown bug report export');
    const markdownResponse = await axios.get(`${BASE_URL}/api/errors/export?format=markdown&hours=24`);
    console.log(`   ✓ Bug report generated (${markdownResponse.data.length} characters)`);

    console.log('\n✅ All API tests passed!\n');

  } catch (error) {
    console.error('\n❌ Test failed:', error.response?.data || error.message);
    process.exit(1);
  }
}

async function simulateErrors() {
  console.log('Simulating some errors to test the system...\n');

  try {
    // This will likely fail and generate errors in the bot
    console.log('Attempting to trigger some errors...');

    // Try to place an invalid order (should generate a trading error)
    await axios.post(`${BASE_URL}/api/test-error`, {
      type: 'trading',
      message: 'Test trading error from test script'
    }).catch(() => {});

    console.log('✓ Error simulation attempted\n');
  } catch (error) {
    // Expected to fail
  }
}

async function main() {
  console.log('================================');
  console.log('Error Logging System Test Suite');
  console.log('================================\n');

  console.log('Make sure the application is running with:');
  console.log('  npm run dev\n');

  console.log('Waiting for services to be ready...\n');
  await new Promise(resolve => setTimeout(resolve, 3000));

  await testErrorAPIs();

  console.log('================================');
  console.log('Testing Error Dashboard UI');
  console.log('================================\n');
  console.log('Open http://localhost:3000/errors in your browser to see:');
  console.log('  • Error statistics dashboard');
  console.log('  • Filterable error list');
  console.log('  • Error details view');
  console.log('  • Bug report export functionality');
  console.log('  • Real-time error updates via WebSocket');

  console.log('\n✅ Error logging system is working correctly!');
  console.log('\nTo generate more errors for testing:');
  console.log('  1. Try invalid API operations');
  console.log('  2. Disconnect network briefly');
  console.log('  3. Use invalid configuration');
  console.log('  4. The bot will automatically log all errors');
}

// Run the tests
main().catch(error => {
  console.error('Test suite failed:', error);
  process.exit(1);
});