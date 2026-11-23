#!/bin/sh
# Purpose: selftest case — the topology dead-path extractor (v0.9.3 3.4) reads `inactive` while nothing is routed or
# scheduled; a queue library no declared process consumes, and a systemd timer under deploy/ (a second vocabulary
# for a schedule, beside a cron library) no declared process runs, each convict; a harness process whose command
# names the queue acquits it. Arm-broken: without package.json it fails, never reads as "none declared".
# Fixture-only. Env: CHECKS.
set -eu
T=$(mktemp -d); trap 'rm -rf "$T"' EXIT
cd "$T"; printf '{ "dependencies": { "fastify": "5.12.8" } }\n' > package.json
sh "$CHECKS/extractors/dead-path.topology.sh" | grep -q '^inactive ' || { echo 'extractor-topology: nothing routed was armed' >&2; exit 1; }
printf '{ "dependencies": { "bullmq": "5.0.0" } }\n' > package.json; mkdir deploy; printf '[Timer]\nOnCalendar=daily\n' > deploy/purge.timer
sh "$CHECKS/extractors/dead-path.topology.sh" > out.txt
grep -q '^orphan queue:bullmq ' out.txt || { echo 'extractor-topology: an unconsumed queue passed' >&2; exit 1; }
grep -q '^orphan schedule:purge.timer ' out.txt || { echo 'extractor-topology: an unregistered timer passed' >&2; exit 1; }
printf 'services:\n  worker:\n    command: node dist/worker.js --queue bullmq\nx-vid-harness:\n  processes: [worker]\n' > docker-compose.test.yml
sh "$CHECKS/extractors/dead-path.topology.sh" | grep -q '^ok queue:bullmq$' || { echo 'extractor-topology: a declared consumer was not seen' >&2; exit 1; }
rm package.json
if sh "$CHECKS/extractors/dead-path.topology.sh" > /dev/null 2>&1; then echo 'extractor-topology: no package.json exited 0' >&2; exit 1; fi
exit 0
