## 1. Чистый переход и сброс призрака

Approved tests: `src/doorway/element-select-tool.test.ts` (DS-1…DS-5, DS-4b — `afterElementPress`; DS-3b, DS-8, DS-8b, DS-9 — `clearGhost`; DS-6…DS-7, DS-8c — регрессии, должны остаться зелёными). Спека: `doorway` «Выделение проёма кликом», `canvas-app` «Панель группы «Проёмы»», design D2a, D3, D4.

- [x] 1.1 В `src/doorway/openings-group.ts` вынести тип `Tool` из `src/main.ts` (экспорт, `main.ts` импортирует) и добавить чистую `afterElementPress({ tool, group, selected })` по design D2a: при `selected` и `tool` из `doorway | door | window` — `tool: "none"`, `group` с `active: "other"`, `panelOpen: false`, прежним `current`; иначе результат равен входу; вход не мутируется (DS-1…DS-5, DS-4b)
- [x] 1.2 В `src/doorway/doorway-tool.ts` добавить `ElementTool.clearGhost()` — сброс только призрака, без сброса перетаскивания; `reset()` не менять (DS-3b, DS-8, DS-8b, DS-8c, DS-9)

## 2. Применение в приложении

Спека: `doorway` «Выделение проёма кликом»; design D1, D2, D5. Автоматических тестов на `main.ts` нет (test-plan «Out of Scope», `TODO.md`) — проверяется ручной проверкой в разделе 3.

- [x] 2.1 В `src/main.ts` добавить переход «выйти из установки, сохранив выделение» (design D1): `tool = "none"`, `clearGhost()` у всех трёх инструментов установки, закрытие панели группы, `syncToolUI`, `redraw`; выделение, редактор чисел, `suppressClick`, жесты и `openingsCurrent` не сбрасывать; `setTool` не использовать и не менять
- [x] 2.2 В ветке `case "doorway"` обработчика `pointerdown` (`src/main.ts`) вызвать `afterElementPress` с результатом `pressDoorway(p)` как `selected`; при смене инструмента применить переход 2.1 и взять состояние группы (`openingsCurrent`, `openingsPanelOpen`) из результата (design D2, D4); запись в историю не добавлять (D5)
- [x] 2.3 Убрать из `src/main.ts` дублирующие определения, ставшие ненужными после выноса `Tool`; без побочного рефакторинга (CLAUDE.md Rule 10)

## 3. Проверка и качество

- [x] 3.1 Запустить утверждённые тесты `npx vitest run src/doorway/element-select-tool.test.ts` — все 16 зелёные, файл тестов не изменён
- [x] 3.2 Полный набор тестов (`npx vitest run`) — без падений; тесты других change не менялись
- [x] 3.3 Форматтер, линт, `npx tsc --noEmit` (проверка типов, включая тесты) — без ошибок, без ослабления настроек (в проекте нет линтера и форматтера — только `tsc`; тесты и `tsc --noEmit` зелёные)
- [x] 3.4 Ручная проверка в браузере (test-plan «Integration Cases», `memory: browser-manual-checks`, `/draw-repair/` на свежем dev-сервере): инструмент «Дверь» → клик по двери → инструмента нет, кнопка группы не выделена, панель закрыта, призрака нет, дверь выделена → клик в зону `b/right` меняет направление → «Отменить» возвращает прежнее; то же для окна при «Окно»; при «Стена» выделение двери оставляет «Стену» активной; клик по пустому месту стены при «Дверь» ставит дверь; кнопка «Проёмы» после выделения возвращает «Дверь», открывает панель и снимает выделение
- [x] 3.5 (пропущено: не настроено) Мутационное тестирование: в проекте не настроено — пропустить, отметить в отчёте проверки
- [x] 3.6 `openspec validate deselect-tool-on-element-select` и `/opsx:verify`; финальный просмотр `git diff` на случайные изменения; при необходимости обновить `TODO.md` (пункт про `main.ts` оставить)

## 4. Зона направления и правка при активном инструменте (ревизия 3)

Approved tests: `src/doorway/door-shadow-zone.test.ts` (DZ-1…DZ-8), `PB-ZN-02` (изменён по test-change-request 2). Спека: `door` «Направление выделенной двери», `doorway` «Выделение проёма кликом»; design D2b, D6.

- [x] 4.1 `doorZoneAt` в `src/doorway/doorway-layout.ts`: прямоугольник ∪ сектор тени и полотно, при пересечении — ближняя петля (DZ-1…DZ-8)
- [x] 4.2 `pointerdown` в `src/main.ts`: клик по числу или в зону при активном инструменте установки вызывает `afterElementPress` и выходит из установки (design D2b)

## 5. Наведение на тень направления (ревизия 4)

Approved tests: `src/doorway/door-hover.test.ts` (HV-1…HV-7b). Спека: `door` «Направление выделенной двери» (наведение); design D7.

- [x] 5.1 `SelectionEditing.hoverDirection(p)` в `src/doorway/doorway-tool.ts`: число главнее, затем `doorZoneAt`, текущее направление — `null`; запрос чистый (HV-1…HV-5)
- [x] 5.2 `RenderOptions.hoverDoorDirection` и отрисовка в `src/render.ts`: наведённое альтернативное направление — тот же `drawLeaf` без штриха; без опции — как раньше (HV-6, HV-6b, HV-7, HV-7b)
- [x] 5.3 `src/main.ts`: сырая точка курсора `hoverWorld` (ставится в `pointermove`, обнуляется в `pointerleave`), `hoverDoorDirection` в `redraw` через `selectionEditing.hoverDirection`, кроме «Ластика»
- [x] 5.4 Ручная проверка в браузере: выделить дверь, навести на штриховую тень — контур сплошной, уход курсора и наведение на число/пустое место — снова штриховой

## 6. Итоговая проверка ревизий 3–4

- [x] 6.1 Полный набор тестов, `npx tsc --noEmit`, `openspec validate`, `/opsx:verify`, финальный просмотр `git diff`

- [x] 4.3 `finishMarquee` в `src/main.ts`: рамка, захватившая элемент стены, выходит из установки (design D2b); проверено вручную в браузере
