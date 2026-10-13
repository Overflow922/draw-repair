## 1. Тип точки замера и её позиция

Спеки: `dimension-tool` «Точки замера на откосах элементов стены», «Привязка размеров к стенам» (изм.); design D1, D2, D3, D8.
Утверждённые тесты: `src/dimension-anchor.test.ts` (DA-1…DA-3c, DA-9…DA-16b, DA-21, DA-22, DA-32, DA-32b, DA-37b, DA-39).

- [x] 1.1 В `src/types.ts` ввести `EdgePoint` (поле `kind` необязательно и отсутствует у прежних записей) и `JambPoint` (`kind: "jamb"`, `elementId`, `jamb: "a" | "b"`, `face: 1 | -1`); `DimPoint` — их объединение; `Dimension.from/to` не меняются по смыслу.
- [x] 1.2 В `src/geometry.ts` расширить `dimPointPoint(point, walls, elements = [])`: для откоса — позиция по `jambsT` и `hostPoint(host, t, face · thickness/2)` из `src/doorway/doorway-faces.ts` (откос `a` — меньшая координата вдоль оси); `null`, если элемента или его опорной стены нет или стена вырождена; для граневой точки — прежний расчёт без изменений.
- [x] 1.3 Починить компиляцию остальных читателей точки (`src/auto-dimensions.ts`, `src/demolition/*`, `src/mounting/remnants.ts` и др.), сужая тип точки, но не меняя их поведение; запуск `tsc --noEmit` без ошибок.

## 2. Снап, попадание и уровень соседа

Спеки: `dimension-tool` «Инструмент «Размер»» (изм.), «Точки замера на откосах…»; design D5, D8.
Утверждённые тесты: `src/dimension-anchor-snap.test.ts` (DA-4…DA-8, DA-19, DA-20, DA-40), `src/dimension-anchor-pick.test.ts` (DA-47…DA-50), `src/dimension-anchor.test.ts` (DA-38).

- [x] 2.1 В `src/geometry.ts` добавить `nearestDimAnchor(p, walls, elements, radius)` → `{ point, anchor } | null`: кандидаты — вершины контура (результат `nearestEdgeIntersection`, оставшегося прежним) и четыре откосных угла каждого элемента; выбор ближайшего в радиусе; при равенстве расстояний в пределах 1e-9 побеждает вершина; вырожденные стены и элементы без опорной стены кандидатов не дают.
- [x] 2.2 Расширить `dimHitDistance(p, dim, walls, textFactor, elements = [])` и `dimLevelSnap(p, axis, dimensions, walls, radius, elements = [])`: точки-откосы разрешаются через `dimPointPoint(..., elements)`, прочее поведение прежнее.

## 3. Удаление, выбор и история

Спеки: `dimension-tool` «Удаление элемента удаляет размеры на его откосах»; design D6, D8.
Утверждённые тесты: `src/dimension-anchor-delete.test.ts` (DA-17…DA-17c, DA-23…DA-27), `src/dimension-anchor-pick.test.ts` (DA-45, DA-46).

- [x] 3.1 В `src/doorway/doorway-scene.ts` расширить `deleteObjects`: размеры с точкой-откосом на удаляемом элементе (явно выбранном или удаляемом каскадом вместе с опорной стеной) удаляются; ссылки на грани проверяются как прежде (`refsWall` не должен падать на точке-откосе).
- [x] 3.2 В `erasePick` и `pressPick` передавать `scene.doorways` в `dimHitDistance`, чтобы размер с откосами выбирался и стирался.
- [x] 3.3 В `src/history.ts` научить `cloneScene` копировать оба вида точек без потерь и без общих ссылок.

## 4. Формат хранения

Спеки: `drawing-storage` «Формат документа» (изм.); design D7, D8.
Утверждённые тесты: `src/dimension-anchor-storage.test.ts` (DA-28…DA-33b).

- [x] 4.1 В `src/storage.ts` принять в `isDimension` и скопировать в `copyDimension` оба вида точек: без `kind` — граневая; `kind: "jamb"` — только при непустом `elementId`, `jamb` `a`/`b`, `face` `1`/`-1`; любой другой `kind` отвергается (в том числе при корректных `a` и `b`); ссылка на отсутствующий элемент форматом не проверяется. Формат документа остаётся версии 3.
- [x] 4.2 Убедиться, что загрузка чертежа, плана «Монтаж» и `parseHistory` используют те же проверки (битый размер отбрасывается по одному, стены и прочие данные сохраняются).

## 5. План «Монтаж»

