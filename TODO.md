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

## pdf-plan-page-names (2026-10-10)

### Tests

- [ ] Нет теста вписывания длинного названия плана в графу 5 (itText общий с графой 1 и покрыт там; названия каталога короче графы, ветка недостижима). Нужен тест с искусственным длинным pageName.

## demolition-drag-only (2026-10-10)

### Out of scope

- [ ] Подсказка пользователю: зону демонтажа нужно растянуть на стене (клик по стене больше ничего не помечает, `demolition-drag-only`). Вариант: текст-подсказка у курсора при активном инструменте («Растяните зону на стене») или у кнопки «Демонтаж»; по существующим образцам интерфейса (`.claude/rules/ui.md`) — согласовать с пользователем, пока ничего не придумано.

## demolition-window-sections (2026-10-10)

### Bugs

- [ ] `editNumber` (`src/demolition/mark-numbers.ts`) считает действующие пометки без элементов: правка ширины или расстояния может продлить пометку на участок окна, и она молча пропадёт с плана. Нужно решение: зажимать правку в чистый участок.

### Out of scope

- [ ] Участки стены определяются только Т-примыканиями (разрывами граней); углы и границы помещений без перегородки стену не делят.
- [ ] Между окнами по обе стороны перегородки остаётся тонкий чистый участок (толщина перегородки) — по правилу «разрыв относится к соседнему чистому участку».

## demolition-no-window-walls (2026-10-10)

### Tests

- [ ] Подключение `doorways` в `main.ts` (`drawDemolitionPlan`) проверяется только вручную.
- [ ] `editNumber` и `addMark` не знают об элементах (скрытую пометку под окном UI выбрать не даёт, но функции уровня домена приняли бы её); спецификация сценария не требует.

### Out of scope

- [ ] Запрет ставить окно на помеченную стену на обмерочном плане; различие наружных и внутренних дверей.

## demolition-doorway-sizes (2026-10-10)

### Tests

- [ ] Подключение в `main.ts` проверяется только вручную: кнопка и курсор «Ластика» на плане «Демонтаж», подсветка под курсором (`hover` → `erasing`), снятие выделения и протяжки при активации ластика, возврат на «Стену» при смене плана, разбор «1,2» в единицах ввода.
- [ ] Габариты страницы PDF с размерами пометок считаются по `page.walls` (стыки с соседними стенами); тест — на свободных стенах и диагоналях, комната в `demolition-dimensions-pdf.test.ts` не покрыта (мутация «extent по одной стене» выживает).

## demolition-dimension-chains (2026-10-10)

### Tests

- [ ] Non-blocking gaps from validation: число шире участка у конца стены (E02), порог нулевого размера 1e-6 против 0,5 см (F17), `markDimensionExtent` считает число в «см» и не учитывает единицу «мм» (число шире), порядок отрисовки размеров относительно закраски области и бумажная обводка числа (`strokeText`) записывающим холстом не фиксируются.

### Out of scope

- [ ] Правка размеров пометки перетаскиванием выносных линий (правка — только числами).
- [ ] Число размера выводится `drawDimensionGeom` дважды (обводка и заливка) — в тестах PDF сравнивается множество чисел (TCR-2/TCR-3).

## demolition-select-after-mark (2026-10-09)

### Tests

- [ ] Non-blocking gaps from validation: no test selects the placed mark on a diagonal wall (`EPS_CM` tolerance in `place`); no test checks the redraw after `applyNumber`/`deleteSelected` or the redraw that clears the preview after an empty operation; `main.ts` `leaveDemolitionTool` condition (`up(...) !== null`) is only checked by hand (2026-10-09).

## demolition-show-elements (2026-10-09)

### Docs

- [ ] Elements on the demolition plan are drawn in the underlay grey over the red region (user decision: «пока отображай все элементы»); readability over the red hatching and a possible final rule for elements in demolished zones are open (same colour question as the underlay contrast above).

### Tests

- [ ] `main.ts` wiring (all elements passed to the demolition canvas) has no automated test; checked by hand in the browser on 2026-10-09 (window, door and doorway under a whole-wall mark). Label `textAlign`/`textBaseline` of the elements layer are set by `drawDoorways`, so they are not separately observable (validation M14/M20).

---

Follow-ups from change `mounting-plan` (exploration and tests, 2026-10-10).

## Tests

- [ ] `main.ts` wiring of the «Монтаж» plan has no automated test: remnants and old elements must not be selectable, erasable, or affected by Delete and marquee; own objects are edited by the same tools as the measure plan; the plan switcher shows three segments; `commitMounting`/`restoreScene`/`historyOf` glue. Only the model (`mountingScene`, `remnantWalls`, `openWorkspace`, `storedContent`) is unit-tested. Checked by hand in the browser on 2026-10-10 (remnant click/marquee/eraser, old opening eraser/click/Delete, own wall draw/erase/undo/redo, own doorway on a remnant, reload, demolition mark removed → «Монтаж» updates).
- [ ] `src/mounting/mounting-workspace.test.ts` was added during apply and was not part of the validated test suite (`test-validation.md`); have it reviewed by a validator.
- [ ] Not checked by hand: arrow-key nudge of an own wall T-attached to a remnant, and dragging an own wall's end onto a remnant. The neighbour-follow rules in `wall-edit` may move the remnant while the gesture runs; `restoreRemnants` (`src/main.ts`) puts remnants back on every redraw, so the remnant is never changed, but the own wall may be bounded by it.
- [ ] `EPS_CM` tolerance at the boundary of an own element in `mountingScene` has no test: an element sticking out of its remnant by 0.005 cm should still be visible (validation survivors `own-left-eps0`, `own-right-eps0`, `test-validation.md` of `mounting-plan`).
- [ ] `remnantWalls` with a sliver between two unmerged marks of one wall (gap up to `EPS_CM`) and with overlapping unmerged marks is untested; unreachable while marks are merged on add and on load (survivors `rem-gap-zero`, `rem-cursor-to`).


Follow-ups from `pdf-legend` (2026-10-11). Non-blocking.

## Tests

- [ ] LG-13 (no legend on the canvas) has no automated test; checked by diff review and `grep` (legend modules are imported only from `src/export/pdf.ts`, no control in `main.ts` / `index.html`).
- [ ] Surviving low-severity mutants (`openspec/changes/pdf-legend/test-validation.md`): legend label font 4.6 mm still fits the column, column content shifted 1 mm, label gap +1.5 mm, right padding +1 mm (tests use `legendWidthMm` itself).
- [ ] Surviving low-severity mutants of revision 2 (`openspec/changes/pdf-legend/test-validation.md`): wrap limit 28 -> 30 mm (a long label like "Дерево (вдоль)" stays on one line), row pitch 14 -> 10 mm, right padding 5 -> 0 mm, first row 4 mm lower; the spec fixes none of these numbers.

## Out of scope (decided, revisit if needed)

- [ ] Legend sizes and style (sample length, row pitch, label font, italic label as in `img.png`) were left "decide later"; the label is currently drawn in the regular PT Sans.


---

Follow-ups from `auto-fit-scale` (apply, 2026-10-11).

Follow-ups from `fix-diagonal-corner-block-snap-and-dimensions` (2026-10-12).

## Bugs

- [ ] **No length dimensions on the outer faces at a diagonal corner block until a third wall is placed.** Scene
  A `(-100,0)→(0,0)`, B `(10,10)→(10,110)`, t=20: the block fills `x∈[0,20], y∈[-10,10]`, but A's bottom face
  and B's right face get no auto length dimension. Cause: `anchorAt` (`src/auto-dimensions.ts`) →
  `nearestEdgeIntersection` cannot find the block contour vertices. By the spec reading B's left face should be 120 cm
  and A's bottom face 120 cm (currently 100). Out of scope of the change (length dimensions were not touched).
---

Follow-ups from `new-wall-materials` (2026-10-12).

## Bugs

- [ ] The `Дерево` hatch (`src/wood-tile.ts`) does not look like the customer's sample (`img_4.png`, bottom pattern): wavy lines are fine, the lens shapes are too small and the overall texture is much sparser/regular. Accepted as is for now (user, 2026-10-12); redo the tile (trace the sample into polyline data, keep it seamless and anchored to the drawing) or switch to another procedural pattern (design D4).

## Tests

- [ ] Wood tile: no test for the pan ≈ 1e6 px boundary (precision of the tile phase remainder), nor for the tile continuity across a joint in the PDF page (only on the canvas, `src/wall-materials-render.test.ts` WM-J6).
- [ ] Ghost (preview) wall of concrete: the fill is drawn under `globalAlpha` 0.4 together with the hatching; no test pins this (the spec has no scenario for it).
- [ ] `src/main.ts` swatch click / arrow keys / selected-wall material change have no automated test (no DOM environment); checked by hand (`new-wall-materials` tasks section 7). Add tests when a DOM environment appears.

---

Follow-ups from exploring `add-communications` (2026-10-12).

## Out of scope (decided, revisit if needed)

- Размер стояка и воздуховода и расстояния до стен не печатаются в PDF (как расстояния проёма): на бумаге видны только окружность и прямоугольник с диагональю. Вариант: подпись «Ø110» / «300×200» рядом с объектом по образцу подписи «H=…» проёма.
- Воздуховод без поворота; привязка размеров и линейки к граням коммуникаций; вычитание площади из помещений; правка коммуникаций на планах «Демонтаж» и «Монтаж»; мультивыделение и сдвиг стрелками коммуникаций.
- Расстояние до стены считается по телу стены целиком: проём, окно или дверь в стене расстояния не меняют.

## Tests (add-communications, apply group 6, 2026-10-12)

