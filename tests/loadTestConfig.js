/* eslint-disable @typescript-eslint/no-require-imports */
const fs = require('fs');
const path = require('path');

/**
 * Load test configuration from user config
 * @returns {Object} Parsed config object
 */
function loadTestConfig() {
  // Try config.user.json first (new system)
  const userConfigPath = path.join(__dirname, '..', 'config.user.json');

  if (fs.existsSync(userConfigPath)) {
    return JSON.parse(fs.readFileSync(userConfigPath, 'utf-8'));
  }

  // Fallback to config.json if it still exists (legacy)
  const legacyConfigPath = path.join(__dirname, '..', 'config.json');

  if (fs.existsSync(legacyConfigPath)) {
    console.warn('⚠️  Using legacy config.json. Please run: npm run setup:config');
    return JSON.parse(fs.readFileSync(legacyConfigPath, 'utf-8'));
  }

  // No config found
  console.error('❌ No configuration found!');
  console.error('   Please run: npm run setup:config');
  console.error('   Then add your API keys to config.user.json');
  process.exit(1);
}

module.exports = { loadTestConfig };