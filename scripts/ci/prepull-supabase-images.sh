#!/usr/bin/env bash
# Pre-pull the Supabase images `supabase start` needs, falling back across
# registries, and tag each one with the name the CLI looks for. The CLI only
# pulls images it cannot find locally, so a later `supabase start` with
# SUPABASE_INTERNAL_IMAGE_REGISTRY=ghcr.io makes no registry calls.
#
# GitHub-hosted runners periodically get `toomanyrequests` / "Data limit
# exceeded" from both ghcr.io and public.ecr.aws for hours at a time; Docker Hub
# is an independent source for the same images.
#
# Usage: prepull-supabase-images.sh [excluded services, comma separated]
#   e.g. prepull-supabase-images.sh studio,imgproxy,mailpit,edge-runtime,logflare,vector,supavisor
# PREPULL_SOURCES overrides the source order (default: "ghcr ecr dockerhub").
set -euo pipefail

excluded=",${1:-},"
sources="${PREPULL_SOURCES:-ghcr ecr dockerhub}"
cli="${SUPABASE_CLI:-supabase}"

# `supabase services` prints "<repo> | <local tag> | <linked tag>" for the
# pinned CLI version. Kong is not listed there; 2.8.1 is what CLI 2.98.1 runs.
images=()
while IFS= read -r line; do images+=("$line"); done < <(
  $cli services 2>/dev/null | awk -F'|' '{ gsub(/ /, "", $1); gsub(/ /, "", $2) } $1 ~ /^[a-z0-9-]+\/[a-z0-9-]+$/ && $2 != "" && $2 != "-" { print $1 ":" $2 }'
)
images+=("library/kong:2.8.1")

service_name() {
  case "$1" in
    supabase/gotrue) echo auth ;;
    postgrest/postgrest) echo rest ;;
    supabase/storage-api) echo storage ;;
    supabase/postgres-meta) echo postgres-meta ;;
    library/kong) echo kong ;;
    *) echo "${1##*/}" ;;
  esac
}

pull_from() {
  local source="$1" repo="$2" tag="$3" name="${2##*/}"
  case "$source" in
    ghcr) echo "ghcr.io/supabase/${name}:${tag}" ;;
    ecr) echo "public.ecr.aws/supabase/${name}:${tag}" ;;
    dockerhub) echo "docker.io/${repo}:${tag}" ;;
  esac
}

failed=0
for image in "${images[@]}"; do
  repo="${image%:*}"; tag="${image##*:}"; name="${repo##*/}"
  if [[ "$excluded" == *",$(service_name "$repo"),"* || "$excluded" == *",${name},"* ]]; then continue; fi
  target="ghcr.io/supabase/${name}:${tag}"
  if docker image inspect "$target" >/dev/null 2>&1; then echo "present: $target"; continue; fi
  ok=0
  for delay in 0 20 60; do
    [ "$delay" -gt 0 ] && sleep "$delay"
    for source in $sources; do
      ref="$(pull_from "$source" "$repo" "$tag")"
      if docker pull -q "$ref" >/dev/null 2>&1; then
        [ "$ref" = "$target" ] || docker tag "$ref" "$target"
        echo "pulled: $target (from $ref)"
        ok=1; break 2
      fi
      echo "unavailable: $ref"
    done
  done
  if [ "$ok" = 0 ]; then echo "::error::could not pull $target from any registry"; failed=1; fi
done
exit "$failed"
