#!/usr/bin/env bash
set -euo pipefail
prefix="$HOME/.local/share/deepflow-swarm"
mkdir -p "$prefix/downloads/control" "$prefix/bin"
case "$1" in
beads)
  echo 'Build Beads 1.0.5 using build-fixed-runtime.sh beads after Gas Town. Older CLI schemas are incompatible.' >&2
  exit 2
  ;;
dolt)
  name=dolt-2.0.7-linux-amd64.tar.gz
  url=https://github.com/dolthub/dolt/releases/download/v2.0.7/dolt-linux-amd64.tar.gz
  hash=8e09138596763896cbce0632cd6e779fa1df405334c6c148bc314539a3b9795a
  ;;
*) exit 2 ;;
esac
archive="$prefix/downloads/control/$name"
[[ -f "$archive" ]] || curl -fsSL --retry 2 "$url" -o "$archive"
echo "$hash  $archive" | sha256sum -c -
target="$prefix/downloads/control/$1-unpacked"
mkdir -p "$target"
tar -xzf "$archive" -C "$target"
install -m 755 "$target/dolt-linux-amd64/bin/dolt" "$prefix/bin/dolt"
"$prefix/bin/dolt" version
