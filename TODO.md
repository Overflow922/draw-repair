# TODO

Follow-ups from `fix-wall-move-joints` (archived 2026-10-04, commit `83e9b78`).

## Bugs

- [ ] **T-attached neighbour doesn't move when a wall is moved** (original bug 1). Did not reproduce after toggling ortho.
  If it shows up again, run `copy(localStorage.getItem("draw-repair:drawing"))` in the browser console right
  before the move and save the result as a repro. Suspected cause: `teeEndAttached` (`src/geometry.ts`) accepts
  a stem end only if it lies exactly on the axis or face (tolerance `1e-6`), so a slightly drifted stem is not
  recognised as a T.
- [ ] **T-stem cuts into a wall that turns.** With ortho off, a wall whose end follows a move rotates; a wall
  T-attached to its face then ends up 1–2 cm inside its body (e.g. `233d2375` vs `5912b043` in the user drawing).
  Rendering trims the stem, but the data no longer describes a joint on the face.

## Tests

- [ ] (deselect-tool-on-element-select, 2026-10-07) `src/main.ts` wiring has no automated test: `afterElementPress` calls in the `pointerdown` branches (element press, editable number / direction zone press) and in `finishMarquee`, `leavePlacing`, and the `hoverWorld` → `hoverDoorDirection` hover highlight. Only the pure rules (`afterElementPress`, `doorZoneAt`, `hoverDirection`, render option) are unit-tested; the DOM flow was checked by hand in the browser.

- [ ] Ruler: add a direct test that the 1 cm corner margin applies (corner on a face at 14.27 cm), e.g. in
  `src/ruler-joint-tilt.test.ts`. Currently covered only indirectly via `faceCornerTol` (FM-1, CJ-16).
- [ ] Far-end occupancy with drift: stem's far end joined at 14.14–15.14 cm, e.g. `g (0,0)-(200,0)`,
  `V (100,10)-(100,150)`, `H (89.82,160)-(0,160)`, move `g` by `(0,-20)` → `V.b` stays at `(100,150)`.
- [ ] Far-end occupancy with walls of different thickness.
- [ ] Arrow-key nudge without ortho: automated test (currently checked only manually in the browser).

## Docs

- [ ] `design.md` D2 of the archived change describes `endOccupied(walls, w, end)`; the code signature is
  `endOccupied(p, w, walls)` (`src/geometry.ts`).

## Out of scope (decided, revisit if needed)

- Coordinate drift itself is not corrected; the 1 cm margin only makes joint classification tolerant to it.
- Hairpin joints (walls folding back at a shared end) have no special rendering rule.

---

Follow-ups from exploring ortho wall moves (2026-10-05, planned change `ortho-axis-lock`).

(The two bugs "slightly tilted wall drags the drawing" and "typed length for a tilted wall drags the drawing"
were fixed by `fix-ortho-tilted-stretch`, 2026-10-08, and removed from this list.)

## Tests

- [ ] `orthoGestureStep` (`src/ortho-gesture.ts`): no test tells an endpoint-drag seed `{ kind: "end" }`
  apart from a whole-wall seed (mutant G29 in `test-validation.md`). With the wrong seed, walls T-attached
  to the edited wall's face are wrongly excluded from snapping, so the end misses a snap and falls back to
  the grid. Validator probe: end should snap to `(303, 300)` on wall S, mutant gives `(310, 300)`.
- [ ] Zero-length walls are not filtered from ortho-gesture snapping in tests (mutant G16, no spec scenario).

## Out of scope (decided, revisit if needed)

