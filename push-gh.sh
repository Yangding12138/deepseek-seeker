#!/usr/bin/env bash
# 建 GitHub 仓库并推送（token 从文件读，不落命令行）
set -euo pipefail
cd /root/dsw-game
T=$(cat /root/.hermes/.github_token)
NAME=deepseek-seeker
USER=Yangding12138

# 1. 建仓库（已存在则跳过）
CODE=$(curl -s -o /tmp/gh-create.json -w "%{http_code}" -X POST https://api.github.com/user/repos \
  -H "Authorization: token $T" -H "Accept: application/vnd.github+json" \
  -d "{\"name\":\"$NAME\",\"description\":\"小索 · 深求者 — DeepSeek 娘横版动作 H5 | 第一章 Demo\",\"private\":false,\"has_issues\":true}")
echo "create repo http=$CODE"
python3 -c "import json;d=json.load(open('/tmp/gh-create.json'));print('repo:',d.get('full_name') or d.get('message'))"

# 2. git init + push
if [ ! -d .git ]; then
  git init -q
  git checkout -q -b main
fi
git add -A
git -c user.name="Yangding" -c user.email="yangding5205@gmail.com" commit -q -m "feat: 第一章 Demo — 机房深井 + 豆包 Boss（可玩）" || echo "nothing to commit"
git remote remove origin 2>/dev/null || true
git remote add origin "https://github.com/$USER/$NAME.git"
git push -q -u origin main 2>&1 | tail -3
echo "pushed: https://github.com/$USER/$NAME"
