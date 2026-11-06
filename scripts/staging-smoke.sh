#!/usr/bin/env bash
# Read-only smoke test for a deployed API. It sends only GET and OPTIONS requests, creates no data
# and needs no credentials.
#
#   API_BASE_URL=https://api.example.com ALLOWED_ORIGIN=https://jobs.example.com ./scripts/staging-smoke.sh
#
# Exit status is non-zero if any check fails. A passing run is packaging-and-wiring evidence only:
# it does not replace the full browser journey, tenant-isolation tests or restore rehearsal.
set -uo pipefail

: "${API_BASE_URL:?set API_BASE_URL, for example https://api.example.com}"
: "${ALLOWED_ORIGIN:?set ALLOWED_ORIGIN to one origin that is in NUA_CORS_ORIGINS}"
BASE="${API_BASE_URL%/}"
DENIED_ORIGIN="https://not-allowed.invalid"

pass=0
fail=0
ok() { printf 'PASS  %s\n' "$1"; pass=$((pass + 1)); }
bad() { printf 'FAIL  %s\n' "$1"; fail=$((fail + 1)); }
info() { printf 'INFO  %s\n' "$1"; }

# curl prints 000 itself when it cannot connect, so there is no fallback to add.
status() { curl -sS -o /dev/null -m 15 -w '%{http_code}' "$@" 2>/dev/null || true; }
body() { curl -sS -m 15 "$@" 2>/dev/null || true; }
# Print a Python expression's value computed from JSON on stdin; empty on any parse error.
json() { python3 -I -c "import json,sys
try:
    d = json.load(sys.stdin)
    print($1)
except Exception:
    print('')"; }

if [ "$(status "$BASE/healthz")" = "200" ]; then ok "GET /healthz is 200"; else bad "GET /healthz is not 200"; fi
if [ "$(status "$BASE/readyz")" = "200" ]; then ok "GET /readyz is 200 (database reachable)"; else bad "GET /readyz is not 200"; fi

jobs_status="$(status "$BASE/v1/jobs")"
if [ "$jobs_status" = "200" ]; then ok "GET /v1/jobs is 200 (public search)"; else bad "GET /v1/jobs returned $jobs_status"; fi

if [ "$(status "$BASE/v1/auth/me")" = "401" ]; then ok "GET /v1/auth/me without a token is 401"; else bad "GET /v1/auth/me without a token is not 401"; fi

markets="$(body "$BASE/v1/markets")"
nz_off="$(printf '%s' "$markets" | json "all(not v for m in d if m['country_code']=='NZ' for v in m['capabilities'].values()) and any(m['country_code']=='NZ' for m in d)")"
if [ "$nz_off" = "True" ]; then ok "NZ is listed with every capability off"; else bad "NZ capabilities are not all off (or NZ is missing)"; fi
au_listed="$(printf '%s' "$markets" | json "any(m['country_code']=='AU' for m in d)")"
if [ "$au_listed" = "True" ]; then ok "AU is listed"; else bad "AU is not listed"; fi

est="$(body "$BASE/v1/pricing/estimate?new_ad=true")"
billing_off="$(printf '%s' "$est" | json "d['billing_enabled'] is False")"
if [ "$billing_off" = "True" ]; then ok "Billing is disabled in the price estimate"; else bad "Billing does not report as disabled"; fi

# Preflight helper: prints "<http status> <allow-origin header or empty>".
preflight() {
  local origin="$1" out code hdr
  out="$(curl -sS -m 15 -o /dev/null -D - -w 'HTTPSTATUS:%{http_code}' -X OPTIONS "$BASE/v1/jobs" \
    -H "Origin: $origin" -H 'Access-Control-Request-Method: GET' 2>/dev/null | tr -d '\r')"
  code="${out##*HTTPSTATUS:}"
  hdr="$(printf '%s' "$out" | awk -F': ' 'tolower($1)=="access-control-allow-origin"{print $2}')"
  printf '%s %s' "$code" "$hdr"
}

read -r _ allowed_hdr <<<"$(preflight "$ALLOWED_ORIGIN")"
read -r denied_code denied_hdr <<<"$(preflight "$DENIED_ORIGIN")"

if [ "$allowed_hdr" = "$ALLOWED_ORIGIN" ]; then ok "CORS allows the configured origin"; else bad "CORS did not echo the configured origin (got '${allowed_hdr:-none}')"; fi

# A denial only counts if the server actually answered: an unreachable API must never pass this.
case "$denied_code" in
  000) bad "CORS denial not verified: no response from the API" ;;
  *) if [ -z "$denied_hdr" ]; then ok "CORS does not allow an unlisted origin"; else bad "CORS allowed an unlisted origin ($denied_hdr)"; fi ;;
esac
if [ "$denied_code" != "000" ] && [ "$allowed_hdr" != "*" ] && [ "$denied_hdr" != "*" ]; then ok "CORS is not a wildcard"; else bad "CORS wildcard check failed or not verified"; fi

case "$BASE" in
  https://*)
    host="${BASE#https://}"
    redirect="$(status -I "http://${host%%/*}/healthz")"
    case "$redirect" in 301 | 308) ok "Plain HTTP redirects to HTTPS" ;; 000) info "Port 80 not reachable from here (skipped)" ;; *) bad "Plain HTTP returned $redirect, expected a redirect" ;; esac
    ;;
  *) info "Not an https:// URL; skipping the HTTP-to-HTTPS redirect check" ;;
esac

info "GET /docs is $(status "$BASE/docs"), GET /openapi.json is $(status "$BASE/openapi.json") (decide whether the API reference should be public in staging)"

printf '\n%d passed, %d failed\n' "$pass" "$fail"
[ "$fail" -eq 0 ]
