# xe-mcp

An MCP server for the [Xe Currency Data API](https://www.xe.com/xecurrencydata/) — brings live FX rates, historical analysis, and quant-flavored tools directly into Claude Code, Claude Desktop, and any MCP-compatible AI tool.

**Works out of the box with zero credentials** — falls back to Frankfurter (ECB data) automatically. Plug in Xe API keys to switch to Xe's live data.

---

## Tools

| Tool | What it does |
|---|---|
| `get_rate` | Live mid-market rate between any two currencies |
| `convert` | Convert an amount at the current rate |
| `list_currencies` | All Xe-supported currencies (requires Xe key) |
| `get_historical_rates` | Daily rates for a currency pair over N days |
| `volatility_analysis` | Daily std-dev + annualised vol — log-return methodology (FX options standard) |
| `optimal_send_window` | Percentile rank of today's rate in the N-day distribution + verdict |
| `nzd_corridors` | NZD snapshot across USD, AUD, EUR, GBP, JPY, SGD, CNY in one call |
| `correlation_analysis` | Pearson r of daily log-returns between two currency pairs |
| `rate_alert_check` | Check if a rate has crossed a threshold — returns triggered: YES/NO + distance |

---

## Live output examples

```
> get_rate NZD USD
1 NZD = 0.564940 USD (Frankfurter/ECB, 2026-06-26)

> optimal_send_window NZD USD
NZD→USD send window (Frankfurter/ECB)
Current rate:  0.564940
30-day mean:   0.580598
30-day range:  0.563860 – 0.597400
Percentile:    14th (3/21 historical days were lower)
Verdict:       UNFAVOURABLE — bottom quartile
Timestamp:     2026-06-26

> volatility_analysis NZD USD 30
NZD/USD — 30-day volatility (Frankfurter/ECB)
Current rate:       0.564940
Range (30d):        0.563860 – 0.597400
Daily volatility:   0.4023%
Annualised vol:     6.39%
Data points used:   21

> correlation_analysis NZD USD AUD USD 30
Correlation: NZD/USD vs AUD/USD (Frankfurter/ECB, 30d)
Pearson r:       0.8553
Interpretation:  strong positive
Data points:     20 aligned trading days
```

---

## Setup

### Zero-credential mode (Frankfurter/ECB)

All tools except `list_currencies` work with no API keys using free ECB data via [Frankfurter](https://www.frankfurter.app/).

```bash
git clone https://github.com/CedricConday/xe-mcp
cd xe-mcp
npm install && npm run build
```

Add to Claude Code:

```bash
claude mcp add xe-mcp node /path/to/xe-mcp/dist/index.js
```

### With Xe API (live rates)

Get credentials at [xe.com/xecurrencydata](https://www.xe.com/xecurrencydata/), then:

```bash
claude mcp add xe-mcp node /path/to/xe-mcp/dist/index.js \
  -e XE_ACCOUNT_ID=your_account_id \
  -e XE_API_KEY=your_api_key
```

Or add to `.claude/settings.json`:

```json
{
  "mcpServers": {
    "xe-mcp": {
      "command": "node",
      "args": ["/path/to/xe-mcp/dist/index.js"],
      "env": {
        "XE_ACCOUNT_ID": "your_account_id",
        "XE_API_KEY": "your_api_key"
      }
    }
  }
}
```

### Claude Code slash command

This repo ships a `/fx` command for quick analysis. Add it to your project:

```bash
cp -r .claude/commands /your-project/.claude/
```

Then use `/fx NZDUSD`, `/fx NZDUSD vol`, `/fx convert 1000 NZD USD`.

---

## Architecture

```
xe-mcp/
├── src/
│   ├── index.ts              # MCP server (stdio transport)
│   ├── xe-client.ts          # Xe XECD API wrapper (authenticated)
│   ├── frankfurter-client.ts # Frankfurter ECB API (free fallback)
│   └── tools/
│       ├── rates.ts          # get_rate, convert, list_currencies
│       ├── analysis.ts       # get_historical_rates, volatility_analysis, optimal_send_window
│       ├── nzd.ts            # nzd_corridors
│       └── correlation.ts    # correlation_analysis
├── src/__tests__/
│   ├── volatility.test.ts    # Math tests: vol formula, percentile logic
│   └── correlation.test.ts   # Pearson r: edge cases, known properties
└── .github/workflows/ci.yml  # Test → Build → verify on push
```

**Data flow:** Claude Code ↔ stdio ↔ MCP server → Xe XECD API (or Frankfurter fallback) → structured text response.

**Credential detection:** `XE_ACCOUNT_ID` + `XE_API_KEY` in env → Xe. Otherwise → Frankfurter. No config needed.

---

## Tests

```bash
npm test
# Test Suites: 2 passed
# Tests:       19 passed
```

Tests cover: zero-volatility edge cases, constant-return series, annualised vol formula (× √252), percentile distribution, Pearson r properties (perfect correlation, inverse, zero-variance), and NZD/AUD co-movement sanity.

---

## Why

Xe's developer job posting requires "daily use of agentic coding tools (Claude Code or equivalent)." I built the tool I'd want if I were working on Xe's FX data pipeline — one that brings rate intelligence into the coding environment without tabbing out.

The quant tools (`volatility_analysis`, `optimal_send_window`, `correlation_analysis`) come from time in currency markets. They're not wrappers around a stock analytics library; the math is direct log-return methodology with test coverage.

---

## Stack

TypeScript · Node.js · `@modelcontextprotocol/sdk` · Xe XECD API · Frankfurter API

## License

MIT
