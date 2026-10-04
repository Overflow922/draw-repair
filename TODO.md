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
