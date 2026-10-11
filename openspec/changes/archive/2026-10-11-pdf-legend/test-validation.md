# Test Validation

Change: `pdf-legend`, revision 2 (user reference img_1.png). One pass. Validator: independent, read-only (the only repository file written is this one). All mutants ran in a copy outside the repo (`scratchpad/w2`, node_modules junctioned); the copy's sources were verified byte-identical to the repo after the run.

## Previous rounds (revision 1)

Rounds 1-2 FAIL (wrong tests, tautologies, clip-blind geometry, missing colour checks); round 3 PASS (31 mutants, 3 low-severity survivors). Revision 2 changed the spec (no elements in the legend, 16x8 mm samples, left indent, 14 mm pitch, wrapping at a 28 mm limit, column width from the widest wrapped line), so the suite was re-judged from scratch.

## Method

- Read the delta spec, design D1-D7, test-plan, the three test files and `pdf-style.test-utils.ts`, and the implementation (`legend.ts`, `legend-draw.ts`, `render.ts` drawLegendSample, `pdf.ts`, `sheet-layout.ts`).
- 38 new mutants of the implementation in the scratch copy, run against `legend.test.ts`, `legend-area.test.ts` and `legend-pdf.test.ts` (111 tests). The copy was restored after each run.
- Whole existing suite in the scratch copy: 142 files, 3138/3138 pass (same as in the repo).
- `git status` of the repo after the run equals the initial snapshot.

## Requirement Coverage

- PASS. The new scenarios have executable protection:
  - "Элементы стены в легенду не входят": LG-3 at `legendEntries` level (each element alone and together, dangling element, equal column width with and without elements) and at sheet level (no "Проём/Дверь/Окно" text on the page, only materials and wrapped «Демонтируемая стена» on Демонтаж).
  - "Отступ и шаг": LG-14 (positive identical left offset for all rows on all pages, samples 2:1, equal step inside and across pages including the step before the wrapped row).
  - "Перенос длинной подписи" / "Короткая подпись не переносится": LG-15 (`wrapLabel` results, two `doc.text` calls with shared x, second below first, both lines not wider than 28 mm by real PTSans width, sample centred on the two-line block, next row below the block, one-line label centred on its sample, word never broken).
  - Column width from the widest wrapped line, one width per document, per-page legends, no-walls cases, area/capacity/placement (AR-1..AR-6, FM-1..FM-4) are unchanged in strength.

## Mutation Testing

38 mutants: 34 killed, 4 survived (all low severity, listed below).

Killed (selected): M01 doorway entry re-added; M34 window entry added; M02 no wrap; M03 word broken at a fixed char; M04 limit 10; M05 limit 45 (no wrap); M06 wrong split char; M07 zero indent; M08 indent differs on the Демонтаж page; M09 sample 8->6 thick (not 2:1); M10 sample length 20; M11 row pitch depends on the lines of the wrapped row; M12 width from unwrapped label; M13 width max->min; M14 width from the first page only; M15 demolition sample black; M16 muted palette on every page; M16b ink palette on Демонтаж; M17 demolition sample clip removed; M18 legend on a page without walls; M19 font set before the sample (state reset); M20 label overlapping the sample; M20b gap 0; M21 demolition first; M21b materials reversed; M22 no dedupe; M23 demolition entry on ineffective marks; M24 sample not centred on the two-line block; M25 second line offset in x; M26 line pitch 9 and M26b 1.5; M27 demolition sample thinner; M28 unknown material not normalised; M29 sample width in column estimate 8; M31 label font 5 mm in drawing only; M33 demolition hatch not 135 degrees.

## Surviving Mutations

| Mutant | Why it survives | Severity |
|---|---|---|
| M05b wrap limit 28 -> 30 («Дерево (вдоль)» stops wrapping) | the spec fixes only «Демонтируемая стена» (wraps) and «Кирпич» (does not); the number 28 is a design value, not a spec number | low |
| M11b row pitch 14 -> 10 | spec requires an equal step on all pages, not its value; test only demands step > 8 and sample height < step | low |
| M30 right padding 5 -> 0 | spec names "плюс отступ до чертежа" but no value; width tests check relations, not the padding | low |
| M32 first row 4 mm lower | spec says "первая запись у верхнего края"; test only checks offset from the top is less than one pitch | low |

Observation (not a defect of the tests): with the 28 mm limit and the 0.6 width estimate, «Дерево (вдоль)» (14 chars, 29.4 mm) also wraps to two lines. The spec does not forbid this ("подпись, не помещающаяся в предельную ширину, переносится"), and LG-11 tests it only through the joined text, which is the right level of strictness.

## Pre-existing tests

Whole suite on the repository passes 3138/3138, i.e. the 20 revision-1 conflicts have already been resolved by the approved test-change-request; no conflicting pre-existing test remains.

## LG-13 (no legend on the canvas, no toggle)

Acceptable as non-automated: absence-of-behaviour requirement; `/opsx:verify` should confirm (a) `legend*` modules are imported only by `src/export/pdf.ts`, (b) `drawLegendSample` is called only from `legend-draw.ts`, (c) no legend control in `src/main.ts` / `index.html`, (d) screen tests stay green (they do: full suite passes).

## Required Changes

None.

VERDICT: PASS
