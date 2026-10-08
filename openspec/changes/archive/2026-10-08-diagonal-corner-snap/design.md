## Context

- Snapping is in `src/wall-snap.ts`: `wallCandidates` builds `Candidate`s per wall (`faceCandidate`, `capCandidate`),
  `acceptor` rejects those whose square overlaps bodies or breaks a doorway, `nearest` picks by distance to `base`.
  Zones by the cursor position relative to the wall strip: in the strip beyond the end — cap; outside the strip —
  face (clamped to the open interval, shrunk by `endShrink`).
- Display is in `src/wall-geometry.ts` (`displayPolygons`, `endShape`, `faceCornerAt`, `capExtension`). The
  "corner joint on a face" pairs two ends one diagonal apart but requires exactly one wall to abut
  (`wallAbuts === partnerAbuts` → null). Both ends in our case project outside the neighbour, so it returns null.
- Moving and editing (`geometry.ts`, `edit-plan.ts`, `ortho-stretch.ts`, `tee-bounds.ts`, `ruler.ts`) treat an end
  within `faceCornerTol(a, b)` of another end as joined. The diagonal pair is at exactly that distance.
- Wall data (axes, thickness, order) is the only input of the display; the fill must not change it.

## Goals / Non-Goals

**Goals:**
- A snap target for the corner of a free cap that yields the vertex `S` (on the face line, `hN` beyond the cap plane).
- A display rule that closes the L-corner for the pair (A, B) without changing data.
- Reuse the existing distance/tolerance and "no other ends nearby" logic of the face-corner joint.

**Non-Goals:**
- Diagonal snap for the second (end) vertex of a gesture and for ray snapping (`snapOnRay`).
- Non-right angles, corners of two joined walls, concave corners.
- Moving walls such that the pair stops being an L (no special handling beyond the existing tolerance).

## Decisions

### D1. Candidate in the quadrant behind the cap corner
`wallCandidates` gets a branch for the cursor outside the strip, beyond the cap plane (`s > len` or `s < 0`):
for the corner on the cursor's side build a `Candidate` of a new kind `"corner"` with `point = base = K + out * newHalf`,
where `K = end + n * side * hW` is the cap corner and `out` is the outward direction of the cap, and
`normal = n * side` (outward from the face). `squareOnSide(base, normal, size)` then already yields the right
square: its attached side is centred on `base` and lies on the face line, spanning `newHalf` to each side, so the
square touches `K` with its corner. No new square builder is needed; `placementSquare` and `chainEndSquare` work
through `base`/`normal` as for faces. The cap must be free (`freeCap`). The candidate goes through `acceptor`
unchanged (overlap, doorways) and has priority over `faceCandidate` of the same wall in the far part of that quadrant: the corner candidate is built only when both offsets from the corner — along the wall (`beyond`) and across the face — are at least `cornerZone / 2` and at most `cornerZone` (decided with the user: the near part of the quadrant keeps the existing flush-with-end face snap, which approved tests SNAP-END-3, CV-BAND-1 and SNAP-SCALE-1/2/3 pin at offsets of 4 cm). The four zone comparisons (`Z/2` and `Z` on each axis) use the small tolerance `SLICE`: a wall rotated by 30° or 60° puts a boundary cursor a few 1e-15 below the limit, and the spec says the boundaries are included.
Alternative: a distance-based tie-break with the face candidate — rejected, the face candidate clamped to the end
sits next to the diagonal one and would win unpredictably near the quadrant boundary.

`SnapTarget` gets a third value `"corner"` (`VertexSnap.target === "corner"`), so the chain-end/preview code can tell it from a face; `normal` is the outward face normal `n * side` and `base` equals `point`.

`StartRef.kind` is `"face" | "cap"`: `startRefOf` maps a `"corner"` snap to the `"face"` reference (normal = the face normal), so ortho offers exactly the perpendicular-from-face direction that closes the corner.

