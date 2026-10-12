#!/usr/bin/env bash
set -euo pipefail
prefix="$HOME/.local/share/deepflow-swarm"
mkdir -p "$prefix/downloads" "$prefix/toolchains" "$prefix/logs"
case "$1" in
go)
  archive="$prefix/downloads/go1.26.2.linux-amd64.tar.gz"
  [[ -f "$archive" ]] || curl -fsSL --retry 2 https://go.dev/dl/go1.26.2.linux-amd64.tar.gz -o "$archive"
  echo "990e6b4bbba816dc3ee129eaeaf4b42f17c2800b88a2166c265ac1a200262282  $archive" | sha256sum -c -
  if [[ ! -d "$prefix/toolchains/go1.26.2" ]]; then
    mkdir "$prefix/toolchains/go1.26.2"
    tar -xzf "$archive" --strip-components=1 -C "$prefix/toolchains/go1.26.2"
  fi
  "$prefix/toolchains/go1.26.2/bin/go" version
  ;;
rust)
  export RUSTUP_HOME="$prefix/toolchains/rustup" CARGO_HOME="$prefix/toolchains/cargo"
  if [[ ! -x "$CARGO_HOME/bin/rustup" ]]; then
    curl -fsSL https://sh.rustup.rs -o "$prefix/downloads/rustup-init.sh"
    sh "$prefix/downloads/rustup-init.sh" -y --no-modify-path --profile minimal --default-toolchain 1.95.0 >"$prefix/logs/rustup.log" 2>&1
  fi
  "$CARGO_HOME/bin/rustc" +1.95.0 --version
  "$CARGO_HOME/bin/cargo" +1.95.0 --version
  ;;
*) exit 2 ;;
esac
