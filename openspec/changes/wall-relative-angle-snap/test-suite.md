# Test Suite

## Ревизия 3 (по повторной test-validation, VERDICT: FAIL)

- RAY-CAP-CLOSED-1: сцена заменена — прежняя тонкая стена по `displayPolygons` закрывала
  торец целиком и давала открытую грань на пути луча (ожидание противоречило спеке).
  Новая сцена `W(0,0,100,0,100)`, `W(100,45,300,45,10)` проверена через `displayPolygons`:
  тело тонкой стены сходится клином к (100,±5), закрыт участок торца y∈[−5,5], луч y=−30
  мимо тела, квадрат у торца без наложения.
- Добавлен RAY-FACE-CORNER-1 (открытый участок грани — по контуру отображаемых тел, не
  по длине оси).
- Счётчики прогона обновлены.

## Ревизия 2 (по test-validation, VERDICT: FAIL)

- Добавлены RAY-FACE-BEYOND-1, RAY-CAP-LATERAL-1, RAY-CAP-CLOSED-1 (выжившие мутации:
  без `openIntervals`/границ грани, без ограничения отрезком торца, торец не обязан быть
  свободным).
- ORTHO-FACE-3 и ORTHO-CAP-3 дополнены проверкой «внутрь стены (−normal) не притягивается».
- F3: спека «Привязка к сетке» и design D3 уточнены — конец не позади начала (нулевая
  длина) для осевого и наклонного луча; добавлены RAY-AXIS-BEHIND-1, RAY-AXIS-OFFGRID-1.
- CH-COMMIT-1 переименован по фактической проверке; test-plan уточнён.
- F4: design D1 уточнён по правилу спеки для курсора на разделяющей линии (тест не
  менялся).

Прогон до реализации (ревизия 3): `npx vitest run` — 4 файла упали, 13 прошли; 27 тестов
упали, 348 прошли (без тестов `wall-angle.test.ts` и `wall-chain.test.ts`, которые не
загружаются). Падают: 26 тестов `wall-snap-ray.test.ts` и SNAP-PRIO-2.
`wall-angle.test.ts` и `wall-chain.test.ts` не загружаются — модулей `./wall-angle` и
`./wall-chain` ещё нет; все их тесты красные по построению.

## Tests

