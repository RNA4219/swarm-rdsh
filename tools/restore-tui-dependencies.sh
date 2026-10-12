#!/usr/bin/env bash
set -euo pipefail
prefix="$HOME/.local/share/deepflow-swarm"
export PATH="$prefix/toolchains/pnpm-11.21.0/node_modules/.bin:$prefix/node-v24.15.0-linux-x64/bin:/usr/bin:/bin" CI=true
cd "$prefix/sources/dsh-tui-76c2a26b7f0d81e91b04c848e8aa9671f93ed046"
pnpm install --frozen-lockfile --ignore-scripts --config.node-linker=isolated >"$prefix/logs/restore-tui-dependencies.log" 2>&1
echo TUI_DEPENDENCIES_RESTORED
