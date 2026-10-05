# Test Suite

Исполняемые тесты change `ortho-axis-lock`. Запуск: `npx vitest run src/ortho-axis.test.ts src/geometry-snap-along-axis.test.ts src/wall-edit-ortho-axis.test.ts src/ortho-gesture-step.test.ts src/ortho-gesture.test.ts`.

Вспомогательные файлы:

- `src/ortho-axis.test-utils.ts` — сцены R, R2, U (раскладка снимка пользователя), Free, F;
- `src/ortho-gesture.test-utils.ts` — прогон жеста `moveGesture` / `endpointGesture`: только обвязка, как в `main.ts` (снимок → производственный `orthoGestureStep` → `moveWallsBounded` / `moveEndpointBounded`); правил жеста в тестовом коде нет (design D2, ревизия после валидации 1).

Требования: WS-NB — `wall-selection` «Орто без боковой составляющей»; WS-MV — «Перемещение стены за средний маркер»; WS-EP — «Изменение длины перетаскиванием конца»; MS-GD — `multi-selection` «Групповое перетаскивание стен».

## Tests

| ID | Requirement | Test File | Test Name | Initial Result |
|---|---|---|---|---|
| AX-1 | WS-NB | src/ortho-axis.test.ts | AX-1: первое смещение (3, 1) — горизонталь; (1, 3) — вертикаль; знак не важен | FAIL (module missing) |
| AX-2 | WS-NB | src/ortho-axis.test.ts | AX-2: равные составляющие (−2, 2) — горизонталь | FAIL (module missing) |
| AX-3 | WS-NB | src/ortho-axis.test.ts | AX-3: равные составляющие (3, −3) — горизонталь | FAIL (module missing) |
| AX-6 | WS-NB | src/ortho-axis.test.ts | AX-6: вертикальная составляющая чуть больше — вертикаль (порога нет) | FAIL (module missing) |
| AX-6b | WS-NB | src/ortho-axis.test.ts | AX-6b: составляющая по одной оси — эта ось; угол 30° и 60° не «вне орто» | FAIL (module missing) |
| AX-7 | WS-NB | src/ortho-axis.test.ts | AX-7: нулевой вектор — оси нет | FAIL (module missing) |
| AX-7b | WS-NB | src/ortho-axis.test.ts | AX-7b: до выбора нулевое смещение оставляет ось невыбранной | FAIL (module missing) |
| AX-8 (unit) | WS-NB | src/ortho-axis.test.ts | AX-8: первое ненулевое смещение выбирает ось | FAIL (module missing) |
| AX-4 | WS-NB | src/ortho-axis.test.ts | AX-4: выбранная ось не меняется при любом дальнейшем направлении | FAIL (module missing) |
| AX-5 | WS-NB | src/ortho-axis.test.ts | AX-5: возврат указателя в точку нажатия не сбрасывает ось | FAIL (module missing) |
| AX-10 | WS-NB | src/ortho-axis.test.ts | AX-10: составляющая поперёк оси обнуляется, вдоль — сохраняется | FAIL (module missing) |
| SA-1 | WS-NB | src/geometry-snap-along-axis.test.ts | SA-1: опорная точка вне сетки, вертикальная ось — x как у опорной, y по сетке | FAIL (snapAlongAxis is not a function) |
| SA-2 | WS-NB | src/geometry-snap-along-axis.test.ts | SA-2: линия вертикальной стены в радиусе — пересечение горизонтали с линией стены | FAIL (snapAlongAxis is not a function) |
| SA-3 | WS-NB | src/geometry-snap-along-axis.test.ts | SA-3: параллельная оси стена рядом игнорируется — точка на оси по сетке | FAIL (snapAlongAxis is not a function) |
| SA-5 | WS-NB | src/geometry-snap-along-axis.test.ts | SA-5: курсор под 30° от опорной точки — точка всё равно на горизонтали | FAIL (snapAlongAxis is not a function) |
| SA-6 | WS-NB | src/geometry-snap-along-axis.test.ts | SA-6: ось задана явно — курсор почти на вертикали не меняет горизонтальную ось | FAIL (snapAlongAxis is not a function) |
| SA-7 | WS-NB | src/geometry-snap-along-axis.test.ts | SA-7: конец стены в радиусе — его проекция на ось | FAIL (snapAlongAxis is not a function) |
| INV-SNAP | WS-NB | src/geometry-snap-along-axis.test.ts | координата поперёк оси точно равна координате опорной точки | FAIL (snapAlongAxis is not a function) |
| WE-1 | WS-NB, WS-MV | src/wall-edit-ortho-axis.test.ts | WE-1: диагональ (30, −40) у комнаты — вектор (0, −40), нижняя стена не сдвинута | FAIL (assertion: x = 30) |
| WE-2 | WS-NB, WS-MV | src/wall-edit-ortho-axis.test.ts | WE-2: ровно 45° (30, −30) — горизонталь … | FAIL (assertion: y = −30) |
| WE-U | WS-NB, WS-MV | src/wall-edit-ortho-axis.test.ts | WE-U: раскладка пользователя, диагональ (30, −40) — двигаются только S и концы её соседей | FAIL (assertion: x = 30; весь чертёж сдвинут) |
| WE-R2 | WS-NB, WS-MV | src/wall-edit-ortho-axis.test.ts | WE-R2: две комнаты, диагональ (40, −40.5) у T1 — вертикаль; нижняя стена B не сдвинута | FAIL (assertion: x = 40) |
| WE-INV | WS-NB | src/wall-edit-ortho-axis.test.ts | WE-INV: применённый вектор не имеет составляющей поперёк оси большей составляющей запроса | FAIL (assertion) |
| INV-NO-CASCADE | WS-NB, WS-MV | src/wall-edit-ortho-axis.test.ts | INV-NO-CASCADE: вектор с преобладающей вертикалью не сдвигает нижнюю стену комнаты (R и R2) | FAIL (assertion: bottom moved) |
| WE-3 | WS-NB, WS-EP | src/wall-edit-ortho-axis.test.ts | WE-3: цель (430, −300) (35° от горизонтали) — конец на горизонтали (430, 0) … | FAIL (assertion: y = −300) |
| WE-4 | WS-NB, WS-EP | src/wall-edit-ortho-axis.test.ts | WE-4: наклонная стена (0,0)–(100,58), цель (101, 58) — стена становится горизонтальной | FAIL (assertion: y = 58) |
| GE-4 | WS-NB, WS-EP | src/wall-edit-ortho-axis.test.ts | GE-4: примкнутый конец, цель (60, 100) — … стена на месте | FAIL (assertion: y = 100); заменяет TB-19a — см. test-change-request.md |
| GS-1 | WS-MV, WS-NB | src/ortho-gesture.test.ts | GS-1: в любом направлении первого смещения стена движется строго вдоль оси жеста | FAIL (module missing) |
| GS-2 | WS-MV | src/ortho-gesture.test.ts | GS-2: комната, сначала вверх, затем указатель в (30, −40) … | FAIL (module missing) |
| GS-3 | WS-NB | src/ortho-gesture.test.ts | GS-3: ось сохраняется до отпускания … | FAIL (module missing) |
| GS-4 | WS-NB | src/ortho-gesture.test.ts | GS-4: возврат указателя в точку нажатия не сбрасывает ось … | FAIL (module missing) |
| GS-5 | WS-NB | src/ortho-gesture.test.ts | GS-5: новый жест выбирает ось заново | FAIL (module missing) |
| GS-6 | WS-NB | src/ortho-gesture.test.ts | GS-6: первое смещение под 30° — орто действует, стена на горизонтали | FAIL (module missing) |
| GS-7 | WS-NB | src/ortho-gesture.test.ts | GS-7: орто выключено — тот же жест привязывается по обеим координатам | FAIL (module missing) |
| GS-8 | WS-MV | src/ortho-gesture.test.ts | GS-8: две комнаты, диагональный жест вверх — нижняя стена B не сдвинута | FAIL (module missing) |
| GS-U | WS-MV | src/ortho-gesture.test.ts | GS-U: раскладка пользователя, диагональный жест — двигаются только S и концы её соседей | FAIL (module missing) |
| AX-8 (gesture) | WS-NB | src/ortho-gesture.test.ts | AX-8: нулевое смещение до выбора оси — стена не сдвигается и ось не выбрана | FAIL (module missing) |
| AX-8b | WS-NB | src/ortho-gesture.test.ts | AX-8b: после нулевого шага первое ненулевое смещение вверх выбирает вертикаль | FAIL (module missing) |
| AX-9 | WS-NB | src/ortho-gesture.test.ts | AX-9: первое смещение ровно 45° (10, −10) — горизонталь | FAIL (module missing) |
| INV-LATCH | WS-NB | src/ortho-gesture.test.ts | после выбора оси координата опорного конца поперёк оси не меняется ни на одном шаге | FAIL (module missing) |
| GE-1 | WS-EP | src/ortho-gesture.test.ts | GE-1: комната, конец верхней стены сначала вправо, затем в (30, −40) … | FAIL (module missing) |
| GE-2 | WS-EP | src/ortho-gesture.test.ts | GE-2: наклонная стена (0,0)–(100,58) — горизонталь через a, конец b на y = 0 | FAIL (module missing) |
| GE-3 | WS-NB, WS-EP | src/ortho-gesture.test.ts | GE-3: первое смещение конца 5 см вверх — ось по направлению от противоположного конца … | FAIL (module missing) |
| GG-1 | MS-GD | src/ortho-gesture.test.ts | GG-1: две стены, сначала вправо, затем (30, −40) от нажатия — обе сдвинуты на (30, 0) | FAIL (module missing) |
| GE-6 | WS-NB, WS-EP | src/ortho-gesture.test.ts | GE-6: первый шаг указателя без смещения от точки нажатия не выбирает ось; ось — по первому ненулевому смещению | FAIL (module missing) |
| GE-5 | WS-NB, WS-EP | src/wall-edit-ortho-axis.test.ts | GE-5: наклонная ножка S (10,200)–(110,260), примкнутый конец a — ось по вектору от второго конца | FAIL (assertion для цели (40, 230)) |
| WC-1 | WS-NB, wall-collision | src/wall-edit-ortho-axis.test.ts | WC-1: диагональ (30, −100) к стене над комнатой — вертикаль до касания (0, −30) | FAIL (assertion) |
| OG-1 | WS-NB | src/ortho-gesture-step.test.ts | OG-1: новый жест начинается без оси — следующий жест выбирает ось заново | FAIL (module missing) |
| OG-2 | WS-NB | src/ortho-gesture-step.test.ts | OG-2: указатель в точке нажатия — оси и цели нет | FAIL (module missing) |
| OG-3 | WS-NB | src/ortho-gesture-step.test.ts | OG-3: первое смещение (3, 1) — горизонталь; цель — опорная точка + смещение на оси | FAIL (module missing) |
| OG-4 | WS-NB | src/ortho-gesture-step.test.ts | OG-4: защёлкнутая ось не меняется — шаг (10, 80) после горизонтали даёт цель на горизонтали | FAIL (module missing) |
| OG-5 | WS-NB | src/ortho-gesture-step.test.ts | OG-5: равные составляющие первого смещения (−10, 10) — горизонталь | FAIL (module missing) |
| OG-6 | WS-NB | src/ortho-gesture-step.test.ts | OG-6: шаг не меняет исходное состояние жеста | FAIL (module missing) |
| OG-7 | WS-NB | src/ortho-gesture-step.test.ts | OG-7: первое смещение под 30° — цель на горизонтали через опорную точку | FAIL (module missing) |
| OG-8 | WS-NB | src/ortho-gesture-step.test.ts | OG-8: опорная точка вне сетки (5, 15) — координата поперёк оси сохраняется, вдоль — по сетке | FAIL (module missing) |
| OG-9 | WS-NB, WS-EP | src/ortho-gesture-step.test.ts | OG-9: направляющий вектор — от противоположного конца: смещение конца 5 вверх даёт горизонталь | FAIL (module missing) |
| OG-10 | WS-NB, WS-EP | src/ortho-gesture-step.test.ts | OG-10: указатель в точке нажатия — ось не выбрана, хотя вектор от противоположного конца ненулевой | FAIL (module missing) |
| OG-11 | WS-EP | src/ortho-gesture-step.test.ts | OG-11: цель конца — указатель на оси через противоположный конец | FAIL (module missing) |
| OG-12 | WS-NB (D4) | src/ortho-gesture-step.test.ts | OG-12: стена, увлекаемая правкой, не притягивает — правая стена комнаты при перетаскивании угла вправо | FAIL (module missing) |
| OG-13 | WS-NB (D4) | src/ortho-gesture-step.test.ts | OG-13: неувлекаемая стена притягивает вдоль оси — пересечение оси с её линией | FAIL (module missing) |
| OG-14 | WS-NB (D4) | src/ortho-gesture-step.test.ts | OG-14: перемещение — стена, увлекаемая целиком, не притягивает | FAIL (module missing) |

