# Test Suite

Исполняемые тесты change `add-doorway` в `src/doorway/` (vitest, node). Сцены и записывающий контекст — `src/doorway/doorway.test-utils.ts` (эталоны выводятся из спецификации и геометрии сцен, продакшн-модули проёмов не импортируются). Запуск: `npx vitest run src/doorway`.

Прогон после доработки по test-validation (FAIL, ревизия 3): 7 файлов, 37 тестов обнаружено в 3 загружаемых файлах — 27 упали, 10 прошли; 4 файла не загружаются (`Cannot find module` — модулей `doorway-faces`, `doorway-edit`, `doorway-guard`, `doorway-scene` ещё нет), их тесты будут обнаружены после появления модулей. Полный набор: 1191 существующий тест проходит, новые падения только в `src/doorway/`. `tsc` падает только на тестах `src/doorway/` из-за отсутствующего API (тип `Doorway`, модули, поля `RenderOptions`, параметры `buildPdf`/`wallsBBox`/`snapStartVertex`).

## Контракт API, зафиксированный тестами

Уточнение имён плана (test-plan «Контракт API») — смысл не меняется:

| Модуль | API |
|---|---|
| `src/types.ts` | `Doorway { id, wallId, anchor: "a" \| "b", offsetCm, widthCm, heightCm }`; `Drawing.doorways` — **необязательное** поле (см. Notes) |
| `src/doorway/doorway-faces.ts` | `jambsT(d, host) → [t1, t2]`; `faceRuns(host, walls, side: 1 \| -1) → [t0, t1][]`; `doorwayDistances(d, walls) → { plus: {a, b}, minus: {a, b} } \| null`; `doorwayHolds(d, walls) → boolean`. `plus` — сторона нормали `(−d.y, d.x)` к оси `a → b` |
| `src/doorway/doorway-edit.ts` | `placeDoorway(host, walls, cursor, widthCm, heightCm, id) → Doorway \| null`; `setDistance(d, walls, side, toward, value)`; `setWidth(d, walls, value)`; `setHeight(d, value)`; `slideDoorway(d, walls, deltaWorld: Point)`; `arrowSlide(d, walls, arrow: Point, stepCm)` → `DoorwayEdit = { kind: "applied"; doorway } \| { kind: "rejected"; reason: "invalid" \| "no-change" }` |
| `src/doorway/doorway-guard.ts` | `thicknessAllowed(walls, wall, thicknessCm, doorways) → boolean`; `violatesDoorways(before, after, doorways) → boolean` (уже нарушенный проём: нарушение только не должно углубляться; `thicknessAllowed` — то же) |
| `src/doorway/doorway-scene.ts` | `hitDoorway(p, walls, doorways, tolCm)`; `doorwaysInRect(min, max, walls, doorways)`; `wallsInRect(min, max, walls, doorways)` (ось на участках проёмов не считается); `erasePick(p, {walls, dimensions, doorways}, tolCm, textFactor) → {kind:"dimension"…} \| {kind:"doorway"…} \| {kind:"wall"…} \| null`; `deleteObjects(scene, {walls, dimensions, doorways}) → Scene` |
| `src/wall-edit.ts` | `EditMode.doorways?: readonly Doorway[]` для `moveWallsBounded`, `moveEndpointBounded`, `resizeWallBounded` |
| `src/wall-chain.ts`, `src/wall-snap.ts` | `ChainInput.doorways?`; `snapStartVertex(p, walls, radius, grid, thickness, doorways?)` |
| `src/render.ts` | `RenderOptions.doorways`, `selectedDoorways`, `doorwayGhost`; `marqueeHits.doorways?` (подсветка рамкой) |
| `src/export/pdf.ts` | `buildPdf(walls, dims, unit, scale, format, font, doorways)`; `wallsBBox(walls, dims, pad, doorways?)` |
| `src/history.ts` | `Scene.doorways?`, запись `kind: "walls"` с `doorways?`; `cloneScene` копирует проёмы |

## Tests

