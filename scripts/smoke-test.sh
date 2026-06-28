#!/usr/bin/env bash
# Smoke test — calls all 11 tools and shows output
# Run: bash scripts/smoke-test.sh
# Requires: npm run build to have been run first

set -e

SERVER="node dist/index.js"
PASS=0
FAIL=0

call_tool() {
  local name="$1"
  local args="$2"
  local payload="{\"jsonrpc\":\"2.0\",\"id\":1,\"method\":\"tools/call\",\"params\":{\"name\":\"$name\",\"arguments\":$args}}"
  local result
  result=$(echo "$payload" | $SERVER 2>/dev/null)
  if echo "$result" | grep -q '"isError":true'; then
    echo "✗ $name — ERROR"
    echo "$result" | python3 -c "import sys,json; r=json.load(sys.stdin); print('  ', r['result']['content'][0]['text'][:100])" 2>/dev/null
    FAIL=$((FAIL+1))
  else
    echo "✓ $name"
    echo "$result" | python3 -c "import sys,json; r=json.load(sys.stdin); print('  ', r['result']['content'][0]['text'].split(chr(10))[0])" 2>/dev/null
    PASS=$((PASS+1))
  fi
}

echo "xe-mcp smoke test"
echo "==================="

call_tool "get_rate" '{"from":"NZD","to":"USD"}'
call_tool "convert" '{"from":"NZD","to":"USD","amount":1000}'
call_tool "list_currencies" '{}'
call_tool "get_historical_rates" '{"from":"NZD","to":"USD","days":7}'
call_tool "volatility_analysis" '{"from":"NZD","to":"USD","days":14}'
call_tool "optimal_send_window" '{"from":"NZD","to":"USD","days":30}'
call_tool "nzd_corridors" '{}'
call_tool "correlation_analysis" '{"pair1_from":"NZD","pair1_to":"USD","pair2_from":"AUD","pair2_to":"USD","days":20}'
call_tool "rate_alert_check" '{"from":"NZD","to":"USD","threshold":0.58,"direction":"above"}'
call_tool "rate_chart" '{"from":"NZD","to":"USD","days":14}'
call_tool "moving_average" '{"from":"NZD","to":"USD","periods":[20,50]}'

echo ""
echo "==================="
echo "Results: $PASS passed, $FAIL failed"
[ $FAIL -eq 0 ] && echo "All tools working ✓" || echo "Some tools failed — check above"