| ID | Requirement | Test File | Test Name | Initial Result |
|---|---|---|---|---|
| REF-FACE-1 | Стена примыкания | src/wall-angle.test.ts | REF-FACE-1: начало у грани — вид «грань», нормаль наружу | FAIL (нет модуля) |
| REF-CAP-1 | Стена примыкания | src/wall-angle.test.ts | REF-CAP-1: начало у свободного торца … | FAIL (нет модуля) |
| REF-CORNER-1 | Стена примыкания | src/wall-angle.test.ts | REF-CORNER-1: внутренний угол — опора по прилипанию, не по порядку стен | FAIL (нет модуля) |
| REF-GRID-1 | Стена примыкания | src/wall-angle.test.ts | REF-GRID-1: свободное начало — стены примыкания нет | FAIL (нет модуля) |
| REF-SHAPE-1 | Стена примыкания | src/wall-angle.test.ts | REF-SHAPE-1: вид примыкания — неперечислимое поле target … | FAIL (нет модуля) |
| ANG-FACE-1 | Угол к стене примыкания | src/wall-angle.test.ts | ANG-FACE-1: перпендикуляр к грани — 90 | FAIL (нет модуля) |
| ANG-FACE-2 | Угол к стене примыкания | src/wall-angle.test.ts | ANG-FACE-2: у грани — меньший из двух углов к лучам грани | FAIL (нет модуля) |
| ANG-CAP-1 | Угол к стене примыкания | src/wall-angle.test.ts | ANG-CAP-1: продолжение торца — 180 | FAIL (нет модуля) |
| ANG-CAP-2 | Угол к стене примыкания | src/wall-angle.test.ts | ANG-CAP-2: поворот от торца в любую сторону … | FAIL (нет модуля) |
| ANG-RAY-1 | Угол к стене примыкания (дуга) | src/wall-angle.test.ts | ANG-RAY-1: луч отсчёта … | FAIL (нет модуля) |
| INV-ANG-1 | Угол к стене примыкания | src/wall-angle.test.ts | INV-ANG-1: диапазоны — грань 0..90, торец 0..180 … | FAIL (нет модуля) |
| ORTHO-FACE-1 | Привязка под 90 градусов | src/wall-angle.test.ts | ORTHO-FACE-1: перпендикуляр к наклонной стене | FAIL (нет модуля) |
| ORTHO-FACE-2 | Привязка под 90 градусов | src/wall-angle.test.ts | ORTHO-FACE-2: допуск ровно 15° включительно … | FAIL (нет модуля) |
| ORTHO-FACE-3 | Привязка под 90 градусов | src/wall-angle.test.ts | ORTHO-FACE-3: вдоль грани не притягивается | FAIL (нет модуля) |
| ORTHO-CAP-1 | Привязка под 90 градусов | src/wall-angle.test.ts | ORTHO-CAP-1: продолжение от торца | FAIL (нет модуля) |
| ORTHO-CAP-2 | Привязка под 90 градусов | src/wall-angle.test.ts | ORTHO-CAP-2: поворот от торца — в сторону курсора | FAIL (нет модуля) |
| ORTHO-CAP-3 | Привязка под 90 градусов | src/wall-angle.test.ts | ORTHO-CAP-3: диагональ от торца не притягивается | FAIL (нет модуля) |
| ORTHO-FREE-1 | Привязка под 90 градусов | src/wall-angle.test.ts | ORTHO-FREE-1: свободное начало — оси экрана | FAIL (нет модуля) |
| ORTHO-FREE-2 | Привязка под 90 градусов | src/wall-angle.test.ts | ORTHO-FREE-2: свободное начало — диагональ не притягивается | FAIL (нет модуля) |
| ORTHO-CAP-SLANT-1 | Привязка под 90 градусов | src/wall-angle.test.ts | ORTHO-CAP-SLANT-1: у торца наклонной стены — относительно её оси | FAIL (нет модуля) |
| TYPED-FACE-1 | Ввод угла | src/wall-angle.test.ts | TYPED-FACE-1: угол у грани — сторона по курсору | FAIL (нет модуля) |
| TYPED-FACE-2 | Ввод угла | src/wall-angle.test.ts | TYPED-FACE-2: курсор на другой стороне … зеркальное направление | FAIL (нет модуля) |
| TYPED-CAP-1 | Ввод угла | src/wall-angle.test.ts | TYPED-CAP-1: угол у торца … | FAIL (нет модуля) |
| TYPED-RANGE-1 | Ввод угла | src/wall-angle.test.ts | TYPED-RANGE-1: диапазоны — грань (0, 90], торец (0, 180] | FAIL (нет модуля) |
| TYPED-TIE-1 | Ввод угла | src/wall-angle.test.ts | TYPED-TIE-1: курсор на разделяющей линии … | FAIL (нет модуля) |
| PARSE-1 | Ввод угла | src/wall-angle.test.ts | PARSE-1: запятая и точка равнозначны, нечисловое — null | FAIL (нет модуля) |
| FIX-G30 | (контроль фикстуры) | src/wall-angle.test.ts | нормаль грани G30 совпадает с прилипанием начала | FAIL (нет модуля) |
| RAY-FACE-1 | Прилипание конца при заданном направлении | src/wall-snap-ray.test.ts | RAY-FACE-1: луч упирается в грань … | FAIL |
| RAY-CAP-1 | Прилипание конца при заданном направлении | src/wall-snap-ray.test.ts | RAY-CAP-1: луч упирается в свободный торец | FAIL |
| RAY-SLANT-WALL-1 | Прилипание конца при заданном направлении | src/wall-snap-ray.test.ts | RAY-SLANT-WALL-1: наклонный луч — пересечение с гранью … | FAIL |
| RAY-FACE-BEYOND-1 | Прилипание конца при заданном направлении | src/wall-snap-ray.test.ts | RAY-FACE-BEYOND-1: луч пересекает линию грани за концом стены … | FAIL |
| RAY-CAP-LATERAL-1 | Прилипание конца при заданном направлении | src/wall-snap-ray.test.ts | RAY-CAP-LATERAL-1: луч пересекает плоскость торца вне его отрезка … | FAIL |
| RAY-CAP-CLOSED-1 | Прилипание конца при заданном направлении | src/wall-snap-ray.test.ts | RAY-CAP-CLOSED-1: торец, частично закрытый примыкающей стеной, — не цель | FAIL |
| RAY-FACE-CORNER-1 | Прилипание конца при заданном направлении | src/wall-snap-ray.test.ts | RAY-FACE-CORNER-1: открытый участок грани — по отображаемому контуру … | FAIL |
| RAY-CLOSED-1 | Прилипание конца при заданном направлении | src/wall-snap-ray.test.ts | RAY-CLOSED-1: пересечение на закрытом участке грани … | FAIL |
| RAY-NOROOM-1 | Прилипание конца при заданном направлении | src/wall-snap-ray.test.ts | RAY-NOROOM-1: квадрат в пересечении налагается … | FAIL |
| RAY-REACH-1 | Прилипание конца при заданном направлении | src/wall-snap-ray.test.ts | RAY-REACH-1: пересечение дальше зоны … | FAIL |
| RAY-REACH-EQ-1 | Прилипание конца при заданном направлении | src/wall-snap-ray.test.ts | RAY-REACH-EQ-1: ровно на границе зоны … | FAIL |
| RAY-REACH-ZOOM-1 | Прилипание конца при заданном направлении | src/wall-snap-ray.test.ts | RAY-REACH-ZOOM-1: зона — больший из радиуса и полутолщины | FAIL |
| RAY-NEAREST-1 | Прилипание конца при заданном направлении | src/wall-snap-ray.test.ts | RAY-NEAREST-1: из пересечений выбирается ближайшее к курсору | FAIL |
| RAY-TIE-1 | Прилипание конца при заданном направлении | src/wall-snap-ray.test.ts | RAY-TIE-1: равные расстояния — стена раньше в массиве | FAIL |
| RAY-EXIT-1 | Прилипание конца при заданном направлении | src/wall-snap-ray.test.ts | RAY-EXIT-1: грань, через которую луч выходит из тела, не цель | FAIL |
| RAY-AXIS-1 | Привязка к сетке | src/wall-snap-ray.test.ts | RAY-AXIS-1: осевой луч … | FAIL |
| RAY-SLANT-1 | Привязка к сетке | src/wall-snap-ray.test.ts | RAY-SLANT-1: наклонный луч — длина кратна шагу сетки | FAIL |
| RAY-BEHIND-1 | Привязка к сетке | src/wall-snap-ray.test.ts | RAY-BEHIND-1: курсор позади начала — нулевая длина | FAIL |
| RAY-AXIS-BEHIND-1 | Привязка к сетке | src/wall-snap-ray.test.ts | RAY-AXIS-BEHIND-1: осевой луч, курсор позади начала — конец в начале | FAIL |
| RAY-AXIS-OFFGRID-1 | Привязка к сетке | src/wall-snap-ray.test.ts | RAY-AXIS-OFFGRID-1: начало вне сетки, ближайший узел позади начала … | FAIL |
| SNAP-ORTHO-WALL-1 | Привязка под 90 градусов (приоритет) | src/wall-snap-ray.test.ts | SNAP-ORTHO-WALL-1: сработавшее орто — конец на пересечении … | FAIL |
| SNAP-ORTHO-WALL-2 | Привязка под 90 градусов (регресс) | src/wall-snap-ray.test.ts | SNAP-ORTHO-WALL-2: орто не сработало — прежнее прилипание | PASS (ожидаемо: поведение сохраняется) |
| INV-RAY-1/2 ×4 | Прилипание конца при заданном направлении | src/wall-snap-ray.test.ts | INV-RAY-1/2: сцена S / L / T / N … | FAIL |
| RAY-PURE-1 | Детерминированность привязки | src/wall-snap-ray.test.ts | RAY-PURE-1: сцены не мутируются, результат повторяем | FAIL |
| CH-SLANT-1 | Привязка под 90 градусов | src/wall-chain.test.ts | CH-SLANT-1: перпендикуляр к наклонной стене … | FAIL (нет модуля) |
| CH-CAP-1 | Привязка под 90 градусов | src/wall-chain.test.ts | CH-CAP-1: от торца — продолжение 180 и поворот 90 … | FAIL (нет модуля) |
| CH-FREE-1 | Привязка под 90 градусов | src/wall-chain.test.ts | CH-FREE-1: свободное начало — оси экрана … | FAIL (нет модуля) |
| CH-FREE-2 | Ввод угла / Угол к стене примыкания | src/wall-chain.test.ts | CH-FREE-2: свободное начало — введённый угол не применяется | FAIL (нет модуля) |
| CH-OFF-1 | Угол к стене / Привязка под 90 | src/wall-chain.test.ts | CH-OFF-1: орто выключено — направление свободное … | FAIL (нет модуля) |
| CH-LEN-1 | Привязка под 90 / Фиксация по длине | src/wall-chain.test.ts | CH-LEN-1: орто выключено — точная длина вдоль превью … | FAIL (нет модуля) |
| CH-LEN-2 | Привязка под 90 / Фиксация по длине | src/wall-chain.test.ts | CH-LEN-2: орто включено — точная длина строго по опорному | FAIL (нет модуля) |
| CH-LEN-3 | Ввод угла | src/wall-chain.test.ts | CH-LEN-3: угол и длина … | FAIL (нет модуля) |
| CH-COMMIT-1 | Фиксация по длине (превью = фиксация) | src/wall-chain.test.ts | CH-COMMIT-1: превью и фиксация — один расчёт, одинаковый конец … | FAIL (нет модуля) |
| CH-TYPED-1 | Ввод угла | src/wall-chain.test.ts | CH-TYPED-1: введённый угол приоритетнее орто | FAIL (нет модуля) |
| CH-TYPED-2 | Ввод угла | src/wall-chain.test.ts | CH-TYPED-2: угол вне диапазона или 0 не применяется | FAIL (нет модуля) |
| CH-TYPED-3 | Прилипание конца при заданном направлении | src/wall-chain.test.ts | CH-TYPED-3: луч введённого угла упирается в грань … | FAIL (нет модуля) |
| CH-END-1 | Прилипание конца при заданном направлении | src/wall-chain.test.ts | CH-END-1: перпендикуляр от стены до противоположной … | FAIL (нет модуля) |
| CH-END-2 | Привязка к существующим стенам (регресс) | src/wall-chain.test.ts | CH-END-2: без заданного направления — прежнее прилипание | FAIL (нет модуля) |
| CH-ZERO-1 | Угол к стене примыкания | src/wall-chain.test.ts | CH-ZERO-1: курсор в начале — нет направления и угла | FAIL (нет модуля) |
| CH-DET-1 | Детерминированность | src/wall-chain.test.ts | CH-DET-1: входы не мутируются, результат повторяем | FAIL (нет модуля) |

