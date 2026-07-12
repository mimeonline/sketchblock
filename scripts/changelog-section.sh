#!/usr/bin/env bash
set -euo pipefail

version="${1#v}"

awk -v version="${version}" '
  $0 ~ "^## " version " - " {
    found = 1
    next
  }
  found && /^## / {
    exit
  }
  found {
    print
  }
  END {
    if (!found) {
      exit 1
    }
  }
' CHANGELOG.md
