# Test Suite

Новые файлы (существующие тесты не менялись; продакшн-код не менялся):

- `src/wall-snap-block-face.test.ts` — привязка (`snapStartVertex`);
- `src/auto-dimensions-block.test.ts` — автоматические размеры (`placeWall`);
- `src/wall-geometry-diagonal-continuation.test.ts` — отображаемая форма стыка (`displayPolygons`) и привязка + установка третьей стены.

Запуск: `npx vitest run src/wall-snap-block-face.test.ts src/auto-dimensions-block.test.ts src/wall-geometry-diagonal-continuation.test.ts` — 50 тестов обнаружены раннером, 27 падают до реализации, 23 проходят (см. «Unexpected Passes»).

## Tests

| ID | Requirement | Test File | Test Name | Initial Result |
|---|---|---|---|---|
| BS-1 | wall-drawing: грань, продолженная блоком | wall-snap-block-face.test.ts | BS-1: курсор (15, −15) — правая половина блока | FAIL (сетка) |
| BS-1a | то же | wall-snap-block-face.test.ts | BS-1a: курсор (10, −15) — середина блока | PASS (регрессионный) |
| BS-1b | то же | wall-snap-block-face.test.ts | BS-1b: курсор (5, −15) — левая половина | PASS (регрессионный) |
| BS-1c | то же | wall-snap-block-face.test.ts | BS-1c: порядок B, A, курсор (15, −15) | PASS (см. Unexpected Passes) |
| BS-1d | то же | wall-snap-block-face.test.ts | BS-1d: результат не зависит от порядка стен A, B — курсоры (15,−15), (28,−19), (20,−15) | FAIL ×3 |
| BS-2 | то же | wall-snap-block-face.test.ts | BS-2: курсор (20, −15) — край блока включительно | FAIL |
| BS-2a | то же | wall-snap-block-face.test.ts | BS-2a: курсор (25, −19) — за краем блока в пределах зоны | FAIL |
| BS-2c | то же | wall-snap-block-face.test.ts | BS-2c: курсор (28, −19) — глубже в зону | FAIL |
| BS-2b | то же | wall-snap-block-face.test.ts | BS-2b: курсор (30.5, −20) — за зоной | PASS (негативный) |
| BS-3 | то же | wall-snap-block-face.test.ts | BS-3: курсор (60, −16) — далеко | PASS (негативный) |
| BS-4 | то же | wall-snap-block-face.test.ts | BS-4: t = 195, курсор (150, −150) | FAIL |
| BS-4a | то же | wall-snap-block-face.test.ts | BS-4a: t = 195, курсор (190, −120) | FAIL |
| BS-4b | то же | wall-snap-block-face.test.ts | BS-4b: t = 195, курсор (150, −195) | FAIL |
| BS-4c | то же | wall-snap-block-face.test.ts | BS-4c: t = 195, курсор (150, −200) | PASS (негативный) |
| BS-5 | wall-drawing: грань без блока не меняется | wall-snap-block-face.test.ts | BS-5: одна стена A, курсор (24, −14) | PASS (регрессионный) |
| BS-5c | то же | wall-snap-block-face.test.ts | BS-5c: одна стена A, курсор (21, −13) | PASS (регрессионный) |
| BS-5a | то же | wall-snap-block-face.test.ts | BS-5a: одна стена A, курсор (−50, −15) | PASS (регрессионный) |
| BS-5b | то же | wall-snap-block-face.test.ts | BS-5b: параллельные стены на диагонали | PASS (регрессионный) |
| BD-1 | dimension-tool: торцы под блоком | auto-dimensions-block.test.ts | BD-1: у A размер толщины только на дальнем торце a | FAIL |
| BD-2 | то же | auto-dimensions-block.test.ts | BD-2: у B размер толщины только на дальнем торце b | FAIL |
| BD-3 | то же | auto-dimensions-block.test.ts | BD-3: после C размеры толщины A и B у блока отсутствуют, у C — на свободном торце | FAIL |
| BD-4 | то же | auto-dimensions-block.test.ts | BD-4: параллельные стены на диагонали | PASS (регрессионный) |
| BD-4a | то же | auto-dimensions-block.test.ts | BD-4a: свободная стена рядом с блоком | PASS (регрессионный) |
| BD-5 | то же | auto-dimensions-block.test.ts | BD-5: ничего внутри блока | FAIL |
| BD-6 | то же | auto-dimensions-block.test.ts | BD-6: порядок B, A | FAIL |
| BD-7 | то же | auto-dimensions-block.test.ts | BD-7: пересчёт при установке C | FAIL |
| IC-1 | то же | auto-dimensions-block.test.ts | IC-1: цепочка A, B, C — три размера толщины | FAIL |
| IC-2 | то же | auto-dimensions-block.test.ts | IC-2: t = 195 | FAIL |
| BJ-1 | wall-joints: продолжение B за блок | wall-geometry-diagonal-continuation.test.ts | BJ-1: C вплотную к блоку — полоса без просвета | FAIL |
| BJ-1a | то же | wall-geometry-diagonal-continuation.test.ts | BJ-1a: куски не налагаются | PASS (см. Unexpected Passes) |
| BJ-1b | то же | wall-geometry-diagonal-continuation.test.ts | BJ-1b: оси и длины прежние | PASS (инвариант) |
| BJ-1c | то же | wall-geometry-diagonal-continuation.test.ts | BJ-1c: порядок C, A, B | FAIL |
| BJ-1d | то же | wall-geometry-diagonal-continuation.test.ts | BJ-1d: C толщиной 40 см | FAIL |
| BJ-2 | wall-joints: продолжение A за блок | wall-geometry-diagonal-continuation.test.ts | BJ-2: D (20,0)→(120,0) | FAIL |
| BJ-3 | wall-joints: допуск конца продолжения | wall-geometry-diagonal-continuation.test.ts | BJ-3 ×4: смещение на 0.99 см | FAIL ×4 |
| BJ-4 | wall-joints: за допуском | wall-geometry-diagonal-continuation.test.ts | BJ-4 ×4: смещение на 1.01 см | PASS ×4 (негативный) |
| BJ-5 | wall-joints: не продолжение | wall-geometry-diagonal-continuation.test.ts | BJ-5: перпендикулярная стена от F | PASS (негативный) |
| BJ-5a | то же | wall-geometry-diagonal-continuation.test.ts | BJ-5a: стена от F в сторону блока | PASS (негативный) |
| BJ-5b | wall-joints: два конца продолжения | wall-geometry-diagonal-continuation.test.ts | BJ-5b: C и C′ на 0.5 см | PASS (негативный) |
| BJ-5c | wall-joints: другой конец в пороге | wall-geometry-diagonal-continuation.test.ts | BJ-5c: чужой конец (−5, −14) | PASS (негативный) |
| BJ-5d | wall-joints: диагональный стык | wall-geometry-diagonal-continuation.test.ts | BJ-5d: без третьей стены блок залит | PASS (регрессионный) |
| BJ-6 | wall-drawing + wall-joints | wall-geometry-diagonal-continuation.test.ts | BJ-6: привязка и C от вершины привязки | FAIL |

