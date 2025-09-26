# Configuration Migration Guide

## Important: Configuration System Changes

We've updated the configuration system to improve security and make it easier to manage settings. Your API keys are now better protected from accidental commits to git.

## What Changed

### Before (Old System)
- Single `config.json` file tracked by git
- Risk of accidentally committing API keys
- No automatic migration for new settings

### After (New System)
- `config.user.json` - Your personal config (not tracked by git)
- `config.default.json` - Default settings template
- `config.example.json` - Example configuration
- Automatic migration and field merging

## Migration Steps

### If you have an existing `config.json`:

1. **Automatic Migration** (happens automatically on bot startup)
   - The bot will automatically migrate your `config.json` to `config.user.json`
   - Add any missing fields from defaults
   - Keep all your existing settings

   Or run manually:
   ```bash
   npm run setup:config
   ```

2. **Remove from Git** (if it was tracked)
   ```bash
   git rm --cached config.json
   git commit -m "Remove config.json from tracking"
   ```

3. **Delete the old file** (optional, after confirming `config.user.json` works)
   ```bash
   rm config.json
   ```

### If you're setting up fresh:

1. **Run Setup** (or just start the bot - it will create the config automatically)
   ```bash
   npm run setup:config
   # OR
   npm run dev  # Config will be created on first run
   ```

2. **Edit your config**
   ```bash
   # Edit config.user.json and add your API keys
   ```

### Automatic Updates on Every Startup

**No manual action needed!** The bot automatically:
- Checks for missing fields when you start it
- Adds new fields from `config.default.json`
- Preserves all your existing settings
- Updates your `config.user.json` with any new fields

This means when you pull new releases with config changes, your configuration is automatically updated the next time you run the bot.

## Benefits

✅ **Security**: Your API keys are never at risk of being committed
✅ **Auto-updates**: New settings are automatically added when you update
✅ **Version control**: Safe defaults are tracked, personal settings are not
✅ **Easy setup**: New users get a working config immediately

## File Overview

| File | Purpose | Git Tracked | Contains Keys |
|------|---------|-------------|---------------|
| `config.user.json` | Your settings | ❌ No | ✅ Yes |
| `config.default.json` | Default template | ✅ Yes | ❌ No |
| `config.example.json` | Documentation | ✅ Yes | ❌ Example only |
| `config.json` (old) | Legacy config | ⚠️ Remove | ✅ Yes |

## Troubleshooting

### Bot can't find config
- Make sure `config.user.json` exists
- The bot will create it automatically on startup if missing
- Or run `npm run setup:config` to create it manually

### Missing new settings after git pull
- **This is handled automatically!**
- The bot adds missing fields from defaults on every startup
- No manual intervention needed - just start the bot normally

### Want to reset to defaults
- Delete `config.user.json`
- Run `npm run setup:config`
- Add your API keys back

## Technical Details

The new system:
1. Checks for `config.user.json` on startup
2. If missing, looks for legacy `config.json` and migrates it
3. If no config exists, creates from `config.default.json`
4. Automatically adds any missing fields from defaults
5. Validates the configuration before use

This ensures your config always has the latest fields while preserving your custom settings.