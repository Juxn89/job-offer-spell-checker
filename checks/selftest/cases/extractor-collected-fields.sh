#!/bin/sh
# Purpose: selftest case — the collected-fields dead-path extractor arms the moment the product stores anything: a
# product that stores nothing reads `inactive`; a synchronous file write (writeSync, a second vocabulary for the
# write), browser storage, and a database client named in package.json by its family (mysql2, the sql family; a
# scoped @redis/client, the redis family) each convict as `store-unjoined`. Arm-broken: without package.json the
# extractor fails, never reads as "stores nothing". Fixture-only. Env: CHECKS.
set -eu
T=$(mktemp -d); trap 'rm -rf "$T"' EXIT
cd "$T"; mkdir -p src/server src/web
printf '{ "dependencies": { "fastify": "5.12.8" } }\n' > package.json
printf 'export const answer = (t: string) => t.length;\n' > src/server/a.ts
sh "$CHECKS/extractors/dead-path.collected-fields.sh" | grep -q '^inactive ' || { echo 'extractor-collected-fields: a product storing nothing was armed' >&2; exit 1; }
printf 'import fs from "node:fs";\nconst fd = 3;\nfs.writeSync(fd, text);\n' > src/server/b.ts
printf 'window.localStorage.setItem("offer", t);\n' > src/web/c.ts
printf '{ "dependencies": { "fastify": "5.12.8",\n  "mysql2": "3.11.0",\n  "@redis/client": "1.6.0" } }\n' > package.json
sh "$CHECKS/extractors/dead-path.collected-fields.sh" > out.txt
grep -q '^orphan src/server/b.ts:3 store-unjoined ' out.txt || { echo 'extractor-collected-fields: writeSync passed' >&2; exit 1; }
grep -q '^orphan src/web/c.ts:1 store-unjoined ' out.txt || { echo 'extractor-collected-fields: localStorage passed' >&2; exit 1; }
grep -q '^orphan package.json:2 store-unjoined ' out.txt || { echo 'extractor-collected-fields: an sql-family client passed' >&2; exit 1; }
grep -q '^orphan package.json:3 store-unjoined ' out.txt || { echo 'extractor-collected-fields: a scoped redis-family client passed' >&2; exit 1; }
[ "$(grep -c '^orphan package.json:' out.txt)" -eq 2 ] || { echo 'extractor-collected-fields: a non-storage dependency convicted' >&2; cat out.txt >&2; exit 1; }
rm package.json
if sh "$CHECKS/extractors/dead-path.collected-fields.sh" > /dev/null 2>&1; then echo 'extractor-collected-fields: no package.json exited 0' >&2; exit 1; fi
exit 0
