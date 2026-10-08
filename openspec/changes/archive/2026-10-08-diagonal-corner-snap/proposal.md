## Why

Real dimensions are usually known for the inner corner of a room (inner faces), not for wall axes. To draw
an inner corner today the user draws the first wall up to the inner corner, then adds an auxiliary
"stub" wall as long as the neighbour is thick to fill the corner block, and only then continues with the
second wall. The placement square cannot touch the end of a wall with its corner: the spec explicitly forbids
corner-to-corner snapping, and the existing "corner joint on a face" closes a corner only when exactly one
of the two walls abuts the other.

## What Changes

- The placement square can snap diagonally to a corner of a free wall end (cap): it touches the cap's corner
  point and lies beyond both the cap plane and the face. The vertex is on the face line of the existing wall,
  half of the new thickness beyond the cap plane — so inner dimensions can be typed directly from the inner corner.
- Two perpendicular walls whose ends sit one corner diagonal apart (the second wall going away from the face)
  are displayed as a closed L-corner: the corner block that the auxiliary stub used to fill is filled
  automatically, display only — axes, lengths and wall data are unchanged.
- The preview of the second wall shows the filled corner block before the second click.
- The ban on corner-to-corner snapping is relaxed for free caps; other corners keep their rules.
- The existing flush-with-end snap beside a wall end is kept unchanged: the diagonal snap only takes the far part of the corner quadrant (at least half the snap zone past the end plane and past the face on each axis, at most the zone), so the cursor near the corner keeps today's behaviour. Decided with the user after the conflict with approved tests SNAP-END-3, CV-BAND-1, SNAP-SCALE-1/2/3 showed up.

## Capabilities

### New Capabilities

None.

### Modified Capabilities

- `wall-drawing`: new snap target "corner of a free cap" (square touching the cap corner diagonally); the
  requirement forbidding corner-to-corner snapping gets an exception for free caps; direction of the next wall.
- `wall-joints`: new joint "diagonal corner" (two perpendicular walls, ends one corner diagonal apart,
  neither abutting the other) that fills the corner block for display.

## Impact

- `src/wall-snap.ts` (new candidate for free caps, accepted/blocked by the existing overlap and doorway checks).
- `src/wall-geometry.ts` (new classification next to `faceCornerAt`, `displayPolygons`, contour/outline).
- `src/render.ts` / preview of the chain end square (corner block in the preview).
- Moving and editing walls (`geometry.ts`, `edit-plan.ts`, `ortho-stretch.ts`, `tee-bounds.ts`, `ruler.ts`)
  already treat ends within `faceCornerTol` as joined; the change must keep the diagonal pair joined and must
  not make unrelated diagonal pairs (e.g. parallel walls offset by the same distance) count as corners.
- Constraint: wall axes, lengths and stored data do not change (`wall-joints`, "Оси и длины не меняются").
- Open: which wall owns the filled block (see design).