- With ortho on, moving a wall along its own axis moves the neighbouring perpendicular walls whole,
  which in a plan of connected rooms can move everything. The spec requires this
  (`wall-selection` "Орто-растяжение связанных стен", scenario "Поперечный сосед смещается целиком
  и передаёт дальше").

---

Follow-ups from `add-doorway` (test validation revision 3, PASS, 2026-10-06). Non-blocking surviving mutations and gaps.

## Tests

- [ ] Per-doorway "do not deepen" baseline: no test combines one already-broken doorway with a valid one, so comparing one worst violation across all doorways would let a valid doorway break while a broken one exists. Add DD-06c / DG-12b in `src/doorway/doorway-guard.test.ts`.
- [ ] Broken doorway at a corner: DL-13 uses a free wall, so clamping the cut, grey lines or jamb to the axis instead of the face run isn't caught. Add DL-13b on `sceneR` asserting nothing is drawn beyond x = 490 on the inner face.
- [ ] Wall snap with an already-broken doorway: the "do not deepen" rule in the snap filter is not tested directly (DD-06d).
- [ ] DL-12: assert the host wall is not highlighted when its doorway is selected.
- [ ] Cut and jambs on a 10 cm host (all render tests use 20 cm).
- [ ] `hitDoorway` tolerance along the axis, just outside a jamb.
- [ ] PDF page bbox through `buildPdf` / `availableFormats` with the H label (DP-03 tests only `wallsBBox`).
- [ ] Undo of a closed tab keeps its doorways (`drawing-history` «Отмена закрытия вкладки»).
- [ ] DL-07: no dimension line is drawn for a 0 distance (only the number).
- [ ] DL-03c: also check the label's x position (between the jambs).
- [ ] DP-01: assert the PDF output has no wall hatching in the middle of the opening and has the grey continuation lines.

## Docs

- [ ] Test-plan item DL-11 (canonical wall shape unaffected by doorways) has no dedicated test; covered indirectly by DR-01/DR-02 and DL-01 (see `openspec/changes/add-doorway/test-suite.md` Notes).

## Out of scope (decided, revisit if needed)

- [ ] Two doorways overlapping on the same wall: the spec says nothing; no test, no rule.

Follow-ups from `add-doorway` implementation (2026-10-06).

## Docs

- [ ] Design open questions settled in code, not yet in `design.md`: dimension chains sit at 1.2·labelPx from the face; the H label sits 2.2·labelPx (screen, past the chain band) or 0.5·labelPx (PDF, no chains) plus half of its estimated extent along the face normal, text width estimated as 0.6·labelPx per character because jsPDF `measureText` does not return sheet units (`src/render.ts` `drawDoorways`); the PDF bbox reserves 2·pad + 1 cm for the label (`src/export/pdf.ts` `wallsBBox`).

## Bugs

- [ ] Inline number editor (`src/doorway/doorway-tool.ts`) stays at its screen position if the user zooms or pans while typing; it closes only on Enter/Esc/blur. Decide: close on view change or reposition.
- [ ] Very short chain dimensions (e.g. 5 cm at 1:1 zoom) draw their number over the arrows ("50", "150" next to a corner) — same behaviour as ordinary dimensions, but more frequent with doorways near corners.

## Tests

- [ ] H label of an opening flush in a corner is wider than the opening and runs into the corner wall (seen in PDF: 90 cm opening, "H=2000"). Label is centred on the opening (`heightLabelAt`); consider shifting it along the face away from the corner.

## Out of scope (decided, revisit if needed)

- [ ] Performance: moving a host wall with doorways on a 61-wall drawing costs ~14 ms per step (vs ~2 ms without doorways) because the limiter re-runs face probes on every path step (`src/doorway/doorway-guard.ts`). Acceptable now; cache `displayPolygons` per step if drawings grow.

---

Follow-ups from `add-window` test validation (revision 2, 2026-10-06). Non-blocking.

## Tests

- [ ] WL-07 (`src/doorway/window-render.test.ts`): the label frame is checked to enclose the anchor points of both text parts, not their edges. Add an edge check once text width can be measured in the recording context (currently estimated at 0.6·labelPx per character).
- [ ] WP-01 (`src/doorway/window-pdf.test.ts`): "more strokes than without a window" is weak; assert the window squares and the label frame in sheet coordinates.
- [ ] Tool adapter (`src/doorway/window-tool.test.ts`): editing a panel field of one kind while an element of the other kind is selected; the doorway tool's `pressDoorway` on a window (now manual check M-03); the width field for new windows (validation revision 3).
- [ ] Dark palette: no test checks that `DARK_PALETTE.sill` (window «H под.» label) contrasts with the dark background (color-theme «Две цветовые схемы»); a mutant `#1e3a8a` (~1.6:1) passes. Add `"sill"` to `DARK-ACCENT-1` in `src/theme.test.ts` (≥ 3:1) via a test change request (validation revision 5).

## Docs / UI (add-window implementation, 2026-10-06)

- [ ] Window label spacing: part widths are estimated at 0.6·labelPx per character (`src/render.ts` `labelWidth` / `drawElementLabel`), which over-estimates for the UI font — the gap between «H=1500» and «H под.=850» looks wider than in the reference image. Frame padding is `LABEL_FRAME_PAD = 0.3·labelPx`, square corners (design open question: corner radius not decided). Consider `measureText` on screen and keeping the estimate only for PDF.

## Tests (add-window label orientation, validation revision 7, 2026-10-06)

- [ ] `src/doorway/label-orientation.test.ts`: the direction wrapper is built on `recorder()`, so a label frame drawn with `strokeRect` (no-op there) or `arcTo` (missing) would falsely fail LO-06/LO-08; switch to `colorRecorder()` semantics if the frame drawing changes.
- [ ] LO tests don't check the text "up" vector — a mirrored transform (`rotate(θ+π)` + `scale(-1, 1)`) would pass.
- [ ] No automated check that PDF labels are rotated (verified manually: jsPDF text matrix 11.3° on a tilted wall, 90° on a vertical one); LO-09 covers only a vertical wall's bbox.
- [ ] Doc drift: the comment in WP-03 (`src/doorway/window-pdf.test.ts`) still says the label is horizontal; the assertion remains valid.
- [ ] Doorway label frame in PDF (validation revision 9, G1): LF-PDF-01 checks only that an ink frame surrounds «H=210»; a PDF-only frame without padding, drawn with `contourPx`, or reaching into the wall body would pass. Add padding and outside-the-body checks to `src/doorway/doorway-label-frame-pdf.test.ts`. Dashed frames are not recordable by the test context (window and doorway alike).
- [ ] Test name drift: WL-07b in `src/doorway/window-render.test.ts` is titled «у проёма рамки и синей части нет», but doorway labels are now framed; its assertions (no «H под.», one «H=210») are still valid.

---

Follow-ups from `fix-midpoint-marker-priority` (archived 2026-10-07).

## Tests

- [ ] Press priority is covered by `pressPick` tests (`src/doorway/press-pick.test.ts`), but the `pointerdown`
  routing in `src/main.ts` (options per tool, `selectedWall = null` for multi-selection, action per pick kind) is
  checked only manually in the browser; needs an e2e/DOM harness for canvas gestures.
- [ ] Toolbar button wiring in `src/main.ts` has no automated test either: the «Стена» button did not open its
  panel on the first click from another tool (fixed 2026-10-07, `canvas-app` scenario «Открытие при выборе
  инструмента», checked manually). Cover tool-button → panel open/close once the DOM harness exists.

## Out of scope (decided, revisit if needed)

- End markers of a selected wall stay active in every tool, including «Проём»/«Окно» (only the middle marker is
  disabled there). Unchanged by this change; spec `wall-selection` does not say either way.

---

Follow-ups from `add-door` test validation (2026-10-07, revision 2, VERDICT: PASS).

## Tests

- [ ] F6: `expectArc95` (`src/doorway/door-render.test.ts`) and the arc check in DP-01 (`src/doorway/door-pdf.test.ts`)
  accept an arc ending anywhere in [93°, 100°); a 98° sweep survived mutation. Move the outside check point from
  100° to ~97°. The exact 95° is pinned only in geometry (DG-07, `src/doorway/door-leaf.test.ts`).
- [ ] F7: DP-01 checks the PDF leaf only via "more strokes than a doorway"; the leaf geometry itself is checked on the
  canvas (DR-01, DR-05). Add a device-space check of the leaf in the PDF.
- [ ] F8: DH-03 (`src/doorway/door-storage.test.ts`) has no history snapshot with a missing or `null` `swing`; covered
  only indirectly through the shared validator (DS-03).
- [ ] Group panel wiring in `src/main.ts` (`#tool-openings`, panel blocks, active classes) is checked only manually
  (test-plan M-02, M-03, M-06); cover once the DOM harness exists.

Follow-ups from `add-door` implementation (2026-10-07).

## Out of scope (decided, revisit if needed)

- The «H=…» label of a door uses the doorway placement rule and may sit inside the swing area when the door opens to
  the label's side (seen in the browser check: free wall, opening `left`). The user accepted the doorway rule.

---

Follow-ups from planning `popups-buttons-only` (2026-10-07).

## Out of scope (decided, revisit if needed)

- [ ] Wall panel still has a thickness field: the only exception to "popups contain only buttons" (`canvas-app`
  «Вспомогательная панель инструмента»). The user deferred it; moving thickness onto the canvas needs a new
  thickness number on the selected wall (explored option: a thickness dimension across the wall at ~¼ of its
  length, clear of the middle marker). Walls also keep the old "last selected" default rule, not "last edited".
- [ ] The selected wall's length is still edited in the bottom bar «Длина» field (not a popup, so not covered).

## Docs (implementation, 2026-10-07)

- [ ] Code kept only for approved tests, unused by production after `popups-buttons-only`: `elementDefaults` and
  `acceptField` (`src/doorway/element-kind.ts`; tests DK-01, DK-02, WT-01, WT-02) and `ElementToolHost.unitLabel`
  (`src/doorway/doorway-tool.ts`; still provided by the approved fake host in `selection-editing.test-utils.ts`).
  Remove them through a test-change-request.
- [ ] `index.html`: «Окно» and «Размер» keep an empty `tool-anchor` wrapper. PB-GR-01 slices the group panel up to the
  next `tool-anchor`/separator, so a bare «Окно» button right after it would count as a panel button.
- [ ] Number editor stays at its screen position if the view changes while typing (existing, see add-doorway
  follow-up); now also reachable from the door/window labels.

## Docs

- [ ] `.claude/rules/ui.md` still describes the old pattern "panel values apply to new objects; selecting an object
  opens its tool panel showing its values". After `popups-buttons-only` it should say: popups hold only buttons,
  numbers are edited in place (dashed underline, click to edit), new objects inherit from the last edited one.
  The file belongs to the user.
- [ ] Purpose lines of the synced main specs are stale (a delta spec cannot change Purpose, the sync leaves it alone):
  `openspec/specs/dimension-selection/spec.md` still mentions editing the offset "через панель свойств";
  `openspec/specs/door/spec.md` still mentions «кнопкой поворота».

## Tests

- [ ] Number editor focus (found by the user 2026-10-07, fixed in `openNumberEditor`): focusing the input inside
  `pointerdown` was undone by the browser's own `mousedown` focus handling, so the editor closed on `blur` at once.
  Unit tests and synthetic `dispatchEvent` clicks cannot see this (no default actions); it needs a real-input
  (trusted click) test once a DOM/e2e harness exists. Reproduced and verified manually with a trusted click.
- [ ] `pointerdown` routing (number → door zone → `pressPick`) and the "no panel on selection" wiring in
  `src/main.ts` are covered only by source-order checks (PB-INT-01/02, PB-GR-02); verify in the browser until a
  DOM harness exists.
- [ ] Validation revision 2 (PASS), non-blocking: no executable test shows that undo does not restore the
  new-element parameters or that they are shared across tabs (only static guards PB-INT-01/03). A snapshot restore
  added to undo in `main.ts` would survive. Cheap fix: a static check that the parameter variable is assigned only
  at its declaration and in `inherit`.
- [ ] PB-RN-04 checks "no underline in PDF" only near the label; a chain-number underline in PDF would survive
  (chains are not drawn in a real export). Underline independence from zoom is also unchecked.
- [ ] PB-INT-02/03 are text checks of `main.ts` tied to its current shape (`let v = initialParams()`,
  `ElementToolHost = {`); a refactor fails loudly, not falsely. Replace with a DOM harness test when it exists.

---

Follow-ups from exploring and planning `diagonal-corner-snap` (2026-10-08).

## Bugs

- [ ] **Intermittent vitest worker crash.** `npx vitest run` sometimes ends with `[vitest-pool]: Worker forks emitted
  error` / `Worker exited unexpectedly` and one test file is lost (85 of 86 files pass, exit code 255). Seen in 2 of 8
  runs of the whole suite with the `diagonal-corner-snap` test files excluded, so they are not the cause. Suspected
  cause: a forked worker dying on Windows (memory or process pool); not investigated.

## Tests

- [ ] `diagonal-corner-snap`: the wiring in `src/main.ts` (corner snap of the start vertex, preview of the closed
  corner) has no automated test; check by hand in the browser (draw a wall, move the cursor to its end corner, click,
  draw down).

## Out of scope (decided, revisit if needed)

- The diagonal corner snap applies to the first vertex of a wall only; the second vertex and the ray snap
  (`snapOnRay`) keep the old rules.
- Only right-angle diagonal corners are filled; non-right angles are not.
- Moving one wall of a diagonal pair with `moveWalls` moves only the neighbour's joined end, so the neighbour slants
  (about 8.5° in the planning example) and the pair stops being a right angle: the filled corner block disappears.
  Whether such a pair should follow rigidly is not specified by this change.
- Tolerance mismatch for a diagonal pair: the display closes the corner when each of the distances E→I and S→I is
  within 1 cm of the neighbour's half-thickness (`diagonalCornerBlock`, `src/wall-geometry.ts`), but the move and edit
  code treats ends as joined by `faceCornerTol` on `|S−E|` alone. A pair shifted by about 0.9 cm on both axes is shown
  closed yet may not be recognised as joined when a wall is moved. Not covered by a test.

---

Follow-ups from exploring the PDF frame (2026-10-08, change `pdf-frame-title-block`).

## Tests

- [ ] `availableFormats` padding `0.5 * scale` cm around the drawing (5 mm on paper) is not pinned by any test:
  changing it does not fail the suite (mutation found by the validator, `test-validation.md`; same before this change).
- [ ] PDF title block: a diagonal thin line inside the block is not detected (the test helper compares only
  axis-aligned segments); the standard font size of the contents is not specified, so any fitting size passes;
  the drawn text of cell 1 is not checked for file-name sanitising (only `titleBlockTexts` is).

## Out of scope (decided, revisit if needed)

- Several pages: the form of the title block for the following sheets (185 x 15 mm, 3 rows of 5 mm). Columns
  left to right 10 / 10 / 10 / 10 / 15 / 10 (Изм., Кол., Лист, №док., Подп., Дата), then cell 1 (110 mm) and
  cell 7 "Лист" (10 mm wide; 7 mm label row, 8 mm number row). Source: gk-drawing.ru, construction-drawing-title
  page, "последующие листы". The export already works from a list of pages; this form and the "Лист / Листов"
  numbers are to be added with multi-page export.
- Portrait orientation: export is landscape only. A tall drawing may need a larger format than a portrait page
  would (portrait A4 drawing area would be 185 x 232 mm).
- Cell 5 (page name) of the title block stays empty until the page name is defined.
- Additional graphs along the left margin of the frame (инв. № подл., подп. и дата, взам. инв. №; a 5 + 5 + 5 + 5 mm
  strip) are not drawn.

---

Follow-ups from `fix-ortho-tilted-stretch` (archived 2026-10-08).

## Tests

- [ ] Manual browser check not done (task 2.5): a drawing with a side wall tilted 3 cm over 300 cm; with ortho on,
  moving a wall, dragging a corner and typing a length must not move the rest of the drawing. Unit tests cover the same
  path (`TL-01`…`TL-16`, `src/ortho-stretch-tilt.test.ts`, `src/wall-edit-ortho-tilt.test.ts`); the `src/main.ts` wiring
  was not changed.
- [ ] No test sits exactly on the 5° boundary: `<=` vs `<` in `link` (`src/ortho-stretch.ts`) survives mutation
  (judged non-critical in `test-validation.md`: a bit-exact input would be coupled to how the constant is computed).
- [ ] `TL-05b` (`src/ortho-stretch-tilt.test.ts`) still quotes the old spec wording «вправо вдоль себя» in its title; it
  works as a pin that a perpendicular neighbour moves whole.

## Out of scope (decided, revisit if needed)

- A neighbour stretched within 5° can rotate slightly (at most `atan(|v|·sin 5° / L)`; about 1.7° for v = 100 cm,
  L = 300 cm) because the joint stays exact. Chosen over keeping direction exactly, which would pull the joint apart.


---

Follow-ups from the change `auto-wall-dimensions` (model of visible face pieces, 2026-10-09).

## Bugs

- [ ] Oblique joints and parallel overlaps are not described by the spec: a wall end meeting another at a slanted angle (e.g. 60° corner, 45° stem) can give one length dimension instead of two, and a 5 cm gap between collinear walls removes the length dimensions of both walls (the implementation only skips pieces with a resolved length below 1e-6 cm). Decide the expected dimensions in the spec and add tests.

## Tests

- [ ] `src/main.ts` wiring of `placeWall`/`syncAutoDimensions` in `commitPoint` (one `pushRecord()`, `dimensions` replaced by the result) and the `delete dragged.auto` on dragging a dimension line have no automated test; checked by hand in the browser (single wall: four dimensions; stem on a bar: eight, the bar's face dimension replaced; undo and redo as one step). Dragging a dimension to clear `auto` was not exercised in the browser.
- [ ] Test validation of `auto-wall-dimensions` stopped after two FAIL rounds without PASS (agreed limit); tests were then checked with 35 mutants of the real implementation (see `openspec/changes/auto-wall-dimensions/test-validation.md`). Survivors left as notes: array position of the placed wall, anchor-radius and key-scale constants, `-0` in the geometry key.

## Docs

- [ ] `openspec/specs/wall-dimensions` Purpose says automatic dimensioning of walls was removed; after `auto-wall-dimensions` it is outdated (dimensions are created when a wall is placed and recomputed for touched walls). Reword the Purpose.

## Out of scope (decided, revisit if needed)

- Dimensions of the wall pieces on both sides of a doorway (chain with a total, as in the reference drawing `img.png`): separate change, needs a new anchor kind for doorway reveals in `dimension-tool`, storage and following the doorway.
- Automatic dimensions are not recomputed when a wall is erased, moved, stretched, or its thickness or doorways change: dimensions follow their walls through anchors; a stale piece dimension can remain after the neighbour is erased.
- A wall started on one wall and ended on another is covered by the visible-pieces rule; its own scenarios have not been specified separately.

## merge-collinear-walls (2026-10-09)

### Tests

- [ ] `src/main.ts` wiring of `mergeContinuation` in `commitPoint` (one `pushRecord()`, in-place replacement of `walls` and `doorways`, `blocked` leaves the chain) has no automated test; checked by hand in the browser (two collinear segments give one wall, undo and redo as one step, a perpendicular wall at the end stays separate).
- [ ] Test validation of `merge-collinear-walls` ended after five FAIL rounds without PASS (user decision); the tests were later checked with the validators' mutants against the real implementation (see `openspec/changes/merge-collinear-walls/test-validation.md`).

### Out of scope (decided, revisit if needed)

- Bridge: a wall between two collinear free ends merges only with the first one; joining the two existing walls into one is a separate change.
- Merging walls that are already drawn (on load or by a command) is not done.
- The spec does not say which wall wins when several walls qualify as the continued one (design D2: smallest gap, then first in the array), nor how a zero-length wall is treated.

## widen-corner-snap-window (2026-10-09)

### Tests

- [ ] `snapStartVertex` (`src/wall-snap.ts`): the corner candidate in the touched-walls branch looks unreachable, because the base `snapVertex` call before it already offers the same corner candidates (same window, same acceptance), so the branch can only see corners the base call rejected. No test reaches it; it passes `true` per design D3. Verify and either drop the flag there or keep a test that proves it is reachable.
- [ ] Test validation of `widen-corner-snap-window` ended with PASS in round 2 (round 1 FAIL: no test for corner vs another wall's candidate, GS-17 coverage lost). Equivalent survivors left as notes: lower bound `> 0` without the `SLICE` margin, dropping the lower bound on `across`, no `return` after an accepted corner.

### Docs

- [ ] `openspec/specs/wall-drawing` "Привязка к существующим стенам" scenario "Привязка к концу стены" still says a cursor outside the wall strip snaps to the face; since this change the window past the end plane gives the corner snap instead. Reword when the change is archived.

## select-only-without-tool (explore + planning, 2026-10-09)

### Tests

- [ ] `src/main.ts` wiring (pointerdown/click/marquee gated by `selectionAllowed`, Esc via `escapeAction`, `afterPlace` after a placement) has no automated test; checked by hand in the browser on 2026-10-09 (wall tool click on a body, Esc/Esc, ruler/dimension clicks, marquee with and without a tool, door placement, a room drawn wall by wall). Not exercised by hand: marker drag, dimension offset drag, in-place number editing and door direction zones under an active tool (they share the single early `return` in `pointerdown`).
- [ ] `PB-INT-02` (`src/doorway/popups-ui.test.ts`) is a source-text check: a guard `!selectionAllowed(tool)` without a `return` would still pass. Tighten the regex to `if (!selectionAllowed(tool)) return` through a test-change-request.
- [ ] `afterPlace` has no "an element was placed" input; `main.ts` calls it only when `doorways.length` grew. No unit test for "click over an existing element keeps the tool" (test-validation note, former DS-4b).

### Docs

- [ ] Three scenario titles in the delta specs keep the old, now false wording because `openspec validate` requires a MODIFIED requirement to keep all current scenario titles: `door` «Клик по окну в инструменте «Дверь» выделяет окно», `window` «Клик по проёму в инструменте «Окно» выделяет проём», `wall-drawing` «Клик по телу стены выделяет, клик по квадрату рисует» (also `canvas-app` «Выделение двери при инструменте группы деактивирует его», true only for placement). Rename them after archiving.

- [ ] Spec wording: `canvas-app` «Выделение и правка только без инструмента» says "Esc или выбор состояния «Без инструмента»", but the app has no button for that state; only Esc leaves a tool. Reword on archive.

### Out of scope (decided, revisit if needed)

- Selection is only possible in the «Без инструмента» state. Editing a wall during drawing requires Esc first (user decision, 2026-10-09).

## drawing-plans (explore + planning, 2026-10-09)

### Tests

- [ ] `buildPdfPages` page colours/palette are not asserted for any page: `pdf-ops.test-utils` `parsePaths` does not parse colour operators, so "pages after the first use a different palette" and "grid drawn on all pages" survive the whole `src/export` suite (test-validation round 4). Add colour-aware parsing and a "no grid, light palette" test through a test-change-request.
- [ ] The legacy single-page wrappers `buildPdf`, `availableFormats`, `exportDrawing` exist only for approved tests (`exportDrawing` doorway forwarding is untested). Drop them by updating those tests once a test-change-request is approved.
- [ ] The plan switcher (`#plan-switch`, `setPlan`) and its reset of selection/gestures have no automated test (no DOM harness); MAN-04 (reset on switching between two plans) becomes checkable only with the second plan in `demolition-plan`.

### Docs

- [ ] `pdf-export` «Заполнение основной надписи»: graph 5 (page name) and graphs 7/8 (Лист/Листов) stay empty. Filling graph 5 with the plan name and numbering the sheets was left out of `drawing-plans`; it needs a spec change and a change to the approved test "графа 5 пуста" (FL-3 in `sheet-pdf.test.ts`).

### Out of scope (decided, revisit if needed)

- `Drawing.walls/dimensions/doorways` stay as the content of plan `measure`; a nested `plans` structure with a version-4 document was rejected for this change (approved tests and format churn). Revisit if plans multiply (design D1).

## demolition-plan (explore + planning + implementation, 2026-10-09)

### Bugs

- [ ] The grey underlay of the demolition plan is `palette.muted` as the spec says, but `#555` (light) / `#a1a1aa` (dark) are close to the wall ink `#333` / `#d4d4d8`, so the underlay barely differs from the measurement plan on screen (checked in the browser, both themes). Needs a lighter underlay colour: a spec change (`demolition-plan` «Отображение плана «Демонтаж»») and a palette/alpha decision; the approved render and PDF tests assert `muted`.

### Tests

- [ ] Optional hardening listed in `openspec/changes/archive/*-demolition-plan/test-validation.md` (not blocking): `addMark` with a range like −50…0.5 returns the same array; `alongNodes` negative case for a wall ending off the strip face; loading a mark with `id: ""` is rejected; `markAt` picks the last of overlapping regions at a corner; the touching tolerance 0,01 on one side of the merge. Needs a test-change step (approved tests are immutable after validation).
- [ ] Not exercised in the browser: re-anchoring of marks when a wall is extended by merging on the measurement plan (MAN-15); covered by `mark-follow.test.ts` with the real `mergeContinuation`, but `commitPoint` wiring in `main.ts` was only reviewed. The plan switch, tool visibility, click/drag marking, snapping, selection, in-place number editing, Delete, undo/redo, ruler, persistence and both themes were checked by hand on 2026-10-09.
- [ ] `canvas.setPointerCapture` in the demolition tool's `pointerdown` throws `NotFoundError` for synthetic pointer ids (browser checks need `canvas.setPointerCapture = () => {}`); real pointers are fine.

### Out of scope (decided, revisit if needed)

- Dimensions, room areas and element labels on the demolition plan; eraser and selection of underlay walls; partial demolition of a wall element (user decision, 2026-10-09).
- Page name in the title block (graph 5) is still empty, now on both pages (see `drawing-plans` above).

## demolition-show-elements (2026-10-09)

### Docs

- [ ] Elements on the demolition plan are drawn in the underlay grey over the red region (user decision: «пока отображай все элементы»); readability over the red hatching and a possible final rule for elements in demolished zones are open (same colour question as the underlay contrast above).

### Tests

- [ ] `main.ts` wiring (all elements passed to the demolition canvas) has no automated test; checked by hand in the browser on 2026-10-09 (window, door and doorway under a whole-wall mark). Label `textAlign`/`textBaseline` of the elements layer are set by `drawDoorways`, so they are not separately observable (validation M14/M20).
