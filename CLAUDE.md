# xe-mcp — Claude Code Instructions

## What this project is

An MCP server for the Xe Currency Data API. Eleven tools spanning rate lookup, conversion, historical analysis, volatility, moving averages, correlation, alert checking, and charting. Falls back to Frankfurter (ECB) when Xe credentials aren't set.

## Build and test

```bash
npm install            # install deps
npm run build          # compile TypeScript → dist/ (MCP server)
npm run build:lambda   # compile → dist-lambda/ (Lambda handlers)
npm run build:all      # compile both
npm test               # run Jest unit tests (31 tests, 3 suites)
bash scripts/smoke-test.sh  # 11/11 live tool smoke test (requires npm run build first)
```

Build must pass before any commit. Tests must pass before any PR.

## Architecture

```
src/
├── index.ts              # MCP server entry — 11 tools, stdio transport
├── xe-client.ts          # Xe XECD API wrapper (auth: HTTP Basic)
├── frankfurter-client.ts # ECB fallback (free, no auth)
├── s3-cache.ts           # S3-backed rate history cache (Lambda use)
└── tools/
    ├── rates.ts          # get_rate, convert, list_currencies
    ├── analysis.ts       # get_historical_rates, volatility_analysis, optimal_send_window, moving_average
    ├── nzd.ts            # nzd_corridors
    ├── correlation.ts    # correlation_analysis
    ├── alerts.ts         # rate_alert_check
    └── chart.ts          # rate_chart

lambda/
├── handler.ts            # REST API — all 11 tools via POST /tool/{name}
├── alert-scheduler.ts    # CloudWatch hourly → DynamoDB → SQS
└── alert-processor.ts    # SQS consumer → SES email
```

## Adding a new tool

1. Create `src/tools/your-tool.ts` with a tool definition object and handler function
2. Import and register both in `src/index.ts` (tools list + switch case)
3. Also register in `lambda/handler.ts` switch statement
4. Write tests in `src/__tests__/your-tool.test.ts` covering the math or logic
5. Add the tool to `scripts/smoke-test.sh`
6. Rebuild and run tests before committing

## Credential detection pattern

Every tool checks `process.env.XE_ACCOUNT_ID && process.env.XE_API_KEY` and falls back to Frankfurter. New tools must follow this pattern — don't hardcode which source to use.

## Testing approach

- Unit tests only for mathematical functions (volatility, correlation, percentile, SMA)
- No API calls in tests — compute directly from test data
- Tool handlers are tested via the live MCP server (smoke-test.sh)

## What not to do

- Don't add tools that aren't FX/currency-related
- Don't remove the Frankfurter fallback — it's what makes this usable without credentials
- Don't commit without running `npm run build && npm test`
- Don't add a tool to `src/index.ts` without also adding it to `lambda/handler.ts`