Спеки: `dimension-tool` «Точки замера на откосах…» (на каждом плане), `drawing-storage`; design D8.
Утверждённые тесты: `src/dimension-anchor-render.test.ts` (DA-37…DA-37g, DA-44, DA-44b).

- [x] 5.1 В `src/mounting/mounting-scene.ts` размер показывать только если обе его точки разрешимы: для откоса — элемент входит в видимые элементы сцены и его стена среди `walls` сцены; для граней — обе стены среди `walls`; ни при каких ссылках не бросать исключений.

## 6. Отрисовка и PDF

Спеки: `dimension-tool` «Отрисовка размера», «Точки замера на откосах…»; design D4, D8.
Утверждённые тесты: `src/dimension-anchor-render.test.ts` (DA-34…DA-34e, DA-36, DA-43…DA-43d, DA-44c), `src/dimension-anchor-pdf.test.ts` (DA-35…DA-35e).

- [x] 6.1 В `src/render.ts` рисовать размеры всех видов (`dimensions`, `hoverDim`, `selectedDims`, `marqueeHits.dims`) по `opts.doorways`.
- [x] 6.2 В `src/export/pdf.ts` учитывать размеры с откосами в `wallsBBox`/`pageBounds` и передавать элементы страницы (обмер, «Монтаж») в расчёт точек; размер на недействительной ссылке габарит не расширяет.

## 7. Подключение в `main.ts`

Спеки: `dimension-tool` «Инструмент «Размер»», «Точки замера на откосах…», «Привязка третьего клика к уровню соседа»; design D4, D5.
Маршрутизация `main.ts` автотестами не покрыта (см. test-plan «Out of Scope») — проверяется задачей 9.

- [x] 7.1 В `placeDimension` и в расчёте отметки снапа/резинки (`drawMeasurePlan`) заменить `nearestEdgeIntersection` на `nearestDimAnchor(raw, walls, doorways, radiusCm())`; в черновике и в размерах хранить `anchor`.
- [x] 7.2 Передавать `doorways` во все читатели точек в `main.ts`: `endPoint`, `dimDraftGeometry`, `dimLevelSnap` при размещении и перетаскивании размерной линии, `eraserTarget`, рамку (`marqueePicks`), выбор размера.
- [x] 7.3 Убедиться, что ввод и правка размера на откосах не оставляют подвешенных ссылок: удаление через ластик, Delete и рамку идёт через `deleteObjects` (одна запись истории).
- [x] 7.4 Если для новых путей нужен UI-элемент или жест — использовать только существующие (инструмент «Размер», три клика); новых виджетов не вводить (`.claude/rules/ui.md`).

## 8. Чистка

- [x] 8.1 Убрать отладочный код и неиспользуемые импорты в изменённых файлах; проверить `git diff` на случайные правки (в том числе вне файлов этого change); `src/auto-dimensions.test.ts` содержит ровно одну добавленную строку (`test-change-request.md`).

## 9. Проверка

- [x] 9.1 Запустить утверждённые тесты change: `npx vitest run src/dimension-anchor` (все 147 тестов зелёные), плюс `src/auto-dimensions.test.ts`.
- [x] 9.2 Запустить весь набор `npx vitest run` и `node node_modules/typescript/bin/tsc --noEmit` без ошибок; форматтер и линтер в проекте не настроены (`package.json`) — зафиксировать это в отчёте; мутационного инструмента в проекте нет (ручные мутанты валидатора в `test-validation.md`).
- [x] 9.3 Ручная проверка в браузере (память `browser-manual-checks`: перезапуск dev-сервера на `/draw-repair/`, подмена чертежа в `localStorage`, события `click`/`PointerEvent`): в стене два окна → «Размер» → клик у откоса первого окна и откоса второго → размер между окнами; отметка снапа у каждого из четырёх углов; угол стены побеждает откос вплотную к торцу; третий клик привязывается к уровню соседа; Esc и двойной клик; нулевой размер не создаётся; сдвиг окна и удлинение стены двигают размер; удаление окна ластиком и Delete убирает размер, «Отменить» возвращает оба; сохранение и перезагрузка; PDF; планы «Обмер» и «Монтаж»; комната из четырёх стен, нарисованная стена за стеной.
- [x] 9.4 `openspec validate add-opening-dimension-anchors --strict` и `/opsx:verify` (специфицированные поведения реализованы; критичные замечания исправляются сразу, прочее — в `TODO.md` по `.claude/rules/leftovers.md`).
- [x] 9.5 Финальный просмотр `git diff` и закрытие change: архивирование (память `archive-move-access-denied`: копирование + удаление, ручной sync спек), `git add` всех файлов change и коммит на текущей ветке без создания веток (память `git-commit-message-powershell`: сообщение через файл).
