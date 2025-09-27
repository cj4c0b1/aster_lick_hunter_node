#!/usr/bin/env node
/* eslint-disable @typescript-eslint/no-require-imports */

// Enhanced test script that adds sample errors to test UI features
const axios = require('axios');
const { errorLogsDb } = require('../src/lib/db/errorLogsDb');
const { errorLogger } = require('../src/lib/services/errorLogger');

const BASE_URL = 'http://localhost:3000';

async function generateSampleErrors() {
  console.log('Generating sample errors for UI testing...\n');

  try {
    // Initialize the database
    await errorLogsDb.initialize();

    // Generate various types of errors
    const sampleErrors = [
      {
        error: new Error('WebSocket connection failed: ECONNREFUSED'),
        type: 'websocket',
        severity: 'high',
        context: {
          component: 'Hunter',
          symbol: 'BTCUSDT',
          userAction: 'Connecting to liquidation stream',
          metadata: { url: 'wss://fstream.asterdex.com/ws/!forceOrder@arr', attemptCount: 3 }
        }
      },
      {
        error: new Error('API Rate limit exceeded (429)'),
        type: 'api',
        severity: 'medium',
        context: {
          component: 'PositionManager',
          userAction: 'Placing protective orders',
          metadata: { endpoint: '/fapi/v1/order', method: 'POST', statusCode: 429 }
        }
      },
      {
        error: new Error('Insufficient balance for trade'),
        type: 'trading',
        severity: 'high',
        context: {
          component: 'Hunter',
          symbol: 'ETHUSDT',
          userAction: 'Placing limit order',
          metadata: { required: 1000, available: 500, leverage: 10 }
        }
      },
      {
        error: new Error('Invalid API credentials'),
        type: 'config',
        severity: 'critical',
        context: {
          component: 'AsterBot',
          userAction: 'Initializing bot',
          metadata: { configFile: 'config.user.json' }
        }
      },
      {
        error: new Error('Order rejected: Price out of range'),
        type: 'trading',
        severity: 'medium',
        context: {
          component: 'Hunter',
          symbol: 'SOLUSDT',
          userAction: 'Placing stop loss order',
          metadata: { price: 150.25, minPrice: 140, maxPrice: 145 }
        }
      },
      {
        error: new Error('Database connection lost'),
        type: 'system',
        severity: 'critical',
        context: {
          component: 'Database',
          userAction: 'Storing liquidation event',
          metadata: { dbPath: './data/liquidations.db', errorCode: 'SQLITE_BUSY' }
        }
      },
      {
        error: new Error('WebSocket message parsing failed'),
        type: 'websocket',
        severity: 'low',
        context: {
          component: 'PositionManager',
          userAction: 'Processing user data stream',
          metadata: { messageType: 'ACCOUNT_UPDATE', parseError: 'Unexpected token' }
        }
      },
      {
        error: new Error('Notional value too small'),
        type: 'trading',
        severity: 'medium',
        context: {
          component: 'Hunter',
          symbol: 'BTCUSDT',
          userAction: 'Adjusting order size',
          metadata: { minNotional: 5, actualNotional: 3.5 }
        }
      },
      {
        error: new Error('Network timeout during order placement'),
        type: 'api',
        severity: 'high',
        context: {
          component: 'PositionManager',
          symbol: 'BNBUSDT',
          userAction: 'Placing take profit order',
          metadata: { timeout: 10000, endpoint: '/fapi/v1/order' }
        }
      },
      {
        error: new Error('Configuration validation failed: Invalid leverage'),
        type: 'config',
        severity: 'high',
        context: {
          component: 'ConfigManager',
          userAction: 'Reloading configuration',
          metadata: { symbol: 'ADAUSDT', invalidValue: 150, maxAllowed: 125 }
        }
      },
      {
        error: new Error('Memory usage exceeded threshold'),
        type: 'system',
        severity: 'medium',
        context: {
          component: 'System',
          userAction: 'Monitoring system health',
          metadata: { usedMemory: '3.5GB', threshold: '3GB', uptime: 86400 }
        }
      },
      {
        error: new Error('Failed to cancel orphaned order'),
        type: 'general',
        severity: 'low',
        context: {
          component: 'PositionManager',
          symbol: 'DOTUSDT',
          userAction: 'Cleaning up orphaned orders',
          metadata: { orderId: 123456789, reason: 'Order already filled' }
        }
      }
    ];

    // Log each error with some time variance
    for (let i = 0; i < sampleErrors.length; i++) {
      const sample = sampleErrors[i];

      // Vary the timestamp to simulate errors over time
      const hoursAgo = Math.random() * 12; // Random time within last 12 hours
      const timestamp = new Date(Date.now() - hoursAgo * 60 * 60 * 1000);
      sample.error.timestamp = timestamp;

      await errorLogger.logError(
        sample.error,
        {
          type: sample.type,
          severity: sample.severity,
          context: sample.context,
          code: `ERR_${i + 1000}`
        }
      );

      console.log(`✓ Generated ${sample.type} error: "${sample.error.message}"`);
    }

    // Add some duplicate errors to test frequency tracking
    for (let i = 0; i < 3; i++) {
      await errorLogger.logError(
        new Error('WebSocket connection failed: ECONNREFUSED'),
        {
          type: 'websocket',
          severity: 'high',
          context: {
            component: 'Hunter',
            symbol: 'BTCUSDT',
            userAction: 'Reconnection attempt',
            metadata: { attemptNumber: i + 4 }
          }
        }
      );
    }

    console.log('\n✓ Generated 3 duplicate WebSocket errors for frequency testing');

    // Mark some errors as resolved for testing
    const errors = await errorLogsDb.getErrors(5, 0);
    if (errors.length > 2) {
      await errorLogsDb.markResolved(errors[0].id, 'Fixed by updating configuration');
      await errorLogsDb.markResolved(errors[1].id, 'Resolved after API key renewal');
      console.log('✓ Marked 2 errors as resolved for testing\n');
    }

  } catch (error) {
    console.error('Failed to generate sample errors:', error);
  }
}

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

    if (stats.topErrors && stats.topErrors.length > 0) {
      console.log(`   ✓ Most frequent error: "${stats.topErrors[0].message}" (${stats.topErrors[0].count} times)`);
    }

    // Test 3: Test filtering
    console.log('\n3. Testing filtered queries');
    const filteredResponse = await axios.get(`${BASE_URL}/api/errors?severity=high&limit=10`);
    console.log(`   ✓ High severity errors: ${filteredResponse.data.errors.length}`);

    const wsErrors = await axios.get(`${BASE_URL}/api/errors?type=websocket`);
    console.log(`   ✓ WebSocket errors: ${wsErrors.data.errors.length}`);

    // Test 4: Export errors
    console.log('\n4. Testing GET /api/errors/export');
    const exportResponse = await axios.get(`${BASE_URL}/api/errors/export?format=json&hours=24`);
    console.log(`   ✓ Export contains ${exportResponse.data.errors.length} errors from last 24 hours`);
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
      console.log(`   ✓ Error type: ${errorDetailResponse.data.error.error_type}`);
      console.log(`   ✓ Severity: ${errorDetailResponse.data.error.severity}`);
      if (errorDetailResponse.data.error.resolved) {
        console.log(`   ✓ Status: Resolved`);
      }
    }

    // Test 6: Test markdown export
    console.log('\n6. Testing markdown bug report export');
    const markdownResponse = await axios.get(`${BASE_URL}/api/errors/export?format=markdown&hours=24`);
    console.log(`   ✓ Bug report generated (${markdownResponse.data.length} characters)`);

    // Show a snippet of the markdown report
    const snippet = markdownResponse.data.substring(0, 200);
    console.log(`   ✓ Report preview: "${snippet}..."`);

    console.log('\n✅ All API tests passed!\n');

  } catch (error) {
    console.error('\n❌ Test failed:', error.response?.data || error.message);
    process.exit(1);
  }
}

