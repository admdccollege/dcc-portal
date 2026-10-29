#!/usr/bin/env bash
# Runs the plain-JVM unit tests for the app's URL/origin rules.
set -euo pipefail
ROOT="$(cd "$(dirname "$0")" && pwd)"
OUT="$ROOT/build/test-classes"
rm -rf "$OUT" && mkdir -p "$OUT"
javac --release 8 -nowarn -Xlint:-options -d "$OUT" \
  "$ROOT/app/src/main/java/com/damdeichristiancollege/portal/PortalUrl.java" \
  "$ROOT/app/src/test/java/com/damdeichristiancollege/portal/PortalUrlTest.java"
java -cp "$OUT" com.damdeichristiancollege.portal.PortalUrlTest