- [ ] `src/main.ts` wiring of communications has no automated test (no DOM environment): `pointerdown` order (numbers → marker → communication body → dimension/doorway/wall), the number editor and its hit area (`communications-tool.ts` `numberAt`), group buttons, eraser target (`eraserTarget`: dimension → communication → doorway → wall), Delete, Esc, arrow keys, `endBlocked` / `limitNewWall` in `snapWallCursor` and `commitPoint`, the plan filter (`communicationsEditable`). Checked by hand in Firefox on 2026-10-12 (place riser and duct, edit distances and diameter, drag stops at a wall, eraser and Delete with undo/redo, «Демонтаж» and «Монтаж» read-only, own wall on «Монтаж» stops at the riser, marquee ignores communications, arrows do not move them, dark theme, reload keeps them, PDF export runs without errors, `pagesOf` puts them on all three pages).
- [ ] Not checked by hand: wall thickness change next to a riser through the thickness field, arrow-key nudge of a wall into a communication, dragging a wall end onto a communication, tab close/undo of tab close, the PDF page images themselves (only `pagesOf` and `drawScene` options are tested).

## Bugs (add-communications, apply group 6, 2026-10-12)

- [x] Size labels sit on the contour — riser diameter fixed (GOST leader, `src/communications/diameter-leader.ts`, 2026-10-12). Duct width/depth labels (`sizeNumbers`) still sit on the contour; not rechecked.

## Tests (add-communications, manual mutation run 7.4, 2026-10-12)

- [ ] The recognition tolerance 0.01 cm in `src/communications/placement.ts` is not pinned (mutants: tolerance 0 / 0.1 in `ghostPosition` and in `moveLimited` `recognized` survive). Add through a test-change-request: ghost next to a wall with overlap 0.009 cm stays, with 0.011 cm shifts to touch; a drag ending with overlap 0.009 cm passes, with 0.011 cm stops. Only `guard.ts` has these boundary tests (WV-02, WC-02c).
- [ ] `communicationsEditable` (plan filter) and the `restoreScene` branch «history entry without `communications` leaves the list alone» in `src/main.ts` are protected by no automated test (mutants survive; no DOM environment). The pure part is covered (CH-04). Extract them into pure functions or cover with a DOM harness once it exists. The same for the `communications: communicationsOf()` wiring in `main.ts` (edit modes, snap, chain).

## Out of scope (add-communications review, 2026-10-12)

Edge cases of loaded documents where a communication already overlaps a wall (never produced by the app itself):

- [ ] "Не глубже, чем было" is evaluated per communication, not per (communication, wall) pair (`src/communications/guard.ts`, `communicationGuard` / `worse`): `before` is the largest depth over all walls, so a wall that did not overlap before may then intrude up to the depth another wall already had. Per-pair baseline would be stricter; spec `wall-collision` «Стены не налагаются на коммуникации» says only that the pair's depth must not grow.
- [ ] `slideReach` (`src/communications/shape.ts`) gives no distance in the direction away from a wall that already overlaps the body, while `design.md` D3 says overlapped walls count with distance 0. Align code or design text.
- [ ] Duplicate communication ids in a loaded document are not rejected (`src/communications/storage` check in `src/storage.ts` `isCommunication`); the spec asks for unique ids.
- [ ] `afterPlace` in `src/tool-mode.ts` has a `riser`/`duct` branch used only by approved tests (UI-09b); production uses `afterPlaceCommunication` (`communications-group.ts`). Drop one through a test-change-request.

---

Follow-ups from exploring and planning `fix-collinear-edge-to-edge-length` (2026-10-13).

## Bugs

- [ ] No automatic length dimensions for collinear walls of equal thickness (faces flush): `placeWall` of a wall N continuing a wall E at the same thickness creates only the thickness dimension at the free end; with N thinner than E both length dimensions appear. Repro: E `(0,0)–(500,0)`, N `(510,0)–(900,0)`, both 20 cm, different materials, `placeWall` → one dimension (`src/auto-dimensions.ts`, `lengthDimensions`: anchors on the shared flush face are probably not found). Unclear whether the spec `dimension-tool` «Автоматические размеры стены» intends this; decide.

## Tests

- [x] (fix-collinear-edge-to-edge-length; checked by hand in the browser 2026-10-13: preview 1000 for 900 + overhang, typed 4000 merges +400 cm, typed 1512 gives body 1512 and ruler 1512 from the edge, selected field 1512, typed 1600 moves `b` by 150 — still no automated test) `src/main.ts` wiring has no automated test: `previewLengthCm` / `liveLengthCm` using the overhang, `resizeSelected` using `axisLengthForEdgeCm`. Only the pure functions are unit-tested; check by hand in the browser (draw a collinear continuation, type a length, select the wall, type a length in the field, hover with the ruler).

## Out of scope (decided, revisit if needed)

- (fix-collinear-edge-to-edge-length) Typing a length for a selected wall when the movable end of `resizeWallBounded` is the end with the overhang (wall built from a free end with `b` at the joint and `a` free): movable-end choice only considers T-attachments, so the end at the joint moves; the spec does not define this case.
- (fix-collinear-edge-to-edge-length, verify 2026-10-13) Two or more foreign ends within the joint tolerance that are not one vertex: `collinearGapCm` (`src/wall-geometry.ts`) returns 0, while `pairEnd` may still extend the body to the earliest neighbour's end, so the visible body can be longer than `edgeLengthCm`. No spec scenario describes this crowded case.
- (fix-collinear-edge-to-edge-length) Bridge (both ends in collinear gaps) with an exact typed length: only the start overhang is accounted for on input; the end `b` is not snapped when a length is typed.
---

Follow-ups from `add-opening-dimension-anchors` (2026-10-13).

## Tests

- [ ] (add-opening-dimension-anchors; checked by hand in the browser 2026-10-13: dimension between two windows, vertex-vs-jamb snap, level snap to a neighbour, eraser on a window removes its dimension, undo/redo, reload, Montage plan — still no automated test) `src/main.ts` wiring has no automated test: `placeDimension` / snap mark use `nearestDimAnchor`, every reader of dimension points passes `doorways` (`endPoint`, `dimDraftGeometry`, `dimLevelSnap`, `marqueePicks`). Only the pure functions are unit-tested. A forgotten `doorways` argument in a new reader would silently hide jamb dimensions. The four-wall room drawn wall by wall was not re-checked in the browser (covered by `DA-41` on pure functions).

## Out of scope (decided, revisit if needed)

- (add-opening-dimension-anchors) An explicit `kind: "edges"` on a stored dimension point is not part of the format: the spec says only that a point without `kind` is read as a face pair, and `isDimension` rejects any other `kind` except `"jamb"`. `EdgePoint.kind` is typed as absent.
- (add-opening-dimension-anchors) Element numbers shown for a selected window (its own dimensions) are separate from the user's jamb dimensions; no snapping between them.

---

Follow-ups from `fix-opening-distance-collinear` (2026-10-13).

## Bugs

- [ ] **Repeated edits of opening numbers "give no result" (reported, not reproduced).** User report: after the first edit of a dimension or offset of a window / doorway / duct, further edits do nothing. Checked: synthetic pointer events and real keyboard input (type + Enter) in Firefox, on a corner wall with a window placed by the tool, then three edits in a row (left, left, right), same-material and different-material collinear walls, all applied; `collinear-distance-edit.test.ts` CD-19 covers repeated edits at the `createSelectionEditing` level. Not checked: real mouse clicks (the Firefox MCP has no coordinate click), the user's own drawing. Suspected causes: focus/`blur` race in `openNumberEditor` (`src/doorway/doorway-tool.ts`) with a real mouse; or an edit pressed against the host wall limit giving `no-change` (the old artificial face cut made this likelier). Ask the user which number they edit and what happens after Enter; ideally get `copy(localStorage.getItem("draw-repair:drawing"))`. Ducts (communications) were not checked: `communication-tool.ts` has its own `pressNumber`.

## Out of scope (decided, revisit if needed)

- (fix-opening-distance-collinear) The gap-joint boundary between a brick and a concrete wall (axis ends 5 cm apart) is not defined by the spec; the implementation takes the end of the wall that comes earlier in the array, and `CD-6c` accepts 150..155 cm.
- (fix-opening-distance-collinear) A joint with two or more collinear candidate continuations at one end (ambiguous) stops the chain at that end; no spec scenario describes it.
- (fix-opening-distance-collinear) `faceRuns` for automatic wall dimensions and demolition marks still cuts faces at `reach` beyond the wall ends; only openings go through collinear continuations (`openingFaceRuns`).

---

Follow-ups from `fix-opening-reach-body-end` (2026-10-13, test validation round 3).

## Tests

- [ ] `T-26o`: mirror of `T-26m` at end `a` of the wall (concrete wall ends at x = 195, 5 cm overhang; offset −5 shown, −6 hidden in the Montage plan). Without it, a fixed 10 cm cap or a +1 cm limit at end `a` survives (`src/mounting/mounting-overhang.test.ts`).
- [ ] Montage: no test pins `bodySpan` (`src/doorway/doorway-faces.ts`) clamping to the axis end at an end with a same-material continuation (mutant `Math.min(hi, len)` → `hi` survives, found by the manual mutant run at apply time, task 5.4). Repro for the test: brick `W (0,0)-(500,0)` + brick `W2 (500,0)-(700,0)`, window `b` with offset −5 on `W` must be hidden on the Montage plan; same mirrored at end `a`.
- [ ] Montage overhang on a skewed joint where the two face runs end at different `t`: pins that the body extent is the intersection of the faces, not one face or their union.
- [ ] Storage has no lower bound for a negative `offsetCm` (design D3, `T-34` pins −500); an element far outside the wall is read as a violated document. Revisit if such documents should be dropped instead.


---

Follow-ups from `fix-duct-resize-against-wall` (2026-10-13).

## Tests

- [ ] History-level test for undoing a duct resize that shifts the centre (apply width, undo, compare size and centre). Checked by hand in the browser; `applyNumber` returns one object, the history path is unchanged (test-validation F3).

## Docs

