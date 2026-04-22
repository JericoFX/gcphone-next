#!/usr/bin/env bash
#
# lint-antipatterns.sh — static check for init/race/timing antipatterns.
#
# Each rule targets a concrete bug class we have already shipped a fix for.
# The goal is to fail CI (and optionally a pre-commit hook) before a
# regression lands, not to catch every possible mistake.
#
# Rules:
#   A  top-level `MySQL.<op>.await(...)` without a `MySQL.ready` gate.
#      Why: oxmysql may not have finished its DB handshake when a module
#      is required; at module-load the query silently fails.
#   B  cached `GetResourceState('<res>') == 'started'` assigned to a
#      module-scope local. Why: the check is frozen at require time, so
#      a later start/restart of the target resource is never observed.
#   C  `CreateThread + Wait(<magic>) + lib.callback` bootstrap. Why:
#      "sleep until it's probably ready" races framework/DB/NUI init and
#      fails intermittently under load or on slow first connect.
#   D  `(window as any).__<name>` timer/handle stash in web/src. Why:
#      survives component unmount, collides across mounts, leaks
#      setTimeout/setInterval IDs. Use a component-scope `let` + onCleanup.
#   E  `startAudioRecording(` call whose returned AudioRecorderHandle is
#      discarded (no assignment, no return). Why: caller cannot cancel
#      the live MediaStream from onCleanup; mic stays open up to 30s.
#   F  file that opens `navigator.mediaDevices.getUserMedia(` but never
#      calls `.getTracks(` for teardown. Why: MediaStream tracks leak
#      until GC, OS-visible mic/camera indicator stays on.
#
# Exit codes:
#   0  clean
#   1  at least one rule violated
#   2  usage / internal error

set -euo pipefail

ROOT_DIR="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")/.." &>/dev/null && pwd)"
cd "$ROOT_DIR"

fail=0
report() {
    local rule="$1"
    local msg="$2"
    echo "[$rule] $msg"
    fail=1
}

# --------------------------------------------------------------------
# Rule A: top-level MySQL.<op>.await
# --------------------------------------------------------------------
# Anchored at column 0 so matches inside function bodies (always indented
# in this repo) are ignored. The only acceptable column-0 MySQL token is
# `MySQL.ready(...)` which is checked by an anchored exclusion below.
if rule_a=$(grep -rnE '^MySQL\.(query|insert|update|scalar|single)\.await' server/ client/ shared/ 2>/dev/null); then
    while IFS= read -r line; do
        report A "top-level MySQL await (must be gated by MySQL.ready): $line"
    done <<<"$rule_a"
fi

# --------------------------------------------------------------------
# Rule B: cached GetResourceState at module scope
# --------------------------------------------------------------------
# Pattern: `local <name> = GetResourceState(...)` with no enclosing
# function. Matching column-0 only is a good-enough heuristic because
# every in-function usage in this repo is indented.
if rule_b=$(grep -rnE '^local [A-Za-z_][A-Za-z0-9_]* = GetResourceState\(' server/ client/ shared/ 2>/dev/null); then
    while IFS= read -r line; do
        report B "cached GetResourceState at module scope (wrap in a function instead): $line"
    done <<<"$rule_b"
fi

# --------------------------------------------------------------------
# Rule C: CreateThread + Wait(<num>) + lib.callback within ~8 lines
# --------------------------------------------------------------------
# Simple state machine: inside a CreateThread block (tracked by balanced
# lightweight `function()` .. `end)` counting via distance), flag any
# Wait(<int>) that is followed within 8 lines by `lib.callback`.
awk '
    function flush() { in_thread = 0; depth = 0; wait_line = 0; wait_text = "" }
    FNR == 1 { flush() }
    /CreateThread\(function\(\)/ { in_thread = 1; depth = FNR + 40; next }
    in_thread && FNR > depth { flush() }
    in_thread && /^[[:space:]]*Wait\([0-9]+\)/ {
        wait_line = FNR; wait_text = $0; next
    }
    wait_line > 0 && FNR - wait_line <= 8 && /lib\.callback/ {
        printf("%s:%d: CreateThread + Wait + lib.callback bootstrap (use event/state bag instead)\n    %s\n    %s:%d %s\n",
               FILENAME, wait_line, wait_text, FILENAME, FNR, $0);
        rc = 1; wait_line = 0; next
    }
    END { exit rc + 0 }
' $(find server client shared -type f -name '*.lua' 2>/dev/null) > .lint_c_output || true

if [ -s .lint_c_output ]; then
    while IFS= read -r line; do
        report C "$line"
    done < .lint_c_output
fi
rm -f .lint_c_output

# --------------------------------------------------------------------
# Rule D: setTimeout/setInterval handle stashed on `window`
# --------------------------------------------------------------------
# Cross-mount collision + unmount leak. Flagged forms:
#   (window as any).__<Name>Timer = ...
#   (window as any).__<Name> = setTimeout(...)
#   (window as any).__<Name> = setInterval(...)
# Debug bridges like `(window as any).__gcphonePermissions = actions;`
# are not timer handles and are intentionally not flagged.
if [ -d web/src ]; then
    if rule_d=$(grep -rnE '\(window as any\)\.__[A-Za-z_][A-Za-z0-9_]*(Timer|Timeout|Interval)([[:space:]]|=)|\(window as any\)\.__[A-Za-z_][A-Za-z0-9_]*[[:space:]]*=[[:space:]]*(setTimeout|setInterval)\(' web/src 2>/dev/null); then
        while IFS= read -r line; do
            report D "timer handle stashed on window (use component-scope let + onCleanup): $line"
        done <<<"$rule_d"
    fi
fi

# --------------------------------------------------------------------
# Rule E: startAudioRecording(...) handle discarded
# --------------------------------------------------------------------
# The function returns { stop, cancel }. A call whose result is thrown
# away cannot be cancelled on unmount, so the mic stream leaks.
# Acceptable forms:
#   const handle = await startAudioRecording(...)
#   voiceRecorder = await startAudioRecording(...)
#   return startAudioRecording(...)
# Reject:
#   await startAudioRecording(...)
#   startAudioRecording(...)
# at the start of a statement (after leading whitespace).
if [ -d web/src ]; then
    if rule_e=$(grep -rnE '^[[:space:]]*(await[[:space:]]+)?startAudioRecording\(' web/src 2>/dev/null); then
        while IFS= read -r line; do
            report E "startAudioRecording handle discarded (store it and cancel() from onCleanup): $line"
        done <<<"$rule_e"
    fi
fi

# --------------------------------------------------------------------
# Rule F: getUserMedia without paired getTracks teardown
# --------------------------------------------------------------------
# Per-file heuristic: if a file opens a camera/mic stream, it must also
# contain at least one `.getTracks(` call (typical cleanup is
# `stream.getTracks().forEach(t => t.stop())` or similar).
if [ -d web/src ]; then
    getusermedia_files=$(grep -rlE 'navigator\.mediaDevices\.getUserMedia\(' web/src 2>/dev/null || true)
    if [ -n "$getusermedia_files" ]; then
        while IFS= read -r f; do
            [ -z "$f" ] && continue
            if ! grep -qE '\.getTracks\(' "$f"; then
                report F "getUserMedia without getTracks() cleanup (stream leaks until GC): $f"
            fi
        done <<<"$getusermedia_files"
    fi
fi

if [ "$fail" -ne 0 ]; then
    echo
    echo "antipattern lint failed"
    exit 1
fi

echo "antipattern lint clean"
exit 0