### Изменённые утверждённые тесты (test-change-request, согласовано владельцем)

| ID | Test File | Изменение | Initial Result |
|---|---|---|---|
| SNAP-PRIO-2 | src/wall-geometry.test.ts | ожидание заменено: при сработавшем орто конец на луче по сетке `(50,0)`, `grid` | FAIL (ожидаемо) |
| SNAP-CHAIN-1 | src/wall-snap-scenes.test.ts | вызов без `orthoFrom`; проверка «конец не в точке оси стыка» сохранена | PASS |
| INV-CHAIN-SAME-1 | src/wall-snap-scenes.test.ts | позиции со сработавшим экранным орто исключены (их покрывают INV-RAY-1/2) | PASS |
| `describe("lockedDirection")` | src/geometry.test.ts | удалён вместе с импортом (функция заменяется `orthoDirection`) | — |
| CLN-COVER-4 | src/geometry-cleanup.test.ts | удалён (требовал наличия теста `lockedDirection`) | — |

## Coverage

### Happy paths

- Опора начала у грани и торца; угол 90/180; орто относительно наклонной стены и торца;
  экранное орто при свободном начале; введённый угол и длина; конец в пересечении луча.

### Boundary cases

- Допуск орто ровно 15° (ORTHO-FACE-2); зона прилипания ровно 10 см и 10.01 см
  (RAY-REACH-EQ-1); зона по полутолщине и по радиусу (RAY-REACH-ZOOM-1); диапазоны
  угла 0 / 0.5 / 90 / 90.0001 / 180 / 180.5 (TYPED-RANGE-1); курсор на разделяющей
  линии (TYPED-TIE-1); курсор позади начала (RAY-BEHIND-1); курсор в начале (CH-ZERO-1).

