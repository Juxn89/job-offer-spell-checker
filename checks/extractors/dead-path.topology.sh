#!/bin/sh
# Purpose: census extractor — dead-path, topology (v0.9.3 3.4): every queue routing and every schedule the
# product declares, joined to a process the harness declares (x-vid-harness `processes:`). The product is one
# web process with neither (ARCHITECTURE.md), so it prints `inactive no routing or schedule declared` until a
# queue library, a scheduler library, a crontab or a systemd timer appears; each is then an orphan until a
# declared process names it in its command (and this extractor is regenerated for the library's routing). An
# unreadable package.json or a search that errors fails it, never reads as "none declared".
set -eu
[ -f package.json ] || { echo "topology: no package.json — the queue and scheduler libraries are unreadable" >&2; exit 1; }
g() { grep "$@" || [ $? -eq 1 ]; }
Q=$(g -oE '"(bullmq|bull|bee-queue|amqplib|kafkajs|@aws-sdk/client-sqs|pg-boss|graphile-worker|rhea|nats)"' package.json); Q=$(printf '%s\n' "$Q" | tr -d '"')
L=$(g -oE '"(node-cron|cron|agenda|node-schedule|toad-scheduler|@fastify/schedule|croner|bree)"' package.json); L=$(printf '%s\n' "$L" | tr -d '"')
F=""; if [ -d deploy ]; then F=$(find deploy -type f \( -name '*.timer' -o -name 'crontab*' -o -name '*.cron' \)); fi
S=$(printf '%s\n%s\n' "$L" "$F" | awk NF)
[ -n "$Q$S" ] || { echo "inactive no routing or schedule declared"; exit 0; }
H=docker-compose.test.yml
PR=$(awk '/^x-vid-harness:/ { x = 1; next } x && /^[^ #]/ { x = 0 } x && $1 == "processes:" { sub(/^[^:]*:[ \t]*/, ""); gsub(/[][,]/, " "); print }' "$H" 2>/dev/null || true)
named() { for p in $PR; do awk -v s="$p" -v k="$1" '/^  [A-Za-z0-9_-]+:/ { c = ($1 == s ":") } c && /command:/ && index($0, k) { f = 1 } END { exit !f }' "$H" && return 0; done; return 1; }
for q in $Q; do if named "$q"; then echo "ok queue:$q"; else echo "orphan queue:$q no declared process consumes it"; fi; done
for s in $S; do b=${s##*/}; if named "$b"; then echo "ok schedule:$b"; else echo "orphan schedule:$b names unregistered task $b (no declared process runs it)"; fi; done
