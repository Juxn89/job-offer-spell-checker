#!/bin/sh
# Purpose: selftest case — the route table extractor (checks/extractors/routes.sh, the inventory court's and RULE-005/
# 007/008/017's census command) reads the table's subjects in either quote and convicts a route registered outside
# it: a path literal handed to a route method in double quotes (a second vocabulary) and a route object whose url is
# not the table's. Arm-broken: one search's pattern broken, the extractor and the census both fail, never shrink to
# "no route outside the table"; a table naming no subject fails too. Fixture-only. Env: CHECKS.
set -eu
T=$(mktemp -d); trap 'rm -rf "$T"' EXIT
cd "$T"; mkdir -p src/server checks/extractors
printf "export const ROUTES = [\n  { path: '/', subject: '/' },\n  { path: '/privacidad', subject: \"privacy\" },\n];\n" > src/server/routes.ts
printf "for (const route of ROUTES) app.route({ method: 'GET', url: route.path, handler });\n" > src/server/main.ts
sh "$CHECKS/extractors/routes.sh" > out.txt; [ "$(cat out.txt)" = "$(printf 'ok /\nok privacy')" ] || { echo 'extractor-routes: the clean table was misread' >&2; cat out.txt >&2; exit 1; }
printf 'fastify.get("/extra", h);\napp.route({ method: "POST", url: "/hidden", handler });\n' >> src/server/main.ts
sh "$CHECKS/extractors/routes.sh" > out.txt
grep -q '^orphan src/server/main.ts:2 route-outside-table ' out.txt || { echo 'extractor-routes: a double-quoted path literal outside the table passed' >&2; exit 1; }
grep -q '^orphan src/server/main.ts:3 route-outside-table ' out.txt || { echo 'extractor-routes: a route object outside the table passed' >&2; exit 1; }
sed 's/(get|post|put/((get|post|put/' "$CHECKS/extractors/routes.sh" > checks/extractors/routes.sh
if sh checks/extractors/routes.sh > /dev/null 2>&1; then echo 'extractor-routes: a broken search arm exited 0' >&2; exit 1; fi
if sh "$CHECKS/census.sh" > census.txt 2>&1; then echo 'extractor-routes: the census acquitted a broken route extractor' >&2; exit 1; fi
printf 'export const ROUTES = [];\n' > src/server/routes.ts
if sh "$CHECKS/extractors/routes.sh" > /dev/null 2>&1; then echo 'extractor-routes: a table naming no subject exited 0' >&2; exit 1; fi
exit 0
