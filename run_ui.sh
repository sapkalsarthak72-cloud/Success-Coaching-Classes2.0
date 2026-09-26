#!/bin/bash
pkill -f dev-server.js 2>/dev/null; sleep 0.5
cd "$(dirname "$0")"
setsid nohup node dev-server.js > /tmp/server.log 2>&1 &
sleep 3
python3 "$@"