| OG-15 | WS-NB (D4) | src/ortho-gesture-step.test.ts | OG-15: перемещение — увлекаемая левая стена вне сетки (x = 3) не притягивает; цель по сетке (10, 0) | FAIL (module missing) |
| OG-16 | WS-NB (D4) | src/ortho-gesture-step.test.ts | OG-16: перетаскивание конца — стена K, увлекаемая по цепочке, не притягивает | FAIL (module missing) |
| OG-17 | WS-NB (D4) | src/ortho-gesture-step.test.ts | OG-17: вертикальный сдвиг верхней стены — неувлекаемая нижняя стена вне сетки (y = 303) притягивает | FAIL (module missing) |

| OG-18 | WS-NB (D4), WS-MV «Стык не блокирует перемещение» | src/ortho-gesture-step.test.ts | OG-18: перемещение — растягиваемая боковая стена не притягивает к прежнему стыку (комната вне сетки, y = 3) | FAIL (module missing) |
| OG-19 | WS-NB (D4), WS-EP | src/ortho-gesture-step.test.ts | OG-19: перетаскивание конца — растягиваемая соосная стена N не притягивает к прежнему стыку | FAIL (module missing) |

Итого новых тестов: 67 (по ID), все падают до реализации. Полный прогон: 18 failed (видимые), 3 файла не загружаются (`./ortho-axis`, `./ortho-gesture` отсутствуют), 1115 существующих тестов проходят.

