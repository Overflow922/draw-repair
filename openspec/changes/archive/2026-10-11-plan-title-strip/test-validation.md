# Test Validation: plan-title-strip (round 2)

Validator: fresh context, read-only on the repo (only this file written). Experiments only in the throwaway copy `C:\ref-auto-fit` (reference implementation over auto-fit-scale, with the reworked 41-test file; all 41 pass there, re-checked after the mutant runs: the copy was restored byte-for-byte after each mutant).

## Summary

The reworked `src/export/plan-title-strip.test.ts` (41 tests) now protects the delta spec strongly. Both round-1 majors are fixed and killed by new mutants: placement of the chart under the strip (S-15 centering on A4 and A1 against the NEW area) and the "no lines" scenario (S-06 now rejects any axis-aligned stroke inside the strip, a rectangle around the title, and a line along the lower border). 35 mutants over geometry, placement, legend, title text and lines were tried in this round: 29 killed, 6 survived (2 equivalent or spec-silent, 4 minor gaps listed below). No critical or major findings remain.

Whole-suite checks:

- REAL repo, `npx vitest run` (nothing modified): 13 red files, 115 failed / 3177 passed (3292). `plan-title-strip.test.ts`: 37 failed, 4 passed (S-20, S-15 A4, S-15 A1, S-18 - exactly the "unexpected passes" listed in test-suite.md). The other 12 red files are exactly the pending auto-fit-scale test-change-request set: mark-storage (3), demolition-dimensions-pdf (3), demolition-pdf (7), legend-area (8), mounting-pdf (3), page-format (5), pdf (6), pdf-pages (16), sheet-fit (8), storage (6), storage-plans (11), types (2). 37+78 = 115; no other failures.
- Reference copy, whole suite: 109 failed / 3183 passed. `plan-title-strip.test.ts` is green (not in the red list). Extra red vs the real repo: `legend-pdf.test.ts` (10), `sheet-layout.test.ts` (5, DA-1/DA-2), and larger counts in `sheet-fit` (8 -> 18), `legend-area` (8 -> 13), `pdf.test` (6 -> 7). This matches the "existing tests in conflict" list of test-suite.md (sheet-layout DA-1/DA-2; sheet-fit DA-5, PL-2, DA-3/DA-4 and boundary tests; legend-area AR-x; legend-pdf LG-x; pdf.test centering). Counts in the claim: 41 tests, 4 passes-before (S-20, S-15 x2, S-18) - confirmed.

## Requirement -> test coverage

| Requirement / scenario | Tests | Assessment |
|---|---|---|
| Полоса: геометрия (x=20, y=5, ширина рамки, h=10) на A4-A0 | S-01 x6 | strong (width, height, A0-only height mutants killed) |
| Название в левом верхнем углу (кегль 5, x=23, left, по центру полосы) | S-02/S-03 | strong (baseline pinned to 0.35*font, tol 0.05 mm; x, size, align) |
| Название у каждой страницы своё; совпадает с графой 5 | S-04, S-22 | strong (first-page-only, dropped graph 5 killed) |
| Страница без стен: название есть, легенды нет | S-05 | strong |
| Страница вне плана: полоса сохраняется, названия нет | S-20 | strong for "no text" (default-title mutant killed); the area part of the name is no longer asserted (area never depends on a page) |
| Полоса не рисуется линиями | S-06 | strong for axis-aligned lines, rectangles, lines along y=14..16; diagonals not checked (m2) |
| Размеры не зависят от формата и масштаба | S-07/S-08 (A4/A0/A2), S-01, S-14 | strong |
| Длинное название внутри рамки | S-09 | strong (missing right padding killed; "only left pad" variant ends exactly at the frame edge = spec-conformant, equivalent) |
| Область начинается под полосой; легенда и область на одном уровне | S-10 x7 (geometry incl. x/w/h), S-10/S-11 (drawn first entry), S-21 | strong |
| Область A4 (без легенды / с легендой W) и A3-A0 | S-12, S-13, S-14 | strong, exact values |
| Чертёж не пересекает рамку, полосу, надпись; центрирование в новой области | S-15 x3, S-21 | strong (placeOnPage old area / +1 mm / top-aligned / ignores legend all killed) |
| Граница области, высота ограничивает масштаб | S-16, S-17, S-15 | strong (+0.5 mm and +10 mm height mutants killed) |
| Нет стен нигде | S-19 | strong |
| Легенда помещается по высоте | S-18 | weak guard by design (m4) |

## Findings

### Critical
None.

### Major
None.

### Minor

m1. The drawn legend column x is not asserted in the new file: mutant P3c (legend drawn 2 mm to the right) survives. `legendArea` x/w are now pinned (S-10, mutant L2 killed), and drawn-label x belongs to unchanged legend behavior covered by `legend-pdf.test.ts`. Optional fix: in S-10/S-11 also assert the x of the first label equals the pre-change value.

