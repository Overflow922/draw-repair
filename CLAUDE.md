# Правила проекта

## Rule 1 — Specification является источником истины

Ожидаемое поведение определяется:

- `openspec/specs/`
- `openspec/changes/<change>/specs/`

а не существующей реализацией. Если реализация и тесты противоречат specification, сначала выясняется, что неверно в specification.

## Rule 2 — Test Writer не меняет production code

Во время написания тестов AI имеет право:

- читать весь repository;
- читать specification;
- читать design;
- читать существующие тесты;
- создавать новые тесты;
- исправлять тестовые fixtures;
- создавать test utilities, если они нужны для тестирования.

AI НЕ имеет права:

- изменять production code;
- изменять specification;
- изменять design;
- ослаблять существующие approved tests.

## Rule 3 — Test Validator не меняет код

Validator работает в отдельном fresh context. Он имеет право только:

- читать repository;
- читать specification;
- читать test plan;
- читать тесты;
- запускать тесты;
- запускать mutation testing;
- анализировать diff;
- создавать test-validation.md.

Validator НЕ имеет права исправлять тесты.

Если тест плохой:

```
VERDICT: FAIL
```

и возвращается на этап Test Writing.

## Rule 4 — Implementation Agent не меняет approved tests

После утверждения тестов Implementation Agent может менять:

- `src/`
- `app/`
- `lib/`
- `services/`
- ...

но не:

- `tests/`
- `__tests__/`
- `spec tests/`
- approved test files

Если implementation требует изменения теста, создаётся отдельный test-change-request.

Нельзя автоматически менять тест только потому, что текущая реализация его не проходит.
