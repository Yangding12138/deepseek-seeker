#!/usr/bin/env bash
# 给 deepseek-seeker Worker 绑自定义域 game.yangding.de5.net（DNS A + Worker route）
set -euo pipefail
T=$(cat /root/.hermes/cf-emby.token)
Z=ca488b99fcab111512bf9c96b6de17fc
HOST=game.yangding.de5.net
API=https://api.cloudflare.com/client/v4

echo "== 1. DNS 记录 =="
EXIST=$(curl -s "$API/zones/$Z/dns_records?name=$HOST" -H "Authorization: Bearer $T")
if echo "$EXIST" | grep -q '"count":0'; then
  curl -s -X POST "$API/zones/$Z/dns_records" -H "Authorization: Bearer $T" \
    -H "Content-Type: application/json" \
    -d "{\"type\":\"A\",\"name\":\"game\",\"content\":\"192.0.2.1\",\"proxied\":true,\"ttl\":1}" \
    | head -c 300; echo
else
  echo "已存在，跳过"
fi

echo "== 2. Worker 路由 =="
ROUTES=$(curl -s "$API/zones/$Z/workers/routes" -H "Authorization: Bearer $T")
if echo "$ROUTES" | grep -q "$HOST"; then
  echo "路由已存在，跳过"
else
  curl -s -X POST "$API/zones/$Z/workers/routes" -H "Authorization: Bearer $T" \
    -H "Content-Type: application/json" \
    -d "{\"pattern\":\"$HOST/*\",\"script\":\"deepseek-seeker\"}" | head -c 300; echo
fi

echo "== 3. 生效检查 =="
sleep 12
curl -s -o /dev/null -w "http=%{http_code} size=%{size_download}\n" "https://$HOST/"
