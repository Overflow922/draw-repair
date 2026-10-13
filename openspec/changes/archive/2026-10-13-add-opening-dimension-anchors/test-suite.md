# Test Suite

Тесты написаны Test Writer'ом против интерфейса из `design.md` D8 (`dimPointPoint(point, walls, elements?)`,
`nearestDimAnchor`, `dimHitDistance`/`dimLevelSnap` с `elements?`, `erasePick`/`pressPick`, `deleteObjects`,
`cloneScene`, `isDimension`/`parseStore`, `mountingScene`, `drawScene`/`buildPdf`/`wallsBBox`/`pagesOf`).
Продакшн-код не менялся. Новые файлы: `src/dimension-anchor*.test.ts` и `src/dimension-anchor.test-utils.ts`
(сцены F2, FB, FD, FC, R2 и эталоны — вручную из спецификации и геометрии). Всего 147 новых тестов
(параметризованные `it.each` развёрнуты), все обнаружены раннером (`npx vitest run src/dimension-anchor`).
Раунд 3 (после второй валидации): DA-47c переписан (курсор на уровне непараллельного соседа — иначе тест не мог упасть), добавлены DA-47f (ровно на радиусе) и DA-49c (допуск именно 1e-9).
Раунд 2 (после первой валидации): исправлены DA-5d и фильтр `lineThrough` (DA-34, DA-34d, DA-36); добавлены DA-43…DA-50,
DA-37f/g, DA-44c, вариант `kind: "wat"` с корректными `a`/`b` в DA-31. Утверждённый тест AD-30
(`src/auto-dimensions.test.ts`) изменён одной строкой сужения типа по `test-change-request.md`.

## Tests

