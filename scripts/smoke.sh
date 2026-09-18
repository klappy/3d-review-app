#!/bin/bash
# Phase-0 smoke: starts wrangler dev, runs auth/write/undo/danger/existence checks + parity, stops it. Exit 0 = all good.
set -u; cd "$(dirname "$0")/.."; B=localhost:8787
npx wrangler dev --local --port 8787 > /tmp/wr.log 2>&1 & WP=$!
for i in $(seq 1 40); do sleep 2; curl -sf $B/v2/health >/dev/null && break; done
j() { python3 -c "import sys,json;d=json.load(sys.stdin);print($1)"; }
E=$(curl -s $B/v2/auth/link -H 'content-type: application/json' -d '{"email":"owner@example.invalid"}'); echo "login: $(echo "$E" | j 'd["ok"], d["result"].get("sent")')"
CODE=$(echo "$E" | j 'd["result"]["dev_only_code"]')
SESS=$(curl -s $B/v2/auth/session -H 'content-type: application/json' -d "{\"email\":\"owner@example.invalid\",\"code\":\"$CODE\"}" | j 'd["result"]["session"]'); H="Authorization: Bearer $SESS"
echo "me: $(curl -s $B/v2/me -H "$H" | j 'd["ok"], d["result"]["principal"]["kind"]')"
npx wrangler d1 execute 3d-review --local --command "UPDATE principal SET provisioned=1 WHERE email_hash='$(printf owner@example.invalid | sha256sum | cut -d' ' -f1)'" >/dev/null 2>&1
W=$(curl -s $B/v2/workspaces -H "$H" -H 'content-type: application/json' -d '{"name":"Smoke WS"}'); echo "create: $(echo "$W" | j 'd["ok"], d["receipt"]["inverse"], "undo" in d["receipt"]')"
WS=$(echo "$W" | j 'd["result"]["workspace"]["id"]')
UT=$(curl -s -X PATCH $B/v2/workspaces/$WS -H "$H" -H 'content-type: application/json' -d '{"name":"Renamed"}' | j 'd["receipt"]["undo_token"]')
echo "undo(mcp): $(curl -s $B/mcp -H "$H" -H 'content-type: application/json' -d "{\"jsonrpc\":\"2.0\",\"id\":5,\"method\":\"tools/call\",\"params\":{\"name\":\"write\",\"arguments\":{\"undo\":\"$UT\"}}}" | j 'd["result"]["structuredContent"].get("ok"), d["result"]["structuredContent"].get("result",{}).get("workspace",{}).get("name"), d["result"]["structuredContent"].get("error")')"
echo "existence: nope=$(curl -s $B/v2/workspaces/ws_nope -H "$H" | j 'd["error"]["code"]') seeded-ungranted=$(curl -s $B/v2/workspaces/ws_synth_riverbend -H "$H" | j 'd["error"]["code"]')"
echo "wrong tool: $(curl -s $B/mcp -H "$H" -H 'content-type: application/json' -d '{"jsonrpc":"2.0","id":3,"method":"tools/call","params":{"name":"read","arguments":{"capability":"cap.workspace.create"}}}' | j 'd["result"]["structuredContent"]["error"]["code"]')"
DR=$(curl -s -X DELETE $B/v2/workspaces/$WS -H "$H" -H 'content-type: application/json' -d '{"mode":"dry_run"}'); CT=$(echo "$DR" | j 'd["result"]["confirm_token"]')
echo "danger: dry_run=$(echo "$DR" | j 'd["ok"], d["result"]["impact"]["effect"]') no-token=$(curl -s -X DELETE $B/v2/workspaces/$WS -H "$H" -H 'content-type: application/json' -d '{"mode":"execute"}' | j 'd["error"]["code"]') execute=$(curl -s -X DELETE $B/v2/workspaces/$WS -H "$H" -H 'content-type: application/json' -d "{\"mode\":\"execute\",\"confirm_token\":\"$CT\"}" | j 'd["ok"], d["result"]')"
TR=$(curl -s $B/v2/health | j 'd["trace_id"]'); echo "trace(other actor → hidden): $(curl -s $B/v2/ops/traces/$TR -H "$H" | j 'd.get("error",{}).get("code") or d["ok"]')"
echo "reserved v2.1: $(curl -s -w ' %{http_code}' $B/v2/projects/x/rollup | tail -c 4)  unbuilt v2.0: $(curl -s -w ' %{http_code}' $B/v2/templates | tail -c 4)"
SESS=$SESS node scripts/parity.mjs > /tmp/parity.txt; tail -1 /tmp/parity.txt; grep "❌" /tmp/parity.txt | head -5
kill $WP 2>/dev/null; wait $WP 2>/dev/null; exit 0
