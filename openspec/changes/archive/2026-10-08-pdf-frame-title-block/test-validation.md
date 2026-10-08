# Test Validation

Second-pass, independent validation (fresh context) of change `pdf-frame-title-block`, after Test Writer "Revision 2".
The earlier report (VERDICT: FAIL) was used only as a lead; everything below was re-verified.

Method: scratch copy of the repo outside the repository (C:\sp\r, node_modules by junction) containing the CURRENT test
files; in the scratch copy only, a reference implementation of design D1-D7 was written from the spec geometry
(sheet-layout.ts with frame/title block/drawing area/cell data/texts; pdf.ts always landscape, `fitsFormat`/`placeOnPage`
over `drawingArea`, `PDF_MARGIN_MM` removed, `buildPdf(..., doorways, name, date)` drawing: 22 explicit inner 0.25 mm
lines + frame rect 0.8 mm + title block outline rect 0.8 mm + 11 caption texts + 4 content texts with shrink/truncate;
`exportDrawing` passes name and a single `Date`). Nothing in the repository was changed except this file.

Results against the reference implementation:

- New tests: 3 files, 132 tests, all PASS (discovered by vitest: `sheet-layout.test.ts`, `sheet-fit.test.ts`,
  `sheet-pdf.test.ts`; `pdf-ops.test-utils.ts` is correctly not collected as a test file).
- Whole suite: 91 files, 1838 tests; 90 files pass; only 4 tests in `src/export/pdf.test.ts` fail, all because of the
  intended spec change (list under Findings). `tsc --noEmit` on the scratch copy (production + tests) is clean.
- Failing new tests against the reference implementation: none, so no test bug / over-constraint / spec ambiguity /
  reference bug to classify (the first reference attempt of the previous pass is not reused; this one was rewritten).
- Mutation testing: no mutation tool is configured in the project; hand-written mutants were applied one at a time to
  the reference implementation and the three new test files were run against each (151 mutant runs).

## Requirement Coverage

- PASS. Every scenario of the delta spec has executable coverage: one page (PG-1), frame offsets A4 and
  format independence (FR-1..FR-5, rect edges and widths parsed from the PDF stream), title block size/position/format
  independence (TB-1..TB-4, TB-9), grid of cells with all 11 captions and all numbered cells (TB-5..TB-8, layout data
  plus PDF-level exact set of inner lines on A4 and A1 and caption text placement), content (FL-1..FL-6, including
  "cell 5 empty", date format and long name), drawing area (DA-1..DA-2), "Область чертежа" scenarios "область на A4",
  "чертёж не пересекает рамку" (DA-3/DA-4/PL-5) and "Граница области" (DA-5..DA-7 for A4 and A3..A0, both axes,
  +0.1 mm), MODIFIED format scenarios (OR-1..OR-4, FM-1..FM-6) and placement (PL-1..PL-5).
- Not executable and acceptable: "frame drawn for an empty drawing" (export of an empty drawing is disabled elsewhere).

## Boundary Coverage

- PASS. Fit boundary exactly at 272x145 mm (A4) and at the area of A3..A0, +0.1 mm on each axis, `<=` vs `<` per axis
  (mutants killed), scale 1:10 avoids floating point noise, boundary independent of world offset. Dates: January,
  December, year 2099/2100. Names of 1, ~50 and 300 characters. Margins 19/21/4/6 mm per side all killed.

## Negative Cases

- PASS. No portrait page for tall/near-square drawings (OR-3, OR-4, FM-5, FM-6); cell 5 never has text; no thick lines
  except frame and title block outline; no stray thin lines inside or sticking out of the block; no extra grid line.

## Error Handling

- PASS. Over-long name (300 chars) stays inside cell 1 on A4 and A1; no other error paths in the spec.

## Invariants

- PASS. Title block 185x55 flush with frame on all five formats; numbered cells do not overlap and tile the right
  part; larger formats keep fitting; `fitsFormat` agrees with `placeOnPage` (drawing lies inside the area on all sides);
  frame/title block identical across scales (A4 1:50/1:200, A4 1:100 vs A1 1:20).

## State Transitions

- PASS. Format list shrinks monotonically as the drawing grows, new default is the smallest fitting format (FM-3, FM-4),
  scale change widens the list. UI-level selection logic is outside this change (consumes `availableFormats`).

## Integration Behavior

- PASS. `buildPdf` with a doorway keeps frame/block and the "H=210" label above the block (IN-1); `exportDrawing`
  passes the drawing name and the same moment to the title block and the file name (IN-3). Note: with a frozen clock
  a second `new Date()` is indistinguishable (equivalent mutant, see below).

## Implementation Independence

- PASS. Tests rely on design D7 seams (sheet-layout API, `buildPdf` params) and on parsed PDF output; text containment
  uses recorded `doc.text` calls with tolerance 0.05 mm and baseline-aware glyph box. A natural reference
  implementation passed first time without tuning. Mild coupling noted in Findings (exact thin-line set).

## Assertion Strength