| ID | Requirement | Test File | Test Name | Initial Result |
|---|---|---|---|---|
| DF-01 | doorway: Проём и опорная стена | src/doorway/doorway-faces.test.ts | DF-01: привязка a, 100 см, ширина 90 — откосы на t = 100 и 190 | FAIL (модуль отсутствует) |
| DF-02 | doorway: Проём и опорная стена | src/doorway/doorway-faces.test.ts | DF-02: привязка b, 100 см, ширина 90 — откосы на t = 310 и 400 | FAIL (модуль отсутствует) |
| DF-02b | doorway: Проём и опорная стена | src/doorway/doorway-faces.test.ts | DF-02b: наклонная стена — t измеряется вдоль оси от конца a | FAIL (модуль отсутствует) |
| DF-RUNS-1 | doorway: Стыки грани | src/doorway/doorway-faces.test.ts | DF-RUNS-1: в комнате R грань plus W — от грани L до грани R, minus — между наружными углами | FAIL (модуль отсутствует) |
| DF-RUNS-2 | doorway: Стыки грани | src/doorway/doorway-faces.test.ts | DF-RUNS-2: T-примыкание делит грань plus на два участка, minus не трогает | FAIL (модуль отсутствует) |
| DF-03 | doorway: Стыки грани и расстояния | src/doorway/doorway-faces.test.ts | DF-03: прямые углы — plus 90 / 300, minus 110 / 320 | FAIL (модуль отсутствует) |
| DF-04 | doorway: Стыки грани и расстояния | src/doorway/doorway-faces.test.ts | DF-04: T-примыкание делит грань — plus 90 / 105, minus прежние 110 / 320 | FAIL (модуль отсутствует) |
| DF-05 | doorway: Стыки грани и расстояния | src/doorway/doorway-faces.test.ts | DF-05: свободная стена — стыки на торцах, 100 / 310 на обеих гранях | FAIL (модуль отсутствует) |
| DF-05b | doorway: Стыки грани и расстояния | src/doorway/doorway-faces.test.ts | DF-05b: привязка b — расстояния считаются от откосов, а не от привязки | FAIL (модуль отсутствует) |
| DF-06 | doorway: Стыки грани и расстояния | src/doorway/doorway-faces.test.ts | DF-06: непрямой угол 135° — граница по пересечению граней | FAIL (модуль отсутствует) |
| DF-07 | doorway: Стыки грани и расстояния | src/doorway/doorway-faces.test.ts | DF-07: углы стыком на грани (без общей вершины) — те же правила граней | FAIL (модуль отсутствует) |
| DF-SUM | doorway: Стыки грани (инвариант суммы) | src/doorway/doorway-faces.test.ts | DF-SUM: на каждой грани a + ширина + b = длина участка | FAIL (модуль отсутствует) |
| DF-NULL | doorway: Проём и опорная стена (сирота) | src/doorway/doorway-faces.test.ts | DF-NULL: проём на отсутствующей стене — расстояний нет | FAIL (модуль отсутствует) |
| DF-08 | doorway: Инвариант | src/doorway/doorway-faces.test.ts | DF-08: вплотную к углу допустимо — plus.a = 0, minus.a = 20 | FAIL (модуль отсутствует) |
| DF-08b | doorway: Инвариант | src/doorway/doorway-faces.test.ts | DF-08b: d = 0 у торца свободной стены допустимо | FAIL (модуль отсутствует) |
| DF-08c | doorway: Инвариант | src/doorway/doorway-faces.test.ts | DF-08c: ширина ровно на весь участок допустима | FAIL (модуль отсутствует) |
| DF-09 | doorway: Инвариант | src/doorway/doorway-faces.test.ts | DF-09: заход за угол на 1 см нарушает инвариант | FAIL (модуль отсутствует) |
| DF-09b | doorway: Инвариант | src/doorway/doorway-faces.test.ts | DF-09b: проём за торцом стены нарушает инвариант на обеих гранях | FAIL (модуль отсутствует) |
| DF-09c | doorway: Инвариант | src/doorway/doorway-faces.test.ts | DF-09c: стена укоротилась на 0.001 у откоса — нарушение | FAIL (модуль отсутствует) |
| DF-09d | doorway: Инвариант | src/doorway/doorway-faces.test.ts | DF-09d: ширина на 0.01 больше участка — нарушение | FAIL (модуль отсутствует) |
| DF-09e | doorway: Инвариант | src/doorway/doorway-faces.test.ts | DF-09e: проём, накрывающий перегородку, нарушает инвариант | FAIL (модуль отсутствует) |
| DF-10 | doorway: Инвариант | src/doorway/doorway-faces.test.ts | DF-10: касание откоса и грани перегородки допустимо, наложение 0.01 — нет | FAIL (модуль отсутствует) |
| DF-11 | doorway: Инвариант | src/doorway/doorway-faces.test.ts | DF-11: проём на отсутствующей стене инвариант не выполняет | FAIL (модуль отсутствует) |
| DE-01 | doorway: Установка | src/doorway/doorway-edit.test.ts | DE-01: призрак следует за курсором — центр в проекции, округлённой до 1 см | FAIL (модуль отсутствует) |
| DE-01b | doorway: Установка | src/doorway/doorway-edit.test.ts | DE-01b: округление центра — 203.5 → 204, 203.49 → 203 | FAIL (модуль отсутствует) |
| DE-01c | doorway: Установка | src/doorway/doorway-edit.test.ts | DE-01c: наклонная стена — центр в проекции курсора на ось | FAIL (модуль отсутствует) |
| DE-02 | doorway: Установка | src/doorway/doorway-edit.test.ts | DE-02: курсор у угла — призрак прижат к грани угловой стены | FAIL (модуль отсутствует) |
| DE-03 | doorway: Установка | src/doorway/doorway-edit.test.ts | DE-03: курсор над перегородкой — ближайшее допустимое положение (справа от P) | FAIL (модуль отсутствует) |
| DE-03b | doorway: Установка | src/doorway/doorway-edit.test.ts | DE-03b: курсор над перегородкой левее — проём слева от P | FAIL (модуль отсутствует) |
| DE-04 | doorway: Установка | src/doorway/doorway-edit.test.ts | DE-04: сторона привязки — ближний конец; при равенстве — a | FAIL (модуль отсутствует) |
| DE-05 | doorway: Установка / Инвариант | src/doorway/doorway-edit.test.ts | DE-05: нет места — null; ширина ровно на участок — ставится | FAIL (модуль отсутствует) |
| DE-05b | doorway: Установка | src/doorway/doorway-edit.test.ts | DE-05b: стена короче проёма — null | FAIL (модуль отсутствует) |
| DE-06 | doorway: Ввод чисел | src/doorway/doorway-edit.test.ts | DE-06: ввод 231 по грани plus в сторону b — привязка b, ширина 90 | FAIL (модуль отсутствует) |
| DE-06b | doorway: Ввод чисел | src/doorway/doorway-edit.test.ts | DE-06b: ввод по наружной грани в сторону a | FAIL (модуль отсутствует) |
| DE-06c | doorway: Ввод чисел (граница 0) | src/doorway/doorway-edit.test.ts | DE-06c: ввод расстояния 0 — откос на стыке | FAIL (модуль отсутствует) |
| DE-07 | doorway: Ввод чисел (ширина) | src/doorway/doorway-edit.test.ts | DE-07: ширина растёт от откоса привязки a | FAIL (модуль отсутствует) |
| DE-08 | doorway: Ввод чисел (ширина) | src/doorway/doorway-edit.test.ts | DE-08: при привязке b неподвижен откос со стороны b | FAIL (модуль отсутствует) |
| DE-09 | doorway: Ввод чисел (ограничение) | src/doorway/doorway-edit.test.ts | DE-09: слишком большое расстояние ограничивается до касания (400 → 390) | FAIL (модуль отсутствует) |
| DE-09b | doorway: Ввод чисел (ограничение) | src/doorway/doorway-edit.test.ts | DE-09b: слишком большая ширина ограничивается (500 → 390) | FAIL (модуль отсутствует) |
| DE-09c | doorway: Ввод чисел (ограничение) | src/doorway/doorway-edit.test.ts | DE-09c: ограничение в пределах участка — через перегородку не перескакивает | FAIL (модуль отсутствует) |
| DE-10 | doorway: Ввод чисел / Инструмент (неверный ввод) | src/doorway/doorway-edit.test.ts | DE-10: неверный ввод отклоняется | FAIL (модуль отсутствует) |
| DE-10b | doorway: Ввод чисел (граница) | src/doorway/doorway-edit.test.ts | DE-10b: очень малая ширина допустима | FAIL (модуль отсутствует) |
| DE-11 | doorway: Ввод чисел (без изменения) | src/doorway/doorway-edit.test.ts | DE-11: значение без изменения — no-change | FAIL (модуль отсутствует) |
| DE-11b | doorway: Ввод чисел (привязка) | src/doorway/doorway-edit.test.ts | DE-11b: ввод того же расстояния в другую сторону меняет только привязку | FAIL (модуль отсутствует) |
| DE-HEIGHT | doorway: Выделение проёма (поле H) | src/doorway/doorway-edit.test.ts | DE-HEIGHT: высота меняется полем, остальное прежнее | FAIL (модуль отсутствует) |
| DE-PURE | doorway: инвариант «правка не мутирует» | src/doorway/doorway-edit.test.ts | DE-PURE: правки не мутируют исходный проём | FAIL (модуль отсутствует) |
| DE-12 | doorway: Перемещение | src/doorway/doorway-edit.test.ts | DE-12: перетаскивание на (50, 30) — проекция на ось, offset 150 | FAIL (модуль отсутствует) |
| DE-12b | doorway: Перемещение | src/doorway/doorway-edit.test.ts | DE-12b: при привязке b сдвиг к b уменьшает расстояние привязки | FAIL (модуль отсутствует) |
| DE-13 | doorway: Перемещение | src/doorway/doorway-edit.test.ts | DE-13: остановка у стыка — offset 10, привязка a | FAIL (модуль отсутствует) |
| DE-14 | doorway: Перемещение | src/doorway/doorway-edit.test.ts | DE-14: не перепрыгивает перегородку | FAIL (модуль отсутствует) |
| DE-15 | doorway: Перемещение (округление) | src/doorway/doorway-edit.test.ts | DE-15: расстояние привязки округляется до 1 см | FAIL (модуль отсутствует) |
| DE-15b | doorway: Перемещение | src/doorway/doorway-edit.test.ts | DE-15b: перетаскивание без смещения — no-change | FAIL (модуль отсутствует) |
| DE-16 | doorway: Перемещение (стрелки) | src/doorway/doorway-edit.test.ts | DE-16: стрелка вправо — +10, с шагом 1 — +1 | FAIL (модуль отсутствует) |
| DE-16b | doorway: Перемещение (стрелки) | src/doorway/doorway-edit.test.ts | DE-16b: стрелка при привязке b | FAIL (модуль отсутствует) |
| DE-16c | doorway: Перемещение (стрелки в упоре) | src/doorway/doorway-edit.test.ts | DE-16c: стрелка в упоре — до касания, в касании — no-change | FAIL (модуль отсутствует) |
| DE-17 | doorway: Перемещение (стрелки) | src/doorway/doorway-edit.test.ts | DE-17: стрелка поперёк стены не сдвигает | FAIL (модуль отсутствует) |
| DE-18 | doorway: Перемещение (стрелки) | src/doorway/doorway-edit.test.ts | DE-18: стена под 45° — сдвиг на шаг вдоль оси | FAIL (модуль отсутствует) |
| DE-18b | doorway: Перемещение (допуск 0.5°) | src/doorway/doorway-edit.test.ts | DE-18b: 89.6° не сдвигает, 89.4° сдвигает | FAIL (модуль отсутствует) |
| DG-01 | doorway: Следование за стеной | src/doorway/doorway-guard.test.ts | DG-01: перемещение стены — проём на прежнем расстоянии | FAIL (модуль отсутствует) |
| DG-02 | doorway: Следование за стеной | src/doorway/doorway-guard.test.ts | DG-02: перемещение конца привязки a — откос сдвигается | FAIL (модуль отсутствует) |
| DG-03 | doorway: Следование за стеной | src/doorway/doorway-guard.test.ts | DG-03: перемещение второго конца — откос на месте | FAIL (модуль отсутствует) |
| DG-08 | doorway: Ввод чисел (сохранение при правке) | src/doorway/doorway-guard.test.ts | DG-08: расстояние от b сохраняется при правке конца a с углом | FAIL (модуль отсутствует) |
| DG-14 | multi-selection: Сдвиг стрелками | src/doorway/doorway-guard.test.ts | DG-14: стрелка по стене с проёмом — проём на прежнем расстоянии | FAIL (модуль отсутствует) |
| DG-04 | wall-collision: Правки не нарушают проёмы | src/doorway/doorway-guard.test.ts | DG-04: укорочение стены останавливается у откоса | FAIL (модуль отсутствует) |
| DG-05 | wall-collision: Правки не нарушают проёмы | src/doorway/doorway-guard.test.ts | DG-05: ввод длины 120 укорачивается до 190 | FAIL (модуль отсутствует) |
| DG-05b | wall-collision (негатив) | src/doorway/doorway-guard.test.ts | DG-05b: ввод длины, не задевающий проём, применяется полностью | FAIL (модуль отсутствует) |
| DG-06 | wall-collision: Правки не нарушают проёмы | src/doorway/doorway-guard.test.ts | DG-06: перегородка не заходит в проём | FAIL (модуль отсутствует) |
| DG-09 | wall-collision: отход без задержки | src/doorway/doorway-guard.test.ts | DG-09: от касания перегородка сразу отходит | FAIL (модуль отсутствует) |
| DG-07 | wall-collision: толщина | src/doorway/doorway-guard.test.ts | DG-07: толщина угловой стены, заводящая грань в проём, не допускается | FAIL (модуль отсутствует) |
| DG-10 | wall-collision: орто-растяжение | src/doorway/doorway-guard.test.ts | DG-10: орто-растяжение ограничено проёмом в боковой стене | FAIL (модуль отсутствует) |
| DG-11 | wall-collision: групповая правка | src/doorway/doorway-guard.test.ts | DG-11: групповое перемещение останавливается целиком | FAIL (модуль отсутствует) |
| DG-12 | doorway: Инвариант (нарушенный проём) | src/doorway/doorway-guard.test.ts | DG-12: нарушенный проём не блокирует, нарушение не углубляется | FAIL (модуль отсутствует) |
| DG-13 | wall-collision (контроль) | src/doorway/doorway-guard.test.ts | DG-13: без проёмов перегородка проходит прежнее расстояние | FAIL (модуль отсутствует) |
| DG-13b | wall-collision (негатив) | src/doorway/doorway-guard.test.ts | DG-13b: проём на другой стене не ограничивает несвязанную правку | FAIL (модуль отсутствует) |
| DD-01 | wall-drawing: Стык не внутри проёма | src/doorway/doorway-guard.test.ts | DD-01: конец не прилипает к грани внутри проёма | FAIL (модуль отсутствует) |
| DD-01b | wall-drawing: Стык не внутри проёма | src/doorway/doorway-guard.test.ts | DD-01b: начало цепочки не прилипает к грани внутри проёма | FAIL (модуль отсутствует) |
| DD-02 | wall-drawing: Стык не внутри проёма | src/doorway/doorway-guard.test.ts | DD-02: примкнутая внутри проёма нарушает; в стороне и касание — нет | FAIL (модуль отсутствует) |
| DD-03 | wall-drawing: Стык не внутри проёма | src/doorway/doorway-guard.test.ts | DD-03: привязка вне проёма работает как без проёма | FAIL (модуль отсутствует) |
| DD-04 | wall-drawing: Стык не внутри проёма | src/doorway/doorway-guard.test.ts | DD-04: угловой стык у конца, к которому вплотную проём, нарушает | FAIL (модуль отсутствует) |
| DX-01 | doorway: Выделение проёма | src/doorway/doorway-scene.test.ts | DX-01: клик внутри участка проёма — проём | FAIL (модуль отсутствует) |
| DX-01b | doorway: Выделение (радиус) | src/doorway/doorway-scene.test.ts | DX-01b: в радиусе привязки — проём; дальше — нет | FAIL (модуль отсутствует) |
| DX-02 | doorway: Выделение (негатив) | src/doorway/doorway-scene.test.ts | DX-02: клик по стене вне проёма — не проём | FAIL (модуль отсутствует) |
| DX-02b | doorway: Проём и опорная стена (сирота) | src/doorway/doorway-scene.test.ts | DX-02b: проём на отсутствующей стене не попадается | FAIL (модуль отсутствует) |
| DX-02c | doorway: Выделение | src/doorway/doorway-scene.test.ts | DX-02c: из нескольких проёмов — тот, в который попал клик | FAIL (модуль отсутствует) |
| DX-03 | wall-deletion: Ластик; doorway: Удаление | src/doorway/doorway-scene.test.ts | DX-03: приоритет размер → проём → стена | FAIL (модуль отсутствует) |
| DX-07 | multi-selection: Рамка выделения | src/doorway/doorway-scene.test.ts | DX-07: рамка пересекает ось между откосами — проём | FAIL (модуль отсутствует) |
| DX-08 | multi-selection: Рамка (негатив) | src/doorway/doorway-scene.test.ts | DX-08: рамка не задела участок оси — не выделен | FAIL (модуль отсутствует) |
| DX-04 | wall-deletion: Delete (каскад) | src/doorway/doorway-scene.test.ts | DX-04: удаление стены удаляет её проёмы и размеры | FAIL (модуль отсутствует) |
| DX-05 | doorway: Удаление | src/doorway/doorway-scene.test.ts | DX-05: удаление проёма не трогает стены и размеры | FAIL (модуль отсутствует) |
| DX-06 | wall-deletion: мультивыделение | src/doorway/doorway-scene.test.ts | DX-06: стена с каскадом и проём на невыделенной стене | FAIL (модуль отсутствует) |
| DX-06b | wall-deletion (неизменность входа) | src/doorway/doorway-scene.test.ts | DX-06b: исходная сцена не мутируется | FAIL (модуль отсутствует) |
| DX-06c | wall-deletion (негатив) | src/doorway/doorway-scene.test.ts | DX-06c: пустое выделение ничего не удаляет | FAIL (модуль отсутствует) |
| DL-01 | doorway: Отображение (вырез) | src/doorway/doorway-render.test.ts | DL-01: штриховка не заходит на участок проёма | FAIL |
| DL-02 | doorway: Отображение (откосы) | src/doorway/doorway-render.test.ts | DL-02: откосы — линии контура, грани в проёме контуром не рисуются | FAIL |
| DL-02b | doorway: Отображение (продолжение граней) | src/doorway/doorway-render.test.ts | DL-02b: грани продолжаются тонкими линиями | FAIL |
| DL-09 | doorway: Проём и опорная стена (сирота) | src/doorway/doorway-render.test.ts | DL-09: проём на отсутствующей стене не рисуется | PASS (см. Unexpected Passes) |
| DL-03 | doorway: Отображение (подпись H) | src/doorway/doorway-render.test.ts | DL-03: подпись со стороны помещения в текущих единицах | FAIL |
| DL-03b | doorway: Отображение (подпись H) | src/doorway/doorway-render.test.ts | DL-03b: у нижней стены подпись над стеной | FAIL |
| DL-03c | doorway: Отображение (подпись H без помещения) | src/doorway/doorway-render.test.ts | DL-03c: без помещения — слева на экране от a → b (нормаль (d.y, −d.x)) | FAIL |
| DL-03d | doorway: Отображение (подпись всегда) | src/doorway/doorway-render.test.ts | DL-03d: подпись видна без выделения у каждого проёма | FAIL |
| DL-10 | doorway: Отображение (не масштабируется) | src/doorway/doorway-render.test.ts | DL-10: размер шрифта подписи не зависит от зума | FAIL |
| DL-04 | doorway: Размеры выделенного проёма | src/doorway/doorway-render.test.ts | DL-04: шесть чисел 90 / 90 / 300 и 110 / 90 / 320 | FAIL |
| DL-04b | doorway: Размеры (единицы) | src/doorway/doorway-render.test.ts | DL-04b: числа в выбранной единице (мм) | FAIL |
| DL-05 | doorway: Размеры (снятие выделения) | src/doorway/doorway-render.test.ts | DL-05: без выделения размеров проёма нет | PASS (см. Unexpected Passes) |
| DL-06 | doorway: Размеры / multi-selection: Отображение | src/doorway/doorway-render.test.ts | DL-06: при мультивыделении размеров проёмов нет | PASS (см. Unexpected Passes) |
| DL-07 | doorway: Размеры (0) | src/doorway/doorway-render.test.ts | DL-07: расстояние 0 — число «0» у откоса | FAIL |
| DL-08 | doorway: Размеры (призрак) | src/doorway/doorway-render.test.ts | DL-08: призрак установки показывает размеры | FAIL |
| DR-01 | room-areas: Проём не разрывает помещение | src/doorway/doorway-render.test.ts | DR-01: две комнаты с проёмом в перегородке — две прежние площади | PASS (см. Unexpected Passes) |
| DR-02 | room-areas: Проём не разрывает помещение | src/doorway/doorway-render.test.ts | DR-02: проём в наружной стене — помещение сохраняется | PASS (см. Unexpected Passes) |
| DP-01 | pdf-export: Проёмы в PDF | src/doorway/doorway-pdf.test.ts | DP-01: сцена PDF получает проёмы, подпись «H=210» | FAIL |
| DP-02 | pdf-export: Проёмы в PDF (негатив) | src/doorway/doorway-pdf.test.ts | DP-02: размеры, призрак и выделение в PDF не попадают | PASS (см. Unexpected Passes) |
| DP-03 | pdf-export: Проёмы в PDF (габариты) | src/doorway/doorway-pdf.test.ts | DP-03: габариты учитывают подпись высоты | FAIL |
| DS-01 | drawing-storage: Формат документа | src/doorway/doorway-storage.test.ts | DS-01: сохранённый документ содержит проёмы со всеми полями | PASS (см. Unexpected Passes) |
| DS-05 | drawing-storage: Формат / Автосохранение | src/doorway/doorway-storage.test.ts | DS-05: круговой обмен сохраняет проём | PASS (см. Unexpected Passes) |
| DS-02 | drawing-storage: документ без проёмов | src/doorway/doorway-storage.test.ts | DS-02: документ без проёмов — пустой список | PASS (см. Unexpected Passes) |
| DS-03 | drawing-storage: битые проёмы | src/doorway/doorway-storage.test.ts | DS-03: битые проёмы отбрасываются | FAIL |
| DS-04 | drawing-storage: сироты | src/doorway/doorway-storage.test.ts | DS-04: проём-сирота отбрасывается | FAIL |
| DS-06 | drawing-storage: битые проёмы | src/doorway/doorway-storage.test.ts | DS-06: список проёмов не массив — пустой список | FAIL |
| DH-01 | drawing-history: Отменяемые действия | src/doorway/doorway-storage.test.ts | DH-01: отмена установки проёма | FAIL |
| DH-01b | drawing-history: снимок | src/doorway/doorway-storage.test.ts | DH-01b: снимок отделён от живых данных | FAIL |
| DH-01c | drawing-history: снимок | src/doorway/doorway-storage.test.ts | DH-01c: cloneScene копирует проёмы | FAIL |
| DH-02/03 | drawing-history: Персистентность | src/doorway/doorway-storage.test.ts | DH-02/DH-03: история с проёмами переживает сериализацию | FAIL |
| DH-04 | drawing-history: снимки без проёмов | src/doorway/doorway-storage.test.ts | DH-04: снимок без проёмов читается как пустой список | PASS (см. Unexpected Passes) |