| ID | Requirement | Test File | Test Name | Initial Result |
|---|---|---|---|---|
| DA-23 | dimension-tool: Удаление элемента удаляет размеры на его откосах | `src/dimension-anchor-delete.test.ts` | DA-23: размер между окнами уходит с удалённым окном, второе окно остаётся | FAIL (expected) |
| DA-23b | dimension-tool: Удаление элемента удаляет размеры на его откосах | `src/dimension-anchor-delete.test.ts` | DA-23b: порядок не важен — удаляется окно, на чьём откосе лежит вторая точка размера | FAIL (expected) |
| DA-23c | dimension-tool: Удаление элемента удаляет размеры на его откосах | `src/dimension-anchor-delete.test.ts` | DA-23c: откос и вершина контура в одном размере — размер уходит с элементом | FAIL (expected) |
| DA-26 | dimension-tool: Удаление элемента удаляет размеры на его откосах | `src/dimension-anchor-delete.test.ts` | DA-26: размеры между углами стен и к откосам другого элемента остаются | FAIL (expected) |
| DA-26b | dimension-tool: Удаление элемента удаляет размеры на его откосах | `src/dimension-anchor-delete.test.ts` | DA-26b: удаление элемента без размеров не трогает список размеров | FAIL (expected) |
| DA-26c | dimension-tool: Удаление элемента удаляет размеры на его откосах | `src/dimension-anchor-delete.test.ts` | DA-26c: размер с откосом удаляемого элемента не задевает размеры оставшихся стен | PASS (unexpected, see notes) |
| DA-25 | dimension-tool: Удаление элемента удаляет размеры на его откосах | `src/dimension-anchor-delete.test.ts` | DA-25: удаление стены удаляет её окна и размеры к откосам этих окон, включая вторую точку на другой стене | FAIL (expected) |
| DA-25b | dimension-tool: Удаление элемента удаляет размеры на его откосах | `src/dimension-anchor-delete.test.ts` | DA-25b: удаление стены каскадом убирает и граневые размеры стены, и размеры к её откосам | FAIL (expected) |
| DA-25c | dimension-tool: Удаление элемента удаляет размеры на его откосах | `src/dimension-anchor-delete.test.ts` | DA-25c: размер к откосу окна на удаляемой стене и граневая вершина другой стены — уходит | FAIL (expected) |
| DA-27 | dimension-tool: Удаление элемента удаляет размеры на его откосах | `src/dimension-anchor-delete.test.ts` | DA-27: рамкой выбраны оба окна и их общий размер — размер удалён один раз, чужие целы | FAIL (expected) |
| DA-24 | dimension-tool: Удаление элемента (история, отмена/повтор) | `src/dimension-anchor-delete.test.ts` | DA-24: «Отменить» возвращает окно и размер с прежними откосами и смещением одной записью | FAIL (expected) |
| DA-17 | dimension-tool: Удаление элемента (история, отмена/повтор) | `src/dimension-anchor-delete.test.ts` | DA-17: cloneScene копирует точки-откосы без потерь и без общих ссылок | FAIL (expected) |
| DA-17b | dimension-tool: Удаление элемента (история, отмена/повтор) | `src/dimension-anchor-delete.test.ts` | DA-17b: отмена и повтор — размер с откосами исчезает и возвращается с теми же откосами и смещением | FAIL (expected) |
| DA-17c | dimension-tool: Удаление элемента (история, отмена/повтор) | `src/dimension-anchor-delete.test.ts` | DA-17c: откос не теряет поля при записи в историю, а запись остаётся независимой от сцены | FAIL (expected) |
| DA-35 | dimension-tool: Отрисовка / подсветка / PDF / попадание в размер с откосами | `src/dimension-anchor-pdf.test.ts` | DA-35: сцена PDF получает размеры и элементы и рисует число между откосами | FAIL (expected) |
| DA-35b | dimension-tool: Отрисовка / подсветка / PDF / попадание в размер с откосами | `src/dimension-anchor-pdf.test.ts` | DA-35b: число в PDF следует единицам — в мм 800 | FAIL (expected) |
| DA-35c | dimension-tool: Отрисовка / подсветка / PDF / попадание в размер с откосами | `src/dimension-anchor-pdf.test.ts` | DA-35c: размер на откосе отсутствующего элемента не рисуется и экспорт не падает | FAIL (expected) |
| DA-35d | dimension-tool: Отрисовка / подсветка / PDF / попадание в размер с откосами | `src/dimension-anchor-pdf.test.ts` | DA-35d: габарит листа включает размерную линию размера с откосами, вынесенную далеко от стены | FAIL (expected) |
| DA-35e | dimension-tool: Отрисовка / подсветка / PDF / попадание в размер с откосами | `src/dimension-anchor-pdf.test.ts` | DA-35e: размер на откосе отсутствующего элемента габарит не расширяет | FAIL (expected) |
| DA-45 | wall-deletion «Ластик» / выбор размера с откосами | `src/dimension-anchor-pick.test.ts` | DA-45: erasePick на размерной линии даёт размер, а не элемент и не стену | FAIL (expected) |
| DA-45b | wall-deletion «Ластик» / выбор размера с откосами | `src/dimension-anchor-pick.test.ts` | DA-45b: erasePick на теле окна без размера рядом даёт элемент | FAIL (expected) |
| DA-45c | wall-deletion «Ластик» / выбор размера с откосами | `src/dimension-anchor-pick.test.ts` | DA-45c: erasePick мимо размера в 10 см — размер не выбирается | FAIL (expected) |
| DA-46 | wall-deletion «Ластик» / выбор размера с откосами | `src/dimension-anchor-pick.test.ts` | DA-46: pressPick с включёнными размерами на размерной линии даёт размер | FAIL (expected) |
| DA-46b | wall-deletion «Ластик» / выбор размера с откосами | `src/dimension-anchor-pick.test.ts` | DA-46b: pressPick при выключенных размерах размер не выбирает | PASS (unexpected, see notes) |
| DA-47 | dimension-tool: Привязка третьего клика к уровню соседа (с откосами) | `src/dimension-anchor-pick.test.ts` | DA-47: курсор в 2 см от уровня соседа с откосами — уровень соседа (смещение 30, точка на линии) | FAIL (expected) |
| DA-47b | dimension-tool: Привязка третьего клика к уровню соседа (с откосами) | `src/dimension-anchor-pick.test.ts` | DA-47b: вне радиуса привязки уровень не предлагается | FAIL (expected) |
| DA-47c | dimension-tool: Привязка третьего клика к уровню соседа (с откосами) | `src/dimension-anchor-pick.test.ts` | DA-47c: размер с откосами, непараллельный новой оси, уровня не даёт | FAIL (expected) |
| DA-47d | dimension-tool: Привязка третьего клика к уровню соседа (с откосами) | `src/dimension-anchor-pick.test.ts` | DA-47d: элементы не переданы — сосед с откосами не разрешается, уровня нет | FAIL (expected) |
| DA-47e | dimension-tool: Привязка третьего клика к уровню соседа (с откосами) | `src/dimension-anchor-pick.test.ts` | DA-47e: из двух соседей выбирается ближайший по уровню | FAIL (expected) |
| DA-47f | dimension-tool: Привязка третьего клика к уровню соседа (с откосами) | `src/dimension-anchor-pick.test.ts` | DA-47f: ровно на радиусе от уровня соседа привязка есть, дальше на 0.01 — нет | FAIL (expected) |
| DA-48 | dimension-tool: Инструмент «Размер» / Точки замера (снап, радиус, вершина при равенстве, несколько кандидатов) | `src/dimension-anchor-pick.test.ts` | DA-48: курсор между откосами соседних окон — ближайший, независимо от порядка элементов | FAIL (expected) |
| DA-48b | dimension-tool: Инструмент «Размер» / Точки замера (снап, радиус, вершина при равенстве, несколько кандидатов) | `src/dimension-anchor-pick.test.ts` | DA-48b: два откоса одного окна в 4 см — каждый у своего курсора | FAIL (expected) |
| DA-48c | dimension-tool: Инструмент «Размер» / Точки замера (снап, радиус, вершина при равенстве, несколько кандидатов) | `src/dimension-anchor-pick.test.ts` | DA-48c: ближайший из откосов разных граней одного элемента — по расстоянию, а не по грани | FAIL (expected) |
| DA-49 | dimension-tool: Инструмент «Размер» / Точки замера (снап, радиус, вершина при равенстве, несколько кандидатов) | `src/dimension-anchor-pick.test.ts` | DA-49: откос смещён от вершины на 1e-12 — это равенство, побеждает вершина | FAIL (expected) |
| DA-49b | dimension-tool: Инструмент «Размер» / Точки замера (снап, радиус, вершина при равенстве, несколько кандидатов) | `src/dimension-anchor-pick.test.ts` | DA-49b: откос ближе вершины на заметную величину (0.02 см) — побеждает откос | FAIL (expected) |
| DA-49c | dimension-tool: Инструмент «Размер» / Точки замера (снап, радиус, вершина при равенстве, несколько кандидатов) | `src/dimension-anchor-pick.test.ts` | DA-49c: откос ближе вершины на 1e-7 — это уже не равенство, побеждает откос (допуск именно 1e-9) | FAIL (expected) |
| DA-50 | dimension-tool: Инструмент «Размер» / Точки замера (снап, радиус, вершина при равенстве, несколько кандидатов) | `src/dimension-anchor-pick.test.ts` | DA-50: вырожденная стена с элементом — снап ничего не предлагает | FAIL (expected) |
| DA-34 | dimension-tool: Отрисовка / подсветка / PDF / попадание в размер с откосами | `src/dimension-anchor-render.test.ts` | DA-34: размерная линия и число 80 рисуются между откосами окон | FAIL (expected) |
| DA-34b | dimension-tool: Отрисовка / подсветка / PDF / попадание в размер с откосами | `src/dimension-anchor-render.test.ts` | DA-34b: число размера лежит над серединой линии, а не у начала координат | FAIL (expected) |
| DA-34c | dimension-tool: Отрисовка / подсветка / PDF / попадание в размер с откосами | `src/dimension-anchor-render.test.ts` | DA-34c: единицы отображения — число в мм | FAIL (expected) |
| DA-34d | dimension-tool: Отрисовка / подсветка / PDF / попадание в размер с откосами | `src/dimension-anchor-render.test.ts` | DA-34d: без списка элементов размер с откосами не рисуется — число не появляется | FAIL (expected) |
| DA-36 | dimension-tool: Отрисовка / подсветка / PDF / попадание в размер с откосами | `src/dimension-anchor-render.test.ts` | DA-36: размер на откосе отсутствующего элемента не рисуется и не бросает | FAIL (expected) |
| DA-34e | dimension-tool: Отрисовка / подсветка / PDF / попадание в размер с откосами | `src/dimension-anchor-render.test.ts` | DA-34e: размер с откосом наравне с граневым размером — оба рисуются | FAIL (expected) |
| DA-43 | dimension-tool: Отрисовка / подсветка / PDF / попадание в размер с откосами | `src/dimension-anchor-render.test.ts` | DA-43: подсветка ластика (hoverDim) рисует размер с откосами цветом erase | FAIL (expected) |
| DA-43b | dimension-tool: Отрисовка / подсветка / PDF / попадание в размер с откосами | `src/dimension-anchor-render.test.ts` | DA-43b: выделенный размер (selectedDims) рисуется цветом selectedDim | FAIL (expected) |
| DA-43c | dimension-tool: Отрисовка / подсветка / PDF / попадание в размер с откосами | `src/dimension-anchor-render.test.ts` | DA-43c: размер в рамке выделения (marqueeHits.dims) рисуется цветом marqueeDim | FAIL (expected) |
| DA-43d | dimension-tool: Отрисовка / подсветка / PDF / попадание в размер с откосами | `src/dimension-anchor-render.test.ts` | DA-43d: обычный размер с откосами рисуется цветом ink и не цветом подсветки | FAIL (expected) |
| DA-37 | mounting-plan: размеры и снап на остатках (сцена «Монтаж») | `src/dimension-anchor-render.test.ts` | DA-37: размер «Монтажа» на откосах видимых старых элементов остаётся в сцене и разрешается в остатке | FAIL (expected) |
| DA-37c | mounting-plan: размеры и снап на остатках (сцена «Монтаж») | `src/dimension-anchor-render.test.ts` | DA-37c: размер на откосах собственного элемента собственной стены остаётся в сцене | FAIL (expected) |
| DA-37d | mounting-plan: размеры и снап на остатках (сцена «Монтаж») | `src/dimension-anchor-render.test.ts` | DA-37d: размер на откосе отсутствующего элемента скрыт и не роняет сцену | FAIL (expected) |
| DA-37f | mounting-plan: размеры и снап на остатках (сцена «Монтаж») | `src/dimension-anchor-render.test.ts` | DA-37f: у размера «откос + отсутствующий элемент» скрыт при любом порядке точек | FAIL (expected) |
| DA-37g | mounting-plan: размеры и снап на остатках (сцена «Монтаж») | `src/dimension-anchor-render.test.ts` | DA-37g: смешанный размер «откос + грань отсутствующей стены» скрыт в обоих порядках | FAIL (expected) |
| DA-44 | mounting-plan: размеры и снап на остатках (сцена «Монтаж») | `src/dimension-anchor-render.test.ts` | DA-44: снап на сцене «Монтаж» с остатком стены даёт откос старого окна на остатке | FAIL (expected) |
| DA-44b | mounting-plan: размеры и снап на остатках (сцена «Монтаж») | `src/dimension-anchor-render.test.ts` | DA-44b: снап на сцене «Монтаж» даёт откос собственного окна собственной стены | FAIL (expected) |
| DA-44c | mounting-plan: размеры и снап на остатках (сцена «Монтаж») | `src/dimension-anchor-render.test.ts` | DA-44c: страница PDF «Монтаж» получает размер с откосами и расширяет габарит листа | FAIL (expected) |
| DA-37e | mounting-plan: размеры и снап на остатках (сцена «Монтаж») | `src/dimension-anchor-render.test.ts` | DA-37e: собственный элемент на отсутствующей стене — его размер скрыт | FAIL (expected) |
| DA-41 | dimension-tool: последовательности стен; авторазмеры не затронуты | `src/dimension-anchor-sequence.test.ts` | DA-41: порядок W→R→B→L — после каждой стены откосы окон на W не сдвигаются, расстояние 80 | FAIL (expected) |
| DA-41 | dimension-tool: последовательности стен; авторазмеры не затронуты | `src/dimension-anchor-sequence.test.ts` | DA-41: порядок W→L→B→R — после каждой стены откосы окон на W не сдвигаются, расстояние 80 | FAIL (expected) |
| DA-41 | dimension-tool: последовательности стен; авторазмеры не затронуты | `src/dimension-anchor-sequence.test.ts` | DA-41: порядок R→W→L→B — после каждой стены откосы окон на W не сдвигаются, расстояние 80 | FAIL (expected) |
| DA-41 | dimension-tool: последовательности стен; авторазмеры не затронуты | `src/dimension-anchor-sequence.test.ts` | DA-41: порядок B→R→L→W — после каждой стены откосы окон на W не сдвигаются, расстояние 80 | FAIL (expected) |
| DA-41b | dimension-tool: последовательности стен; авторазмеры не затронуты | `src/dimension-anchor-sequence.test.ts` | DA-41b: в готовой комнате снап по-прежнему даёт откосы на обеих гранях W и вершины у углов | FAIL (expected) |
| DA-41c | dimension-tool: последовательности стен; авторазмеры не затронуты | `src/dimension-anchor-sequence.test.ts` | DA-41c: окно на B (ось в обратную сторону) — откосы на нормали (0, −1), не зависят от порядка стен | FAIL (expected) |
| DA-3b | dimension-tool: Точки замера на откосах (позиция, четыре точки) | `src/dimension-anchor-sequence.test.ts` | DA-3b: размер «откос окна — угол соседней стены» следует за поворотом соседней стены | FAIL (expected) |
| DA-42 | dimension-tool: последовательности стен; авторазмеры не затронуты | `src/dimension-anchor-sequence.test.ts` | DA-42: автоматические размеры стены граневые и не зависят от элементов | PASS (unexpected, see notes) |
| DA-42b | dimension-tool: последовательности стен; авторазмеры не затронуты | `src/dimension-anchor-sequence.test.ts` | DA-42b: пересчёт автоматических размеров не трогает ручной размер с откосами | PASS (unexpected, see notes) |
| DA-4 | dimension-tool: Точки замера на откосах (позиция, четыре точки) | `src/dimension-anchor-snap.test.ts` | DA-4: к каждому из четырёх откосных углов окна снап даёт именно этот откос и грань | FAIL (expected) |
| DA-4b | dimension-tool: Точки замера на откосах (позиция, четыре точки) | `src/dimension-anchor-snap.test.ts` | DA-4b: второе окно различается по идентификатору элемента | FAIL (expected) |
| DA-4c | dimension-tool: Точки замера на откосах (позиция, четыре точки) | `src/dimension-anchor-snap.test.ts` | DA-4c: откос двери с привязкой b — откос a у меньшей координаты | FAIL (expected) |
| DA-7c | dimension-tool: Инструмент «Размер» / Точки замера (снап, радиус, вершина при равенстве, несколько кандидатов) | `src/dimension-anchor-snap.test.ts` | DA-7c: у откоса на грани +1 соседняя грань −1 того же откоса не выбирается | FAIL (expected) |
| DA-5 | dimension-tool: Инструмент «Размер» / Точки замера (снап, радиус, вершина при равенстве, несколько кандидатов) | `src/dimension-anchor-snap.test.ts` | DA-5: откос вплотную к углу совпадает с вершиной — побеждает вершина контура | FAIL (expected) |
| DA-5b | dimension-tool: Инструмент «Размер» / Точки замера (снап, радиус, вершина при равенстве, несколько кандидатов) | `src/dimension-anchor-snap.test.ts` | DA-5b: курсор рядом с совпавшими точками — по-прежнему вершина, точка отметки та же | FAIL (expected) |
| DA-5c | dimension-tool: Инструмент «Размер» / Точки замера (снап, радиус, вершина при равенстве, несколько кандидатов) | `src/dimension-anchor-snap.test.ts` | DA-5c: окно на всю длину стены — у торцов побеждают вершины, а не откосы | FAIL (expected) |
| DA-5d | dimension-tool: Инструмент «Размер» / Точки замера (снап, радиус, вершина при равенстве, несколько кандидатов) | `src/dimension-anchor-snap.test.ts` | DA-5d: свободная стена, откос в 10 см от торца — вершины рядом нет, побеждает откос на обеих гранях | FAIL (expected) |
| DA-6 | dimension-tool: Инструмент «Размер» / Точки замера (снап, радиус, вершина при равенстве, несколько кандидатов) | `src/dimension-anchor-snap.test.ts` | DA-6: откос ближе вершины — побеждает откос | FAIL (expected) |
| DA-19 | dimension-tool: Инструмент «Размер» / Точки замера (снап, радиус, вершина при равенстве, несколько кандидатов) | `src/dimension-anchor-snap.test.ts` | DA-19: между вершиной и откосом выбирается ближайший к курсору | FAIL (expected) |
| DA-19b | dimension-tool: Инструмент «Размер» / Точки замера (снап, радиус, вершина при равенстве, несколько кандидатов) | `src/dimension-anchor-snap.test.ts` | DA-19b: вершина без элементов находится как прежде и совпадает с nearestEdgeIntersection | FAIL (expected) |
| DA-7b | dimension-tool: Инструмент «Размер» / Точки замера (снап, радиус, вершина при равенстве, несколько кандидатов) | `src/dimension-anchor-snap.test.ts` | DA-7b: ровно на радиусе от откоса точка находится, дальше на 0.01 — нет | FAIL (expected) |
| DA-7 | dimension-tool: Инструмент «Размер» / Точки замера (снап, радиус, вершина при равенстве, несколько кандидатов) | `src/dimension-anchor-snap.test.ts` | DA-7: клик на грани вне радиуса от откосов и вершин не задаёт точку | FAIL (expected) |
| DA-8 | dimension-tool: Инструмент «Размер» / Точки замера (снап, радиус, вершина при равенстве, несколько кандидатов) | `src/dimension-anchor-snap.test.ts` | DA-8: середина грани, ось и продолжение грани за торцом — точки нет | FAIL (expected) |
| DA-20 | dimension-tool: Инструмент «Размер» / Точки замера (снап, радиус, вершина при равенстве, несколько кандидатов) | `src/dimension-anchor-snap.test.ts` | DA-20: пересечения продолжений граней за торцом (середина торца) точек замера не дают | FAIL (expected) |
| DA-40 | dimension-tool: Инструмент «Размер» / Точки замера (снап, радиус, вершина при равенстве, несколько кандидатов) | `src/dimension-anchor-snap.test.ts` | DA-40: элементы не переданы — откос не предлагается | FAIL (expected) |
| DA-40b | dimension-tool: Инструмент «Размер» / Точки замера (снап, радиус, вершина при равенстве, несколько кандидатов) | `src/dimension-anchor-snap.test.ts` | DA-40b: элемент на отсутствующей стене откосов не даёт | FAIL (expected) |
| DA-28 | drawing-storage: Формат документа | `src/dimension-anchor-storage.test.ts` | DA-28: круг serializeStore → parseStore сохраняет откосы, грани и смещение | FAIL (expected) |
| DA-28b | drawing-storage: Формат документа | `src/dimension-anchor-storage.test.ts` | DA-28b: документ, записанный литералом формата kind/elementId/jamb/face, читается в такие же точки | FAIL (expected) |
| DA-28c | drawing-storage: Формат документа | `src/dimension-anchor-storage.test.ts` | DA-28c: точка-откос на каждой допустимой комбинации jamb и face восстанавливается | FAIL (expected) |
| DA-29 | drawing-storage: Формат документа | `src/dimension-anchor-storage.test.ts` | DA-29: размеры с откосами плана «Монтаж» хранятся и читаются так же | FAIL (expected) |
| DA-29b | drawing-storage: Формат документа | `src/dimension-anchor-storage.test.ts` | DA-29b: плохая точка-откос в «Монтаже» отбрасывает только свой размер | FAIL (expected) |
| DA-30 | drawing-storage: Формат документа | `src/dimension-anchor-storage.test.ts` | DA-30: размер из точек граней без kind читается и не получает kind | PASS (unexpected, see notes) |
| DA-30b | drawing-storage: Формат документа | `src/dimension-anchor-storage.test.ts` | DA-30b: isDimension принимает граневую точку без kind и откос | FAIL (expected) |
| DA-30c | drawing-storage: Формат документа | `src/dimension-anchor-storage.test.ts` | DA-30c: смешанный размер (грани и откос) читается без потерь | FAIL (expected) |
| DA-31 | drawing-storage: Формат документа | `src/dimension-anchor-storage.test.ts` | DA-31: нет elementId — размер отброшен, корректный размер и стены сохранены | FAIL (expected) |
| DA-31 | drawing-storage: Формат документа | `src/dimension-anchor-storage.test.ts` | DA-31: elementId пустой — размер отброшен, корректный размер и стены сохранены | FAIL (expected) |
| DA-31 | drawing-storage: Формат документа | `src/dimension-anchor-storage.test.ts` | DA-31: elementId не строка — размер отброшен, корректный размер и стены сохранены | FAIL (expected) |
| DA-31 | drawing-storage: Формат документа | `src/dimension-anchor-storage.test.ts` | DA-31: jamb c — размер отброшен, корректный размер и стены сохранены | FAIL (expected) |
| DA-31 | drawing-storage: Формат документа | `src/dimension-anchor-storage.test.ts` | DA-31: jamb отсутствует — размер отброшен, корректный размер и стены сохранены | FAIL (expected) |
| DA-31 | drawing-storage: Формат документа | `src/dimension-anchor-storage.test.ts` | DA-31: face 0 — размер отброшен, корректный размер и стены сохранены | FAIL (expected) |
| DA-31 | drawing-storage: Формат документа | `src/dimension-anchor-storage.test.ts` | DA-31: face 2 — размер отброшен, корректный размер и стены сохранены | FAIL (expected) |
| DA-31 | drawing-storage: Формат документа | `src/dimension-anchor-storage.test.ts` | DA-31: face строкой — размер отброшен, корректный размер и стены сохранены | FAIL (expected) |
| DA-31 | drawing-storage: Формат документа | `src/dimension-anchor-storage.test.ts` | DA-31: face отсутствует — размер отброшен, корректный размер и стены сохранены | FAIL (expected) |
| DA-31 | drawing-storage: Формат документа | `src/dimension-anchor-storage.test.ts` | DA-31: неизвестный kind — размер отброшен, корректный размер и стены сохранены | FAIL (expected) |
| DA-31 | drawing-storage: Формат документа | `src/dimension-anchor-storage.test.ts` | DA-31: неизвестный kind при корректных a и b — размер отброшен, корректный размер и стены сохранены | FAIL (expected) |
| DA-31 | drawing-storage: Формат документа | `src/dimension-anchor-storage.test.ts` | DA-31: kind jamb без полей — размер отброшен, корректный размер и стены сохранены | FAIL (expected) |
| DA-31b | drawing-storage: Формат документа | `src/dimension-anchor-storage.test.ts` | DA-31b: нет elementId — вторая точка размера тоже проверяется | FAIL (expected) |
| DA-31b | drawing-storage: Формат документа | `src/dimension-anchor-storage.test.ts` | DA-31b: elementId пустой — вторая точка размера тоже проверяется | FAIL (expected) |
| DA-31b | drawing-storage: Формат документа | `src/dimension-anchor-storage.test.ts` | DA-31b: elementId не строка — вторая точка размера тоже проверяется | FAIL (expected) |
| DA-31b | drawing-storage: Формат документа | `src/dimension-anchor-storage.test.ts` | DA-31b: jamb c — вторая точка размера тоже проверяется | FAIL (expected) |
| DA-31b | drawing-storage: Формат документа | `src/dimension-anchor-storage.test.ts` | DA-31b: jamb отсутствует — вторая точка размера тоже проверяется | FAIL (expected) |
| DA-31b | drawing-storage: Формат документа | `src/dimension-anchor-storage.test.ts` | DA-31b: face 0 — вторая точка размера тоже проверяется | FAIL (expected) |
| DA-31b | drawing-storage: Формат документа | `src/dimension-anchor-storage.test.ts` | DA-31b: face 2 — вторая точка размера тоже проверяется | FAIL (expected) |
| DA-31b | drawing-storage: Формат документа | `src/dimension-anchor-storage.test.ts` | DA-31b: face строкой — вторая точка размера тоже проверяется | FAIL (expected) |
| DA-31b | drawing-storage: Формат документа | `src/dimension-anchor-storage.test.ts` | DA-31b: face отсутствует — вторая точка размера тоже проверяется | FAIL (expected) |
| DA-31b | drawing-storage: Формат документа | `src/dimension-anchor-storage.test.ts` | DA-31b: неизвестный kind — вторая точка размера тоже проверяется | FAIL (expected) |
| DA-31b | drawing-storage: Формат документа | `src/dimension-anchor-storage.test.ts` | DA-31b: неизвестный kind при корректных a и b — вторая точка размера тоже проверяется | FAIL (expected) |
| DA-31b | drawing-storage: Формат документа | `src/dimension-anchor-storage.test.ts` | DA-31b: kind jamb без полей — вторая точка размера тоже проверяется | FAIL (expected) |
| DA-31c | drawing-storage: Формат документа | `src/dimension-anchor-storage.test.ts` | DA-31c: isDimension отвергает каждую битую точку-откос | PASS (unexpected, see notes) |
| DA-32 | drawing-storage: Формат документа | `src/dimension-anchor-storage.test.ts` | DA-32: размер с откосом несуществующего элемента загружается, документ не повреждён | FAIL (expected) |
| DA-32c | drawing-storage: Формат документа | `src/dimension-anchor-storage.test.ts` | DA-32c: размер на откосе элемента, отброшенного при загрузке, сам не отбрасывается форматом | FAIL (expected) |
| DA-33 | drawing-storage: Формат документа | `src/dimension-anchor-storage.test.ts` | DA-33: запись истории с точками-откосами проходит serialize → parse без потерь | FAIL (expected) |
| DA-33b | drawing-storage: Формат документа | `src/dimension-anchor-storage.test.ts` | DA-33b: запись истории с битой точкой-откосом не принимается | PASS (unexpected, see notes) |
| DA-1 | dimension-tool: Точки замера на откосах (позиция, четыре точки) | `src/dimension-anchor.test.ts` | DA-1: расстояние между окнами e1.b и e2.a — 80 по обеим граням | FAIL (expected) |
| DA-1b | dimension-tool: Точки замера на откосах (позиция, четыре точки) | `src/dimension-anchor.test.ts` | DA-1b: окна в разных стенах комнаты разрешаются каждое в своей стене | FAIL (expected) |
| DA-2 | dimension-tool: Точки замера на откосах (позиция, четыре точки) | `src/dimension-anchor.test.ts` | DA-2: четыре откосных угла каждого окна — обе грани, оба откоса | FAIL (expected) |
| DA-2b | dimension-tool: Точки замера на откосах (позиция, четыре точки) | `src/dimension-anchor.test.ts` | DA-2b: две грани одного откоса отстоят на толщину стены | FAIL (expected) |
| DA-2c | dimension-tool: Точки замера на откосах (позиция, четыре точки) | `src/dimension-anchor.test.ts` | DA-2c: толщина стены 40 — откосные грани на y = ±20 | FAIL (expected) |
| DA-3 | dimension-tool: Точки замера на откосах (позиция, четыре точки) | `src/dimension-anchor.test.ts` | DA-3: откос двери и угол стены в одном размере — длина 100 | FAIL (expected) |
| DA-3c | dimension-tool: Точки замера на откосах (позиция, четыре точки) | `src/dimension-anchor.test.ts` | DA-3c: привязка b не меняет смысл откосов — a меньшая координата вдоль оси | FAIL (expected) |
| DA-9 | dimension-tool: Точки замера на откосах (следование за элементом и стеной) | `src/dimension-anchor.test.ts` | DA-9: сдвиг окна вдоль стены сдвигает откосы | FAIL (expected) |
| DA-10 | dimension-tool: Точки замера на откосах (следование за элементом и стеной) | `src/dimension-anchor.test.ts` | DA-10: изменение ширины двигает только откос b | FAIL (expected) |
| DA-10b | dimension-tool: Точки замера на откосах (следование за элементом и стеной) | `src/dimension-anchor.test.ts` | DA-10b: ширина 1 см — откосы различимы, a левее b на 1 см | FAIL (expected) |
| DA-11 | dimension-tool: Точки замера на откосах (следование за элементом и стеной) | `src/dimension-anchor.test.ts` | DA-11: смена привязки при той же геометрии — откос a остаётся откосом a | FAIL (expected) |
| DA-11b | dimension-tool: Точки замера на откосах (следование за элементом и стеной) | `src/dimension-anchor.test.ts` | DA-11b: инвариант — откос a левее откоса b для обеих привязок и граней | FAIL (expected) |
| DA-12 | dimension-tool: Точки замера на откосах (следование за элементом и стеной) | `src/dimension-anchor.test.ts` | DA-12: перенос стены сдвигает откосы вместе с ней | FAIL (expected) |
| DA-13 | dimension-tool: Точки замера на откосах (следование за элементом и стеной) | `src/dimension-anchor.test.ts` | DA-13: удлинение конца b — окна с привязкой a на месте, с привязкой b уезжают | FAIL (expected) |
| DA-15 | dimension-tool: Точки замера на откосах (следование за элементом и стеной) | `src/dimension-anchor.test.ts` | DA-15: удлинение конца a — окно с привязкой b остаётся на месте, с привязкой a уезжает | FAIL (expected) |
| DA-14 | dimension-tool: Точки замера на откосах (следование за элементом и стеной) | `src/dimension-anchor.test.ts` | DA-14: диагональная стена — эталоны точек с нормалью (−0.8, 0.6) | FAIL (expected) |
| DA-14b | dimension-tool: Точки замера на откосах (следование за элементом и стеной) | `src/dimension-anchor.test.ts` | DA-14b: поворот диагональной стены — точки остаются на откосах новой оси | FAIL (expected) |
| DA-16 | dimension-tool: Точки замера на откосах (следование за элементом и стеной) | `src/dimension-anchor.test.ts` | DA-16: составная стена — расстояние между окнами двух участков 150 вдоль грани | FAIL (expected) |
| DA-16b | dimension-tool: Точки замера на откосах (следование за элементом и стеной) | `src/dimension-anchor.test.ts` | DA-16b: удлинение первого участка сдвигает окно первого участка, окно второго остаётся | FAIL (expected) |
| DA-21 | dimension-tool: Инструмент «Размер» / Привязка размеров к стенам (нулевой размер, прежние точки) | `src/dimension-anchor.test.ts` | DA-21: две точки на одном откосе совпадают — размер нулевой длины, геометрии нет | FAIL (expected) |
| DA-22 | dimension-tool: Инструмент «Размер» / Привязка размеров к стенам (нулевой размер, прежние точки) | `src/dimension-anchor.test.ts` | DA-22: без списка элементов и с ним граневая точка разрешается как прежде | PASS (unexpected, see notes) |
| DA-32 | drawing-storage: Формат документа | `src/dimension-anchor.test.ts` | DA-32: ссылка на отсутствующий элемент — точка не разрешается | FAIL (expected) |
| DA-32b | drawing-storage: Формат документа | `src/dimension-anchor.test.ts` | DA-32b: пустой список элементов — точка-откос не разрешается, граневые точки живы | FAIL (expected) |
| DA-37b | mounting-plan: размеры и снап на остатках (сцена «Монтаж») | `src/dimension-anchor.test.ts` | DA-37b: элемент есть, опорной стены нет — точка не разрешается | FAIL (expected) |
| DA-39 | dimension-tool: Точки замера (вырожденная стена) | `src/dimension-anchor.test.ts` | DA-39: вырожденная опорная стена — точка не разрешается, без NaN | FAIL (expected) |
| DA-38 | dimension-tool: Отрисовка / подсветка / PDF / попадание в размер с откосами | `src/dimension-anchor.test.ts` | DA-38: курсор на размерной линии — расстояние ≈ 0 при переданных элементах | FAIL (expected) |
| DA-38b | dimension-tool: Отрисовка / подсветка / PDF / попадание в размер с откосами | `src/dimension-anchor.test.ts` | DA-38b: курсор в 10 см от линии — расстояние ≈ 10 | FAIL (expected) |
| DA-38c | dimension-tool: Отрисовка / подсветка / PDF / попадание в размер с откосами | `src/dimension-anchor.test.ts` | DA-38c: элементы не переданы — размер с откосом не находится (null) | FAIL (expected) |