m2. S-06 ignores diagonal segments (documented in the test: legend hatching leaves clipped contours in the parsed stream). A diagonal line inside the strip survives (D6d). Implausible as an implementation error; optional fix: also reject diagonal segments whose both endpoints lie inside the strip and whose width is the thin-line width and which are not hatch segments (needs a hatch filter), or leave as is.

m3. Title font family and weight are not asserted (mutants "helvetica" and "bold" survive). Spec says «текстом PTSans». Optional fix: record `doc.getFont()` in the text recorder next to `fontMm` and assert `fontName === "PTSans"` (style normal) in S-02/S-03. Text colour is unspecified in the spec (D5 survives, not a test defect).

m4. S-18 (unchanged from round 1) hard-codes the 14 mm pitch and checks only the area height; it passes before implementation as a declared guard. Acceptable.

m5. S-02/S-03 pins the baseline convention (0.35*font, tol 0.05 mm); it is the convention of `drawCentered` and D2, so acceptable. S-20's title still says "область та же" although the area is no longer asserted; cosmetic.

## Round 1 findings: status

| Round-1 item | Status |
|---|---|
| M1 chart placement under the strip unprotected | FIXED: S-15 centering on A4 and A1 compares ink midpoint with the NEW area; mutants P1 (old area), P1b (+1 mm), P1c (top-aligned), P2 (ignores legend) killed by 2 tests each |
| M2 S-06 too narrow | FIXED: y=14, y=15.2, vertical separator, rectangle around title, y=15 partial/full/thick, short tick from the frame all killed; only diagonal survives (m2) |
| m1 legendArea x/w not asserted | FIXED for geometry (L2 killed); drawn x still free (m1 above) |
| m2 baseline coupling | accepted (m5) |
| m3 S-20 tautology | FIXED (the tautological area assertion removed) |
| m4 S-18 weak guard | unchanged, accepted |
| m5 colour untested | accepted, spec silent |
| m6 S-22 duplicate print | FIXED: a copy must lie below the title-block top (y > 150); Q15 (graph 5 dropped) killed |
| m7 counts | OK: 41 tests, 37 failing before, 4 passing as declared |

## Mutant table (this round, scratch copy, 41-test file)

| Mutant | Result | Failing tests |
|---|---|---|
| P1 placeOnPage centers in old area (y-10, h+10) | killed | 2 (S-15 centering A4, A1) |
| P1b placeOnPage offsetY +1 mm | killed | 2 |
| P1c placeOnPage top-aligned in new area | killed | 2 |
| P2 placeOnPage ignores legend width (x) | killed | 2 |
| P3 legend drawn at old y=5 | killed | 2 (S-10/S-11, S-06) |
| P3b legend drawn 1 mm lower | killed | 1 (S-10/S-11) |
| P3c legend drawn x+2 | SURVIVED | 0 (m1) |
| P4 fitsFormat height +10 (cached old height) | killed | 3 (S-16, S-17, S-15) |
| P5 fitsFormat height +0.5 mm | killed | 1 (S-16) |
| Q5 fitScale uses old height | killed | 2 (S-17, S-15) |
| L1 legendArea height old | killed | 6 |
| L2 legendArea x+1 | killed | 1 |
| L3 planStripRect width frame-3 | killed | 6 |
| L4 strip height 12 on A0 only (area keeps 10) | killed | 2 |
| L5 area strip 12 on A0 only | killed | 2 |
| Q13 drawingArea x+1 | killed | 3 |
| D1 title on first page only | killed | 3 |
| Q1 page without title gets default title | killed | 1 (S-20) |
| Q15 graph 5 title dropped, strip only | killed | 1 (S-22) |
| D2 baseline factor 0.33 | killed | 1 |
| D2b baseline factor 0.5 | killed | 1 |
| Q14 title y +1 mm | killed | 1 |
| D3 no right padding | killed | 1 (S-09) |
| D3b only left pad accounted | survived, equivalent (text ends exactly at the frame edge, spec "внутри рамки") | 0 |
| D4 title x pad 2 | killed | 8 |
| D5 title colour red | survived, spec silent | 0 |
| Q11 title font helvetica | SURVIVED | 0 (m3) |
| Q12 title bold | SURVIVED | 0 (m3) |
| D6 thin line y=14 | killed | 1 (S-06) |
| D6b thin line y=15.2 | killed | 1 |
| D6c vertical separator x=120 | killed | 1 |
| D6d diagonal inside strip | SURVIVED | 0 (m2) |
| D6e rectangle around title | killed | 1 |
| D6f line y=15, x 20..60 | killed | 1 |
| D6g thick line y=15 full width | killed | 1 |
| D6h short tick x=100, y 5..8 | killed | 1 |

Experiment hygiene: two experiment rounds in `C:\ref-auto-fit` only, all writes through a script that refuses paths not starting with `C:\ref-auto-fit\` and restores the original text after each mutant; the node_modules junction was removed with `rmdir`. `git status --short` of the real repo is identical to the starting snapshot (no change to `src/export/sheet-draw.ts`, no stray test files).

## Result

Coverage of the ADDED requirement and both MODIFIED requirements is strong; the round-1 majors are closed; the remaining items are minor and optional.

VERDICT: PASS
