#!/usr/bin/env bash
set -euo pipefail
prefix="$HOME/.local/share/deepflow-swarm"
export PATH="$prefix/node-v24.15.0-linux-x64/bin:$prefix/toolchains/go1.26.2/bin:$prefix/toolchains/cargo/bin:/usr/bin:/bin"
export RUSTUP_HOME="$prefix/toolchains/rustup" CARGO_HOME="$prefix/toolchains/cargo"
export GOTOOLCHAIN=local GOCACHE="$prefix/cache/go-build" GOMODCACHE="$prefix/cache/go-mod"
export COLUMNS=100 LINES=40 TERM=xterm-256color
target="$1"
case "$target" in
beads)
  cd "$prefix/cache/go-mod/github.com/steveyegge/beads@v1.0.5"
  go build -mod=readonly -p 2 -trimpath -o "$prefix/bin/bd-1.0.5" ./cmd/bd >"$prefix/logs/build-beads.log" 2>&1
  install -m 755 "$prefix/bin/bd-1.0.5" "$prefix/bin/bd"
  "$prefix/bin/bd" version
  ;;
gastown)
  cd "$prefix/sources/gastown-649b832b7672bc7a2dbef26f5983aba6198b819b"
  go build -p 2 -trimpath -o "$prefix/bin/gt" ./cmd/gt >"$prefix/logs/build-gastown.log" 2>&1
  "$prefix/bin/gt" version
  ;;
rustdsh)
  cd "$prefix/sources/rustdsh-a1be438e232278add3ee130e7d77aaa02f9f68c5"
  cargo +1.95.0 build --release --locked -j 2 >"$prefix/logs/build-rustdsh.log" 2>&1
  install -m 755 target/release/rdsh "$prefix/bin/rdsh"
  "$prefix/bin/rdsh" --version
  ;;
dsh|dsh-tui)
  if [[ "$target" == dsh ]]; then
    commit=d743267388641bc76f17c45ce8b4c231aed1d32c; manager=11.28.5
  else
    commit=76c2a26b7f0d81e91b04c848e8aa9671f93ed046; manager=11.21.0
  fi
  managerRoot="$prefix/toolchains/pnpm-$manager"
  [[ -x "$managerRoot/node_modules/.bin/pnpm" ]] || npm install --prefix "$managerRoot" --ignore-scripts --no-audit --no-fund "pnpm@$manager" >"$prefix/logs/install-pnpm-$manager.log" 2>&1
  export PATH="$managerRoot/node_modules/.bin:$PATH" CI=true
  cd "$prefix/sources/$target-$commit"
  pnpm install --frozen-lockfile --ignore-scripts >"$prefix/logs/install-$target.log" 2>&1
  if [[ "$target" == dsh ]]; then
    pnpm exec tsx native/system/scripts/build.ts >"$prefix/logs/build-dsh.log" 2>&1
    pnpm exec tsx scripts/compile-referenced-projects.ts libraries >>"$prefix/logs/build-dsh.log" 2>&1
  else
    pnpm run build >"$prefix/logs/build-dsh-tui.log" 2>&1
    # この固定lockの可搬packは未解決。ビルド済みconsumerリンクで接続試験する。
    printf '%s\n' 'TUI portable package: not qualified'
  fi
  printf '%s build complete\n' "$target"
  ;;
*) exit 2 ;;
esac