async function main() {
  console.log('================================');
  console.log('Error Logging System Test Suite');
  console.log('With Sample Data Generation');
  console.log('================================\n');

  console.log('Make sure the application is running with:');
  console.log('  npm run dev\n');

  console.log('Waiting for services to be ready...\n');
  await new Promise(resolve => setTimeout(resolve, 3000));

  // First generate sample errors
  await generateSampleErrors();

  // Give the system a moment to process
  await new Promise(resolve => setTimeout(resolve, 1000));

  // Then test the APIs
  await testErrorAPIs();

  console.log('================================');
  console.log('Testing Error Dashboard UI');
  console.log('================================\n');
  console.log('Open http://localhost:3000/errors in your browser to see:');
  console.log('  • Error statistics with real data');
  console.log('  • Various error types and severities');
  console.log('  • Filterable error list');
  console.log('  • Error details with stack traces');
  console.log('  • Resolved errors marked differently');
  console.log('  • Bug report export with actual errors');
  console.log('  • Real-time error updates via WebSocket');

  console.log('\n✅ Error logging system is working correctly with sample data!');
  console.log('\nThe UI should now show:');
  console.log('  • ~15 sample errors of different types');
  console.log('  • Error frequency tracking (WebSocket errors repeated)');
  console.log('  • Mix of severities (critical, high, medium, low)');
  console.log('  • Some errors marked as resolved');
  console.log('  • Rich error details with metadata');

  // Clean up - close the database connection
  errorLogsDb.close();
}

// Run the tests
main().catch(error => {
  console.error('Test suite failed:', error);
  process.exit(1);
});