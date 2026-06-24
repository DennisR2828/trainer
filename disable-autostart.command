#!/bin/bash
# Undo auto-start: stop the login server and remove the agent. Double-click to run.
# Your data is untouched (it lives in your browser, not here).
launchctl bootout "gui/$(id -u)/com.trainer.localserver" 2>/dev/null
rm -f "$HOME/Library/LaunchAgents/com.trainer.localserver.plist"
# stop any running server on the port
pkill -f "http.server 4178" 2>/dev/null
echo "Auto-start disabled and the agent removed."