- [ ] `openspec/changes/fix-duct-resize-against-wall/test-plan.md`: DG numbering differs from the real tests (plan: DG-08 undo, DG-09 integration; file: DG-08* both sides blocked, DG-09 pre-existing overlap, integration inside DG-05). `test-suite.md` matches the file (test-validation F2).

## Out of scope

- Mutation testing, lint and format are not configured in the project (only `tsc` and `vitest`).
## fix-dimension-press-priority (2026-10-13)

### Tests

- [ ] `src/main.ts` dispatch of the press target (`case "communication"` -> `communicationTool.pressBody`, the `communicationBodyTolCm` argument, no communications on Demolition/Mounting plans) has no automated test; only `pressPick` is unit-tested (`src/doorway/press-pick-communications.test.ts`).

### Out of scope

- A dimension line hit uses the snap radius, a communication body only `BODY_HIT_PX`; on a small riser the dimension line can cover almost all of the body, so the riser can only be grabbed by a part away from the line (`src/doorway/doorway-scene.ts`, `src/communications/communications-tool.ts`). Revisit if it bites in practice.


## add-battery (2026-10-13)

### Tests

- [ ] DOM wiring of the battery tool (`src/main.ts`, `src/battery/battery-tool.ts`: click-to-place, press-to-select, marker priority, one history step per drag, demolition click/eraser) has no automated test; it was checked by hand in the browser on 2026-10-14 (place with window centring, arrows, drag, number edit, Delete/undo, demolition mark/undo/redo/erase, mounting own battery, corner dimension). Plan items B-TOOL-1/5/6, B-HIS-1/2, B-DEM-7/8 remain without an executable test.
- [ ] Approved tests that conflict with the new spec and wait for the test-change-request (`openspec/changes/add-battery/test-change-request.md`): `src/plan-tools.test.ts` (PT-02, SZ-71), `src/mounting-plans.test.ts` (MP-51), `src/communications/plans.test.ts` (DP-01, DP-02), `src/mounting/mounting-scene.test.ts` (MP-15), and the defective `src/battery/battery-storage.test.ts` B-HIS-9 (mutates its own expected value, passes only with a shallow copy).

### Bugs

- [ ] Wall-start snap candidates (`candidateBlock` in `src/wall-snap.ts`) ignore batteries: a snap point inside a battery can be offered, the click is then rejected by `squareAllowedForBatteries`. Cosmetic.
- [ ] `dimLevelSnap` (`src/geometry.ts`) skips dimensions with battery-corner points, so dragging a dimension does not snap to their level.
- [ ] The demolition eraser has no hover highlight for a battery mark (wall marks have one).

### Out of scope

- The door leaf and swing arc do not constrain a battery (decided; `battery` spec "Размещение батареи вдоль стены").
- Marks of deleted batteries stay in `batteryDemolition` until reload (hidden while the battery is absent, so undo of a delete restores the mark); loading drops them.

---

Follow-ups from `add-callout` (2026-10-14; implemented, tasks 1–11).

### Bugs

- [ ] (cosmetic) On screen the callout leader starts at the right/left edge of the text backing at the first line's bottom edge, so it touches the last letter of the first line; the GOST sample leaves a small gap. Spec says only "у края первой строки" (`callout` «Отображение выноски»); decide whether to add a gap in `calloutLayout` (`lineStart`) and cover it in `callout-layout.test.ts`.

### Tests

- [ ] `openTextEditor` (`src/callout/text-editor.ts`, task 9.1) and the callout wiring in `src/main.ts` (tasks 9.2–9.4) have no automated test: the project has no DOM test environment. Checked by hand in the browser (tasks 10.x). Uncovered: Enter/Esc/blur handling, focus, stopping key events from reaching the canvas, preview rubber band, double click cancel, coincident points rejected, drag threshold "click vs move", plan/tab switch while editing, eraser priority over walls and demolition marks, autosave, PDF export button enabled for a plan with only callouts.
- [ ] Validator gaps left open on purpose (`test-validation.md`, round 4, not blocking): arrow direction when the target is below the text; arrowhead axis of a right-aligned diagonal callout; vertical extent of the arrow tip in `pageBounds`; `\r\n` inside an edit.

### Out of scope

- Marquee selection, multi-selection and group move of callouts together with walls (`add-callout` design, non-goals).
- Italic font (GOST type A) for callout text: decided to match the dimension font, no italic.

---

Follow-ups from `fix-battery-centering-and-numbers` (2026-10-14).

### Tests

- [ ] `centerGuideTracks` in `src/main.ts` (the centring guide is passed to the renderer as `tracks` only while the battery tool is active or a battery is dragged) has no automated test: the project has no DOM test environment. Checked by hand in the browser on 2026-10-14 (ghost snap at zoom 1 and 0.18, no guide outside the 35 px radius, guide while dragging an already centred battery, numbers 12000 / 7000 / 12000 with the material boundary on the right).

### Out of scope

- Battery placement limits (`visibleRuns` → `faceRuns` in `limitedStart`, `freeStarts`, `stateHolds`) still stop at the end of the host wall plus a thickness margin when the wall is continued collinearly by a wall of the same material, while the numbers now measure to the corner or the material boundary (`openingFaceRuns`, as for openings). A battery stopped at the end of its host wall can show a non-zero distance to the far corner it cannot reach. Decide separately whether batteries should stand across a collinear same-material joint (`battery` «Размещение батареи вдоль стены»).
- Windows of a collinear neighbour wall are not centring targets: a battery never leaves its host wall, so such a window centre is out of reach (`design.md` D4).
---

Follow-ups from the demolition corner fix (2026-10-15).

## Bugs

- [ ] **Battery: tool stops working after delete** (user report, not reproduced). Checked: eraser on a battery (measurement
  plan), place → Delete → place again, mark battery on «Демонтаж» → Delete → eraser; the tools kept working. Need the exact
  plan, delete method (Delete key / eraser), whether the battery was marked for demolition, and which tool stops.
  Code: `deleteBattery`, `deleteSelection`, Delete handler in `src/main.ts`.

## Out of scope

- A thin seam line is drawn inside the demolition region between the wall body and the corner piece taken from the
  neighbour's shape (`cornerPieces` in `src/demolition/mark-region.ts`); the pieces are stroked separately.

## cap-flush-snap (2026-10-15)

### Tests
- [ ] Test validation (independent) of `cap-flush-snap` not run; the mutation survivors of the new tests are unknown (`src/wall-snap-cap-flush.test.ts`, `src/wall-geometry-offset-gap.test.ts`).
- [ ] The window of the flush position (nearest of three along the cap) and the DOM wiring were checked by hand only for one scene (A 40 cm, new 20 cm, flush on the lower face); the left/upper face, a cap at an angle in the browser and the preview while rotating the segment were not checked by hand.

### Out of scope
- The flat-cap rule applies only to the late wall of a collinear gap joint with the axis offset above 1 cm. A late wall whose end meets the cap of an earlier wall at a small angle (0.5-15 deg) with an axis offset still uses the bisector cut of "Почти коллинеарный стык".

## fix-corner-snap-parallel-start (2026-10-15)

### Tests
- [ ] The `src/main.ts` wiring of `segment.start` (preview wall, angle arc `at`, `commitPoint`, `previewLengthCm`, `limitNewWall*` start) has no automated test; checked by hand in the browser for the upper corner with ortho on only. Not checked by hand: the second (lower) corner, ortho off, a typed length from the shifted start.
- [ ] Test validation (independent) of `fix-corner-snap-parallel-start` not run; mutation survivors of `src/wall-chain-corner-parallel.test.ts` are unknown.

### Out of scope
- Parallel start applies only to the corner snap with a fixed direction (ortho). With ortho off the free direction never moves the start; a typed angle cannot give 0° (`typedDirection` rejects it), so the parallel wall is unreachable without ortho.

## add-room-explication (2026-10-15)

### Bugs
- [ ] A new wall drawn exactly over a room's anchor point (e.g. a partition through the label point of a named room) leaves the record without a room: both parts become new rooms and the name is lost (spec `room-explication` «Привязка данных к помещению» describes it as the room vanishing). Fix idea: after a step, if the anchor falls into a wall body, give the record to the larger part (needs a spec decision). Repro: name a rectangular room, draw a full partition through its centre. Code: `reconcileRooms` in `src/room-explication.ts`.
- [ ] With a tall explication table (about 8+ rooms on A4) the drawing area gets low and the legend column (up to 6 entries, 84 mm) may not fit by height; nothing suggests a larger format for the legend (`bottomBandMm` in `src/export/explication.ts`, `src/export/legend-draw.ts`).

### Tests
- [ ] The `src/main.ts` wiring has no automated test: `selectRoom`/`editRoom`/`commitRooms`, the editor fields positioning (`syncRoomEditor`), the history ordering (snapshot taken before the commit of rooms). Checked by hand in Firefox: block, selection, name and height edit with undo/redo, partition split and its undo, an island wall, PDF page 3 (table, blocks) in pdf.js. Not checked by hand: dark theme, Escape with a focused field, eraser and marquee over a block, other plans after switching.
- [ ] Test validation (independent) of `add-room-explication` not run; mutation survivors of `src/room-explication.test.ts`, `src/room-block.test.ts`, `src/export/explication*.test.ts` are unknown.
- [ ] The existing test `MP-91` (`src/export/mounting-pdf.test.ts`) was changed to the new spec (no area label on the «Монтаж» page, a block and a table row instead); review it.

### Docs
- [ ] `canvas-app` «Вспомогательная панель инструмента» is unchanged: room fields are in place on the canvas, no panel (decision with the user, see `design.md` D5).

### Out of scope
- Blocks and the table exist only on the «Монтаж» plan; the shared data is ready for later plans. Room number is automatic and not editable; the block cannot be moved or deleted.

---

Follow-ups from `add-plan-notes` (2026-10-15).

## Tests

