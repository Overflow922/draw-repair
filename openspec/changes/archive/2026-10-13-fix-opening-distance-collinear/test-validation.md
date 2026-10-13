# Test Validation (round 2)

Method: fresh context. Tests discovered by vitest: 61 in 2 files (28 + 33). On the unchanged production code 49 fail (assertion failures) and 12 pass, matching test-suite.md. A throwaway reference implementation of design D1-D4 was written in a scratch copy outside the repository: chain of same-material collinear continuations at both host ends, cut at the first different-material joint (vertex of the joint projected on the host axis), a third wall ending in the joint does not stop the chain (only walls that are collinear and lead away count as continuations; zero or more than one candidate stops the chain), probe segment extended by the chain length, free intervals clipped to the host `[0, len]` in `freeIntervals`, exported `faceRuns` unchanged.

Reference results:
- 61 of 61 new tests pass (including CD-26/26b three-end joint, CD-27..CD-31 end `b`, strengthened CD-16c).
- Whole existing suite on the reference: 177 files, 3934 tests, all pass (3873 existing + 61 new). No existing approved test conflicts with the spec or the reference; no existing test was broken.

## Requirement Coverage

- PASS. Every scenario of the delta spec has executable coverage with exact values: through same material (CD-1/2/3/20), different material (CD-4/4b/5), input too large (CD-7/8/8b), input smaller than to host start (CD-9/10), partition at the joint on both sides (CD-26/26b, 140 / 410 / 390), no change without continuation (CD-11/12). The clauses "host stays", "not limited by reach" (CD-16, 2000 cm continuation) and "number shows actual value" (CD-19b) are covered. Round-1 finding 1 (three-end joint) is now decided in spec and design and pinned by CD-26/26b.

## Boundary Coverage

- PASS. 569/570/571, 239/240/241, 0, right 0, gap 5 cm, 2.4 degrees, thickness step; the upper boundary `len` is now exercised on CKb by CD-27/27b/27c (setDistance toward a and b), CD-28/28b (slide, arrow), CD-29/29b (width), CD-30 (ghost), CD-31 (invariant loop, three kinds). Round-1 finding 2 is fixed.

## Negative Cases

- PASS. Negative/NaN input (CD-24), no-change without history record (CD-23, CD-13b, CD-28b, CD-29b), near-collinear joint (CD-6b), partition on the continuation (CD-16b), three-end joint (CD-26/26b), duplicate and reversed duplicate wall (CD-16c).

## Error Handling

- PASS. Invalid input rejected as `invalid`, repeated equal input as `no-change` (CD-23, CD-24).

## Invariants

- PASS. CD-22/22b (CK) and CD-31 (CKb) check `wallId`, `j1 >= 0`, `j2 <= len`, width and `doorwayHolds` over 11-14 values, both faces, both directions, three kinds. CD-2 checks three wall orders.

## State Transitions

- PASS. CD-19 repeated edits with history record count and `record`/`replace` order.

## Integration Behavior

- PASS. Rendered numbers (CD-18/18b), `editableNumbers` + `numberAt` (CD-3), `createSelectionEditing` cycle (CD-19/19b), doorway/door/window (CD-17/17b/22/31).

## Implementation Independence

- PASS. Expected values come from scene geometry and spec, public functions only; the system under test is not mocked.

## Assertion Strength

- PASS (minor notes, not blocking). CD-6c accepts 150..155 (spec does not define the gap case; documented). CD-6 gives the same answer for "break by type" and "break by geometry", but CD-4/4b/5 discriminate the material criterion (thickness mutant killed by 9 tests). The CD-22/31 loops skip non-applied results, but the specific tests CD-7..CD-10, CD-27 assert exact values for the same inputs. CD-16c now compares with the scene without the duplicate for same, reversed and both duplicates.

## Mutation Testing

Hand-made mutants of the reference (environment switch or sed in the scratch copy), run against the 61 tests. Production code in the repository was not touched.

## Surviving Mutations

| Mutation | Expected Failing Test | Result |
|---|---|---|
| Visited-wall set removed from chain walk | CD-16c | SURVIVED, equivalent: in the reference the direction test already rejects same-direction and reversed duplicates (no cycle can be built); with direction test AND visited set both removed, 3 tests fail (CD-16c) |
| Material criterion inverted | CD-1, CD-2, CD-4... | killed (31) |
| Always through / always break | CD-4, CD-4b, CD-5... / CD-1, CD-2... | killed (9 / 28) |
| Material criterion compares thickness | CD-4, CD-4b, CD-5, CD-15b, CD-17, CD-18b | killed (9) |
| Chain extension capped by `reach` (original bug) | CD-1, CD-2, CD-7... | killed (27) |
| Chain stops at a joint with three ends | CD-26, CD-26b, CD-16b | killed (3) |
| Chain only at end `a` | CD-15, CD-15b, CD-27... | killed (4) |
| Chain only at end `b` | CD-1, CD-2, CD-4... | killed (23) |
| Boundary by far end of neighbor body | CD-4, CD-5, CD-6c, CD-15b... | killed (8) |
| No host clamp in `freeIntervals` | CD-9, CD-10, CD-13, CD-25... | killed (24) |
| Clamp without upper bound | CD-27..CD-31, CD-22... | killed (11) |
| Clamp without lower bound | CD-9, CD-10, CD-13... | killed (13) |
| Clamp widened to `[-reach, len + reach]` | same as no clamp | killed (24) |
| Displayed value = typed value | CD-19b, CD-1, CD-3 | killed by construction (distances recomputed from geometry) |
| `setDistance` anchor not updated (always old anchor) | CD-10c, CD-19, CD-27b, CD-27c | killed (4) |
| History record skipped in selection editing | CD-19 | killed (1) |
| History record duplicated / replace duplicated | CD-19 | killed (1 each) |

No important mutant survives. The only survivor (visited set) is equivalent given the direction test, and the ring requirement is still pinned by CD-16c against the combined mutant.

## Findings

1. Round-1 demands are adequately fixed: three-end joint decided in spec/design and covered by CD-26/26b with exact values (and the 171 artificial cut would fail them); edit behavior at end `b` is covered by CD-27..CD-31 and kills the "clamp without upper bound" mutant; CD-16c compares against the scene without the duplicate for same, reversed and combined duplicates.
2. The repository was checked after the run: git status shows only the expected untracked change files; nothing else modified.
3. Note for implementation: the reference accepts a gap-joint boundary at either side within 150..155 (CD-6c); implementation should choose the joint vertex per design.

VERDICT: PASS
