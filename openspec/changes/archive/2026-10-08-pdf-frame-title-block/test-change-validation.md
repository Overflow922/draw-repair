# Test change validation: src/export/pdf.test.ts

Scope: only the four tests changed per test-change-request.md. Read-only validation (no repo files modified except this report).

Runs: `npx vitest run src/export/pdf.test.ts` -> 22/22 passed. `npx tsc --noEmit` -> exit 0, no errors.

Arithmetic check (500x250 cm at 1:100 on A4 = 50x25 mm; area x 20..292 (w 272), y 5..150 (h 145)): left x = 20 + (272-50)/2 = 131; top y = 5 + (145-25)/2 = 65; right gap = 292 - (131+50) = 111. All correct.

## 1. placeOnPage: always landscape (wide and tall)
- Spec: "Ориентация страницы ВСЕГДА альбомная" (MODIFIED requirement), scenario "Автоориентация". Expectation follows.
- Assertions: 2 before, 2 after; the wide check kept, the tall check flipped false -> true per spec. Nothing weakened.
- Can fail: an implementation keeping portrait for tall drawings (old behaviour, `landscape: !tall`) fails the second assertion.
- PASS

## 2. placeOnPage: centering in the drawing area, positive coordinates
- Spec: "Чертёж ... центрирован в [области чертежа]" and area 272x145 at (20, 5) on A4. Expected offsets 131 and 65 are correct.
- Assertions: 3 before, 3 after; toBeCloseTo precision 9 kept; expressions written as 20 + (272-50)/2 and 5 + (145-25)/2 (not tautological, hard numbers from the spec).
- Can fail: centering on the whole page ((297-50)/2 = 123.5, (210-25)/2 = 92.5), a 10 mm margin (10 + (277-50)/2 = 123.5), centering in the frame including the title block (y = 5 + (200-25)/2 = 92.5), or using the area origin without halving all fail on offsetX or offsetY. Confirmed against src/export/pdf.ts: placeOnPage uses drawingArea(format), which is frame minus the title block height.
- PASS

## 3. placeOnPage: centering invariant to coordinate shift
- Spec: centered in the drawing area; invariance under shift. Expected left edge 131 mm and right gap 111 mm to area edge 292 are correct (the first draft's 131 for the right gap was a mistake, correctly fixed).
- Assertions: 4 before, 4 after; precision 9 kept; both base and shifted cases and both left and right edges still asserted (the 111 gap is the right-side value, 292 - 181).
- Can fail: an implementation that centers correctly only for minX = 0 (forgets `- b.minX * mmPerCm`) fails the shifted left assertion; a page-based centering (123.5) or a 10 mm margin fails all four; mis-sized area width fails the right-gap assertions.
- PASS

## 4. buildPdf: tall drawing gives landscape page (A2 594x420)
- Spec: always landscape, A2 = 594x420 landscape. Expectation correct.
- Assertions: 2 before (width, height), 2 after; values swapped to 594 / 420 per spec; toBe exactness kept.
- Can fail: portrait for tall drawings (old behaviour) yields 420 x 594 and fails both; passing orientation "portrait" or swapping format dimensions fails. Confirmed: buildPdf passes orientation "landscape" with PAGE_FORMATS_MM dimensions.
- PASS

No assertion was deleted, weakened or loosened; no expectation contradicts the spec; each test can still fail for a concrete wrong implementation.

VERDICT: PASS