The corner target is offered for the first vertex only. `snapVertex` has a `corners` parameter that defaults to `true`, because the existing approved test GS-10 requires `snapStartVertex` to equal `snapVertex` wherever the base snap hits a wall; `chainSegment` (second vertex) passes `false`, and the ray snap (`snapOnRay`) has no corner candidates, so both keep the old rules. In `snapStartVertex` the touched-grid fallback calls `wallCandidates` with `reach = Infinity`; the corner candidate must still respect its own zone there (per axis, spec «Диагональное прилипание»), otherwise far cursors whose grid square touches the wall would get a corner snap.

### D2. Joint classification next to `faceCornerAt`
A new function (e.g. `diagonalCornerAt`) in `wall-geometry.ts`: right angle (`RIGHT_SIN`), both ends project
outside the neighbour (`wallAbuts` and `partnerAbuts` both false), the axes' crossing `I` lies behind both
ends, each of the two distances `E→I`, `S→I` within 1 cm of the other wall's half-thickness (per the spec; a per-wall
check, not the single `faceCornerTol` bound on `|S−E|`). It reuses the "no other ends nearby" idea of
`partnerEndOf`, but its search radius must cover the largest accepted `|S−E|` (`√((hA+1)² + (hB+1)²)`), which can exceed
`faceCornerTol` (a pair shifted by 0.99 cm on both axes is closed though `|S−E| > faceCornerTol`). The pair is
not a vertex (ends farther than the vertex tolerance). The move/edit code keeps using `faceCornerTol` for "joined
ends"; that stays stricter only in this corner case. `faceCornerAt` is left as is; the display tries it first, the
diagonal rule applies only when it returns null.

### D3. Ownership: the later wall extends its end
Default chosen here (to confirm): the block belongs to the later wall in the array — its end gets a rectangle
extension (B: back by `2·hA`; if A is later: A's cap forward by `2·hB`). Same ownership mechanism as the face
corner extension (`capExtension` family): hatched by its material, highlighted, deleted and hit-tested with
the owner. It also makes undo/delete of the new wall remove the fill. Alternative — always A (the first,
"through" wall) owns it; rejected as default because deleting the later wall would then change the earlier one's
shape through a joint that no longer exists, and the spec's "later wall fills" precedent for wedges.

### D4. Preview
The preview segment already uses `displayPolygons` with the preview wall appended (`walls.includes(wall) ? … :
[...walls, wall]` in `faceCornerAt`); the new classification uses the same `scene` handling so the preview shows
the closed corner without extra rendering code.

### D5. Direction
No new direction rule. Ortho from a start attached to wall A already offers directions along/perpendicular to A;
the fill is a pure function of the final geometry, so a non-perpendicular direction simply yields no fill.

## Risks / Trade-offs

- **Unwanted fills.** Any pair at diagonal distance that happens to satisfy the geometry is closed, including
  hand-drawn ones; the conditions (right angle, crossing point behind both ends, no other ends) make this narrow.
  Parallel-offset pairs and walls going toward the neighbour are explicit negative scenarios.
- **Joint recognition under drift** (see TODO.md: T-stem bug). The tolerance is the same 1 cm margin as the
  face corner; a pair that drifts out simply loses its fill, data stays valid.
- **Moves.** Move/stretch code treats the pair as joined via `faceCornerTol`; behaviour for a diagonal pair
  (does moving A drag B?) must be verified by tests, not assumed.
- **Spec relaxation.** The ban on corner-to-corner snapping is narrowed for free caps; the scenario for
  the outer corner of an L stays valid.
- **Performance.** One more candidate per wall in a quadrant and one more joint check per end; negligible next to
  `sceneContour`.

## Migration

None: no data format change. Existing drawings are re-displayed by the same rules; a drawing that already
contains a pair satisfying the new joint conditions (e.g. a hand-drawn diagonal L) will start to show the corner
closed.