- [ ] The `src/main.ts` wiring of the notes panel (`commitNotes`, `stepNotes`, `closeNotesPanel` in `setTool`/`setPlan`/`activate`, `pagehide`) has no automated test; checked by hand in Firefox (input, normalisation, save, undo/redo, plan switch, Esc, reload, canvas click with the tool active). Not checked: dark theme, switching drawing tabs with an open panel, history of the «Монтаж» undo keeping its notes.
- [ ] Test validation (independent) of `add-plan-notes` not run; mutation survivors unknown.

## Out of scope (decided, revisit if needed)

- Notes alone do not enable the PDF export button (a page with only notes is not "filled"); limits 15 items × 300 chars are unvalidated defaults.
---

Follow-ups from add-legend-objects (2026-10-15).

---

Follow-ups from `add-rough-works-plan` (2026-10-18).

## Bugs

- [ ] **The screed label hides the room block when the click was near the room centre.** The label is drawn over the
  block (`src/rough/rough-render.ts`), the user can place it elsewhere but cannot move it afterwards (anchor point is not draggable,
  design D2). Revisit if users complain: draw the block above the label or allow moving the label.

## Tests

- [ ] `src/main.ts` wiring of the rough plan has no automated test: pointer handlers (`onRough()` branches), panel sync
  (`syncRoughPanels`), in-place editor (`pressScreedLabel`), Delete / Escape, undo and redo
  (`stepRough`). The pure parts (tools, scene, history, storage, PDF) are unit-tested; the DOM flow was checked by hand in the browser.

## Docs

- [ ] pdf-export legend: on A4 the legend fits up to nine entries, a worst-case rough page has ten (five materials, battery,
  riser, duct, plaster, screed = 140 mm > 135 mm area). Spec says so; if it matters, shrink the row pitch or add a column.

## Out of scope (decided, revisit if needed)

- Mutation testing of net area and active-screed derivation: the project has no mutation tooling (`package.json`).
- Plaster dimensions are not printed on the PDF page (only on the canvas); the page shows the strips themselves.
---

Follow-ups from `plaster-click-whole-face` (2026-10-19).

## Tests

- [ ] `src/main.ts` wiring of the plaster hover/click (`pointermove` → `hover`, `pointerleave` → `hover(null)`, `pointerdown`/`pointerup` → `down`/`up`) has no automated test; checked by hand in the browser (highlight, click, opening, collinear chain, drag places nothing, Escape, undo).

Follow-ups from `screed-floor-layers` (2026-10-19).

## Tests

- [ ] `rough-pdf.test.ts` RW-123b checks the PDF threshold only as "more diagonal strokes than without the doorway"; assert the threshold hatch and the divider in sheet coordinates.
- [ ] `src/main.ts` passes the same `RoughSceneView` to the canvas, so the threshold wiring needs no code there; checked by hand in the browser (equal, different and one-sided screed, battery over hatch).

## Out of scope (decided, revisit if needed)

- Risers, ducts and door leaves do not paint the floor over like batteries do (the spec asks only for the battery body); the hatch stays visible inside their contours.
- A threshold probe point is taken at the middle of each half, 0.5 cm past the face: on skew or crowded joints the half is treated as "no screed" (safe, not specified).

---

Follow-ups from `collinear-axes-meet` (2026-10-19).

## Bugs

- [ ] **Plaster skips the axis gap in drawings saved before `collinear-axes-meet`.** In such a drawing the late wall of a
  collinear joint (different material or thickness) starts half a thickness past the early wall's axis end, and its body
  overhangs backwards; `pieceOn` (`src/rough/plaster-face.ts`) and `plasterPieces` (`src/rough/plaster.ts`) clip every
  piece to its own axis `[0, len]`, so the gap belongs to neither wall and the plaster strip breaks there (~16 px at 1:40
  for 20 cm walls). Repro: a store with `E (0,0)-(500,0)` and `N (510,0)-(580,0)` of different materials, plaster click on
  the `+1` face. New walls drawn after the change are not affected. Workaround: redraw the joint.

## Tests

- [ ] `src/main.ts` wiring of the axis shift has no automated test: `previewLengthCm` now returns the segment length and
  `commitPoint` takes `segment.start`/`segment.end`; only `chainSegment` is unit-tested (`wall-chain-axes-meet.test.ts`),
  the DOM flow was checked by hand in the browser.

## Out of scope (decided, revisit if needed)

- No migration of saved drawings: the axis gap of old collinear joints stays in the data (`wall-joints` «Оси и длины не
  меняются» is unchanged).
- Remove the legacy gap layer once old drawings are not supported: `collinearGapCm`, `collinearGapCap`,
  `isCollinearGapJoint` (`src/wall-geometry.ts`), `edgeLengthCm`, `axisLengthForEdgeCm`, `endOverhangCm`
  (`src/wall-length.ts`, used by `src/main.ts`, `src/ruler.ts`), the doorway distance below zero (`doorway`
  «Расстояния проёма сквозь коллинеарные стены») and the matching spec requirements.

---

Follow-ups from `remove-wall-tracking` (2026-10-19).

---

Follow-ups from `wall-body-corners-snap` (2026-10-19).

## Out of scope (decided, revisit if needed)

- [ ] `wall-drawing` tie rule «у одной стены — на ребре, идущем от её начала оси» is not implemented: for equal
  distances only the wall order in the array decides (`junctionCandidates`, `src/wall-snap.ts`); no scenario covers it.

## Tests

- [ ] No test for the «Проём» scenario at a junction corner (vertex violating a doorway must not be offered):
  `acceptor` applies `candidateBlock`, but only the free-end case is covered (`CW-7f`).

- [ ] `wall-drawing` «Привязка к существующим стенам» (main spec, ~line 157) speaks of the diagonal snap window only
  "за углом свободного торца"; after `wall-body-corners-snap` the outer junction corner is a target too
  («Диагональное прилипание к углу тела стены»). Check whether the window applies there and reword.


## plaster-face-to-corners (apply, 2026-10-20)

### Bugs

- [ ] Doorway-at-joint gap (img.png) and the short-wall "no highlight" (img_2.png) did not reproduce on synthetic scenes
  (`plaster-pipeline.test.ts` PL-1, PL-3 pass on the old code too). Needs the user's saved drawing; tasks 1.3/1.5 stay open.
- [ ] `src/rough/plaster.ts` `overhang` extends a mark that touches a wall end to the open face end unless a coplanar
  wall covers the zone; an offset (non-flush) neighbour or a near-parallel wall is not covered by a test.

### Out of scope (decided, revisit if needed)

- [ ] `chainFaceRuns` (`src/doorway/doorway-faces.ts`) is no longer called in production after the plaster rewrite;
  only `chain-face-runs.test.ts` uses it. Remove together with its test if nothing else adopts it.

# plaster tool follow-ups (direct spec edits, 2026-10-20)

## Tests
- `main.ts` pointerup path: the plaster tool stays active and nothing is selected after a click (only `plaster-tool` is unit-tested).
- Browser checks not done for: end-strip wings, side/end dimensions at inner and outer corners, tool staying active after a click (user checked wings and dimensions visually).

## Out of scope (decided, revisit if needed)
- Plaster-tool behaviour changes of 2026-10-20 (corner wrap, dimensions from the outer edge, no auto-select) were made as direct edits of `openspec/specs/rough-works-plan/spec.md` without separate OpenSpec changes; ghost of the end strip shows no corner wings before the side strips exist.

# render-pan-perf (2026-10-20)

## Tests
- `main.ts` wiring of the pan / wheel / `pagehide` view save and of `redraw()` -> `frame.request()` has no automated test (no DOM harness): only `deferred-save.ts`, `frame-scheduler.ts` and the geometry cache are unit-tested. Checked by hand in Firefox on 2026-10-20: pan = 0 writes during the gesture and 1 on pointer-up (only `draw-repair:drawing`, no history), wheel = 1 write after a 300 ms pause, immediate reload after a wheel keeps the zoom, edit still writes drawing and history, undo + reload.
- Scenario "Изменение вида не пишет историю" (`drawing-storage`) is covered only by that manual check: `viewSave` writes `saveStore` only, which is wiring in `main.ts`.

## Bugs
- Hover is still ~8 ms per `pointermove` on 64 walls (wall tool: snap and hover highlight in the handler, not geometry): with several events per frame the frame stretches (measured 58 ms with 5 events per frame, synthetic). Suspected cause: `updateWallCursor` / `eraserTarget` run per event; coalesce pointermove processing per frame. File: `src/main.ts` `pointermove` handler.

## Out of scope (decided, revisit if needed)
- History is unbounded and fully serialised on every edit (`src/history.ts` `serializeHistory`, called from `redraw()` when `dirty`): the cost grows with the session length; measured only with an empty history. Consider a depth limit and incremental writes.
- Static layer (walls, hatching) on an offscreen canvas redrawn only when the scene or the view changes.
- `cutPieces` / `cutContour` (`src/doorway/doorway-layout.ts`) are not cached: they depend on doorways and run per wall per frame; measure before caching.
- No lint or formatter is configured in the project (see the earlier note), so the quality gates of this change were `tsc`, `vitest run` and `openspec validate`.

# reconstruction-plan (2026-10-20)

## Bugs
- A drywall wall whose axis lies exactly on a substrate wall's axis, ends inside that wall, cannot be moved along it (`moveWallsBounded` returns 0): the engine reads such ends as T-attachments (`teeEndAttached`, `src/geometry.ts`) and pins them. The spec «Границы правки стен гипсокартона» says an overlap drawn earlier must not block editing. Not reachable by snapping (drywall sits on the plaster/wall face), so only a hand-placed or loaded document hits it. `RC-47` in `src/reconstruction/reconstruction-snap.test.ts` covers the overlap offset from the axis (y = 3); the on-axis case (y = 0) is untested.

