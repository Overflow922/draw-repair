# Test Validation: demolition-drag-only

Validator: fresh context, read-only in the repo; experiments in the scratch copy C:\Temp\ddo-val (src copy, node_modules junction). One round.

## Baseline

- Scratch copy, whole suite: 128 files, 2825 tests passed. The repo had 127 files / 2813 tests when the caller ran it; the scratch copy has one extra file and 12 extra tests, which I did not trace. The result is green either way.
- `tsc --noEmit`: exit 0.

## TCR-1 assessment (comparison with HEAD)

Production diff: only the click branch of `up` is removed (`placed = drag && to - from >= MIN_WIDTH_CM ? place(...) : null`). It matches the spec text: click and sub-1-cm drag create nothing, the dead zone is kept, `place` is unchanged.

| File | Change | Verdict |
|---|---|---|
| demolition-tool.test.ts | TL-01 x4, TL-02, TL-11 (the `wholeDrag` / `dragUp` helper): click replaced by an end-to-end drag with the same oracles (0-500, 1 history record, order, absorbed marks, redraw). TL-06 x4: "click, whole wall" became "nothing created" (+ `record` = 0 in the first). TL-22 and the selection tests (clickUp to dragUp) get the same replacement. | Minimal, justified. Oracles on the result are kept. The only assertions that changed are those that encoded "click marks the wall". |
| demolition-sections.test.ts | SW-21 x4, SW-20 x3: click replaced by a drag along the clean section. Oracles changed 295-500 to 350-500, 300-500, 50-200, 320-500, because a drag marks the dragged part rather than the whole section. SW-22 extended with a click on the clean section. SW-31: the click variant became "click creates nothing and does not touch the hidden mark". | Justified. The oracle shifts follow from the new semantics (the span is the dragged one). The reduced boundary check (295/305) is still covered by the SW-2x drag tests ("протяжка" describe, unchanged). No assertion is weakened beyond what the spec requires. The blank line before `describe("протяжка")` was removed (cosmetic). |
| demolition-windows.test.ts | NW-12 x2, NW-13: click replaced by a drag from end to end; the assertions are the same. | Minimal. |
| demolition-eraser.test.ts | SZ-41: "click marks the whole wall" became "click changes nothing" (null, marks equal m1, no selection, record 0). | Justified (spec scenario "Клик по неснесённой части стены с пометкой"), and it is a stronger assertion than before. |

No other existing test file was touched; `git status` shows only these four plus the new file. No coverage removed: every converted test keeps an equivalent positive check (by drag) and gains a negative one (by click).

## Scenario coverage (delta spec)

- Клик помечает стену целиком (now: nothing), Повторный клик, Клик по неснесённой части с пометкой, Клик мимо стены, Клик по чистому участку стены с окном: DO-01, SZ-40/41, SW-22 (automated).
- Протяжка помечает участок, вне оси, за конец стены, Слияние, Числа правятся, Снятие выделения, Выбор другого инструмента, Выбор другой пометки: unchanged existing tests (TL-*, selection tests). The tool-level reselect behaviour lives in main.ts and was not changed.
- Слишком короткая протяжка: DO-02, TL-06 (automated).
- Протяжка от конца до конца: DO-03, DO-04, TL-01 (automated).
- Железобетонная стена, Escape: DO-02 and the existing TL tests.
- "Инструмент остаётся активным" after a click or rejection: tool-level this means `up` returns null and nothing is selected or reset (covered). The toolbar wiring is manual (MAN-01).
- Manual: MAN-01 only.

## Mutation testing

17 mutants of demolition-tool.ts against src/demolition + src/export, with the new and modified tests included in the run.

| # | Mutant | Result |
|---|---|---|
| M1 | click places the range when no mark is hit (the old code) | killed (12) |
| M2 | click always places the range | killed (19) |
| M3 | a drag shorter than 1 cm places the whole wall | killed (3) |
| M4 | the `drag` flag ignored | killed (3) |
| M5 | min width 0 | survived, equivalent |
| M6 | min width > 0.01 | survived, equivalent |
| M7 | min width 2 | killed (2) |
| M8 | drag = `dragging` only (no distance fallback in up) | survived, non-critical |
| M9 | drag = distance only | survived, equivalent |
| M10 | dead zone ignored in up (drag = true) | killed (3) |
| M11 | dead zone 0 in move | killed (2) |
| M12 | no-op rewrite of bounds | survived, equivalent by construction |
| M13 | clamp to the clean range replaced by the whole wall | killed (3) |
| M14 | a placed mark is not selected | killed (15) |
| M15 | click selects the mark under the cursor | killed (3) |
| M16 | click removes the mark | killed (7) |
| M17 | click on a window wall places a 1 cm mark | killed (15) |

## Surviving Mutations

- M5 and M6: `addMark` (marks.ts:84) repeats the same `hi - lo < MIN_WIDTH_CM` guard, so the guard in `up` is redundant. The behaviour is identical and covered through M7. Equivalent.
- M9: when `dragging` is true the screen distance already exceeded the dead zone. A drag that returns to within the dead zone gives width < 1 in any case. Equivalent for observable behaviour.
- M12: no-op. Equivalent.
- M8: in `up`, `drag` is also true when the pointer travelled beyond the dead zone without a prior `move`. No test calls down and up far apart without a move. In the real UI a move always precedes up. Non-critical; if wanted, add a down-then-far-up test. It is not required by the spec.

No survivor on specified behaviour.

## Observations

- `up`: `bounds` is computed for every release, including clicks, and is only used when `drag` is true. A harmless extra computation. A leftover import check shows `markAt` remains used by `select`, `erase`, `eraseTarget`, so there is no dead import (tsc is green).
- The spec scenario names "Клик помечает стену целиком" and "Повторный клик снимает пометку" still carry their old titles while their text says the opposite. This is a naming leftover in the delta, not a defect in the tests.
- The user-facing hint that a zone must be stretched is out of scope (TODO.md).

## Repo state

`git status --short`: M TODO.md, M demolition-tool.ts, M the four test files; untracked openspec/changes/demolition-drag-only/ and demolition-drag-only.test.ts; stray bash.exe.stackdump, img.png, img_1.png; img_2.png staged by the user. This matches the expectation. The validator wrote only this file.

VERDICT: PASS
