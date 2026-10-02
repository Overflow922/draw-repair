# Test Suite

Прогон до реализации (ревизия 3): `npx vitest run` — 658 тестов, 624 passed,
34 failed (все падения — ожидаемые: 21 новый тест и 13 пересмотренных,
перечислены ниже); `npx tsc --noEmit` — без ошибок.

Ревизия 3 по повторной валидации: отменён пересмотр SNAP-CHAIN-3 и CE-CAP-1 —
оба вызывают `snapVertex` с `orthoFrom`, направление задано орто, и конец по
спецификации («Прилипание конца при заданном направлении») остаётся в плоскости
торца (100, 0); таблица пересмотра в test-plan.md исправлена. CV-RANK-1
проверяет и `snapStartVertex`.

Ревизия 2 по test-validation.md:

1. пересмотрен пропущенный TRK-RAY-PAR-2 (`src/wall-tracking.test.ts`);
2. добавлен CV-OVL-1 (мутация M7: неналожение от вершины);
3. помощники неналожения `expectNoOverlap` (wall-snap-scenes),
   `expectStuckWithoutOverlap` и развёртка GS-09 (wall-snap-start) проверяют
   отображаемый квадрат `placementSquare(snap, t)` вместо
   `squareOnNormal(snap.point, …)` — усиление: у торца вершина больше не на
   стороне квадрата;
4. добавлен CV-RANK-1 (мутация M8: ранжирование по сдвинутой вершине);
5. добавлены CV-TRK-FAR (M12) и CV-LEN-1 (M16);
6. CV-JOINT-SWEEP переименован: независимость вершины от направления
   структурна (начало — вход `chainSegment`), тест проверяет чистоту стыка;
   ложная проверка `snap.point` внутри цикла убрана, проверка вершины — до цикла.

## Tests

Новый файл `src/wall-snap-cap-vertex.test.ts` (31 тест, все обнаружены vitest).

