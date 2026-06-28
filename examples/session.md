# Example Claude Code session using xe-mcp

Once xe-mcp is added to your Claude Code config, you can ask FX questions naturally in conversation. This is a real session using Frankfurter/ECB data (no Xe key required).

---

**Q: What's the NZD/USD rate right now?**

```
> get_rate NZD USD
1 NZD = 0.564940 USD (Frankfurter/ECB, 2026-06-26)
```

---

**Q: I need to convert $5,000 NZD to USD for a transfer. What do I get?**

```
> convert NZD USD 5000
5000 NZD = 2824.7000 USD (rate: 0.564940, Frankfurter/ECB, 2026-06-26)
```

---

**Q: Is now a good time to send? Or should I wait?**

```
> optimal_send_window NZD USD

NZD→USD send window (Frankfurter/ECB)
Current rate:  0.564940
30-day mean:   0.580598
30-day range:  0.563860 – 0.597400
Percentile:    14th (3/21 historical days were lower)
Verdict:       UNFAVOURABLE — bottom quartile
Timestamp:     2026-06-26
```

→ Claude Code: "Today's rate is in the bottom 14% of the past 30 days. NZD is weak against USD right now. If timing is flexible, waiting for a recovery toward the 30-day mean (~0.58) would save you roughly 1.5% on the transfer."

---

**Q: How volatile has NZD/USD been?**

```
> volatility_analysis NZD USD 30

NZD/USD — 30-day volatility (Frankfurter/ECB)
Current rate:       0.564940
Range (30d):        0.563860 – 0.597400
Daily volatility:   0.4023%
Annualised vol:     6.39%
Data points used:   21
```

→ Claude Code: "6.4% annualised — that's moderate for a G10 currency pair. For context, typical NZD/USD vol runs 7–12% in periods of market stress. Right now it's calm."

---

**Q: Does NZD/USD tend to move with AUD/USD? I'm thinking about hedging.**

```
> correlation_analysis NZD USD AUD USD 30

Correlation: NZD/USD vs AUD/USD (Frankfurter/ECB, 30d)
Pearson r:       0.8553
Interpretation:  strong positive
Data points:     20 aligned trading days
```

→ Claude Code: "Strong positive correlation (0.86). NZD and AUD are highly correlated commodity currencies — if you hold a long NZD position, an AUD short would only partially hedge it. You'd need to account for the ~14% residual (non-correlated) component."

---

**Q: Give me a full NZD snapshot across all my trading pairs.**

```
> nzd_corridors

NZD corridors (Frankfurter/ECB)
Date: 2026-06-26

NZD/USD: 0.564940
NZD/AUD: 0.818490
NZD/EUR: 0.495520
NZD/GBP: 0.427400
NZD/JPY: 91.320000
NZD/SGD: 0.731130
NZD/CNY: 3.840500
```

---

**Q: Alert me if NZD/USD goes above 0.59.**

```
> rate_alert_check NZD USD 0.59 above

Alert check: NZD/USD above 0.59
Current rate: 0.564940 (Frankfurter/ECB, 2026-06-26)
Threshold:    0.59
Triggered:    NO ✗
→ Rate needs to move 0.025060 to trigger
```

→ Claude Code: "Not triggered. NZD/USD needs to gain 2.5 cents (about 4.4%) to hit your threshold. You could set up a polling loop to check this hourly:
```bash
watch -n 3600 'echo {...} | node dist/index.js'
```
"

---

**Q: Where does the current rate sit relative to the 20-day and 50-day moving averages?**

```
> moving_average NZD USD

NZD/USD — moving averages (Frankfurter/ECB)
Current rate: 0.564940

SMA(20):  0.579758  (current is 2.56% below)
SMA(50):  insufficient data (need 50 days, have 36)
```

→ Claude Code: "NZD/USD is 2.6% below its 20-day average — consistent with the bottom-quartile reading from optimal_send_window. A recovery toward the 20-day mean would add ~0.015 to the rate."

---

**Q: Show me a chart of the last 30 days.**

```
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

→ Claude Code: "Clear downtrend from ~0.597 in late May to ~0.565 now. The rate has lost about 3.5 cents (5.9%) in 30 days. The chart shows no reversal signal yet."

---

## Setup for this session

```
> pair_summary NZD USD
NZD/USD — daily summary (Frankfurter/ECB)
Rate:          0.564940
30d range:     0.563860 – 0.597400
30d percentile: 14th
Annualised vol: 6.39%
SMA(20):       0.579758  (-2.56%)
Send verdict:  UNFAVOURABLE ▼
```

---

## Setup

```bash
# Add to Claude Code
claude mcp add xe-mcp node /path/to/xe-mcp/dist/index.js

# Verify (lists all 12 tools)
claude mcp list

# Or run the demo script
bash scripts/demo.sh
```

No API key needed — all examples above use Frankfurter/ECB free data.
