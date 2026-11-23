#!/bin/sh
# Purpose: the tests service's command (docker-compose.test.yml): runs the Playwright ledger with the
# arguments the harness hands it and turns its exit into the harness contract's statuses — 0 every
# case passed, 1 some case failed (both "ran to its end"); 3 no report or no case collected, 4 the
# runner failed with no failing case: neither is a completed run, so checks/test.sh publishes nothing.
REPORT=${PLAYWRIGHT_JUNIT_OUTPUT_NAME:-/vid-results/pending.xml}
rm -f "$REPORT"
playwright test "$@"
status=$?
if [ ! -s "$REPORT" ]; then
  echo "ledger: the runner wrote no report (exit $status)" >&2
  exit 3
fi
if ! grep -q '<testcase ' "$REPORT"; then
  echo "ledger: the report holds no case — nothing collected (exit $status)" >&2
  exit 3
fi
case $status in
  0) exit 0 ;;
  1)
    if grep -qE '<failure|<error' "$REPORT"; then exit 1; fi
    echo "ledger: the runner failed (exit 1) with no failing case in its report" >&2
    exit 4
    ;;
  *) exit "$status" ;;
esac
