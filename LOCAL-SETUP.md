# Run Trainer locally on your Mac

Everything runs on your machine. Your logs live in your browser's local storage
on this Mac — nothing is sent anywhere, no account, no internet needed after the
first load.

A tiny local server is required (browsers block the offline features and local
database when a page is opened directly as a `file://`). It's built into macOS
(Python), so there's nothing to install.

## Use it (the simple way)

1. In Finder, go to your `fitness-tracker` folder.
2. Double-click **`Trainer.command`**.
   - The first time, macOS may ask to confirm opening it — click Open.
   - A Terminal window opens, starts the server, and your browser opens the app.
   - You can close that Terminal window; the app keeps working.
3. Go through the intake once. Your plan and logs are saved on this Mac.

The app lives at **http://127.0.0.1:4178** while the server is running.

## Make it feel like a real app (recommended)

Install it so it gets its own icon and window, no browser tabs:

- **Safari:** with the app open, menu bar → **File → Add to Dock…** → Add.
- **Chrome / Edge:** open `http://127.0.0.1:4178`, then the **⋮** menu →
  **Cast, save, and share → Install page as app** (or the install icon in the
  address bar) → Install.

Now launch it from the Dock / Launchpad like any app. (Keep using
`Trainer.command` to make sure the server is running first — or turn on
auto-start below so it's always ready.)

## Optional: start automatically at login

So you never think about the server:

- Double-click **`enable-autostart.command`** once. The server will start at every
  login from then on (and immediately).
- To undo it, double-click **`disable-autostart.command`**.

This adds a small background launch agent
(`~/Library/LaunchAgents/com.trainer.localserver.plist`) that runs the same local
server. It only listens on your own machine (127.0.0.1).

## Back up your data (do this once you've logged a bit)

Because the data lives only in this browser, keep a copy:

- In the app, go to **Plan → Your data → Export backup**. It downloads a
  `trainer-backup-YYYY-MM-DD.json` file. Keep it somewhere safe (Dropbox, etc.).
- To restore or move to another browser/computer: open the app there and use
  **Plan → Your data → Import backup**.

The app also asks the browser to keep your data from being auto-cleared, but an
occasional export is still the real safety net.

## Moving it to another Mac

Copy the whole `fitness-tracker` folder over, double-click `Trainer.command`
there, then **Import backup** your latest export.

## Troubleshooting

- **App won't load:** make sure the server is running — double-click
  `Trainer.command`. Check `/tmp/trainer-server.log` for errors.
- **Port already in use:** something else is on 4178. Change `4178` in
  `Trainer.command` (and `com.trainer.localserver.plist` if you enabled
  auto-start) to another number like `4180`, and reinstall to the Dock.
- **Data looks empty after I changed the address:** the browser ties data to the
  exact address. Always use `http://127.0.0.1:4178`. If you installed from a
  different address, Import your backup.
