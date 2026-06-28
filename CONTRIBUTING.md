# Contributing to xe-mcp

Pull requests welcome. Here's how to work on this project.

## Quick start

```bash
git clone https://github.com/CedricConday/xe-mcp
cd xe-mcp
npm install
npm run build
npm test
bash scripts/smoke-test.sh
```

## Adding a tool

1. Create `src/tools/your-tool.ts` — export a tool definition and a handler
2. Register in `src/index.ts` — add to the tools list and the switch statement
3. Register in `lambda/handler.ts` — same switch, REST API path
4. Write tests in `src/__tests__/your-tool.test.ts` — cover the math, not the network
5. Add a test call to `scripts/smoke-test.sh`
6. Run `npm run build:all && npm test && bash scripts/smoke-test.sh`

See `src/tools/analysis.ts` for a pattern example.

## Credential detection

All tools must use the Frankfurter fallback:

```typescript
function hasXeCredentials(): boolean {
  return !!(process.env.XE_ACCOUNT_ID && process.env.XE_API_KEY);
}

// Then in each tool:
if (hasXeCredentials()) { /* Xe path */ }
else { /* Frankfurter path */ }
```

Never hardcode which source to use. Never require credentials to run.

## Tests

- Unit tests only — no live API calls in tests
- Test math and formatting logic directly from pure functions
- See `src/__tests__/volatility.test.ts` for the pattern
- All tests must pass before any PR is merged

## Commit style

```
feat: short description of what was added
fix: what was broken and what changed
docs: README, examples, CLAUDE.md
test: new or updated tests
ci: GitHub Actions, deployment config
build: package.json, tsconfig, SAM template
```

## What fits here

- FX and currency-related tools only
- Tools that work without credentials (Frankfurter fallback required)
- Tools with corresponding unit tests
- Lambda handler registration for any new tool

## What doesn't fit

- Non-FX tools (crypto, stocks, etc.)
- Tools that require credentials to function
- Tools without tests
