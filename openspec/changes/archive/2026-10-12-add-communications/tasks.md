Одобренные тесты неизменяемы: `src/communications/*.test.ts`, `src/plan-tools.test.ts`, `src/mounting-plans.test.ts`, `src/doorway/popups-ui.test.ts` (см. `test-suite.md`, `test-validation.md`: VERDICT PASS). Задачи меняют только production-код. Контракт API — раздел «Контракт API» в `test-suite.md`. Тест, который по ходу работы окажется неверным, не правится: останавливаемся и создаём test-change-request (CLAUDE.md, Rule 5).

## 1. Модель и хранение

- [x] 1.1 Типы `Riser`, `Duct`, `Communication` и поле `Drawing.communications?` в `src/types.ts` (spec communications «Стояк и воздуховод», design D1). Тесты: `src/communications/geometry.test.ts` (CM-*), `storage.test.ts`.
- [x] 1.2 `isCommunication` и поле в `isDrawing`/`parseStore` в `src/storage.ts`: поэлементный отброс битых, список не дописывается (spec «Коммуникации в документе», design D11). Тесты: `src/communications/storage.test.ts` (CO-*).
- [x] 1.3 `Scene.communications?` и запись истории `walls` с коммуникациями в `src/history.ts`: клон, undo/redo, запись без поля не меняет список, проверка формата в `parseHistory` (spec «История коммуникаций», design D11). Тесты: `src/communications/history.test.ts` (CH-*).

## 2. Геометрия и правила (чистые функции)

- [x] 2.1 `src/communications/geometry.ts`: `Direction`, `wallOverlapDepth`, `overlapDepth`, `communicationViolation`, `slideReach` с точкой касания (spec «Расстояния до ближайших стен», «Инвариант размещения коммуникации», design D2, D3). Тесты: `geometry.test.ts` (CD-*, CI-*).
- [x] 2.2 `src/communications/placement.ts`: значения по умолчанию (Ø 11, 30 × 20), `ghostPosition`, `moveLimited` (spec «Установка коммуникации», «Выделение, перемещение и удаление коммуникации», design D4). Тесты: `placement.test.ts` (CP-*, CS-04*).
- [x] 2.3 `src/communications/edit.ts`: `NumberField`, `communicationNumbers`, `applyNumber` (расстояние — сдвиг вдоль оси до последнего допустимого, размер — от центра до касания; спек «Размеры выделенной коммуникации», «Правка чисел коммуникации», design D5). Тесты: `edit.test.ts` (CN-*, CE-*).
- [x] 2.4 `src/communications/pick.ts`: `hitCommunication` (spec «Выделение, перемещение…», «Ластик и удаление коммуникаций»). Тесты: `pick.test.ts`.

## 3. Ограничения правок стен

- [x] 3.1 `src/communications/guard.ts`: `violatesCommunications`, `communicationGuard` с нормалью касания (скольжение), `thicknessAllowedForCommunications`, `limitNewWall`, `squareAllowed` (spec wall-collision «Стены не налагаются на коммуникации», design D6, D7). Тесты: `guard.test.ts` (WV-*, WC-*).
- [x] 3.2 Подключить охранник к `limit(...)` в `src/wall-edit.ts` через `EditMode.communications?` (перемещение, группа, конец, ввод длины, орто-растяжение, увлекаемые стены). Тесты: `guard.test.ts` (WC-04…WC-16).
- [x] 3.3 Подключить проверку к толщине (`main.ts`/`thicknessAllowed`), фильтру привязки `src/wall-snap.ts`, `src/wall-merge.ts`, `src/auto-dimensions.ts` через `violatesCommunications` (design D6). Тесты: `guard.test.ts` (WV-*, WC-06*).
- [x] 3.4 План «Монтаж»: передать коммуникации в `EditMode` правок собственных стен (design D8). Тест: `guard.test.ts` (WC-10), `src/mounting-plans.test.ts`.

## 4. Планы и инструменты

