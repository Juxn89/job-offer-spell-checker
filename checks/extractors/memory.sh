#!/bin/sh
# Purpose: memory reader — the host's free memory for the observer's report, one line: `free-mb <n>` from
# MemAvailable in /proc/meminfo (Linux; under WSL2 the one VM Docker Desktop shares), or `inactive <reason>`.
# VID_MEMINFO names another file (the selftest's fixture).
set -eu
M=${VID_MEMINFO:-/proc/meminfo}
[ -r "$M" ] || { echo "inactive no $M on this host"; exit 0; }
kb=$(awk '$1 == "MemAvailable:" { print $2; exit }' "$M")
case "$kb" in ''|*[!0-9]*) echo "inactive $M holds no numeric MemAvailable line"; exit 0 ;; esac
echo "free-mb $((kb / 1024))"
