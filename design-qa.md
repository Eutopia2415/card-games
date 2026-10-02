# Midnight Club frontend verification

final result: passed

The user selected the first Midnight Club concept and requested card-play/deck-deal animations and a yellow active-hand hue. Implementation stays in the existing Card Games project and preserves its rules, expert bots, solo saves and private multiplayer hands.

## Visual comparison

Source: `generated_images/exec-cd93f60b-a604-4bb5-bd74-ef9f04596f1f.png`, 1487 × 1058, normalized to 1440 × 1024. Render: Chromium, density 1, 1440 × 1024, own turn with ten cards and two selected cards. Full comparison `/tmp/card-ui-qa/comparison-final.jpg` and focused hand comparison `/tmp/card-ui-qa/hand-comparison.jpg` were inspected together. Actual screenshots: `/tmp/card-ui-qa/desktop-selected.png`, `layout-390.png`, `layout-375.png`, `layout-1024.png`, `dealing.png`, `play-in-flight.png`, `error-375.png`, `villager-draw.png`, `villager-discard.png`, `king-thirteen.png`, `multiplayer-3.png` and `multiplayer-2.png` in the same directory.

Typography uses Georgia display text and system UI text. Teal felt, wood rim, blue patterned backs, ivory native cards, red action buttons and yellow turn glow match the selected direction. Real generated table/card-back assets and licensed Phosphor suit/crown SVGs are bundled locally. Own cards fan and lift without replacing focused DOM nodes. Cards show actual game state; the reference's duplicated card is intentionally absent. Counts and native rotated card corners use correct game data. The draw deck labels the two aside cards. Small-phone activity access moves beside the hand heading to keep actions reachable.

## Findings resolved

- Opponent backs and turn glow were too subtle: enlarged desktop backs, revised blue asset and strengthened active-seat glow.
- Compact layouts pushed action controls below the viewport: adjusted fan curvature, hand spacing and compact overrides. Primary actions are above the fold at 375 × 667; supplemental content may scroll vertically. No horizontal overflow.
- Focused-card stacking blocked adjacent taps: removed the stacking override while preserving keyboard focus; adjacent drawn-card and three-card return selections pass.
- Twelve/thirteen-card hands overlapped counts or controls: normalized fan geometry and added hand spacing.
- Friendly error feedback overlapped the hand heading on phones: moved it to the top connection line and verified its visible bounds.
- Empty exchange pile/deck overlapped question controls: hide the empty pile during exchange phases and reposition the deck. King questions and thirteen-card return are playable on 375 × 667.

No unresolved P0, P1 or P2 visual/interaction findings. Generated material grain and native licensed icons are deliberate implementation differences.

## Interaction and correctness evidence

- Ten JavaScript tests passed: public-safe event reconstruction, no invented private faces, reconnect/session changes, round/deal and friendly errors.
- Nine Python bridge tests passed: full round/exchange, atomic illegal moves, private views, restore, any Villager discard and animation metadata including ace/bomb clears.
- Eighteen existing relay tests passed; three opt-in remote tests skipped. No relay changes in this redesign.
- Three deterministic complete rounds, 104 decisions: role exchanges, all 32 cards conserved and private motion contains counts only.
- Thirteen browser flow checks passed: page identity, actual active-seat glow, friendly rejected move preserving cards, card flight, rules/room validation, activity drawer, save/reload, 30-card round-robin deal, 390 × 844 / 375 × 667 / 1024 × 768 interaction layouts, reduced motion and clean console.
- Full native solo round passed with actual expert bots: role scores, conservation, plays/clears, next-round score preservation, face-down Villager draw and discarding the two drawn cards.
- King questions, adjacent selections and three-card return passed at 375 × 667.
- Three human browsers and two humans plus an expert bot passed private disjoint hands, visible deals, routed plays/passes/clears, synchronized active glows and guest reload/rejoin. Final console/page errors and failed requests were empty.

Reports: `/tmp/card-ui-qa/flows-report.json`, `round-report.json`, `multiplayer-report.json`. A transient local test-server socket backlog caused a suit SVG reset under simultaneous browser startup; raising only the temporary test server's backlog resolved it and the complete multiplayer rerun passed.

Browser QA used isolated headless Chromium after the user's explicit approval; no personal browser profiles or tabs were touched. Safari was not tested. Reduced motion retains the static turn glow and suppresses travel animations. Four/five-player modes remain outside this version's scope. Publication and live-site verification are recorded by the delivery commit; this report describes the tested source.