| DD-01c | wall-drawing: Стык не внутри проёма | src/doorway/doorway-guard.test.ts | DD-01c: с проёмом курсор у грани, сетка которого мимо грани, даёт стену без нарушения | FAIL (модуль отсутствует) |
| DD-05 | wall-drawing: Стык не внутри проёма (орто) | src/doorway/doorway-guard.test.ts | DD-05: орто — привязка по лучу к грани внутри проёма не выполняется | FAIL (модуль отсутствует) |
| DD-05b | wall-drawing: Стык не внутри проёма (орто) | src/doorway/doorway-guard.test.ts | DD-05b: орто вне проёма — привязка по лучу работает | FAIL (модуль отсутствует) |
| DG-15 | wall-collision: непрерывное движение | src/doorway/doorway-guard.test.ts | DG-15: правка не перепрыгивает проём | FAIL (модуль отсутствует) |
| DG-04b | wall-collision (орто) | src/doorway/doorway-guard.test.ts | DG-04b: укорочение до откоса и при орто | FAIL (модуль отсутствует) |
| DG-07b | wall-collision: толщина | src/doorway/doorway-guard.test.ts | DG-07b: утолщение перегородки, касающейся откоса, не допускается | FAIL (модуль отсутствует) |
| DE-09d | doorway: Ввод чисел (обе грани) | src/doorway/doorway-edit.test.ts | DE-09d: ввод по одной грани ограничивается стыками обеих граней | FAIL (модуль отсутствует) |
| DX-05b | wall-deletion: мультивыделение (размеры) | src/doorway/doorway-scene.test.ts | DX-05b: удаление выделенного размера удаляет только его | FAIL (модуль отсутствует) |
| DX-09 | multi-selection: Рамка выделения | src/doorway/doorway-scene.test.ts | DX-09: ось только между откосами — стена не выделена, проём выделен | FAIL (модуль отсутствует) |
| DX-09b | multi-selection: Рамка выделения | src/doorway/doorway-scene.test.ts | DX-09b: ось вне проёма — стена выделена | FAIL (модуль отсутствует) |
| DX-09c | multi-selection: Рамка (контроль) | src/doorway/doorway-scene.test.ts | DX-09c: без проёмов та же рамка выделяет стену | FAIL (модуль отсутствует) |
| DX-09d | multi-selection: Рамка выделения | src/doorway/doorway-scene.test.ts | DX-09d: стена целиком внутри рамки выделяется | FAIL (модуль отсутствует) |
| DX-09e | multi-selection: Рамка (негатив) | src/doorway/doorway-scene.test.ts | DX-09e: касание края без оси не выделяет | FAIL (модуль отсутствует) |
| DL-03e | doorway: Отображение (подпись H, помещения с обеих сторон) | src/doorway/doorway-render.test.ts | DL-03e: помещения с обеих сторон — подпись со стороны нормали | FAIL |
| DL-12 | doorway: Выделение проёма (подсветка) | src/doorway/doorway-render.test.ts | DL-12: выделенный проём обведён цветом выделения | FAIL |
| DL-12b | multi-selection: Отображение | src/doorway/doorway-render.test.ts | DL-12b: при мультивыделении каждый проём обведён, размеров нет | FAIL |
| DL-12c | multi-selection: Отображение (рамка) | src/doorway/doorway-render.test.ts | DL-12c: проём, задетый рамкой, подсвечен мягким стилем | FAIL |

