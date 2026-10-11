# Test change review: auto-fit-scale

Reviewer: independent, read-only (OpenSpec test validator role). Scope: edits to previously approved tests made under test-change-request.md (sections A, B, C).

## Summary

The edits are faithful to the delta specs (REMOVED: format filter / popup / "formats account for all pages" / user-chosen format; drawing-storage: no `scale`). No protection of a behaviour that still exists was lost. Geometry tests that survive (`fitsFormat` boundaries, `placeOnPage`, `wallsBBox`, `pdfFileName`, `drawingArea`/`legendArea`, centering, legend width across pages, element/dimension/door/mark bounds) are all still present and green. The local helper `formatsAt(pages, scale)` is an equivalent translation of the old `availableFormatsForPages` for every use in the suite. Checked: 13 affected test files, 352 tests pass; `tsc --noEmit` reports errors only in `plan-title-strip.test.ts` (other change). Non-test diff is limited to the auto-fit-scale implementation (pdf.ts, page-format.ts, sheet-layout.ts, storage.ts, types.ts, main.ts, index.html, style.css, TODO.md, new fit-scale.ts / scale-series.ts).

## Table

| File | What changed | Verdict | Reasoning |
|---|---|---|---|
| src/export/page-format.test.ts | deleted (5 `chooseFormat` tests) | OK | `chooseFormat` removed with the format filter (REMOVED "Формат страницы выбирает пользователь"); nothing of it remains in production. |
| src/export/pdf.test.ts | `availableFormats` block (6) removed | OK | Each case has a counterpart: empty -> null (T-12), fits/does not fit -> T-03/T-04, overflow A0 -> T-15, scale change -> T-05, dimension beyond bbox -> T-19. `placeOnPage`, `wallsBBox`, `pdfFileName`, `buildPdf` tests untouched. |
| src/export/sheet-fit.test.ts | `availableFormats` block (8) and helpers `wall`/`dim` removed | OK | `fitsFormat` boundary, `placeOnPage`, landscape and invariants blocks kept. Removed cases are covered by T-03..T-09, T-24 (tall wall, landscape area), T-25, T-19, T-46, T-15. |
| src/export/legend-area.test.ts | FM-1..FM-4 rewritten onto `fitScale` | OK | AR-1..AR-6 (areas, legend column geometry, placement) untouched. Scenarios kept one-to-one; expectations re-derived below. Window/legend-width-across-pages (FM-4 long-label column) kept and strengthened (explicit 100 vs 200). |
| src/export/pdf-pages.test.ts | `availableFormatsForPages` -> local `formatsAt`; `scale: 100` dropped from fixture; "one page equals `availableFormats`" reduced | OK | Expectations unchanged; boundary tests PG-11 (FIT_LEN / +0.1, width and height) still decide on the same `fitsFormat(pageBounds(...))` at scale 10. The dropped `toEqual(availableFormats(...))` lines were tautologies (old one-page wrapper). `pdfFileName`, `pagesOf`, `buildPdfPages` blocks intact. |
| src/export/demolition-pdf.test.ts | same helper; `scale` dropped; PG-07 compare against walls rewritten | OK | PG-07 bound (`242 - legend`, +1 cm), PG-08, PG-18, PG-23 kept with identical expectations. The "pages equal walls" comparison now compares `formatsAt(pagesOf(d))` with `formatsAt` of a plain walls page: still a real comparison (demolition page + measure page vs plain walls). |
| src/export/demolition-dimensions-pdf.test.ts | helper; `scale` dropped | OK | DC-24/DC-25 expectations unchanged. DC-24 "subset" remains non-vacuous (assertions in the sibling test show A4 present without mark, absent with it). |
| src/export/mounting-pdf.test.ts | helper | OK | MP-90 boundary / demolished-part / own-dimensions tests unchanged. |
| src/export/demolition-sections|windows-pdf, legend, plan-names-pdf tests | `scale` removed from `Drawing` fixtures | OK | Mechanical; type-only. |
| src/types.test.ts | removed SCALE_DENOMINATORS / DEFAULT_SCALE / isScale tests | OK | Symbols removed from types.ts; new series covered by fit-scale T-01/T-02/T-48. `normalizeMaterial` tests intact. |
| src/storage.test.ts | fixtures w/o scale; migration tests; "bad scale in v3" replaced | OK | Replacement "scale does not affect reading" asserts `toHaveLength(1)` for scale 77 and for absent scale (would fail on old behaviour = non-vacuous). v2 test with `scale: 200` in the input asserts `"scale" in drawing === false` (non-vacuous: input carries the field). Future-version case checks `emptyDrawing`, non-vacuous. |
| src/storage-plans.test.ts, demolition/mark-storage.test.ts | `scale` removed from fixtures; `"scale" in d` false | QUESTION (minor) | Their fixtures no longer contain `scale`, so these particular assertions would pass vacuously for a store that merely preserved fields. The behaviour (old stored scale is dropped, not added) is genuinely protected by storage.test.ts (v2 `scale: 200`, v3 `scale: 77`) and storage-scale.test.ts T-40..T-43. Acceptable, no coverage lost. |
| src/storage-mounting, room-area, history, plans, plan-tools, mounting-plans, auto-dimensions, doorway/door/window-storage tests, mounting.test-utils | `scale` removed from fixtures / key lists | OK | room-area/storage-plans key-list expectations correctly lose `"scale"` (serialization no longer writes it; `parseStore` maps fields explicitly). |

