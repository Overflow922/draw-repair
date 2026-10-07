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

## Bugs

- [ ] **A slightly tilted wall makes an ortho move drag the whole drawing.** `planOrthoStretch`
  (`src/ortho-stretch.ts`) treats a wall as parallel to the move vector only within `RIGHT_SIN` (0.5°).
  A wall tilted more (e.g. 3 cm over 300 cm, 0.57°) counts as "not parallel" and moves whole, and the
  spread then reaches every connected wall. The fix should not swap one magic tolerance for another.
- [ ] **Typing a length for a tilted wall with ortho on can drag the whole drawing.** `resizeWallBounded`
  (`src/wall-edit.ts`) moves the end along the wall's own direction; for a tilted wall that vector is
  diagonal, and `planOrthoStretch` moves every connected wall whole (same cascade as the diagonal drag
  fixed by `ortho-axis-lock`). Length input is not covered by that change's axis lock.

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

## Out of scope (decided, revisit if needed)

- End markers of a selected wall stay active in every tool, including «Проём»/«Окно» (only the middle marker is
  disabled there). Unchanged by this change; spec `wall-selection` does not say either way.
