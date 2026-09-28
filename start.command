#!/bin/bash
# Double-click in Finder (macOS) to start Draft XI.
cd "$(dirname "$0")" || exit 1
exec python3 server.py "$@"