### Negative cases

- Угол вне диапазона, 0, NaN, нечисловой текст; угол при свободном начале; закрытый
  участок; нет места для квадрата; грань выхода луча; вдоль грани при орто; диагональ.

### Invariants

- Конец на луче и не позади начала, прилипший квадрат без наложения, конец не внутри
  тел (INV-RAY-1/2); диапазоны угла (INV-ANG-1); детерминизм и чистота (RAY-PURE-1,
  CH-DET-1, CH-COMMIT-1).

### Integration cases

- `startRefOf(snapVertex(...))` → `chainSegment` (CH-SLANT-1, CH-CAP-1, CH-TYPED-3,
  CH-END-1); `snapVertex(…, orthoFrom)` через луч (SNAP-ORTHO-WALL-1/2, SNAP-PRIO-2).

## Unexpected Passes

- Нет. Прошедшие SNAP-ORTHO-WALL-2, SNAP-CHAIN-1, INV-CHAIN-SAME-1 проверяют
  поведение, которое изменение сохраняет (прилипание без заданного направления).

## Tests That Could Not Run

- Все тесты `wall-angle.test.ts` и `wall-chain.test.ts` — модули не существуют до
  реализации (ошибка импорта; ожидаемо для red-фазы).
- DOM-сценарии (поле «Угол», Tab, активность, Enter/Esc, дуга) — автотестов нет, ручная
  проверка (test-plan Out of Scope).
