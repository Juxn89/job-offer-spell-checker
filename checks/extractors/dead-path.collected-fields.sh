#!/bin/sh
# Purpose: census extractor — dead-path, collected fields: every field the product collects from a user and
# STORES, joined to a read site other than validation and display. The product stores nothing a user sends
# (REQ-017, REQ-018); its one store is browser storage holding the visitor's two page preferences (REQ-049).
# Browser storage (localStorage, sessionStorage) is joined: each key is declared `const <NAME>_KEY = '<key>'`
# in the file that touches the store, and is `ok` when that file writes it (setItem or write) and reads it back
# (getItem or read); a key written and never read is `store-unread`. In such a file a storage call keyed by a
# literal, and a storage access that is not getItem/setItem/removeItem through a declared key or a helper's
# parameter, are `store-unjoined`, as is every storage line of a file declaring no key. Every other store — a
# file write, IndexedDB, a cookie, a database client in package.json (a storage family: sql, redis, mongo,
# postgres, an ORM) — has no join yet and is `store-unjoined` until this extractor is regenerated for it. A
# search that errors fails the extractor, never reads as "stores nothing". Known limit: a storage helper named
# other than read/write and called with a literal key is not seen.
set -eu
[ -d src ] || { echo "inactive no src/ in this tree"; exit 0; }
[ -f package.json ] || { echo "collected-fields: no package.json — the database clients are unreadable" >&2; exit 1; }
g() { grep "$@" || [ $? -eq 1 ]; }
W='writeFile|appendFile|createWriteStream|writeSync|openSync|fs\.(promises\.)?(write|open)\b|indexedDB|document\.cookie'
BS='localStorage|sessionStorage'
DB='"([^"]*(sql|redis|mongo|postgres|prisma|knex|typeorm|sequelize|lowdb|nedb|levelup|leveldown)[^"]*|pg|level)"[[:space:]]*:'
ST=$(g -rnE "$W" src --include='*.ts' --include='*.mjs' --include='*.js')
BF=$(g -rlE "$BS" src --include='*.ts' --include='*.mjs' --include='*.js')
DC=$(g -noE "$DB" package.json)
[ -n "$ST$BF$DC" ] || { echo "inactive the product stores no user field (REQ-017): no file write, browser storage or database client in src/ or package.json"; exit 0; }
printf '%s\n' "$ST" | while IFS= read -r l; do [ -n "$l" ] || continue; f=${l%%:*}; r=${l#*:}
  echo "orphan $f:${r%%:*} store-unjoined a store this extractor does not yet join to its fields' reads — regenerate it for this store"; done
for f in $BF; do
  K=$(g -nE "const [A-Z][A-Z0-9_]*_KEY[[:space:]]*(:[^=]*)?=[[:space:]]*['\"][^'\"]+['\"]" "$f")
  if [ -z "$K" ]; then
    g -nE "$BS" "$f" | while IFS= read -r l; do echo "orphan $f:${l%%:*} store-unjoined browser storage with no declared key (const <NAME>_KEY) to join"; done
    continue
  fi
  g -nE "$BS" "$f" | g -vE "($BS)\.(getItem|setItem|removeItem)\([[:space:]]*([a-z][A-Za-z0-9_]*|[A-Z][A-Z0-9_]*_KEY)[[:space:]]*[,)]" \
    | while IFS= read -r l; do echo "orphan $f:${l%%:*} store-unjoined a storage access not through a declared key"; done
  g -nE "\b(setItem|getItem|removeItem|write|read)\([[:space:]]*['\"\`]" "$f" \
    | while IFS= read -r l; do echo "orphan $f:${l%%:*} store-unjoined a storage key written as a literal — declare it as const <NAME>_KEY"; done
  printf '%s\n' "$K" | while IFS= read -r l; do n=${l%%:*}; k=$(printf '%s' "$l" | sed -E 's/.*const ([A-Z][A-Z0-9_]*_KEY).*/\1/')
    w=$(g -cE "\b(setItem|write)\([[:space:]]*$k\b" "$f"); r=$(g -cE "\b(getItem|read)\([[:space:]]*$k\b" "$f")
    if [ "$w" -gt 0 ] && [ "$r" -gt 0 ]; then echo "ok $f:$n $k"
    elif [ "$w" -gt 0 ]; then echo "orphan $f:$n store-unread $k is written to browser storage and never read back"; fi; done
done
printf '%s\n' "$DC" | while IFS= read -r l; do [ -n "$l" ] || continue
  echo "orphan package.json:${l%%:*} store-unjoined database client ${l#*:} — regenerate this extractor to join its fields to their reads"; done
