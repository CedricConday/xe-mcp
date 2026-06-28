# xe-mcp

An MCP server for the [Xe Currency Data API](https://www.xe.com/xecurrencydata/) — brings live FX rates, historical analysis, and quant-flavored tools directly into Claude Code, Claude Desktop, and any MCP-compatible AI tool.

**Works out of the box with zero credentials** — falls back to Frankfurter (ECB data) automatically. Plug in Xe API keys to switch to Xe's live data.

---

## Tools

| Tool | What it does |
|---|---|
| `get_rate` | Live mid-market rate between any two currencies |
| `convert` | Convert an amount at the current rate |
| `list_currencies` | Common currencies (built-in); full Xe list (~170 currencies) with Xe key |
| `get_historical_rates` | Daily rates for a currency pair over N days |
| `volatility_analysis` | Daily std-dev + annualised vol — log-return methodology (FX options standard) |
| `optimal_send_window` | Percentile rank of today's rate in the N-day distribution + verdict |
| `nzd_corridors` | NZD snapshot across USD, AUD, EUR, GBP, JPY, SGD, CNY in one call |
| `correlation_analysis` | Pearson r of daily log-returns between two currency pairs |
| `rate_alert_check` | Check if a rate has crossed a threshold — returns triggered: YES/NO + distance |
| `rate_chart` | ASCII line chart of a currency pair's rate history in the terminal |
| `moving_average` | SMA(20/50/200) with current rate and % distance from each average |

---

## Live output examples

All examples below use Frankfurter/ECB — no API key required.

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

> moving_average NZD USD
NZD/USD — moving averages (Frankfurter/ECB)
Current rate: 0.564940

SMA(20):  0.579758  (current is 2.56% below)
SMA(50):  insufficient data (need 50 days, have 36)

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

> rate_chart NZD USD 30
NZD/USD — last 30 trading days (Frankfurter/ECB)
  0.5974 │●●               
         │  ●●             
         │    ●●●          
         │       ●●        
  0.5806 │         ●●│   │ 
         │               ●●│
         │                 ●│
         │                  ●│
  0.5639 │                   ●●●
         └─────────────────────
          05-29     06-12  06-26
```

---

## Setup

### Zero-credential mode (Frankfurter/ECB)

All 11 tools work with no API keys using free ECB data via [Frankfurter](https://www.frankfurter.app/). `list_currencies` returns a built-in common currency list; with Xe credentials it returns the full ~170 currency list.

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

### Local (MCP stdio server)

```
Claude Code ↔ stdio ↔ xe-mcp ──→ Xe XECD API (if credentialed)
                                └→ Frankfurter/ECB (free fallback)
```

```
xe-mcp/
├── src/
│   ├── index.ts              # MCP server (stdio transport)
│   ├── xe-client.ts          # Xe XECD API wrapper (authenticated)
│   ├── frankfurter-client.ts # Frankfurter ECB API (free fallback)
│   ├── s3-cache.ts           # S3-backed rate history cache (Lambda use)
│   └── tools/
│       ├── rates.ts          # get_rate, convert, list_currencies
│       ├── analysis.ts       # get_historical_rates, volatility_analysis, optimal_send_window
│       ├── nzd.ts            # nzd_corridors
│       ├── correlation.ts    # correlation_analysis
│       ├── alerts.ts         # rate_alert_check
│       └── chart.ts          # rate_chart (ASCII)
├── lambda/
│   ├── handler.ts            # REST Lambda — all 10 tools via POST /tool/{name}
│   ├── alert-scheduler.ts    # CloudWatch hourly → DynamoDB scan → SQS publish
│   └── alert-processor.ts    # SQS consumer → SES email notification
├── src/__tests__/            # 39 unit tests (4 suites)
├── .github/workflows/
│   ├── ci.yml                # Test → Build → verify on push
│   └── deploy.yml            # Test → Build → SAM deploy to AWS (ap-southeast-2)
├── Dockerfile                # Multi-stage Alpine — local & ECS/K8s deployments
└── template.yml              # SAM: Lambda + API Gateway + SQS + DynamoDB + S3
```

### AWS deployment (`sam deploy`)

```
API Gateway → handler Lambda → Xe/Frankfurter → response
CloudWatch Events (hourly) → alert-scheduler Lambda → DynamoDB → SQS
                                                                  ↓
                                                     alert-processor Lambda → SES email
DynamoDB: alert configurations (userId, from, to, threshold, direction)
S3: rate history cache (90-day TTL, reduces external API calls)
```

**Credential detection:** `XE_ACCOUNT_ID` + `XE_API_KEY` in env → Xe. Otherwise → Frankfurter. Same fallback in Lambda and locally.

---

## Stack coverage

Built to match the full-stack requirements stated in Xe.com's developer role descriptions. Every item below has working code in this repo.

| Requirement | Where it lives |
|---|---|
| TypeScript | `src/`, `lambda/` — full codebase |
| MCP / agentic tooling | `src/index.ts` — stdio transport, 10 registered tools |
| AWS Lambda | `lambda/handler.ts` — REST API over all 10 tools |
| AWS SQS | `lambda/alert-scheduler.ts` → publishes; `lambda/alert-processor.ts` → consumes |
| AWS DynamoDB | `lambda/alert-scheduler.ts` — scans `AlertsTable`; SAM GSI on `userId` |
| AWS S3 | `src/s3-cache.ts` — rate history cache; bucket in `template.yml` |
| SQLite (local) | `src/sqlite-store.ts` — optional rate history cache via `RATE_DB_PATH`; same schema works on PostgreSQL |
| AWS SES | `lambda/alert-processor.ts` — sends email on alert trigger |
| AWS API Gateway | `template.yml` — wired to `XeMcpFunction` |
| CloudWatch Events | `template.yml` — hourly schedule trigger on `AlertSchedulerFunction` |
| SAM / IaC | `template.yml` — full stack as code, `sam build && sam deploy` |
| CI/CD (GitHub Actions) | `.github/workflows/ci.yml` — test → build → verify; `deploy.yml` — deploy to ap-southeast-2 |
| Docker | `Dockerfile` — multi-stage Alpine build for ECS / local |
| FX domain knowledge | `optimal_send_window`, `volatility_analysis`, `correlation_analysis` — log-return methodology |

---

## Tests

```bash
npm test
# Test Suites: 4 passed
# Tests:       39 passed
```

Tests cover: zero-volatility edge cases, constant-return series, annualised vol formula (× √252), percentile distribution, Pearson r properties (perfect correlation, inverse, zero-variance), NZD/AUD co-movement sanity, SMA computation (period ordering, edge cases, distance from SMA), SQLite schema (PK constraints, upsert behavior, range query ordering, index verification).

---

## Why

Xe's developer job posting requires "daily use of agentic coding tools (Claude Code or equivalent)." I built the tool I'd want if I were working on Xe's FX data pipeline — one that brings rate intelligence into the coding environment without tabbing out.

The quant tools (`volatility_analysis`, `optimal_send_window`, `correlation_analysis`) come from time in currency markets. They're not wrappers around a stock analytics library; the math is direct log-return methodology with test coverage.

---

## Stack

TypeScript · Node.js · `@modelcontextprotocol/sdk` · Xe XECD API · Frankfurter API

## License

MIT
