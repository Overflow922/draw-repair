# Test Suite

Прогон до реализации (ветка клика ещё в коде): новые тесты `DO-01`, `DO-02` (клик) падали, `DO-03`, `DO-04` проходили; 25 существующих тестов, создававших пометки кликом, переведены на протяжку по запросам TCR-1.

## Tests

| ID | Test File | Покрывает | Initial Result |
|---|---|---|---|
| DO-01 … DO-02 | src/demolition/demolition-drag-only.test.ts | клик по стене (тело, концы, радиус привязки, со стеной с пометками, с выделением), мёртвая зона, ширина меньше 1 см, железобетон, мимо стены — ничего не создаётся, `up` → `null`, истории нет | FAIL |
| DO-03 … DO-04 | src/demolition/demolition-drag-only.test.ts | протяжка от конца до конца (0 → 700, 500 → −100), ширина ровно 1 см, слияние со стеной с пометкой, несколько стен | PASS |

## Test Change Requests (применены)

TCR-1 (`test-plan.md`): `demolition-tool.test.ts`, `demolition-sections.test.ts`, `demolition-windows.test.ts`, `demolition-eraser.test.ts`.

## Unexpected Passes

`DO-03`, `DO-04` проходили до удаления клика: протяжка работала и раньше.

## Tests That Could Not Run

Ручной MAN-01.