## Coverage

### Happy paths

- DA-1…DA-4: позиции всех четырёх откосных углов окон/двери (обе грани, оба откоса, привязки a и b), расстояние 80 между окнами, откос ↔ угол стены.
- DA-9…DA-16: следование за элементом (сдвиг, ширина, смена привязки) и за стеной (перенос, удлинение любого конца, поворот, составная стена).
- DA-23, DA-24, DA-25, DA-27: удаление элемента, стены каскадом и рамкой с вычисткой размеров; отмена возвращает элемент и размер.
- DA-28, DA-29, DA-33: сохранение/загрузка документа и истории (обмер и «Монтаж»).
- DA-34, DA-35, DA-37, DA-43, DA-44: рисование на холсте (обычный, hover, выделенный, рамка), в PDF и в сцене «Монтаж».
- DA-45, DA-46, DA-47: ластик и нажатие выбирают размер с откосами; третий клик привязывается к его уровню.

### Boundary cases

- DA-5, DA-5b, DA-5c, DA-5d, DA-6, DA-49, DA-49b: откос на углу/на торце (вершина побеждает), допуск равенства 1e-9, откос заметно ближе вершины (побеждает откос).
- DA-7b: ровно на радиусе и на 0.01 дальше. DA-10b: ширина 1 см. DA-2c: толщина 40. DA-48, DA-48b, DA-48c: несколько откосов в радиусе (оба порядка элементов).
- DA-21: две точки на одном откосе — нулевая длина. DA-22: вызов без списка элементов.

