# xe-mcp — Claude Code Instructions

## What this project is

An MCP server for the Xe Currency Data API. Nine tools spanning rate lookup, conversion, historical analysis, volatility, correlation, and alert checking. Falls back to Frankfurter (ECB) when Xe credentials aren't set.

## Build and test

```bash
npm install       # install deps
npm run build     # compile TypeScript → dist/
npm test          # run Jest unit tests (19 tests, 2 suites)
```

Build must pass before any commit. Tests must pass before any PR.

## Architecture

```
src/
├── index.ts              # MCP server entry — adds tools, routes requests
├── xe-client.ts          # Xe XECD API wrapper (auth: HTTP Basic)
├── frankfurter-client.ts # ECB fallback (free, no auth)
└── tools/
    ├── rates.ts          # get_rate, convert, list_currencies
    ├── analysis.ts       # get_historical_rates, volatility_analysis, optimal_send_window
    ├── nzd.ts            # nzd_corridors
    ├── correlation.ts    # correlation_analysis
    └── alerts.ts         # rate_alert_check
```

## Adding a new tool

1. Create `src/tools/your-tool.ts` with a tool definition object and handler function
2. Import and register both in `src/index.ts` (tools list + switch case)
3. Write tests in `src/__tests__/your-tool.test.ts` covering the math or logic
4. Rebuild and run tests before committing

## Credential detection pattern

Every tool checks `process.env.XE_ACCOUNT_ID && process.env.XE_API_KEY` and falls back to Frankfurter. New tools must follow this pattern — don't hardcode which source to use.

## Testing approach

- Unit tests only for mathematical functions (volatility, correlation, percentile)
- No API calls in tests — mock or compute directly
- Tool handlers are tested via the live MCP server (manual, via stdio)

## What not to do

- Don't add tools that aren't FX/currency-related
- Don't remove the Frankfurter fallback — it's what makes this usable without credentials
- Don't commit without running `npm run build && npm test`
