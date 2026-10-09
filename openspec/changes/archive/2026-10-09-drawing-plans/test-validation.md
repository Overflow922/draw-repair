# Test Validation: drawing-plans (round 4, final)

Validator: fresh context, read-only on the repo (only this file written). Empirical work in a scratch copy outside the repo (`%TEMP%\validate-dp-round4`, copied from the round-3 scratch with the reference implementation per design.md; the four new test files re-copied from the repo, including PG-20 in `src/export/pdf-pages.test.ts`).

## Summary of rounds

- Round 1: FAIL. Many surviving mutations (plan switching, history keys, storage of `activePlan`, page placement, format availability).
- Round 2: FAIL. Remaining survivors in page placement (bbox with own dimensions/doorways, centring) and wrappers.
- Round 3: FAIL. All earlier survivors killed; ~106 new tests pass against the reference; real survivors were only "pages after the first rendered with grid:true" and "pages after the first rendered with another palette".
- Round 4 (this): PG-20 added by the Test Writer. The grid survivor is now killed; the palette survivor is not (see below) but is unspecified and non-critical.

## Empirical results

- Reference implementation + 4 new files + existing suite: `npx vitest run` -> 102 files, 2191 tests passed (2189 + the two PG-20 tests).
- `npx tsc --noEmit`: clean.

## Requirement Coverage

All requirements of the delta specs (plan switching and per-plan contents, per-plan history, persistence of `activePlan` with fallback on invalid values, multi-page PDF export with one page per plan, per-page placement/centring, format availability across pages, filenames, legacy single-page wrappers) have tests (PL-*, ST-*, HI-*, PG-*), traced in `test-suite.md`. No uncovered requirement found.

## Boundary Coverage

Empty plans among pages (EMPTY in the second PG-20 test and placement tests), one-page documents, fitting/non-fitting formats at the limit, invalid/missing/unknown `activePlan`, history keys per drawing and plan. Covered.

## Negative Cases

Invalid `activePlan` values dropped by `parseStore`; a non-fitting page makes a format unavailable; empty pages do not constrain formats. Covered.

## Error Handling

Corrupt store data falls back to the default plan; no throwing path left untested.

## Invariants

Pages are drawn identically for identical plans (PG-20); dimensions/doorways belong to their own page (PG-16, PG-04); the scale label is the same on all pages (PG-14).

## State Transitions

Plan switching, undo/redo per plan, persistence round trip: covered by PL-*, HI-*, ST-*.

## Integration Behavior

The production path `exportPages` -> `buildPdfPages` is exercised through the jsPDF operator stream (parsePaths/strokeSegments), plus storage round trips.

## Implementation Independence

Tests assert on observable output (PDF operators in mm, texts, store JSON, history behavior), not on internal call structure. The jsPDF text-capture seam already existed.

## Assertion Strength

PG-20 asserts `first.length > 0` and deep equality of `parsePaths` of page 2 (and page 3 in the second test) with page 1 for identical plans. Page 1 contains the wall contour strokes (0.6 mm) plus dimension/doorway paths, so equality is meaningful and non-vacuous; the length guard prevents an empty==empty pass. Limitation: `parsePaths` carries geometry, paint kind and line width only, not colors.

## Mutation Testing

12 further mutations of `buildPdfPages` run against `src/export/pdf-pages.test.ts`:

| Mutation | Result | Killed by |
|---|---|---|
| S1 grid:true on pages after the first | KILLED | PG-20 |
| S2 dark palette on pages after the first | SURVIVED | - |
| S2b arbitrary palette (ink red, paper blue) after the first | SURVIVED | - |
| M1 screen metrics on later pages | KILLED | PG-04, PG-05, PG-17, PG-20 |
| M2 unit "mm" on later pages | KILLED | PG-04, PG-20 |
| M3 draw selected walls on later pages | KILLED | PG-20 |
| M4 preview wall on later pages | KILLED | PG-20 |
| M5 stray line on later pages | KILLED | PG-20 |
| M6 zoom x1.01 on later pages | KILLED | PG-05, PG-20 |
| M7 no dimensions on later pages | KILLED | PG-16 |
| M8 no doorways on later pages | KILLED | PG-04, PG-20 |
| M9 grid:true on ALL pages | SURVIVED (also with the whole `src/export`, 252 tests) | - |
| M10 screen metrics on ALL pages | KILLED | PG-04, PG-05, PG-17 |

PG-20 versus all-pages mutations: PG-20 is a consistency test and does not detect a mutation affecting every page equally (M9). Such mutations are covered by the absolute-value tests PG-04/05/17 (M10 killed). Grid on all pages (M9) is not asserted by any export test, including legacy single-page ones; this is a pre-existing gap, not introduced by drawing-plans, and the change's specs do not mention grid or palette.

## Surviving Mutations

| Mutation | Why it survives | Blocks PASS? |
|---|---|---|
| S2/S2b different palette on pages after the first | `parsePaths` ignores colors; no test inspects color operators. The statement in test-suite.md Revision 3 that PG-20 covers the palette is overstated. Palette is not in the drawing-plans specs and production passes no palette (PDF is always light) | No (non-critical, unspecified) |
| M9 grid:true on all pages | Pre-existing gap in export tests, outside this change | No |
| Legacy wrapper `exportDrawing` doorway forwarding | Covered by the production path `exportPages` | No |
| `activePlanOf` always default / `planHistory` ignoring plan | Equivalent while the catalog has a single plan | No (equivalent) |

## Findings

- Of the two round-3 real survivors, grid is killed by PG-20; palette is not, but is unobservable through the operator parser, unspecified in this change and non-critical.
- PG-20 is non-vacuous and kills every later-page-only mutation tried except palette.
- Optional follow-up: note in TODO.md that PDF color operators and grid-off are not asserted for any page (pre-existing).
- Git check of the real repo: `git status --short` shows only bash.exe.stackdump, img.png, img_1.png, openspec/changes/demolition-plan/, openspec/changes/drawing-plans/ and the four new test files (src/export/pdf-pages.test.ts, src/history-plans.test.ts, src/plans.test.ts, src/storage-plans.test.ts). `git diff` is empty.

## Required Changes

None.

VERDICT: PASS
