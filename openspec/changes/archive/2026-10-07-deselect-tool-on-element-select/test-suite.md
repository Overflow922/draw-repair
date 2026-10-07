# Test Suite

Все тесты — в `src/doorway/element-select-tool.test.ts` (vitest, 16 тестов, все обнаружены раннером).
Запуск: `npx vitest run src/doorway/element-select-tool.test.ts`.
Ревизия 2 (после test-validation FAIL): правило вынесено в чистый переход `afterElementPress` (design D2a) с учётом
группы и признака «нажатие выделило элемент»; DS-4b, DS-3 и DS-9 усилены.

Ревизия 3: зона направления = прямоугольник ∪ сектор тени (design D6) — тесты DZ-1…DZ-8 в
`src/doorway/door-shadow-zone.test.ts` (10 тестов; до реализации 5 FAIL: DZ-1, DZ-2, DZ-3b, DZ-5, DZ-7; остальные —
регресс). Утверждённый `PB-ZN-02` (`door-direction.test.ts`) изменён по test-change-request 2: две точки
`(99.5, 50)`, `(190.5, 50)` заменены на `(85, 50)`, `(205, 50)`.

| ID | Requirement | Test File | Test Name | Initial Result |
|---|---|---|---|---|
| DZ-1 | door «Направление выделенной двери» (штриховое полотно) | src/doorway/door-shadow-zone.test.ts | DZ-1 | FAIL |
| DZ-2 | door (сектор вне прямоугольника) | src/doorway/door-shadow-zone.test.ts | DZ-2 | FAIL |
| DZ-3, DZ-3b | door (сектор не шире w, не шире 95°) | src/doorway/door-shadow-zone.test.ts | DZ-3, DZ-3b | PASS / FAIL |
| DZ-4 | door (пересечение — ближняя петля) | src/doorway/door-shadow-zone.test.ts | DZ-4 | PASS |
| DZ-5, DZ-7 | door (любая стена, петли у b) | src/doorway/door-shadow-zone.test.ts | DZ-5, DZ-7 | FAIL |
| DZ-6, DZ-6b, DZ-8 | door (прежние зоны, чистота) | src/doorway/door-shadow-zone.test.ts | DZ-6, DZ-6b, DZ-8 | PASS |

Ревизия 4: наведение на тень направления (design D7) — `src/doorway/door-hover.test.ts`, 9 тестов; до реализации
7 FAIL (HV-1…HV-5 — `SelectionEditing.hoverDirection` нет; HV-6, HV-6b — опции `hoverDoorDirection` нет), 2 PASS
(HV-7, HV-7b — регресс: без подсветки штриховые, подсветка не рисуется у невыделенной/мультивыделения/PDF).

| ID | Requirement | Test File | Test Name | Initial Result |
|---|---|---|---|---|
| HV-1 | door «Направление выделенной двери» (наведение: в зоне альтернативы) | src/doorway/door-hover.test.ts | HV-1 | FAIL |
| HV-2 | door (вне зон, текущее направление, тело стены) | src/doorway/door-hover.test.ts | HV-2 | FAIL |
| HV-3 | door (число главнее наведения) | src/doorway/door-hover.test.ts | HV-3 | FAIL |
| HV-4 | door (ничего/не одна/окно/другие объекты) | src/doorway/door-hover.test.ts | HV-4 | FAIL |
| HV-5 | door (подсветка не меняет дверь, выделение, историю) | src/doorway/door-hover.test.ts | HV-5 | FAIL |
| HV-6, HV-6b | door (сплошной контур у наведённого, остальные штриховые) | src/doorway/door-hover.test.ts | HV-6, HV-6b | FAIL |
| HV-7, HV-7b | door (без наведения штриховые; PDF/мультивыделение/невыделенная) | src/doorway/door-hover.test.ts | HV-7, HV-7b | PASS |

## Tests