### Negative cases

- DA-7, DA-8, DA-20, DA-40, DA-40b, DA-50: промахи, элементы не переданы, элемент на отсутствующей/вырожденной стене.
- DA-31, DA-31b, DA-31c, DA-33b, DA-29b: битые точки-откосы (12 вариантов, включая `kind: "wat"` при корректных `a`/`b`) в обеих точках размера, в документе, «Монтаже» и истории.
- DA-32, DA-32b, DA-32c, DA-37b, DA-37d, DA-37e, DA-37f, DA-37g, DA-36, DA-35c, DA-35e, DA-39: ссылки на отсутствующий элемент/стену (в обоих порядках точек) — не бросает, не рисуется, не расширяет габарит, скрывается в «Монтаже».
- DA-26, DA-26b, DA-26c: чужие размеры и граневые размеры не затронуты удалением. DA-45c, DA-46b: промах мимо размера и выключенные размеры.

### Invariants

- DA-11b (откос a левее b при любых привязке/грани), DA-2b (две грани — на толщину), DA-17/DA-17c (клон независим и без потерь), DA-30 (граневая точка без `kind`), DA-22 (старая сигнатура), DA-41 (откосы не зависят от порядка стен).

### Integration cases

- DA-41, DA-41b, DA-41c: комната, рисуемая стена за стеной, в четырёх порядках и каждый префикс; DA-3b: следование откос ↔ угол при повороте соседней стены; DA-42, DA-42b: авторазмеры.
- DA-17b, DA-24: undo/redo; DA-28→DA-34: сохранение → загрузка → позиция; DA-44, DA-44b, DA-44c: снап и страница PDF на сцене «Монтаж».