| DD-06 | doorway: Инвариант (нарушенный проём) / wall-drawing | src/doorway/doorway-guard.test.ts | DD-06: уже нарушенный проём не блокирует несвязанное рисование и привязку | FAIL (модуль отсутствует) |
| DD-06b | doorway: Инвариант (не углублять) / wall-drawing | src/doorway/doorway-guard.test.ts | DD-06b: рисование, углубляющее нарушение, отклоняется | FAIL (модуль отсутствует) |
| DG-07c | doorway: Инвариант (нарушенный проём) / wall-collision: толщина | src/doorway/doorway-guard.test.ts | DG-07c: нарушенный проём не блокирует несвязанную толщину, но не даёт углубить | FAIL (модуль отсутствует) |
| DE-14b | doorway: Перемещение (путь) | src/doorway/doorway-edit.test.ts | DE-14b: допустимое положение за перегородкой не достигается | FAIL (модуль отсутствует) |
| DL-03f | doorway: Отображение (подпись H, обратное направление) | src/doorway/doorway-render.test.ts | DL-03f: помещение при развёрнутой стене — подпись со стороны помещения | FAIL |
| DL-13 | doorway: Инвариант (отображение нарушенного) | src/doorway/doorway-render.test.ts | DL-13: нарушенный проём — участок вне стены не вырезается и не рисуется | FAIL |

