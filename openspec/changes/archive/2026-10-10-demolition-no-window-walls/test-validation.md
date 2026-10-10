# Test Validation (round 2)

Change: `demolition-no-window-walls`. Validator: fresh context, read-only. Experiments in a scratch copy outside the repo (`C:\Temp\nwval2`, with `src` and configs copied and `node_modules` junctioned). Bash and the Cyrillic short-path scratchpad were unusable, so a plain ASCII scratch path was used.

## Round 1 defect

D-1 (wrong anchor oracle in NW-12, door drag) is fixed. The test now drags 50 to 300 and expects `mk("n1", "W", "a", 50, 300)`, and it passes. NW-17 was retitled. No TCRs are needed or open.

## Results on the REAL implementation (scratch copy of the repo's production code)

- `npx tsc --noEmit`: clean (exit 0).
- Whole suite: 123 files, 2762 tests, all passed. The 3 new files give 34/34.

## Mutation testing

Each mutation was run against the 3 new test files only (34 tests). Killed means at least one of them fails.

| # | Mutation | Result |
|---|---|---|
| M01 | window ignored in `canDemolish` | killed |
| M02 | any element on the wall blocks | killed |
| M03 | a window of any wall blocks | killed |
| M04 | door and doorway treated as blocking | killed |
| M05 | `effectiveMarks` does not pass elements on | killed |
| M06 | tool `down` does not refuse | killed |
| M07 | `select` ignores elements | killed |
| M08 | `erase` ignores elements | killed |
| M09 | `eraseTarget` ignores elements | killed |
| M10 | `selectedMark` (`numberAt`) ignores elements | killed |
| M11 | `up` click `effectiveMarks` ignores elements | SURVIVED (equivalent) |
| M12 | `pagesOf` does not pass elements | killed |
| M13 | `canDemolish` default `elements` contains a window | killed |
| M14 | reinforced check dropped | killed |
| M15 | `effectiveMarks` default `elements` contains a window | SURVIVED (unspecified default) |
| M16 | only the first element is checked | killed |
| M17 | window match restricted by a wall-id prefix | killed |
| M18 | degenerate check dropped | killed |

## Survivors

- M11: equivalent. `up` is reached only after `down` set `press`, and `down` now refuses walls with a window. No specified behaviour differs.
- M15: a default value for the optional `elements` parameter of `effectiveMarks`. The specification defines no behaviour for omitted elements. In production code only `mark-numbers.ts` omits it, and the UI cannot reach that path (see the notes). The whole suite, including existing tests, also passes under this mutation. This is not a defect in the tests for specified behaviour.
- Real survivors on specified behaviour: none.

## Production observations

The production diff matches the spec text:

- `canDemolish(wall, elements = [])` is false for a reinforced wall, a degenerate wall, or a wall with a window whose `wallId` equals `wall.id`. Doorways and doors do not block, and a window on another wall does not block.
- `effectiveMarks` passes the elements on, so a mark under a window disappears and returns when the window is removed. Marks stay in storage.
- The tool passes `host.elements()` in `selectedMark`, the `up` click, `select`, `erase` and `eraseTarget`. `down` sets `press = null` for walls that cannot be demolished, so there is no mark, no history step and no ghost, and the tool stays active.
- `pdf.ts` `pagesOf` and `main.ts` `drawDemolitionPlan` pass `doorways`. The `main.ts` wiring is covered manually only (MAN-01 and MAN-02).
- Non-blocking, as in round 1: `mark-numbers.ts` (`editNumber`) and `addMark` still call `effectiveMarks` and `canDemolish` without elements. The UI cannot reach a mark on a window wall (`select` and `numberAt` refuse). No spec scenario covers it. It could go to TODO.md as out of scope.
- No divergence from the specification was found.

## Repository check

`git status --short` in the real repo shows only the expected entries:

- modified: `src/demolition/demolition-tool.ts`, `src/demolition/mark-model.ts`, `src/export/pdf.ts`, `src/main.ts`
- new, untracked: the 3 test files, `openspec/changes/demolition-no-window-walls/`, `bash.exe.stackdump`, `img.png`, `img_1.png`

The validator changed nothing in the repo except this file.

VERDICT: PASS
