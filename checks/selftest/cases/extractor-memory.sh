#!/bin/sh
# Purpose: selftest case — the memory reader (checks/extractors/memory.sh, the observer's) prints exactly one line:
# `free-mb <n>` from MemAvailable, read in its tab-separated form too (a second spelling of the same line), and
# `inactive <reason>` for a file without a numeric MemAvailable or no file at all — never a number it did not read,
# never two lines. Fixture-only (VID_MEMINFO). Env: CHECKS.
set -eu
T=$(mktemp -d); trap 'rm -rf "$T"' EXIT
printf 'MemTotal:       16000000 kB\nMemAvailable:    2048000 kB\n' > "$T/a"
[ "$(VID_MEMINFO=$T/a sh "$CHECKS/extractors/memory.sh")" = 'free-mb 2000' ] || { echo 'extractor-memory: MemAvailable misread' >&2; exit 1; }
printf 'MemFree:\t1\nMemAvailable:\t1024000\tkB\n' > "$T/b"
[ "$(VID_MEMINFO=$T/b sh "$CHECKS/extractors/memory.sh")" = 'free-mb 1000' ] || { echo 'extractor-memory: the tab-separated line misread' >&2; exit 1; }
printf 'MemAvailable: lots kB\n' > "$T/c"
o=$(VID_MEMINFO=$T/c sh "$CHECKS/extractors/memory.sh"); case "$o" in 'inactive '*) ;; *) echo "extractor-memory: garbage read as: $o" >&2; exit 1 ;; esac
o=$(VID_MEMINFO=$T/none sh "$CHECKS/extractors/memory.sh"); case "$o" in 'inactive '*) ;; *) echo "extractor-memory: no file read as: $o" >&2; exit 1 ;; esac
[ "$(VID_MEMINFO=$T/a sh "$CHECKS/extractors/memory.sh" | wc -l | tr -d ' ')" = 1 ] || { echo 'extractor-memory: more than one line' >&2; exit 1; }
exit 0