## Unexpected Passes

Восемь тестов проходят до реализации; все — регрессии/негативы, которые обязаны проходить и после; ни один не подгонялся под код:

- DA-26c — удаление элемента не задевает граневый размер (поведение уже верно).
- DA-42, DA-42b — авторазмеры граневые и пересчёт не трогает ручной размер (нет `kind`; ручной размер без поля `auto`).
- DA-30 — размер из граневых точек без `kind` читается (регрессия формата).
- DA-31c, DA-33b — `isDimension` и `parseHistory` отвергают битую точку-откос; сейчас проходят «по другой причине» (любой не-граневый объект отвергается). Защищают от мутации «принять откос без проверки полей»; положительный случай обеспечивают DA-28/DA-33.
- DA-22 — граневая точка разрешается как прежде при необязательном третьем аргументе (регрессия).
- DA-46b — pressPick при выключенных размерах размер не выбирает (негатив; положительную пару даёт DA-46).

## Tests That Could Not Run

- Все 147 тестов выполняются. До реализации 139 падают (отсутствуют `nearestDimAnchor`, третий/шестой аргумент и обработка точек-откосов — ожидаемо), 8 проходят (см. выше). Проверка типов (`tsc --noEmit`) на тестах сообщает только об отсутствующем экспорте `nearestDimAnchor` и о лишнем аргументе существующих функций (TS2305/TS2554) — до реализации ожидаемо.
- DOM-маршрутизация `main.ts` (клики, отметка снапа на canvas, Esc/двойной клик) модульными тестами не покрывается — вручную на этапе verify (см. test-plan «Out of Scope»).