GE-5: цель `(40, 260)` проходит и до реализации (вектор от второго конца горизонтален и в прежнем конусе 15°) — это страж мутации «ось по `target − base`»; цель `(40, 230)` (23°) падает до реализации.

## Validation round 1 → changes

Валидация 1 — `VERDICT: FAIL`. Исправлено:

- F1: правила жеста перенесены из тестового симулятора в производственный модуль `src/ortho-gesture.ts` (design D2 обновлён); тесты OG-1…OG-14 и прогон GS/GE/GG вызывают его.
- F2: GE-5 (наклонная примкнутая ножка).
- F3: GE-6, OG-10 (ось конца — только при ненулевом смещении от точки нажатия; design D2 приведён к спецификации).
- F4/F5: WC-1; SA-7 проверяет `axisWall === null`; GE-3 проверяет `H.b` целиком; лишняя пустая строка в `wall-edit-tee.test.ts` убрана.

## Validation round 2 → changes

Валидация 2 — `VERDICT: FAIL` (выжили мутанты правила D4: фильтр увлекаемых стен убран, план по другой оси, план по сырому смещению). Исправлено:

- F6: OG-15, OG-16, OG-17 — геометрия вне сетки, где ожидаемая точка отличается от точки привязки к увлекаемой стене.
- F7: устаревшие описания симулятора и соответствие мутаций в test-plan.md исправлены.

