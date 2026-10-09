## 1. Каталог планов и тип чертежа

Спецификация: `drawing-plans` «Каталог планов», «Активный план чертежа»; design D2. Утверждённые тесты: `src/plans.test.ts` (PL-01 … PL-06).

- [x] 1.1 Создать `src/plans.ts`: `PLANS` (единственная запись `measure` / «Обмерочный план»), `PlanId`, `DEFAULT_PLAN`, `isPlanId(value: unknown)`, `activePlanOf(drawing)`, `historyKey(drawingId, plan)` (для `measure` — `drawingId` без суффикса). Модуль без DOM и хранилища; `Drawing` импортируется как `import type`.
- [x] 1.2 В `src/types.ts` добавить `Drawing.activePlan?: PlanId` с комментарием, что `walls`, `dimensions`, `doorways` — содержимое плана `measure` (design D1). Другие поля `Drawing` не менять.

## 2. Хранение активного плана

Спецификация: `drawing-storage` «Активный план чертежа в документе»; design D3. Утверждённые тесты: `src/storage-plans.test.ts` (ST-01 … ST-07) и существующие `src/storage.test.ts`, `src/doorway/*-storage.test.ts`.

- [x] 2.1 В `src/storage.ts` (`parseStore`) копировать `activePlan` чертежа только если `isPlanId`; недопустимое значение отбрасывать (ключ не появляется), отсутствие поля не заменять явным `measure`. Версия документа остаётся 3; `isDrawing` и `serializeStore` не менять.

## 3. История плана

Спецификация: `drawing-history` «Независимость историй планов»; design D4. Утверждённые тесты: `src/history-plans.test.ts` (HI-01 … HI-07) и существующие `src/history.test.ts`.

- [x] 3.1 В `src/history.ts` добавить `planHistory(history, drawingId, plan)` = `drawingHistory(history, historyKey(drawingId, plan))`. Формат `HistoryStore` (`version: 2`) и валидацию не менять.

## 4. Страницы PDF и подбор форматов

Спецификация: `pdf-export` «Экспорт — упорядоченный список страниц», «Форматы учитывают все страницы»; `drawing-plans` «Одна страница PDF на каждый план»; design D5. Утверждённые тесты: `src/export/pdf-pages.test.ts` (PG-01 … PG-20) и существующие `src/export/*.test.ts`, `src/doorway/*-pdf.test.ts`, `src/theme-pdf.test.ts`, `src/room-area-render.test.ts`.

- [x] 4.1 В `src/export/pdf.ts` ввести `PlanPage` и `pagesOf(drawing)`: по странице на план каталога в порядке каталога; `doorways` — `[]`, если поля нет; чертёж не мутировать.
- [x] 4.2 Добавить `availableFormatsForPages(pages, scale)`: форматы, где помещается каждая страница по своим габаритам (стены, размеры, проёмы); пустая страница и пустой список не ограничивают.
- [x] 4.3 Добавить `buildPdfPages(pages, unit, scale, format, fontB64, name, date)`: первая страница — конструктор `jsPDF`, остальные — `addPage` того же формата; на каждой рамка, основная надпись и размещение по габаритам своей страницы, без сетки; входные данные не мутировать.
- [x] 4.4 Добавить `exportPages(pages, unit, scale, format, name)`; сделать `buildPdf`, `availableFormats`, `exportDrawing` однострочными обёртками над новыми функциями с прежними сигнатурами (approved-тесты).

## 5. Переключатель планов и подключение в приложении

Спецификация: `drawing-plans` «Активный план чертежа», «Переключатель планов»; design D6; `ui.md` (копировать паттерн `.unit`). Проверки: ручные MAN-01 … MAN-08 из `test-plan.md`.

- [x] 5.1 В `src/main.ts` заменить 6 вызовов `drawingHistory(historyStore, store.activeId)` на `planHistory(historyStore, store.activeId, activePlanOf(current()))`.
- [x] 5.2 В `src/main.ts` использовать `pagesOf(current())` в `syncFormats` (`availableFormatsForPages`; кнопка экспорта недоступна, если все страницы пусты) и в обработчике экспорта (`exportPages`).
- [x] 5.3 Добавить в `index.html` `#plan-switch` в `#tabbar` вторым рядом под `#tab-row` (вкладки и `#tab-add`; `#tabbar` — колонка); отрисовка кнопок из `PLANS`; стили в `src/style.css` по правилам `.unit`/`.unit.active` (ширина по подписи, светлая и тёмная темы).
- [x] 5.4 Реализовать `setPlan(id)` в `main.ts`: тот же план — ничего; иначе записать `current().activePlan`, `resetEditing()`, сбросить инструмент как `activate()`, `dirty = true`, обновить переключатель и кнопки истории, `redraw()`; в `activate()` синхронизировать переключатель. Выбор сцены активного плана — в одной функции.
- [x] 5.5 Проверить вручную MAN-01 … MAN-08 в браузере (перезапустить dev-сервер на `/draw-repair/`, бэкап `drawing`/`history` в localStorage, затем очистить); результат записать в `TODO.md` при отклонениях.

## 6. Проверка и завершение

- [x] 6.1 Запустить утверждённые тесты change: `npx vitest run src/plans.test.ts src/storage-plans.test.ts src/history-plans.test.ts src/export/pdf-pages.test.ts`.
- [x] 6.2 Запустить весь набор `npx vitest run`: существующие тесты зелёные без правок (в `git diff` нет изменений в `*.test.ts`/`*.test-utils.ts`).
- [x] 6.3 Typecheck и сборка: `npm run build` (`tsc` + `vite build`). Линтер и форматтер в проекте не настроены — отметить как неприменимые.
- [x] 6.4 Мутационное тестирование в проекте не настроено: опираться на ручные мутации из `test-validation.md` (повторить выборочно после реализации).
- [x] 6.5 `openspec validate drawing-plans`, затем `/opsx:verify drawing-plans`; критические расхождения исправить сразу.
- [x] 6.6 Просмотреть итоговый `git diff` на случайные изменения (без отладочного кода).
- [x] 6.7 Зафиксировать отложенное в `TODO.md`; архивировать change (`/opsx:archive`, синк спецификаций вручную — см. заметки по archive на Windows); добавить все файлы change в индекс и закоммитить в текущей ветке.
