## 1. Каталог планов, наборы инструментов, типы

Спецификация: `drawing-plans` «Каталог планов», «Инструменты плана»; design D1. Утверждённые тесты: `src/plan-tools.test.ts` (PT-01 … PT-04), `src/plans.test.ts` (PL-01 с TCR-1) и существующие.

- [x] 1.1 В `src/types.ts` добавить `DemolitionMark` и `Drawing.demolition?: DemolitionMark[]` (необязательное поле, комментарий про план «Демонтаж»).
- [x] 1.2 В `src/doorway/openings-group.ts` расширить `Tool` значением `"demolition"`.
- [x] 1.3 В `src/plans.ts` добавить в `PLANS` план `demolition` / «Демонтаж» после `measure`; `PLAN_TOOLS`, `toolsOf(plan)`, `defaultToolOf(plan)` (набор обмерочного плана — прежние инструменты; демонтаж — `demolition`, `ruler`).

## 2. Домен пометок: модель и слияние

Спецификация: `demolition-plan` «Пометка сноса», «Что сносится и что нет», «Участки одной стены не пересекаются»; design D2. Утверждённые тесты: `src/demolition/marks.test.ts` (DM-xx), `src/demolition/demolition.test-utils.ts`.

- [x] 2.1 Создать `src/demolition/marks.ts`: `EPS_CM`, `MIN_WIDTH_CM`, `ResolvedMark`, `span`, `canDemolish`, `effectiveMarks`, `addMark` (слияние, якорь по середине, тот же массив без изменений, `newId`), `removeMark`, `mergeAll`, `markAt`.

## 3. Область сноса и скрытие элементов

Спецификация: `demolition-plan` «Пометка сноса», «Элементы стены в зоне сноса»; design D3. Утверждённые тесты: `src/demolition/mark-region.test.ts` (RG-xx).

- [x] 3.1 Создать `src/demolition/mark-region.ts`: `markRegion` (форма `displayPolygons`, обрезка `clipHalfPlane` по `from`/`to` при удалении от концов более `EPS_CM`), `hiddenElements`, `visibleElements` (перекрытие откосов `jambsT` более `EPS_CM`).

## 4. Узлы и привязка

Спецификация: `demolition-plan` «Привязка участка к узлам»; design D4. Утверждённые тесты: `src/demolition/mark-snap.test.ts` (ND-xx).

- [x] 4.1 Создать `src/demolition/mark-snap.ts`: `alongNodes` (концы, откосы элементов, границы форм других стен, обрезанных полосой этой стены; сортировка, слияние в пределах `EPS_CM`, отсечение вне `[0, len]`), `snapAlong` (ближайший узел в радиусе включительно, иначе целый сантиметр, зажим в `[0, len]`).

## 5. Числа участка

Спецификация: `demolition-plan` «Выделение пометки и правка чисел на месте»; design D5. Утверждённые тесты: `src/demolition/mark-numbers.test.ts` (NU-xx).

- [x] 5.1 Создать `src/demolition/mark-numbers.ts`: `numbersOf`, `editNumber` (правила `gapA`/`width`/`gapB`, зажим, отказ `null`, слияние, идентификатор слитой пометки), `markNumberLayout`, `markLabelSpot`, `markNumberAt` (раскладка по образцу `editableNumbers`, `formatLength`).

## 6. Перенос привязки при слиянии стен

Спецификация: `demolition-plan` «Участок следует за стеной»; design D6. Утверждённые тесты: `src/demolition/mark-follow.test.ts` (FL-xx).

- [x] 6.1 Создать `src/demolition/mark-follow.ts`: `reanchorMarks(marks, before, after)` — только при удлинении одной вершины на том же луче; привязка на неподвижный конец с расстояниями по старой стене.

## 7. Хранение и история

Спецификация: `drawing-storage` «Пометки сноса в документе», `drawing-history` «История плана «Демонтаж»»; design D7. Утверждённые тесты: `src/demolition/mark-storage.test.ts` (ST-xx), `src/demolition/mark-history.test.ts` (HI-xx), существующие `src/storage*.test.ts`, `src/history*.test.ts`.

- [x] 7.1 В `src/storage.ts` добавить `isDemolitionMark`; в `parseStore` читать `demolition` (отбрасывать некорректные и со стеной вне чертежа, `mergeAll`, поле не дописывать при отсутствии, не-массив читать как отсутствие).
- [x] 7.2 В `src/history.ts` расширить `HistoryEntry` записью `demolition`, добавить `recordMarks`, `undoMarks`, `redoMarks` (копии снимков, срез повтора, лимит), принять запись в `isHistoryEntry` с проверкой пометок.

## 8. Отрисовка

Спецификация: `demolition-plan` «Отображение плана «Демонтаж»»; design D8. Утверждённые тесты: `src/demolition/demolition-render.test.ts` (RN-xx) и существующие `src/*render*.test.ts`, `src/theme*.test.ts`.

