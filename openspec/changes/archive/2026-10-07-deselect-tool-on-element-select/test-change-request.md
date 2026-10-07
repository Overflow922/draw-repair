# Test change request

## Test

`src/doorway/popups-ui.test.ts` — `PB-GR-02: переходы группы — только кнопка группы и выбор в панели; реакции на выделение нет`
(approved in the archived change `popups-buttons-only`).

```ts
expect(Object.keys(group).sort()).toEqual(["groupButtonActive", "groupButtonClick", "groupPick"])
expect(main.includes("groupSelect")).toBe(false)
```

## Conflict

The first assertion pins the exported names of `src/doorway/openings-group.ts` to exactly three. This change
(design D2a, tasks 1.1) adds the pure transition `afterElementPress` and the type `Tool` to that module, and the
approved tests of this change (`src/doorway/element-select-tool.test.ts`, DS-1…DS-5, validated `VERDICT: PASS`)
import `afterElementPress` from `./openings-group`. Both approved tests cannot pass at once.

The test title also says «реакции на выделение нет», which was true under the earlier spec («Выделение проёма или
двери НЕ ДОЛЖНО менять активный инструмент»). The spec is now changed on purpose
(`specs/canvas-app` «Панель группы «Проёмы»», `specs/doorway` «Выделение проёма кликом»): selecting an element
while a placing tool is active deactivates the tool.

Observed after implementation: `npx vitest run` → 1626 passed, 1 failed (this test); the new suite is 16/16.

## Why the approved test no longer represents the specification

The invariant it protects — the group module has no selection-reaction state (`groupSelect`) and the group button
logic is unchanged — still holds: `groupButtonActive`, `groupButtonClick`, `groupPick` and the second assertion
(no `groupSelect` in `main.ts`) are untouched. Only the exact export list and the title are outdated.

## Proposed resolution (needs a decision; not applied)

Option A (recommended): update PB-GR-02's list to
`["afterElementPress", "groupButtonActive", "groupButtonClick", "groupPick"]` and rename it to say that the only
reaction to selection is the pure `afterElementPress`; keep the `groupSelect` assertion. Then re-validate.

Option B: move `afterElementPress` and `Tool` to a new module (e.g. `src/doorway/element-press.ts`), which needs
changes to design D2a and the import lines of `element-select-tool.test.ts`, then re-validation of that suite.

Neither test file was modified.

**Resolved 2026-10-07:** the user chose Option A; `PB-GR-02` updated and re-validated (PASS).

---

# Test change request 2

## Test

`src/doorway/door-direction.test.ts` — `PB-ZN-02: границы зон — внутри у краёв, снаружи сразу за ними`
(approved in the archived change `popups-buttons-only`).

## Conflict

The `outside` list contains `{ x: 99.5, y: 50 }` and `{ x: 190.5, y: 50 }` and expects `doorZoneAt` to return `null`.
The user decided (2026-10-07) that clicking the dashed shadow of a direction sets that direction, and chose the whole
swing sector as the click area (`specs/door` «Направление выделенной двери», design D6). For door W (axis (0,0)→(500,0),
thickness 20, attach a/100, width 90), `(99.5, 50)` is 40 cm from the a/right hinge `(100, 10)` at about 91° to the
closed position — inside the a/right sector; `(190.5, 50)` is the mirror point for b/right. Both are inside zones by
design now.

Observed: `npx vitest run src/doorway` → 453 passed, 1 failed (this test). The new suite
`src/doorway/door-shadow-zone.test.ts` passes 10/10.

## Why the approved test no longer represents the specification

It states that points just beyond the jamb line are outside every zone. That held for rectangle-only zones; with the
sector, the area just beyond the hinge-side jamb is part of the shadow. The rest of the test (inside points, mid-door,
wall body, the outside points at `y = ±100.5`, `(170, 9.5)` and `(170, 120)`) stays valid.

## Proposed resolution (needs approval; not applied)

Replace only the two outside points with points beyond both the rectangle and every shadow: `{ x: 85, y: 50 }` and
`{ x: 205, y: 50 }` (each about 11 cm from the nearest leaf line, beyond 95°). Keep every other assertion. Then
re-validate.