## Coverage

### Happy paths

- Перемещение стены, группы, конца по оси жеста: GS-1, GS-2, GG-1, GE-1, GE-2, WE-1, WE-3.
- Привязка вдоль заданной оси к стенам и сетке: SA-1, SA-2, SA-7.

### Boundary cases

- Равные составляющие → горизонталь: AX-2, AX-3, AX-9, WE-2.
- Почти равные составляющие (порога нет): AX-6, AX-6b.
- Нулевое смещение до выбора оси: AX-7, AX-7b, AX-8, AX-8b.
- Курсор под 30°, 45°, 60° от опорной точки: SA-5, SA-6, GS-6, INV-SNAP.
- Первое смещение конца поперёк стены: GE-3.

### Negative cases

- Диагональный жест не увлекает несвязанные стены: GS-2, GS-8, GS-U, WE-1, WE-U, WE-R2, INV-NO-CASCADE.
- Защёлкнутая ось не меняется: AX-4, AX-5, GS-3, GS-4, INV-LATCH.
- Параллельная оси стена не притягивает поперёк оси: SA-3.
- Примкнутый конец при оси без допустимого положения остаётся на месте: GE-4.
- Без орто защёлка не действует: GS-7.

### Invariants

- INV-AXIS: WE-INV.
- INV-NO-CASCADE: INV-NO-CASCADE.
- INV-LATCH: INV-LATCH.
- INV-SNAP: INV-SNAP.