## Tests
- The «Реконструкция» wiring in `src/main.ts` (tool, panel, selection, eraser, Delete, dimensions, plan switch) has no automated test: `main.ts` is not unit-testable. Checked by hand in Firefox: drawing, save, reload, panel on selection, thickness edit, undo and redo. Not checked by hand: eraser, Delete, dimensions between substrate and drywall, dark theme (the PDF of the fifth page is covered by `src/export/reconstruction-pdf.test.ts`).

## Out of scope (decided, revisit if needed)
- Openings (doorway, door, window) in drywall walls: not in the first version of the «Реконструкция» plan (user decision, 2026-10-20).

## Leftovers from `demolition-no-neighbor-overlap` (2026-10-20)

### Bugs
- [ ] (demolition-corner-owner, 2026-10-21) The corner square now goes to the later-drawn wall when both walls of an L are
  marked, but the dimension chain of that wall (`clippedFaceBounds`, `markChains`) still measures to the neighbour's near
  face, so the number and the region differ by the square. Not checked in the browser (task 4.4).
- [ ] **Overhang stubs on the mounting plan are not checked in the browser.** `remnantWalls` adds `<id>^a` / `<id>^b`
  stub walls (`src/mounting/remnants.ts`); outlines and hatching where a stub meets a remnant (seams inside the stub)
  are only checked by point-coverage tests.

### Tests
- [ ] PDF export of the demolition and mounting pages on the scene from `src/mounting/remnants-overhang.test.ts`
  (task 3.2 of the change).

### Docs
- [ ] Face number on the side where a wall abuts T is shorter than the wall (1043 vs 1113 in the user drawing): typing it
  gives the span up to the junction, not the whole wall. Spec says width = extent of the zone on the face; confirm that is wanted.


---

Follow-ups from `plaster-flush-end-in-plane` (2026-10-20).

## Out of scope

- [ ] A flush end of a perpendicular wall is added to the plaster target only inside a gap between two walls of the plane (`layPieces`, `src/rough/plaster-face.ts`). A flush end at the edge of the run (no plane wall on its far side) is not added; the face run normally stops at that corner anyway. Revisit if a drawing shows an unplastered flush end at a plane edge.

---

Follow-ups from `plaster-partial-drag` (apply, 2026-10-20).

## Tests

- [ ] `src/main.ts` wiring of the plaster drag has no automated test: `leavePlasterTool` / `resumePlasterTool` (tool leaves after a drag, comes back on Escape, click away and Delete), Escape and Delete during a drag, `setPointerCapture` on press. The pure rules (`resumesAfterSelectionCleared`) and the tool itself (`src/rough/plaster-drag.test.ts`) are tested; the DOM flow was checked by hand in the browser (same gap as the demolition wiring above).
- [ ] `setup` / `px` helpers are duplicated: `src/rough/plaster-tool.test.ts` keeps its own copy, new tests use `src/rough/plaster-tool.test-utils.ts`. Merge them when the old test file may be touched (approved tests were not edited in this change).

## Out of scope (decided, revisit if needed)

- A drag works on the pressed wall only; a plane of several collinear walls needs one drag per wall (adjacent spans merge). A drag across the whole plane would need group selection.
- No dragging of a selected plaster mark along the wall (openings have it, demolition and plaster marks do not); numbers are the only way to move it.
- The project has no formatter, linter or mutation-testing tool, so those quality gates are not run; mutants were tried by hand (`plaster-tool.ts`: dead zone, pressed wall, selection, merge order).

---

Follow-ups from `plaster-t-gap-opposite-face` and `plaster-dimension-collinear-joint` (apply, 2026-10-20).

## Tests

- [ ] `src/rough/plaster-bridge.ts`: no test for a neighbour drawn in the opposite direction (`entry.same === false`, `reachesGap`), found by hand mutation; add a W2 with `a`/`b` swapped to `src/rough/plaster-t-gap.test.ts`.
- [ ] The browser check of both changes on the user's drawing ("Чертёж 2", corridor and kitchen) was not run; accepted on the tests that use its coordinates (`TG-4`, `DJ-5`).

## Out of scope (decided, revisit if needed)

- A gap wider than the search window of `faceRuns` (largest wall thickness + 1 cm) is not bridged; the window is shared with demolition and openings and was not changed.
---

Follow-ups from `plaster-dimension-corner-to-corner` (2026-10-20).

## Tests

- [ ] Manual browser check of the plaster dimensions (task 5.2) was not done: a plane of several walls, an opening in the middle, an opening at a joint, a room drawn wall by wall. Only unit and render tests cover it (`plaster-corner-dimensions.test.ts`, `plaster-corner-render.test.ts`).
- [ ] Mutation testing was not run for `src/rough/plaster-chain.ts` and `src/rough/plaster-dimensions.ts` (no mutation tooling in the repo).

## Out of scope

- No formatter or linter is configured (no eslint/prettier config, no `lint` script), so quality gates 1–2 were not run; `tsc` and the full `vitest` suite pass.
- An end strip that touches two parallel plaster planes within 0.5 cm joins both runs; not seen in real drawings (`plaster-chain.ts`).


---

Follow-ups from `plaster-opening-reveals` (2026-10-20).

## Out of scope (decided, revisit if needed)

- Drywall on the «Реконструкция» plan does not snap to opening reveals: `plasterObstacles` skips them (`src/reconstruction/plaster-obstacles.ts`). Reveals are shown there as part of the grey plaster underlay only.
- Reveals are only the two side jambs seen on the plan; head and sill plaster are not modelled.
- A click on the wall body within the hit radius of an opening jamb now targets the reveal instead of the face; the face stays reachable outside the body and elsewhere along the wall.


---

Follow-ups from `plaster-corner-wrap` (2026-10-21).

## Out of scope (decided, revisit if needed)

- The leading strip at an outer corner is the one whose wall comes first in `plasterSources` order (walls of the survey, then own «Монтаж» walls); there is no UI to choose it (`wrapSideCorners` in `src/rough/plaster.ts`).

---

Follow-ups from `plaster-single-contour` (2026-10-21).

## Tests

- [ ] No formatter, linter or mutation tool in the repo; only one mutant was tried by hand (`min` → `max` at the `to` edge of `endDimensionBounds`, caught by SC-10); probe depth, edge choice and `x.wall.id !== wall.id` were not.

## Out of scope (decided, revisit if needed)

- The end strip is not trimmed by a neighbour's strip at an inner corner: the strips overlap in the corner square (like side strips); only the dimension starts at the neighbour's outer surface.

---

Follow-ups from exploring `plaster-right-angle` (2026-10-21).

## Out of scope (decided, revisit if needed)

- Corners of opening reveals with the side strip of the wall are not plaster corners for the «Прямой угол» tool (`rough-works-plan` «Угол контура штукатурки»); the reveal strip does not join the wall strips into one contour.
- The PDF legend gets no «Прямой угол» entry: the legend height guard (`pdf-export` «Легенда на странице PDF») is tuned for at most nine entries on A4, and the sign is drawn without a legend entry.

---

Follow-ups from `furniture-plan-table` (2026-10-21).

## Tests

- [ ] `src/main.ts` wiring of the «Мебель» plan (press/drag/arrows/Delete/eraser/marquee, panel fields, plaque, undo/redo of `furniture` steps) has no automated test; only the pure parts (`table-tool`, `table-edit`, `table-params`, `overlap`, `warning`, markup) are unit-tested. The DOM flow was checked by hand in the browser (place, overlap plaque, drag, angle field, arrows series, undo/redo, Delete, eraser, plan switch, dark theme).

## Out of scope (decided, revisit if needed)

- Dimensions and the ruler have no anchors on tables: «Размер» measures only between faces of the underlay (`furniture-plan` «Инструменты плана «Мебель»»).
- The door swing area is not an obstacle for tables: a table may stand where a door opens without a highlight or plaque.

---

Follow-ups from `furniture-items-catalog` (2026-10-21).

## Docs

- [ ] Скилл `.claude/skills/add-furniture-kind/SKILL.md` лежит в `.claude/`, которая целиком в `.gitignore`, поэтому в коммит не попал. Решить, версионировать ли скиллы проекта (например, исключить `.claude/skills/` из `.gitignore`).

## Tests

- [ ] `src/main.ts`: переключение вида в панели группы «Мебель» (`applyFurnitureGroup`, `furnitureKindButtons`) и значения по видам проверены только на чистых частях (`item-params-kinds.test.ts`) и разметке; живой переключатель при двух видах не проверялся, пока в каталоге один вид — проверить на втором виде (стул).

## Out of scope (decided, revisit if needed)

- Общая функция `footprint(item)` и не-прямоугольные формы (круглый стол, Г-образный диван): `clipByRect` в `src/furniture/overlap.ts`, `hitItem` и `itemCorners` в `src/furniture/item.ts` рассчитаны на прямоугольник. Для выпуклых форм достаточно обобщить `clipByRect`, для вогнутых нужно делить форму на выпуклые части.
- Разные наборы полей у видов (высота и др.): у всех видов ширина, длина, угол.

## Out of scope — furniture-center-snap (2026-10-21)

- [ ] Furniture snapping to edges (item faces, wall faces) — only centers snap now.
- [ ] Equal spacing between furniture items.
- [ ] Guide lines along a rotated item's own axes (a chair at 45° only gives world X/Y lines).
- [ ] A modifier key to turn center snapping off for one gesture.

## sofa-sketch-redraw (2026-10-23)

### Out of scope

- [ ] Подушка на эскизе дивана (нарисована от руки слева на спинке) не включена в рисунок дивана: неясно, нужна ли она как часть дивана. Если нужна — спросить форму и положение, добавить в рисунок (`sofaDrawing` в `src/furniture/item-drawing.ts`).

## add-furniture-desk-office-chair (2026-10-23)

### Docs

- [ ] Сценарии «Плашка пересечений называет стул» и «Плашка пересечений называет диван» в `openspec/specs/furniture-plan/spec.md` обещают «Стул пересекается: стена, стол» и «Диван пересекается: стена, стул» при пересечении с предметом другого вида, а поведение (сценарий «Предметы разных видов», тесты FIK-42, SW-03, SW-04) — «Мебель пересекается: …». Привести формулировки сценариев к поведению на уровне спеки.

