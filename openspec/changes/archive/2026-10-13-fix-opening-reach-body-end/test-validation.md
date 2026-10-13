# Test Validation: fix-opening-reach-body-end (round 3, targeted final re-check)

Validator: independent, read-only with respect to the real repo. Checks ran in a git worktree with a throwaway reference implementation (reverted afterwards). One reference round and one mutant round (21 mutants).

## 1. Run on unchanged code

Full suite on unchanged production code: 4024 tests, 45 fail, 3979 pass - exactly the expected numbers. The failing set is the 3 new test files (opening-reach-body-end, opening-reach-body-end-storage, mounting-overhang, wall-merge-overhang; 45 reds across them), no existing test fails.

## 2. Reference implementation (worktree only)

- `freeIntervals`: floor `0` only if `hostChains.a.limitT === null && extendCm > 0`, else `-Infinity`; ceiling `len` under the same test for `b`, else `+Infinity` (D1).
- `storage.ts`: `offsetCm` accepted when finite (D3).
- `mounting-scene.ts` (D4a): a remnant that starts at 0 (ends at len) extends over the real body overhang, bounded by the intersection of the two `openingFaceRuns` faces; a remnant bounded by a demolition mark does not extend.

Full suite against the reference: 4024 / 4024 pass. No new-test defect, no spec conflict, no reference defect (my first attempt had a half-applied edit and showed 8 reds in `mounting-overhang.test.ts`; after the edit was completed all pass - this was a reference defect, not a test issue).

Specific checks:
- T-26m (overhang 5 cm, C starts at x = 505): satisfiable and geometrically correct - body reaches 505, `-5` shown on `W~0`, `-6` hidden.
- T-26n (overhang 10): `-10` shown, `-11` hidden - passes.
- T-26k / T-26l (window at -15, ends b and a, overhang 10): hidden - pass.
- T-26f (doorway, mark 0..50): shown on `W~500` with offset -10 - passes (round-2 window defect fixed). T-26i (doorway, mark 400..450): hidden - passes.
- T-34 (offset -500 restored), T-25c (merge at end b keeps negative offset), T-35/T-35b (renamed) - pass.

## 3. Mutants (full suite each, reference as base, no baseline reds any more)

Killed:

| Mutant | Killed by |
|---|---|
| mounting: overhang unlimited at end a | T-26l |
| mounting: overhang unlimited at end b | T-26g, T-26h, T-26j, T-26k, T-26m, T-26n |
| unlimited at b only where a joint exists | T-26k, T-26m, T-26n |
| unlimited at a only where a joint exists | T-26l |
| fixed 10 cm cap at b where a joint exists | T-26m |
| limit +1 cm at b / -1 cm at b | T-26h, T-26m, T-26n / T-26, T-26b, T-26c, T-26d2, T-26f, T-26m, T-26n |
| overhang also at demolition boundary a / b | MP-23 / MP-20, 21, 23, 40, 43, 44, 48, WS-12 |
| storage lower bound -10 | T-34 |
| merge clamps offset >= 0 at end b (anchor a retained / anchor b converted) | T-25c |
| merge clamps at end a (converted / retained) | T-25 / T-25b |
| mounting offset on remnant clamped >= 0 | T-26e |

Survivors (all outside the literal text of the delta scenarios, non-blocking):

| Mutant | Comment |
|---|---|
| fixed 10 cm cap at end a with a joint; limit +1 cm at end a | the size-dependence scenarios (5 cm overhang) are exercised only at end b; end a is exercised only with the 10 cm overhang (T-26e, T-26l) |
| storage lower bound -1000 | arbitrary bound far beyond T-34's -500; D3 says "any finite", pinned adequately by -500 and the -1e999 raw JSON (T-18d) |
| body taken from one face only / union of faces / unbounded when no face runs | needs an asymmetric joint (faces ending at different t); spec says "real body extent" without a scenario for a skewed joint |
| `extendCm > 0` dropped from the continuation test | equivalent (known from round 1) |

## 4. Coverage of the `mounting-plan` delta scenarios

- Собственный элемент на выступе тела: T-26c.
- Элемент на выступе тела у конца b: T-26, T-26b, T-26d2; у конца a: T-26e.
- Снос в стороне от элемента на выступе: T-26f (doorway; mark 0..50 gives remnant `W~500`, offset -10).
- Элемент частично за телом стены: T-26k (b), T-26l (a).
- Предел зависит от реального выступа / Проём за пределом реального выступа: T-26m (5 cm: -5 shown, -6 hidden), T-26n (10 cm).
- Снос задевает элемент на выступе: T-26d, T-26i.
- За концом тела без стыка продолжения нет: T-26g, T-26h, T-26j.
- Existing scenarios of the requirements (проём на остатке, остаток исчез, ...) are covered by the existing MP-/WS- tests, which pass with the reference.

Other delta specs (`doorway`, `drawing-storage`) were already judged covered in round 2; the new tests T-34 (large negative offset), T-35/T-35b (renamed, no duplicate ids) and T-25c close the round-2 items 4 and 5 and nit 6. Round-2 required fixes 1-6: all done (1 spec text rewritten to a doorway, 2 T-26f/T-26i rewritten, 3 T-26k/l/m/n, 4 T-34, 5 T-25c, 6 renumbered).

## 5. Optional hardening (not required for PASS)

- T-26o: mirror of T-26m at end a (C ends at x = 195 so the overhang is 5 cm): offset -5 shown, -6 hidden - kills the end-a fixed-cap / +1 survivors.
- A skewed-joint scene where the two faces end at different t, with an element between the shorter and longer face end - pins the intersection rule.

## Verdict

The positional core, storage rule, merge cases at both ends, the approved-test change, and now the mounting rule (overhang only at the wall's ends, not at demolition boundaries, bounded by the real body, both ends, size-dependent) are strongly protected; the suite passes in full against a spec-compliant reference and all round-2 survivors are killed. Remaining survivors are asymmetric end-a variants and exotic geometry beyond the delta scenarios.

VERDICT: PASS