## Coverage

### Happy paths

- BS-1, BS-1a, BS-4: прилипание над блоком (t = 20 и t = 195).
- BD-1, BD-2, BD-3, IC-1, IC-2: размеры толщины только на свободных торцах.
- BJ-1, BJ-2, BJ-6: замкнутая форма Т-образной стены.

### Boundary cases

- BS-2, BS-2a, BS-2c, BS-2b: край блока и зона от края (внутри — 25 и 28 см, снаружи — 30.5 см).
- BS-4b / BS-4c: поперечная граница при t = 195.
- BJ-3 / BJ-4: допуск конца продолжения 0.99 / 1.01 см по обеим осям в обе стороны.

### Negative cases

- BS-2b, BS-3, BS-4c: прилипания нет за зоной.
- BD-4, BD-4a: торцы без блока сохраняют размеры толщины.
- BJ-4, BJ-5, BJ-5a, BJ-5b, BJ-5c: блок не заливается, если конец — не продолжение.

### Invariants

- Квадрат установки не налагается на тела (`maxOverlap` в `expectFaceSnap`).
- Куски разных стен не налагаются (BJ-1a, BJ-2, BJ-6).
- Ничего внутри блока (BD-5, BD-6, BD-7, IC-2); порядок стен (BS-1d, BD-6, BJ-1c).
- Входные стены не изменяются (`deepFreeze`: BS-1, BJ-1, BJ-1b).

### Integration cases

- BD-3, BD-7, IC-1: цепочка A, B, C; пересчёт размеров A и B.
- BJ-6: привязка, затем установка C.

## Unexpected Passes

- BS-1c (порядок B, A): проходит до реализации. При порядке B, A блок принадлежит A, и запасное правило `snapStartVertex` (квадрат по сетке касается тела — кандидаты касаемых стен) берёт A, у которой есть нужная грань. При порядке A, B блок принадлежит B, запасное правило берёт B и находит грань B. Остаётся защитой от регрессии порядка; сравнение порядков в BS-1d.
- BJ-1a: до реализации блока нет и куски не налагаются; тест защищает от наложения после реализации.
- Регрессионные и негативные тесты (BS-1a, BS-1b, BS-2b, BS-3, BS-4c, BS-5*, BD-4, BD-4a, BJ-1b, BJ-4, BJ-5*): поведение, которое по спецификации не должно меняться.

## Tests That Could Not Run

- Нет. Мутационного инструмента в проекте нет (только vitest), мутации проверяет валидатор вручную.

## Notes

- Точки BS-2a, BS-2c, BS-2b выбраны так, чтобы грань B (цель с вершиной (20, 0)) не была ближе грани A: по существующему правилу ближайшая цель — по расстоянию до точки приставления квадрата.
- Размеры длины граней тестами намеренно не покрыты: вне объёма change.