- [x] 4.1 `Tool` получает `"riser"` и `"duct"`; `PLAN_TOOLS.measure` включает их в порядке спеки; «Демонтаж» и «Монтаж» без них (`src/plans.ts`, `src/doorway/openings-group.ts`; spec drawing-plans «Инструменты плана»). Тесты: `src/communications/plans.test.ts`, `src/plan-tools.test.ts`, `src/mounting-plans.test.ts`.
- [x] 4.2 `src/communications/communications-group.ts` (`groupButtonClick`, `groupPick`, `groupButtonActive`, `afterPlaceCommunication`) и `afterPlace` в `src/tool-mode.ts` для `riser`/`duct` (spec canvas-app «Панель группы «Коммуникации»», design D9). Тесты: `communications-group.test.ts`.
- [x] 4.3 Разметка `index.html` и стили: группа `tool-communications` после «Окно» с панелью `communications-panel` из кнопок `tool-riser`, `tool-duct`; иконка в стиле панели (spec canvas-app «Группы инструментов», «Вспомогательная панель инструмента»). Тесты: `src/doorway/popups-ui.test.ts` (PB-UI-02), `communications-group.test.ts` (UI-*).

## 5. Отображение и PDF

- [x] 5.1 `src/communications/communications-render.ts` и опции `RenderOptions` (`communications`, `selectedCommunications`, `communicationGhost`, `hoverCommunication`): окружность, прямоугольник с диагональю, подсветки, числа и размерные линии выделенной, тёмная схема (spec «Отображение коммуникаций», «Размеры выделенной коммуникации», design D10). Тесты: `render.test.ts` (CR-*, CN-*).
- [x] 5.2 Коммуникации на плане «Демонтаж» (`src/demolition/demolition-render.ts`, `DemolitionScene.communications?`) обычным цветом; на «Монтаже» в `drawScene` (spec «Коммуникации на всех планах»). Тесты: `render.test.ts` (DM-*, MP-*).
- [x] 5.3 PDF: `PlanPage.communications?`, `pagesOf` кладёт их на каждую страницу, `pageBounds`/`wallsBBox` учитывают, числа и выделение не передаются (`src/export/pdf.ts`; spec «Коммуникации в PDF»). Тесты: `pdf.test.ts` (CF-*).

## 6. Подключение в `src/main.ts` (DOM, проверка вручную по M-01…M-11 из `test-suite.md`)

- [x] 6.1 Инструменты «Стояк» и «Воздуховод»: призрак, клик ставит и выделяет, снятие инструмента, параметры новых (сеанс, не отменой), одна запись истории (spec «Установка коммуникации», «Группа «Коммуникации»…»).
- [x] 6.2 Выделение кликом без инструмента только на обмерочном плане; перетаскивание; редактор чисел и подчёркивание; Delete; ластик с приоритетом «размер → коммуникация → проём → стена»; фильтр по плану (на «Демонтаже» и «Монтаже» не выделяется, не стирается), рамка и стрелки не затрагивают (spec «Выделение, перемещение…», «Коммуникации на всех планах», wall-deletion «Ластик и удаление коммуникаций»).
- [x] 6.3 Рисование стены: `squareAllowed` для начала, `limitNewWall` для свободного конца и предварительного сегмента, нулевая стена не ставится (spec wall-collision «Рисование стены»); те же ограничения на плане «Монтаж».
- [x] 6.4 Ручная проверка в браузере M-01…M-11 (обмер, «Демонтаж», «Монтаж», PDF, тёмная схема, перезагрузка, undo/redo) и фиксация результата в `test-suite.md`/`TODO.md` (недокрытое DOM-проводкой — по правилу leftovers).

## 7. Итоговая проверка

- [x] 7.1 Форматирование, lint, `npx tsc --noEmit` и `npm run build`: без ошибок, без ослабления настроек.
- [x] 7.2 Одобренные тесты change: `npx vitest run src/communications src/plan-tools.test.ts src/mounting-plans.test.ts src/doorway/popups-ui.test.ts` — все зелёные, тесты не изменены (`git diff` по ним пуст относительно одобренной версии).
- [x] 7.3 Весь набор `npx vitest run` (интеграция и e2e в нём); при падении worker перезапустить файл отдельно (известная нестабильность, TODO.md).
- [x] 7.4 Мутационная проверка критичных модулей (`geometry.ts`, `guard.ts`, `edit.ts`, `placement.ts`): инструмента мутаций в проекте нет — прогнать ручные мутанты из `test-plan.md` «Mutation Targets» и убедиться, что их убивают тесты.
- [x] 7.5 `openspec validate add-communications` и `/opsx:verify`; финальный просмотр `git diff` на случайные изменения, отладочный код и мёртвый код; критичные замечания верификации исправить сразу.
- [x] 7.6 Архивация change, синхронизация спеков (учесть заметки `archive-move-access-denied` и переименование сценариев по `TODO.md`), коммит всех файлов change в текущей ветке без создания веток.
