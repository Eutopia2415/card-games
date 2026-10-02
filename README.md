# King · Villager · Peasant

Three-player house-rule card game. Solo practice uses observation-only expert bots. Play with friends creates a private room code for two or three humans; an empty seat is a bot. The host must keep the tab open. Rejoin a disconnected game with the same browser and room code. Only the host can begin the next round.

The existing Python rules and bots execute in a module web worker using bundled Pyodide 314.0.7. Cloudflare supplies a secure WebSocket relay with SQLite-backed Durable Objects on the verified Workers Free plan. Guest browsers receive their own hand and public game information. This is a casual game: the host controls the engine and can inspect its own runtime. Shared rooms use secure WebSockets instead of direct WebRTC connections. Free-plan quotas can temporarily limit service. The host must keep the original tab open; a full host-tab reload needs a new room. Temporary connection interruptions reconnect automatically. Rooms expire after 24 hours.

The Villager draws two cards and chooses ANY two cards from the resulting twelve to discard, including either drawn card. No live move recommendations.

## Development

Serve this directory using `python3 -m http.server 8766`. Open `http://localhost:8766/`.

Run bridge checks: `python3 -m unittest discover -s python -p test_browser_bridge.py`.

The bridge tests verify seat privacy, transactional rejection, human turn control, full rounds, host-only round control, Villager choices for all seats, and solo save/restore. The original engine tests remain in the existing local Card Games practice project.

Vendor licenses are included beside their assets. Relay source and deployment configuration are maintained in the existing local Card Games/relay-draft directory. Saved solo games remain in browser local storage and are never published to GitHub or sent to room guests.

Live multiplayer verification passed with three humans and two humans plus a bot, checking private hands, legal full rounds, role exchanges, guest reconnects and live-host reconnects. Solo expert bots completed a conserved full round. Browser visual verification of the relay update was unavailable; the existing UI structure and rule engine were preserved.
