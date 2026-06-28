# xe-mcp

An MCP server for the [Xe Currency Data API](https://www.xe.com/xecurrencydata/) — brings live FX rates, historical data, and volatility analysis directly into Claude Code, Claude Desktop, and any MCP-compatible AI tool.

Ask Claude things like:
- *"What's the current NZD/USD rate?"*
- *"Is now a good time to convert EUR to GBP?"*
- *"What's the 30-day annualised volatility on NZD/JPY?"*

---

## Tools

| Tool | What it does |
|---|---|
| `get_rate` | Live mid-market rate between any two currencies |
| `convert` | Convert an amount at the current rate |
| `get_historical_rates` | Daily rates for a currency pair over the past N days |
| `volatility_analysis` | Daily std-dev + annualised vol (log-return methodology) |
| `optimal_send_window` | Where today's rate sits in the N-day distribution |

---

## Setup

**1. Get an Xe API key**

Sign up at [xe.com/xecurrencydata](https://www.xe.com/xecurrencydata/). The free tier covers development use.

**2. Install and build**

```bash
git clone https://github.com/CedricConday/xe-mcp
cd xe-mcp
npm install && npm run build
```

**3. Add to Claude Code**

```bash
claude mcp add xe-mcp node /path/to/xe-mcp/dist/index.js \
  -e XE_ACCOUNT_ID=your_account_id \
  -e XE_API_KEY=your_api_key
```

Or add to `.claude/settings.json` manually:

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

---

## Example output

```
> optimal_send_window NZD USD

NZD→USD send window analysis
Current rate:  0.601240
30-day mean:   0.594810
30-day range:  0.581200 – 0.612300
Percentile:    78th (21/27 historical days were lower)
Verdict:       FAVOURABLE — rate is in the top quartile of the past period
Timestamp:     2026-07-01T09:14:22Z
```

```
> volatility_analysis NZD USD 30

NZD/USD — 30-day analysis
Current rate:       0.601240
Range (30d):        0.581200 – 0.612300
Daily volatility:   0.4821%
Annualised vol:     7.66%
Data points used:   22
```

---

## Why

Xe engineers use Claude Code. I built the tool I'd want if I were working on the FX data pipeline — one that brings rate intelligence into the coding environment rather than making you tab out to a browser. The quant tools (`volatility_analysis`, `optimal_send_window`) come from time spent in currency markets; they're not stock analytics wrappers.

---

## Stack

TypeScript · Node.js · `@modelcontextprotocol/sdk` · Xe XECD API

## License

MIT