- [x] 8.1 В `src/render.ts`: опция `RenderOptions.underlay` (без подписей помещений, размеров и `drawDoorways`; вырезы остаются), экспорт штриховки для повторного использования с направлением 135°. Палитру не менять.
- [x] 8.2 Создать `src/demolition/demolition-render.ts`: `drawDemolitionScene` (подложка серая, закраска бумагой, красный контур и штриховка 135°, подписи ширины, числа выделенной, превью) и `demolitionColor(theme)`.

## 9. PDF

Спецификация: `pdf-export` «Страница плана «Демонтаж»»; design D9. Утверждённые тесты: `src/export/demolition-pdf.test.ts` (PG-xx), `src/export/pdf-pages.test.ts` (TCR-2) и существующие PDF-тесты.

- [x] 9.1 В `src/export/pdf.ts`: `PlanPage.demolition?`, `pagesOf` — вторая страница демонтажа (подложка, без размеров, видимые элементы, действующие пометки), `drawPage` — ветка `drawDemolitionScene` с `PDF_METRICS`, без сетки, светлая палитра и светлый красный.

## 10. Инструмент «Демонтаж»

Спецификация: `demolition-plan` «Инструмент «Демонтаж»», «Привязка участка к узлам», «Выделение пометки и правка чисел на месте»; design D10. Утверждённые тесты: `src/demolition/demolition-tool.test.ts` (TL-xx).

- [x] 10.1 Создать `src/demolition/demolition-tool.ts`: `DemolitionToolHost`, `createDemolitionTool` — жесты (`down`/`move`/`up`/`cancel`), превью `ghost`, привязка, выделение, `deleteSelected`, `numberAt`, `applyNumber`; порядок `record` → `setMarks` → `changed`, перерисовка по ходу жеста.

## 11. Подключение в приложении

Спецификация: `drawing-plans` «Переключатель планов», «Инструменты плана»; `demolition-plan` (все требования, UI); design D10; `ui.md` (копировать существующие паттерны кнопок). Проверки: ручные MAN-01 … MAN-16 из `test-plan.md`.

- [x] 11.1 `index.html`, `src/style.css`: кнопка `#tool-demolition` с SVG-иконкой в стиле остальных кнопок инструментов, без вспомогательной панели; показ кнопок инструментов по `toolsOf(plan)` (атрибут `hidden`).
- [x] 11.2 `src/main.ts`: хост и адаптер инструмента; делегирование обработчиков холста левой кнопки и `keydown` (Delete, Escape) адаптеру на плане «Демонтаж»; выбор инструмента `demolition`; редактор числа поверх `openNumberEditor`; `activate()` сбрасывает адаптер и ставит `defaultToolOf(plan)`.
- [x] 11.3 `src/main.ts`: `redraw()` плана «Демонтаж» через `drawDemolitionScene` (цвет по теме, видимые элементы, действующие пометки, превью и выделение); `undo`/`redo` плана через `undoMarks`/`redoMarks`; `reanchorMarks` после успешного слияния в `commitPoint`; «Линейка» по стенам подложки.
- [x] 11.4 Проверить вручную MAN-01 … MAN-16 в браузере (перезапустить dev-сервер на `/draw-repair/`, бэкап `drawing`/`history` в localStorage, затем очистить); отклонения записать в `TODO.md`.

## 12. Проверка и завершение

- [x] 12.1 Запустить утверждённые тесты change: `npx vitest run src/plans.test.ts src/plan-tools.test.ts src/demolition src/export/pdf-pages.test.ts src/export/demolition-pdf.test.ts`.
- [x] 12.2 Запустить весь набор `npx vitest run`: существующие тесты зелёные; в `git diff` изменены только два тестовых файла TCR (`src/plans.test.ts`, `src/export/pdf-pages.test.ts`) и ни один тестовый файл не изменён после валидации.
- [x] 12.3 Typecheck и сборка: `npm run build`. Линтер и форматтер в проекте не настроены — отметить как неприменимые.
- [x] 12.4 Мутационного инструмента в проекте нет: опираться на ручные мутации из `test-validation.md` (повторить выборочно после реализации).
- [x] 12.5 `openspec validate demolition-plan --type change`, затем `/opsx:verify demolition-plan`; критические расхождения исправить сразу.
- [x] 12.6 Просмотреть итоговый `git diff` на случайные изменения (без отладочного кода).
- [x] 12.7 Зафиксировать отложенное в `TODO.md` (необязательные усиления тестов из `test-validation.md`, размеры/площади на плане демонтажа, графа 5 основной надписи); архивировать change (`/opsx:archive`, синк спецификаций вручную через ReadAllText/WriteAllText без функций с именами алиасов); добавить все файлы change в индекс и закоммитить в текущей ветке.
