#!/usr/bin/env bash
set -euo pipefail
prefix="${DEEPFLOW_BUILD_ROOT:-$HOME/.local/share/deepflow-swarm}"
mkdir -p "$prefix/sources" "$prefix/logs" "$prefix/bin" "$prefix/downloads"
name="$1"
case "$name" in
  gastown) repo=gastownhall/gastown; revision=649b832b7672bc7a2dbef26f5983aba6198b819b ;;
  dsh) repo=deepseek-ai/deepseek-harness; revision=d743267388641bc76f17c45ce8b4c231aed1d32c ;;
  rustdsh) repo=jimoto-no-llm/rustdsh; revision=a1be438e232278add3ee130e7d77aaa02f9f68c5 ;;
  dsh-tui) repo=ccch1mneyyy/dsh-TUI; revision=76c2a26b7f0d81e91b04c848e8aa9671f93ed046 ;;
  *) exit 2 ;;
esac
target="$prefix/sources/$name-$revision"
if [[ ! -d "$target/.git" ]]; then
  [[ ! -e "$target" ]] || { echo "Refusing non-checkout target" >&2; exit 2; }
  git init -q "$target"
  git -C "$target" remote add origin "https://github.com/$repo.git"
  git -C "$target" fetch --depth 1 origin "$revision" >"$prefix/logs/fetch-$name.log" 2>&1
  git -C "$target" checkout --detach -q FETCH_HEAD
fi
[[ "$(git -C "$target" rev-parse HEAD)" == "$revision" ]]
git -C "$target" submodule update --init --recursive >>"$prefix/logs/fetch-$name.log" 2>&1
printf '%s %s\n' "$name" "$revision"
git -C "$target" submodule status --recursive