Итого: 146 тестов (в т.ч. 109 в незагружаемых пока файлах).## Coverage

### Happy paths

- Откосы по привязке a/b, расстояния по обеим граням (прямые углы, T-примыкание, свободная стена, угол 135°, угловой стык на грани): DF-01…DF-07.
- Установка с призраком, прижатие к стыку, выбор стороны по ближнему концу: DE-01…DE-04.
- Ввод расстояния (смена привязки), ширины (неподвижный откос привязки), высоты: DE-06…DE-08, DE-HEIGHT.
- Перетаскивание и стрелки: DE-12…DE-18.
- Следование за стеной: DG-01…DG-03, DG-08, DG-14.
- Отображение: вырез, откосы, продолжение граней, подпись H, шесть чисел: DL-01…DL-04, DL-08.
- PDF, хранение, история: DP-01, DS-01/05, DH-01…DH-03.

### Boundary cases

- d = 0 у угла и у торца: DF-08, DF-08b, DE-06c, DL-07.
- Ширина ровно на участок / на 0.01 больше: DF-08c, DF-09d, DE-05.
- Касание перегородки / наложение 0.01: DF-10.
- Округление центра 203.5 / 203.49 и offset 50.4 / 50.6: DE-01b, DE-15.
- Допуск прямого угла 0.5° для стрелок (89.6° / 89.4°): DE-18b.
- Стена короче проёма: DE-05b; укорочение на 0.001: DF-09c.
- Очень малая ширина 0.1: DE-10b.

