// Simple test for trade size logic
const longTradeSize = 41.83;
const shortTradeSize = 41.83;

// Test our condition
const shouldIncludeSeparateSizes = Math.abs(longTradeSize - shortTradeSize) > 0.01;

console.log('longTradeSize:', longTradeSize);
console.log('shortTradeSize:', shortTradeSize);
console.log('Difference:', Math.abs(longTradeSize - shortTradeSize));
console.log('Should include separate sizes:', shouldIncludeSeparateSizes);

// Test config object creation
const config = {
  tradeSize: longTradeSize,
  ...(shouldIncludeSeparateSizes && {
    longTradeSize,
    shortTradeSize
  })
};

console.log('Final config:', JSON.stringify(config, null, 2));