### Out of scope

- [ ] Эскиз письменного стола и кресла снят с рисунка от руки, числа округлены (ножки, дуга сиденья, положение колёсиков и спиц). Если рисунок на плане отличается от задуманного — поправить числа отдельным change по образцу `sofa-sketch-redraw`.
- [x] Запас легенды PDF на странице «Мебель» исчерпан: при всех пяти видах мебели, пяти материалах и коммуникациях 15 записей × 14 мм = 210 мм из 222 мм (A3). Следующий вид мебели потребует решения уровня `pdf-export` (колонки или уменьшенный шаг). Решено в `add-furniture-tv-wall-cabinet`: второй столбец легенды.

## add-furniture-tv-wall-cabinet (2026-10-23)

### Out of scope

- [ ] Телевизор, стоящий на подвесной тумбе, пересекается с ней по прямоугольникам предметов и даёт плашку «Мебель пересекается: телевизор, подвесная тумба» (у предметов нет высоты). Если «стоит на» нужно — решение уровня спеки `furniture-plan` (пересечения, `src/furniture/overlap.ts`).
- [ ] Эскиз телевизора и тумбы снят с рисунка, числа округлены (наклон задней стенки, шейка, подставка 42 см, крепления 6 x 7 см). Если рисунок на плане отличается от задуманного — поправить числа отдельным change по образцу `sofa-sketch-redraw`.
- [x] Легенда PDF поддерживает до 30 записей на странице (два столбца по 15); третий столбец и ограничение ширины легенды по формату A4 не заданы (`pdf-export` «Легенда на странице PDF»). Третий и следующие столбцы описаны в `add-furniture-appliances`; ограничение ширины на A4 — отдельный пункт там же.

## add-furniture-bed-nightstand (2026-10-23)

### Docs

- [ ] Сценарии pdf-export «Шестнадцатая запись во втором столбце» и схема «17 записей» говорят «всех семи видов каталога»; в каталоге теперь двадцать три вида (33 записи: 15 + 15 + 3; add-furniture-appliances, сценарий «Тридцать первая запись в третьем столбце»). Привести формулировки к текущему каталогу на уровне спеки (openspec/specs/pdf-export/spec.md).

### Out of scope

- [ ] На эскизе кровати есть нарисованная от руки складка покрывала у верхнего левого угла (свободная форма); в рисунок кровати она не включена (edDrawing в src/furniture/item-drawing.ts). Если нужна — спросить форму и положение.
- [ ] Эскиз кровати и столика снят с рисунка, числа округлены (подушки 65 x 37, кромки и складки одеяла, рамка столика 2,5 см); складки одеяла на эскизе изогнуты, в рисунке — отрезки. Ширина столика 30 см взята с эскиза (подписана только длина 60). Если рисунок на плане отличается от задуманного — поправить числа отдельным change по образцу sofa-sketch-redraw.

## add-furniture-wardrobes (2026-10-23)

### Out of scope

- [ ] На эскизе двустворчатого шкафа ручки выступают за верхнюю сторону прямоугольника на 2,5 см, а рисунок вида по спеке `furniture-plan` лежит целиком внутри прямоугольника предмета; ручки нарисованы внутри створочной полосы (на линии створок, высота 2 см). Если нужно выступание — решение уровня спеки (что обводят выделение и ластик, габариты страницы PDF); `src/furniture/wardrobe-drawing.ts`.
- [ ] Расстановка вешалок шкафов снята с эскизов списком центров (20 пар у шкафа-купе, 5 у двустворчатого) и не параметрическая: у другой ширины положения растягиваются или сжимаются, число пар не меняется. Эскизы нарисованы от руки, числа округлены (±0,3 см); поправить — отдельным change по образцу `sofa-sketch-redraw`.

## add-furniture-curtains (2026-10-23)

### Docs

- [ ] Плашка пересечений строится общим правилом «<название вида> пересекается: …», поэтому у штор она читает «Шторы пересекается: стена». Склонение названия во множественном числе — решение уровня спеки `furniture-plan` (`src/furniture/warning.ts`).

### Out of scope

- [ ] На картинке `references/curtains.png` концы гардины отогнуты вниз за карниз, а лицевая линия двойная; рисунок вида лежит целиком внутри прямоугольника предмета (спека `furniture-plan`), поэтому в `src/furniture/curtains-drawing.ts` концов нет и линия одинарная. Числа сняты с картинки и округлены (±0,3 см); поправить — отдельным change по образцу `sofa-sketch-redraw`.

## add-furniture-kitchen-cabinet-fridge (2026-10-23)

### Out of scope

- [ ] Углы раскрытия дверей холодильника вычисляются из хода дверей (оба нижних угла на одной глубине 30 см: около 48,7° и 30,0°), на картинке `references/fridge.png` левая дверь раскрыта около 45°. Длина холодильника 90 см выбрана по картинке с обрезанным верхом (корпус 60 + ход дверей 30), числа округлены (±0,3 см); поправить — отдельным change по образцу `sofa-sketch-redraw` (`src/furniture/fridge-drawing.ts`).
- [ ] Ручка кухонного шкафа на картинке `references/kitchen-cabinet.png` выступает за линию фасада; в рисунке вида она внутри прямоугольника предмета (верхние 2 см длины), засечки снежинки холодильника единой формы (`src/furniture/kitchen-cabinet-drawing.ts`, `src/furniture/fridge-drawing.ts`).

## furniture-overlap-exemptions (2026-10-23)

### Out of scope

- [ ] Шторы на окне по-прежнему дают пересечение «окно» (исключены только шторы × батарея и телевизор × тумба); шторы висят у окна, так что исключение для окна — вероятный следующий запрос. Решение уровня спеки `furniture-plan` «Пересечения стола»: добавить `window` в `overlapExemptions.obstacles` у штор (`src/furniture/furniture-kinds.ts`).

## ruler-objects-span (2026-10-23)

### Out of scope

- [ ] У маленьких объектов (воздуховод 40 x 30 см) подписи двух линий замера объекта (середины пересекающихся у курсора линий) накладываются друг на друга на экране; по спеке `ruler-tool` «Замер объекта» это допустимо. Улучшение — развести подписи или сместить линию глубины (`src/render.ts` `drawRuler`, `src/ruler.ts` `objectReading`).
- [ ] Нет теста батареи вплотную к стене и батареи с вырожденной стеной-хозяйкой на уровне пролёта (адаптер покрыт `src/ruler-objects-adapters.test.ts` ROA-4); сборка объектов по планам `rulerOf` в `src/main.ts` юнит-тестами не покрыта (DOM) — проверена вручную в браузере (кроме плана «Монтаж»).

## furniture-dimensions (2026-10-24)

### Out of scope

- [ ] У маленького повёрнутого предмета (стул 40 x 40 под 45° при масштабе 0,5) оба числа габаритов стоят у одного верхнего угла и накладываются друг на друга: каждое внутри своей стороны по правилу «помещается», и спеку `furniture-plan` «Габариты предмета мебели» это не нарушает. Улучшение — разводить числа соседних сторон или выносить один размер наружу при наложении (`src/furniture/item-size-layout.ts`).
- [ ] Предмет поперёк перегородки: полоса от противоположной стороны находит грань внутри предмета, и расстояние с этой стороны — «0» от перегородки, а не от дальней стены (design D2, риски; `src/furniture/item-wall-reach.ts`).

### Tests

- [ ] Нажатие на правимое число мебели в `src/main.ts` (`pressFurnitureNumber` раньше `itemTool.press`, поле ввода, Esc, обновление панели, отмена) юнит-тестами не покрыто (DOM); проверено вручную в браузере 2026-10-24. Габариты в PDF проверены тестами отрисовки и `pageBounds` (`src/export/furniture-pdf-dimensions.test.ts`), выгрузка файла в браузере не проверялась.

## add-furniture-kitchen-objects (2026-10-24)

### Out of scope

- [x] Легенда страницы «Мебель» со всеми видами — 28 записей из 30 (два столбца по 15); следующие два вида займут последнее место, третий не поместится. Решение уровня спеки `pdf-export` «Легенда на странице PDF» (третий столбец или меньший шаг строки, `src/export/legend.ts` `LEGEND_COLUMN_CAPACITY`). Решено в `add-furniture-appliances`: столбцы легенды без верхнего предела (33 записи: 15 + 15 + 3).
- [x] Верхний блок картинки кухни (модуль с двумя кругами — духовка и СВЧ) не перенесён: пользователь исключил его из change. Новый вид — по скиллу `add-furniture-kind`, образец формы — исходный скриншот (в `references/` не сохранён). Перенесён в `add-furniture-appliances` (`references/oven-microwave.png`).
- [ ] Ширина винного шкафа 30 см выбрана, а не снята с картинки (на `references/kitchen-objects.png` модуль обрезан); числа рисунков объектов кухни округлены (±0,5 см) (`src/furniture/kitchen-module-drawing.ts`, `src/furniture/kitchen-inset-drawing.ts`).
- [ ] Телевизор на посудомойке или винном шкафу остаётся пересечением (исключение телевизора — только тумбы и кухонный шкаф); врезной объект над встроенным не пересекается, даже если под ним нет шкафа (план не знает ярусов). Решение уровня спеки `furniture-plan` «Пересечения стола».

### Docs

- [ ] Рычаг раковины на картинке лежит поверх чаши; в рисунке вида нижняя сторона чаши прервана под рычагом, а стороны рычага вертикальны (общее правило «линии не пересекаются»), `src/furniture/kitchen-inset-drawing.ts`.

## add-furniture-appliances (2026-10-24)

### Bugs

