# /fx — FX Rate Analysis

Quick FX analysis using the xe-mcp tools. Usage:

```
/fx NZDUSD          → current rate + 30d optimal send window
/fx NZDUSD vol      → 30-day volatility analysis
/fx NZDUSD history  → last 30 days of daily rates
/fx convert 1000 NZD USD → convert amount
```

## Instructions

When this command is invoked, parse the argument and call the appropriate xe-mcp tool:

- `$ARGUMENTS` is a currency pair (e.g. `NZDUSD`) → split into from=NZD, to=USD, then call **get_rate** AND **optimal_send_window** together and present both results.
- `$ARGUMENTS` ends in `vol` → call **volatility_analysis** for the pair.
- `$ARGUMENTS` ends in `history` → call **get_historical_rates** for the pair.
- `$ARGUMENTS` starts with `convert` → parse `convert AMOUNT FROM TO` and call **convert**.

Present results in a clean, readable format. If the MCP server is not connected, explain how to add it:

```bash
claude mcp add xe-mcp node /path/to/xe-mcp/dist/index.js
```

No credentials needed — Frankfurter (ECB) data works out of the box. Set XE_ACCOUNT_ID and XE_API_KEY for Xe's live rates.