## `formatsAt(pages, scale)` equivalence

Old: format F allowed iff every page with walls satisfies `fitsFormat(pageBounds(p, scale), scale, F, legendWidthMm(pages))`; wall-less pages impose nothing.

New: allowed iff `fitScale(pages, F)` is null (no wall page: all formats, same as old) or `<= scale`, where `fitScale` is the first series member that fits all wall pages (else 1000).

Equivalent provided (1) `scale` is a series member and (2) fit is monotone in the denominator.
- (1) All uses pass 5, 10, 100 (series members: 5, 10, 100 are in SCALE_SERIES). The 1000 "does not fit" sentinel can never be `<= scale` for scale <= 100, so it cannot yield a false "fits".
- (2) Page extent in mm is `(cm extent)*10/scale + constant mm` (the 0.5*scale cm pad is a constant 5 mm per side; legend width independent of scale; mark-dimension extents are constant in mm). I verified monotonicity empirically in a throwaway copy outside the repo (C:\ref-auto-fit): 3000 random 1..3-wall pages, with and without a door, 5 formats, all 17 series members: zero cases where a finer scale fits but a coarser one does not.
- Boundary ties (FIT_LEN vs FIT_LEN+0.1, `Math.floor(...)` and `fit + 1` cases) are decided by exactly the same `fitsFormat(pageBounds(p,10),10,F,legend)` floating-point expression as before at scale 10, so results do not change. Not vacuous: the pairs flip between `ALL` and `NOT_A4`, and the suite is green.
- Residual limitation (informational): the helper is only valid for series scales; a future call with a non-series scale (e.g. 1:30) would silently round. Not a problem today.

## Legend-area expectations (independent arithmetic)

Notation: bbox width = length + thickness(20) + 2*(0.5*scale) cm, mm = cm*10/scale; so pad is 10 mm in total.
- FIT_272: wall 2600: 2600+20+100 = 2720 cm = 272.0 mm at 1:100. A4 area width = 272 - W (W > 0) -> does not fit at 100; at 1:200 = 2620+200=2820 cm -> 141 mm, fits iff W <= 131 (W is a few tens of mm; the test passes) -> 200. A3 width = 420-25 = 395; 272 <= 395-W -> 100. OK.
- FM-2: vertical wall 1600: height 1600+20+100 = 1720 cm = 172 mm at 1:100 > A4 height 145 -> 1:200 (86 mm). A3 height = 297-10-55 = 232 mm; at 1:75: (1620+75)=1695 cm*10/75 = 226 mm <= 232, at 1:50: 1670*0.2 = 334 > 232 -> 75. Matches the test (226 of 232).
- "slightly shorter wall" (`floor((272-W)*10-120)-1`): fits exactly under the area at 1:100 on A4 -> 100. OK.
- Monotonic test: scale only gets coarser with wall length, with last strictly coarser than first. OK.

## "Scale not in the model" assertions

- storage.test.ts v2 and future-version, storage-plans/mark-storage ST-06: `"scale" in d` is false. In v2 and future-version cases non-vacuous (input has scale / default drawing built by `emptyDrawing`). In storage-plans / mark-storage it is weak on its own (see QUESTION above) but backed by storage-scale.test.ts T-40..T-43 and storage.test.ts.
- `d !== undefined && "scale" in d` -> if `d` were undefined the expression is false, so the check passes even when no drawing loaded; the neighbouring `toEqual(wall...)` assertions on `d?.walls` would fail in that case, so no hidden hole. Minor stylistic point.

## Problems / proposed fixes (none blocking)

1. (Minor, QUESTION) storage-plans.test.ts ST-03/ST-02 and mark-storage.test.ts ST-06: the new `"scale" in d` assertion is vacuous because the fixture no longer has a `scale`. Option: keep one fixture `drawing(..., { scale: 77 })` in those tests so the assertion has teeth. Not required: covered by T-40..T-43.
2. (Cosmetic) pdf-pages.test.ts still has `describe("availableFormatsForPages", ...)`; rename to the helper's meaning (e.g. "форматы по подобранному масштабу") so the title no longer names a removed function.
3. (Cosmetic) legend-area.test.ts lost its trailing newline (diff "No newline at end of file"). Restore.
4. (Cosmetic) the same 6-line `formatsAt` helper is duplicated in four test files; could live in a shared `*.test-utils.ts`. Not required.
5. (Housekeeping) untracked `bash.exe.stackdump` in the repo root is not a change artifact; delete before commit. `plan-title-strip.test.ts` is red by design (other change).

## Production code check

Non-test diff: TODO.md, index.html, src/export/page-format.ts (chooseFormat removed), src/export/pdf.ts, src/export/sheet-layout.ts (formatScale), src/main.ts, src/storage.ts (scale dropped, explicit field map), src/style.css, src/types.ts (scale types removed), plus new fit-scale.ts / scale-series.ts. All belong to the auto-fit-scale implementation; nothing unrelated seen.

REVIEW: APPROVED
