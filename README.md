# King · Villager · Peasant

Three-player house-rule card game. Solo practice uses observation-only expert bots. Play with friends creates a private room code for two or three humans; an empty seat is a bot. The host must keep the tab open. Rejoin a disconnected game with the same browser and room code. Only the host can begin the next round.

The existing Python rules and bots execute in a module web worker using bundled Pyodide 314.0.7. PeerJS 1.5.5 supplies WebRTC data channels with its public signaling service. Guest browsers receive their own hand and public game information. This is a casual game: the host controls the engine and can inspect its own runtime. Room connectivity depends on browser/network WebRTC support; restrictive networks may prevent joining.

The Villager draws two cards and chooses ANY two cards from the resulting twelve to discard, including either drawn card. No live move recommendations.

## Development

Serve this directory using `python3 -m http.server 8766`. Open `http://localhost:8766/`.

Run bridge checks: `python3 -m unittest discover -s python -p test_browser_bridge.py`.

The bridge tests verify seat privacy, transactional rejection, human turn control, full rounds, host-only round control, Villager choices for all seats, and solo save/restore. The original engine tests remain in the existing local Card Games practice project.

Vendor licenses are included beside their assets. Saved solo games remain in browser local storage and are never published to GitHub or sent to room guests.
