# Agent Development Contract

## Rule 1 — Specification is the source of truth

Expected system behavior is defined by OpenSpec:

* `openspec/specs/`
* `openspec/changes/<change>/specs/`

For an active change, its delta specifications are considered together with the
current specifications in `openspec/specs/`.

Existing implementation and existing tests are NOT the source of truth.

When implementation or tests conflict with the specification:

1. identify the discrepancy;
2. determine whether the specification is intentionally being changed;
3. do not silently change the specification to match the implementation;
4. do not silently change approved tests to match the implementation.

Behavioral requirements must be resolved at the specification level.

---

## Rule 2 — OpenSpec workflow

Use OpenSpec for non-trivial feature work and architectural changes.

Expected workflow:

1. explore the problem and repository;
2. create/review the proposal;
3. create/review specifications;
4. create/review technical design;
5. create implementation tasks;
6. write tests;
7. validate tests;
8. implement;
9. run quality gates;
10. verify implementation against OpenSpec;
11. archive the completed change;
12. stage all change files and commit them on the current branch
    (do not create or switch branches).

Do not start implementation before the relevant specification and task artifacts
are sufficiently clear.

Small fixes, documentation changes, and trivial refactors may bypass the full
OpenSpec workflow.

---

## Rule 3 — Test Writer does not modify production code

During test writing, the Test Writer may:

* read the entire repository;
* read OpenSpec specifications;
* read design documents;
* read the test plan;
* read existing tests;
* create new tests;
* create or update test fixtures;
* create test utilities required for testing.

The Test Writer MUST NOT:

* modify production code;
* modify OpenSpec specifications;
* modify design documents;
* weaken approved tests;
* remove coverage merely to make tests pass.

Tests must be derived from observable behavior and acceptance criteria.

---

## Rule 4 — Test Validator is read-only

Test Validator runs in a fresh context.

The validator may:

* read the repository;
* read OpenSpec specifications;
* read design documents;
* read the test plan;
* read tests;
* run tests;
* run mutation testing;
* inspect the git diff;
* create `test-validation.md`.

The validator MUST NOT modify:

* production code;
* tests;
* specifications;
* design documents.

If the test suite is inadequate:

```text
VERDICT: FAIL
```

The work returns to Test Writing.

A validator must never repair the tests it is validating.

---

## Rule 5 — Approved tests are immutable during implementation

After tests are approved, the Implementation Agent may modify production code
required by the specification.

The Implementation Agent MUST NOT modify:

* `tests/`
* `__tests__/`
* `spec-tests/`
* approved test files;
* approved test fixtures unless explicitly authorized.

If implementation reveals that an approved test must change:

1. stop implementation;
2. create a test-change-request;
3. explain why the approved test no longer represents the specification;
4. resolve the change separately;
5. re-validate the modified tests.

Never modify a test merely because the current implementation fails it.

---

## Rule 6 — TypeScript engineering standards

Use strict, modern TypeScript.

Mandatory principles:

* no `any`;
* prefer `unknown` at unsafe boundaries;
* avoid unnecessary type assertions;
* avoid non-null assertions as shortcuts;
* use discriminated unions;
* use explicit domain types;
* avoid weak generic object shapes;
* keep dependencies explicit;
* preserve type safety across boundaries.

Prefer composition over inheritance.

Prefer:

* modules;
* pure functions;
* small cohesive units;
* explicit dependency injection;
* immutable data where practical.

Use classes only when they provide meaningful value such as:

* stateful behavior;
* lifecycle/resource ownership;
* domain invariants;
* infrastructure adapters;
* framework-required abstractions.

Do not create classes merely to wrap functions.

---

## Rule 7 — Architecture

Organize code primarily by business capability/feature.

Prefer clear architectural boundaries such as:

```text
api
application
domain
infrastructure
```

Dependency direction should generally be:

```text
API → Application → Domain
Infrastructure → Application/Domain
```

Domain logic must not depend directly on:

* HTTP frameworks;
* databases;
* filesystem;
* environment variables;
* external APIs.

API/transport handlers should remain thin.

Business logic belongs in domain/application layers rather than controllers,
route handlers, or infrastructure adapters.

Do not introduce abstractions speculatively.

---

## Rule 8 — Decomposition

Do not solve large features in one giant implementation step.

For non-trivial work:

1. inspect existing code;
2. identify responsibilities;
3. split work into independently understandable tasks;
4. implement one coherent unit at a time;
5. keep files and functions cohesive.

Avoid:

* god classes;
* god services;
* giant files;
* catch-all utilities;
* deep conditional nesting;
* duplicated business logic;
* speculative abstraction layers.

Optimize for maintainability, not minimum file count.

---

## Rule 9 — Quality gates

A task is NOT complete until all applicable quality gates pass.

Run:

1. formatter;
2. lint;
3. TypeScript typecheck;
4. tests;
5. relevant integration/e2e tests;
6. OpenSpec validation/verification;
7. final git diff review.

Never declare success while required checks are failing.

Do not hide failures by weakening lint rules, TypeScript settings, or tests.

---

## Rule 10 — Change discipline

Keep changes scoped to the requested task.

Do not:

* perform unrelated refactors;
* rewrite working code without a reason;
* introduce dependencies without justification;
* leave debug code;
* leave dead code;
* duplicate existing utilities;
* silently change public behavior outside the specification.

Before finishing, inspect the final diff for accidental changes.

---

## Rule 11 — Reasoning and planning

For non-trivial tasks:

1. inspect before editing;
2. identify relevant existing abstractions;
3. create a concise plan;
4. implement;
5. validate;
6. review.

Do not start by generating large amounts of code before understanding the
repository.

When requirements are ambiguous, prefer identifying the ambiguity and checking
the specification/design instead of inventing behavior.

---

## Rule 12 — Completion criteria

The agent may declare a task complete only when:

* implementation matches the specification;
* approved tests remain unchanged;
* required tests pass;
* typecheck passes;
* lint passes;
* no known quality-gate failures remain;
* final diff has been reviewed;
* OpenSpec verification succeeds for changes that use OpenSpec.
