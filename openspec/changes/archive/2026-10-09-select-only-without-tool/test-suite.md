# Test Suite

Один файл: `src/tool-mode.test.ts` (vitest). Тестируется чистый модуль `src/tool-mode.ts` (design D8): `selectionAllowed`, `escapeAction`, `afterPlace`. Модуля ещё нет, поэтому весь файл падает при импорте — ожидаемый начальный результат до реализации.

## Tests

| Test ID | File | Test name | Requirement / scenario | Initial result |
|---|---|---|---|---|
| TM-SEL-1 (×7: wall, dimension, doorway, door, window, eraser, ruler) | src/tool-mode.test.ts | при инструменте «<tool>» выделение недопустимо | canvas-app «Выделение и правка только без инструмента» (клик, рамка, маркеры при инструменте); wall-selection, dimension-selection, multi-selection «Рамка выделения», doorway «Выделение проёма без инструмента», ruler-tool | FAIL (модуль отсутствует) |
| TM-SEL-2 | src/tool-mode.test.ts | без инструмента выделение допустимо | canvas-app «Без инструмента выделение работает» | FAIL |
| TM-SEL-3 | src/tool-mode.test.ts | допустимо ровно для состояния «Без инструмента» | canvas-app (инвариант) | FAIL |
| TM-ESC-1 (×7) | src/tool-mode.test.ts | при инструменте «<tool>» без незавершённых действий Esc снимает инструмент | canvas-app «Esc снимает активный инструмент»; wall-drawing «Esc без жеста снимает инструмент»; ruler-tool «Esc выключает линейку» | FAIL |
| TM-ESC-2 | src/tool-mode.test.ts | в «Стена» с незавершённым жестом… | canvas-app «Первый Esc отменяет жест, второй снимает инструмент»; wall-drawing «Отмена жеста» | FAIL |
| TM-ESC-2b | src/tool-mode.test.ts | в «Размер» с начатым размещением… | canvas-app «Esc в «Размер» с начатым размещением» | FAIL |
| TM-ESC-2c | src/tool-mode.test.ts | жест и черновик — жест первым | design D5 (порядок приоритета) | FAIL |
| TM-ESC-3 | src/tool-mode.test.ts | после снятия инструмента выделение допустимо | canvas-app «Снять инструмент и выделить» | FAIL |
| TM-ESC-4 | src/tool-mode.test.ts | без инструмента Esc снимает выделение | canvas-app «Esc без инструмента снимает выделение»; wall-selection «Esc без инструмента снимает выделение стены»; dimension-selection «Esc без инструмента снимает выделение размера» | FAIL |
| TM-ESC-4b | src/tool-mode.test.ts | без инструмента и без выделения Esc ничего не делает | граничный случай | FAIL |
| TM-ESC-5 | src/tool-mode.test.ts | инструмент группы «Проёмы» снимается Esc | canvas-app «Esc снимает инструмент группы «Проёмы»» | FAIL |
| TM-ESC-6 | src/tool-mode.test.ts | при активном инструменте выделение Esc не снимает — снимается инструмент | negative case test-plan (старый приоритет «выделение раньше инструмента») | FAIL |
| TM-ESC-7 | src/tool-mode.test.ts | два Esc приводят к «Без инструмента» | инвариант test-plan | FAIL |
| TM-ESC-8 | src/tool-mode.test.ts | одно действие для всех семи инструментов | ловит мутант «нет ветки для wall» | FAIL |
| TM-PLACE-1 (×3: doorway, door, window) | src/tool-mode.test.ts | после установки нет инструмента, группа закрыта и не активна | doorway «Установка проёма» (Установка снимает инструмент); door/window «Клик ставит …»; canvas-app «Выделение двери при инструменте группы деактивирует его» | FAIL |
| TM-PLACE-2 | src/tool-mode.test.ts | текущий инструмент группы сохраняется | canvas-app «Панель группы «Проёмы»» | FAIL |
| TM-PLACE-3 (×5: wall, dimension, eraser, ruler, none) | src/tool-mode.test.ts | установка не меняет инструмент и группу | negative case (Стена остаётся активной) | FAIL |
| TM-PLACE-4 | src/tool-mode.test.ts | повторное применение ничего не меняет | инвариант (идемпотентность) | FAIL |

## Notes

- **Форма API не определена в design.md.** Тесты фиксируют её: `escapeAction({ tool, gestureActive, dimensionDraft, hasSelection })` возвращает `"end-gesture" | "cancel-dimension-draft" | "clear-selection" | "deactivate-tool" | "none"`; `afterPlace(tool, group)` возвращает `{ tool, group }`; типы `EscapeState` и `EscapeAction` экспортируются из `src/tool-mode.ts`. Имена полей состояния выбраны писателем тестов; валидатору проверить, что design D8 допускает такую форму (при необходимости — запрос на уточнение design).
- **Не покрыто автоматическими тестами** (test-plan «Out of Scope» и «Integration Cases»): проводка в `main.ts` (pointerdown/click/рамка/Esc); проверяется вручную в браузере. Сценарии спецификации о кликах по конкретным объектам (стена, размер, дверь) сведены к предикату `selectionAllowed(tool) === false` — потому что решение о выделении принимает единственный предикат (design D1).
- **Неожиданных прохождений нет**: до реализации не проходит ни один тест (файл не загружается). Запуск отдельных тестов невозможен до появления модуля, поэтому обнаружение каждого `it` раннером проверить нельзя; после создания заглушки модуля валидатору перепроверить число тестов (ожидается 36 тестов: SEL 7 + 1 + 1 = 9; ESC 7 (ESC-1) + 10 (2, 2b, 2c, 3, 4, 4b, 5, 6, 7, 8) = 17; PLACE 3 + 1 + 5 + 1 = 10).
- **Не исполнено**: ничего, кроме импорта (файл падает целиком по отсутствию модуля).
- **Существующие тесты** change deselect-tool-on-element-select не менялись; их пересмотр — через test-change-request (TODO.md).
