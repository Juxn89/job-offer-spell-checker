#!/bin/sh
# Purpose: selftest case — the collected-fields dead-path extractor arms the moment the product stores anything: a
# product that stores nothing reads `inactive`; a synchronous file write (writeSync, a second vocabulary for the
# write), browser storage with no declared key, and a database client named in package.json by its family (mysql2,
# the sql family; a scoped @redis/client, the redis family) each convict as `store-unjoined`. The browser-storage
# join (REQ-049): a declared key written and read back is `ok`; a declared key written and never read convicts as
# `store-unread`; in a keyed file a literal-keyed call and a property-style access (localStorage['x'] = …, a second
# vocabulary for the write) convict as `store-unjoined`. Arm-broken: without package.json the extractor fails,
# never reads as "stores nothing". Fixture-only. Env: CHECKS.
set -eu
T=$(mktemp -d); trap 'rm -rf "$T"' EXIT
cd "$T"; mkdir -p src/server src/web
printf '{ "dependencies": { "fastify": "5.12.8" } }\n' > package.json
printf 'export const answer = (t: string) => t.length;\n' > src/server/a.ts
sh "$CHECKS/extractors/dead-path.collected-fields.sh" | grep -q '^inactive ' || { echo 'extractor-collected-fields: a product storing nothing was armed' >&2; exit 1; }
printf 'import fs from "node:fs";\nconst fd = 3;\nfs.writeSync(fd, text);\n' > src/server/b.ts
printf 'window.localStorage.setItem("offer", t);\n' > src/web/c.ts
printf "const LANG_KEY = 'x.lang';\nfunction read(key: string) { return localStorage.getItem(key); }\nfunction write(key: string, v: string) { localStorage.setItem(key, v); }\nwrite(LANG_KEY, 'es');\nconst l = read(LANG_KEY);\n" > src/web/d.ts
printf "const OFFER_KEY = 'x.offer';\nsessionStorage.setItem(OFFER_KEY, text);\n" > src/web/e.ts
printf "const THEME_KEY = 'x.theme';\nlocalStorage.setItem(THEME_KEY, t);\nlocalStorage.getItem(THEME_KEY);\nlocalStorage.setItem('draft', text);\nlocalStorage['offer'] = text;\n" > src/web/f.ts
printf '{ "dependencies": { "fastify": "5.12.8",\n  "mysql2": "3.11.0",\n  "@redis/client": "1.6.0" } }\n' > package.json
sh "$CHECKS/extractors/dead-path.collected-fields.sh" > out.txt
grep -q '^orphan src/server/b.ts:3 store-unjoined ' out.txt || { echo 'extractor-collected-fields: writeSync passed' >&2; exit 1; }
grep -q '^orphan src/web/c.ts:1 store-unjoined ' out.txt || { echo 'extractor-collected-fields: browser storage with no declared key passed' >&2; exit 1; }
grep -q '^ok src/web/d.ts:1 LANG_KEY$' out.txt || { echo 'extractor-collected-fields: a key written and read back was not joined' >&2; cat out.txt >&2; exit 1; }
if grep -q '^orphan src/web/d.ts:' out.txt; then echo 'extractor-collected-fields: a joined key file convicted' >&2; cat out.txt >&2; exit 1; fi
grep -q '^orphan src/web/e.ts:1 store-unread OFFER_KEY ' out.txt || { echo 'extractor-collected-fields: a key written and never read passed' >&2; exit 1; }
grep -q '^ok src/web/f.ts:1 THEME_KEY$' out.txt || { echo 'extractor-collected-fields: a joined key in a mixed file was not joined' >&2; exit 1; }
grep -q '^orphan src/web/f.ts:4 store-unjoined ' out.txt || { echo 'extractor-collected-fields: a literal-keyed storage call passed' >&2; exit 1; }
grep -q '^orphan src/web/f.ts:5 store-unjoined ' out.txt || { echo 'extractor-collected-fields: a property-style storage write passed' >&2; exit 1; }
grep -q '^orphan package.json:2 store-unjoined ' out.txt || { echo 'extractor-collected-fields: an sql-family client passed' >&2; exit 1; }
grep -q '^orphan package.json:3 store-unjoined ' out.txt || { echo 'extractor-collected-fields: a scoped redis-family client passed' >&2; exit 1; }
[ "$(grep -c '^orphan package.json:' out.txt)" -eq 2 ] || { echo 'extractor-collected-fields: a non-storage dependency convicted' >&2; cat out.txt >&2; exit 1; }
rm package.json
if sh "$CHECKS/extractors/dead-path.collected-fields.sh" > /dev/null 2>&1; then echo 'extractor-collected-fields: no package.json exited 0' >&2; exit 1; fi
exit 0
