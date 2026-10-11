# Test change review: plan-title-strip

Reviewer: independent, read-only (only this file was created). Scope: the edits to approved tests listed in `test-change-request.md`, checked against `specs/pdf-export/spec.md`.

## Summary

All edits are number updates forced by the spec (frame height H-10, strip 10 mm, title block 55 mm, so area height H-75 and area y = 15) or a filter update for the new title text. None of them weakens protection: every boundary test is still boundary-exact (exact fit plus 0.1 mm over), and the mutants tried were killed. `npx vitest run`: 3271 / 3271 passed. `npx tsc --noEmit`: no errors. `git diff HEAD --stat` for non-test source: only `sheet-layout.ts` and `sheet-draw.ts` (plus untracked change artifacts and `plan-title-strip.test.ts`).

Arithmetic: area height = H_page - 10 - 10 - 55 = H_page - 75. A4 landscape (210): 135; A3 (297): 222; A2 (420): 345; A1 (594): 519; A0 (841): 766. Area y = 5 + 10 = 15. Matches the spec ("272x135 mm, from y=15 to y=150").

## Per-edit verdicts

| File | What changed | Verdict | Reasoning |
|---|---|---|---|
| sheet-layout.test.ts | DA-1, DA-2: y 15, 272x135, H-75 | OK | Exactly the spec numbers; the checks "area bottom = title block top" and "right edge = frame right" are untouched. |
| sheet-fit.test.ts | DA-5/6/7 145 -> 135 | OK | Boundary kept exact: fits at 272x135, fails at +0.1 on width and on height. |
| sheet-fit.test.ts | per-format limits 232/355/529/776 -> 222/345/519/766 | OK | Match the arithmetic above; still tested at the limit, +0.1 width and +0.1 height. |
| sheet-fit.test.ts | world-coordinate independence (maxY 845 -> 835) | OK | Height 135 exactly, still true / false at width +0.1. |
| sheet-fit.test.ts | invariants `sizes` list | OK | `[272,135]`, `[100,136]` (just over), `[390,220]` (just under A3 222) keep the same relation to the new limits as before; the 600x360 / 1000x700 / 1200x800 entries are unchanged and still straddle the formats. The check of the four sides inside the area uses `drawingArea`, so it follows the new y. |
| sheet-fit.test.ts | PL-2, DA-3 (20; 15) | OK | Centering formulas keep their form, only y and h change. |
| sheet-fit.test.ts | DA-4: 140 -> 130 | OK | Same 5 mm slack under the area as before (area 135 vs 130; before 145 vs 140); still checks centering on both axes and no entry into the title block. |
| legend-area.test.ts | AR-1, AR-2, AR-5, AR-6 | OK | Same pattern as above; AR-5 still checks width +0.1 and height +0.1. |
| legend-area.test.ts | FM-2: A3 expectation 75 -> 100 | OK | Wall 1600 + thickness 20 = 1620 cm; at 1:75: 1620/7.5 = 216 + 10 mm margin = 226 > 222, does not fit; at 1:100: 162 + 10 = 172 <= 222, fits. A4 still 200 (1:100 gives 172 > 135; 1:200 gives 91). The title text states the reason and the old 232 limit is gone. |
| pdf.test.ts | centering offsetY 15 + (135-25)/2 | OK | Same formula, new area. |
| pdf-pages.test.ts | PG-10 intersection: vertical(200) -> (190) | OK | 190 + 30 = 220 <= 222 (fits A3), > 135 (excludes A4); 200 would give 230 > 222 and would remove A3, changing the meaning of the test. |
| pdf-pages.test.ts | PG-11 height boundary: vertical(105) / 105.1 | OK | Scale 10: wall length 105 cm = 105 mm + 20 mm thickness + 10 mm margin = 135 mm exactly (the helper comment "L+30"); 105.1 gives 135.1. Boundary-exact, the expectations `ALL` and `NOT_A4` unchanged. |
| mounting-pdf.test.ts | MP-90 "own dimensions": N wall y 100 -> 50 | OK (minor note) | `near` must still fit A4 (the 10 mm lower area would otherwise reject it at y = 100), while `far` (offset 3000) still must not. Mutant "page dimensions ignored in the bbox" (pdf.ts `wallsBBox(page.walls, [], ...)`): killed, 4 tests fail including MP-90 "собственные размеры третьей страницы входят в габариты" (far would fit A4 with walls only: 50 + 30 = 80 <= 135). Note: `near` is now a looser fit than before, so the test no longer detects a mutant that over-counts the near dimension slightly; it did not detect that before in a stricter sense either (no boundary assertion on dimensions). Not weakened in the sense of the test's stated purpose. |
| legend-pdf.test.ts | `legendTextsOn`: added `t.y >= col.y - TOL` | OK | Needed: the plan title is at x = 23 (inside the column x range 20 .. area.x) and y ~ 11.75 < 15, so without the lower bound it would leak into the legend lists. The lower bound cannot hide legit legend texts: legit texts lie in the column (y >= 15). Misplaced legend text above the column would disappear from the list, but the tests that use it compare the full list (`toEqual([...])`, `.join(" ")`, count, first/last entries), so such a regression still fails; the explicit `t.y >= col.y - TOL` asserts inside LG-10/LG-11 loops became redundant (vacuous) but are harmless. Mutant "legend drawn 10 mm higher" (legendArea y-10 in pdf.ts): killed, 15 tests fail (LG-1, 3, 4, 5, 6, 7 ...). |
| plan-title-strip.test.ts | removed unused helper `at` | OK | Untracked new test, not an approved test; expectations unchanged. |

Additional mutant: `PLAN_STRIP_H_MM = 9` fails 41 tests (AR-1, AR-2, AR-5, AR-6, PG-11, pdf centering, ...): the numeric tests are sensitive to the strip height.

## Problems found

1. Stale comment (cosmetic, not a protection issue): `src/export/pdf-pages.test.ts`, in the `formatsAt` describe, comment still says "область A4 - 272x145, A3 - 395x232". Should read 272x135 / 395x222. The comment is in an approved test file, so fix it through the same test change (comment only, no behavior).
2. `legend-pdf.test.ts`: the `t.y >= col.y - TOL` asserts in LG-10 and LG-11 are now vacuous because of the filter. Optional: no action required, coverage is held by the list equality assertions.
3. Housekeeping: `git status` also shows ` M TODO.md` (modified before/independently of this review; this reviewer did not touch it) and the staged `img*.png` files from before the change, which are not part of it.

No WEAKENED verdicts, no open QUESTIONs.

REVIEW: APPROVED
