/**
 * Test to verify the UI logic for separate trade sizes
 */

console.log('🎨 Testing UI Trade Size Logic');
console.log('='.repeat(50));

// Simulate the UI toggle behavior
interface UISymbolConfig {
  tradeSize: number;
  longTradeSize?: number;
  shortTradeSize?: number;
}

function simulateToggleOn(config: UISymbolConfig): UISymbolConfig {
  // When toggling on, initialize with current tradeSize if not already set
  return {
    ...config,
    longTradeSize: config.longTradeSize ?? config.tradeSize,
    shortTradeSize: config.shortTradeSize ?? config.tradeSize,
  };
}

function simulateToggleOff(config: UISymbolConfig): UISymbolConfig {
  // When toggling off, clear separate values
  const { longTradeSize: _longTradeSize, shortTradeSize: _shortTradeSize, ...rest } = config;
  return rest;
}

function getEffectiveTradeSizes(config: UISymbolConfig): { long: number; short: number } {
  return {
    long: config.longTradeSize ?? config.tradeSize,
    short: config.shortTradeSize ?? config.tradeSize,
  };
}

// Test scenarios
const tests = [
  {
    name: 'Toggle ON from simple config',
    initial: { tradeSize: 100 },
    action: simulateToggleOn,
    expectedLong: 100,
    expectedShort: 100,
  },
  {
    name: 'Toggle OFF from separate config',
    initial: { tradeSize: 100, longTradeSize: 150, shortTradeSize: 75 },
    action: simulateToggleOff,
    expectedLong: 100, // Falls back to tradeSize
    expectedShort: 100, // Falls back to tradeSize
  },
  {
    name: 'Toggle ON when already has values',
    initial: { tradeSize: 100, longTradeSize: 200, shortTradeSize: 50 },
    action: simulateToggleOn,
    expectedLong: 200, // Keeps existing value
    expectedShort: 50,  // Keeps existing value
  },
];

let allPassed = true;

tests.forEach((test, index) => {
  console.log(`\n📝 Test ${index + 1}: ${test.name}`);
  console.log('-'.repeat(40));

  console.log('Initial config:', JSON.stringify(test.initial));

  const result = test.action(test.initial);
  console.log('After action:', JSON.stringify(result));

  const effective = getEffectiveTradeSizes(result);
  console.log(`Effective sizes: Long=${effective.long}, Short=${effective.short}`);

  const passed = effective.long === test.expectedLong && effective.short === test.expectedShort;

  if (passed) {
    console.log('✅ Test PASSED');
  } else {
    console.log('❌ Test FAILED');
    console.log(`  Expected: Long=${test.expectedLong}, Short=${test.expectedShort}`);
    console.log(`  Got: Long=${effective.long}, Short=${effective.short}`);
    allPassed = false;
  }
});

// Test the initialization behavior
console.log('\n📝 Special Test: New Symbol Addition');
console.log('-'.repeat(40));

const defaultConfig: UISymbolConfig = {
  tradeSize: 100,
  // No separate sizes by default
};

console.log('Default config for new symbol:', JSON.stringify(defaultConfig));

const withToggleOn = simulateToggleOn(defaultConfig);
console.log('After enabling separate sizes:', JSON.stringify(withToggleOn));

const effectiveSizes = getEffectiveTradeSizes(withToggleOn);
console.log(`Effective: Long=${effectiveSizes.long}, Short=${effectiveSizes.short}`);

if (effectiveSizes.long === 100 && effectiveSizes.short === 100) {
  console.log('✅ Initialization test PASSED');
} else {
  console.log('❌ Initialization test FAILED');
  allPassed = false;
}

console.log('\n' + '='.repeat(50));
if (allPassed) {
  console.log('✅ All UI tests PASSED!');
  console.log('\n🎉 UI trade size logic is working correctly!');
} else {
  console.log('❌ Some UI tests FAILED');
  process.exit(1);
}