| ID | Requirement | Test File | Test Name | Initial Result |
|---|---|---|---|---|
| DS-1 | doorway «Выделение проёма кликом»; canvas-app «Панель группы «Проёмы»» | src/doorway/element-select-tool.test.ts | DS-1: «Дверь» и «Проём» после выделения элемента — нет инструмента | FAIL (`afterElementPress` нет) |
| DS-2 | doorway «Выделение проёма кликом» | src/doorway/element-select-tool.test.ts | DS-2: «Окно» после выделения элемента — нет инструмента | FAIL |
| DS-3 | canvas-app «Панель группы «Проёмы»» (группа деактивирована, панель закрыта, текущий инструмент сохранён) | src/doorway/element-select-tool.test.ts | DS-3: у каждого инструмента установки группа закрывается, не активна и помнит текущий инструмент; повтор ничего не меняет | FAIL |
| DS-4 | doorway «Инструмент «Стена» остаётся активным»; canvas-app «Выделение двери не трогает группу» | src/doorway/element-select-tool.test.ts | DS-4: остальные инструменты выделением элемента не меняются — ни инструмент, ни группа | FAIL |
| DS-4b | doorway (клик, ничего не выделивший, инструмент не снимает) | src/doorway/element-select-tool.test.ts | DS-4b: нажатие, ничего не выделившее, не меняет ни инструмент, ни группу — при любом инструменте | FAIL |
| DS-5 | canvas-app «Кнопка группы после выделения возвращает инструмент» | src/doorway/element-select-tool.test.ts | DS-5: функция не мутирует вход; группа результата — кнопка не активна, клик возвращает текущий инструмент и открывает панель | FAIL |
| DS-6 | doorway «Направление двери меняется сразу после выделения»; door «Направление выделенной двери» | src/doorway/element-select-tool.test.ts | DS-6: нажатие по двери выделяет её, клик в зону b/right меняет направление одной записью, дверь остаётся выделенной | PASS (регресс) |
| DS-6b | door «Направление выделенной двери» (зона текущего направления) | src/doorway/element-select-tool.test.ts | DS-6b: клик в зону текущего направления ничего не меняет и записи не создаёт | PASS (регресс) |
| DS-6c | door «Направление выделенной двери» (клик вне зон) | src/doorway/element-select-tool.test.ts | DS-6c: клик вне зон при выделенной двери зону не поглощает и направление не меняет | PASS (регресс) |
| DS-6d | doorway (окно) ; door (зоны только у двери) | src/doorway/element-select-tool.test.ts | DS-6d: окно из режима установки выделяется, зоны направления у окна нет | PASS (регресс) |
| DS-7 | doorway (Клик по пустому месту в инструменте установки ставит элемент) | src/doorway/element-select-tool.test.ts | DS-7: клик по свободному месту стены ставит элемент и выделяет его; существующие не затронуты | PASS (регресс) |
| DS-3b | design D3 (призрак исчезает) | src/doorway/element-select-tool.test.ts | DS-3b: clearGhost убирает призрак каждого инструмента установки | FAIL (`clearGhost` нет) |
| DS-8 | doorway (выделение сохраняется, перетаскивание, одна запись); design D3, D5 | src/doorway/element-select-tool.test.ts | DS-8: перетаскивание, начатое нажатием по элементу, переживает clearGhost и пишет одну запись | FAIL |
| DS-8b | doorway (деактивация не пишет в историю); design D5 | src/doorway/element-select-tool.test.ts | DS-8b: без сдвига перетаскивание записи в историю не создаёт | FAIL |
| DS-8c | design D3 (`reset` остаётся полным сбросом) | src/doorway/element-select-tool.test.ts | DS-8c: reset по-прежнему сбрасывает и призрак, и перетаскивание | PASS (регресс) |
| DS-9 | doorway (параметры новых элементов не меняются, история не пишется) | src/doorway/element-select-tool.test.ts | DS-9: clearGhost не вызывает inherit, не пишет историю и не меняет выделение и элементы | FAIL |

## Coverage

### Happy paths

- Переход после выделения элемента для «Проём», «Дверь», «Окно» (DS-1…DS-3), группа закрывается и помнит `current`.
- Выделение двери → зона `b/right` → одна запись (DS-6). Сброс призрака и продолжение перетаскивания (DS-3b, DS-8).

### Boundary cases

- Группа на входе: все сочетания `current` × `panelOpen` (DS-3, DS-4, DS-4b); идемпотентность повтора (DS-3).
- Клик в зону текущего направления — без изменений и записи (DS-6b). Перетаскивание без сдвига — без записи (DS-8b).

### Negative cases

- Остальные инструменты не меняются (DS-4); нажатие без выделения не снимает инструмент ни у одного инструмента (DS-4b).
- Клик вне зон не поглощается (DS-6c); у окна нет зон (DS-6d); установка по пустому месту (DS-7).

### Invariants

- Переход не мутирует вход, `group.current` сохраняется (DS-3, DS-5).
- `clearGhost` не меняет выделение, элементы, параметры, историю (DS-9); `reset` — полный сброс (DS-8c).

### Integration cases

- DS-6…DS-6d, DS-8, DS-9: `createElementTool` + `createSelectionEditing` над общим фейковым хостом.

## Unexpected Passes

- DS-6, DS-6b, DS-6c, DS-6d: домен «выделить → зона направления» работал и до change (браузерная проверка:
  клик в зону исправен); это регрессионная защита. Дефект — в `main.ts`.
- DS-7, DS-8c: регрессионные тесты существующего поведения.

## Tests That Could Not Run

- Нет: все 16 тестов выполнены (10 FAIL, 6 PASS на момент написания).

## Gaps and Notes (для валидатора)

- `afterElementPress`, тип `Tool` в `openings-group.ts` (design D2a) и `ElementTool.clearGhost()` (design D3) пока не
  существуют; FAIL до реализации ожидаем. Типы тестов проверятся после реализации.
- Не покрыто модульными тестами и закрывается ручной проверкой + `TODO.md`: вызов `afterElementPress` именно в
  ветке `case "doorway"` `pointerdown` в `main.ts`; применение результата (переход D1 вместо `setTool`, так что
  выделение сохраняется). Мутации «main.ts не вызывает функцию» и «main.ts вызывает `setTool("none")`» тесты не ловят
  (test-plan «Mutation Targets», «Out of Scope»).
- Код продакшна и ранее утверждённые тесты не менялись.
