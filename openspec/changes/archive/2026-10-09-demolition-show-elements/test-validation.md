# Test Validation: demolition-show-elements (round 2, targeted)

Validator: fresh context. Real repo untouched apart from this file. All runs in a scratch copy outside the repo. Baseline in the copy: 112 files, 2523 tests green, `tsc --noEmit` clean.

## Requirement Coverage

| Requirement / Scenario | Tests | Verdict |
|---|---|---|
| demolition-plan «Элементы стены в зоне сноса»: внутри / частично / касается / вне | RN-14, RN-15, PG-21 | covered |
| Дверь и окно в зоне сноса | RN-16 | covered |
| Элементы поверх области, серые | RN-17, RN-18 | covered |
| Отображение «как на обмерочном плане» (позиции, метрики, шрифт, выравнивание, базовая линия; экран и PDF) | RN-20 x2 | covered (new, compares against the measurement drawScene with grey palette) |
| Вырез в стене по элементу | RN-19, RN-21, RN-20 | covered |
| Подложка без размеров и площадей | RN-01, RN-05, PG-04, PG-12 | covered |
| pdf-export «Элементы на странице демонтажа» | PG-04, PG-22 | covered |
| «Габариты учитывают элементы» (в том числе при пометке на стене с дверью) | PG-23 and its marked-wall variant | covered |
| «Первая страница прежняя» | PG-06, PG-02 | covered |

## Boundary Coverage

Inside / partial / touching / outside / whole wall: RN-14/15 and PG-21. Region clip tolerance (EPS_CM at `from` and `to`): RG-03 (killed F11, F12). Bounds with a mark on the door's wall: PG-23 variant (killed M24).

## Negative Cases

No area label, no dimensions on page 2 (RN-01, PG-04, PG-12); no hiding by marks (F09, F15, F08 killed); no grid on page 2 (PG-15, killed F03).

## Error Handling

Not applicable, no new failure paths.

## Invariants

Layer after the paper fill (RN-17); grey palette (RN-18); element ops equal the measurement plan ops (RN-20); `pagesOf(d)[1].doorways` equals all elements (PG-21).

## State Transitions

None added. `main.ts` passing all elements has no automated test (manual MAN-01..03).

## Integration Behavior

`pagesOf` -> `pageBounds` -> `buildPdfPages` -> page 2: PG-22, PG-23, PG-05, PG-07, PG-11. Killed all of F04..F07.

## Implementation Independence

Tests use a recording canvas and PDF operator parsing and compare against the independent measurement-plan output, not internals.

## Assertion Strength

Round-1 weaknesses are closed: RN-20 compares all non-text ops, texts and fillText textAlign/textBaseline for SCREEN and PDF metrics; shifted view, zoom, metrics, palette, rooms and element list changes all fail.

## Mutation Testing

Round-1 mutations M07, M09, M13, M14, M15, M17, M20, M24 re-run plus 15 fresh mutations (F01..F15) on `drawElementsLayer`, `drawDemolitionScene`, `pagesOf/pageBounds/drawPage`, `markRegion`. 23 mutations: 19 killed, 4 survived (all equivalent). Test files run per mutation: demolition-render, demolition-pdf, mark-region, pdf-pages.

## Surviving Mutations table

| Mutation | Killing test | Result |
|---|---|---|
| M07 underlay scene without element list | RN-20 x2 | killed |
| M09 layer uses SCREEN_METRICS | RN-20 (PDF) | killed |
| M13 shifted view | RN-20 x2 | killed |
| M14 layer textBaseline "top" | none | SURVIVED, equivalent |
| M15 layer rooms list empty | RN-20 x2 | killed |
| M17 layer without metrics | RN-20 (PDF) | killed |
| M20 layer textAlign "left" | none | SURVIVED, equivalent |
| M24 pageBounds ignores elements with a mark | PG-23 marked variant | killed |
| F01 layer font replaced | none | SURVIVED, equivalent |
| F02 layer zoom x2 | RN-20 x2 | killed |
| F03 grid on page 2 | PG-15 | killed |
| F04 page 2 scene without elements | PG-04, PG-22 | killed |
| F05 pagesOf drops a mark | PG-02, 03, 04, 05, 12 and more (9) | killed |
| F06 pagesOf drops an element | PG-21, 04, 22, 23 (7) | killed |
| F07 pageBounds pad 0 | PG-05, 07, 11 (5) | killed |
| F08 layer draws only first element | RN-16, RN-20 x2 | killed |
| F09 layer skipped when marks exist | RN-14..17 (8) | killed |
| F10 layer `othersSelected=true` | none | SURVIVED, equivalent |
| F11 markRegion `from > 0` | RG-03 | killed |
| F12 markRegion `to < len` | RG-03 | killed |
| F13 layer uses non-grey palette | RN-01, 18, 20 x2, RN-04 (9) | killed |
| F14 layer palette defaults to LIGHT | RN-18, RN-20 x2 | killed |
| F15 elements on marked walls filtered | PG-04, PG-22, RN-14..15 (9) | killed |

Classification of survivors:
- M14, M20, F01: equivalent. `drawDoorways` sets font and baseline itself and `drawElementLabel` sets textAlign itself, so the three `ctx.font/textAlign/textBaseline` lines at the start of `drawElementsLayer` (render.ts:135-137) have no observable effect. Not a test defect. Observation for the implementer (dead code, Rule 10): these lines could be dropped, optional.
- F10: equivalent. The layer passes no selection options, so `othersSelected` has no effect.
- Previously (round 1) equivalent/untested wiring: element order against the ghost (M31, M28), `main.ts` passing elements (M30, manual MAN-01).

## Findings

1. All round-1 defects (M07, M09, M13, M14/M15/M17/M20 in part, M24) are now killed, except the redundant state lines which are equivalent mutants.
2. No real or critical survivors. No test defect found.
3. Real repo `git status --short`: exactly the 8 expected modified src files (render.ts, demolition-render.ts, demolition-render.test.ts, mark-region.ts, mark-region.test.ts, pdf.ts, demolition-pdf.test.ts, main.ts) plus untracked `bash.exe.stackdump`, `img.png`, `img_1.png`, `openspec/changes/demolition-show-elements/`. `git diff --stat`: 8 files, 189 insertions, 135 deletions (unchanged).

## Required Changes

None.

## Verdict

The suite now pins element geometry, metrics, palette, wall cut, bounds with marks and page-2 wiring. Remaining survivors are equivalent mutants.

VERDICT: PASS
