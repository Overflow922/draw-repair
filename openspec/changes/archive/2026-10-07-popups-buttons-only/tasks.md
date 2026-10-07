Тесты утверждены (`test-validation.md`, ревизия 2, `VERDICT: PASS`) и неизменны на время реализации (CLAUDE.md,
Rule 5): задачи меняют только производственный код, `index.html` и стили. Если тест окажется неверным, остановиться
и оформить test-change-request. Сигнатуры — `design.md` D9. Тесты запускаются командой `npx vitest run <файл>`.

## 1. Параметры новых элементов

- [x] 1.1 `src/doorway/element-kind.ts`: тип `NewElementParams`, `initialParams()` и `inheritFrom(params, e)`; удалить `nextDirection` и поле `swing` из значений по умолчанию двери. Спека: `doorway` / `door` / `window` «… и параметры новых …». Тесты: `new-element-params.test.ts` (PB-PAR-01…06), `door-kind.test.ts`, `element-kind.test.ts`.

## 2. Направление двери

- [x] 2.1 `src/doorway/doorway-edit.ts`: `ghostSwing(raw, wall, prev, deadCm)` и `setDirection(d, hinge, swing)`; удалить `rotateDoor`; `placeDoor` принимает сторону открывания призрака. Спека: `door` «Инструмент «Дверь» и параметры новых дверей», «Направление выделенной двери». Тесты: `door-direction.test.ts` (PB-SW-*, PB-ZN-08*), `door-edit.test.ts`.
- [x] 2.2 `src/doorway/doorway-layout.ts`: `doorZones(d, walls)` и `doorZoneAt(p, d, walls)` — четыре зоны по спецификации. Спека: `door` «Направление выделенной двери». Тесты: `door-direction.test.ts` (PB-ZN-00…02d).

## 3. Правимые числа

- [x] 3.1 `src/render.ts`: вынести раскладку подписи из `drawDoorways` в `elementLabelLayout` (центр, угол, ширина рамки, начало частей) без изменения отрисовки. Спека: `doorway` «Отображение проёма». Тесты: существующие `doorway-label-frame*.test.ts`, `label-orientation.test.ts`, `window-render.test.ts`, `doorway-render.test.ts` остаются зелёными.
- [x] 3.2 Новый `src/doorway/editable-numbers.ts`: `editableNumbers(...)` и `numberAt(...)` по design D1. Спека: `doorway` «Ввод чисел размеров проёма», `window` «Правка подписи окна». Тесты: `editable-numbers.test.ts` (PB-EN-01…04b).
- [x] 3.3 `src/render.ts`: штриховое подчёркивание правимых чисел выделенного элемента (design D2: штриховая размерная линия под числом цепочки, штрих под числом подписи, цвет числа) и штриховые полотно и дуга трёх других направлений выделенной двери; только экранные метрики, только одиночное выделение. Спека: `doorway` «Ввод чисел размеров проёма», `door` «Направление выделенной двери». Тесты: `editable-render.test.ts` (PB-RN-01…06).

## 4. Адаптеры

- [x] 4.1 `src/doorway/doorway-tool.ts`: `createElementTool(kind, host)` без панели; параметры берутся из `host.params()`; сторона открывания призрака двери — `ghostSwing` с мёртвой зоной `4 / k` и запомненной последней стороной; убрать поля панели, «Повернуть», `setPanel`, `togglePanel`, `syncPanel`, `pressNumber`. `ElementToolHost` получает `params`, `inherit`, `rooms`, `unit`. Спека: `doorway` «Установка проёма», `door` «Инструмент «Дверь» и параметры новых дверей», `window` «Инструмент «Окно» и параметры новых окон». Тесты: `selection-editing.test.ts` (PB-TL-01…08), `door-tool.test.ts`, `window-tool.test.ts` (WTL-01…03, 07, 08).
- [x] 4.2 `src/doorway/doorway-tool.ts`: `createSelectionEditing(host)` — `pressNumber` (поле ввода на месте числа, применение по цели, `inherit` после применённой правки с фактическим элементом), `pressZone` (смена направления одной записью истории до правки, `inherit`), `closeEditor`; `openNumberEditor` остаётся общим. Спека: `doorway` «Ввод чисел размеров проёма», `window` «Правка подписи окна», `door` «Направление выделенной двери», `drawing-history` «Отменяемые действия». Тесты: `selection-editing.test.ts` (PB-ED-01…20, PB-ZN-03…07), `window-tool.test.ts` (WTL-09, 10, 10b).

## 5. Панели и main.ts

- [x] 5.1 `index.html` и `src/style.css`: удалить поля из `#openings-panel`, панели `#window-panel` и `#dim-panel`, кнопку `#door-rotate` и стили этих полей; панель «Стена» не трогать. Спека: `canvas-app` «Вспомогательная панель инструмента», «Панель группы «Проёмы»». Тесты: `popups-ui.test.ts` (PB-UI-01, PB-UI-02, PB-GR-01), `openings-group.test.ts` (GR-09…GR-10).
- [x] 5.2 `src/doorway/openings-group.ts`: удалить `groupSelect`. Спека: `canvas-app` «Панель группы «Проёмы»». Тесты: `popups-ui.test.ts` (PB-GR-02), `openings-group.test.ts`.
- [x] 5.3 `src/main.ts`: одно значение `let … = initialParams()`; хост элементов — `params` возвращает его, `inherit` присваивает `inheritFrom(значение, e)`; `createSelectionEditing`; порядок нажатия вне ластика: `pressNumber` → `pressZone` → `pressPick`; убрать `setElementPanel`, `setDimPanel`, `syncDimPanel`, обработчики полей проёма, двери, окна, «Повернуть» и «Вынос»; выделение элемента, размера и мультивыделение не открывают панели; кнопка «Окно» только активирует инструмент. Спека: `canvas-app`, `dimension-selection` «Выделение размера», `drawing-history`. Тесты: `popups-ui.test.ts` (PB-INT-01…03).

## 6. Проверка

- [x] 6.1 Запустить утверждённые тесты: `npx vitest run src/doorway`; все файлы change зелёные: `new-element-params`, `door-direction`, `editable-numbers`, `editable-render`, `selection-editing`, `popups-ui`, `door-tool`, `window-tool`, `openings-group`, `door-kind`, `door-edit`. Утверждённые тесты не менять.
- [x] 6.2 Полный набор: `npx vitest run`; типы: `npx tsc --noEmit`; сборка: `npm run build`. В проекте нет настроенных форматтера, линтера и инструмента мутационного тестирования (`package.json`) — отметить это в итоговом отчёте.
- [x] 6.3 Проверка в браузере (`dev-server-base-path`, `browser-manual-checks`): проём — клик по числам цепочки и по «H=…», подчёркивание; окно — «H=…» и «H под.=…», у кнопки «Окно» нет панели; дверь — сторона призрака по курсору, клик в зону меняет направление, штриховые альтернативы; панель «Проёмы» — только две кнопки; размер — нет панели; параметры новых элементов наследуются; отмена и вкладки.
- [x] 6.4 `openspec validate popups-buttons-only --strict`, затем `/opsx:verify`; финальный просмотр `git diff` на случайные изменения; хвосты — в `TODO.md`.