- [ ] Образец «Кровать» в легенде PDF выходит за свою область: складки одеяла и его нижняя кромка рисуются справа от уменьшенного контура и наползают на подпись (замечено в браузере при экспорте A3 страницы «Мебель» со всеми видами). Вероятная причина: детали кровати отсчитываются от длины l (l − 84·k, l − 58·k, …) и в образце с полноразмерными деталями (0,2 мм/см) при уменьшенных габаритах уходят за прямоугольник; рисунок кровати при k = 1 и длине меньше 84 см не помещается (`src/furniture/item-drawing.ts` `bedDrawing`, `src/export/legend-draw.ts` `drawItemSample`). Нет теста образца кровати, аналогичного `furniture-pdf-kitchen-objects.test.ts`. Это расходится со спекой (`pdf-export` «образец целиком внутри отведённого места»), но к этому change не относится.

### Out of scope

- [ ] Знак X кухонной колонны виден сквозь круги духового шкафа и микроволновки, стоящих в колонне: рисунки без заливки, понятия «перекрытия» линий одного предмета другим нет; на `references/oven-microwave.png` диагонали закрыты кругами (`src/furniture/built-in-appliance-drawing.ts`). Решение уровня спеки `furniture-plan` (порядок рисования и маски предметов одного места).
- [ ] Размеры по умолчанию духового шкафа и микроволновки — 60 × 62, размер модуля колонны, а не габариты приборов (≈ 60 × 55 и 60 × 40): так фасады и значки совпадают с колонной при центровке. Если нужны габариты прибора — решение уровня спеки `furniture-plan` «Каталог видов мебели» (значок тогда не в середине корпуса колонны).
- [ ] Легенда PDF в три столбца на A4 сильно сужает область чертежа (ширина легенды документа — три ширины столбца на каждой странице); ограничение ширины легенды по формату не задано (`pdf-export` «Легенда на странице PDF», `src/export/legend.ts` `legendWidthMm`).
- [ ] Сушильная машина над стиральной машиной, встроенной в кухонный шкаф, подсвечивается из-за шкафа (сушка ставится только на стиральную машину, ярусов у плана нет); если такая расстановка нужна — решение уровня спеки `furniture-plan` «Пересечения стола».

## add-plumbing-plan (2026-10-26)

### Out of scope

- [ ] Плановые ветки `main.ts` (`loadWorking`, `pushRecord`, `setDimensions`, `commitWorking`, `editableWall/Element/Battery`, `undo`/`redo`, `drawPlan`) растут на каждый план: «Сантехника» — седьмая цепочка `if`. Вынести в общий реестр планов (рабочий набор, запись, история, отрисовка) — отдельный рефакторинг, `src/main.ts`.
- [ ] Размер «Сантехники» на навсегда удалённый прибор остаётся в документе скрытым (`src/plumbing/plumbing-workspace.ts` `hiddenDimensions`, design D3): он вернётся, только если прибор с тем же id появится снова (отмена на «Мебели»). Чистки «висячих» размеров нет — решение уровня спеки `plumbing-plan`.
- [ ] Ванна, душ, бойлер, выводы ХВС/ГВС/К и автоподписи приборов на плане «Сантехника» не входят в change: приборы — только раковина, посудомойка и стиральная машина (`src/furniture/furniture-kinds.ts` `water`); унитаз добавляется отдельным change `add-toilet`.
- [ ] Выравнивание уровня нового размера по существующим (`dimLevelSnap`, `src/geometry.ts`) не видит размеров к приборам «Сантехники» — как и размеров к углам батарей: функция разрешает точки без батарей и приборов. Если нужно — решение уровня спеки `dimension-tool`.

### Docs

- [ ] Сценарий `pdf-export` «Габариты и размеры на странице» исправлен в ходе реализации: число размера в см округляется до целого (`src/format-length.ts`), поэтому «107,5» в см выводится как «108»; сценарий переписан на мм («450», «400», «1075»).

---

Follow-ups from `add-ceiling-plan` (2026-10-26).

## Out of scope (decided, revisit if needed)