### Negative cases

- Неверный ввод (NaN, ∞, отрицательные, 0): DE-10; без изменения: DE-11, DE-15b, DE-17.
- Сирота: DF-NULL, DF-11, DX-02b, DL-09, DS-04.
- Клик/рамка мимо проёма: DX-02, DX-08; ластик на пустом месте: DX-03.
- Несвязанная правка не ограничивается: DG-05b, DG-13b; контроль без проёмов: DG-13.
- Нет размеров без выделения/при мультивыделении/в PDF: DL-05, DL-06, DP-02.
- Битые элементы хранилища: DS-03, DS-06.

### Invariants

- `doorwayHolds` после каждой применённой правки (`applied()` в doorway-edit.test.ts) и после ограниченных правок стен (`allHold`).
- Сумма a + ширина + b = длина участка: DF-SUM.
- Правки стен не меняют данные проёма: DG-01, DG-14 (`toEqual(D0())`).
- Чистота функций правки и удаления: DE-PURE, DX-06b.
- Привязка меняется только вводом расстояния: DE-07, DE-12, DE-13 (anchor прежний), DE-06/DE-11b (меняется).
- Помещения не зависят от проёмов: DR-01, DR-02.

### Integration cases

- Ограничитель правок стен (`moveWallsBounded`, `moveEndpointBounded`, `resizeWallBounded`, орто через `planEdit`) с `EditMode.doorways`: DG-01…DG-14.
- Привязка рисования (`chainSegment`, `snapStartVertex`) + `violatesDoorways`: DD-01…DD-04.
- `drawScene` → записанные операции (clip, контур, тонкие линии, тексты): DL-*, DR-*; `buildPdf` → `drawScene`: DP-01/02.
- `serializeStore`/`parseStore`, `serializeHistory`/`parseHistory`: DS-*, DH-02/04.

