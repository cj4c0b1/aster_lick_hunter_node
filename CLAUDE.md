# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Type
This is a Next.js 15 application with TypeScript that appears to be a cryptocurrency trading application focused on monitoring market events.

## Development Commands

```bash
# Install dependencies
npm install

# Run development server with Turbopack
npm run dev

# Build for production with Turbopack
npm run build --turbopack

# Start production server
npm start

# Run linting
npm run lint

# Check TypeScript types
npx tsc --noEmit
```

## Project Structure

- **src/app/**: Next.js app directory with layouts and pages
- **src/lib/**: Core business logic
  - `types.ts`: TypeScript type definitions for the application
  - `api/`: API interaction modules for authentication and exchange operations
  - `bot/`: Trading bot logic and position management
- **src/components/**: React components
- **config.json**: Application configuration file

## Key Dependencies

- **Next.js 15**: React framework with App Router
- **ethers**: Ethereum/blockchain interactions
- **axios**: HTTP client for API calls
- **ws**: WebSocket client for real-time data
- **recharts**: Data visualization
- **zod**: Schema validation
- **Tailwind CSS v4**: Styling framework

## TypeScript Configuration

The project uses strict TypeScript with path aliasing:
- `@/*` maps to `./src/*`
- Target: ES2017
- Module resolution: bundler

## API Structure

The application interacts with an exchange API at `https://fapi.asterdex.com` using:
- HMAC SHA256 signature authentication
- WebSocket connections for real-time data streams
- RESTful endpoints for trading operations

## Important Notes

- The application uses API key/secret authentication stored in `config.json`
- Paper mode is available for testing without real trades
- WebSocket connections automatically reconnect on failure
- Position management includes automatic stop-loss and take-profit order placement

## Known Issues

- TypeScript error in `src/lib/api/orders.ts` line 116: Required parameter after optional parameter
- Several ESLint warnings about `any` types that should be properly typed