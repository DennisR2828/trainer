#!/bin/bash
# Optional: make the Trainer server start automatically every time you log in,
# so you never have to launch it. Double-click to enable. Undo with disable-autostart.command.
# This generates the launch agent from your own home path (nothing machine-specific is stored in the repo).
DST="$HOME/Library/LaunchAgents/com.trainer.localserver.plist"
DIR="$HOME/fitness-tracker"

mkdir -p "$HOME/Library/LaunchAgents"
cat > "$DST" <<PLIST
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
  <key>Label</key>
  <string>com.trainer.localserver</string>
  <key>ProgramArguments</key>
  <array>
    <string>/usr/bin/python3</string>
    <string>-m</string>
    <string>http.server</string>
    <string>4178</string>
    <string>--bind</string>
    <string>127.0.0.1</string>
    <string>--directory</string>
    <string>$DIR</string>
  </array>
  <key>RunAtLoad</key>
  <true/>
  <key>KeepAlive</key>
  <true/>
  <key>ProcessType</key>
  <string>Background</string>
  <key>StandardOutPath</key>
  <string>/tmp/trainer-server.log</string>
  <key>StandardErrorPath</key>
  <string>/tmp/trainer-server.log</string>
</dict>
</plist>
PLIST

launchctl bootout "gui/$(id -u)/com.trainer.localserver" 2>/dev/null
if launchctl bootstrap "gui/$(id -u)" "$DST"; then
  echo "Auto-start enabled. The Trainer server now runs at login (and right now)."
  sleep 1
  open "http://127.0.0.1:4178/"
else
  echo "Could not enable auto-start. Check /tmp/trainer-server.log"
fi