## Unexpected Passes

Все — ожидаемые проходы «защитных» и регрессионных тестов, проверено вручную:

- **DL-05, DL-06, DP-02** — негативные проверки «чисел размеров нет»: до реализации проёмы не рисуются вовсе. Сила теста обеспечивается парными позитивными тестами DL-04 / DL-08 (те же сцены с выделением дают шесть чисел).
- **DL-09** — сирота не рисуется и не вырезает штриховку: до реализации проёмы не рисуются. Парный позитивный DL-01.
- **DR-01, DR-02** — регрессия: помещения уже сейчас не зависят от проёмов; тест ловит реализацию, вырезающую каноническую форму (design D2).
- **DS-01, DS-05, DS-02** — `parseStore` уже пропускает лишние поля чертежа без изменений; тесты фиксируют, что поле `doorways` сохраняется и что документ без него открывается. Валидацию проверяют падающие DS-03/04/06.
- **DH-04** — снимок истории без проёмов уже читается; тест фиксирует обратную совместимость.

## Tests That Could Not Run

- 109 тестов в `doorway-faces.test.ts`, `doorway-edit.test.ts`, `doorway-guard.test.ts`, `doorway-scene.test.ts` не загружаются: модулей `src/doorway/doorway-faces.ts`, `doorway-edit.ts`, `doorway-guard.ts`, `doorway-scene.ts` нет. Ожидаемо до реализации; после появления модулей они будут обнаружены (по `it(...)`: 23 / 37 / 30 / 19).
- DOM-поведение не автоматизировано (нет jsdom): поле ввода на месте числа, панель «Проём», фокус и Delete в полях, клик инструментом по существующему проёму, отказ фиксации стены кликом/Enter, запись истории из обработчиков `main.ts`. Ручные проверки M-01…M-13 из test-plan.md, плюс **M-14**: клик/Enter при конце превью внутри проёма (в т.ч. по сетке) не фиксирует стену (spec wall-drawing); **M-15**: толщина, нарушающая проём, не применяется, поле толщины показывает фактическую (spec wall-collision); **M-16**: активация «Проём» прерывает цепочку и размещение размера и снимает выделение, Esc без выделения деактивирует инструмент (spec doorway «Инструмент «Проём»»).

