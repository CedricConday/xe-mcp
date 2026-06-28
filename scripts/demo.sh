#!/usr/bin/env bash
# xe-mcp live demo — runs all 11 tools with real output
# Use in interviews, presentations, or to verify everything works
# Requires: npm run build

set -e

SERVER="node dist/index.js"

call_tool() {
  local name="$1"
  local args="$2"
  local payload="{\"jsonrpc\":\"2.0\",\"id\":1,\"method\":\"tools/call\",\"params\":{\"name\":\"$name\",\"arguments\":$args}}"
  echo "$payload" | $SERVER 2>/dev/null | python3 -c "
import sys, json
r = json.load(sys.stdin)
print(r['result']['content'][0]['text'])
" 2>/dev/null
}

echo "════════════════════════════════════════════"
echo " xe-mcp — live demo"
echo " $(date -u '+%Y-%m-%d %H:%M UTC')"
echo " Source: Frankfurter/ECB (zero credentials)"
echo "════════════════════════════════════════════"

echo ""
echo "── 1. Current rate ─────────────────────────"
call_tool "get_rate" '{"from":"NZD","to":"USD"}'

echo ""
echo "── 2. Conversion ───────────────────────────"
call_tool "convert" '{"from":"NZD","to":"USD","amount":10000}'

echo ""
echo "── 3. NZD corridors snapshot ───────────────"
call_tool "nzd_corridors" '{}'

echo ""
echo "── 4. 30-day volatility ────────────────────"
call_tool "volatility_analysis" '{"from":"NZD","to":"USD","days":30}'

echo ""
echo "── 5. Optimal send window ──────────────────"
call_tool "optimal_send_window" '{"from":"NZD","to":"USD","days":30}'

echo ""
echo "── 6. Moving averages ──────────────────────"
call_tool "moving_average" '{"from":"NZD","to":"USD","periods":[20,50]}'

echo ""
echo "── 7. NZD/AUD correlation ──────────────────"
call_tool "correlation_analysis" '{"pair1_from":"NZD","pair1_to":"USD","pair2_from":"AUD","pair2_to":"USD","days":30}'

echo ""
echo "── 8. Rate alert check ─────────────────────"
call_tool "rate_alert_check" '{"from":"NZD","to":"USD","threshold":0.60,"direction":"above"}'

echo ""
echo "── 9. Rate chart ───────────────────────────"
call_tool "rate_chart" '{"from":"NZD","to":"USD","days":30}'

echo ""
echo "── 10. Historical rates (last 7 days) ──────"
call_tool "get_historical_rates" '{"from":"NZD","to":"USD","days":7}'

echo ""
echo "════════════════════════════════════════════"
echo " xe-mcp · github.com/CedricConday/xe-mcp"
echo "════════════════════════════════════════════"
