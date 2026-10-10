# Test validation: demolition-corner-dimensions (round 2, final)

Validator: independent, read-only (Rule 4). Fresh scratch worktree (HEAD + current working-tree tests), reference implementation of design.md "Decisions" (zero chain items dropped, `geom` mandatory, `"width"` mode and `widths` option removed, chain for every effective mark and the ghost on both faces, underline only for `selectedId`, `markDimensionExtent` over the whole chain of both faces with the overshoot signed by face).

## Result against the reference

- `npx tsc --noEmit` (production + all tests): clean.
- Whole vitest suite: 130 files, 2856 tests, 0 failures. Round 1 failures (PG-04, two PG-18 in `src/export/demolition-pdf.test.ts`) now pass, so the spec conflicts with approved tests are resolved; nothing else conflicts with the delta specs.

## Re-check of the revised oracles

- PG-04: expects the digit set `{"100","90","310"}` on page 2 and a dimension number on page 1. Independent of the implementation (values come from the spec). Mutants "unselected width only on face +1" and "no chain without selection" fail it; "width-only PDF chain" is also killed by many other tests.
- PG-18 (two tests): expected placement is computed as the shift between the wall centre (150, 100 cm, from the wall coordinates) and the centre of `pageBounds`, in mm. The wall-contour size (30 x 22 mm) is absolute. Caveat: `pageBounds` is production code, so these two tests alone would not catch bounds that wrongly ignore face -1 (verified: mutants "extent drops face -1", "width only extent" are not failed by PG-18). Those bounds are pinned independently by the CD-15 tests in `mark-dimensions.test.ts` and `demolition-dimensions-pdf.test.ts` (absolute values, six diagonal walls by independent calculation), which kill all extent mutants. Acceptable layering: PG-18 checks placement logic, CD-15 checks the bounds.
- New boundary test CD-05 (0,6 cm gap shown as "1" with geometry): kills the mutant that treated gaps under 1 cm as zero.

## Mutation results (37 mutants on the reference, whole suite)

34 killed (zero filter on either face or absent; chain only for selected; underline on all marks / ghost / only width number; no ghost chain; unselected width-only or face +1 only; chain drawn twice; wrong colour; neighbour-aware gap; gapA/gapB swapped by target, order or value; chain only face +1; every extent variant: no face -1, width only, no gap dims, no overshoot, wrong overshoot sign, no number corners, no number height, no line ends, only first mark; zero tolerance 1 and 4 cm; offset side ignored; offset size; underline in PDF; no chain without selection; units ignored).

Surviving (3):
- `ZERO = 1e-3`: gaps between 1e-6 and 1e-3 cm treated as zero. The spec defines no numeric tolerance there; not required.
- `ZERO = 0` and `>= ZERO`: equivalent mutants, `dimGeometry` already drops lengths under 1e-6.

None indicates a missing requirement.

## Residual notes (non-blocking)

- CD-18 (dimensions not stored) relies on the existing `mark-storage.test.ts`.
- PG-18 depends on `pageBounds` (see caveat), compensated by CD-15.

VERDICT: PASS