## Notes

- **Ревизия 3 (вторая test-validation FAIL).** Учтены обязательные изменения:
  - правило «подпись со стороны помещения» теперь отличимо от запасной стороны (DL-03, DL-03b при новом правиле стороны; DL-03f);
  - уже нарушенный проём не блокирует рисование и толщину, но не даёт углубить нарушение: контракт `violatesDoorways(before, after, doorways)`, тесты DD-06/06b, DG-07c;
  - порядок чисел цепочки (a | ширина | b) и положение каждого числа на грани: DL-04, DL-04b, DL-07 (число «0» у откоса), DL-08;
  - отображение нарушенного проёма: DL-13;
  - сторона «слева от a → b» решена пользователем — см. ниже; рекомендованный DE-14b добавлен.
- **Ревизия 2 (test-validation FAIL).** Учтены обязательные изменения валидатора:
  - DD-01 ослаблен до спецификации: с проёмом запрещена только привязка к стене на участке проёма, сетка работает по прежним правилам (отказ фиксации — M-14); добавлен DD-01c с курсором, сетка которого мимо грани.
  - Добавлены DG-15 (перепрыгивание проёма), DD-05/05b (орто — путь приложения по умолчанию), DE-09d (ограничение обеими гранями), DX-05b (удаление выделенного размера), DX-09…09e (рамка и опорная стена), DL-12…12c (подсветка выделения и рамки).
  - Рекомендованные: DL-03e, DG-07b, DG-04b.
  - Противоречие спецификации `multi-selection` «Рамка выделения» устранено на уровне спецификации: пересечение оси только на участке проёма стену не выделяет (добавлен сценарий «Рамка через ось вне проёма выделяет стену»).
  - **DL-11 плана** (каноническая форма не зависит от проёмов) отдельным тестом не реализован: `displayPolygons`, `hitWall`, `findRooms`, `nearestEdgeIntersection` не принимают проёмы по сигнатуре; поведенческую часть ловят DR-01/DR-02 (помещения) и DL-01 (вырез только в отрисовке).
  - Не реализованы рекомендации DP-01 (вырез в PDF по координатам листа — нужна раскладка листа) и DL-07 (отсутствие размерной линии у нуля — нет устойчивого признака операции); риск низкий, PDF рисуется тем же `drawScene`.

- **`Drawing.doorways` необязательное.** Одобренный тест `storage.test.ts` «roundtrip сохраняет чертежи…» сравнивает `parseStore(serializeStore(store))` с документом без поля `doorways` через `toEqual`; если загрузка дописывает `doorways: []`, этот тест упадёт. Поэтому тесты проверяют `doorways ?? []`, а реализация должна сохранять отсутствие поля (тип — `doorways?: Doorway[]`). Это расходится с design D1 (`Drawing.doorways: Doorway[]`) — расхождение для design, не для спецификации: наблюдаемое поведение «пустой список» то же. То же для `Scene` / записи истории.
- **Сторона подписи H без помещения или при помещениях с обеих сторон** — решение пользователя (ревизия 3): «слева на экране от a → b», т.е. сторона нормали `(d.y, −d.x)` в координатах чертежа с осью y вниз; формулировка спецификации doorway «Отображение проёма» уточнена, добавлен сценарий «Подпись без помещения — слева на экране». Это сторона `minus` (противоположная `plus` из `doorwayDistances`). DL-03c и DL-03e фиксируют это правило; DL-03 и DL-03b — правило помещения (там «слева на экране» — снаружи).
- **Пересечение проёмов друг с другом** на одной стене спецификацией не описано; тесты его не проверяют.
- Числа DF-06 (угол 135°) проверяются с допуском 0.1 см: пробные линии design D3 (ε = 0.05) смещают границу на наклонной грани.
- Тестовые утилиты — свой записывающий контекст (`recorder`) с `clip` и толщиной линии; общий `recordingContext` из `room-area.test-utils.ts` не меняется, чтобы не задеть одобренные тесты.