- [ ] **Drywall bulkhead ("выпуск гипсокартона") on the ceiling plan.** The user explicitly left it out of this change
  (see the user's reference pictures). Needs its own tool on «Потолки и освещение».
- [x] **Light fixtures.** Done in `add-ceiling-lighting` (2026-10-27). The plan is named «Потолки и освещение», but it only has the stretch ceiling so far; no light
  objects, legend entries or PDF output for them.
- [ ] **Rooms that take drywall into account.** Ceiling rooms come from «Монтаж» walls (like screed and the room
  explication), so a store-room enclosed by drywall gets no ceiling of its own and the fill runs under the drywall
  (`src/ceiling/ceiling-scene.ts`, design D4 / Risks). Changing that belongs to the room explication, not to the ceiling.

## Tests

- [ ] (add-ceiling-plan, 2026-10-26) `src/main.ts` ceiling wiring has no DOM-level test: clicking a ceiling label opens the
  panel with its value and the in-place field, clearing the selection closes the panel, the eraser hover highlight follows
  the cursor. Checked by hand in the browser; `src/ceiling/ceiling-wiring.test.ts` covers only the plan-switch commit order
  and the Delete branch.
- [ ] (add-ceiling-plan) Render test for a rotated item on the ceiling plan (`src/ceiling/ceiling-render.test.ts`): scenario
  «Повёрнутый предмет» is covered only at scene level (CP-61, same centre, size and angle) and by the shared
  `itemDrawingInPlan`.

---

Follow-ups from `add-ceiling-lighting` (2026-10-27).

## Out of scope (decided, revisit if needed)

- [ ] **Number clutter.** Every light always shows two distances (bra — one); a grid of spots stacks many parallel dimension
  lines and a light placed on a ceiling label overlaps «-50мм». No de-cluttering or chained dimensions (design, Risks).
- [ ] **Bra does not follow its wall.** A bra stores a free point and an angle, not a wall reference: moving or deleting the
  wall on «Монтаж» leaves the bra where it was (`src/ceiling/lights.ts`, design D2).
- [ ] **Bra mounting height** is not stored or shown.

## Tests

- [ ] (add-ceiling-lighting) `src/main.ts` light wiring is covered only at source level (`src/ceiling/light-wiring.test.ts`:
  press, eraser and Delete order, panel closing on plan/tab switch). Drag with pointer capture, the in-place number field and
  the group buttons have no DOM-level test; checked by hand in the browser.
- [ ] (add-ceiling-lighting) Hand check «wall moved on «Монтаж» → light numbers recomputed» was not done in the browser;
  covered only by the numbers being computed from the live scene (`lightBodies` in `src/main.ts`).

## Docs

- [ ] (add-ceiling-lighting) `recordCeiling` / `undoCeiling` / `redoCeiling` (`src/history.ts`) are no longer used by the
  app (replaced by `*CeilingPlan`); they stay because `src/ceiling/history-ceiling.test.ts` specifies them. Remove together
  with those tests once the spec drops the ceilings-only entry.

---

Follow-ups from exploring `add-switching-plan` (2026-10-27).

## Out of scope (decided, revisit if needed)

- [ ] **Tool «Выключатель»** (after «Линия освещения»): ключи на грани стены, блок из нескольких ключей, подпись ключа — включаемые линии (`L2,LV1`); счётчик легенды «Выключатели» (число ключей).
- [ ] **Kind «Вытяжка»** (after «Выключатель»): нагрузка со своей линией (`LV1`); знак — красный квадрат с ломаной внутри; счётчик легенды «Вытяжка».
- [ ] Reference pictures for the two remaining new symbols: `references/lighting.png` has no switch or extractor — ask the user for a picture before designing the drawings (`.claude/rules/references.md`). The line label now has `references/lines.png`.

## Docs

- [ ] (add-switching-plan) The page lists in the general `pdf-export` requirement «Легенда на странице PDF» still name eight pages (`Потолки и освещение` is the last); the ninth page is covered by the separate requirement «Легенда страницы «Группы включения»» — fold the lists together at the next legend change.

- [ ] **Legend «Количество» column** (changes `add-light-lines`, `add-light-switch`, `add-exhaust-fan`): the user's sample legend has a quantity column (lights, lines, switches, extractors); the app legend is «sample — label» only, so the column is not part of the lighting changes. Needs its own change for every plan's legend.
- [ ] **Scheme integrity checks** (after `add-exhaust-fan`): a line with no switch key, a key naming a line that does not exist, highlight of a line's group when a key is selected.
- [ ] **Order of the lighting changes:** `add-switching-plan` → `add-light-lines` → `add-light-switch` → `add-exhaust-fan`; the later ones validate against main specs only after the earlier ones are archived.

---

Follow-ups from implementing `add-switching-plan` (2026-10-27).

## Bugs

- [ ] Plan switcher with nine segments is ~711 px wide and does not wrap or scroll (`#plan-switch`, `src/style.css:515`): in a window narrower than ~760 px the last segments are clipped by the panel (eight segments clipped below ~640 px, so not new, but worse now). Needs a wrapping or scrolling switcher; design D1 assumed it fits.

## Docs

- [ ] The project has no formatter or linter configured (no prettier/eslint config, no `lint` script), so quality gates 1–2 of CLAUDE.md Rule 7 only ran as `tsc --noEmit` and the test suite.

---

Follow-ups from implementing `add-light-lines` (2026-10-27).

## Bugs

- [ ] Line labels of neighbouring lights overlap in a dense grid (design D5 accepts it: move the light on «Потолки и освещение»); a layout that avoids overlaps would be its own change.

## Docs

- [ ] Design D6 of `add-light-lines` says the label is italic, while the spec says «the same size and style as the «ДПС» caption» (upright). Implemented per the spec (upright); the italic look in `references/lines.png` is the CAD font of the sample. Decide whether the label should be italic and align design and spec.
- [ ] `references/lines.png` is a copy of the user screenshot `img_2.png` (root, uncommitted). Task 0.2 was closed from that picture, without asking the user explicitly.

## Out of scope

- [ ] Checks «line without a switch» and «switch without a line», and the «Количество» column of the legend (see the `add-switching-plan` section above): not part of this change.


---

Follow-ups from implementing `add-light-switch` (2026-10-27).

## Bugs

- [ ] Key labels of two switches standing close on one wall overlap (design «Risks» accepts it: move the block by hand); no layout pass.
- [ ] The opening body for switch faces (`openingBodies`, `src/switching/switch-reach.ts`) reaches 10 cm past each wall face (`OPENING_PAD_CM`) so plaster and drywall faces inside a doorway are also refused; a wall parallel and closer than 10 cm to a door leaf's wall would lose a few cm of face there. Not met in the drawings tried.

## Tests

- [ ] `src/main.ts` wiring of the switch tool (pointerdown / pointerup / Delete / Escape / undo branches, `pressSwitches`, `releaseSwitch`, the in-place key editor) has no automated test; the tool, symbol, faces, storage, history, render and PDF are unit-tested, the DOM flow is checked by hand in the browser.
- [ ] «Рамка не выделяет» (marquee does not select switches) holds because the plan «Группы включения» never starts a marquee; no test pins it.
- [ ] No mutation testing tool is installed in the project; nothing in this change was mutation-tested.

## Docs

- [ ] Design D7 of `add-light-switch` says the `switchingPlan` history entry is one snapshot of `lines`, `switches`, `callouts`, `notes`. Implemented as a separate entry kind `switches` (snapshot of the switch list, like `switching` for lines and `callouts` / `notes` for theirs) so the existing line-history API and tests stay unchanged. Align design D7 with the code.
- [ ] Spec «Выделение, перемещение, правка…» says Escape and focus loss of the key field apply a valid value; the shared `openNumberEditor` (ceiling label, line label) closes without applying on Escape. The switch field applies on close through `editor.text()`; the other fields keep their behaviour. Decide whether the plan's other in-place fields should follow.
- [ ] Spec and design D4 said the key dash goes right of the stalk (north wall); `references/lines.png` shows it on the left. Changed to the left with the user's confirmation (2026-10-27) in both artifacts.

## Out of scope

- [ ] Checks «line without a key» and «key without a line», highlight of a line's group when a key is selected, mounting height of a switch, the «Количество» column of the legend (see the `add-switching-plan` section above): not part of this change.

---

Follow-ups from `add-exhaust-fan` (2026-10-27).

## Docs

- [ ] The fan symbol follows the user's verbal description (design D4), there is no picture in `references/`; replace the drawing in `src/switching/exhaust-symbol.ts` if a picture is added.
- [ ] Task 3.2 of `add-exhaust-fan` said the existing label-storage tests pass without edits, but `src/switching/storage-lines.test.ts` LL-21 listed `LV1` as an invalid name, which the spec now makes valid (`LV<n>`); the entry was changed to `LV0` with a TCR comment. Align the task text.
- [ ] The `drawing-storage` delta of `add-exhaust-fan` declared «Метки линий освещения в документе» as ADDED although it exists; moved to MODIFIED so that archive does not refuse it.

## Tests

- [ ] `src/main.ts` wiring of the exhaust tool (`pressExhausts`, drag, Delete, Escape, undo branches, line tool on a fan) has no automated test; the model, tool, symbol, storage, history, render and PDF are unit-tested, the DOM flow was checked by hand in the browser.
- [ ] No mutation testing tool is installed in the project; nothing in this change was mutation-tested.

## Out of scope

- [ ] Schema integrity checks, highlight of a group by key, height and power of a fan, a fan on «Потолки и освещение» with distances to walls (design D1: needs a separate change moving it to `ceiling.lights`), the «Количество» column of the legend.

---

Follow-ups from `split-ceiling-pdf-pages` (2026-10-27).

## Docs

- [ ] The general `pdf-export` requirement «Легенда на странице PDF» still lists pages by name and by "first seven"; the legend of the page «Освещение. Расстояния» lives in its own requirement. Fold the lists together at the next legend change (same drift as the «Группы включения» item above).

## Tests

- [ ] The click on «Экспорт PDF» in `src/main.ts` (`pagesOf` → `fitScale` → `exportPages`) was not run through the UI; ten pages were checked by building the PDF from a sample drawing and opening it in the browser. No mutation testing tool is installed in the project.

## Out of scope

- [ ] The page «Освещение. Расстояния» has no callouts, notes or ceilings by decision; if a callout is needed there, it needs its own storage (callouts are per plan, `calloutsOf(drawing, "ceiling")` feeds page 8 only).

---

Follow-ups from exploring `merge-lighting-plans` (2026-10-27).

## Docs

- [ ] The merged plan keeps the name «Потолки и освещение»; the user first named it «Освещение». Renaming touches ~150 mentions in 10 specs (`ceiling-plan`, `ceiling-lighting`, `drawing-plans`, `drawing-storage`, `drawing-history`, `canvas-app`, `light-lines`, `exhaust-fan`, `pdf-export`) plus `PLANS` in `src/plans.ts`; the PDF page 8 title stays as is. Do it as its own change if wanted.
- [x] The `Purpose` of `exhaust-fan` and `light-lines` mentions the plan «Группы включения»; updated by hand in `openspec/specs/` (a delta cannot change a Purpose).
- [ ] Specs other than the delta ones still mention the plan «Группы включения» in prose/titles of scenarios (kept for the validator); clean up when renaming the plan.
- [ ] `src/switching/switching-scene.ts` and `switchingScene` now serve only the PDF page «Группы включения»; if `ceilingScene` ever carries lines/switches/exhausts, fold them together (design D3).

## Out of scope

- [ ] A layer switch (ceiling fill / distances / switching groups) for the merged plan: the canvas shows everything at once, only the three PDF pages separate the layers. Needs its own UI decision (no new widgets without approval, `.claude/rules/ui.md`).
- [ ] A callout/note choice per PDF page: callouts and notes of the merged plan go to page 8 only (user decision); pages 9 and 10 have none.

---

Follow-ups from `line-edit-and-highlight` (2026-10-27).

## Tests

- [ ] `src/main.ts` wiring has no automated test: `panelCarrierId` / `syncLinePanel` (panel opens for a selected light or exhaust fan, empty field without a label), the `change` handler branch that calls `lineTool.setLineOf`, and `linkSelection` → `linkedObjects` → `renderSwitching`. Only the pure parts are unit-tested (`line-links`, `setLineOf`, `linked*` render options); the DOM flow was checked by hand in the browser (a light with and without a label, an exhaust fan, a smoke detector, a selected switch).

## Out of scope (decided, revisit if needed)

- [ ] Linked objects use the same selection colour as the selected one (design D2); a second shade needs its own change if they are hard to tell apart.

---

Follow-ups from `add-furniture-tropical-shower` (2026-10-28).

## Out of scope

- [ ] The shower has no overlap exemptions: a ceiling-mounted head standing over a bath or a shower tray would be flagged, but the catalog has neither. Revisit when such a kind is added (`furniture-plan` «Пересечения стола»).
- [ ] The shower drawing follows the user's sketch (variant A of the HTML page), not a picture in `references/`; replace the drawing in `src/furniture/tropical-shower-drawing.ts` if a picture is added.

## Docs

- [ ] The `pdf-export` scenario «Тридцать первая запись в третьем столбце» still says «двадцать три вида» and «33 записи»; the catalog has 27 kinds (after `add-washbasin`), so the legend of a page with all kinds has 37 entries (15 + 15 + 7). The test `src/export/legend-three-columns.test.ts` L3-01 already says 37; align the scenario at the next legend change.
---

Follow-ups from `add-wall-shower-drain` (2026-10-28).

## Out of scope

- [ ] The wall shower drain is exempt from overlaps with walls, drywall and plaster everywhere, not only where it really lies inside a wall: a drain standing in the middle of a room is not flagged unless it hits a window, door, opening, battery, communication or another item. A precise check («body entirely inside a wall piece») needs its own rule in `src/furniture/overlap.ts` (`furniture-plan` «Пересечения стола»).
- [ ] The drain drawing follows the user's sketch (variant A of the HTML page), not a picture in `references/`; replace the drawing in `src/furniture/wall-shower-drain-drawing.ts` if a picture is added. Variants B–D of the sketch (outlet pipe, protruding cover, flow arrows) are not drawn.

## Docs

- [ ] The tray body is a solid line in the catalog; the sketch drew it dashed. A dashed line would need short segments in the drawing (as the nightstand does) and is hard to read in the 14 × 1.6 mm legend sample; revisit with the picture above.

---

Follow-ups from `add-washbasin` (2026-10-28).

## Out of scope

- [ ] The washbasin has no overlap exemptions: a basin on a vanity unit or standing in a drywall wall is flagged as an overlap (the catalog has no vanity unit). Revisit when such a kind is added or if bathrooms get false overlaps (`furniture-plan` «Пересечения стола»).
- [ ] Variants A, C, D, E of the sketch (round bowl on a counter, wall-hung with a shelf, corner, double on a vanity) are not drawn; only variant B is in the catalog.

## Docs

- [ ] The washbasin drawing follows the user's sketch (variant B of the HTML page), not a picture in `references/`; compare the numbers with a picture and replace the drawing in `src/furniture/washbasin-drawing.ts` if one is added (`.claude/rules/references.md`).
---

Follow-ups from `furniture-kind-groups` (2026-10-28).

## Out of scope

- [ ] Selecting items of different groups at once (marquee over a bed and a washbasin): the spec only says "the panel of the group of the item's kind". The code opens the panel of the first selected item's group (`revealItemPanel` in `src/main.ts`). Decide the rule in `furniture-plan` «Группы видов мебели» if it matters.

## Tests

- [ ] The group menu wiring in `src/main.ts` (panel moving under the open group's button, kind button visibility) is checked only by source assertions in `furniture-ui.test.ts` and by hand in the browser; the pure transitions are unit-tested in `furniture-groups.test.ts`.