| ID | Requirement | Test File | Test Name | Initial Result |
|---|---|---|---|---|
| CV-START-1 | Квадрат при установке стены; Привязка к существующим стенам | src/wall-snap-cap-vertex.test.ts | CV-START-1: начало у торца — вершина на оси на полтолщины новой стены за плоскостью торца | FAIL (100 вместо 110) |
| CV-SHAPE-1 | Контракт `{point, source}` | src/wall-snap-cap-vertex.test.ts | CV-SHAPE-1: контракт результата {point, source} сохранён у вершины торца | FAIL (точка) |
| CV-SQ-1 | Квадрат при установке стены | src/wall-snap-cap-vertex.test.ts | CV-SQ-1: квадрат установки по-прежнему приставлен к плоскости торца и не налагается | PASS (регрессия: квадрат не должен сдвинуться) |
| CV-THICK-1 | Привязка к существующим стенам | src/wall-snap-cap-vertex.test.ts | CV-THICK-1: смещение — полтолщины НОВОЙ стены, квадрат у плоскости торца | FAIL |
| CV-CAP-A | Привязка к существующим стенам | src/wall-snap-cap-vertex.test.ts | CV-CAP-A: начальный торец a — смещение наружу от a | FAIL |
| CV-SLANT-1 | Квадрат при установке стены | src/wall-snap-cap-vertex.test.ts | CV-SLANT-1: торец наклонной стены — вершина на продолжении оси | FAIL |
| CV-CONT-1 | Привязка к существующим стенам («Продолжение линии стены») | src/wall-snap-cap-vertex.test.ts | CV-CONT-1: продолжение полосы за торцом вне радиуса от точки торца — центр квадрата | FAIL |
| CV-GRID-1 | Квадрат по сетке не касается стен | src/wall-snap-cap-vertex.test.ts | CV-GRID-1: квадрат по сетке у свободного торца — вершина (10, 0) | FAIL |
| CV-REACH-1 | Привязка к существующим стенам (зона торца) | src/wall-snap-cap-vertex.test.ts | CV-REACH-1: масштаб 1, новая 20 — граница reach включительно | FAIL |
| CV-REACH-2 | то же | src/wall-snap-cap-vertex.test.ts | CV-REACH-2: отдалённый вид — reach = радиус 24 | FAIL |
| CV-REACH-3 | то же | src/wall-snap-cap-vertex.test.ts | CV-REACH-3: толстая новая — reach = newHalf = 20 | FAIL |
| CV-BAND-1 | то же (граница полосы) | src/wall-snap-cap-vertex.test.ts | CV-BAND-1: граница полосы — на полосе торец, за ней грань | FAIL |
| CV-END-1 | Квадрат при установке стены; Квадрат не налагается («Последний блок у свободного торца») | src/wall-snap-cap-vertex.test.ts | CV-END-1: подход вдоль оси — конец в центре квадрата, квадрат у плоскости торца | FAIL |
| CV-END-PERP | то же + стык | src/wall-snap-cap-vertex.test.ts | CV-END-PERP: подход перпендикулярно оси — конец в центре квадрата, стык без наложения | FAIL |
| CV-RAY-OFFAXIS | Прилипание конца при заданном направлении | src/wall-snap-cap-vertex.test.ts | CV-RAY-OFFAXIS: луч вдоль оси со смещением — конец (100, 5), не центр квадрата | PASS (регрессия: луч не меняется) |
| CV-RAY-AXIS | то же | src/wall-snap-cap-vertex.test.ts | CV-RAY-AXIS: луч по оси — конец в плоскости торца (100, 0) | PASS (регрессия) |
| CV-RAY-CHAIN | то же, через `chainSegment` | src/wall-snap-cap-vertex.test.ts | CV-RAY-CHAIN: орто-сегмент к торцу — конец (100, 0), квадрат — последний блок | PASS (регрессия) |
| CV-GEO-90 | Поворот на 90° от торца (геометрия стыка) | src/wall-snap-cap-vertex.test.ts | CV-GEO-90: поворот 90° — квадрат покрыт, торец заподлицо с наружной гранью A | PASS (проверка опоры дизайна D7 на существующих стыках) |
| CV-GEO-SWEEP | Непрямой угол от торца без наложения (геометрия) | src/wall-snap-cap-vertex.test.ts | CV-GEO-SWEEP: любой угол от продолжения до 120° в обе стороны — без наложения, тело доходит до торца | PASS (то же) |
| CV-JOINT-90 | Поворот на 90° от торца — квадрат первый блок (интеграция) | src/wall-snap-cap-vertex.test.ts | CV-JOINT-90: орто вправо от торца — квадрат первый блок, без наложения, A не изменилась | FAIL |
| CV-JOINT-180 | Коллинеарное продолжение (интеграция) | src/wall-snap-cap-vertex.test.ts | CV-JOINT-180: продолжение по оси — квадрат покрыт, тела соприкасаются в плоскости торца | FAIL |
| CV-JOINT-SWEEP | Непрямой угол от торца без наложения (интеграция) | src/wall-snap-cap-vertex.test.ts | CV-JOINT-SWEEP: от вершины у торца стык чистый при любом направлении | FAIL |
| CV-LEN-1 | Привязка к существующим стенам; length-input (длина от вершины) | src/wall-snap-cap-vertex.test.ts | CV-LEN-1: введённая длина — от вершины в центре квадрата | FAIL |
| CV-OVL-1 | Квадрат не налагается на тела стен | src/wall-snap-cap-vertex.test.ts | CV-OVL-1: квадрат у плоскости торца налагался бы на соседа — торец не цель | PASS (регрессия; убивает M7) |
| CV-RANK-1 | Детерминированность / выбор цели (design D3) | src/wall-snap-cap-vertex.test.ts | CV-RANK-1: ближайшая цель — по точке приставления квадрата, а не по сдвинутой вершине | PASS (регрессия; убивает M8) |
| CV-TRK-FAR | Трекинг по узлам чертежа | src/wall-snap-cap-vertex.test.ts | CV-TRK-FAR: дальний конец оси стены примыкания остаётся узлом | FAIL |
| CV-JOINT-THIN | Привязка к существующим стенам (толщины) | src/wall-snap-cap-vertex.test.ts | CV-JOINT-THIN: новая тоньше A — квадрат покрыт, без наложения | FAIL |
| CV-JOINT-THICK | то же | src/wall-snap-cap-vertex.test.ts | CV-JOINT-THICK: новая толще A — без наложения (выступ квадрата вне объёма) | FAIL |
| CV-TRK-1 | Трекинг по узлам чертежа | src/wall-snap-cap-vertex.test.ts | CV-TRK-1: начало у торца A — горизонталь конца оси A не подтягивает конец | FAIL |
| CV-TRK-CTRL | то же (контроль) | src/wall-snap-cap-vertex.test.ts | CV-TRK-CTRL: без опоры то же начало — конец оси A узел, трекинг срабатывает | PASS (контроль) |
| CV-TRK-FACE | то же (опора-грань не исключает) | src/wall-snap-cap-vertex.test.ts | CV-TRK-FACE: опора-грань не исключает узлы — конец оси A остаётся узлом | PASS (регрессия) |

### Пересмотренные существующие тесты (изменение спецификации)

Изменены только ожидаемые координаты вершины торца (плоскость торца → центр
квадрата) — по изменённым сценариям `wall-drawing`. Нормали, источники, границы
зон, проверки неналожения и квадраты сохранены; ни одна проверка не удалена.

