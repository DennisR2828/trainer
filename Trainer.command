#!/bin/bash
# Trainer — double-click to start the local server (if it isn't already running)
# and open the app. Data lives in your browser on this machine only.
PORT=4178
URL="http://127.0.0.1:${PORT}/"
DIR="$HOME/fitness-tracker"

echo "Starting Trainer…"

# Already up? Just open it.
if curl -fsS -o /dev/null "$URL" 2>/dev/null; then
  echo "Server already running."
else
  cd "$DIR" || { echo "Could not find $DIR"; exit 1; }
  # start detached so this window can be closed; survives logout via nohup
  nohup /usr/bin/python3 -m http.server "$PORT" --bind 127.0.0.1 >/tmp/trainer-server.log 2>&1 &
  for _ in 1 2 3 4 5 6 7 8 9 10; do
    curl -fsS -o /dev/null "$URL" 2>/dev/null && break
    sleep 0.3
  done
  echo "Server started on $URL"
fi

open "$URL"
echo "Opened in your browser. You can close this window."