### Integration cases

- Жест целиком (защёлка → привязка вдоль оси с исключением увлекаемых стен → правка с ограничениями): GS-*, GE-1..3, GG-1, AX-8, AX-8b, AX-9, INV-LATCH.
- Раскладка снимка пользователя (`img.png`): WE-U, GS-U — до реализации диагональ сдвигает все 10 стен.

## Unexpected Passes

- Нет.

## Tests That Could Not Run

- `src/ortho-axis.test.ts`, `src/ortho-gesture-step.test.ts`, `src/ortho-gesture.test.ts` — не загружаются до реализации: модули `src/ortho-axis.ts`, `src/ortho-gesture.ts` (design D1, D2) отсутствуют. Ожидаемо.
- Обработчики DOM `main.ts` автоматически не тестируются (в проекте нет DOM-тестов) — ручная проверка в tasks.

## Notes

- **Утверждённый тест TB-19a** (`src/wall-edit-tee.test.ts`) закреплял удаляемую ветку «Орто не сработало». По решению пользователя (`test-change-request.md`, вариант 1) он удалён; новое ожидание проверяет GE-4.
- GS-5 и OG-1 проверяют, что новый жест начинается без оси; что `main.ts` создаёт жест на каждом `pointerdown` и удаляет на `pointerup`, этими тестами не ловится (DOM) — ручная проверка в tasks.
- В одном полном прогоне vitest вывел предупреждение о необработанных ошибках; при повторном прогоне оно не воспроизвелось.

## Validation round 3 → changes

Валидация 3 — `VERDICT: FAIL` (выжил мутант G19: из привязки исключались только стены, увлекаемые целиком). Исправлено:

- F8: OG-18 (перемещение, растягиваемые боковые стены комнаты вне сетки), OG-19 (перетаскивание конца, растягиваемая соосная стена).
- F9: в test-plan.md GS-2 убран из стражей мутации «конус 15° в `orthoAxisOf`».
