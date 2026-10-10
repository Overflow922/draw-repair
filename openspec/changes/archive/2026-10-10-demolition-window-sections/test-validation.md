# Test Validation: demolition-window-sections (round 2, final)

Validator: fresh context, read-only. All experiments in a scratch copy of the real implementation (`C:\Temp\dws-val2`, node_modules junction); the repo was not changed except this file.

## Results on the real implementation

- `npx tsc --noEmit`: clean.
- Whole suite: 126 files, 2810 tests, all pass.
- Round-1 gaps are closed by new tests: SW-03 (two partitions, nearest gap), SW-23 (right-window drag clamp, ghost), SW-31 (click and drag over a hidden mark).

## Mutation testing (28 mutants, run against src/demolition and src/export)

Killed (22): nearest gap A as min (round-1 mutant 4) and via the far gap edge `g[0]`; B from `g[1]`; B as max (round-1 mutant 5); only face +1; only face -1; gap threshold shifted on the left and on the right; any element blocks (window filter removed); drag upper clamp removed (round-1 mutant 24, killed by SW-23); drag lower clamp removed; click places the whole wall instead of the clean range; `place` merges with hidden marks (live = all marks); hidden marks dropped from storage on place; click hit-test without elements (round-1 mutant 37, killed by SW-31); click hit-test ignoring windows via per-mark resolve; `effectiveMarks` overlap tolerance `> 0`, `> 1`, huge; degenerate `to - from` threshold; block cache ignoring elements.

Survivors (6 plus 1 equivalent), all non-critical:

| # | Mutant | Class |
|---|---|---|
| 9 | tail sliver `lo > from + 1` in `cleanRanges` | non-critical: a clean section shorter than 1 cm (gap within 1 cm of the window), not specified |
| 10 | degenerate check in `windowBlocks` removed | equivalent in observable behaviour: `cleanRanges`/`canDemolish` already return empty for a degenerate wall |
| 12 | union of touching blocks `<` instead of `<=` | equivalent: touching blocks leave no clean sliver either way |
| 13 | press tolerance 20 cm instead of `EPS_CM` | non-critical: no click within 20 cm of a section boundary on the blocked side |
| 14 | press tolerance 0 | non-critical (0.01 cm boundary) |
| 15 | press projection not clamped to [0, L] | non-critical (press just beyond the wall end within the snap radius) |
| 27 | `+ 0*1` | equivalent (no-op mutant) |

No survivor on specified behaviour. No test defect found; no vacuous passes observed (every changed expectation was killed by at least one mutant).

## Production observations (diff vs spec text)

- `canDemolish`, `windowBlocks`, `cleanRanges`, `effectiveMarks`, `pressOn`, `bounds`, `place` and the click path match the spec text: window section from the nearest gap on each side (far edge left, near edge right; gap belongs to the neighbour), overlap tolerance `EPS_CM`, drag clamped to the clean range where it started, click places the clean range, hidden marks do not merge and stay untouched, click on an acting mark does nothing.
- No divergence found. Minor, not a divergence: the `place` result in `next` puts hidden marks first in the storage order (order is not specified). Known and out of scope: `editNumber` calls `effectiveMarks` without elements.

## Repository check

`git status --short` before and after: `A img_2.png`, ` M src/demolition/demolition-tool.ts`, ` M src/demolition/mark-model.ts`, ` M src/demolition/mark-windows.test.ts`, untracked `bash.exe.stackdump`, `img.png`, `img_1.png`, `openspec/changes/demolition-window-sections/`, `src/demolition/demolition-sections.test.ts`, `src/demolition/mark-sections.test.ts`, `src/demolition/mark-sections.ts`, `src/export/demolition-sections-pdf.test.ts`. No stray changes.

VERDICT: PASS