| ID | Test File | Изменение | Initial Result |
|---|---|---|---|
| SNAP-END-2 | src/wall-geometry.test.ts | (100,0) → (110,0); имя теста | FAIL |
| SNAP-END-3 | src/wall-geometry.test.ts | insideBand, onBandEdge: (100,0) → (110,0) | FAIL |
| SNAP-CONT-1 | src/wall-geometry.test.ts | (100,0) → (110,0) | FAIL |
| SNAP-CAP-N1 | src/wall-snap-scenes.test.ts | (100,0) → (110,0) | FAIL |
| SNAP-SCALE-2 | src/wall-snap-scenes.test.ts | торец: (100,0) → (110,0) | FAIL |
| SNAP-SCALE-3 | src/wall-snap-scenes.test.ts | торец: (100,0) → (110,0) | FAIL |
| GS-04 | src/wall-snap-start.test.ts | (0,0) → (10,0) | FAIL |
| GS-17 | src/wall-snap-start.test.ts | (125,200) → (125,210) | FAIL |
| CAP-REACH-1/2/3/A | src/wall-snap-cap-reach.test.ts | прилипшие строки: конец оси → центр квадрата; строки «сетка» без изменений | FAIL |
| TRK-RAY-PAR-2 | src/wall-tracking.test.ts | начало (300,0) → (310,0), конец (300,200) → (310,200) | FAIL |
| `expectNoOverlap` | src/wall-snap-scenes.test.ts | квадрат `placementSquare(r, t)` вместо `squareOnNormal(r.point, …)` (усиление) | PASS |
| `expectStuckWithoutOverlap`, GS-09 | src/wall-snap-start.test.ts | то же (усиление) | PASS |

## Coverage

### Happy paths

- Начало у торца (`snapStartVertex`, `snapVertex`) — центр квадрата: CV-START-1,
  CV-CAP-A, CV-SLANT-1, CV-CONT-1, CV-GRID-1.
- Свободный конец без направления: CV-END-1, CV-END-PERP.
- Полный путь клик → сегмент → стык: CV-JOINT-90, CV-JOINT-180.

### Boundary cases

- Граница reach от плоскости торца (включительно / за ней, та же точка — разный
  источник): CV-REACH-1..3.
- Граница полосы: CV-BAND-1.
- Толщины: новая тоньше/толще, существующая толще: CV-THICK-1, CV-JOINT-THIN,
  CV-JOINT-THICK.
- Стык ровно на границе допуска (расстояние = jointTol): CV-JOINT-90, CV-GEO-90.
- Трекинг: линия в 8 см при радиусе 12: CV-TRK-1.

### Negative cases

- Луч не сдвигается в центр квадрата: CV-RAY-OFFAXIS, CV-RAY-AXIS, CV-RAY-CHAIN.
- Опора-грань и отсутствие опоры не исключают узел: CV-TRK-FACE, CV-TRK-CTRL.

### Invariants

- Без наложения тел и без изменения ранее нарисованной стены для выборки углов
  0…120° в обе стороны: CV-GEO-SWEEP, CV-JOINT-SWEEP.
- Квадрат установки не сдвигается и не налагается: CV-SQ-1, CV-THICK-1.
- Контракт `{point, source}`: CV-SHAPE-1.
- Входные стены заморожены (`deepFreeze`) во всех тестах привязки.
- Существующие скан-тесты неналожения (`wall-snap-scenes`, `wall-snap-start`)
  остаются зелёными.

### Integration cases

- `snapStartVertex` → `startRefOf` → `chainSegment` → `displayPolygons`:
  CV-JOINT-*, CV-TRK-1.

## Unexpected Passes

- Нет. Десять проходящих новых тестов проходят намеренно: CV-OVL-1 и CV-RANK-1 —
  регрессия прежнего выбора цели (ловят мутации M7, M8); остальные: регрессия квадрата и
  луча (CV-SQ-1, CV-RAY-*), контроли трекинга (CV-TRK-CTRL, CV-TRK-FACE) и
  проверка существующих правил стыков для вершины в центре квадрата (CV-GEO-90,
  CV-GEO-SWEEP — подтверждают дизайн D7 без привязки).

## Tests That Could Not Run

- Нет. Отрисовка `main.ts` модульными тестами не покрыта (вне объёма,
  test-plan.md).
- Отклонения от test-plan.md: CV-REF-1/CV-REF-FACE и CV-TRK-NODES (поле `anchor`
  опоры и третий параметр `trackingNodes`) не тестируются напрямую — это детали
  дизайна; поведение проверяется наблюдаемо через `chainSegment` (CV-TRK-1,
  CV-TRK-CTRL, CV-TRK-FACE).
