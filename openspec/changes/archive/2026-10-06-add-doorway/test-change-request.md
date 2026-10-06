# Test Change Request — add-doorway

Raised during implementation (task 6.4), 2026-10-06. Approved tests were not modified.

## DP-03 — `src/doorway/doorway-pdf.test.ts` «габариты чертежа учитывают подпись высоты»

**Current assertion**

```ts
const plain = wallsBBox([W], [], 0)
const withLabel = wallsBBox([W], [], 0, [d])
expect(withLabel.maxY).toBeGreaterThan(plain.maxY)
```

W is a free wall `(0,0)-(500,0)` with no room on either side.

**Why it no longer represents the specification**

- Spec doorway «Отображение проёма» (wording settled by the user in test revision 3): without a room, the height label is placed on the face that is **left on screen** of `a → b`. That is the normal `(d.y, −d.x)` side, here `y < −10`. The new scenario «Подпись без помещения — слева на экране» says the same for exactly this wall.
- So the label extends the bounding box **upward**: `minY` decreases and `maxY` is unchanged. DP-03 still encodes the earlier convention (label on `y > 10`). It was missed when DL-03c and DL-03e were flipped in revision 3.
- With the implementation that matches the spec (and passes DL-03c), DP-03 fails: `expected 10 to be greater than 10`.

**Proposed change**

```ts
expect(withLabel.minY).toBeLessThan(plain.minY)
expect(withLabel.maxY).toBe(plain.maxY)
expect(withLabel.minX).toBe(plain.minX)
expect(withLabel.maxX).toBe(plain.maxX)
```

This keeps the strength of the test, adds the opposite side as an exact check, and aligns DP-03 with DL-03c. After the change, the modified test needs re-validation (CLAUDE.md Rule 5, step 5).

## Resolution

- 2026-10-06: approved by the user («Apply TCR + revalidate»). DP-03 was changed exactly as proposed above (`minY` grows, `maxY`, `minX`, `maxX` unchanged), with a comment that cites the spec. No other test was touched.
- Re-validation of the modified test: PASS (fresh validator, section «Re-validation (DP-03)» in test-validation.md).
