#!/usr/bin/env bash
# Creates the release signing key for the DCC Portal app.
# Keep the keystore and its passwords safe (college password manager + an offline copy).
# Every future update MUST be signed with this same key, or phones will refuse to install it.
set -euo pipefail
KS="${1:-dcc-portal-release.jks}"
[[ -e "$KS" ]] && { echo "$KS already exists; not overwriting." >&2; exit 1; }
keytool -genkeypair -v -keystore "$KS" -alias dcc-portal -keyalg RSA -keysize 4096 -validity 10000 \
  -dname "CN=Damdei Christian College Portal, O=Damdei Christian College, L=Manipur, C=IN"
echo "Created $KS (alias dcc-portal). Do not commit it to Git."
