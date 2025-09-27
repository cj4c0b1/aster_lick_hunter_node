#!/usr/bin/env node

// Script to generate test errors via API endpoint
const axios = require('axios');

const BASE_URL = 'http://localhost:3000';

async function generateTestErrors() {
  console.log('================================');
  console.log('Generating Test Errors');
  console.log('================================\n');

  // Create a test endpoint to generate errors
  console.log('Creating test errors through the application...\n');

  // We'll trigger errors by making invalid API calls
  const testCases = [
    {
      description: 'Invalid API endpoint',
      request: () => axios.get(`${BASE_URL}/api/invalid-endpoint`).catch(() => {}),
    },
    {
      description: 'Invalid order request',
      request: () => axios.post(`${BASE_URL}/api/orders`, { invalid: 'data' }).catch(() => {}),
    },
    {
      description: 'Missing parameters',
      request: () => axios.get(`${BASE_URL}/api/positions`).catch(() => {}),
    },
  ];

  for (const test of testCases) {
    console.log(`Triggering: ${test.description}`);
    await test.request();
  }

  console.log('\n✅ Test error generation attempted');
  console.log('\nNote: The bot itself will generate real errors when:');
  console.log('  • WebSocket connections fail');
  console.log('  • API rate limits are hit');
  console.log('  • Trading errors occur');
  console.log('  • Configuration issues arise');
  console.log('  • System errors happen\n');
}

async function checkErrors() {
  try {
    const response = await axios.get(`${BASE_URL}/api/errors/stats`);
    const stats = response.data.stats;

    console.log('Current Error Statistics:');
    console.log(`  • Total errors: ${stats.total}`);
    console.log(`  • Recent errors (24h): ${stats.recentCount}`);

    if (Object.keys(stats.byType).length > 0) {
      console.log(`  • Error types:`, stats.byType);
    }

    if (Object.keys(stats.bySeverity).length > 0) {
      console.log(`  • Error severities:`, stats.bySeverity);
    }

    if (stats.topErrors && stats.topErrors.length > 0) {
      console.log(`\nMost frequent errors:`);
      stats.topErrors.slice(0, 3).forEach((error, i) => {
        console.log(`  ${i + 1}. "${error.message}" (${error.count} occurrences)`);
      });
    }
  } catch (error) {
    console.error('Failed to fetch error stats:', error.message);
  }
}

async function main() {
  await generateTestErrors();
  await checkErrors();

  console.log('\n================================');
  console.log('View Error Dashboard');
  console.log('================================\n');
  console.log('Open http://localhost:3000/errors to see:');
  console.log('  • Any errors that have been logged');
  console.log('  • Error filtering and search');
  console.log('  • Bug report generation');
  console.log('  • Error details and stack traces\n');

  console.log('To generate more realistic errors:');
  console.log('  1. Try disconnecting your network briefly');
  console.log('  2. Use invalid API credentials');
  console.log('  3. Try to place orders with insufficient balance');
  console.log('  4. The bot will log all errors automatically\n');
}

main();