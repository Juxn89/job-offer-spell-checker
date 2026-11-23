#!/bin/sh
# Purpose: census extractor — dead-path, collected fields: every field the product collects from a user and
# STORES, joined to a read site other than validation and display. The product stores nothing a user sends
# (REQ-017, REQ-018), so the population is empty by design and the extractor says so; it arms the moment a
# store appears — a file write, browser storage or a database client in src/ or package.json (a dependency key
# of a storage family: sql, redis, mongo, postgres, an ORM) — and then
# reports each store as an orphan until it is regenerated to join that store's fields to their reads. A search
# that errors fails the extractor, never reads as "stores nothing".
set -eu
[ -d src ] || { echo "inactive no src/ in this tree"; exit 0; }
[ -f package.json ] || { echo "collected-fields: no package.json — the database clients are unreadable" >&2; exit 1; }
g() { grep "$@" || [ $? -eq 1 ]; }
W='writeFile|appendFile|createWriteStream|writeSync|openSync|fs\.(promises\.)?(write|open)\b|localStorage|sessionStorage|indexedDB|document\.cookie'
DB='"([^"]*(sql|redis|mongo|postgres|prisma|knex|typeorm|sequelize|lowdb|nedb|levelup|leveldown)[^"]*|pg|level)"[[:space:]]*:'
ST=$(g -rnE "$W" src --include='*.ts' --include='*.mjs' --include='*.js')
DC=$(g -noE "$DB" package.json)
[ -n "$ST$DC" ] || { echo "inactive the product stores no user field (REQ-017): no file write, browser storage or database client in src/ or package.json"; exit 0; }
printf '%s\n' "$ST" | while IFS= read -r l; do [ -n "$l" ] || continue; f=${l%%:*}; r=${l#*:}
  echo "orphan $f:${r%%:*} store-unjoined a store this extractor does not yet join to its fields' reads — regenerate it for this store"; done
printf '%s\n' "$DC" | while IFS= read -r l; do [ -n "$l" ] || continue
  echo "orphan package.json:${l%%:*} store-unjoined database client ${l#*:} — regenerate this extractor to join its fields to their reads"; done
