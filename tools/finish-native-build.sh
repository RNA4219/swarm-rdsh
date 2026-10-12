#!/usr/bin/env bash
set -euo pipefail
prefix="$HOME/.local/share/deepflow-swarm"
export PATH="$prefix/toolchains/pnpm-11.28.5/node_modules/.bin:$prefix/node-v24.15.0-linux-x64/bin:/usr/bin:/bin"
cd "$prefix/sources/dsh-d743267388641bc76f17c45ce8b4c231aed1d32c"
pnpm exec tsx native/system/scripts/build.ts >"$prefix/logs/build-native-full.log" 2>&1
cat "$prefix/logs/build-native-full.log"