- PASS. Exact rectangles (`toEqual`), exact merged inner-line set, width-sensitive stroke coverage (0.8 / 0.25 mm,
  tolerance 0.005), non-empty guards on every filtered collection (`length > 0`, `captions` has 11, `touching.length > 0`,
  `calls.length > 0`); the PL-4 fixture now contains a dimension so digit labels exist.

## Mutation Testing

- PASS (manual mutants; no mutation tool in the project). 139 of 151 mutant runs killed; the 12 survivors are equivalent
  or non-critical, see table and Findings. No surviving critical mutant.

## Surviving Mutations

| Mutation | Expected Failing Test (first failing) | Result |
|---|---|---|


Survivor classification:

- "page portrait for vertical wall" (first version): equivalent mutant - jsPDF normalises `orientation: "landscape"`
  by swapping width/height, so the swap had no effect. The real version (`orientation: "portrait"`) is killed by OR-3.
- "export no date (default)", "export two new Date()": equivalent under the frozen clock of IN-3 (both calls return
  the same instant); only differ at a month boundary. Spec does not require single-Date explicitly (design D6 does).
- "export doorways dropped": pre-existing `exportDrawing` behaviour, outside this change.
- "scene drawn after sheet over (no change)": bbox padding in `buildPdf` set to 0; centering is symmetric so equivalent.
- "shrunk name tiny on all (min 5.0001pt)": equivalent (min size not reached by the used fixtures; behaviourally identical).
- Non-critical, real gaps (advisory, none blocks PASS):
  1. "avail pad 0" and "avail pad 1.0*scale": the drawing padding `0.5 * scale` inside `availableFormats` (spec: "с учётом
     запаса вокруг, как и до введения рамки") is not pinned by any test (also not by the old suite).
  2. "diag thin line in tb": a diagonal 0.25 mm line across the block is not detected; the parser only compares axis-aligned
     segments because hatch lines are unclipped in the stream.
  3. "name always shrunk to 8pt" and "non-name text 30pt": spec defines no standard font size; FL-5 only compares the name
     size with a reference name, so a uniformly tiny/huge-but-fitting font is accepted.
  4. "name sanitized" at PDF level: sanitising the name before drawing is only excluded at `titleBlockTexts` level
     (FL-6), not in the drawn PDF text.

## Findings

- All hard checks pass; first-pass failures (PL-4 without labels, `startsWith("Д")` matching "Дата", missing caption
  tests, missing stage-block captions, inexact outline extent, inexact grid set, stray stubs) are fixed and verified
  by mutants (stray 0.25 line through cells, inner line sticking out on all four sides, thick stub outside the frame,
  caption not drawn / shifted 20 mm / shifted 3 mm / oversized, each of the 22 grid lines removed, extended or moved,
  Лист(7)/Листов caption rect moved, outline or grid scaled 1.2x on A1, outline 190x60 from the frame corner, hard-coded
  A4 geometry or text positions on other formats, texts left/right aligned, text shifted 8 mm, date in the wrong row,
  name unshrunk, wrong fit width, name overflow on A1) - all KILLED.
- Mild over-constraint (not a reason to FAIL): `TB-10 ... состоит ровно из ожидаемых линий` rejects an implementation that
  strokes thin 0.25 mm segments exactly on the outline (e.g. stroking every cell rectangle under the 0.8 mm outline).
  Design D1/D2 and the data model make explicit inner lines necessary anyway (cells 14-19 and the 5 mm rows are not
  in the cell list), so the risk is low; if an implementer hits it, handle via test-change-request.
- Float traps checked: boundary tests use scale 1:10 (exact), centering uses `toBeCloseTo`, rect sums are integers.
- Parser assumptions reviewed: clip/`cm` ignored (jsPDF context2d pre-transforms coordinates; verified by green
  PL-5/PL-2 against the reference), measurement by 0.6 mm contour lines only, axis-aligned grid checks only.
  Acceptable and documented in test-suite.md.
- Existing approved tests that fail only because of the intended spec change (test-change-request list), all in
  `src/export/pdf.test.ts`:
  1. `placeOnPage` > "альбом для широкого чертежа, портрет для высокого" - page is always landscape, so `TALL` must give
     `landscape === true` (spec: Формат страницы выбирает пользователь).
  2. `placeOnPage` > "центрирует содержимое в полях при положительных координатах" - centering is now in the drawing area
     (x 20 + (272-50)/2, y 5 + (145-25)/2), not in the 10 mm margin of the whole page.
  3. `placeOnPage` > "центрирование инвариантно к сдвигу координат" - hard-coded 123.5 and 297 - ... assume the old centering
     in the page; expected centre is now area-based (131).
  4. `buildPdf` > "высокий чертёж даёт портретную страницу формата" - page is landscape (594x420 for A2).
  No existing test fails for any other reason; the other 22 `pdf.test.ts` tests and all 87 other files pass.

## Required Changes

- None required for PASS. Recommended (optional) additions by the Test Writer: a test pinning the `0.5 * scale` padding in
  `availableFormats` (e.g. a wall whose bbox with padding crosses the A4 boundary but without it does not); a PDF-level
  check that a name with `/ : * " ?` is drawn unchanged; a check of thin diagonal segments inside the block if the
  stream can be clipped-aware.

## Verdict

VERDICT: PASS