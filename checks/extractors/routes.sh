#!/bin/sh
# Purpose: route table extractor — every surface the server routes, printed as the INVENTORY.md subject its
# entry in src/server/routes.ts names (`ok <subject>`, D-019); a route registered anywhere else in server
# source (a path literal handed to a route method, or a route object not fed from the table) is an orphan,
# since the inventory court can see only what the table holds. A search that errors fails the extractor:
# a broken arm must never read as "no route outside the table".
set -eu
T=src/server/routes.ts
[ -f "$T" ] || { echo "inactive no route table at $T"; exit 0; }
g() { grep "$@" || [ $? -eq 1 ]; }
Q="['\"\`]"
S=$(sed -n "s/.*subject:[[:space:]]*$Q\([^'\"\`]*\)$Q.*/\1/p" "$T" | sort -u)
[ -n "$S" ] || { echo "routes: $T names no subject — the route table is unreadable" >&2; exit 1; }
# registrations outside the table: a route method called with a path literal, or a route object whose url is not the table's
A=$(g -rnE "\.(get|post|put|patch|delete|head|options|all)[[:space:]]*\([[:space:]]*$Q/" src/server --include='*.ts')
B=$(g -rnE "\.route[[:space:]]*\(" src/server --include='*.ts')
printf '%s\n' "$S" | sed 's/^/ok /'
printf '%s\n%s\n' "$A" "$B" | awk -v t="$T" 'NF && !/url:[[:space:]]*route\.path/ { split($0, p, ":")
  print "orphan " p[1] ":" p[2] " route-outside-table registered outside " t ", invisible to the inventory court" }'
