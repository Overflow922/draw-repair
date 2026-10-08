# Test change request 1 (2026-10-08)

Status: the tests below were approved by validation round 4 (`VERDICT: PASS`). Implementation revealed that the specified
behavior conflicts with existing approved behavior, and the user decided how to resolve it, so the approved tests must be
changed by the Test Writer and re-validated in a fresh context (CLAUDE.md Rule 5). The implementation agent did not edit them.

## Why the approved tests no longer represent the specification

Implementing task 1.2 broke five existing approved tests of unrelated changes: `SNAP-END-3` (`src/wall-geometry.test.ts`),
`CV-BAND-1` (`src/wall-snap-cap-vertex.test.ts`), `SNAP-SCALE-1/2/3` (`src/wall-snap-scenes.test.ts`). They pin the existing
rule «outside the wall strip, past the end plane → face snap flush with the end», e.g. cursor (104, −14) on the wall
(0,0)→(100,0), thickness 20 → point (90, −10) at every zoom. The diagonal snap, as first specified, took the whole quadrant
behind the corner (any offset > 0) and therefore replaced exactly that result.

Decision (user, 2026-10-08): keep the existing flush-face behavior; the diagonal snap only takes the far part of the quadrant —
both offsets from the corner at least half the snap zone and at most the zone (zone = max(snap radius, new half-thickness);
half-zone is 5 cm for a 20 cm wall at zoom 1; boundaries inclusive). The delta specs were updated accordingly
(`specs/wall-drawing/spec.md`: requirement «Диагональное прилипание к углу свободного торца», the end-zone paragraph and the
scenario «Угловое прилипание у торца не зависит от масштаба» of the MODIFIED requirement).

## Tests to change (all in the two new files of this change)

Cursors that were inside the quadrant but nearer than half the zone to the end plane or to the face (e.g. (6, 14): 6 cm along,
4 cm across) are now in the near part and give the old flush face snap. Expected results of the diagonal tests are unchanged;
the cursors move into the far part (e.g. (8, 18)).

`src/wall-snap-diagonal.test.ts`
- DS-1, DS-2, DS-3, DS-4, DS-5, DS-9, DS-12, DS-13, DS-13b, DS-14, DS-15, DS-16, DS-18, DS-8 (negative with the cursor in the far part so it stays meaningful), DS-10 (single-wall controls and the L-corner negatives): new cursors in the far part; same expected vertex, normal and square.
- DS-B1, DS-B2: re-aimed from the quadrant edges (plane x = 0, face line y = 10) to the new half-zone boundary (offset 5 / 4.99 on each axis) and keep the strip-edge facts (cursor on the face line → cap; just outside → old flush face).
- DS-B3, DS-B5, DS-B6, DS-B7, DS-B10: zone limits re-aimed at points whose other offset is inside [half-zone, zone]; thickness 40 (zone 20, half-zone 10) and zoom 0.25 (zone 24, half-zone 12) variants.
- DS-B9 (per-axis zone shape) keeps (8, 18); DS-15 rotated probes add the half-zone boundary.
- New: near part of the quadrant keeps the flush face (4, 14), (4.99, 18), (8, 14.99) and the half-zone boundary is inclusive ((5, 18), (8, 15) → diagonal), at thickness 20 zoom 1, thickness 40, zoom 0.25.

`src/wall-geometry-diagonal-corner.test.ts`
- DJ-14: the snap cursor moves to (8, 18). IC-6 and the other joint tests do not depend on the cursor position and are unchanged.

The five existing tests named above are NOT changed: they pass under the new rule (their offsets are 4 cm < half-zone 5 cm).

## Plan / manifest

`test-plan.md` and `test-suite.md` get an addendum for round 5 (same IDs, new cursor values). The validator must be a fresh context.
